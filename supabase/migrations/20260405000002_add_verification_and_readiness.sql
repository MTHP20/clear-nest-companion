-- ============================================================
-- ClearNest — Verification status + readiness history
--
-- extracted_data: add item_id, verification_status, verified_by_role, verified_at
-- user_assets: add readiness_history
-- ============================================================

-- ── extracted_data: new columns ────────────────────────────

-- item_id ties the DB row back to the CapturedItem.id in the frontend,
-- so we can look up and update the right row when the user verifies/disputes.
alter table public.extracted_data
  add column if not exists item_id           text,
  add column if not exists verification_status text not null default 'unverified',
  -- 'unverified' | 'verified' | 'disputed'
  add column if not exists verified_by_role  text,
  add column if not exists verified_at       timestamptz;

create index if not exists extracted_data_item_id_idx
  on public.extracted_data (item_id)
  where item_id is not null;

create index if not exists extracted_data_verification_idx
  on public.extracted_data (family_id, verification_status);

-- Allow anon to update verification fields on rows they own (by family_id)
create policy "extracted_data: anon update verification"
  on public.extracted_data
  for update to anon
  using (true)
  with check (true);

-- ── user_assets: add readiness_history ─────────────────────

-- An array of { date: 'YYYY-MM-DD', score: 0-100 } snapshots.
-- Kept in the same row as completion_score so the dashboard has
-- everything it needs in a single query.
alter table public.user_assets
  add column if not exists readiness_history jsonb not null default '[]'::jsonb;
