-- Family Atlas security hardening

-- Add minimal invitation visibility policies so the table is not an exposed RLS table with no policy.
drop policy if exists "atlas admins can view invitations" on public.atlas_invitations;
create policy "atlas admins can view invitations"
on public.atlas_invitations
for select
to authenticated
using (public.is_atlas_admin(atlas_id));

drop policy if exists "invited users can view own pending invitation" on public.atlas_invitations;
create policy "invited users can view own pending invitation"
on public.atlas_invitations
for select
to authenticated
using (
  lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  and status = 'pending'
  and expires_at > now()
);

-- Secure search paths on helper functions flagged by the database linter.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.storage_atlas_id(object_name text)
returns uuid
language plpgsql
stable
set search_path = pg_catalog, public, storage
as $$
declare
  first_folder text;
begin
  first_folder := (storage.foldername(object_name))[1];
  if first_folder is null then
    return null;
  end if;
  begin
    return first_folder::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

-- Remove anonymous access from SECURITY DEFINER functions.
revoke execute on function public.create_atlas_with_admin_profile(text, text, text, text, text) from anon;
revoke execute on function public.create_atlas_member_invitation(uuid, text, text) from anon;
revoke execute on function public.consume_atlas_member_invitation() from anon;
revoke execute on function public.is_atlas_admin(uuid) from anon;
revoke execute on function public.is_atlas_member(uuid) from anon;

-- Explicitly keep only the signed-in execution paths that the app relies on.
grant execute on function public.create_atlas_with_admin_profile(text, text, text, text, text) to authenticated;
grant execute on function public.create_atlas_member_invitation(uuid, text, text) to authenticated;
grant execute on function public.consume_atlas_member_invitation() to authenticated;
grant execute on function public.is_atlas_admin(uuid) to authenticated;
grant execute on function public.is_atlas_member(uuid) to authenticated;

-- Add covering indexes for invitation foreign keys flagged by the performance advisor.
create index if not exists atlas_invitations_profile_id_idx
  on public.atlas_invitations(profile_id);
create index if not exists atlas_invitations_invited_by_idx
  on public.atlas_invitations(invited_by);

-- Avoid per-row auth.uid() re-evaluation in the two direct own-record policies.
drop policy if exists "linked users can update own profile" on public.profiles;
create policy "linked users can update own profile"
on public.profiles
for update
to authenticated
using (
  linked_user_id = (select auth.uid())
  and public.is_atlas_member(atlas_id)
)
with check (
  linked_user_id = (select auth.uid())
  and public.is_atlas_member(atlas_id)
);

drop policy if exists "linked users can update own travel" on public.profile_travel;
create policy "linked users can update own travel"
on public.profile_travel
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_travel.profile_id
      and p.linked_user_id = (select auth.uid())
      and public.is_atlas_member(p.atlas_id)
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_travel.profile_id
      and p.linked_user_id = (select auth.uid())
      and public.is_atlas_member(p.atlas_id)
  )
);
