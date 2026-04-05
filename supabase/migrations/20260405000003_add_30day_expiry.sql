-- ============================================================
-- ClearNest — 30-day auto-expiry for extracted_data
--
-- Dismissed and old captured facts are automatically purged
-- after 30 days to limit data retention.
--
-- NOTE: pg_cron requires Supabase Pro (or self-hosted with
-- pg_cron enabled). On the free tier this migration applies
-- without error but the schedule is a no-op — run the cleanup
-- manually or via a Supabase Edge Function cron instead.
-- ============================================================

-- Enable pg_cron if available (silently skips on free tier)
create extension if not exists pg_cron;

-- Schedule a daily cleanup at 03:00 UTC
-- Deletes any extracted_data row older than 30 days
select cron.schedule(
  'clearnest-delete-old-extracted-data',
  '0 3 * * *',
  $$
    delete from public.extracted_data
    where created_at < now() - interval '30 days';
  $$
);

-- ── Also clean up orphaned sessions (no corresponding extracted_data) ─────────
-- Sessions whose transcript is > 30 days old are also purged.
select cron.schedule(
  'clearnest-delete-old-sessions',
  '0 3 * * *',
  $$
    delete from public.sessions
    where created_at < now() - interval '30 days';
  $$
);

-- ── Fallback: RLS read filter (free-tier safe) ────────────────────────────────
-- Even without pg_cron, this policy ensures the frontend never reads
-- rows older than 30 days — they are invisible even if still on disk.
-- Drop the old anon read policy first, then recreate with TTL filter.
drop policy if exists "extracted_data: anon read" on public.extracted_data;

create policy "extracted_data: anon read (30d ttl)"
  on public.extracted_data
  for select to anon
  using (
    created_at >= now() - interval '30 days'
  );
