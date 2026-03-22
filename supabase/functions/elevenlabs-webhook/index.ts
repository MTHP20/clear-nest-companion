/**
 * ClearNest — ElevenLabs Webhook Edge Function
 *
 * Triggered by ElevenLabs when a Clara conversation ends.
 * Pipeline:
 *   1. Verify webhook signature (HMAC-SHA256)
 *   2. Fetch full transcript from ElevenLabs API
 *   3. Encrypt transcript (AES-256-GCM) and write to `sessions`
 *   4. Extract structured profile data via Claude API
 *   5. Upsert extracted data into `profiles`
 *
 * Required Supabase secrets (set via `supabase secrets set`):
 *   ELEVENLABS_API_KEY       — ElevenLabs API key
 *   ELEVENLABS_WEBHOOK_SECRET — Webhook signing secret from ElevenLabs dashboard
 *   ANTHROPIC_API_KEY        — Anthropic API key
 *   TRANSCRIPT_ENCRYPTION_KEY — 32-byte hex string used for AES-256-GCM
 *   SUPABASE_URL             — Injected automatically by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — Injected automatically by Supabase
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ElevenLabsWebhookPayload {
  type: string;
  event_timestamp: number;
  data: {
    conversation_id: string;
    agent_id: string;
    status: string;
    /** Optional — set this in ElevenLabs conversation metadata to link a family */
    metadata?: {
      family_id?: string;
      [key: string]: unknown;
    };
  };
}

interface ElevenLabsTranscriptTurn {
  role: "user" | "agent";
  message: string;
  time_in_call_secs?: number;
}

interface ElevenLabsConversationDetail {
  conversation_id: string;
  transcript: ElevenLabsTranscriptTurn[];
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    [key: string]: unknown;
  };
}

interface ClaudeExtractedProfile {
  bank_accounts: Array<{
    bank_name: string;
    account_type: string;
    notes: string;
  }>;
  pension_status: string | null;
  lpa_confirmed: boolean;
  will_location: string | null;
  key_contacts: Array<{
    name: string;
    role: string;
    phone?: string;
  }>;
  care_wishes: string | null;
  topics_covered: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verify the ElevenLabs webhook signature (HMAC-SHA256). */
async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  // Header format: "t=<timestamp>,v1=<hex_signature>"
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=")),
  );
  const timestamp = parts["t"];
  const receivedSig = parts["v1"];
  if (!timestamp || !receivedSig) return false;

  // Reject messages older than 5 minutes
  const age = Date.now() / 1000 - Number(timestamp);
  if (age > 300) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const message = `${timestamp}.${rawBody}`;
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const expectedSig = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (expectedSig.length !== receivedSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    mismatch |= expectedSig.charCodeAt(i) ^ receivedSig.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Encrypt plaintext using AES-256-GCM. Returns base64(iv + ciphertext). */
async function encryptTranscript(
  plaintext: string,
  hexKey: string,
): Promise<string> {
  const keyBytes = new Uint8Array(
    hexKey.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
  );
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoded,
  );

  // Prepend IV to ciphertext so decryption has everything it needs
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/** Fetch the full conversation detail from ElevenLabs. */
async function fetchElevenLabsConversation(
  conversationId: string,
  apiKey: string,
): Promise<ElevenLabsConversationDetail> {
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
    { headers: { "xi-api-key": apiKey } },
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`ElevenLabs API error ${resp.status}: ${err}`);
  }
  return resp.json() as Promise<ElevenLabsConversationDetail>;
}

/** Build a plain-text representation of the transcript for Claude. */
function buildTranscriptText(turns: ElevenLabsTranscriptTurn[]): string {
  return turns
    .map((t) => `${t.role === "user" ? "Margaret" : "Clara"}: ${t.message}`)
    .join("\n");
}

