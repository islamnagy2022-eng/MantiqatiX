-- RC459: protected dry-run and transactional application of one taxonomy mapping.
-- Forward-only. Reclassifies only the source group/category pair in businesses and
-- public_directory_listings. All unrelated data and legacy identifiers are preserved.
-- Apply only through the isolated replay and approved release pipeline.

create table if not exists public.catalog_taxonomy_mapping_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  source_group_id text not null,
  source_category_id text not null,
  target_group_id text not null,
  target_category_id text not null,
  target_classification_type text not null check (target_classification_type in ('activity','profession')),
  preview_digest text not null,
  affected_business_count integer not null check (affected_business_count >= 0),
  affected_listing_count integer not null check (affected_listing_count >= 0),
  before_image jsonb not null,
  after_mapping jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.catalog_taxonomy_mapping_audit enable row level security;
alter table public.catalog_taxonomy_mapping_audit force row level security;
revoke all on table public.catalog_taxonomy_mapping_audit from public, anon, authenticated, service_role;

create or replace function public.prevent_catalog_taxonomy_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  raise exception 'CATALOG_TAXONOMY_AUDIT_APPEND_ONLY';
end;
$function$;

revoke all on function public.prevent_catalog_taxonomy_audit_mutation() from public, anon, authenticated, service_role;
drop trigger if exists catalog_taxonomy_mapping_audit_append_only on public.catalog_taxonomy_mapping_audit;
create trigger catalog_taxonomy_mapping_audit_append_only
before update or delete on public.catalog_taxonomy_mapping_audit
for each row execute function public.prevent_catalog_taxonomy_audit_mutation();

