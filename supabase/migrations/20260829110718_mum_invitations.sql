create table if not exists public.atlas_invitations (
  id uuid primary key default gen_random_uuid(),
  atlas_id uuid not null references public.atlases(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member', 'child')),
  invited_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'consumed', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create unique index if not exists atlas_invitations_one_pending_profile on public.atlas_invitations (atlas_id, profile_id) where status = 'pending';
alter table public.atlas_invitations enable row level security;

create or replace function public.create_atlas_member_invitation(p_atlas_id uuid,p_profile_key text,p_email text)
returns public.atlas_invitations language plpgsql security definer set search_path=public as $$
declare caller_id uuid:=auth.uid(); target_profile public.profiles%rowtype; invitation public.atlas_invitations%rowtype; normalized_email text:=lower(trim(p_email));
begin
 if caller_id is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.atlas_members where atlas_id=p_atlas_id and user_id=caller_id and role='admin') then raise exception 'Atlas administrator access required'; end if;
 if normalized_email='' then raise exception 'A valid email address is required'; end if;
 select * into target_profile from public.profiles where atlas_id=p_atlas_id and profile_key=p_profile_key;
 if not found then raise exception 'Target profile was not found in this Atlas'; end if;
 if target_profile.linked_user_id is not null then raise exception 'Target profile is already linked'; end if;
 insert into public.atlas_invitations(atlas_id,profile_id,email,role,invited_by) values(p_atlas_id,target_profile.id,normalized_email,'member',caller_id)
 on conflict(atlas_id,profile_id) where status='pending' do update set email=excluded.email,invited_by=excluded.invited_by,created_at=now(),expires_at=now()+interval '7 days' returning * into invitation;
 return invitation;
end; $$;

create or replace function public.consume_atlas_member_invitation()
returns table(atlas_id uuid,profile_id uuid,role text) language plpgsql security definer set search_path=public as $$
declare caller_id uuid:=auth.uid(); caller_email text:=lower(trim(auth.jwt()->>'email')); pending public.atlas_invitations%rowtype;
begin
 if caller_id is null or caller_email is null then return; end if;
 select * into pending from public.atlas_invitations where lower(email)=caller_email and status='pending' and expires_at>now() order by created_at desc limit 1 for update;
 if not found then return; end if;
 update public.profiles set linked_user_id=caller_id where id=pending.profile_id and atlas_id=pending.atlas_id and linked_user_id is null;
 if not found then raise exception 'Invitation target is already linked'; end if;
 insert into public.atlas_members(atlas_id,user_id,role) values(pending.atlas_id,caller_id,pending.role) on conflict(atlas_id,user_id) do update set role=excluded.role;
 update public.atlas_invitations set status='consumed' where id=pending.id;
 return query select pending.atlas_id,pending.profile_id,pending.role;
end; $$;

revoke all on function public.create_atlas_member_invitation(uuid,text,text) from public;
grant execute on function public.create_atlas_member_invitation(uuid,text,text) to authenticated;
revoke all on function public.consume_atlas_member_invitation() from public;
grant execute on function public.consume_atlas_member_invitation() to authenticated;
