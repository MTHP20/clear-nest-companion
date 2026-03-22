# ClearNest — Supabase Backend

This directory contains the database migrations and Edge Function that power the Clara session pipeline.

## Architecture

```
ElevenLabs (conversation ends)
  │
  │  POST webhook  (HMAC-SHA256 signed)
  ▼
supabase/functions/elevenlabs-webhook
  │
  ├── 1. Verify signature
  ├── 2. Fetch full transcript from ElevenLabs API
  ├── 3. Encrypt transcript (AES-256-GCM)
  ├── 4. Insert row → sessions table
  ├── 5. Extract structured data via Claude API
  └── 6. Upsert row → profiles table
```

---

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed and logged in
- A Supabase project created at [app.supabase.com](https://app.supabase.com)
- An ElevenLabs account with a Clara agent configured
- An Anthropic API key

---

## 1 — Link your project

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

---

## 2 — Run the migrations

```bash
supabase db push
```

This creates the `sessions` and `profiles` tables with all indexes and RLS policies.

---

## 3 — Set secrets

All secrets are stored server-side — **never in code or `.env` files.**

```bash
# Generate a 32-byte hex key for transcript encryption
openssl rand -hex 32

# Then set all secrets:
supabase secrets set \
  ELEVENLABS_API_KEY="your_elevenlabs_api_key" \
  ELEVENLABS_WEBHOOK_SECRET="your_elevenlabs_webhook_signing_secret" \
  ANTHROPIC_API_KEY="your_anthropic_api_key" \
  TRANSCRIPT_ENCRYPTION_KEY="your_32_byte_hex_key_from_above"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do not set them manually.

---

## 4 — Deploy the Edge Function

```bash
supabase functions deploy elevenlabs-webhook --no-verify-jwt
```

`--no-verify-jwt` is required because ElevenLabs sends its own HMAC signature — we verify that manually inside the function instead.

After deploying, note the function URL:

```
https://<project-ref>.supabase.co/functions/v1/elevenlabs-webhook
```

---

## 5 — Configure the ElevenLabs webhook

1. In the ElevenLabs dashboard, open your Clara agent → **Webhooks**
2. Add a new webhook:
   - **URL:** `https://<project-ref>.supabase.co/functions/v1/elevenlabs-webhook`
   - **Events:** `conversation.ended`
3. Copy the **Signing Secret** shown and save it as `ELEVENLABS_WEBHOOK_SECRET` (step 3 above)

---

## 6 — Pass `family_id` from the frontend

ElevenLabs lets you attach custom metadata to a conversation at start time. Pass the family's ID here so the webhook can write to the correct row:

```typescript
// In your useClara hook or wherever you call startSession:
await conversation.startSession({
  dynamicVariables: {
    family_id: currentFamilyId,   // e.g. auth.user.id
  },
});
```

In the ElevenLabs agent configuration, map `family_id` through to the conversation metadata so it arrives in the webhook payload under `data.metadata.family_id`.

---

## 7 — Set up auth `family_id` claim (for RLS)

RLS policies check `auth.jwt() -> 'app_metadata' ->> 'family_id'`. Set this when a user signs up or is provisioned:

```typescript
// Server-side only (service role required)
const { error } = await supabase.auth.admin.updateUserById(userId, {
  app_metadata: { family_id: userId }, // simplest: use Supabase user ID as family_id
});
```

---

## Schema reference

### `sessions`

| Column            | Type        | Notes                              |
|-------------------|-------------|------------------------------------|
| `id`              | uuid PK     | Auto-generated                     |
| `conversation_id` | text unique | ElevenLabs conversation ID         |
| `family_id`       | text        | Links to `profiles.family_id`      |
| `transcript`      | text        | AES-256-GCM encrypted, base64      |
| `duration_seconds`| integer     | Call duration from ElevenLabs      |
| `topics_covered`  | jsonb       | String array extracted by Claude   |
| `created_at`      | timestamptz | Set at insert time                 |

### `profiles`

| Column           | Type        | Notes                              |
|------------------|-------------|------------------------------------|
| `id`             | uuid PK     | Auto-generated                     |
| `family_id`      | text unique | One row per family                 |
| `bank_accounts`  | jsonb       | Array of `{bank_name, account_type, notes}` |
| `pension_status` | text        | Free-text status description       |
| `lpa_confirmed`  | boolean     | True only if explicitly confirmed  |
| `will_location`  | text        | Where the will is stored           |
| `key_contacts`   | jsonb       | Array of `{name, role, phone?}`    |
| `care_wishes`    | text        | Free-text care preferences         |
| `last_updated`   | timestamptz | Updated on each profile upsert     |

---

## Decrypting transcripts

The Edge Function encrypts each transcript with AES-256-GCM before storing it. To read one back in a trusted context (e.g. a backend admin tool):

```typescript
async function decryptTranscript(base64: string, hexKey: string): Promise<string> {
  const keyBytes = new Uint8Array(hexKey.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);

  const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
  return new TextDecoder().decode(plaintext);
}
```

---

## Local development

```bash
# Start local Supabase stack
supabase start

# Serve the function locally (hot-reload)
supabase functions serve elevenlabs-webhook --env-file ./supabase/.env.local

# Send a test webhook (replace values as needed)
curl -X POST http://localhost:54321/functions/v1/elevenlabs-webhook \
  -H "Content-Type: application/json" \
  -H "ElevenLabs-Signature: t=$(date +%s),v1=test" \
  -d '{"type":"conversation.ended","event_timestamp":1700000000,"data":{"conversation_id":"test-123","agent_id":"agent-abc","status":"done","metadata":{"family_id":"family-xyz"}}}'
```

Create `supabase/.env.local` for local dev secrets — **never commit this file**:

```
ELEVENLABS_API_KEY=...
ELEVENLABS_WEBHOOK_SECRET=...
ANTHROPIC_API_KEY=...
TRANSCRIPT_ENCRYPTION_KEY=...
```
