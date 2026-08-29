create or replace function public.consume_atlas_member_invitation()
returns table (atlas_id uuid, profile_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text := lower(trim(auth.jwt() ->> 'email'));
  pending public.atlas_invitations%rowtype;
begin
  if caller_id is null or caller_email is null then return; end if;

  select * into pending
  from public.atlas_invitations ai
  where lower(ai.email) = caller_email
    and ai.status = 'pending'
    and ai.expires_at > now()
  order by ai.created_at desc
  limit 1
  for update;

  if not found then return; end if;

  update public.profiles p
  set linked_user_id = caller_id
  where p.id = pending.profile_id
    and p.atlas_id = pending.atlas_id
    and p.linked_user_id is null;

  if not found then
    raise exception 'Invitation target is already linked';
  end if;

  insert into public.atlas_members (atlas_id, user_id, role)
  values (pending.atlas_id, caller_id, pending.role)
  on conflict (atlas_id, user_id)
  do update set role = excluded.role;

  update public.atlas_invitations ai
  set status = 'consumed'
  where ai.id = pending.id;

  return query
  select pending.atlas_id, pending.profile_id, pending.role;
end;
$$;

revoke all on function public.consume_atlas_member_invitation() from public;
revoke all on function public.consume_atlas_member_invitation() from anon;
grant execute on function public.consume_atlas_member_invitation() to authenticated;
