-- ARISE leaderboard schema
-- Paste this into: Supabase Dashboard → SQL Editor → New query → Run

create table if not exists public.leaderboard (
  id          bigserial primary key,
  name        text       not null check (char_length(name) between 1 and 12),
  score       integer    not null check (score >= 0),
  coins       integer    not null default 0 check (coins >= 0),
  towers      integer    not null default 0 check (towers >= 0),
  zone        integer    not null default 1 check (zone between 1 and 99),
  created_at  timestamptz not null default now()
);

create index if not exists leaderboard_score_idx
  on public.leaderboard (score desc, created_at asc);

alter table public.leaderboard enable row level security;

-- Anyone (including unauthenticated visitors) can read the board.
drop policy if exists "leaderboard read" on public.leaderboard;
create policy "leaderboard read"
  on public.leaderboard for select
  to anon, authenticated
  using (true);

-- Anyone can submit a score. Server-side checks enforce sane shape and
-- realistic numeric bounds so a bot with the publishable key can't squat
-- the board with absurd values.
drop policy if exists "leaderboard insert" on public.leaderboard;
create policy "leaderboard insert"
  on public.leaderboard for insert
  to anon, authenticated
  with check (
    char_length(name) between 1 and 12
    and name ~ '^[A-Z0-9 _.\-]+$'
    and score >= 0 and score <= 100000
    and coins >= 0 and coins <= 100000
    and towers >= 0 and towers <= 10000
    and zone between 1 and 99
  );
