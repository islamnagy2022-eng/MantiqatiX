-- Retain owner-uploaded catalogue media only while it is referenced by persisted site content.
-- The Storage API performs deletions; Postgres only identifies safe candidates.
create extension if not exists pg_cron;

create or replace function public.mnty_catalog_media_cleanup_token_valid(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    p_token is not null
    and length(p_token) >= 64
    and exists (
      select 1
      from vault.decrypted_secrets s
      where s.name = 'mnty_catalog_media_cleanup_token'
        and s.decrypted_secret = p_token
    ),
    false
  );
$function$;

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
  -- Fail closed for anything outside the managed owner-upload namespace.
  if p_object_path is null
     or p_object_path !~ '^businesses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/owner-uploads/(activity|cover|product|service)/[A-Za-z0-9._-]+$' then
    return true;
  end if;

  -- Search every persisted text/JSON field in the public application schema.
  -- audit_logs is deliberately excluded because successful upload audit entries
  -- retain objectPath for traceability; audit history is not a live media reference.
  for v_column in
    select
      n.nspname as table_schema,
      c.relname as table_name,
      a.attname as column_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'm')
      and c.relname <> 'audit_logs'
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

create or replace function public.mnty_list_expired_catalog_media(p_limit integer default 100)
returns table(object_path text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_candidate record;
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 100));
begin
  for v_candidate in
    select o.name, o.created_at
    from storage.objects o
    where o.bucket_id = 'mantiqatix-profile-media'
      and o.name like 'businesses/%/owner-uploads/%'
      and o.created_at <= now() - interval '5 days'
    order by o.created_at asc
    limit v_limit
  loop
    if not public.mnty_catalog_media_object_is_referenced(v_candidate.name) then
      object_path := v_candidate.name;
      created_at := v_candidate.created_at;
      return next;
    end if;
  end loop;
end;
$function$;

-- Only the service role (used by the private cleanup Edge Function) can call
-- these definer functions. Browser roles cannot enumerate or delete site media.
revoke all on function public.mnty_catalog_media_cleanup_token_valid(text) from public, anon, authenticated;
revoke all on function public.mnty_catalog_media_object_is_referenced(text) from public, anon, authenticated;
revoke all on function public.mnty_list_expired_catalog_media(integer) from public, anon, authenticated;
grant execute on function public.mnty_catalog_media_cleanup_token_valid(text) to service_role;
grant execute on function public.mnty_catalog_media_object_is_referenced(text) to service_role;
grant execute on function public.mnty_list_expired_catalog_media(integer) to service_role;

do $schedule$
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'mnty_catalog_media_cleanup_token'
  ) or not exists (
    select 1 from vault.decrypted_secrets where name = 'mnty_media_cleanup_project_url'
  ) or not exists (
    select 1 from vault.decrypted_secrets where name = 'mnty_media_cleanup_apikey'
  ) then
    raise exception 'Catalog media cleanup Vault secrets are missing';
  end if;

  perform cron.schedule(
    'mnty-cleanup-unused-catalog-media',
    '17 * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'mnty_media_cleanup_project_url')
          || '/functions/v1/cleanup-catalog-media',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'mnty_media_cleanup_apikey'),
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mnty_catalog_media_cleanup_token')
        ),
        body := jsonb_build_object('trigger', 'pg_cron'),
        timeout_milliseconds := 60000
      ) as request_id;
    $job$
  );
end;
$schedule$;
