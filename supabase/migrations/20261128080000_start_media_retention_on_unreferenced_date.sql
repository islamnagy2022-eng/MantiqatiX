-- Measure the five-day retention window from the first scan that finds an image
-- unreferenced, rather than from upload time. A reference clears the timer.
create table if not exists public.mnty_catalog_media_retention_state (
  object_path text primary key,
  unreferenced_since timestamptz,
  last_scanned_at timestamptz not null default now(),
  constraint mnty_catalog_media_retention_state_owner_path_check
    check (object_path ~ '^businesses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/owner-uploads/(activity|cover|product|service)/[A-Za-z0-9._-]+$')
);

alter table public.mnty_catalog_media_retention_state enable row level security;
revoke all on table public.mnty_catalog_media_retention_state from public, anon, authenticated;
grant select, insert, update, delete on table public.mnty_catalog_media_retention_state to service_role;

create or replace function public.mnty_clear_catalog_media_retention_state(p_object_paths text[])
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.mnty_catalog_media_retention_state
  where object_path = any(coalesce(p_object_paths, array[]::text[]));
end;
$function$;

revoke all on function public.mnty_clear_catalog_media_retention_state(text[]) from public, anon, authenticated;
grant execute on function public.mnty_clear_catalog_media_retention_state(text[]) to service_role;

create or replace function public.mnty_catalog_media_object_is_referenced(p_object_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_column record;
  v_found boolean;
begin
  if p_object_path is null
     or p_object_path !~ '^businesses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/owner-uploads/(activity|cover|product|service)/[A-Za-z0-9._-]+
returns table(object_path text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 100));
  v_candidate_paths text[];
  v_referenced_paths text[] := array[]::text[];
  v_table record;
  v_hits text[];
  v_candidate record;
  v_now timestamptz := now();
  v_unreferenced_since timestamptz;
begin
  -- Forget state for Storage objects that no longer exist.
  delete from public.mnty_catalog_media_retention_state s
  where not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'mantiqatix-profile-media'
      and o.name = s.object_path
  );

  -- Rotate through the complete owner-upload namespace. The oldest last-scanned
  -- items come first, so a busy business cannot starve newer uploads indefinitely.
  select array_agg(page.name)
  into v_candidate_paths
  from (
    select o.name
    from storage.objects o
    left join public.mnty_catalog_media_retention_state state
      on state.object_path = o.name
    where o.bucket_id = 'mantiqatix-profile-media'
      and o.name like 'businesses/%/owner-uploads/%'
      and o.name ~ '^businesses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/owner-uploads/(activity|cover|product|service)/[A-Za-z0-9._-]+$'
    order by state.last_scanned_at asc nulls first, o.created_at asc
    limit v_limit
  ) page;

  if coalesce(array_length(v_candidate_paths, 1), 0) = 0 then
    return;
  end if;

  -- Check every persisted text/JSON field, including generic page/rich-text fields.
  -- Audit history is excluded because an upload event is not a live media reference.
  for v_table in
    select
      n.nspname as table_schema,
      c.relname as table_name,
      string_agg(
        format('strpos(coalesce(content.%I::text, %L), ref.object_path) > 0', a.attname, ''),
        ' OR ' order by a.attnum
      ) as reference_predicate
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'm')
      and c.relname not in ('audit_logs', 'mnty_catalog_media_retention_state')
      and a.attnum > 0
      and not a.attisdropped
      and a.atttypid in (
        'pg_catalog.text'::regtype,
        'pg_catalog.varchar'::regtype,
        'pg_catalog.bpchar'::regtype,
        'pg_catalog.json'::regtype,
        'pg_catalog.jsonb'::regtype
      )
    group by n.nspname, c.relname
  loop
    execute format(
      'select array_agg(distinct ref.object_path)
       from %I.%I as content
       cross join lateral unnest($1::text[]) as ref(object_path)
       where (%s)',
      v_table.table_schema,
      v_table.table_name,
      v_table.reference_predicate
    )
    into v_hits
    using v_candidate_paths;

    if v_hits is not null then
      v_referenced_paths := v_referenced_paths || v_hits;
    end if;
  end loop;

  for v_candidate in
    select o.name, o.created_at
    from storage.objects o
    where o.bucket_id = 'mantiqatix-profile-media'
      and o.name = any(v_candidate_paths)
    order by o.created_at asc
  loop
    if v_candidate.name = any(v_referenced_paths) then
      -- A live reference resets the unused window. If it becomes unused later,
      -- its five-day timer starts at the next successful scan.
      insert into public.mnty_catalog_media_retention_state (
        object_path, unreferenced_since, last_scanned_at
      ) values (
        v_candidate.name, null, v_now
      )
      on conflict (object_path) do update
      set unreferenced_since = null,
          last_scanned_at = excluded.last_scanned_at;
    else
      -- First observed unused scan starts the five-day grace period.
      insert into public.mnty_catalog_media_retention_state as state (
        object_path, unreferenced_since, last_scanned_at
      ) values (
        v_candidate.name, v_now, v_now
      )
      on conflict (object_path) do update
      set unreferenced_since = coalesce(state.unreferenced_since, excluded.unreferenced_since),
          last_scanned_at = excluded.last_scanned_at
      returning unreferenced_since into v_unreferenced_since;

      if v_unreferenced_since <= v_now - interval '5 days' then
        object_path := v_candidate.name;
        created_at := v_candidate.created_at;
        return next;
      end if;
    end if;
  end loop;
end;
$function$;

revoke all on function public.mnty_list_expired_catalog_media(integer) from public, anon, authenticated;
grant execute on function public.mnty_list_expired_catalog_media(integer) to service_role;

