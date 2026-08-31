-- Family Atlas V2B-3 follow-up: harden private trip media visibility.
-- The primary Places/Memories/Photos schema is created by 20260829231500_v2b_places_memories_photos.sql.
-- This migration prevents the older broad Atlas-media read policy from bypassing private Trip visibility.

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

-- Existing profile/group media remains visible to Atlas members. Trip media is excluded
-- here and is instead governed by the trip-specific viewer policy created in the V2B-3 schema.
drop policy if exists "atlas members can view atlas media" on storage.objects;
drop policy if exists "trusted viewers can view atlas media" on storage.objects;
create policy "trusted viewers can view atlas media"
on storage.objects for select to authenticated
using (
  bucket_id = 'atlas-media'
  and (
    private.storage_trip_id(name) is null
    and private.is_atlas_member(public.storage_atlas_id(name))
  )
);
