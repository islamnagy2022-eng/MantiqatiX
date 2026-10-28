-- RC456: read-only scope/priority resolution preview for inactive commission drafts.
-- Candidate rules are previewed only; this routine never activates or posts a commission.

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
  v_tenant_manager boolean := false;
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

  select exists (
    select 1 from public.user_memberships m
    where m.user_id = v_actor
      and m.status = 'ACTIVE'
      and upper(m.role::text) = 'SUPER_ADMIN'
      and m.business_id is null
      and m.branch_id is null
      and coalesce(m.permissions->>'scope','') = 'PLATFORM'
      and coalesce((m.permissions->>'full_control')::boolean,false) = true
  ) into v_platform_admin;

  select exists (
    select 1 from public.user_memberships m
    where m.user_id = v_actor
      and m.tenant_id = p_tenant_id
      and m.status = 'ACTIVE'
      and upper(m.role::text) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER')
  ) into v_tenant_manager;

  if not v_platform_admin and not v_tenant_manager then
    raise exception 'COMMISSION_RULE_FORBIDDEN';
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
          and v_context_scope not in ('CATEGORY','BUSINESS')
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

revoke all on function public.preview_commission_rule_resolution(varchar, uuid, varchar, text, text, text, text, numeric) from public, anon;
grant execute on function public.preview_commission_rule_resolution(varchar, uuid, varchar, text, text, text, numeric) to authenticated;

comment on function public.preview_commission_rule_resolution(varchar, uuid, varchar, text, text, text, numeric) is
'Read-only scope/priority simulation across inactive commission drafts. Uses explicit priority, scope specificity, updated timestamp, then stable rule id; never participates in payments.';
