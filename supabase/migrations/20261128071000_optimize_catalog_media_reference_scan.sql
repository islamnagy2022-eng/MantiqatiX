-- Scan eligible content columns in batches so an hourly cleanup does not run
-- one database query per column per uploaded image.
create or replace function public.mnty_list_expired_catalog_media(p_limit integer default 100)
returns table(object_path text, created_at timestamptz)
language plpgsql
stable
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
begin
  select array_agg(expired.name)
  into v_candidate_paths
  from (
    select o.name
    from storage.objects o
    where o.bucket_id = 'mantiqatix-profile-media'
      and o.name like 'businesses/%/owner-uploads/%'
      and o.created_at <= now() - interval '5 days'
    order by o.created_at asc
    limit v_limit
  ) expired;

  if coalesce(array_length(v_candidate_paths, 1), 0) = 0 then
    return;
  end if;

  -- JSON columns always qualify (e.g. businesses.settings and catalog_items.metadata).
  -- Text columns qualify when their names indicate media, image, URL, path or asset data.
  -- Each table is scanned once for the complete candidate batch.
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
      and c.relname <> 'audit_logs'
      and a.attnum > 0
      and not a.attisdropped
      and (
        a.atttypid in ('pg_catalog.json'::regtype, 'pg_catalog.jsonb'::regtype)
        or (
          a.atttypid in (
            'pg_catalog.text'::regtype,
            'pg_catalog.varchar'::regtype,
            'pg_catalog.bpchar'::regtype
          )
          and (
            a.attname ilike any (array[
              '%image%', '%logo%', '%cover%', '%photo%', '%banner%', '%media%',
              '%avatar%', '%gallery%', '%url%', '%path%', '%asset%', '%thumb%',
              '%attachment%', '%icon%'
            ])
          )
        )
      )
    group by n.nspname, c.relname
  loop
    if v_table.reference_predicate is null then
      continue;
    end if;

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
    if not (v_candidate.name = any(v_referenced_paths)) then
      object_path := v_candidate.name;
      created_at := v_candidate.created_at;
      return next;
    end if;
  end loop;
end;
$function$;

revoke all on function public.mnty_list_expired_catalog_media(integer) from public, anon, authenticated;
grant execute on function public.mnty_list_expired_catalog_media(integer) to service_role;