comment on table public.mnty_catalog_media_retention_state is
  'Service-role-only state for continuous five-day unused media retention; a live reference resets unreferenced_since.';
 then
    return true;
  end if;

  -- Retention state stores the object path to track its unused window; it is
  -- not a live use. Exclude both state and upload audit history from references.
  for v_column in
    select n.nspname as table_schema, c.relname as table_name, a.attname as column_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'm')
      and c.relname not in ('audit_logs', 'mnty_catalog_media_retention_state')
      and a.attnum > 0
      and not a.attisdropped
      and a.atttypid in (
        'pg_catalog.text'::regtype,
        'pg_catalog.varchar'::regtype,
        'pg_catalog.bpchar'::regtype,
        'pg_catalog.json'::regtype,
        'pg_catalog.jsonb'::regtype
      )
  loop
    execute format(
      'select exists (select 1 from %I.%I where strpos(coalesce(%I::text, %L), $1) > 0)',
      v_column.table_schema,
      v_column.table_name,
      v_column.column_name,
      ''
    )
    into v_found
    using p_object_path;

    if coalesce(v_found, false) then
      return true;
    end if;
  end loop;

  return false;
end;
$function$;

revoke all on function public.mnty_catalog_media_object_is_referenced(text) from public, anon, authenticated;
grant execute on function public.mnty_catalog_media_object_is_referenced(text) to service_role;

create or replace function public.mnty_list_expired_catalog_media(p_limit integer default 100)
returns table(object_path text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 100));
  v_candidate_paths text[];
  v_referenced_paths text[] := array[]::text[];
  v_table record;
  v_hits text[];
  v_candidate record;
  v_now timestamptz := now();
  v_unreferenced_since timestamptz;
begin
  -- Forget state for Storage objects that no longer exist.
  delete from public.mnty_catalog_media_retention_state s
  where not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'mantiqatix-profile-media'
      and o.name = s.object_path
  );

  -- Rotate through the complete owner-upload namespace. The oldest last-scanned
  -- items come first, so a busy business cannot starve newer uploads indefinitely.
  select array_agg(page.name)
  into v_candidate_paths
  from (
    select o.name
    from storage.objects o
    left join public.mnty_catalog_media_retention_state state
      on state.object_path = o.name
    where o.bucket_id = 'mantiqatix-profile-media'
      and o.name like 'businesses/%/owner-uploads/%'
      and o.name ~ '^businesses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/owner-uploads/(activity|cover|product|service)/[A-Za-z0-9._-]+$'
    order by state.last_scanned_at asc nulls first, o.created_at asc
    limit v_limit
  ) page;

  if coalesce(array_length(v_candidate_paths, 1), 0) = 0 then
    return;
  end if;

  -- Check every persisted text/JSON field, including generic page/rich-text fields.
  -- Audit history is excluded because an upload event is not a live media reference.
  for v_table in
    select
      n.nspname as table_schema,
      c.relname as table_name,
      string_agg(
        format('strpos(coalesce(content.%I::text, %L), ref.object_path) > 0', a.attname, ''),
        ' OR ' order by a.attnum
      ) as reference_predicate
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'm')
      and c.relname not in ('audit_logs', 'mnty_catalog_media_retention_state')
      and a.attnum > 0
      and not a.attisdropped
      and a.atttypid in (
        'pg_catalog.text'::regtype,
        'pg_catalog.varchar'::regtype,
        'pg_catalog.bpchar'::regtype,
        'pg_catalog.json'::regtype,
        'pg_catalog.jsonb'::regtype
      )
    group by n.nspname, c.relname
  loop
    execute format(
      'select array_agg(distinct ref.object_path)
       from %I.%I as content
       cross join lateral unnest($1::text[]) as ref(object_path)
       where (%s)',
      v_table.table_schema,
      v_table.table_name,
      v_table.reference_predicate
    )
    into v_hits
    using v_candidate_paths;

    if v_hits is not null then
      v_referenced_paths := v_referenced_paths || v_hits;
    end if;
  end loop;

  for v_candidate in
    select o.name, o.created_at
    from storage.objects o
    where o.bucket_id = 'mantiqatix-profile-media'
      and o.name = any(v_candidate_paths)
    order by o.created_at asc
  loop
    if v_candidate.name = any(v_referenced_paths) then
      -- A live reference resets the unused window. If it becomes unused later,
      -- its five-day timer starts at the next successful scan.
      insert into public.mnty_catalog_media_retention_state (
        object_path, unreferenced_since, last_scanned_at
      ) values (
        v_candidate.name, null, v_now
      )
      on conflict (object_path) do update
      set unreferenced_since = null,
          last_scanned_at = excluded.last_scanned_at;
    else
      -- First observed unused scan starts the five-day grace period.
      insert into public.mnty_catalog_media_retention_state as state (
        object_path, unreferenced_since, last_scanned_at
      ) values (
        v_candidate.name, v_now, v_now
      )
      on conflict (object_path) do update
      set unreferenced_since = coalesce(state.unreferenced_since, excluded.unreferenced_since),
          last_scanned_at = excluded.last_scanned_at
      returning unreferenced_since into v_unreferenced_since;

      if v_unreferenced_since <= v_now - interval '5 days' then
        object_path := v_candidate.name;
        created_at := v_candidate.created_at;
        return next;
      end if;
    end if;
  end loop;
end;
$function$;

revoke all on function public.mnty_list_expired_catalog_media(integer) from public, anon, authenticated;
grant execute on function public.mnty_list_expired_catalog_media(integer) to service_role;

comment on table public.mnty_catalog_media_retention_state is
  'Service-role-only state for continuous five-day unused media retention; a live reference resets unreferenced_since.';
