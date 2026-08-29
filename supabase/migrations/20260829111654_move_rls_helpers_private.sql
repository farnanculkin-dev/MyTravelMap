-- Move RLS helper functions out of the exposed public API schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_atlas_member(target_atlas_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.atlas_members am
    where am.atlas_id = target_atlas_id
      and am.user_id = auth.uid()
  );
$$;

create or replace function private.is_atlas_admin(target_atlas_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.atlas_members am
    where am.atlas_id = target_atlas_id
      and am.user_id = auth.uid()
      and am.role = 'admin'
  );
$$;

revoke all on function private.is_atlas_member(uuid) from public;
revoke all on function private.is_atlas_admin(uuid) from public;
grant execute on function private.is_atlas_member(uuid) to authenticated;
grant execute on function private.is_atlas_admin(uuid) to authenticated;

-- Rebuild public-table RLS policies against private helpers.
drop policy if exists "atlas members can view atlas" on public.atlases;
create policy "atlas members can view atlas" on public.atlases for select to authenticated
using (private.is_atlas_member(id));

drop policy if exists "atlas admins can update atlas" on public.atlases;
create policy "atlas admins can update atlas" on public.atlases for update to authenticated
using (private.is_atlas_admin(id)) with check (private.is_atlas_admin(id));

drop policy if exists "members can view atlas membership" on public.atlas_members;
create policy "members can view atlas membership" on public.atlas_members for select to authenticated
using (private.is_atlas_member(atlas_id));

drop policy if exists "admins can manage atlas membership" on public.atlas_members;
create policy "admins can manage atlas membership" on public.atlas_members for all to authenticated
using (private.is_atlas_admin(atlas_id)) with check (private.is_atlas_admin(atlas_id));

drop policy if exists "atlas members can view profiles" on public.profiles;
create policy "atlas members can view profiles" on public.profiles for select to authenticated
using (private.is_atlas_member(atlas_id));

drop policy if exists "linked users can update own profile" on public.profiles;
create policy "linked users can update own profile" on public.profiles for update to authenticated
using (linked_user_id = (select auth.uid()) and private.is_atlas_member(atlas_id))
with check (linked_user_id = (select auth.uid()) and private.is_atlas_member(atlas_id));

drop policy if exists "atlas admins can manage profiles" on public.profiles;
create policy "atlas admins can manage profiles" on public.profiles for all to authenticated
using (private.is_atlas_admin(atlas_id)) with check (private.is_atlas_admin(atlas_id));

drop policy if exists "atlas members can view travel" on public.profile_travel;
create policy "atlas members can view travel" on public.profile_travel for select to authenticated
using (exists (select 1 from public.profiles p where p.id = profile_travel.profile_id and private.is_atlas_member(p.atlas_id)));

drop policy if exists "linked users can update own travel" on public.profile_travel;
create policy "linked users can update own travel" on public.profile_travel for update to authenticated
using (exists (select 1 from public.profiles p where p.id = profile_travel.profile_id and p.linked_user_id = (select auth.uid()) and private.is_atlas_member(p.atlas_id)))
with check (exists (select 1 from public.profiles p where p.id = profile_travel.profile_id and p.linked_user_id = (select auth.uid()) and private.is_atlas_member(p.atlas_id)));

drop policy if exists "atlas admins can manage travel" on public.profile_travel;
create policy "atlas admins can manage travel" on public.profile_travel for all to authenticated
using (exists (select 1 from public.profiles p where p.id = profile_travel.profile_id and private.is_atlas_admin(p.atlas_id)))
with check (exists (select 1 from public.profiles p where p.id = profile_travel.profile_id and private.is_atlas_admin(p.atlas_id)));

-- Invitation visibility policies.
drop policy if exists "atlas admins can view invitations" on public.atlas_invitations;
create policy "atlas admins can view invitations" on public.atlas_invitations for select to authenticated
using (private.is_atlas_admin(atlas_id));

-- Rebuild storage policies against private helpers.
drop policy if exists "atlas members can view atlas media" on storage.objects;
create policy "atlas members can view atlas media" on storage.objects for select to authenticated
using (bucket_id = 'atlas-media' and private.is_atlas_member(public.storage_atlas_id(name)));

drop policy if exists "atlas members can upload permitted atlas media" on storage.objects;
create policy "atlas members can upload permitted atlas media" on storage.objects for insert to authenticated
with check (
  bucket_id = 'atlas-media' and (
    private.is_atlas_admin(public.storage_atlas_id(name))
    or exists (
      select 1 from public.profiles p
      where p.atlas_id = public.storage_atlas_id(name)
        and p.linked_user_id = (select auth.uid())
        and (storage.foldername(name))[2] = 'profiles'
        and (storage.foldername(name))[3] = p.id::text
    )
  )
);

drop policy if exists "atlas members can update permitted atlas media" on storage.objects;
create policy "atlas members can update permitted atlas media" on storage.objects for update to authenticated
using (
  bucket_id = 'atlas-media' and (
    private.is_atlas_admin(public.storage_atlas_id(name))
    or exists (
      select 1 from public.profiles p
      where p.atlas_id = public.storage_atlas_id(name)
        and p.linked_user_id = (select auth.uid())
        and (storage.foldername(name))[2] = 'profiles'
        and (storage.foldername(name))[3] = p.id::text
    )
  )
)
with check (
  bucket_id = 'atlas-media' and (
    private.is_atlas_admin(public.storage_atlas_id(name))
    or exists (
      select 1 from public.profiles p
      where p.atlas_id = public.storage_atlas_id(name)
        and p.linked_user_id = (select auth.uid())
        and (storage.foldername(name))[2] = 'profiles'
        and (storage.foldername(name))[3] = p.id::text
    )
  )
);

drop policy if exists "atlas members can delete permitted atlas media" on storage.objects;
create policy "atlas members can delete permitted atlas media" on storage.objects for delete to authenticated
using (
  bucket_id = 'atlas-media' and (
    private.is_atlas_admin(public.storage_atlas_id(name))
    or exists (
      select 1 from public.profiles p
      where p.atlas_id = public.storage_atlas_id(name)
        and p.linked_user_id = (select auth.uid())
        and (storage.foldername(name))[2] = 'profiles'
        and (storage.foldername(name))[3] = p.id::text
    )
  )
);

-- Remove exposed helper RPCs entirely once no policy depends on them.
revoke all on function public.is_atlas_member(uuid) from public;
revoke all on function public.is_atlas_admin(uuid) from public;
drop function public.is_atlas_member(uuid);
drop function public.is_atlas_admin(uuid);
