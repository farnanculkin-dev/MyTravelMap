-- Family Atlas V2B-3: Places, memories and trip photos
create table public.trip_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  category text,
  country_id text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_places_name_not_blank check (length(trim(name)) > 0)
);
create index trip_places_trip_id_idx on public.trip_places(trip_id);

create table public.trip_memories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_id uuid references public.trip_places(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  title text not null,
  body text,
  memory_date date,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_memories_title_not_blank check (length(trim(title)) > 0)
);
create index trip_memories_trip_id_idx on public.trip_memories(trip_id);
create index trip_memories_place_id_idx on public.trip_memories(place_id);

create table public.trip_media (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now(),
  unique(trip_id, storage_path)
);
create index trip_media_trip_id_idx on public.trip_media(trip_id);

create trigger trip_places_set_updated_at before update on public.trip_places for each row execute function public.set_updated_at();
create trigger trip_memories_set_updated_at before update on public.trip_memories for each row execute function public.set_updated_at();

alter table public.trip_places enable row level security;
alter table public.trip_memories enable row level security;
alter table public.trip_media enable row level security;

create policy "trip viewers can view places" on public.trip_places for select to authenticated using (private.can_view_trip(trip_id));
create policy "trip editors can manage places" on public.trip_places for all to authenticated using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));
create policy "trip viewers can view memories" on public.trip_memories for select to authenticated using (private.can_view_trip(trip_id));
create policy "trip editors can manage memories" on public.trip_memories for all to authenticated using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));
create policy "trip viewers can view media" on public.trip_media for select to authenticated using (private.can_view_trip(trip_id));
create policy "trip editors can manage media" on public.trip_media for all to authenticated using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));

grant select,insert,update,delete on public.trip_places to authenticated;
grant select,insert,update,delete on public.trip_memories to authenticated;
grant select,insert,update,delete on public.trip_media to authenticated;

-- Allow trip editors to use private storage beneath {atlasId}/trips/{tripId}/...
create policy "trip viewers can view trip media objects" on storage.objects for select to authenticated using (
  bucket_id='atlas-media' and (storage.foldername(name))[2]='trips' and private.can_view_trip(((storage.foldername(name))[3])::uuid)
);
create policy "trip editors can upload trip media objects" on storage.objects for insert to authenticated with check (
  bucket_id='atlas-media' and (storage.foldername(name))[2]='trips' and private.can_edit_trip(((storage.foldername(name))[3])::uuid)
);
create policy "trip editors can update trip media objects" on storage.objects for update to authenticated using (
  bucket_id='atlas-media' and (storage.foldername(name))[2]='trips' and private.can_edit_trip(((storage.foldername(name))[3])::uuid)
) with check (
  bucket_id='atlas-media' and (storage.foldername(name))[2]='trips' and private.can_edit_trip(((storage.foldername(name))[3])::uuid)
);
create policy "trip editors can delete trip media objects" on storage.objects for delete to authenticated using (
  bucket_id='atlas-media' and (storage.foldername(name))[2]='trips' and private.can_edit_trip(((storage.foldername(name))[3])::uuid)
);