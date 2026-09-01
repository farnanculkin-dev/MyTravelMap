-- Family Atlas: quick places entered directly from a person's map.
-- These are deliberately independent of Trips so a traveller can record cities/places
-- without first creating a Trip or Memory. A place can later be represented in a Trip
-- without changing this lightweight map-history record.

create table public.profile_map_places (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  country_id text not null,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now(),
  constraint profile_map_places_name_not_blank check (length(trim(name)) > 0),
  unique (profile_id, country_id, name)
);

create index profile_map_places_profile_id_idx on public.profile_map_places(profile_id);
create index profile_map_places_country_id_idx on public.profile_map_places(country_id);

alter table public.profile_map_places enable row level security;

create policy "atlas members can view profile map places"
on public.profile_map_places for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = profile_map_places.profile_id
      and private.is_atlas_member(p.atlas_id)
  )
);

create policy "atlas members can manage profile map places"
on public.profile_map_places for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = profile_map_places.profile_id
      and private.is_atlas_member(p.atlas_id)
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = profile_map_places.profile_id
      and private.is_atlas_member(p.atlas_id)
  )
);

revoke all on public.profile_map_places from anon;
grant select, insert, update, delete on public.profile_map_places to authenticated;
