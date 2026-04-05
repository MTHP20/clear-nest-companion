-- ============================================================
-- ClearNest — Structured Data Tables
-- Adds: extracted_data, user_assets
-- Alters: sessions (adds summary, source, status, timestamps)
-- ============================================================

-- ── Extend sessions with new columns ───────────────────────
alter table public.sessions
  add column if not exists summary      text,
  add column if not exists source       text not null default 'voice',
  add column if not exists status       text not null default 'completed',
  add column if not exists started_at   timestamptz,
  add column if not exists ended_at     timestamptz,
  add column if not exists updated_at   timestamptz not null default now();

-- Backfill started_at from created_at
update public.sessions
set started_at = created_at
where started_at is null;

-- ── extracted_data ──────────────────────────────────────────
-- One row per extracted fact, linked to a session.
-- This is the auditable bridge between transcript and memory.
create table if not exists public.extracted_data (
  id             uuid        primary key default gen_random_uuid(),
  family_id      text        not null,
  session_id     uuid        references public.sessions(id) on delete set null,

  -- What type of fact this is
  category       text        not null,
  -- e.g. 'bank_accounts' | 'property' | 'pension' | 'will_location'
  --       'key_contact' | 'care_wish' | 'lpa_status' | 'general'

  -- Specific field within category
  field_name     text,
  -- e.g. 'bank_name', 'account_type', 'contact_name', 'has_will'

  -- The extracted value as structured JSON
  value_json     jsonb       not null default '{}'::jsonb,

  -- Extraction metadata
  confidence     numeric     not null default 1.0 check (confidence between 0 and 1),
  source_type    text        not null default 'claude_postprocess',
  -- 'elevenlabs_live' | 'claude_postprocess' | 'fallback_keyword' | 'manual'

  source_excerpt text,        -- raw transcript quote
  needs_review   boolean     not null default false,

  created_at     timestamptz not null default now()
);

create index if not exists extracted_data_family_id_idx  on public.extracted_data (family_id);
create index if not exists extracted_data_session_id_idx on public.extracted_data (session_id);
create index if not exists extracted_data_category_idx   on public.extracted_data (category);

-- RLS
alter table public.extracted_data enable row level security;

-- Anon read (family_id acts as access token in queries)
create policy "extracted_data: anon read"
  on public.extracted_data
  for select to anon
  using (true);

-- Anon insert — frontend writes facts after AI extraction
create policy "extracted_data: anon insert"
  on public.extracted_data
  for insert to anon
  with check (true);

-- Service role full access
create policy "extracted_data: service role write"
  on public.extracted_data
  for all to service_role
  using (true) with check (true);

-- ── user_assets ─────────────────────────────────────────────
-- One row per family — the materialized current state.
-- This is what the dashboard reads from.
create table if not exists public.user_assets (
  id                 uuid        primary key default gen_random_uuid(),
  family_id          text        not null unique,

  -- Structured asset categories (arrays of fact objects)
  bank_accounts      jsonb       not null default '[]'::jsonb,
  financial_accounts jsonb       not null default '[]'::jsonb,
  property_details   jsonb       not null default '[]'::jsonb,

  -- Singleton facts (objects with structured fields)
  pension_status     jsonb       not null default '{}'::jsonb,
  lpa_confirmed      jsonb       not null default '{}'::jsonb,
  will_location      jsonb       not null default '{}'::jsonb,

  -- Array categories
  key_contacts       jsonb       not null default '[]'::jsonb,
  care_wishes        jsonb       not null default '[]'::jsonb,

  -- Computed readiness score (0–100)
  completion_score   numeric     not null default 0 check (completion_score between 0 and 100),

  -- Link to most recent session
  last_session_id    uuid        references public.sessions(id) on delete set null,
  last_updated_at    timestamptz not null default now()
);

create index if not exists user_assets_family_id_idx on public.user_assets (family_id);

-- RLS
alter table public.user_assets enable row level security;

-- Anon read
create policy "user_assets: anon read"
  on public.user_assets
  for select to anon
  using (true);

-- Anon upsert — frontend upserts after each sync
create policy "user_assets: anon upsert"
  on public.user_assets
  for all to anon
  using (true) with check (true);

-- Service role full access
create policy "user_assets: service role write"
  on public.user_assets
  for all to service_role
  using (true) with check (true);
