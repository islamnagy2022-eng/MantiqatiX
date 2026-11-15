-- RC467: close tenant-wide commission administration through business/branch memberships.
-- The commission manager is exposed only inside the platform Super Admin workspace.
-- Legacy operational preview remains available to tenant-wide and exact-business finance roles;
-- branch-scoped finance roles are denied because this RPC has no branch_id argument.
-- Requires RC464 first (canonical private.platform_admins-backed mnty_can_platform_admin()).
BEGIN;

DO $preflight$
DECLARE
  v_helper_oid oid;
BEGIN
  IF pg_catalog.to_regprocedure('public.mnty_can_platform_admin()') IS NULL THEN
    RAISE EXCEPTION 'RC467_CANONICAL_PLATFORM_ADMIN_GUARD_REQUIRED';
  END IF;
  SELECT p.oid INTO v_helper_oid
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure('public.mnty_can_platform_admin()')
    AND p.prosecdef
    AND coalesce(pg_catalog.array_to_string(p.proconfig, ','), '') LIKE '%search_path=""%';
  IF v_helper_oid IS NULL THEN
    RAISE EXCEPTION 'RC467_CANONICAL_PLATFORM_ADMIN_GUARD_MUST_BE_SECURITY_DEFINER_EMPTY_PATH';
  END IF;

  IF pg_catalog.to_regprocedure('public.mnty_commission_rule_drafts(text,character varying,character varying,jsonb)') IS NULL
     OR pg_catalog.to_regprocedure('public.preview_commission_rule_draft(character varying,character varying,numeric)') IS NULL
     OR pg_catalog.to_regprocedure('public.preview_commission_rule_resolution(character varying,uuid,character varying,text,text,text,text,numeric)') IS NULL
     OR pg_catalog.to_regprocedure('public.preview_commission_backend(character varying,uuid,character varying,numeric)') IS NULL THEN
    RAISE EXCEPTION 'RC467_EXPECTED_COMMISSION_RPC_MISSING';
  END IF;
END;
$preflight$;

