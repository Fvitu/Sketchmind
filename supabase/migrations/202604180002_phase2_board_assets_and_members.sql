create table if not exists public.board_members (
  board_id text not null references public.boards(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references public.boards(id) on delete cascade,
  uploader_id text not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists board_members_user_idx
  on public.board_members (user_id);

create index if not exists assets_board_idx
  on public.assets (board_id, created_at desc);

alter table public.board_members enable row level security;
alter table public.assets enable row level security;

drop policy if exists board_members_select_visible on public.board_members;
drop policy if exists board_members_manage_owner on public.board_members;
drop policy if exists assets_select_visible on public.assets;
drop policy if exists assets_insert_self on public.assets;
drop policy if exists assets_delete_self on public.assets;

create policy board_members_select_visible
on public.board_members
for select
using (
  auth.uid()::text = user_id
  or exists (
    select 1
    from public.boards
    where boards.id = board_members.board_id
      and boards.owner_id = auth.uid()::text
  )
);

create policy board_members_manage_owner
on public.board_members
for all
using (
  exists (
    select 1
    from public.boards
    where boards.id = board_members.board_id
      and boards.owner_id = auth.uid()::text
  )
)
with check (
  exists (
    select 1
    from public.boards
    where boards.id = board_members.board_id
      and boards.owner_id = auth.uid()::text
  )
);

create policy assets_select_visible
on public.assets
for select
using (
  exists (
    select 1
    from public.boards
    where boards.id = assets.board_id
      and boards.owner_id = auth.uid()::text
  )
  or exists (
    select 1
    from public.board_members
    where board_members.board_id = assets.board_id
      and board_members.user_id = auth.uid()::text
  )
);

create policy assets_insert_self
on public.assets
for insert
with check (auth.uid()::text = uploader_id);

create policy assets_delete_self
on public.assets
for delete
using (auth.uid()::text = uploader_id);
