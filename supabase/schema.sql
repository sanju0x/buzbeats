create extension if not exists pgcrypto;

create table if not exists public.radio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_email text,
  language text not null,
  mood text not null,
  source text not null default 'grok',
  created_at timestamptz not null default now()
);

create table if not exists public.radio_session_tracks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.radio_sessions(id) on delete cascade,
  position integer not null,
  title text,
  artist text,
  duration_ms integer,
  artwork_url text,
  uri text,
  encoded_track text,
  created_at timestamptz not null default now()
);

alter table public.radio_sessions enable row level security;
alter table public.radio_session_tracks enable row level security;

create policy "service role can manage radio sessions"
  on public.radio_sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role can manage radio session tracks"
  on public.radio_session_tracks
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
