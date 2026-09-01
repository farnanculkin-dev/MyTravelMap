-- Family Atlas V2B: geographic coordinates for trip places
alter table public.trip_places
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.trip_places
  drop constraint if exists trip_places_latitude_range,
  add constraint trip_places_latitude_range check (latitude is null or latitude between -90 and 90),
  drop constraint if exists trip_places_longitude_range,
  add constraint trip_places_longitude_range check (longitude is null or longitude between -180 and 180);

create index if not exists trip_places_coordinates_idx
  on public.trip_places(latitude, longitude)
  where latitude is not null and longitude is not null;
