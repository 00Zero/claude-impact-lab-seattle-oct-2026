-- Contractor profiles with an optional profile picture stored in a private
-- bucket. Objects live at avatars/<user id>/<file>.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.profiles from anon;

alter table public.profiles enable row level security;

-- Takes text so storage policies can pass a folder name without casting.
create function public.shares_org_with(other_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id::text = other_user_id
  );
$$;

revoke execute on function public.shares_org_with(text) from public, anon;
grant execute on function public.shares_org_with(text) to authenticated;

create policy "Users can read their own and teammates' profiles"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or public.shares_org_with(id::text));

create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Private bucket: images are served through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/webp'])
on conflict (id) do nothing;

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can replace their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can view their own and teammates' avatars"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.shares_org_with((storage.foldername(name))[1])
    )
  );
