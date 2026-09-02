-- Family Atlas V2D: connected profiles and selective trip sharing

create table public.trip_connection_shares (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  connection_id uuid not null references public.atlas_connections(id) on delete cascade,
  shared_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (trip_id, connection_id)
);

create index trip_connection_shares_connection_id_idx on public.trip_connection_shares(connection_id);
create index trip_connection_shares_trip_id_idx on public.trip_connection_shares(trip_id);

alter table public.trip_connection_shares enable row level security;

create policy "atlas members can view trip shares"
on public.trip_connection_shares for select to authenticated
using (
  exists (
    select 1 from public.atlas_connections c
    join public.trips t on t.id = trip_id
    where c.id = connection_id
      and c.atlas_id = t.created_in_atlas_id
      and private.is_atlas_member(c.atlas_id)
  )
  or exists (
    select 1 from public.atlas_connections c
    where c.id = connection_id and c.connected_user_id = (select auth.uid())
  )
);

create policy "atlas members can create trip shares"
on public.trip_connection_shares for insert to authenticated
with check (
  shared_by_user_id = (select auth.uid())
  and exists (
    select 1 from public.atlas_connections c
    join public.trips t on t.id = trip_id
    where c.id = connection_id
      and c.atlas_id = t.created_in_atlas_id
      and c.status = 'connected'
      and private.is_atlas_member(c.atlas_id)
  )
);

create policy "atlas members can remove trip shares"
on public.trip_connection_shares for delete to authenticated
using (
  exists (
    select 1 from public.atlas_connections c
    join public.trips t on t.id = trip_id
    where c.id = connection_id
      and c.atlas_id = t.created_in_atlas_id
      and private.is_atlas_member(c.atlas_id)
  )
);

revoke all on public.trip_connection_shares from anon;
grant select, insert, delete on public.trip_connection_shares to authenticated;

-- Return only the deliberately exposed connected-profile summary.
create or replace function public.get_connected_profile(p_connection_id uuid)
returns table (
  connection_id uuid,
  person_id uuid,
  display_name text,
  relationship_label text,
  connection_type text,
  status text
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  return query
  select c.id, c.person_id, p.display_name, c.relationship_label, c.connection_type, c.status
  from public.atlas_connections c
  join public.people p on p.id = c.person_id
  where c.id = p_connection_id
    and (
      private.is_atlas_member(c.atlas_id)
      or c.connected_user_id = v_user_id
    );
end;
$$;

revoke execute on function public.get_connected_profile(uuid) from public, anon;
grant execute on function public.get_connected_profile(uuid) to authenticated;

-- Shared-trip summaries are intentionally narrow: no memories/media are exposed yet.
create or replace function public.get_shared_trips_for_connection(p_connection_id uuid)
returns table (
  trip_id uuid,
  title text,
  start_date date,
  end_date date,
  description text,
  direction text
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_connection public.atlas_connections%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_connection from public.atlas_connections where id = p_connection_id;
  if not found then raise exception 'Connection not found'; end if;
  if not (private.is_atlas_member(v_connection.atlas_id) or v_connection.connected_user_id = v_user_id) then
    raise exception 'Not permitted';
  end if;

  return query
  select t.id, t.title, t.start_date, t.end_date, t.description,
    case when private.is_atlas_member(v_connection.atlas_id) then 'shared_by_me'::text else 'shared_with_me'::text end
  from public.trip_connection_shares s
  join public.trips t on t.id = s.trip_id
  where s.connection_id = p_connection_id
  order by t.start_date desc nulls last, t.created_at desc;
end;
$$;

revoke execute on function public.get_shared_trips_for_connection(uuid) from public, anon;
grant execute on function public.get_shared_trips_for_connection(uuid) to authenticated;

-- Let a connected recipient discover all trips explicitly shared to their account.
create or replace function public.get_trips_shared_with_me()
returns table (
  connection_id uuid,
  trip_id uuid,
  title text,
  start_date date,
  end_date date,
  description text,
  shared_by_name text
)
language sql
security definer
set search_path = public
as $$
  select c.id, t.id, t.title, t.start_date, t.end_date, t.description,
         coalesce(owner.display_name, 'Family Atlas member')
  from public.trip_connection_shares s
  join public.atlas_connections c on c.id = s.connection_id
  join public.trips t on t.id = s.trip_id
  left join public.people owner on owner.id = t.owner_person_id
  where c.connected_user_id = auth.uid()
  order by t.start_date desc nulls last, t.created_at desc;
$$;

revoke execute on function public.get_trips_shared_with_me() from public, anon;
grant execute on function public.get_trips_shared_with_me() to authenticated;
