-- RC455: read-only preview for inactive commission-rule drafts.
-- This RPC never activates a rule and never creates orders, commission transactions,
-- obligations, payouts, settlement records, or ledger journals.

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
  v_tenant_manager boolean := false;
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

revoke all on function public.preview_commission_rule_draft(varchar, varchar, numeric) from public, anon;
grant execute on function public.preview_commission_rule_draft(varchar, varchar, numeric) to authenticated;

comment on function public.preview_commission_rule_draft(varchar, varchar, numeric) is
'Read-only simulation for authenticated tenant/platform administrators on inactive DRAFT commission rules; never participates in payment processing.';