create or replace function public.mnty_commission_rule_drafts(
  p_action text,
  p_tenant_id varchar,
  p_rule_id varchar default null,
  p_rule jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_action text := upper(trim(coalesce(p_action, '')));
  v_scope text;
  v_scope_ref text;
  v_mode text;
  v_event text;
  v_name text;
  v_description text;
  v_percentage numeric;
  v_fixed numeric;
  v_minimum numeric;
  v_maximum numeric;
  v_priority integer;
  v_from timestamptz;
  v_to timestamptz;
  v_exempt boolean;
  v_business_id uuid;
  v_id varchar;
  v_existing public.commission_rules%rowtype;
  v_is_platform_admin boolean;
begin
  if v_actor is null or coalesce(auth.jwt()->>'is_anonymous','false') = 'true' then
    raise exception 'AUTH_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_tenant_id,'')), '') is null then
    raise exception 'TENANT_REQUIRED';
  end if;

  v_is_platform_admin := public.mnty_can_platform_admin();

  if not v_is_platform_admin then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  if not exists (select 1 from public.tenants t where t.id = p_tenant_id) then
    raise exception 'TENANT_NOT_FOUND';
  end if;

  if v_action = 'LIST' then
    return jsonb_build_object(
      'rules', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id, 'tenant_id', r.tenant_id, 'business_id', r.business_id,
          'module_id', r.module_id, 'rule_name', r.rule_name, 'rule_description', r.rule_description,
          'rule_type', r.rule_type, 'calculation_mode', r.calculation_mode, 'percentage', r.percentage,
          'fixed_amount', r.fixed_amount, 'per_item_amount', r.per_item_amount, 'scope_type', r.scope_type,
          'scope_ref', r.scope_ref, 'eligibility_event', r.eligibility_event,
          'minimum_commission_amount', r.minimum_commission_amount,
          'maximum_commission_amount', r.maximum_commission_amount, 'rule_priority', r.rule_priority,
          'effective_from', r.effective_from, 'effective_to', r.effective_to, 'is_exempt', r.is_exempt,
          'approval_status', r.approval_status, 'version_no', r.version_no, 'active', r.active,
          'created_at', r.created_at, 'updated_at', r.updated_at
        ) order by r.rule_priority desc, r.updated_at desc)
        from public.commission_rules r where r.tenant_id = p_tenant_id
      ), '[]'::jsonb)
    );
  end if;

  if v_action = 'AUDIT' then
    return jsonb_build_object(
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id, 'commission_rule_id', a.commission_rule_id,
          'actor_user_id', a.actor_user_id, 'action', a.action,
          'old_values', a.old_values, 'new_values', a.new_values,
          'created_at', a.created_at
        ) order by a.created_at desc)
        from (
          select id, commission_rule_id, actor_user_id, action, old_values, new_values, created_at
          from public.commission_rule_audit
          where tenant_id = p_tenant_id
          order by created_at desc
          limit 100
        ) a
      ), '[]'::jsonb)
    );
  end if;

  if v_action = 'SAVE' then
    if jsonb_typeof(coalesce(p_rule,'{}'::jsonb)) <> 'object' then raise exception 'INVALID_RULE'; end if;

    v_name := nullif(trim(coalesce(p_rule->>'rule_name','')), '');
    v_description := nullif(trim(coalesce(p_rule->>'rule_description','')), '');
    v_scope := upper(coalesce(nullif(trim(p_rule->>'scope_type'),''),'TENANT'));
    v_scope_ref := nullif(trim(coalesce(p_rule->>'scope_ref','')), '');
    v_mode := upper(coalesce(nullif(trim(p_rule->>'calculation_mode'),''),'PERCENTAGE'));
    v_event := upper(coalesce(nullif(trim(p_rule->>'eligibility_event'),''),'UNSPECIFIED'));
    v_percentage := nullif(trim(coalesce(p_rule->>'percentage','')), '')::numeric;
    v_fixed := nullif(trim(coalesce(p_rule->>'fixed_amount','')), '')::numeric;
    v_minimum := nullif(trim(coalesce(p_rule->>'minimum_commission_amount','')), '')::numeric;
    v_maximum := nullif(trim(coalesce(p_rule->>'maximum_commission_amount','')), '')::numeric;
    v_priority := coalesce(nullif(trim(coalesce(p_rule->>'rule_priority','')), '')::integer,100);
    v_from := nullif(trim(coalesce(p_rule->>'effective_from','')), '')::timestamptz;
    v_to := nullif(trim(coalesce(p_rule->>'effective_to','')), '')::timestamptz;
    v_exempt := coalesce((p_rule->>'is_exempt')::boolean, false);

    if v_name is null or length(v_name) > 120 then raise exception 'RULE_NAME_REQUIRED'; end if;
    if v_description is not null and length(v_description) > 1000 then raise exception 'RULE_DESCRIPTION_TOO_LONG'; end if;
    if v_scope not in ('TENANT','BUSINESS','CATEGORY','PRODUCT','SERVICE','PLAN','AGREEMENT') then raise exception 'INVALID_SCOPE_TYPE'; end if;
    if v_scope <> 'TENANT' and v_scope_ref is null then raise exception 'SCOPE_REFERENCE_REQUIRED'; end if;
    if v_mode not in ('PERCENTAGE','FIXED','COMBINED') then raise exception 'INVALID_CALCULATION_MODE'; end if;
    if v_event not in ('ORDER_PAID','ORDER_COMPLETED','SERVICE_COMPLETED','SUBSCRIPTION_PAID','PROMOTION_REDEEMED') then raise exception 'ELIGIBILITY_EVENT_REQUIRED'; end if;
    if v_percentage is not null and (v_percentage < 0 or v_percentage > 100 or v_percentage::text in ('NaN','Infinity','-Infinity')) then raise exception 'INVALID_PERCENTAGE'; end if;
    if v_fixed is not null and (v_fixed < 0 or v_fixed::text in ('NaN','Infinity','-Infinity')) then raise exception 'INVALID_FIXED_AMOUNT'; end if;
    if v_minimum is not null and (v_minimum < 0 or v_minimum::text in ('NaN','Infinity','-Infinity')) then raise exception 'INVALID_MINIMUM_AMOUNT'; end if;
    if v_maximum is not null and (v_maximum < 0 or v_maximum::text in ('NaN','Infinity','-Infinity')) then raise exception 'INVALID_MAXIMUM_AMOUNT'; end if;
    if v_minimum is not null and v_maximum is not null and v_minimum > v_maximum then raise exception 'INVALID_AMOUNT_RANGE'; end if;
    if v_priority < 0 or v_priority > 10000 then raise exception 'INVALID_PRIORITY'; end if;
    if v_from is not null and v_to is not null and v_from > v_to then raise exception 'INVALID_EFFECTIVE_PERIOD'; end if;
    if v_exempt then
      v_percentage := 0;
      v_fixed := 0;
    elsif (v_mode in ('PERCENTAGE','COMBINED') and v_percentage is null)
       or (v_mode in ('FIXED','COMBINED') and v_fixed is null) then
      raise exception 'COMMISSION_AMOUNT_REQUIRED';
    end if;

    v_business_id := null;
    if v_scope = 'BUSINESS' then
      if v_scope_ref !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'INVALID_BUSINESS_ID'; end if;
      v_business_id := v_scope_ref::uuid;
      if not exists (select 1 from public.businesses b where b.id = v_business_id and b.tenant_id = p_tenant_id) then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
    end if;

    if v_scope in ('PRODUCT','SERVICE') then
      if v_scope_ref !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'INVALID_CATALOG_ITEM_ID'; end if;
      if not exists (
        select 1 from public.catalog_items ci
        where ci.id = v_scope_ref::uuid and ci.tenant_id = p_tenant_id
          and (v_scope = 'SERVICE' and upper(ci.item_type) = 'SERVICE'
            or v_scope = 'PRODUCT' and upper(ci.item_type) = 'PRODUCT')
      ) then raise exception 'CATALOG_ITEM_TENANT_OR_TYPE_MISMATCH'; end if;
    end if;

    if p_rule_id is not null then
      select * into v_existing from public.commission_rules r
      where r.id = p_rule_id and r.tenant_id = p_tenant_id for update;
      if not found then raise exception 'RULE_NOT_FOUND'; end if;
      if coalesce(v_existing.active,false) or v_existing.approval_status <> 'DRAFT' then
        raise exception 'RULE_NOT_EDITABLE';
      end if;
      update public.commission_rules set
        business_id = v_business_id,
        rule_type = v_mode,
        percentage = case when v_mode in ('PERCENTAGE','COMBINED') then coalesce(v_percentage,0) else 0 end,
        fixed_amount = case when v_mode in ('FIXED','COMBINED') then coalesce(v_fixed,0) else 0 end,
        per_item_amount = null,
        rule_name = v_name,
        rule_description = v_description,
        calculation_mode = v_mode,
        scope_type = v_scope,
        scope_ref = v_scope_ref,
        eligibility_event = v_event,
        minimum_commission_amount = v_minimum,
        maximum_commission_amount = v_maximum,
        rule_priority = v_priority,
        effective_from = v_from,
        effective_to = v_to,
        is_exempt = v_exempt,
        updated_by = v_actor,
        updated_at = now(),
        version_no = version_no + 1,
        active = false
      where id = p_rule_id and tenant_id = p_tenant_id returning id into v_id;
    else
      v_id := gen_random_uuid()::text;
      insert into public.commission_rules(
        id,tenant_id,business_id,rule_type,percentage,fixed_amount,per_item_amount,active,
        rule_name,rule_description,calculation_mode,scope_type,scope_ref,eligibility_event,
        minimum_commission_amount,maximum_commission_amount,rule_priority,effective_from,effective_to,
        is_exempt,approval_status,version_no,created_by,updated_by,created_at,updated_at
      ) values (
        v_id,p_tenant_id,v_business_id,v_mode,
        case when v_mode in ('PERCENTAGE','COMBINED') then coalesce(v_percentage,0) else 0 end,
        case when v_mode in ('FIXED','COMBINED') then coalesce(v_fixed,0) else 0 end,
        null,false,v_name,v_description,v_mode,v_scope,v_scope_ref,v_event,
        v_minimum,v_maximum,v_priority,v_from,v_to,v_exempt,'DRAFT',1,v_actor,v_actor,now(),now()
      );
    end if;

    return jsonb_build_object('success',true,'rule_id',v_id,'approval_status','DRAFT','active',false);
  end if;

  if v_action = 'DELETE' then
    if nullif(trim(coalesce(p_rule_id,'')), '') is null then raise exception 'RULE_ID_REQUIRED'; end if;
    delete from public.commission_rules r
    where r.id = p_rule_id and r.tenant_id = p_tenant_id
      and r.active = false and r.approval_status = 'DRAFT';
    if not found then raise exception 'RULE_NOT_DELETABLE'; end if;
    return jsonb_build_object('success',true,'deleted',true,'rule_id',p_rule_id);
  end if;

  raise exception 'UNSUPPORTED_ACTION';
