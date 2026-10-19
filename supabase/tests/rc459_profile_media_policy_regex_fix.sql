-- RC459 storage-policy regression; run only against a disposable PostgreSQL database.
begin;

create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

create table public.marketing_provider_profiles (
  id uuid primary key,
  owner_user_id uuid not null
);
insert into public.marketing_provider_profiles(id, owner_user_id) values
  ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000099','30000000-0000-4000-8000-000000000099');

create table storage.objects (
  id uuid primary key,
  bucket_id text not null,
  name text not null
);
alter table storage.objects enable row level security;
grant usage on schema auth, storage to anon, authenticated;
grant select on public.marketing_provider_profiles to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.objects to anon;

\i supabase/migrations/20261019110000_rc459_profile_media_policy_regex_fix.sql

-- Keep one seeded public presentation object and another owner's object.
insert into storage.objects(id,bucket_id,name) values
  ('50000000-0000-4000-8000-000000000010','mantiqatix-profile-media','platform/branding/logo-1.svg'),
  ('50000000-0000-4000-8000-000000000011','mantiqatix-profile-media',
   'users/30000000-0000-4000-8000-000000000099/providers/40000000-0000-4000-8000-000000000099/cover.jpg');

set role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","is_anonymous":false}',true);

-- Correct owner + provider + supported extension must work.
insert into storage.objects(id,bucket_id,name) values
  ('50000000-0000-4000-8000-000000000001','mantiqatix-profile-media',
   'users/30000000-0000-4000-8000-000000000001/providers/40000000-0000-4000-8000-000000000001/cover.jpg');

-- Owner may replace their supported image with another supported image name.
update storage.objects
set name='users/30000000-0000-4000-8000-000000000001/providers/40000000-0000-4000-8000-000000000001/logo.webp'
where id='50000000-0000-4000-8000-000000000001';

do $assert$
begin
  if not exists (
    select 1 from storage.objects
    where id='50000000-0000-4000-8000-000000000001'
      and name='users/30000000-0000-4000-8000-000000000001/providers/40000000-0000-4000-8000-000000000001/logo.webp'
  ) then
    raise exception 'RC459 valid owner media path did not survive insert/update';
  end if;
  begin
    insert into storage.objects(id,bucket_id,name) values
      ('50000000-0000-4000-8000-000000000002','mantiqatix-profile-media',
       'users/30000000-0000-4000-8000-000000000001/providers/40000000-0000-4000-8000-000000000001/cover.svg');
    raise exception 'RC459 accepted an unsupported SVG owner upload';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects(id,bucket_id,name) values
      ('50000000-0000-4000-8000-000000000003','mantiqatix-profile-media',
       'users/30000000-0000-4000-8000-000000000099/providers/40000000-0000-4000-8000-000000000001/cover.jpg');
    raise exception 'RC459 accepted an upload under a different user path';
  exception when insufficient_privilege then null;
  end;
  begin
    update storage.objects
    set name='users/30000000-0000-4000-8000-000000000001/providers/40000000-0000-4000-8000-000000000001/cover.svg'
    where id='50000000-0000-4000-8000-000000000001';
    raise exception 'RC459 accepted changing an owned object to an unsupported extension';
  exception when insufficient_privilege then null;
  end;

  -- RLS may silently filter another owner's row from UPDATE/DELETE; verify it survives.
  delete from storage.objects where id='50000000-0000-4000-8000-000000000011';
  if not exists (select 1 from storage.objects where id='50000000-0000-4000-8000-000000000011') then
    raise exception 'RC459 allowed deletion of another user media object';
  end if;

  -- Anonymous Auth users still have the authenticated SQL role. They must not mutate
  -- media even if a matching owner/profile row exists for their UID.
  perform set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","is_anonymous":true}',true);
  update storage.objects
    set name='users/30000000-0000-4000-8000-000000000001/providers/40000000-0000-4000-8000-000000000001/cover.png'
    where id='50000000-0000-4000-8000-000000000001';
  if not exists (
    select 1 from storage.objects
    where id='50000000-0000-4000-8000-000000000001'
      and name='users/30000000-0000-4000-8000-000000000001/providers/40000000-0000-4000-8000-000000000001/logo.webp'
  ) then
    raise exception 'RC459 allowed an anonymous Auth user to update profile media';
  end if;
  delete from storage.objects where id='50000000-0000-4000-8000-000000000001';
  if not exists (
    select 1 from storage.objects
    where id='50000000-0000-4000-8000-000000000001'
      and name='users/30000000-0000-4000-8000-000000000001/providers/40000000-0000-4000-8000-000000000001/logo.webp'
  ) then
    raise exception 'RC459 allowed an anonymous Auth user to delete profile media';
  end if;
  perform set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","is_anonymous":false}',true);
end;
$assert$;

delete from storage.objects where id='50000000-0000-4000-8000-000000000001';
reset role;

-- Anonymous clients must not be able to upload into the owner-managed bucket.
set role anon;
do $assert$
begin
  begin
    insert into storage.objects(id,bucket_id,name) values
      ('50000000-0000-4000-8000-000000000020','mantiqatix-profile-media',
       'users/30000000-0000-4000-8000-000000000001/providers/40000000-0000-4000-8000-000000000001/cover.jpg');
    raise exception 'RC459 allowed anonymous upload to profile media';
  exception when insufficient_privilege then null;
  end;
end;
$assert$;

-- The bucket remains intentionally public-read for presentation media.
do $assert$
declare visible_count integer;
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='mnty_profile_media_public_read'
      and 'public' = any(roles::text[])
  ) then
    raise exception 'RC459 removed the public-read policy required for presentation media';
  end if;
  select count(*) into visible_count from storage.objects
  where bucket_id='mantiqatix-profile-media';
  if visible_count <> 2 then
    raise exception 'RC459 anonymous presentation-media read expected two public objects, got %', visible_count;
  end if;
end;
$assert$;
reset role;

rollback;
