-- CheckRaise — Supabase schema (Phase 2, launch scope)
-- Ported from src/utils/userStorage.js, which was designed as this spec.
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
--
-- Security model: Row Level Security ON for every table. The browser's anon
-- key is public by design; these policies are what make it safe — a signed-in
-- user can only read/write rows where user id matches their auth id.

-- ── profiles: one row per auth user ────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 20),
  initials text not null,
  streak int not null default 0,
  last_session_date date,              -- rolled at the player's local midnight
  timezone text,                       -- IANA zone, captured at signup
  sessions_completed int not null default 0,
  poker_score int,
  coach_note_body text,
  coach_note_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Archetype/schema is NOT stored: deriveSchema() recomputes it from skills.

-- ── skills: 8 rows per user (accuracy engine) ──────────────────────────────
create table public.skills (
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill text not null check (skill in
    ('preflop','position','aggression','betsize','bluffing','potodds','reads','opponent')),
  rating text not null default 'gray' check (rating in ('green','yellow','red','gray')),
  attempts int not null default 0,
  correct numeric(6,1) not null default 0,   -- partials earn 0.5
  primary key (user_id, skill)
);

-- ── sessions: one row per completed session (history log) ──────────────────
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  difficulty text not null,
  hands jsonb not null,                -- [{ scenarioId, skill, result, choiceVal }]
  correct_count int not null,
  coach_read text,
  created_at timestamptz not null default now()
);
create index sessions_user_created on public.sessions (user_id, created_at desc);

-- ── coach-read usage: per-user daily cap for /api/coach-read ───────────────
create table public.coach_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  calls int not null default 0,
  primary key (user_id, day)
);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.skills      enable row level security;
alter table public.sessions    enable row level security;
alter table public.coach_usage enable row level security;

create policy "own profile read"    on public.profiles for select using (auth.uid() = id);
create policy "own profile insert"  on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update"  on public.profiles for update using (auth.uid() = id);

create policy "own skills read"     on public.skills   for select using (auth.uid() = user_id);
create policy "own skills insert"   on public.skills   for insert with check (auth.uid() = user_id);
create policy "own skills update"   on public.skills   for update using (auth.uid() = user_id);

create policy "own sessions read"   on public.sessions for select using (auth.uid() = user_id);
create policy "own sessions insert" on public.sessions for insert with check (auth.uid() = user_id);
-- No update/delete policies on sessions: history is append-only by design.

-- coach_usage is written only by the server (service role bypasses RLS);
-- users may read their own count.
create policy "own usage read" on public.coach_usage for select using (auth.uid() = user_id);

-- ── beta feedback: insert-only from the app; founders read via SQL editor ──
-- (Added July 2026 for the dashboard beta-feedback form. If the base schema
-- is already deployed, run just this block in the Supabase SQL editor.)
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('gameplay', 'scenarios', 'technical', 'idea')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index feedback_created on public.feedback (created_at desc);

alter table public.feedback enable row level security;
create policy "own feedback insert" on public.feedback for insert with check (auth.uid() = user_id);
-- No select/update/delete policies: users can't read feedback back — it's a
-- one-way suggestion box the founders read with the service role.
