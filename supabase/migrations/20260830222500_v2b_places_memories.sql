-- Family Atlas V2B-3: Places and Memories
-- Adds lightweight trip storytelling entities. Media paths are optional and stored in the existing private atlas-media bucket.

create table public.trip_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  category text,
  country_id text,
  note text,
  photo_path text,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_places_name_not_blank check (length(trim(name)) > 0)
);

create index trip_places_trip_id_idx on public.trip_places(trip_id);

create table public.trip_memories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_id uuid references public.trip_places(id) on delete set null,
  contributor_person_id uuid references public.people(id) on delete set null,
  title text,
  body text not null,
  memory_date date,
  photo_path text,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_memories_body_not_blank check (length(trim(body)) > 0)
);

create index trip_memories_trip_id_idx on public.trip_memories(trip_id);
create index trip_memories_place_id_idx on public.trip_memories(place_id);
create index trip_memories_contributor_person_id_idx on public.trip_memories(contributor_person_id);

create trigger trip_places_set_updated_at before update on public.trip_places for each row execute function public.set_updated_at();
create trigger trip_memories_set_updated_at before update on public.trip_memories for each row execute function public.set_updated_at();

alter table public.trip_places enable row level security;
alter table public.trip_memories enable row level security;

create policy "trip viewers can view places" on public.trip_places for select to authenticated using (private.can_view_trip(trip_id));
create policy "trip editors can add places" on public.trip_places for insert to authenticated with check (private.can_edit_trip(trip_id) and created_by_user_id = (select auth.uid()));
create policy "trip editors can update places" on public.trip_places for update to authenticated using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));
create policy "trip editors can delete places" on public.trip_places for delete to authenticated using (private.can_edit_trip(trip_id));

create policy "trip viewers can view memories" on public.trip_memories for select to authenticated using (private.can_view_trip(trip_id));
create policy "trip editors can add memories" on public.trip_memories for insert to authenticated with check (private.can_edit_trip(trip_id) and created_by_user_id = (select auth.uid()));
create policy "trip editors can update memories" on public.trip_memories for update to authenticated using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id));
create policy "trip editors can delete memories" on public.trip_memories for delete to authenticated using (private.can_edit_trip(trip_id));

revoke all on public.trip_places from anon;
revoke all on public.trip_memories from anon;
grant select, insert, update, delete on public.trip_places to authenticated;
grant select, insert, update, delete on public.trip_memories to authenticated;