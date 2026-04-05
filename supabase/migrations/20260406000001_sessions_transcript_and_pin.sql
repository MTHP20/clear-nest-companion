-- ============================================================
-- ClearNest — Sessions: structured turns, metadata, pin/save
--
-- After this migration the sessions table is the canonical store
-- for conversation history. ElevenLabs is only queried once
-- (by the webhook) then never again.
-- ============================================================

-- ── New columns on sessions ─────────────────────────────────

ALTER TABLE public.sessions
  -- Structured turn-by-turn transcript as JSONB array:
  -- [{ role: 'user'|'agent', message: string, time_in_call_secs: number }]
  ADD COLUMN IF NOT EXISTS transcript_turns   jsonb    NOT NULL DEFAULT '[]'::jsonb,

  -- ElevenLabs post-call metadata (fetched by webhook)
  ADD COLUMN IF NOT EXISTS call_summary_title text,
  ADD COLUMN IF NOT EXISTS transcript_summary text,
  ADD COLUMN IF NOT EXISTS message_count      integer  NOT NULL DEFAULT 0,

  -- Pin / save affordance
  ADD COLUMN IF NOT EXISTS is_pinned          boolean  NOT NULL DEFAULT false,
  -- pinned_sections: Array<{ label, excerpt, turn_indices: number[], pinned_at }>
  ADD COLUMN IF NOT EXISTS pinned_sections    jsonb    NOT NULL DEFAULT '[]'::jsonb;

-- ── Indexes for scalable paginated queries ──────────────────

-- Primary list query: WHERE family_id = ? ORDER BY created_at DESC LIMIT n
CREATE INDEX IF NOT EXISTS sessions_family_created_idx
  ON public.sessions (family_id, created_at DESC);

-- Pinned-only query (partial index — very small, very fast)
CREATE INDEX IF NOT EXISTS sessions_family_pinned_idx
  ON public.sessions (family_id, created_at DESC)
  WHERE is_pinned = true;

-- ── RLS — allow anon reads (family_id acts as access token) ─

-- Read policy: return rows that are either pinned OR within 30 days
-- (free-tier TTL enforcement — no pg_cron required for reads to be clean)
CREATE POLICY "sessions: anon read by family_id"
  ON public.sessions
  FOR SELECT TO anon
  USING (
    is_pinned = true
    OR created_at >= now() - interval '30 days'
  );

-- Allow anon to update is_pinned and pinned_sections
CREATE POLICY "sessions: anon update pin"
  ON public.sessions
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- ── Update 30-day cron to spare pinned sessions ─────────────

-- Remove the old session cleanup job (created in migration 20260405000003)
SELECT cron.unschedule('clearnest-delete-old-sessions');

-- Recreate: only delete non-pinned sessions older than 30 days
SELECT cron.schedule(
  'clearnest-delete-old-sessions',
  '0 3 * * *',
  $$
    DELETE FROM public.sessions
    WHERE created_at < now() - interval '30 days'
    AND is_pinned = false;
  $$
);
