-- Family Atlas V2B-1: Trips core
-- Adds Atlas-scoped private trip storage while keeping participants tied to durable People.

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  created_in_atlas_id uuid not null references public.atlases(id) on delete cascade,
  owner_person_id uuid not null references public.people(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  start_date date,
  end_date date,
  description text,
  cover_photo_path text,
  visibility text not null default 'atlas' check (visibility in ('atlas','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_title_not_blank check (length(trim(title)) > 0),
  constraint trips_date_order check (end_date is null or start_date is null or end_date >= start_date)
);

create index trips_created_in_atlas_id_idx on public.trips(created_in_atlas_id);
create index trips_owner_person_id_idx on public.trips(owner_person_id);
create index trips_created_by_user_id_idx on public.trips(created_by_user_id);
create index trips_start_date_idx on public.trips(start_date desc nulls last);

create table public.trip_participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete restrict,
  participant_role text,
  created_at timestamptz not null default now(),
  unique (trip_id, person_id)
);

create index trip_participants_trip_id_idx on public.trip_participants(trip_id);
create index trip_participants_person_id_idx on public.trip_participants(person_id);

create table public.trip_countries (
  trip_id uuid not null references public.trips(id) on delete cascade,
  country_id text not null,
  primary key (trip_id, country_id),
  constraint trip_countries_country_id_not_blank check (length(trim(country_id)) > 0)
);

create index trip_countries_country_id_idx on public.trip_countries(country_id);

create trigger trips_set_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

alter table public.trips enable row level security;
alter table public.trip_participants enable row level security;
alter table public.trip_countries enable row level security;

-- Viewer helper kept in private schema so it cannot be called directly through the public API.
create or replace function private.can_view_trip(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = target_trip_id
      and (
        t.created_by_user_id = auth.uid()
        or exists (
          select 1 from public.people owner
          where owner.id = t.owner_person_id
            and owner.linked_user_id = auth.uid()
        )
        or (t.visibility = 'atlas' and private.is_atlas_member(t.created_in_atlas_id))
      )
  );
$$;

create or replace function private.can_edit_trip(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = target_trip_id
      and (
        t.created_by_user_id = auth.uid()
        or exists (
          select 1 from public.people owner
          where owner.id = t.owner_person_id
            and owner.linked_user_id = auth.uid()
        )
        or private.is_atlas_admin(t.created_in_atlas_id)
      )
  );
$$;

revoke all on function private.can_view_trip(uuid) from public, anon;
revoke all on function private.can_edit_trip(uuid) from public, anon;
grant execute on function private.can_view_trip(uuid) to authenticated;
grant execute on function private.can_edit_trip(uuid) to authenticated;

create policy "trusted viewers can view trips"
on public.trips
for select
to authenticated
using (
  created_by_user_id = (select auth.uid())
  or exists (
    select 1 from public.people owner
    where owner.id = trips.owner_person_id
      and owner.linked_user_id = (select auth.uid())
  )
  or (visibility = 'atlas' and private.is_atlas_member(created_in_atlas_id))
);

create policy "atlas people can create trips"
on public.trips
for insert
to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and private.is_atlas_member(created_in_atlas_id)
  and exists (
    select 1
    from public.profiles p
    where p.atlas_id = created_in_atlas_id
      and p.person_id = owner_person_id
      and p.linked_user_id = (select auth.uid())
  )
);

create policy "trip owners and atlas admins can update trips"
on public.trips
for update
to authenticated
using (
  created_by_user_id = (select auth.uid())
  or exists (
    select 1 from public.people owner
    where owner.id = trips.owner_person_id
      and owner.linked_user_id = (select auth.uid())
  )
  or private.is_atlas_admin(created_in_atlas_id)
)
with check (
  created_by_user_id = (select auth.uid())
  or exists (
    select 1 from public.people owner
    where owner.id = trips.owner_person_id
      and owner.linked_user_id = (select auth.uid())
  )
  or private.is_atlas_admin(created_in_atlas_id)
);

create policy "trip owners and atlas admins can delete trips"
on public.trips
for delete
to authenticated
using (
  created_by_user_id = (select auth.uid())
  or exists (
    select 1 from public.people owner
    where owner.id = trips.owner_person_id
      and owner.linked_user_id = (select auth.uid())
  )
  or private.is_atlas_admin(created_in_atlas_id)
);

create policy "trip viewers can view participants"
on public.trip_participants
for select
to authenticated
using (private.can_view_trip(trip_id));

create policy "trip editors can add participants"
on public.trip_participants
for insert
to authenticated
with check (private.can_edit_trip(trip_id));

create policy "trip editors can update participants"
on public.trip_participants
for update
to authenticated
using (private.can_edit_trip(trip_id))
with check (private.can_edit_trip(trip_id));

create policy "trip editors can remove participants"
on public.trip_participants
for delete
to authenticated
using (private.can_edit_trip(trip_id));

create policy "trip viewers can view countries"
on public.trip_countries
for select
to authenticated
using (private.can_view_trip(trip_id));

create policy "trip editors can add countries"
on public.trip_countries
for insert
to authenticated
with check (private.can_edit_trip(trip_id));

create policy "trip editors can remove countries"
on public.trip_countries
for delete
to authenticated
using (private.can_edit_trip(trip_id));

revoke all on public.trips from anon;
revoke all on public.trip_participants from anon;
revoke all on public.trip_countries from anon;
grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.trip_participants to authenticated;
grant select, insert, delete on public.trip_countries to authenticated;
