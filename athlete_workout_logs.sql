create extension if not exists pgcrypto;

create table if not exists public.athlete_workout_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_name text not null,
  athlete_name_key text,
  team_name text not null,
  workout_date date not null,
  activities jsonb not null default '{}'::jsonb,
  activity_notes jsonb not null default '{}'::jsonb,
  activity_levels jsonb not null default '{}'::jsonb,
  notes text,
  focus_area text,
  effort_level integer,
  advanced_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.athlete_workout_logs
  add column if not exists athlete_name_key text;

update public.athlete_workout_logs
set athlete_name_key = lower(btrim(athlete_name))
where athlete_name_key is null
   or athlete_name_key <> lower(btrim(athlete_name));

alter table public.athlete_workout_logs
  alter column athlete_name_key set not null;

alter table public.athlete_workout_logs
  add column if not exists activity_notes jsonb not null default '{}'::jsonb;

alter table public.athlete_workout_logs
  add column if not exists activity_levels jsonb not null default '{}'::jsonb;

drop index if exists athlete_workout_logs_unique_entry;

create unique index if not exists athlete_workout_logs_unique_entry
  on public.athlete_workout_logs (athlete_name_key, team_name, workout_date);

create or replace function public.set_athlete_workout_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.athlete_name_key = lower(btrim(new.athlete_name));
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists athlete_workout_logs_updated_at
  on public.athlete_workout_logs;

create trigger athlete_workout_logs_updated_at
before insert or update on public.athlete_workout_logs
for each row
execute function public.set_athlete_workout_logs_updated_at();
