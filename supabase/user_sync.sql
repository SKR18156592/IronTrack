-- user_sync: the single table index.html syncs through (one row per user).
-- Idempotent: safe to run on a project where the table already exists.
-- It does not change existing columns; it only adds missing ones, enables RLS,
-- replaces the policies below, and adds the table to realtime.

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

-- Verify afterwards:
--   select relrowsecurity from pg_class where relname = 'user_sync';   -- expect: true
--   select policyname, cmd from pg_policies where tablename = 'user_sync';
