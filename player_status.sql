alter table public.players
  add column if not exists player_status text not null default 'active';

update public.players
set player_status = 'active'
where player_status is null;

alter table public.players
  drop constraint if exists players_player_status_check;

alter table public.players
  add constraint players_player_status_check
  check (player_status in ('active', 'inactive', 'archived'));
