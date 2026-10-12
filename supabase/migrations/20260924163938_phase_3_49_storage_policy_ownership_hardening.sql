
begin;

drop policy if exists mantiqatix_media_authenticated_read on storage.objects;
create policy mantiqatix_media_authenticated_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'mantiqatix-media'
  and coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and (
    owner_id = auth.uid()::text
    or name like ('users/' || auth.uid()::text || '/%')
    or exists (
      select 1
      from public.user_memberships m
      where m.user_id = auth.uid()
        and m.business_id is not null
        and m.status::text = 'ACTIVE'
        and m.role::text = any (array['BUSINESS_OWNER','MANAGER','SUPER_ADMIN'])
        and name like ('businesses/' || m.business_id::text || '/%')
    )
  )
);

drop policy if exists mantiqatix_media_user_update on storage.objects;
create policy mantiqatix_media_user_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'mantiqatix-media'
  and coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and (
    owner_id = auth.uid()::text
    or exists (
      select 1
      from public.user_memberships m
      where m.user_id = auth.uid()
        and m.business_id is not null
        and m.status::text = 'ACTIVE'
        and m.role::text = any (array['BUSINESS_OWNER','MANAGER','SUPER_ADMIN'])
        and name like ('businesses/' || m.business_id::text || '/%')
    )
  )
)
with check (
  bucket_id = 'mantiqatix-media'
  and coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and (
    owner_id = auth.uid()::text
    or name like ('users/' || auth.uid()::text || '/%')
    or exists (
      select 1
      from public.user_memberships m
      where m.user_id = auth.uid()
        and m.business_id is not null
        and m.status::text = 'ACTIVE'
        and m.role::text = any (array['BUSINESS_OWNER','MANAGER','SUPER_ADMIN'])
        and name like ('businesses/' || m.business_id::text || '/%')
    )
  )
);

commit;
