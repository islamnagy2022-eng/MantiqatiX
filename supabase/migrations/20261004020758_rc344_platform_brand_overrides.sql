create table if not exists public.platform_brand_assets (
  asset_key text primary key,
  asset_path text not null,
  original_asset_path text not null,
  mime_type text not null default 'image/svg+xml',
  version bigint not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint platform_brand_assets_key_chk check (asset_key in ('PRIMARY_LOGO','PRIMARY_MARK'))
);
alter table public.platform_brand_assets enable row level security;

drop policy if exists "Public can view active platform brand assets" on public.platform_brand_assets;
create policy "Public can view active platform brand assets" on public.platform_brand_assets
for select to anon, authenticated using (true);

drop policy if exists "Super admins manage platform brand assets" on public.platform_brand_assets;
create policy "Super admins manage platform brand assets" on public.platform_brand_assets
for all to authenticated
using (exists (select 1 from public.user_memberships m where m.user_id=auth.uid() and m.status='ACTIVE' and upper(m.role)='SUPER_ADMIN'))
with check (exists (select 1 from public.user_memberships m where m.user_id=auth.uid() and m.status='ACTIVE' and upper(m.role)='SUPER_ADMIN'));

insert into public.platform_brand_assets(asset_key,asset_path,original_asset_path,mime_type)
values
 ('PRIMARY_LOGO','assets/mantiqatix-logo.svg','assets/mantiqatix-logo.svg','image/svg+xml'),
 ('PRIMARY_MARK','assets/mantiqatix-mark.svg','assets/mantiqatix-mark.svg','image/svg+xml')
on conflict(asset_key) do nothing;

drop policy if exists "mnty_platform_brand_insert" on storage.objects;
create policy "mnty_platform_brand_insert" on storage.objects for insert to authenticated
with check (
 bucket_id='mantiqatix-profile-media'
 and name ~ '^platform/branding/(logo|mark)-[0-9]+\\.(jpg|jpeg|png|webp|svg)$'
 and exists (select 1 from public.user_memberships m where m.user_id=auth.uid() and m.status='ACTIVE' and upper(m.role)='SUPER_ADMIN')
);

drop policy if exists "mnty_platform_brand_update" on storage.objects;
create policy "mnty_platform_brand_update" on storage.objects for update to authenticated
using (
 bucket_id='mantiqatix-profile-media'
 and name ~ '^platform/branding/(logo|mark)-[0-9]+\\.(jpg|jpeg|png|webp|svg)$'
 and exists (select 1 from public.user_memberships m where m.user_id=auth.uid() and m.status='ACTIVE' and upper(m.role)='SUPER_ADMIN')
)
with check (
 bucket_id='mantiqatix-profile-media'
 and name ~ '^platform/branding/(logo|mark)-[0-9]+\\.(jpg|jpeg|png|webp|svg)$'
 and exists (select 1 from public.user_memberships m where m.user_id=auth.uid() and m.status='ACTIVE' and upper(m.role)='SUPER_ADMIN')
);

drop policy if exists "mnty_platform_brand_delete" on storage.objects;
create policy "mnty_platform_brand_delete" on storage.objects for delete to authenticated
using (
 bucket_id='mantiqatix-profile-media'
 and name ~ '^platform/branding/(logo|mark)-[0-9]+\\.(jpg|jpeg|png|webp|svg)$'
 and exists (select 1 from public.user_memberships m where m.user_id=auth.uid() and m.status='ACTIVE' and upper(m.role)='SUPER_ADMIN')
);