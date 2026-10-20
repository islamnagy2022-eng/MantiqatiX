-- RC463: supplier master data shared by ERP procurement and inventory receiving.
create table if not exists public.erp_suppliers (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar,
  supplier_code varchar,
  name_ar text not null,
  name_en text,
  contact_name text,
  phone text,
  email text,
  tax_number text,
  payment_terms text,
  status varchar not null default 'ACTIVE',
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_suppliers_name_ar_nonempty check (length(btrim(name_ar)) > 0),
  constraint erp_suppliers_status_valid check (status in ('ACTIVE','INACTIVE','ARCHIVED'))
);
-- Upgrade older partial supplier tables created by prior module versions or disposable fixtures.
alter table public.erp_suppliers add column if not exists branch_id varchar;
alter table public.erp_suppliers add column if not exists supplier_code varchar;
alter table public.erp_suppliers add column if not exists name_en text;
alter table public.erp_suppliers add column if not exists contact_name text;
alter table public.erp_suppliers add column if not exists phone text;
alter table public.erp_suppliers add column if not exists email text;
alter table public.erp_suppliers add column if not exists tax_number text;
alter table public.erp_suppliers add column if not exists payment_terms text;
alter table public.erp_suppliers add column if not exists notes text;
alter table public.erp_suppliers add column if not exists created_at timestamptz not null default now();
alter table public.erp_suppliers add column if not exists updated_at timestamptz not null default now();

create unique index if not exists erp_suppliers_business_code_uq
  on public.erp_suppliers(tenant_id,business_id,lower(supplier_code))
  where supplier_code is not null and btrim(supplier_code) <> '';
create index if not exists erp_suppliers_scope_status_idx
  on public.erp_suppliers(tenant_id,business_id,status,branch_id);

alter table public.erp_suppliers enable row level security;
alter table public.erp_suppliers force row level security;
revoke all on table public.erp_suppliers from public, anon, authenticated;
grant select,insert,update,delete on table public.erp_suppliers to service_role;

create or replace function public.erp_supplier_create_backend(
  p_actor_user_id uuid,
  p_arguments jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_tenant_id text := nullif(p_arguments->>'p_tenant_id','');
  v_business_id uuid := nullif(p_arguments->>'p_business_id','')::uuid;
  v_branch_id text := nullif(p_arguments->>'p_branch_id','');
  v_id text := coalesce(nullif(p_arguments->>'p_id',''),'sup-'||gen_random_uuid()::text);
  v_code text := nullif(btrim(p_arguments->>'p_supplier_code'),'');
  v_name_ar text := btrim(coalesce(p_arguments->>'p_name_ar',''));
  v_role text;
  v_member_branch text;
  v_row public.erp_suppliers%rowtype;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_arguments is null or jsonb_typeof(p_arguments) <> 'object' then raise exception 'INVALID_ARGUMENTS'; end if;
  if coalesce(v_tenant_id,'')='' or v_business_id is null or v_name_ar='' then
    raise exception 'ERP_SUPPLIER_REQUIRED_FIELDS';
  end if;

  select upper(m.role),m.branch_id::text into v_role,v_member_branch
  from public.user_memberships m
  where m.user_id=p_actor_user_id and m.tenant_id::text=v_tenant_id
    and m.business_id=v_business_id and m.status='ACTIVE'
  order by case upper(m.role) when 'OWNER' then 1 when 'BUSINESS_OWNER' then 2 when 'ADMIN' then 3 when 'MANAGER' then 4 else 5 end,
           case when m.branch_id is null then 0 else 1 end
  limit 1;
  if v_role is null then raise exception 'ERP_MEMBERSHIP_REQUIRED'; end if;
  if v_role not in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','ACCOUNTANT','FINANCE_MANAGER','FINANCE') then
    raise exception 'ERP_SUPPLIER_CREATE_ROLE_REQUIRED';
  end if;
  if v_member_branch is not null and v_branch_id is distinct from v_member_branch then
    raise exception 'ERP_BRANCH_SCOPE_REQUIRED';
  end if;
  if v_branch_id is not null and not exists (
    select 1 from public.branches b where b.id=v_branch_id and b.tenant_id::text=v_tenant_id
      and b.business_id=v_business_id and upper(b.status)='ACTIVE'
  ) then raise exception 'ERP_BRANCH_SCOPE_REQUIRED'; end if;

  insert into public.erp_suppliers(
    id,tenant_id,business_id,branch_id,supplier_code,name_ar,name_en,contact_name,phone,email,
    tax_number,payment_terms,status,notes,created_by
  ) values (
    v_id,v_tenant_id,v_business_id,v_branch_id,v_code,v_name_ar,
    nullif(btrim(p_arguments->>'p_name_en'),''),nullif(btrim(p_arguments->>'p_contact_name'),''),
    nullif(btrim(p_arguments->>'p_phone'),''),nullif(lower(btrim(p_arguments->>'p_email')),''),
    nullif(btrim(p_arguments->>'p_tax_number'),''),nullif(btrim(p_arguments->>'p_payment_terms'),''),
    'ACTIVE',nullif(btrim(p_arguments->>'p_notes'),''),p_actor_user_id
  ) on conflict (id) do nothing returning * into v_row;

  if not found then
    select * into v_row from public.erp_suppliers s
    where s.id=v_id and s.tenant_id=v_tenant_id and s.business_id=v_business_id;
    if not found then raise exception 'ERP_SUPPLIER_IDEMPOTENCY_SCOPE_CONFLICT'; end if;
    if v_row.name_ar is distinct from v_name_ar
       or v_row.supplier_code is distinct from v_code
       or v_row.branch_id is distinct from v_branch_id then
      raise exception 'ERP_SUPPLIER_IDEMPOTENCY_CONFLICT';
    end if;
  end if;
  return jsonb_build_object('success',true,'supplier',to_jsonb(v_row));
exception
  when unique_violation then raise exception 'ERP_SUPPLIER_CODE_ALREADY_EXISTS';
end;
$function$;

revoke all on function public.erp_supplier_create_backend(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.erp_supplier_create_backend(uuid,jsonb) to service_role;
