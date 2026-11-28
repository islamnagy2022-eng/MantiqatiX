-- Verify that an uploaded image receives a full five-day grace period
-- starting when it becomes unreferenced, and that any live reference resets it.
begin;

drop table if exists public.mnty_catalog_media_retention_test_refs;
create table public.mnty_catalog_media_retention_test_refs (
  id integer generated always as identity primary key,
  content text
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'mantiqatix-profile-media',
  'mantiqatix-profile-media',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Push existing objects behind the single fixture so the bounded round-robin scan
-- selects this synthetic path first, even when the captured checkpoint has many files.
insert into public.mnty_catalog_media_retention_state(object_path,unreferenced_since,last_scanned_at)
select o.name,null,now() + interval '10 years'
from storage.objects o
where o.bucket_id='mantiqatix-profile-media'
  and o.name ~ '^businesses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/owner-uploads/(activity|cover|product|service)/[A-Za-z0-9._-]+$'
on conflict (object_path) do update
set last_scanned_at=excluded.last_scanned_at;

insert into storage.objects(id,bucket_id,name,metadata)
values (
  '80000000-0000-4000-8000-000000000001',
  'mantiqatix-profile-media',
  'businesses/80000000-0000-4000-8000-000000000002/owner-uploads/product/retention-window-fixture.jpg',
  '{"mimetype":"image/jpeg","size":10}'::jsonb
)
on conflict (id) do nothing;

do $test$
declare
  v_path text := 'businesses/80000000-0000-4000-8000-000000000002/owner-uploads/product/retention-window-fixture.jpg';
  v_since timestamptz;
  v_candidates integer;
begin
  -- First scan sees a fresh, unreferenced upload. It must start the clock,
  -- not delete it immediately because its upload itself is old or new.
  select count(*) into v_candidates
  from public.mnty_list_expired_catalog_media(100)
  where object_path = v_path;
  if v_candidates <> 0 then
    raise exception 'MEDIA_RETENTION_DELETED_BEFORE_FIVE_UNUSED_DAYS';
  end if;

  select unreferenced_since into v_since
  from public.mnty_catalog_media_retention_state
  where object_path = v_path;
  if v_since is null or v_since < now() - interval '2 minutes' then
    raise exception 'MEDIA_RETENTION_UNUSED_CLOCK_NOT_STARTED:%',v_since;
  end if;
  if public.mnty_catalog_media_object_is_referenced(v_path) then
    raise exception 'MEDIA_RETENTION_STATE_ROW_MISTAKEN_FOR_LIVE_REFERENCE';
  end if;

  -- Simulate an image that has been unused long enough to qualify, but is now
  -- attached to live site content. The next scan must reset its unused clock.
  update public.mnty_catalog_media_retention_state
  set unreferenced_since=now() - interval '5 days' - interval '1 minute'
  where object_path=v_path;

  insert into public.mnty_catalog_media_retention_test_refs(content) values (v_path);
  if not public.mnty_catalog_media_object_is_referenced(v_path) then
    raise exception 'MEDIA_RETENTION_LIVE_CONTENT_REFERENCE_NOT_DETECTED';
  end if;

  select count(*) into v_candidates
  from public.mnty_list_expired_catalog_media(100)
  where object_path=v_path;
  if v_candidates <> 0 then
    raise exception 'MEDIA_RETENTION_DELETED_A_LIVE_REFERENCED_IMAGE';
  end if;

  select unreferenced_since into v_since
  from public.mnty_catalog_media_retention_state
  where object_path=v_path;
  if v_since is not null then
    raise exception 'MEDIA_RETENTION_LIVE_REFERENCE_DID_NOT_RESET_CLOCK:%',v_since;
  end if;

  -- Once the live reference disappears, the unused period starts over.
  delete from public.mnty_catalog_media_retention_test_refs where content=v_path;
  if public.mnty_catalog_media_object_is_referenced(v_path) then
    raise exception 'MEDIA_RETENTION_REFERENCE_NOT_CLEARED_AFTER_CONTENT_REMOVAL';
  end if;

  select count(*) into v_candidates
  from public.mnty_list_expired_catalog_media(100)
  where object_path=v_path;
  if v_candidates <> 0 then
    raise exception 'MEDIA_RETENTION_DID_NOT_START_NEW_UNUSED_PERIOD';
  end if;

  select unreferenced_since into v_since
  from public.mnty_catalog_media_retention_state
  where object_path=v_path;
  if v_since is null or v_since < now() - interval '2 minutes' then
    raise exception 'MEDIA_RETENTION_CLOCK_NOT_RESTARTED:%',v_since;
  end if;

  -- After five full days with no references, the path becomes deletable.
  update public.mnty_catalog_media_retention_state
  set unreferenced_since=now() - interval '5 days' - interval '1 minute'
  where object_path=v_path;

  select count(*) into v_candidates
  from public.mnty_list_expired_catalog_media(100)
  where object_path=v_path;
  if v_candidates <> 1 then
    raise exception 'MEDIA_RETENTION_DID_NOT_RELEASE_IMAGE_AFTER_FIVE_UNUSED_DAYS:%',v_candidates;
  end if;

  perform public.mnty_clear_catalog_media_retention_state(array[v_path]);
  if exists (
    select 1 from public.mnty_catalog_media_retention_state where object_path=v_path
  ) then
    raise exception 'MEDIA_RETENTION_STATE_NOT_CLEARED';
  end if;

  raise notice 'CATALOG_MEDIA_CONTINUOUS_FIVE_DAY_RETENTION=PASS';
end;
$test$;

rollback;