end;
$function$;

REVOKE ALL ON FUNCTION public.mnty_commission_rule_drafts(text, character varying, character varying, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mnty_commission_rule_drafts(text, character varying, character varying, jsonb) TO authenticated;
COMMENT ON FUNCTION public.mnty_commission_rule_drafts(text, character varying, character varying, jsonb) IS
  'RC467: platform-root-only commission draft management; tenant/business/branch membership does not imply platform commission administration.';

create or replace function public.preview_commission_rule_draft(
  p_tenant_id varchar,
  p_rule_id varchar,
  p_gross_amount numeric
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_platform_admin boolean := false;
  v_rule public.commission_rules%rowtype;
  v_raw numeric := 0;
  v_commission numeric := 0;
  v_mode text;
  v_formula text;
  v_now timestamptz := now();
  v_currently_in_effect boolean;
begin
  if v_actor is null or coalesce(auth.jwt()->>'is_anonymous','false') = 'true' then
    raise exception 'AUTH_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_tenant_id,'')), '') is null
     or nullif(trim(coalesce(p_rule_id,'')), '') is null then
    raise exception 'TENANT_AND_RULE_REQUIRED';
  end if;
  if p_gross_amount is null
     or p_gross_amount < 0
     or p_gross_amount::text in ('NaN','Infinity','-Infinity')
     or p_gross_amount > 1000000000000 then
    raise exception 'INVALID_PREVIEW_GROSS_AMOUNT';
  end if;

  v_platform_admin := public.mnty_can_platform_admin();

  if not v_platform_admin then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  select * into v_rule
  from public.commission_rules r
  where r.id = p_rule_id
    and r.tenant_id = p_tenant_id
    and r.active = false
    and r.approval_status = 'DRAFT'
  for share;

  if not found then raise exception 'DRAFT_RULE_NOT_FOUND'; end if;
  if v_rule.eligibility_event = 'UNSPECIFIED' then
    raise exception 'ELIGIBILITY_EVENT_REQUIRED';
  end if;
  if coalesce(v_rule.calculation_mode,'LEGACY') not in ('PERCENTAGE','FIXED','COMBINED') then
    raise exception 'UNSUPPORTED_PREVIEW_CALCULATION_MODE';
  end if;

  if coalesce(v_rule.percentage,0) < 0 or coalesce(v_rule.percentage,0) > 100
     or coalesce(v_rule.percentage,0)::text in ('NaN','Infinity','-Infinity')
     or coalesce(v_rule.fixed_amount,0) < 0
     or coalesce(v_rule.fixed_amount,0)::text in ('NaN','Infinity','-Infinity')
     or (v_rule.minimum_commission_amount is not null and (v_rule.minimum_commission_amount < 0 or v_rule.minimum_commission_amount::text in ('NaN','Infinity','-Infinity')))
     or (v_rule.maximum_commission_amount is not null and (v_rule.maximum_commission_amount < 0 or v_rule.maximum_commission_amount::text in ('NaN','Infinity','-Infinity'))) then
    raise exception 'INVALID_DRAFT_RULE_AMOUNT';
  end if;
  if v_rule.minimum_commission_amount is not null
     and v_rule.maximum_commission_amount is not null
     and v_rule.minimum_commission_amount > v_rule.maximum_commission_amount then
    raise exception 'INVALID_DRAFT_RULE_BOUNDS';
  end if;

  v_mode := v_rule.calculation_mode;
  v_currently_in_effect :=
    (v_rule.effective_from is null or v_rule.effective_from <= v_now)
    and (v_rule.effective_to is null or v_rule.effective_to >= v_now);

  if v_rule.is_exempt then
    v_raw := 0;
    v_commission := 0;
    v_formula := 'EXEMPTION';
  else
    case v_mode
      when 'PERCENTAGE' then
        v_raw := round(p_gross_amount * coalesce(v_rule.percentage,0) / 100, 2);
        v_formula := 'ROUND(gross_amount * percentage / 100, 2)';
      when 'FIXED' then
        v_raw := round(coalesce(v_rule.fixed_amount,0), 2);
        v_formula := 'ROUND(fixed_amount, 2)';
      when 'COMBINED' then
        v_raw := round((p_gross_amount * coalesce(v_rule.percentage,0) / 100) + coalesce(v_rule.fixed_amount,0), 2);
        v_formula := 'ROUND(gross_amount * percentage / 100 + fixed_amount, 2)';
      else
        raise exception 'UNSUPPORTED_PREVIEW_CALCULATION_MODE';
    end case;

    v_commission := v_raw;
    if v_rule.minimum_commission_amount is not null then
      v_commission := greatest(v_commission, v_rule.minimum_commission_amount);
    end if;
    if v_rule.maximum_commission_amount is not null then
      v_commission := least(v_commission, v_rule.maximum_commission_amount);
    end if;
    v_commission := round(v_commission,2);

    if v_commission > p_gross_amount then
      raise exception 'PREVIEW_COMMISSION_EXCEEDS_GROSS';
    end if;
  end if;

  return jsonb_build_object(
    'preview_only', true,
    'applies_to_orders', false,
    'rule_id', v_rule.id,
    'rule_name', v_rule.rule_name,
    'rule_version', v_rule.version_no,
    'approval_status', v_rule.approval_status,
    'active', v_rule.active,
    'scope_type', v_rule.scope_type,
    'scope_ref', v_rule.scope_ref,
    'eligibility_event', v_rule.eligibility_event,
    'calculation_mode', v_mode,
    'formula', v_formula,
    'gross_amount', p_gross_amount,
    'raw_commission_amount', v_raw,
    'minimum_commission_amount', v_rule.minimum_commission_amount,
    'maximum_commission_amount', v_rule.maximum_commission_amount,
    'commission_amount', v_commission,
    'provider_net_amount', round(p_gross_amount - v_commission, 2),
    'currency', 'EGP',
    'effective_from', v_rule.effective_from,
    'effective_to', v_rule.effective_to,
    'currently_in_effect', v_currently_in_effect,
    'generated_at', v_now
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.preview_commission_rule_draft(character varying, character varying, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_commission_rule_draft(character varying, character varying, numeric) TO authenticated;
COMMENT ON FUNCTION public.preview_commission_rule_draft(character varying, character varying, numeric) IS
  'RC467: preview of commission drafts is restricted to canonical platform-root authority.';

create or replace function public.preview_commission_rule_resolution(
  p_tenant_id varchar,
  p_business_id uuid,
  p_module_id varchar,
  p_scope_type text,
  p_scope_ref text,
  p_category_ref text,
  p_eligibility_event text,
  p_gross_amount numeric
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_platform_admin boolean := false;
  v_event text := upper(trim(coalesce(p_eligibility_event,'')));
  v_context_scope text := upper(trim(coalesce(p_scope_type,'')));
  v_context_ref text := nullif(trim(coalesce(p_scope_ref,'')),'');
  v_category_ref text := nullif(trim(coalesce(p_category_ref,'')),'');
  v_winner_id varchar;
  v_winner_preview jsonb;
  v_candidates jsonb;
  v_count integer := 0;
begin
  if v_actor is null or coalesce(auth.jwt()->>'is_anonymous','false') = 'true' then
    raise exception 'AUTH_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_tenant_id,'')), '') is null then
    raise exception 'TENANT_REQUIRED';
  end if;
  if p_gross_amount is null
     or p_gross_amount < 0
     or p_gross_amount::text in ('NaN','Infinity','-Infinity')
     or p_gross_amount > 1000000000000 then
    raise exception 'INVALID_PREVIEW_GROSS_AMOUNT';
  end if;
  if v_context_scope not in ('TENANT','CATEGORY','PRODUCT','SERVICE','PLAN','AGREEMENT') then
    raise exception 'INVALID_RESOLUTION_SCOPE';
  end if;
  if v_context_scope <> 'TENANT' and v_context_ref is null then
    raise exception 'RESOLUTION_SCOPE_REFERENCE_REQUIRED';
  end if;
  if v_event not in ('ORDER_PAID','ORDER_COMPLETED','SERVICE_COMPLETED','SUBSCRIPTION_PAID','PROMOTION_REDEEMED') then
    raise exception 'INVALID_ELIGIBILITY_EVENT';
  end if;

  v_platform_admin := public.mnty_can_platform_admin();

  if not v_platform_admin then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  if p_business_id is not null and not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.tenant_id = p_tenant_id
  ) then
    raise exception 'BUSINESS_TENANT_MISMATCH';
  end if;

  with eligible as (
    select r.id, r.rule_name, r.rule_description, r.rule_type, r.calculation_mode,
           r.percentage, r.fixed_amount, r.minimum_commission_amount, r.maximum_commission_amount,
           r.scope_type, r.scope_ref, r.business_id, r.module_id, r.eligibility_event,
           r.rule_priority, r.effective_from, r.effective_to, r.is_exempt,
           r.version_no, r.updated_at,
           case
             when r.scope_type = 'TENANT' then 1
             when r.scope_type = 'BUSINESS' then 2
             when r.scope_type = 'CATEGORY' then 3
             when r.scope_type in ('PRODUCT','SERVICE','PLAN','AGREEMENT') then 4
             else 0
           end as specificity_rank
    from public.commission_rules r
    where r.tenant_id = p_tenant_id
      and r.active = false
      and r.approval_status = 'DRAFT'
      and r.eligibility_event = v_event
      and (r.module_id is null or r.module_id = p_module_id)
      and (r.effective_from is null or r.effective_from <= now())
      and (r.effective_to is null or r.effective_to >= now())
      and (
        r.scope_type = 'TENANT'
        or (
          r.scope_type = 'BUSINESS'
          and p_business_id is not null
          and r.business_id = p_business_id
          and r.scope_ref = p_business_id::text
        )
        or (
          v_category_ref is not null
          and r.scope_type = 'CATEGORY'
          and r.scope_ref = v_category_ref
          and (r.business_id is null or r.business_id = p_business_id)
        )
        or (
          v_context_scope <> 'TENANT'
          and v_context_scope <> 'BUSINESS'
          and r.scope_type = v_context_scope
          and r.scope_ref = v_context_ref
          and (r.business_id is null or r.business_id = p_business_id)
        )
      )
  )
  select count(*),
         (array_agg(id order by rule_priority desc, specificity_rank desc, updated_at desc, id asc))[1],
         coalesce(jsonb_agg(jsonb_build_object(
           'rule_id',id,
           'rule_name',rule_name,
           'scope_type',scope_type,
           'scope_ref',scope_ref,
           'business_id',business_id,
           'module_id',module_id,
           'eligibility_event',eligibility_event,
           'calculation_mode',calculation_mode,
           'percentage',percentage,
           'fixed_amount',fixed_amount,
           'minimum_commission_amount',minimum_commission_amount,
           'maximum_commission_amount',maximum_commission_amount,
           'rule_priority',rule_priority,
           'specificity_rank',specificity_rank,
           'effective_from',effective_from,
           'effective_to',effective_to,
           'is_exempt',is_exempt,
           'version_no',version_no,
           'selected',false
         ) order by rule_priority desc, specificity_rank desc, updated_at desc, id asc), '[]'::jsonb)
    into v_count, v_winner_id, v_candidates
  from eligible;

  if v_winner_id is not null then
    v_winner_preview := public.preview_commission_rule_draft(p_tenant_id,v_winner_id,p_gross_amount);
    select coalesce(jsonb_agg(
      case when element->>'rule_id' = v_winner_id then element || jsonb_build_object('selected',true) else element end
      order by ord
    ),'[]'::jsonb)
    into v_candidates
    from jsonb_array_elements(v_candidates) with ordinality as candidate(element,ord);
  end if;

  return jsonb_build_object(
    'preview_only',true,
    'applies_to_orders',false,
    'tenant_id',p_tenant_id,
    'business_id',p_business_id,
    'module_id',p_module_id,
    'scope_type',v_context_scope,
    'scope_ref',v_context_ref,
    'eligibility_event',v_event,
    'gross_amount',p_gross_amount,
    'rule_count',v_count,
    'selected_rule_id',v_winner_id,
    'selection_policy','priority DESC, specificity DESC, updated_at DESC, rule_id ASC',
    'candidates',v_candidates,
    'selected_preview',v_winner_preview,
    'evaluated_at',now()
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.preview_commission_rule_resolution(character varying, uuid, character varying, text, text, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_commission_rule_resolution(character varying, uuid, character varying, text, text, text, text, numeric) TO authenticated;
COMMENT ON FUNCTION public.preview_commission_rule_resolution(character varying, uuid, character varying, text, text, text, text, numeric) IS
  'RC467: commission draft resolution preview is restricted to canonical platform-root authority.';

CREATE OR REPLACE FUNCTION public.preview_commission_backend(p_tenant_id character varying, p_business_id uuid, p_module_id character varying, p_gross_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.commission_rules%rowtype; v_commission numeric; v_net numeric; v_actor uuid := auth.uid();
begin
 if v_actor is null or coalesce(auth.jwt()->>'is_anonymous','false') = 'true' then
   raise exception 'UNAUTHENTICATED';
 end if;
 if nullif(trim(coalesce(p_tenant_id,'')), '') is null then
   raise exception 'TENANT_REQUIRED';
 end if;
 if p_gross_amount is null or p_gross_amount < 0
    or p_gross_amount::text in ('NaN','Infinity','-Infinity') then
   raise exception 'INVALID_GROSS_AMOUNT';
 end if;
 if p_business_id is not null and not exists (
   select 1 from public.businesses b
   where b.id = p_business_id and b.tenant_id = p_tenant_id
 ) then
   raise exception 'BUSINESS_TENANT_MISMATCH';
 end if;
 if not public.mnty_can_platform_admin() and not exists (
   select 1
   from public.user_memberships m
   where m.user_id = v_actor
     and m.tenant_id = p_tenant_id
     and m.status = 'ACTIVE'
     and upper(m.role::text) in (
       'ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER',
       'ACCOUNTANT','FINANCE_MANAGER','FINANCE'
     )
     and (
       (m.business_id is null and m.branch_id is null)
       or (
         p_business_id is not null
         and m.business_id = p_business_id
         and m.branch_id is null
       )
     )
 ) then
   raise exception 'FINANCE_SCOPE_REQUIRED';
 end if;
 select * into r from public.commission_rules
 where tenant_id=p_tenant_id and active=true
 and (business_id=p_business_id or business_id is null)
 and (module_id=p_module_id or module_id is null)
 order by case when business_id=p_business_id then 0 else 1 end,
          case when module_id=p_module_id then 0 else 1 end,
          updated_at desc limit 1;
 if not found then raise exception 'COMMISSION_RULE_NOT_CONFIGURED'; end if;
 if upper(coalesce(r.rule_type,'PERCENTAGE'))<>'PERCENTAGE' then raise exception 'COMMISSION_RULE_TYPE_UNSUPPORTED_FOR_ORDER_FLOW'; end if;
 if coalesce(r.percentage,0)<0 or coalesce(r.percentage,0)>100 then raise exception 'COMMISSION_RULE_INVALID'; end if;
 v_commission=round(p_gross_amount*coalesce(r.percentage,0)/100,2); v_net=round(p_gross_amount-v_commission,2);
 return jsonb_build_object('rule_id',r.id,'module_id',r.module_id,'rate_percent',r.percentage,'gross_amount',p_gross_amount,'commission_amount',v_commission,'provider_net_amount',v_net);
end $function$;

REVOKE ALL ON FUNCTION public.preview_commission_backend(character varying, uuid, character varying, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_commission_backend(character varying, uuid, character varying, numeric) TO authenticated;
COMMENT ON FUNCTION public.preview_commission_backend(character varying, uuid, character varying, numeric) IS
  'RC467: active commission preview requires tenant-wide finance scope or exact business-level finance scope; branch-scoped actors are denied because no branch is supplied.';

COMMIT;
