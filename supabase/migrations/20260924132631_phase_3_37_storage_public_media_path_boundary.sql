
create policy "mnt_public_media_path_boundary"
on storage.objects
as restrictive
for all
to public
using (
  bucket_id = 'mantiqatix-media'
  and (
    name like 'users/%'
    or name like 'businesses/%'
  )
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
)
with check (
  bucket_id = 'mantiqatix-media'
  and (
    name like 'users/%'
    or name like 'businesses/%'
  )
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

create policy "mnt_public_media_anon_read_boundary"
on storage.objects
as restrictive
for select
to anon
using (
  bucket_id = 'mantiqatix-media'
  and (
    name like 'users/%'
    or name like 'businesses/%'
  )
);
