create table if not exists public.profiles (
  id text primary key,
  email text not null unique,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boards (
  id text primary key,
  owner_id text not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  thumbnail_path text,
  canvas_state jsonb,
  created_at timestamptz not null default now(),
  last_edited_at timestamptz not null default now()
);

create index if not exists boards_owner_last_edited_idx
  on public.boards (owner_id, last_edited_at desc);

alter table public.profiles enable row level security;
alter table public.boards enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists boards_select_own on public.boards;
drop policy if exists boards_insert_own on public.boards;
drop policy if exists boards_update_own on public.boards;
drop policy if exists boards_delete_own on public.boards;

create policy profiles_select_own
on public.profiles
for select
using (auth.uid()::text = id);

create policy profiles_update_own
on public.profiles
for update
using (auth.uid()::text = id)
with check (auth.uid()::text = id);

create policy boards_select_own
on public.boards
for select
using (auth.uid()::text = owner_id);

create policy boards_insert_own
on public.boards
for insert
with check (auth.uid()::text = owner_id);

create policy boards_update_own
on public.boards
for update
using (auth.uid()::text = owner_id)
with check (auth.uid()::text = owner_id);

create policy boards_delete_own
on public.boards
for delete
using (auth.uid()::text = owner_id);
