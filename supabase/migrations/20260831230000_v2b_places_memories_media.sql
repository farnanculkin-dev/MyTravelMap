-- Family Atlas V2B-3: Places, memories and trip media
-- Adds lightweight memory content beneath Trips and secure trip-scoped media storage.

create table public.trip_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  category text,
  country_id text,
  notes text,
  photo_path text,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_places_name_not_blank check (length(trim(name)) > 0)
);

create index trip_places_trip_id_idx on public.trip_places(trip_id);
create index trip_places_country_id_idx on public.trip_places(country_id);

create table public.trip_memories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_id uuid references public.trip_places(id) on delete set null,
  contributor_person_id uuid references public.people(id) on delete set null,
  title text not null,
  body text,
  memory_date date,
  photo_path text,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_memories_title_not_blank check (length(trim(title)) > 0)
);

create index trip_memories_trip_id_idx on public.trip_memories(trip_id);
create index trip_memories_place_id_idx on public.trip_memories(place_id);
create index trip_memories_contributor_person_id_idx on public.trip_memories(contributor_person_id);

create trigger trip_places_set_updated_at
before update on public.trip_places
for each row execute function public.set_updated_at();

create trigger trip_memories_set_updated_at
before update on public.trip_memories
for each row execute function public.set_updated_at();

alter table public.trip_places enable row level security;
alter table public.trip_memories enable row level security;

create policy "trip viewers can view places"
on public.trip_places for select to authenticated
using (private.can_view_trip(trip_id));
create policy "trip editors can add places"
on public.trip_places for insert to authenticated
with check (private.can_edit_trip(trip_id) and created_by_user_id = (select auth.uid()));
create policy "trip editors can update places"
on public.trip_places for update to authenticated
using (private.can_edit_trip(trip_id))
with check (private.can_edit_trip(trip_id));
create policy "trip editors can delete places"
on public.trip_places for delete to authenticated
using (private.can_edit_trip(trip_id));

create policy "trip viewers can view memories"
on public.trip_memories for select to authenticated
using (private.can_view_trip(trip_id));
create policy "trip editors can add memories"
on public.trip_memories for insert to authenticated
with check (
  private.can_edit_trip(trip_id)
  and created_by_user_id = (select auth.uid())
  and (place_id is null or exists (
    select 1 from public.trip_places p where p.id = place_id and p.trip_id = trip_memories.trip_id
  ))
);
create policy "trip editors can update memories"
on public.trip_memories for update to authenticated
using (private.can_edit_trip(trip_id))
with check (
  private.can_edit_trip(trip_id)
  and (place_id is null or exists (
    select 1 from public.trip_places p where p.id = place_id and p.trip_id = trip_memories.trip_id
  ))
);
create policy "trip editors can delete memories"
on public.trip_memories for delete to authenticated
using (private.can_edit_trip(trip_id));

revoke all on public.trip_places from anon;
revoke all on public.trip_memories from anon;
grant select, insert, update, delete on public.trip_places to authenticated;
grant select, insert, update, delete on public.trip_memories to authenticated;

-- Parse the trip UUID from atlas-media paths shaped as:
-- <atlas-id>/trips/<trip-id>/<filename>
create or replace function private.storage_trip_id(object_name text)
returns uuid
language plpgsql
stable
set search_path = storage, public, private
as $$
declare
  folders text[];
begin
  folders := storage.foldername(object_name);
  if array_length(folders, 1) < 3 or folders[2] <> 'trips' then return null; end if;
  begin return folders[3]::uuid;
  exception when invalid_text_representation then return null;
  end;
end;
$$;

revoke all on function private.storage_trip_id(text) from public, anon;
grant execute on function private.storage_trip_id(text) to authenticated;

-- Tighten the broad atlas-media read rule so trip media follows the Trip visibility model.
drop policy if exists "atlas members can view atlas media" on storage.objects;
create policy "trusted viewers can view atlas media"
on storage.objects for select to authenticated
using (
  bucket_id = 'atlas-media'
  and (
    (private.storage_trip_id(name) is not null and private.can_view_trip(private.storage_trip_id(name)))
    or (private.storage_trip_id(name) is null and private.is_atlas_member(public.storage_atlas_id(name)))
  )
);

create policy "trip editors can upload trip media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'atlas-media'
  and private.storage_trip_id(name) is not null
  and private.can_edit_trip(private.storage_trip_id(name))
);

create policy "trip editors can update trip media"
on storage.objects for update to authenticated
using (
  bucket_id = 'atlas-media'
  and private.storage_trip_id(name) is not null
  and private.can_edit_trip(private.storage_trip_id(name))
)
with check (
  bucket_id = 'atlas-media'
  and private.storage_trip_id(name) is not null
  and private.can_edit_trip(private.storage_trip_id(name))
);

create policy "trip editors can delete trip media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'atlas-media'
  and private.storage_trip_id(name) is not null
  and private.can_edit_trip(private.storage_trip_id(name))
);
