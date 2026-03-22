-- ============================================================
-- ClearNest — Sessions & Profiles schema
-- ============================================================

-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- sessions
-- Stores one row per completed Clara conversation.
-- transcript is stored as AES-256-GCM encrypted base64
-- (encrypted by the Edge Function before insert).
-- ============================================================
create table if not exists public.sessions (
  id                uuid        primary key default gen_random_uuid(),
  conversation_id   text        not null unique,
  family_id         text        not null,
  transcript        text        not null,         -- AES-256-GCM encrypted
  duration_seconds  integer     not null default 0,
  topics_covered    jsonb       not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);

create index sessions_family_id_idx     on public.sessions (family_id);
create index sessions_conversation_id_idx on public.sessions (conversation_id);
create index sessions_created_at_idx    on public.sessions (created_at desc);

-- ============================================================
-- profiles
-- Stores one row per family — upserted after each session.
-- ============================================================
create table if not exists public.profiles (
  id              uuid        primary key default gen_random_uuid(),
  family_id       text        not null unique,
  bank_accounts   jsonb       not null default '[]'::jsonb,
  pension_status  text,
  lpa_confirmed   boolean     not null default false,
  will_location   text,
  key_contacts    jsonb       not null default '[]'::jsonb,
  care_wishes     text,
  last_updated    timestamptz not null default now()
);

create index profiles_family_id_idx on public.profiles (family_id);

-- ============================================================
-- Row-level security
--
-- family_id is stored as a custom claim in the Supabase JWT:
--   { "app_metadata": { "family_id": "<id>" } }
--
-- Set this via the Supabase Auth admin API when creating
-- a user account, e.g.:
--   supabase.auth.admin.updateUserById(userId, {
--     app_metadata: { family_id: '<id>' }
--   })
-- ============================================================

alter table public.sessions enable row level security;
alter table public.profiles enable row level security;

-- sessions: authenticated users see only their family's rows
create policy "sessions: family read own"
  on public.sessions
  for select
  to authenticated
  using (
    family_id = (auth.jwt() -> 'app_metadata' ->> 'family_id')
  );

-- sessions: only the service role (Edge Functions) may insert/update/delete
create policy "sessions: service role write"
  on public.sessions
  for all
  to service_role
  using (true)
  with check (true);

-- profiles: authenticated users see only their family's row
create policy "profiles: family read own"
  on public.profiles
  for select
  to authenticated
  using (
    family_id = (auth.jwt() -> 'app_metadata' ->> 'family_id')
  );

-- profiles: only the service role (Edge Functions) may insert/update/delete
create policy "profiles: service role write"
  on public.profiles
  for all
  to service_role
  using (true)
  with check (true);
