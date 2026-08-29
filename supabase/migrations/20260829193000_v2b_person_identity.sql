-- Family Atlas V2B-0: durable Person identity foundation
-- Adds a life-long person identity beneath Atlas-scoped profiles without changing V2A behaviour.

create table public.people (
  id uuid primary key default gen_random_uuid(),
  linked_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  person_type text not null default 'guest' check (person_type in ('registered', 'guest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_display_name_not_blank check (length(trim(display_name)) > 0)
);

create unique index people_linked_user_id_unique_idx
  on public.people(linked_user_id)
  where linked_user_id is not null;

create index people_created_by_user_id_idx on public.people(created_by_user_id);

alter table public.profiles
  add column person_id uuid references public.people(id) on delete restrict;

-- Backfill every existing profile one-to-one into a durable Person.
-- A linked profile becomes a registered Person; an unlinked profile becomes a guest Person
-- until a deliberate account link/claim occurs later.
do $$
declare
  profile_row public.profiles%rowtype;
  resolved_person_id uuid;
  atlas_admin_user_id uuid;
begin
  for profile_row in
    select * from public.profiles order by created_at, id
  loop
    resolved_person_id := null;

    if profile_row.linked_user_id is not null then
      select p.id into resolved_person_id
      from public.people p
      where p.linked_user_id = profile_row.linked_user_id;
    end if;

    if resolved_person_id is null then
      select am.user_id into atlas_admin_user_id
      from public.atlas_members am
      where am.atlas_id = profile_row.atlas_id
        and am.role = 'admin'
      order by am.created_at
      limit 1;

      insert into public.people (
        linked_user_id,
        display_name,
        created_by_user_id,
        person_type
      ) values (
        profile_row.linked_user_id,
        profile_row.name,
        coalesce(profile_row.linked_user_id, atlas_admin_user_id),
        case when profile_row.linked_user_id is null then 'guest' else 'registered' end
      )
      returning id into resolved_person_id;
    end if;

    update public.profiles
    set person_id = resolved_person_id
    where id = profile_row.id;
  end loop;
end;
$$;

alter table public.profiles alter column person_id set not null;

create index profiles_person_id_idx on public.profiles(person_id);
create unique index profiles_atlas_person_unique_idx on public.profiles(atlas_id, person_id);

create trigger people_set_updated_at
before update on public.people
for each row execute function public.set_updated_at();

alter table public.people enable row level security;

-- A Person is readable when the caller is that Person, created that guest Person,
-- or belongs to an Atlas containing a profile linked to that Person.
create policy "trusted users can view people"
on public.people
for select
to authenticated
using (
  linked_user_id = (select auth.uid())
  or created_by_user_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles p
    where p.person_id = people.id
      and private.is_atlas_member(p.atlas_id)
  )
);

-- Supports the later V2B guest-person flow while preventing callers from creating
-- a Person on behalf of an unrelated authenticated user.
create policy "authenticated users can create people"
on public.people
for insert
to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and (linked_user_id is null or linked_user_id = (select auth.uid()))
);

create policy "owners creators and atlas admins can update people"
on public.people
for update
to authenticated
using (
  linked_user_id = (select auth.uid())
  or created_by_user_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles p
    where p.person_id = people.id
      and private.is_atlas_admin(p.atlas_id)
  )
)
with check (
  linked_user_id = (select auth.uid())
  or created_by_user_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles p
    where p.person_id = people.id
      and private.is_atlas_admin(p.atlas_id)
  )
);

create policy "creators and atlas admins can delete guest people"
on public.people
for delete
to authenticated
using (
  linked_user_id is null
  and person_type = 'guest'
  and (
    created_by_user_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles p
      where p.person_id = people.id
        and private.is_atlas_admin(p.atlas_id)
    )
  )
);

revoke all on public.people from anon;
grant select, insert, update, delete on public.people to authenticated;

-- New Atlas creation now creates a durable Person and links the Atlas profile to it.
create or replace function public.create_atlas_with_admin_profile(
  p_atlas_name text,
  p_atlas_type text,
  p_profile_key text,
  p_profile_name text,
  p_map_colour text default 'blue'
)
returns table (atlas_id uuid, profile_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_atlas_id uuid;
  v_profile_id uuid;
  v_person_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if trim(p_atlas_name) = '' then raise exception 'Atlas name is required'; end if;
  if p_atlas_type not in ('family','individual') then raise exception 'Atlas type must be family or individual'; end if;
  if trim(p_profile_key) = '' then raise exception 'Profile key is required'; end if;
  if trim(p_profile_name) = '' then raise exception 'Profile name is required'; end if;

  select id into v_person_id
  from public.people
  where linked_user_id = v_user_id;

  if v_person_id is null then
    insert into public.people(linked_user_id, display_name, created_by_user_id, person_type)
    values (v_user_id, trim(p_profile_name), v_user_id, 'registered')
    returning id into v_person_id;
  end if;

  insert into public.atlases(type,name)
  values (p_atlas_type, trim(p_atlas_name))
  returning id into v_atlas_id;

  insert into public.atlas_members(atlas_id,user_id,role)
  values (v_atlas_id,v_user_id,'admin');

  insert into public.profiles(atlas_id,person_id,profile_key,linked_user_id,name,map_colour,role)
  values (v_atlas_id,v_person_id,lower(trim(p_profile_key)),v_user_id,trim(p_profile_name),p_map_colour,'admin')
  returning id into v_profile_id;

  insert into public.profile_travel(profile_id,visited_country_ids)
  values (v_profile_id,'{}');

  return query select v_atlas_id, v_profile_id;
end;
$$;

-- Consuming an existing profile invitation now promotes that profile's Person
-- from guest to registered and links it to the newly authenticated user.
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
  target_person_id uuid;
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
    and p.linked_user_id is null
  returning p.person_id into target_person_id;

  if not found then
    raise exception 'Invitation target is already linked';
  end if;

  if exists (
    select 1 from public.people
    where linked_user_id = caller_id
      and id <> target_person_id
  ) then
    raise exception 'Authenticated user already has a different Person identity';
  end if;

  update public.people
  set linked_user_id = caller_id,
      person_type = 'registered'
  where id = target_person_id;

  insert into public.atlas_members (atlas_id, user_id, role)
  values (pending.atlas_id, caller_id, pending.role)
  on conflict on constraint atlas_members_atlas_id_user_id_key
  do update set role = excluded.role;

  update public.atlas_invitations ai
  set status = 'consumed'
  where ai.id = pending.id;

  return query
  select pending.atlas_id, pending.profile_id, pending.role;
end;
$$;