/** Call the Claude API to extract structured profile data from the transcript. */
async function extractProfileWithClaude(
  transcriptText: string,
  apiKey: string,
): Promise<ClaudeExtractedProfile> {
  const systemPrompt = `You are an assistant helping a family organise critical financial and legal information following a dementia diagnosis. You will be given a transcript of a conversation between an elderly person and Clara (an AI assistant). Extract structured information carefully and conservatively — only include information that was clearly stated. Do not infer or guess.

Respond with a JSON object matching this exact schema:
{
  "bank_accounts": [{ "bank_name": string, "account_type": string, "notes": string }],
  "pension_status": string | null,
  "lpa_confirmed": boolean,
  "will_location": string | null,
  "key_contacts": [{ "name": string, "role": string, "phone": string | undefined }],
  "care_wishes": string | null,
  "topics_covered": string[]
}

Rules:
- "lpa_confirmed" is true only if the person clearly stated they have a signed LPA in place.
- "topics_covered" should be a list of short topic labels (e.g. ["bank_accounts", "pension", "lpa"]).
- If a field is not mentioned, use null or an empty array.
- Never fabricate information.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Here is the conversation transcript:\n\n${transcriptText}\n\nExtract the structured profile data as JSON.`,
        },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude API error ${resp.status}: ${err}`);
  }

  const result = await resp.json();
  const rawText: string = result.content?.[0]?.text ?? "{}";

  // Strip markdown code fences if Claude wrapped the JSON
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, rawText];
  const jsonText = (jsonMatch[1] ?? rawText).trim();

  try {
    return JSON.parse(jsonText) as ClaudeExtractedProfile;
  } catch {
    console.error("Failed to parse Claude response as JSON:", jsonText);
    return {
      bank_accounts: [],
      pension_status: null,
      lpa_confirmed: false,
      will_location: null,
      key_contacts: [],
      care_wishes: null,
      topics_covered: [],
    };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // ── Read secrets ────────────────────────────────────────────────────────────
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  const ELEVENLABS_WEBHOOK_SECRET = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const TRANSCRIPT_ENCRYPTION_KEY = Deno.env.get("TRANSCRIPT_ENCRYPTION_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (
    !ELEVENLABS_API_KEY ||
    !ELEVENLABS_WEBHOOK_SECRET ||
    !ANTHROPIC_API_KEY ||
    !TRANSCRIPT_ENCRYPTION_KEY ||
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error("One or more required environment variables are missing");
    return new Response("Internal Server Error", { status: 500 });
  }

  // ── Read & verify body ──────────────────────────────────────────────────────
  const rawBody = await req.text();

  const signatureHeader = req.headers.get("ElevenLabs-Signature");
  const valid = await verifyWebhookSignature(
    rawBody,
    signatureHeader,
    ELEVENLABS_WEBHOOK_SECRET,
  );
  if (!valid) {
    console.warn("Webhook signature verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  // ── Parse payload ───────────────────────────────────────────────────────────
  let payload: ElevenLabsWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  // Only process conversation-ended events
  if (payload.type !== "conversation.ended") {
    return new Response("OK", { status: 200 });
  }

  const { conversation_id, metadata } = payload.data;
  const family_id = metadata?.family_id ?? "unknown";

  console.log(`Processing conversation ${conversation_id} for family ${family_id}`);

  // ── Fetch transcript from ElevenLabs ────────────────────────────────────────
  let conversation: ElevenLabsConversationDetail;
  try {
    conversation = await fetchElevenLabsConversation(
      conversation_id,
      ELEVENLABS_API_KEY,
    );
  } catch (err) {
    console.error("Failed to fetch ElevenLabs conversation:", err);
    return new Response("Internal Server Error", { status: 500 });
  }

  const transcriptText = buildTranscriptText(conversation.transcript ?? []);
  const duration = conversation.metadata?.call_duration_secs ?? 0;

  // ── Encrypt transcript ──────────────────────────────────────────────────────
  let encryptedTranscript: string;
  try {
    encryptedTranscript = await encryptTranscript(
      transcriptText,
      TRANSCRIPT_ENCRYPTION_KEY,
    );
  } catch (err) {
    console.error("Encryption failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }

  // ── Extract profile data via Claude ─────────────────────────────────────────
  let extracted: ClaudeExtractedProfile;
  try {
    extracted = await extractProfileWithClaude(transcriptText, ANTHROPIC_API_KEY);
  } catch (err) {
    console.error("Claude extraction failed:", err);
    // Non-fatal — we still write the session, just with empty topics
    extracted = {
      bank_accounts: [],
      pension_status: null,
      lpa_confirmed: false,
      will_location: null,
      key_contacts: [],
      care_wishes: null,
      topics_covered: [],
    };
  }

  // ── Write to Supabase ───────────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Insert session row
  const { error: sessionError } = await supabase.from("sessions").insert({
    conversation_id,
    family_id,
    transcript: encryptedTranscript,
    duration_seconds: Math.round(duration),
    topics_covered: extracted.topics_covered,
  });

  if (sessionError) {
    // Duplicate conversation_id — safe to ignore (idempotent webhook delivery)
    if (sessionError.code === "23505") {
      console.log(`Conversation ${conversation_id} already stored — skipping`);
      return new Response("OK", { status: 200 });
    }
    console.error("Failed to insert session:", sessionError);
    return new Response("Internal Server Error", { status: 500 });
  }

  // Upsert profile row (merge new data into existing profile)
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      family_id,
      bank_accounts: extracted.bank_accounts,
      pension_status: extracted.pension_status,
      lpa_confirmed: extracted.lpa_confirmed,
      will_location: extracted.will_location,
      key_contacts: extracted.key_contacts,
      care_wishes: extracted.care_wishes,
      last_updated: new Date().toISOString(),
    },
    {
      onConflict: "family_id",
      // Only overwrite non-null fields so earlier data isn't lost
      ignoreDuplicates: false,
    },
  );

  if (profileError) {
    console.error("Failed to upsert profile:", profileError);
    // Session was already written — log the error but return 200 so ElevenLabs
    // doesn't retry (the session is safe, the profile can be backfilled)
    return new Response("OK", { status: 200 });
  }

  console.log(
    `Stored session ${conversation_id} and updated profile for family ${family_id}`,
  );
  return new Response("OK", { status: 200 });
});
