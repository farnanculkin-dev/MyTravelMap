-- Family Atlas core schema baseline.
-- Captures the pre-existing V2A database structure so future environments are reproducible.
-- Contains schema/security configuration only; Customer Zero data is intentionally not seeded here.

create extension if not exists pgcrypto;

create table if not exists public.atlases (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('family','individual')),
  name text not null,
  group_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_members (
  id uuid primary key default gen_random_uuid(),
  atlas_id uuid not null references public.atlases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','member','child')),
  created_at timestamptz not null default now(),
  unique (atlas_id,user_id)
);
create index if not exists atlas_members_atlas_id_idx on public.atlas_members(atlas_id);
create index if not exists atlas_members_user_id_idx on public.atlas_members(user_id);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  atlas_id uuid not null references public.atlases(id) on delete cascade,
  profile_key text not null,
  linked_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  photo_path text,
  map_colour text not null default 'blue',
  role text not null check (role in ('admin','member','child')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (atlas_id,profile_key)
);
create index if not exists profiles_atlas_id_idx on public.profiles(atlas_id);
create index if not exists profiles_linked_user_id_idx on public.profiles(linked_user_id);

create table if not exists public.profile_travel (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  visited_country_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;

create or replace function public.is_atlas_member(target_atlas_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.atlas_members am where am.atlas_id=target_atlas_id and am.user_id=auth.uid());
$$;
create or replace function public.is_atlas_admin(target_atlas_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.atlas_members am where am.atlas_id=target_atlas_id and am.user_id=auth.uid() and am.role='admin');
$$;

create or replace function public.create_atlas_with_admin_profile(p_atlas_name text,p_atlas_type text,p_profile_key text,p_profile_name text,p_map_colour text default 'blue')
returns table(atlas_id uuid,profile_id uuid) language plpgsql security definer set search_path=public,auth as $$
declare v_user_id uuid:=auth.uid(); v_atlas_id uuid; v_profile_id uuid;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if trim(p_atlas_name)='' then raise exception 'Atlas name is required'; end if;
 if p_atlas_type not in ('family','individual') then raise exception 'Atlas type must be family or individual'; end if;
 if trim(p_profile_key)='' then raise exception 'Profile key is required'; end if;
 if trim(p_profile_name)='' then raise exception 'Profile name is required'; end if;
 insert into public.atlases(type,name) values(p_atlas_type,trim(p_atlas_name)) returning id into v_atlas_id;
 insert into public.atlas_members(atlas_id,user_id,role) values(v_atlas_id,v_user_id,'admin');
 insert into public.profiles(atlas_id,profile_key,linked_user_id,name,map_colour,role) values(v_atlas_id,lower(trim(p_profile_key)),v_user_id,trim(p_profile_name),p_map_colour,'admin') returning id into v_profile_id;
 insert into public.profile_travel(profile_id,visited_country_ids) values(v_profile_id,'{}');
 return query select v_atlas_id,v_profile_id;
end; $$;

create or replace function public.storage_atlas_id(object_name text) returns uuid language plpgsql stable as $$
declare first_folder text;
begin
 first_folder:=(storage.foldername(object_name))[1]; if first_folder is null then return null; end if;
 begin return first_folder::uuid; exception when invalid_text_representation then return null; end;
end; $$;

drop trigger if exists atlases_set_updated_at on public.atlases;
create trigger atlases_set_updated_at before update on public.atlases for each row execute function public.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists profile_travel_set_updated_at on public.profile_travel;
create trigger profile_travel_set_updated_at before update on public.profile_travel for each row execute function public.set_updated_at();

alter table public.atlases enable row level security;
alter table public.atlas_members enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_travel enable row level security;

drop policy if exists "atlas members can view atlas" on public.atlases;
create policy "atlas members can view atlas" on public.atlases for select to authenticated using(public.is_atlas_member(id));
drop policy if exists "atlas admins can update atlas" on public.atlases;
create policy "atlas admins can update atlas" on public.atlases for update to authenticated using(public.is_atlas_admin(id)) with check(public.is_atlas_admin(id));

drop policy if exists "members can view atlas membership" on public.atlas_members;
create policy "members can view atlas membership" on public.atlas_members for select to authenticated using(public.is_atlas_member(atlas_id));
drop policy if exists "admins can manage atlas membership" on public.atlas_members;
create policy "admins can manage atlas membership" on public.atlas_members for all to authenticated using(public.is_atlas_admin(atlas_id)) with check(public.is_atlas_admin(atlas_id));

drop policy if exists "atlas members can view profiles" on public.profiles;
create policy "atlas members can view profiles" on public.profiles for select to authenticated using(public.is_atlas_member(atlas_id));
drop policy if exists "linked users can update own profile" on public.profiles;
create policy "linked users can update own profile" on public.profiles for update to authenticated using(linked_user_id=auth.uid() and public.is_atlas_member(atlas_id)) with check(linked_user_id=auth.uid() and public.is_atlas_member(atlas_id));
drop policy if exists "atlas admins can manage profiles" on public.profiles;
create policy "atlas admins can manage profiles" on public.profiles for all to authenticated using(public.is_atlas_admin(atlas_id)) with check(public.is_atlas_admin(atlas_id));

drop policy if exists "atlas members can view travel" on public.profile_travel;
create policy "atlas members can view travel" on public.profile_travel for select to authenticated using(exists(select 1 from public.profiles p where p.id=profile_travel.profile_id and public.is_atlas_member(p.atlas_id)));
drop policy if exists "linked users can update own travel" on public.profile_travel;
create policy "linked users can update own travel" on public.profile_travel for update to authenticated using(exists(select 1 from public.profiles p where p.id=profile_travel.profile_id and p.linked_user_id=auth.uid() and public.is_atlas_member(p.atlas_id))) with check(exists(select 1 from public.profiles p where p.id=profile_travel.profile_id and p.linked_user_id=auth.uid() and public.is_atlas_member(p.atlas_id)));
drop policy if exists "atlas admins can manage travel" on public.profile_travel;
create policy "atlas admins can manage travel" on public.profile_travel for all to authenticated using(exists(select 1 from public.profiles p where p.id=profile_travel.profile_id and public.is_atlas_admin(p.atlas_id))) with check(exists(select 1 from public.profiles p where p.id=profile_travel.profile_id and public.is_atlas_admin(p.atlas_id)));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('atlas-media','atlas-media',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "atlas members can view atlas media" on storage.objects;
create policy "atlas members can view atlas media" on storage.objects for select to authenticated using(bucket_id='atlas-media' and public.is_atlas_member(public.storage_atlas_id(name)));
drop policy if exists "atlas members can upload permitted atlas media" on storage.objects;
create policy "atlas members can upload permitted atlas media" on storage.objects for insert to authenticated with check(bucket_id='atlas-media' and (public.is_atlas_admin(public.storage_atlas_id(name)) or exists(select 1 from public.profiles p where p.atlas_id=public.storage_atlas_id(name) and p.linked_user_id=auth.uid() and (storage.foldername(name))[2]='profiles' and (storage.foldername(name))[3]=p.id::text)));
drop policy if exists "atlas members can update permitted atlas media" on storage.objects;
create policy "atlas members can update permitted atlas media" on storage.objects for update to authenticated using(bucket_id='atlas-media' and (public.is_atlas_admin(public.storage_atlas_id(name)) or exists(select 1 from public.profiles p where p.atlas_id=public.storage_atlas_id(name) and p.linked_user_id=auth.uid() and (storage.foldername(name))[2]='profiles' and (storage.foldername(name))[3]=p.id::text))) with check(bucket_id='atlas-media' and (public.is_atlas_admin(public.storage_atlas_id(name)) or exists(select 1 from public.profiles p where p.atlas_id=public.storage_atlas_id(name) and p.linked_user_id=auth.uid() and (storage.foldername(name))[2]='profiles' and (storage.foldername(name))[3]=p.id::text)));
drop policy if exists "atlas members can delete permitted atlas media" on storage.objects;
create policy "atlas members can delete permitted atlas media" on storage.objects for delete to authenticated using(bucket_id='atlas-media' and (public.is_atlas_admin(public.storage_atlas_id(name)) or exists(select 1 from public.profiles p where p.atlas_id=public.storage_atlas_id(name) and p.linked_user_id=auth.uid() and (storage.foldername(name))[2]='profiles' and (storage.foldername(name))[3]=p.id::text)));
