drop policy if exists "mnty_profile_media_owner_insert" on storage.objects;
create policy "mnty_profile_media_owner_insert" on storage.objects for insert to authenticated
with check (
 bucket_id='mantiqatix-profile-media'
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and name ~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)\\.(jpg|jpeg|png|webp)$'
 and split_part(name,'/',2)=auth.uid()::text
 and exists (select 1 from public.marketing_provider_profiles p where p.id=(split_part(name,'/',4))::uuid and p.owner_user_id=auth.uid())
);
drop policy if exists "mnty_profile_media_owner_update" on storage.objects;
create policy "mnty_profile_media_owner_update" on storage.objects for update to authenticated
using (bucket_id='mantiqatix-profile-media' and split_part(name,'/',2)=auth.uid()::text and exists (select 1 from public.marketing_provider_profiles p where p.id=(split_part(name,'/',4))::uuid and p.owner_user_id=auth.uid()))
with check (bucket_id='mantiqatix-profile-media' and split_part(name,'/',2)=auth.uid()::text and name ~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)\\.(jpg|jpeg|png|webp)$' and exists (select 1 from public.marketing_provider_profiles p where p.id=(split_part(name,'/',4))::uuid and p.owner_user_id=auth.uid()));
drop policy if exists "mnty_profile_media_owner_delete" on storage.objects;
create policy "mnty_profile_media_owner_delete" on storage.objects for delete to authenticated
using (bucket_id='mantiqatix-profile-media' and split_part(name,'/',2)=auth.uid()::text and exists (select 1 from public.marketing_provider_profiles p where p.id=(split_part(name,'/',4))::uuid and p.owner_user_id=auth.uid()));