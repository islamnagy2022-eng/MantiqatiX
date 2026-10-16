-- RC461 regression: run after the migration in a disposable PostgreSQL/Supabase database.
do $$
declare
  v_cols text[];
  v_def text;
  v_column_select boolean;
begin
  if has_table_privilege('anon', 'public.marketing_provider_profiles', 'select') then
    raise exception 'FAIL: anon still has direct SELECT on marketing_provider_profiles';
  end if;
  select coalesce(bool_or(has_column_privilege('anon', 'public.marketing_provider_profiles', a.attname, 'select')), false)
    into v_column_select
  from pg_attribute a
  where a.attrelid = 'public.marketing_provider_profiles'::regclass
    and a.attnum > 0 and not a.attisdropped;
  if v_column_select then
    raise exception 'FAIL: anon retains column-level SELECT on marketing_provider_profiles';
  end if;
  if not has_table_privilege('anon', 'public.public_marketing_provider_profiles', 'select') then
    raise exception 'FAIL: anon cannot read the sanitized public provider view';
  end if;
  select array_agg(column_name order by column_name) into v_cols
  from information_schema.columns
  where table_schema='public' and table_name='public_marketing_provider_profiles';
  if v_cols @> array['owner_user_id']::text[]
     or v_cols @> array['settings']::text[]
     or v_cols @> array['ranking_weight']::text[] then
    raise exception 'FAIL: internal columns exposed through public provider view: %', v_cols;
  end if;
  if not (v_cols @> array['id','business_id','name_ar','name_en','provider_kind','description','service_areas','status','is_verified','is_featured','profile_image_path','public_branding_logo_path','created_at','updated_at']::text[]) then
    raise exception 'FAIL: public provider view is missing expected allowlisted columns: %', v_cols;
  end if;
  select pg_get_viewdef('public.public_marketing_provider_profiles'::regclass, true) into v_def;
  if position('ACTIVE' in upper(v_def)) = 0 then
    raise exception 'FAIL: public provider view does not restrict rows to ACTIVE profiles';
  end if;
  raise notice 'PASS: anon table SELECT revoked; sanitized active-provider view is readable and excludes internal fields';
end $$;
