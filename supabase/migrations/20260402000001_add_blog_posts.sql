-- ============================================================
-- ClearNest — Blog Posts schema
-- ============================================================

-- Create blog_posts table (idempotent — safe if already created via dashboard)
create table if not exists public.blog_posts (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  description text        not null,
  content     text,
  category    text        not null default 'General',
  picture_url text,
  date_posted date        not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Add content column if the table already existed without it
alter table public.blog_posts add column if not exists content text;

-- Enable RLS
alter table public.blog_posts enable row level security;

-- Anyone (including anonymous visitors) can read published posts
create policy "blog_posts: public read"
  on public.blog_posts
  for select
  to anon, authenticated
  using (true);

-- Only authenticated users (admins) may insert/update/delete
create policy "blog_posts: authenticated write"
  on public.blog_posts
  for all
  to authenticated
  using (true)
  with check (true);
