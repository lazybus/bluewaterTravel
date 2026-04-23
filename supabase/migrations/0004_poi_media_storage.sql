alter table public.poi_media
add column if not exists storage_path text;

create unique index if not exists idx_poi_media_thumbnail
on public.poi_media (poi_id)
where is_thumbnail;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'poi-media',
  'poi-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "poi_media_objects_read_all" on storage.objects;
create policy "poi_media_objects_read_all"
on storage.objects
for select
using (bucket_id = 'poi-media');

drop policy if exists "poi_media_objects_insert_curator" on storage.objects;
create policy "poi_media_objects_insert_curator"
on storage.objects
for insert
with check (
  bucket_id = 'poi-media'
  and public.current_user_role() in ('curator', 'admin')
);

drop policy if exists "poi_media_objects_update_curator" on storage.objects;
create policy "poi_media_objects_update_curator"
on storage.objects
for update
using (
  bucket_id = 'poi-media'
  and public.current_user_role() in ('curator', 'admin')
)
with check (
  bucket_id = 'poi-media'
  and public.current_user_role() in ('curator', 'admin')
);

drop policy if exists "poi_media_objects_delete_curator" on storage.objects;
create policy "poi_media_objects_delete_curator"
on storage.objects
for delete
using (
  bucket_id = 'poi-media'
  and public.current_user_role() in ('curator', 'admin')
);