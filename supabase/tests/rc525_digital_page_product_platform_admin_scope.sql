-- RC525 catalog regression assertions. Run after migrations in a disposable database.
do $test$
declare
  v_policy pg_catalog.pg_policy%rowtype;
  v_using text;
  v_check text;
  v_public_read_exists boolean;
begin
  select p.*
    into v_policy
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid = p.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'digital_page_products'
    and p.polname = 'digital_page_products_platform_admin_write';

  if not found then
    raise exception 'RC525_POLICY_MISSING';
  end if;

  v_using := pg_catalog.pg_get_expr(v_policy.polqual, v_policy.polrelid);
  v_check := pg_catalog.pg_get_expr(v_policy.polwithcheck, v_policy.polrelid);

  if v_policy.polcmd <> '*' then
    raise exception 'RC525_POLICY_MUST_COVER_ALL_MUTATIONS';
  end if;
  if not ('authenticated' = any(v_policy.polroles::regrole[]::text[])) then
    -- Catalog OIDs are checked separately below because role casts vary by PostgreSQL version.
    if not exists (
      select 1 from pg_catalog.pg_roles r
      where r.rolname = 'authenticated'
        and r.oid = any(v_policy.polroles)
    ) then
      raise exception 'RC525_POLICY_ROLE_MISMATCH';
    end if;
  end if;
  if v_using not ilike '%MNTY-PLATFORM%'
     or v_using not ilike '%SUPER_ADMIN%'
     or v_using not ilike '%PLATFORM%'
     or v_using not ilike '%full_control%'
     or v_using not ilike '%ACTIVE%' then
    raise exception 'RC525_USING_SCOPE_INCOMPLETE';
  end if;
  if v_check not ilike '%MNTY-PLATFORM%'
     or v_check not ilike '%SUPER_ADMIN%'
     or v_check not ilike '%PLATFORM%'
     or v_check not ilike '%full_control%'
     or v_check not ilike '%ACTIVE%' then
    raise exception 'RC525_WITH_CHECK_SCOPE_INCOMPLETE';
  end if;

  select exists (
    select 1
    from pg_catalog.pg_policy p
    join pg_catalog.pg_class c on c.oid = p.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'digital_page_products'
      and p.polname = 'digital_page_products_public_read'
      and p.polcmd = 'r'
  ) into v_public_read_exists;

  if not v_public_read_exists then
    raise exception 'RC525_PUBLIC_ACTIVE_READ_POLICY_MISSING';
  end if;
end
$test$;
