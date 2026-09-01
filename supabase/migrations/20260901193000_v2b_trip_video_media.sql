-- Family Atlas V2B UX completion: distinguish photo and video trip media.
alter table public.trip_media
  add column if not exists media_kind text not null default 'photo';

alter table public.trip_media
  drop constraint if exists trip_media_kind_check;

alter table public.trip_media
  add constraint trip_media_kind_check check (media_kind in ('photo', 'video'));

create index if not exists trip_media_kind_idx on public.trip_media(trip_id, media_kind);
