-- RC452: flexible commission rule draft registry.
-- Existing active/legacy rules remain unchanged. New rules are drafts and inactive;
-- they cannot affect orders until the calculation engine and event scopes are verified.

alter table public.commission_rules
  add column if not exists rule_name text,
  add column if not exists rule_description text,
  add column if not exists calculation_mode text not null default 'LEGACY',
  add column if not exists scope_type text not null default 'TENANT',
  add column if not exists scope_ref text,
  add column if not exists eligibility_event text not null default 'UNSPECIFIED',
  add column if not exists minimum_commission_amount numeric,
  add column if not exists maximum_commission_amount numeric,
  add column if not exists rule_priority integer not null default 100,
  add column if not exists effective_from timestamptz,
  add column if not exists effective_to timestamptz,
  add column if not exists is_exempt boolean not null default false,
  add column if not exists approval_status text not null default 'LEGACY',
  add column if not exists version_no integer not null default 1,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.commission_rules
  drop constraint if exists commission_rules_calculation_mode_check,
  add constraint commission_rules_calculation_mode_check
    check (calculation_mode in ('LEGACY','PERCENTAGE','FIXED','COMBINED')),
  drop constraint if exists commission_rules_scope_type_check,
  add constraint commission_rules_scope_type_check
    check (scope_type in ('TENANT','BUSINESS','CATEGORY','PRODUCT','SERVICE','PLAN','AGREEMENT')),
  drop constraint if exists commission_rules_eligibility_event_check,
  add constraint commission_rules_eligibility_event_check
    check (eligibility_event in ('UNSPECIFIED','ORDER_PAID','ORDER_COMPLETED','SERVICE_COMPLETED','SUBSCRIPTION_PAID','PROMOTION_REDEEMED')),
  drop constraint if exists commission_rules_approval_status_check,
  add constraint commission_rules_approval_status_check
    check (approval_status in ('LEGACY','DRAFT','PENDING_APPROVAL','APPROVED','REJECTED')),
  drop constraint if exists commission_rules_priority_check,
  add constraint commission_rules_priority_check
    check (rule_priority between 0 and 10000),
  drop constraint if exists commission_rules_minimum_check,
  add constraint commission_rules_minimum_check
    check (minimum_commission_amount is null or minimum_commission_amount >= 0),
  drop constraint if exists commission_rules_maximum_check,
  add constraint commission_rules_maximum_check
    check (maximum_commission_amount is null or maximum_commission_amount >= 0),
  drop constraint if exists commission_rules_amount_range_check,
  add constraint commission_rules_amount_range_check
    check (minimum_commission_amount is null or maximum_commission_amount is null or minimum_commission_amount <= maximum_commission_amount),
  drop constraint if exists commission_rules_effective_period_check,
  add constraint commission_rules_effective_period_check
    check (effective_from is null or effective_to is null or effective_from <= effective_to),
  drop constraint if exists commission_rules_scope_ref_check,
  add constraint commission_rules_scope_ref_check
    check (scope_type = 'TENANT' or nullif(trim(scope_ref), '') is not null);

create index if not exists idx_commission_rules_scope_priority
  on public.commission_rules (tenant_id, active, scope_type, rule_priority desc, updated_at desc);
create index if not exists idx_commission_rules_effective_window
  on public.commission_rules (tenant_id, effective_from, effective_to);

create table if not exists public.commission_rule_audit (
  id uuid primary key default gen_random_uuid(),
  commission_rule_id varchar,
  tenant_id varchar not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_commission_rule_audit_tenant_created
  on public.commission_rule_audit (tenant_id, created_at desc);
create index if not exists idx_commission_rule_audit_rule_created
  on public.commission_rule_audit (commission_rule_id, created_at desc);

alter table public.commission_rule_audit enable row level security;
alter table public.commission_rule_audit force row level security;
revoke all on public.commission_rule_audit from public, anon, authenticated;

create or replace function public.capture_commission_rule_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if TG_OP = 'INSERT' then
    insert into public.commission_rule_audit(commission_rule_id, tenant_id, actor_user_id, action, new_values)
    values (new.id, new.tenant_id, auth.uid(), 'INSERT',
      to_jsonb(new) - 'created_by' - 'updated_by');
    return new;
  elsif TG_OP = 'UPDATE' then
    insert into public.commission_rule_audit(commission_rule_id, tenant_id, actor_user_id, action, old_values, new_values)
    values (new.id, new.tenant_id, auth.uid(), 'UPDATE',
      to_jsonb(old) - 'created_by' - 'updated_by',
      to_jsonb(new) - 'created_by' - 'updated_by');
    return new;
  else
    insert into public.commission_rule_audit(commission_rule_id, tenant_id, actor_user_id, action, old_values)
    values (old.id, old.tenant_id, auth.uid(), 'DELETE',
      to_jsonb(old) - 'created_by' - 'updated_by');
    return old;
  end if;
end;
$function$;

drop trigger if exists trg_commission_rules_audit on public.commission_rules;
create trigger trg_commission_rules_audit
after insert or update or delete on public.commission_rules
for each row execute function public.capture_commission_rule_audit();

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
  v_can_manage_tenant boolean;
begin
  if v_actor is null or coalesce(auth.jwt()->>'is_anonymous','false') = 'true' then
    raise exception 'AUTH_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_tenant_id,'')), '') is null then
    raise exception 'TENANT_REQUIRED';
  end if;

  select exists (
    select 1 from public.user_memberships m
    where m.user_id = v_actor and m.status = 'ACTIVE'
      and upper(m.role::text) = 'SUPER_ADMIN'
      and m.business_id is null and m.branch_id is null
      and coalesce(m.permissions->>'scope','') = 'PLATFORM'
      and coalesce((m.permissions->>'full_control')::boolean,false) = true
  ) into v_is_platform_admin;

  select exists (
    select 1 from public.user_memberships m
    where m.user_id = v_actor and m.tenant_id = p_tenant_id and m.status = 'ACTIVE'
      and upper(m.role::text) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER')
  ) into v_can_manage_tenant;

  if not v_is_platform_admin and not v_can_manage_tenant then
    raise exception 'COMMISSION_RULE_FORBIDDEN';
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

revoke all on function public.mnty_commission_rule_drafts(text, varchar, varchar, jsonb) from public, anon;
grant execute on function public.mnty_commission_rule_drafts(text, varchar, varchar, jsonb) to authenticated;

comment on function public.mnty_commission_rule_drafts(text, varchar, varchar, jsonb) is
'Maintains tenant-scoped, auditable commission rule drafts. New rules are always inactive; financial activation requires separate engine integration and verification.';
