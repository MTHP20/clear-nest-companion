/**
 * ClearNest — ElevenLabs Webhook Edge Function
 *
 * Triggered by ElevenLabs when a Clara conversation ends.
 * Pipeline:
 *   1. Verify webhook signature (HMAC-SHA256)
 *   2. Fetch full transcript from ElevenLabs API
 *   3. Encrypt transcript (AES-256-GCM) and write to `sessions`
 *   4. Extract structured profile data via Claude API (tool_use — strict schema)
 *   5. Merge extracted data into existing `profiles` row (never overwrites previous data)
 *
 * Required Supabase secrets (set via `supabase secrets set`):
 *   ELEVENLABS_API_KEY       — ElevenLabs API key
 *   ELEVENLABS_WEBHOOK_SECRET — Webhook signing secret from ElevenLabs dashboard
 *   OPENAI_API_KEY           — OpenAI API key
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
    call_summary_title?: string;
    transcript_summary?: string;
    [key: string]: unknown;
  };
}

/** Canonical extracted profile — used as both the Claude tool input schema and DB shape. */
interface ClaudeExtractedProfile {
  bank_accounts: Array<{
    bank_name: string;
    account_type: string;
    notes: string;
  }>;
  financial_accounts: Array<{
    type: string;
    provider: string;
    notes: string;
  }>;
  property_details: Array<{
    description: string;
    ownership_type: string;
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

/** Existing profiles row shape (partial — only the fields we need to merge). */
interface ExistingProfile {
  bank_accounts: ClaudeExtractedProfile["bank_accounts"];
  financial_accounts: ClaudeExtractedProfile["financial_accounts"];
  property_details: ClaudeExtractedProfile["property_details"];
  pension_status: string | null;
  lpa_confirmed: boolean;
  will_location: string | null;
  key_contacts: ClaudeExtractedProfile["key_contacts"];
  care_wishes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verify the ElevenLabs webhook signature (HMAC-SHA256). */
async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=")),
  );
  const timestamp = parts["t"];
  const receivedSig = parts["v1"];
  if (!timestamp || !receivedSig) return false;

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

  if (expectedSig.length !== receivedSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    mismatch |= expectedSig.charCodeAt(i) ^ receivedSig.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Encrypt plaintext using AES-256-GCM. Returns base64(iv + ciphertext). */
async function encryptTranscript(plaintext: string, hexKey: string): Promise<string> {
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

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded);

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

function buildTranscriptText(turns: ElevenLabsTranscriptTurn[]): string {
  return turns
    .map((t) => `${t.role === "user" ? "Margaret" : "Clara"}: ${t.message}`)
    .join("\n");
}

/**
 * Call the OpenAI API using function calling to extract structured profile data.
 * tool_choice forces the model to always call the function,
 * guaranteeing a schema-valid JSON response — no markdown fences, no deviation.
 */
async function extractProfileWithOpenAI(
  transcriptText: string,
  apiKey: string,
): Promise<ClaudeExtractedProfile> {
  const empty: ClaudeExtractedProfile = {
    bank_accounts: [],
    financial_accounts: [],
    property_details: [],
    pension_status: null,
    lpa_confirmed: false,
    will_location: null,
    key_contacts: [],
    care_wishes: null,
    topics_covered: [],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1500,
      tools: [
        {
          type: "function",
          function: {
            name: "store_extracted_profile",
            description:
              "Store all structured information extracted from the care-planning conversation transcript.",
            parameters: {
              type: "object",
              properties: {
                bank_accounts: {
                  type: "array",
                  description: "Bank accounts explicitly mentioned.",
                  items: {
                    type: "object",
                    properties: {
                      bank_name: { type: "string" },
                      account_type: {
                        type: "string",
                        description: "e.g. current, savings, ISA",
                      },
                      notes: { type: "string" },
                    },
                    required: ["bank_name", "account_type", "notes"],
                  },
                },
                financial_accounts: {
                  type: "array",
                  description: "Pensions, ISAs, investments, savings accounts (non-bank).",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        description: "e.g. pension, ISA, investment, annuity",
                      },
                      provider: { type: "string" },
                      notes: { type: "string" },
                    },
                    required: ["type", "provider", "notes"],
                  },
                },
                property_details: {
                  type: "array",
                  description: "Property ownership details explicitly mentioned.",
                  items: {
                    type: "object",
                    properties: {
                      description: {
                        type: "string",
                        description: "e.g. 3-bed house in Manchester",
                      },
                      ownership_type: {
                        type: "string",
                        description: "e.g. owned outright, mortgaged, rented, leasehold",
                      },
                      notes: { type: "string" },
                    },
                    required: ["description", "ownership_type", "notes"],
                  },
                },
                pension_status: {
                  type: ["string", "null"],
                  description: "Summary of pension arrangements, or null if not discussed.",
                },
                lpa_confirmed: {
                  type: "boolean",
                  description:
                    "True ONLY if the person clearly stated they have a signed Lasting Power of Attorney in place.",
                },
                will_location: {
                  type: ["string", "null"],
                  description: "Where the will is stored, or null if not mentioned.",
                },
                key_contacts: {
                  type: "array",
                  description: "Named contacts such as GP, solicitor, accountant, financial adviser.",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      role: { type: "string", description: "e.g. GP, solicitor, accountant" },
                      phone: { type: "string" },
                    },
                    required: ["name", "role"],
                  },
                },
                care_wishes: {
                  type: ["string", "null"],
                  description:
                    "Care preferences and end-of-life wishes explicitly stated, or null.",
                },
                topics_covered: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Short topic labels for what was discussed, e.g. [\"bank_accounts\", \"pension\", \"lpa\"].",
                },
              },
              required: [
                "bank_accounts",
                "financial_accounts",
                "property_details",
                "lpa_confirmed",
                "key_contacts",
                "topics_covered",
              ],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "store_extracted_profile" } },
      messages: [
        {
          role: "system",
          content:
            "You are extracting structured information from a care-planning conversation between an elderly person and Clara (an AI assistant). Extract only what was clearly stated — never infer or fabricate. Omit fields that were not mentioned.",
        },
        {
          role: "user",
          content: `Extract structured profile data from this care-planning conversation:\n\n${transcriptText}`,
        },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error ${resp.status}: ${err}`);
  }

  const result = await resp.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  const parsed = toolCall?.function?.arguments
    ? JSON.parse(toolCall.function.arguments)
    : undefined;

  if (!parsed) {
    console.error("OpenAI did not return a function call:", JSON.stringify(result));
    return empty;
  }

  return { ...empty, ...parsed };
}

/**
 * Merge two JSONB arrays, deduplicating by JSON string equality.
 * Existing items come first; new items are appended if not already present.
 */
function mergeArrays<T>(existing: T[], incoming: T[]): T[] {
  const seen = new Set<string>(existing.map((x) => JSON.stringify(x)));
  const result = [...existing];
  for (const item of incoming) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  const ELEVENLABS_WEBHOOK_SECRET = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const TRANSCRIPT_ENCRYPTION_KEY = Deno.env.get("TRANSCRIPT_ENCRYPTION_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (
    !ELEVENLABS_API_KEY ||
    !ELEVENLABS_WEBHOOK_SECRET ||
    !OPENAI_API_KEY ||
    !TRANSCRIPT_ENCRYPTION_KEY ||
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error("One or more required environment variables are missing");
    return new Response("Internal Server Error", { status: 500 });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("ElevenLabs-Signature");
  const valid = await verifyWebhookSignature(rawBody, signatureHeader, ELEVENLABS_WEBHOOK_SECRET);
  if (!valid) {
    console.warn("Webhook signature verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: ElevenLabsWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  if (payload.type !== "conversation.ended") {
    return new Response("OK", { status: 200 });
  }

  const { conversation_id, metadata } = payload.data;
  const family_id = metadata?.family_id ?? "unknown";
  console.log(`Processing conversation ${conversation_id} for family ${family_id}`);

  // ── Fetch transcript ────────────────────────────────────────────────────────
  let conversation: ElevenLabsConversationDetail;
  try {
    conversation = await fetchElevenLabsConversation(conversation_id, ELEVENLABS_API_KEY);
  } catch (err) {
    console.error("Failed to fetch ElevenLabs conversation:", err);
    return new Response("Internal Server Error", { status: 500 });
  }

  const transcriptText = buildTranscriptText(conversation.transcript ?? []);
  const duration = conversation.metadata?.call_duration_secs ?? 0;

  // ── Encrypt transcript ──────────────────────────────────────────────────────
  let encryptedTranscript: string;
  try {
    encryptedTranscript = await encryptTranscript(transcriptText, TRANSCRIPT_ENCRYPTION_KEY);
  } catch (err) {
    console.error("Encryption failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }

  // ── Extract profile via OpenAI (function calling) ──────────────────────────
  let extracted: ClaudeExtractedProfile;
  try {
    extracted = await extractProfileWithOpenAI(transcriptText, OPENAI_API_KEY);
  } catch (err) {
    console.error("OpenAI extraction failed:", err);
    extracted = {
      bank_accounts: [],
      financial_accounts: [],
      property_details: [],
      pension_status: null,
      lpa_confirmed: false,
      will_location: null,
      key_contacts: [],
      care_wishes: null,
      topics_covered: [],
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Insert session row ──────────────────────────────────────────────────────
  // transcript_turns stores the raw structured JSONB — the frontend renders
  // chat bubbles directly from this without ever calling ElevenLabs again.
  const cleanTurns = (conversation.transcript ?? []).filter(
    (t) => t.message && t.message.trim().length > 0
  );

  const { error: sessionError } = await supabase.from("sessions").insert({
    conversation_id,
    family_id,
    transcript: encryptedTranscript,
    transcript_turns: cleanTurns,
    call_summary_title: conversation.metadata?.call_summary_title ?? null,
    transcript_summary: conversation.metadata?.transcript_summary ?? null,
    message_count: cleanTurns.length,
    duration_seconds: Math.round(duration),
    topics_covered: extracted.topics_covered,
    source: "voice",
    status: "completed",
    started_at: conversation.metadata?.start_time_unix_secs
      ? new Date(conversation.metadata.start_time_unix_secs * 1000).toISOString()
      : new Date().toISOString(),
    ended_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (sessionError) {
    if (sessionError.code === "23505") {
      console.log(`Conversation ${conversation_id} already stored — skipping`);
      return new Response("OK", { status: 200 });
    }
    console.error("Failed to insert session:", sessionError);
    return new Response("Internal Server Error", { status: 500 });
  }

  // ── Merge profile data (never overwrite existing non-empty fields) ──────────
  // Read the existing profile row first so we can merge arrays instead of replacing them.
  const { data: existing } = await supabase
    .from("profiles")
    .select(
      "bank_accounts, financial_accounts, property_details, pension_status, lpa_confirmed, will_location, key_contacts, care_wishes",
    )
    .eq("family_id", family_id)
    .maybeSingle();

  const prev = (existing ?? {}) as Partial<ExistingProfile>;

  const merged = {
    family_id,
    // Arrays: append new unique items to what was already known
    bank_accounts: mergeArrays(prev.bank_accounts ?? [], extracted.bank_accounts),
    financial_accounts: mergeArrays(prev.financial_accounts ?? [], extracted.financial_accounts),
    property_details: mergeArrays(prev.property_details ?? [], extracted.property_details),
    key_contacts: mergeArrays(prev.key_contacts ?? [], extracted.key_contacts),
    // Scalar: keep existing value if new extraction is empty/null
    pension_status: extracted.pension_status ?? prev.pension_status ?? null,
    lpa_confirmed: extracted.lpa_confirmed || prev.lpa_confirmed || false,
    will_location: extracted.will_location ?? prev.will_location ?? null,
    care_wishes: extracted.care_wishes ?? prev.care_wishes ?? null,
    last_updated: new Date().toISOString(),
  };

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(merged, { onConflict: "family_id" });

  if (profileError) {
    console.error("Failed to upsert profile:", profileError);
    // Session was already written — return 200 so ElevenLabs doesn't retry
    return new Response("OK", { status: 200 });
  }

  console.log(
    `Stored session ${conversation_id} and merged profile for family ${family_id}`,
  );
  return new Response("OK", { status: 200 });
});
