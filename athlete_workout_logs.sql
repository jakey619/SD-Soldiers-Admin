create extension if not exists pgcrypto;

create table if not exists public.athlete_workout_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_name text not null,
  team_name text not null,
  workout_date date not null,
  activities jsonb not null default '{}'::jsonb,
  notes text,
  focus_area text,
  effort_level integer,
  advanced_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists athlete_workout_logs_unique_entry
  on public.athlete_workout_logs (lower(athlete_name), team_name, workout_date);

create or replace function public.set_athlete_workout_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists athlete_workout_logs_updated_at
  on public.athlete_workout_logs;

create trigger athlete_workout_logs_updated_at
before update on public.athlete_workout_logs
for each row
execute function public.set_athlete_workout_logs_updated_at();
