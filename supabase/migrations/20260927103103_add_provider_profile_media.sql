alter table public.marketing_provider_profiles add column if not exists profile_image_path text;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('mantiqatix-profile-media','mantiqatix-profile-media',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "mnty_profile_media_public_read" on storage.objects;
create policy "mnty_profile_media_public_read" on storage.objects for select to public using (bucket_id='mantiqatix-profile-media');

drop policy if exists "mnty_profile_media_owner_insert" on storage.objects;
create policy "mnty_profile_media_owner_insert" on storage.objects for insert to authenticated
with check (
 bucket_id='mantiqatix-profile-media'
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and name ~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/cover\.(jpg|jpeg|png|webp)$'
 and split_part(name,'/',2)=auth.uid()::text
 and exists (select 1 from public.marketing_provider_profiles p where p.id=(split_part(name,'/',4))::uuid and p.owner_user_id=auth.uid())
);

drop policy if exists "mnty_profile_media_owner_update" on storage.objects;
create policy "mnty_profile_media_owner_update" on storage.objects for update to authenticated
using (bucket_id='mantiqatix-profile-media' and split_part(name,'/',2)=auth.uid()::text and exists (select 1 from public.marketing_provider_profiles p where p.id=(split_part(name,'/',4))::uuid and p.owner_user_id=auth.uid()))
with check (bucket_id='mantiqatix-profile-media' and split_part(name,'/',2)=auth.uid()::text and exists (select 1 from public.marketing_provider_profiles p where p.id=(split_part(name,'/',4))::uuid and p.owner_user_id=auth.uid()));

drop policy if exists "mnty_profile_media_owner_delete" on storage.objects;
create policy "mnty_profile_media_owner_delete" on storage.objects for delete to authenticated
using (bucket_id='mantiqatix-profile-media' and split_part(name,'/',2)=auth.uid()::text and exists (select 1 from public.marketing_provider_profiles p where p.id=(split_part(name,'/',4))::uuid and p.owner_user_id=auth.uid()));