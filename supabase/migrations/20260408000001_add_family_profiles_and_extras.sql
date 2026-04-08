-- ============================================================
-- ClearNest — Family Profiles + User Assets extras
-- Adds: family_profiles table
-- Alters: user_assets (action_items, doc_checklist, action_notes)
-- ============================================================

-- ── family_profiles ─────────────────────────────────────────
-- One row per family — created/updated from onboarding.
create table if not exists public.family_profiles (
  id                   uuid        primary key default gen_random_uuid(),
  family_id            text        not null unique,
  elderly_name         text        not null default '',
  age                  text        not null default '',
  gender               text        not null default 'prefer-not-to-say',
  trusted_contact_name text        not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists family_profiles_family_id_idx on public.family_profiles (family_id);

alter table public.family_profiles enable row level security;

-- Anon read (family_id acts as access token in queries)
create policy "family_profiles: anon read"
  on public.family_profiles for select to anon using (true);

-- Anon upsert — frontend writes after onboarding / profile edits
create policy "family_profiles: anon upsert"
  on public.family_profiles for all to anon using (true) with check (true);

-- Service role full access
create policy "family_profiles: service role write"
  on public.family_profiles for all to service_role using (true) with check (true);

-- ── user_assets extras ───────────────────────────────────────
-- Add action_items, doc_checklist, action_notes so all runtime
-- state persists to Supabase (except theme which stays local).
alter table public.user_assets
  add column if not exists action_items  jsonb not null default '[]'::jsonb,
  add column if not exists doc_checklist jsonb not null default '[]'::jsonb,
  add column if not exists action_notes  jsonb not null default '{}'::jsonb;
