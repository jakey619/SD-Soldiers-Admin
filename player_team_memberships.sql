create extension if not exists pgcrypto;

create table if not exists public.player_team_memberships (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_name text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (player_id, team_name)
);

create index if not exists player_team_memberships_player_id_idx
  on public.player_team_memberships (player_id);

create index if not exists player_team_memberships_team_name_idx
  on public.player_team_memberships (team_name);

insert into public.player_team_memberships (player_id, team_name, is_primary)
select id, suggested_team, true
from public.players
where suggested_team is not null
  and suggested_team <> 'Undecided'
on conflict (player_id, team_name) do update
set is_primary = public.player_team_memberships.is_primary
                 or excluded.is_primary;
