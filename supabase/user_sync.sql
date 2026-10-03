-- The tables the app syncs through:
--   user_sync         one row per user: settings, customizations, profile
--   workout_sessions  one row per logged workout session
-- Idempotent: safe to run on a project where the tables already exist.
-- It does not change existing columns; it only adds missing ones, enables RLS,
-- replaces the policies below, and adds user_sync to realtime. workout_sessions is left out
-- on purpose: after uploading sessions, the app sends a realtime broadcast that tells the
-- other devices to pull.

create table if not exists public.user_sync (
  user_id uuid primary key references auth.users on delete cascade
);

alter table public.user_sync
  add column if not exists microcycle_config    jsonb,
  add column if not exists custom_days          jsonb,
  add column if not exists custom_sections      jsonb,
  add column if not exists hidden_days          jsonb,
  add column if not exists history              jsonb,
  add column if not exists custom_exercises     jsonb,
  add column if not exists hidden_exercises     jsonb,
  add column if not exists custom_variations    jsonb,
  add column if not exists hidden_variations    jsonb,
  add column if not exists var_order            jsonb,
  add column if not exists exercise_orders      jsonb,
  add column if not exists section_orders       jsonb,
  add column if not exists local_storage_backup jsonb,
  add column if not exists profile_name         text,
  add column if not exists profile_age          text,
  add column if not exists profile_weight       text,
  add column if not exists profile_height       text,
  add column if not exists profile_sex          text,
  add column if not exists profile_avatar       text,
  add column if not exists updated_at           timestamptz default now();

-- Row-Level Security: each signed-in user can only see and change their own row.
alter table public.user_sync enable row level security;

drop policy if exists "user_sync_select_own" on public.user_sync;
drop policy if exists "user_sync_insert_own" on public.user_sync;
drop policy if exists "user_sync_update_own" on public.user_sync;
drop policy if exists "user_sync_delete_own" on public.user_sync;

create policy "user_sync_select_own" on public.user_sync
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_sync_insert_own" on public.user_sync
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_sync_update_own" on public.user_sync
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "user_sync_delete_own" on public.user_sync
  for delete to authenticated using (user_id = (select auth.uid()));

-- Realtime: add the table without touching anything else in the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_sync'
  ) then
    alter publication supabase_realtime add table public.user_sync;
  end if;
end $$;

-- workout_sessions: one row per session, so a sync uploads only new or changed sessions.
-- A deleted session stays as a row with deleted = true, so the deletion reaches other devices.
-- (Older app versions kept the whole history in user_sync.history; the app moves it over once.)
create table if not exists public.workout_sessions (
  user_id    uuid not null references auth.users on delete cascade,
  id         text not null,
  data       jsonb,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists workout_sessions_user_updated on public.workout_sessions (user_id, updated_at);

-- The server sets updated_at, so a device with a wrong clock can't hide a change from other devices
-- (they pull rows changed since the newest updated_at they have seen).
create or replace function public.workout_sessions_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists workout_sessions_touch on public.workout_sessions;
create trigger workout_sessions_touch before insert or update on public.workout_sessions
  for each row execute function public.workout_sessions_touch();

alter table public.workout_sessions enable row level security;

drop policy if exists "workout_sessions_select_own" on public.workout_sessions;
drop policy if exists "workout_sessions_insert_own" on public.workout_sessions;
drop policy if exists "workout_sessions_update_own" on public.workout_sessions;
drop policy if exists "workout_sessions_delete_own" on public.workout_sessions;

create policy "workout_sessions_select_own" on public.workout_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "workout_sessions_insert_own" on public.workout_sessions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "workout_sessions_update_own" on public.workout_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "workout_sessions_delete_own" on public.workout_sessions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Verify afterwards:
--   select relrowsecurity from pg_class where relname = 'user_sync';   -- expect: true
--   select policyname, cmd from pg_policies where tablename = 'user_sync';
--   select relrowsecurity from pg_class where relname = 'workout_sessions';  -- expect: true
