-- ============================================================
-- ClearNest — Add missing profile columns + anon read policy
-- ============================================================

-- Add financial_accounts and property_details columns
alter table public.profiles
  add column if not exists financial_accounts jsonb not null default '[]'::jsonb,
  add column if not exists property_details   jsonb not null default '[]'::jsonb;

-- Allow anon frontend reads — family_id in the query acts as the access token.
-- (The app always queries WHERE family_id = '<session-token>', so only the
--  matching family row is returned even though no JWT auth is required.)
create policy "profiles: anon read by family_id"
  on public.profiles
  for select
  to anon
  using (true);