create or replace function public.mnty_catalog_taxonomy_mapping_preview(
  p_actor_user_id uuid,
  p_source_group_id text,
  p_source_category_id text,
  p_target_group_id text,
  p_target_category_id text,
  p_target_classification_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_allowed_groups constant text[] := array[
    'medical_health','food_grocery','fashion_beauty','home_maintenance',
    'construction_decor','auto_transport','real_estate','education_training',
    'technology_communications','professional_services','marketing_media',
    'trade_ecommerce','agriculture_animals','sports_fitness','tourism_events',
    'finance_insurance','industry_workshops','public_community'
  ];
  v_source_prefix text;
  v_target_prefix text;
  v_source_code text;
  v_target_code text;
  v_business_count integer := 0;
  v_listing_count integer := 0;
  v_digest text;
  v_sample jsonb := '[]'::jsonb;
  v_material text;
begin
  if p_actor_user_id is null or not exists (
    select 1
    from public.user_memberships m
    where m.user_id = p_actor_user_id
      and upper(coalesce(m.role,'')) = 'SUPER_ADMIN'
      and upper(coalesce(m.status,'')) = 'ACTIVE'
      and m.business_id is null
      and m.branch_id is null
      and m.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb
  ) then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  if p_source_group_id is null or not (p_source_group_id = any(v_allowed_groups))
     or p_target_group_id is null or not (p_target_group_id = any(v_allowed_groups)) then
    raise exception 'TAXONOMY_INVALID_GROUP';
  end if;
  if p_target_classification_type is null or p_target_classification_type not in ('activity','profession') then
    raise exception 'TAXONOMY_INVALID_CLASSIFICATION_TYPE';
  end if;

  v_source_prefix := 'cat_' || p_source_group_id || '_';
  v_target_prefix := 'cat_' || p_target_group_id || '_';
  if p_source_category_id is null or left(p_source_category_id,length(v_source_prefix)) <> v_source_prefix
     or p_target_category_id is null or left(p_target_category_id,length(v_target_prefix)) <> v_target_prefix then
    raise exception 'TAXONOMY_INVALID_CATEGORY_ID';
  end if;
  v_source_code := substr(p_source_category_id,length(v_source_prefix)+1);
  v_target_code := substr(p_target_category_id,length(v_target_prefix)+1);
  if v_source_code !~ '^[a-z0-9]+(_[a-z0-9]+)*$'
     or v_target_code !~ '^[a-z0-9]+(_[a-z0-9]+)*$' then
    raise exception 'TAXONOMY_INVALID_CATEGORY_CODE';
  end if;
  if p_source_group_id = p_target_group_id and p_source_category_id = p_target_category_id then
    raise exception 'TAXONOMY_MAPPING_IS_NOOP';
  end if;

  select count(*)::integer into v_business_count
  from public.businesses b
  where b.settings->>'activity_group_code' = p_source_group_id
    and b.settings->>'activity_category_code' = v_source_code;

  select count(*)::integer into v_listing_count
  from public.public_directory_listings l
  where l.functional_group_id = p_source_group_id
    and l.taxonomy_category_id = p_source_category_id;

  select
    coalesce(string_agg(
      'B|' || b.id::text || '|' || coalesce(b.updated_at::text,'') || '|' ||
      coalesce(b.settings->>'activity_group_code','') || '|' ||
      coalesce(b.settings->>'activity_category_code','') || '|' ||
      coalesce(b.settings->>'activity_category_id','') || '|' ||
      coalesce(b.settings->>'activity_classification_type',''),
      E'\n' order by b.id
    ),'')
  into v_material
  from public.businesses b
  where b.settings->>'activity_group_code' = p_source_group_id
    and b.settings->>'activity_category_code' = v_source_code;

  v_material := coalesce(v_material,'') || E'\n' || coalesce((
    select string_agg(
      'L|' || l.id::text || '|' || coalesce(l.updated_at::text,'') || '|' ||
      coalesce(l.functional_group_id,'') || '|' || coalesce(l.taxonomy_category_id,''),
      E'\n' order by l.id
    )
    from public.public_directory_listings l
    where l.functional_group_id = p_source_group_id
      and l.taxonomy_category_id = p_source_category_id
  ),'');
  v_digest := md5(
    p_source_group_id || '|' || p_source_category_id || '|' ||
    p_target_group_id || '|' || p_target_category_id || '|' ||
    p_target_classification_type || '|' || v_material
  );

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_sample
  from (
    select x.record_type, x.record_id, x.display_name, x.old_group_id,
           x.old_category_id, p_target_group_id as new_group_id,
           p_target_category_id as new_category_id
    from (
      select 'business'::text as record_type, b.id::text as record_id,
             b.name::text as display_name,
             b.settings->>'activity_group_code' as old_group_id,
             ('cat_' || (b.settings->>'activity_group_code') || '_' ||
               (b.settings->>'activity_category_code')) as old_category_id
      from public.businesses b
      where b.settings->>'activity_group_code' = p_source_group_id
        and b.settings->>'activity_category_code' = v_source_code
      union all
      select 'directory_listing'::text, l.id::text, l.display_name,
             l.functional_group_id, l.taxonomy_category_id
      from public.public_directory_listings l
      where l.functional_group_id = p_source_group_id
        and l.taxonomy_category_id = p_source_category_id
    ) x
    order by x.record_type, x.record_id
    limit 50
  ) s;

  return jsonb_build_object(
    'success', true,
    'sourceGroupId', p_source_group_id,
    'sourceCategoryId', p_source_category_id,
    'targetGroupId', p_target_group_id,
    'targetCategoryId', p_target_category_id,
    'targetClassificationType', p_target_classification_type,
    'businessCount', v_business_count,
    'listingCount', v_listing_count,
    'totalCount', v_business_count + v_listing_count,
    'previewDigest', v_digest,
    'canApply', (v_business_count + v_listing_count) > 0,
    'sample', v_sample
  );
end;
$function$;

create or replace function public.mnty_catalog_taxonomy_mapping_apply(
  p_actor_user_id uuid,
  p_source_group_id text,
  p_source_category_id text,
  p_target_group_id text,
  p_target_category_id text,
  p_target_classification_type text,
  p_expected_preview_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_preview jsonb;
  v_source_prefix text;
  v_target_prefix text;
  v_target_code text;
  v_before_image jsonb;
  v_business_count integer := 0;
  v_listing_count integer := 0;
  v_audit_id uuid;
begin
  if p_actor_user_id is null or not exists (
    select 1
    from public.user_memberships m
    where m.user_id = p_actor_user_id
      and upper(coalesce(m.role,'')) = 'SUPER_ADMIN'
      and upper(coalesce(m.status,'')) = 'ACTIVE'
      and m.business_id is null
      and m.branch_id is null
      and m.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb
  ) then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  if p_expected_preview_digest is null or length(p_expected_preview_digest) <> 32 then
    raise exception 'TAXONOMY_PREVIEW_REQUIRED';
  end if;

  -- Serialize taxonomy mapping commits and block concurrent inserts/updates while
  -- the exact preview snapshot is revalidated and committed.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('mnty-taxonomy:' || p_source_group_id || ':' || p_source_category_id)
  );
  lock table public.businesses in share row exclusive mode;
  lock table public.public_directory_listings in share row exclusive mode;

  v_preview := public.mnty_catalog_taxonomy_mapping_preview(
    p_actor_user_id,p_source_group_id,p_source_category_id,
    p_target_group_id,p_target_category_id,p_target_classification_type
  );
  if v_preview->>'previewDigest' <> p_expected_preview_digest then
    raise exception 'TAXONOMY_PREVIEW_STALE';
  end if;
  if coalesce((v_preview->>'totalCount')::integer,0) = 0 then
    raise exception 'TAXONOMY_NO_MATCHING_RECORDS';
  end if;

  v_source_prefix := 'cat_' || p_source_group_id || '_';
  v_target_prefix := 'cat_' || p_target_group_id || '_';
  v_target_code := substr(p_target_category_id,length(v_target_prefix)+1);

  select jsonb_build_object(
    'businesses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',b.id,
        'activity_group_code',b.settings->>'activity_group_code',
        'activity_category_code',b.settings->>'activity_category_code',
        'activity_category_id',b.settings->>'activity_category_id',
        'activity_classification_type',b.settings->>'activity_classification_type',
        'updated_at',b.updated_at
      ) order by b.id)
      from public.businesses b
      where b.settings->>'activity_group_code' = p_source_group_id
        and b.settings->>'activity_category_code' = substr(p_source_category_id,length(v_source_prefix)+1)
    ),'[]'::jsonb),
    'directoryListings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',l.id,'functional_group_id',l.functional_group_id,
        'taxonomy_category_id',l.taxonomy_category_id,
        'taxonomy_specialty',l.taxonomy_specialty,'updated_at',l.updated_at
      ) order by l.id)
      from public.public_directory_listings l
      where l.functional_group_id = p_source_group_id
        and l.taxonomy_category_id = p_source_category_id
    ),'[]'::jsonb)
  ) into v_before_image;

  update public.businesses b
  set settings = pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
          pg_catalog.jsonb_set(coalesce(b.settings,'{}'::jsonb),
            '{activity_group_code}',to_jsonb(p_target_group_id),true),
          '{activity_category_code}',to_jsonb(v_target_code),true),
        '{activity_classification_type}',to_jsonb(p_target_classification_type),true),
      '{activity_category_id}',to_jsonb(p_target_category_id),true
    ),
    updated_at = now()
  where b.settings->>'activity_group_code' = p_source_group_id
    and b.settings->>'activity_category_code' = substr(p_source_category_id,length(v_source_prefix)+1);
  get diagnostics v_business_count = row_count;

  update public.public_directory_listings l
  set functional_group_id = p_target_group_id,
      taxonomy_category_id = p_target_category_id,
      updated_at = now()
  where l.functional_group_id = p_source_group_id
    and l.taxonomy_category_id = p_source_category_id;
  get diagnostics v_listing_count = row_count;

  if v_business_count <> coalesce((v_preview->>'businessCount')::integer,0)
     or v_listing_count <> coalesce((v_preview->>'listingCount')::integer,0) then
    raise exception 'TAXONOMY_APPLY_COUNT_MISMATCH';
  end if;

  insert into public.catalog_taxonomy_mapping_audit(
    actor_user_id,source_group_id,source_category_id,
    target_group_id,target_category_id,target_classification_type,
    preview_digest,affected_business_count,affected_listing_count,
    before_image,after_mapping
  ) values (
    p_actor_user_id,p_source_group_id,p_source_category_id,
    p_target_group_id,p_target_category_id,p_target_classification_type,
    p_expected_preview_digest,v_business_count,v_listing_count,
    v_before_image,jsonb_build_object(
      'groupId',p_target_group_id,
      'categoryId',p_target_category_id,
      'classificationType',p_target_classification_type
    )
  ) returning id into v_audit_id;

  return jsonb_build_object(
    'success',true,
    'auditId',v_audit_id,
    'businessCount',v_business_count,
    'listingCount',v_listing_count,
    'totalCount',v_business_count+v_listing_count
  );
end;
$function$;

revoke all on function public.mnty_catalog_taxonomy_mapping_preview(uuid,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.mnty_catalog_taxonomy_mapping_apply(uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.mnty_catalog_taxonomy_mapping_preview(uuid,text,text,text,text,text) to service_role;
grant execute on function public.mnty_catalog_taxonomy_mapping_apply(uuid,text,text,text,text,text,text) to service_role;
