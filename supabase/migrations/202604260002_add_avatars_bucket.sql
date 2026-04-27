-- Drop the restrictive select policy if it exists
drop policy if exists profiles_select_own on public.profiles;

-- Make profiles public
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

-- Ensure users can update their own profile
drop policy if exists profiles_update_own on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid()::text = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid()::text = id);

-- Create the avatars bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Bucket policies
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

create policy "Users can upload their own avatar."
  on storage.objects for insert
  with check ( bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1] );

create policy "Users can update their own avatar."
  on storage.objects for update
  using ( bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1] );

create policy "Users can delete their own avatar."
  on storage.objects for delete
  using ( bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1] );
