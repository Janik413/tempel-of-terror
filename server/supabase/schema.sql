-- ============================================================================
-- Temple of Horror - database schema for Supabase
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Profiles: one row per account with a public username
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(username) between 2 and 20),
  created_at timestamptz not null default now()
);

-- Usernames are unique regardless of upper/lower case
create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- ----------------------------------------------------------------------------
-- Games: one row per finished game (written by the game server only)
-- ----------------------------------------------------------------------------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  finished_at timestamptz not null default now(),
  theme text not null,
  player_count int not null check (player_count between 3 and 10),
  rounds_played int not null check (rounds_played between 1 and 4),
  winner text not null check (winner in ('adventurers', 'hexen')),
  reason text not null check (reason in ('allGold', 'allTraps', 'roundsOver'))
);

-- ----------------------------------------------------------------------------
-- Game players: one row per account and game (guests are not stored)
-- ----------------------------------------------------------------------------
create table public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('adventurer', 'hexe')),
  won boolean not null,
  -- Chambers this player opened as key holder
  opened_gold int not null default 0,
  opened_empty int not null default 0,
  opened_trap int not null default 0,
  -- How often other players opened one of this player's chambers ("trust")
  times_opened_by_others int not null default 0,
  primary key (game_id, user_id)
);

create index game_players_user_idx on public.game_players (user_id);

-- ----------------------------------------------------------------------------
-- Aggregated statistics per account
-- ----------------------------------------------------------------------------
create view public.player_stats with (security_invoker = true) as
select
  p.id as user_id,
  p.username,
  count(gp.game_id) as games_played,
  count(gp.game_id) filter (where gp.won) as wins,
  count(gp.game_id) filter (where gp.role = 'adventurer') as games_as_adventurer,
  count(gp.game_id) filter (where gp.role = 'adventurer' and gp.won) as wins_as_adventurer,
  count(gp.game_id) filter (where gp.role = 'hexe') as games_as_hexe,
  count(gp.game_id) filter (where gp.role = 'hexe' and gp.won) as wins_as_hexe,
  coalesce(sum(gp.opened_gold), 0) as opened_gold,
  coalesce(sum(gp.opened_empty), 0) as opened_empty,
  coalesce(sum(gp.opened_trap), 0) as opened_trap,
  coalesce(sum(gp.times_opened_by_others), 0) as times_opened_by_others
from public.profiles p
left join public.game_players gp on gp.user_id = p.id
group by p.id, p.username;

-- ----------------------------------------------------------------------------
-- Row level security
-- Everybody may read (profiles, leaderboard, history). Writing games is only
-- possible with the secret key, which only the game server has.
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;

create policy "Profiles are readable by everyone" on public.profiles
  for select using (true);

create policy "Users can rename themselves" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Games are readable by everyone" on public.games
  for select using (true);

create policy "Game players are readable by everyone" on public.game_players
  for select using (true);

-- ----------------------------------------------------------------------------
-- Create the profile automatically when somebody signs up.
-- The username comes from the sign-up form (user metadata), with a fallback.
-- ----------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      'player_' || substr(new.id::text, 1, 8)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
