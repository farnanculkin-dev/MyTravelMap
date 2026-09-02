-- Family Atlas V2D: trusted wider-family/friend connections

create table public.atlas_connections (
  id uuid primary key default gen_random_uuid(),
  atlas_id uuid not null references public.atlases(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete restrict,
  relationship_label text,
  connection_type text not null default 'relative' check (connection_type in ('relative','friend','family')),
  email text,
  status text not null default 'saved' check (status in ('saved','invited','connected')),
  connected_user_id uuid references auth.users(id) on delete set null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (atlas_id, person_id)
);

create index atlas_connections_atlas_id_idx on public.atlas_connections(atlas_id);
create index atlas_connections_connected_user_id_idx on public.atlas_connections(connected_user_id);

create table public.atlas_connection_invitations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.atlas_connections(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending','consumed','cancelled')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create index atlas_connection_invitations_email_idx on public.atlas_connection_invitations(lower(email), status);

create trigger atlas_connections_set_updated_at
before update on public.atlas_connections
for each row execute function public.set_updated_at();

alter table public.atlas_connections enable row level security;
alter table public.atlas_connection_invitations enable row level security;

create policy "atlas members can view connections"
on public.atlas_connections for select to authenticated
using (private.is_atlas_member(atlas_id) or connected_user_id = (select auth.uid()));

create policy "atlas members can create connections"
on public.atlas_connections for insert to authenticated
with check (private.is_atlas_member(atlas_id) and created_by_user_id = (select auth.uid()));

create policy "connection creators and admins can update"
on public.atlas_connections for update to authenticated
using (created_by_user_id = (select auth.uid()) or private.is_atlas_admin(atlas_id))
with check (created_by_user_id = (select auth.uid()) or private.is_atlas_admin(atlas_id));

create policy "connection creators and admins can delete"
on public.atlas_connections for delete to authenticated
using (created_by_user_id = (select auth.uid()) or private.is_atlas_admin(atlas_id));

create policy "atlas members can view connection invitations"
on public.atlas_connection_invitations for select to authenticated
using (exists (
  select 1 from public.atlas_connections c
  where c.id = connection_id and private.is_atlas_member(c.atlas_id)
));

revoke all on public.atlas_connections from anon;
revoke all on public.atlas_connection_invitations from anon;
grant select, insert, update, delete on public.atlas_connections to authenticated;
grant select on public.atlas_connection_invitations to authenticated;

create or replace function public.create_atlas_connection(
  p_atlas_id uuid,
  p_display_name text,
  p_relationship_label text default null,
  p_connection_type text default 'relative',
  p_email text default null
)
returns table (connection_id uuid, person_id uuid)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_person_id uuid;
  v_connection_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.is_atlas_member(p_atlas_id) then raise exception 'Atlas membership required'; end if;
  if trim(coalesce(p_display_name,'')) = '' then raise exception 'Name is required'; end if;
  if p_connection_type not in ('relative','friend','family') then raise exception 'Invalid connection type'; end if;

  insert into public.people(display_name, created_by_user_id, person_type)
  values (trim(p_display_name), v_user_id, 'guest')
  returning id into v_person_id;

  insert into public.atlas_connections(atlas_id, person_id, relationship_label, connection_type, email, created_by_user_id)
  values (p_atlas_id, v_person_id, nullif(trim(coalesce(p_relationship_label,'')),''), p_connection_type, nullif(lower(trim(coalesce(p_email,''))),''), v_user_id)
  returning id into v_connection_id;

  return query select v_connection_id, v_person_id;
end;
$$;

grant execute on function public.create_atlas_connection(uuid,text,text,text,text) to authenticated;

create or replace function public.invite_atlas_connection(p_connection_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_connection public.atlas_connections%rowtype;
  v_email text := lower(trim(coalesce(p_email,'')));
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if v_email = '' then raise exception 'Email is required'; end if;

  select * into v_connection from public.atlas_connections where id = p_connection_id for update;
  if not found then raise exception 'Connection not found'; end if;
  if not (v_connection.created_by_user_id = v_user_id or private.is_atlas_admin(v_connection.atlas_id)) then
    raise exception 'Not permitted';
  end if;

  update public.atlas_connection_invitations
  set status = 'cancelled'
  where connection_id = p_connection_id and status = 'pending';

  insert into public.atlas_connection_invitations(connection_id,email)
  values (p_connection_id,v_email);

  update public.atlas_connections
  set email = v_email, status = 'invited'
  where id = p_connection_id;
end;
$$;

grant execute on function public.invite_atlas_connection(uuid,text) to authenticated;

create or replace function public.consume_atlas_connection_invitation()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(trim(auth.jwt() ->> 'email'));
  v_invite public.atlas_connection_invitations%rowtype;
  v_connection public.atlas_connections%rowtype;
  v_target_person uuid;
  v_existing_person uuid;
begin
  if v_user_id is null or v_email is null or v_email = '' then return; end if;

  select * into v_invite
  from public.atlas_connection_invitations
  where lower(email) = v_email and status = 'pending' and expires_at > now()
  order by created_at desc limit 1 for update;
  if not found then return; end if;

  select * into v_connection from public.atlas_connections where id = v_invite.connection_id for update;
  if not found then return; end if;

  v_target_person := v_connection.person_id;
  select id into v_existing_person from public.people where linked_user_id = v_user_id limit 1;

  if v_existing_person is null then
    update public.people
    set linked_user_id = v_user_id, person_type = 'registered'
    where id = v_target_person and linked_user_id is null;
    v_existing_person := v_target_person;
  elsif v_existing_person <> v_target_person then
    insert into public.trip_participants(trip_id, person_id, participant_role)
    select trip_id, v_existing_person, participant_role
    from public.trip_participants
    where person_id = v_target_person
    on conflict (trip_id, person_id) do nothing;

    delete from public.trip_participants where person_id = v_target_person;
    update public.atlas_connections set person_id = v_existing_person where id = v_connection.id;
    delete from public.people
    where id = v_target_person and person_type = 'guest' and linked_user_id is null
      and not exists (select 1 from public.profiles where person_id = v_target_person);
  end if;

  update public.atlas_connections
  set connected_user_id = v_user_id, status = 'connected', email = v_email
  where id = v_connection.id;

  update public.atlas_connection_invitations set status = 'consumed' where id = v_invite.id;
end;
$$;

grant execute on function public.consume_atlas_connection_invitation() to authenticated;
