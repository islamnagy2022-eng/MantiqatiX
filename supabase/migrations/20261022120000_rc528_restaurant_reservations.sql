-- RC528: branch-scoped restaurant reservations with serialized table availability checks.
create table if not exists public.restaurant_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id character varying not null,
  business_id uuid not null,
  branch_id character varying not null,
  table_id text not null references public.restaurant_tables(id) on delete restrict,
  customer_name text not null check (length(trim(customer_name)) between 1 and 120),
  customer_phone text not null default '' check (length(customer_phone) <= 20),
  guest_count integer not null check (guest_count > 0 and guest_count <= 100),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'PENDING'
    check (status in ('PENDING','CONFIRMED','CANCELLED','SEATED','NO_SHOW')),
  notes text not null default '' check (length(notes) <= 1000),
  idempotency_key text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_reservations_time_order check (ends_at > starts_at),
  constraint restaurant_reservations_idempotency_unique
    unique (tenant_id,business_id,branch_id,idempotency_key)
);

create index if not exists restaurant_reservations_table_time_idx
  on public.restaurant_reservations
  (tenant_id,business_id,branch_id,table_id,starts_at,ends_at)
  where status in ('PENDING','CONFIRMED','SEATED');

alter table public.restaurant_reservations enable row level security;
alter table public.restaurant_reservations force row level security;
revoke all on table public.restaurant_reservations from public, anon, authenticated;
grant select on table public.restaurant_reservations to authenticated;

create policy restaurant_reservations_membership_select
on public.restaurant_reservations
for select to authenticated
using (
  coalesce(((auth.jwt()->>'is_anonymous')::boolean),false)=false
  and exists (
    select 1 from public.user_memberships m
    where m.user_id=(select auth.uid())
      and m.status='ACTIVE'
      and m.tenant_id=restaurant_reservations.tenant_id
      and m.business_id=restaurant_reservations.business_id
      and m.branch_id=restaurant_reservations.branch_id
      and upper(m.role) in (
        'OWNER','ADMIN','BUSINESS_OWNER','MANAGER','STAFF','EMPLOYEE',
        'SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS'
      )
  )
);

create or replace function public.restaurant_reservation_mutate(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_action text := upper(trim(coalesce(p_action,'')));
  v_tenant character varying;
  v_business uuid;
  v_branch character varying;
  v_table_id text;
  v_reservation_id uuid;
  v_name text;
  v_phone text;
  v_notes text;
  v_key text;
  v_guests integer;
  v_start timestamptz;
  v_end timestamptz;
  v_table public.restaurant_tables%rowtype;
  v_existing public.restaurant_reservations%rowtype;
  v_reservation public.restaurant_reservations%rowtype;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) <> 'object' then raise exception 'INVALID_PAYLOAD'; end if;
  v_tenant := nullif(trim(p_payload->>'tenant_id'),'');
  v_business := nullif(trim(p_payload->>'business_id'),'')::uuid;
  v_branch := nullif(trim(p_payload->>'branch_id'),'');
  if v_tenant is null or v_business is null or v_branch is null then raise exception 'INVALID_SCOPE'; end if;

  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=v_actor and m.status='ACTIVE'
      and m.tenant_id=v_tenant and m.business_id=v_business and m.branch_id=v_branch
      and upper(m.role) in (
        'OWNER','ADMIN','BUSINESS_OWNER','MANAGER','STAFF','EMPLOYEE',
        'SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS'
      )
  ) then raise exception 'ACTIVE_RESTAURANT_MEMBERSHIP_REQUIRED'; end if;

  if v_action='CREATE' then
    v_table_id := nullif(trim(p_payload->>'table_id'),'');
    v_name := trim(coalesce(p_payload->>'customer_name',''));
    v_phone := trim(coalesce(p_payload->>'customer_phone',''));
    v_notes := left(trim(coalesce(p_payload->>'notes','')),1000);
    v_key := trim(coalesce(p_payload->>'idempotency_key',''));
    if length(v_key)<16 or length(v_key)>128 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_tenant||':'||v_business::text||':'||v_branch||':'||v_key,0));
    if v_table_id is null or length(v_name) not between 1 and 120 or length(v_phone)>20
      or (v_phone<>'' and v_phone !~ '^[+0-9()[:space:]-]{7,20}$') then
      raise exception 'INVALID_RESERVATION_CUSTOMER_OR_TABLE';
    end if;
    if coalesce(p_payload->>'guest_count','') !~ '^[0-9]{1,3}
    if v_guests<1 or v_guests>100 then raise exception 'INVALID_GUEST_COUNT'; end if;
    begin
      v_start := (p_payload->>'starts_at')::timestamptz;
      v_end := (p_payload->>'ends_at')::timestamptz;
    exception when others then raise exception 'INVALID_RESERVATION_TIME'; end;
    if v_start < now() - interval '5 minutes' or v_start > now() + interval '180 days'
      or v_end <= v_start or v_end > v_start + interval '8 hours' then
      raise exception 'INVALID_RESERVATION_TIME_RANGE';
    end if;

    -- Lock the physical table row. Concurrent creates for this table serialize here.
    select t.* into v_table from public.restaurant_tables t
    where t.id=v_table_id and t.tenant_id=v_tenant and t.business_id=v_business and t.branch_id=v_branch
    for update;
    if not found then raise exception 'RESTAURANT_TABLE_NOT_FOUND'; end if;
    if v_guests > v_table.capacity_persons then raise exception 'GUEST_COUNT_EXCEEDS_TABLE_CAPACITY'; end if;

    select r.* into v_existing from public.restaurant_reservations r
    where r.tenant_id=v_tenant and r.business_id=v_business and r.branch_id=v_branch
      and r.idempotency_key=v_key;
    if found then
      if v_existing.table_id is distinct from v_table_id
        or v_existing.customer_name is distinct from v_name
        or v_existing.customer_phone is distinct from v_phone
        or v_existing.guest_count is distinct from v_guests
        or v_existing.starts_at is distinct from v_start
        or v_existing.ends_at is distinct from v_end
        or v_existing.notes is distinct from v_notes
        or v_existing.created_by is distinct from v_actor then
        raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RESERVATION';
      end if;
      return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'idempotent_replay',true);
    end if;

    if exists (
      select 1 from public.restaurant_reservations r
      where r.tenant_id=v_tenant and r.business_id=v_business and r.branch_id=v_branch
        and r.table_id=v_table_id and r.status in ('PENDING','CONFIRMED','SEATED')
        and r.starts_at < v_end and r.ends_at > v_start
    ) then raise exception 'RESTAURANT_TABLE_TIME_CONFLICT'; end if;

    insert into public.restaurant_reservations
      (tenant_id,business_id,branch_id,table_id,customer_name,customer_phone,guest_count,starts_at,ends_at,status,notes,idempotency_key,created_by)
    values
      (v_tenant,v_business,v_branch,v_table_id,v_name,v_phone,v_guests,v_start,v_end,'PENDING',v_notes,v_key,v_actor)
    returning * into v_reservation;
    return jsonb_build_object('id',v_reservation.id,'status',v_reservation.status,'idempotent_replay',false);
  elsif v_action in ('CONFIRM','SEAT','NO_SHOW') then
    begin v_reservation_id := (p_payload->>'reservation_id')::uuid;
    exception when others then raise exception 'INVALID_RESERVATION_ID'; end;
    select r.* into v_reservation from public.restaurant_reservations r
    where r.id=v_reservation_id and r.tenant_id=v_tenant and r.business_id=v_business and r.branch_id=v_branch
    for update;
    if not found then raise exception 'RESTAURANT_RESERVATION_NOT_FOUND'; end if;
    if (v_action='CONFIRM' and v_reservation.status<>'PENDING')
      or (v_action='SEAT' and v_reservation.status<>'CONFIRMED')
      or (v_action='NO_SHOW' and v_reservation.status not in ('PENDING','CONFIRMED')) then
      raise exception 'INVALID_RESERVATION_TRANSITION';
    end if;
    update public.restaurant_reservations
      set status=case v_action when 'CONFIRM' then 'CONFIRMED' when 'SEAT' then 'SEATED' else 'NO_SHOW' end,
          updated_at=now()
      where id=v_reservation.id returning * into v_reservation;
    return jsonb_build_object('id',v_reservation.id,'status',v_reservation.status,'idempotent_replay',false);
  elsif v_action='CANCEL' then
    begin v_reservation_id := (p_payload->>'reservation_id')::uuid;
    exception when others then raise exception 'INVALID_RESERVATION_ID'; end;
    select r.* into v_reservation from public.restaurant_reservations r
    where r.id=v_reservation_id and r.tenant_id=v_tenant and r.business_id=v_business and r.branch_id=v_branch
    for update;
    if not found then raise exception 'RESTAURANT_RESERVATION_NOT_FOUND'; end if;
    if v_reservation.status in ('CANCELLED','NO_SHOW') then
      return jsonb_build_object('id',v_reservation.id,'status',v_reservation.status,'idempotent_replay',true);
    end if;
    if v_reservation.status='SEATED' then raise exception 'SEATED_RESERVATION_CANNOT_BE_CANCELLED'; end if;
    update public.restaurant_reservations set status='CANCELLED',updated_at=now()
    where id=v_reservation.id returning * into v_reservation;
    return jsonb_build_object('id',v_reservation.id,'status',v_reservation.status,'idempotent_replay',false);
  else
    raise exception 'UNSUPPORTED_RESERVATION_ACTION';
  end if;
end;
$function$;

revoke all on function public.restaurant_reservation_mutate(text,jsonb) from public, anon, authenticated;
grant execute on function public.restaurant_reservation_mutate(text,jsonb) to authenticated;
 then raise exception 'INVALID_GUEST_COUNT'; end if;
    v_guests := (p_payload->>'guest_count')::integer;
    if v_guests<1 or v_guests>100 then raise exception 'INVALID_GUEST_COUNT'; end if;
    begin
      v_start := (p_payload->>'starts_at')::timestamptz;
      v_end := (p_payload->>'ends_at')::timestamptz;
    exception when others then raise exception 'INVALID_RESERVATION_TIME'; end;
    if v_start < now() - interval '5 minutes' or v_start > now() + interval '180 days'
      or v_end <= v_start or v_end > v_start + interval '8 hours' then
      raise exception 'INVALID_RESERVATION_TIME_RANGE';
    end if;

    -- Lock the physical table row. Concurrent creates for this table serialize here.
    select t.* into v_table from public.restaurant_tables t
    where t.id=v_table_id and t.tenant_id=v_tenant and t.business_id=v_business and t.branch_id=v_branch
    for update;
    if not found then raise exception 'RESTAURANT_TABLE_NOT_FOUND'; end if;
    if v_guests > v_table.capacity_persons then raise exception 'GUEST_COUNT_EXCEEDS_TABLE_CAPACITY'; end if;

    select r.* into v_existing from public.restaurant_reservations r
    where r.tenant_id=v_tenant and r.business_id=v_business and r.branch_id=v_branch
      and r.idempotency_key=v_key;
    if found then
      if v_existing.table_id is distinct from v_table_id
        or v_existing.customer_name is distinct from v_name
        or v_existing.customer_phone is distinct from v_phone
        or v_existing.guest_count is distinct from v_guests
        or v_existing.starts_at is distinct from v_start
        or v_existing.ends_at is distinct from v_end
        or v_existing.notes is distinct from v_notes
        or v_existing.created_by is distinct from v_actor then
        raise exception 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RESERVATION';
      end if;
      return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'idempotent_replay',true);
    end if;

    if exists (
      select 1 from public.restaurant_reservations r
      where r.tenant_id=v_tenant and r.business_id=v_business and r.branch_id=v_branch
        and r.table_id=v_table_id and r.status in ('PENDING','CONFIRMED','SEATED')
        and r.starts_at < v_end and r.ends_at > v_start
    ) then raise exception 'RESTAURANT_TABLE_TIME_CONFLICT'; end if;

    insert into public.restaurant_reservations
      (tenant_id,business_id,branch_id,table_id,customer_name,customer_phone,guest_count,starts_at,ends_at,status,notes,idempotency_key,created_by)
    values
      (v_tenant,v_business,v_branch,v_table_id,v_name,v_phone,v_guests,v_start,v_end,'PENDING',v_notes,v_key,v_actor)
    returning * into v_reservation;
    return jsonb_build_object('id',v_reservation.id,'status',v_reservation.status,'idempotent_replay',false);
  elsif v_action in ('CONFIRM','SEAT','NO_SHOW') then
    begin v_reservation_id := (p_payload->>'reservation_id')::uuid;
    exception when others then raise exception 'INVALID_RESERVATION_ID'; end;
    select r.* into v_reservation from public.restaurant_reservations r
    where r.id=v_reservation_id and r.tenant_id=v_tenant and r.business_id=v_business and r.branch_id=v_branch
    for update;
    if not found then raise exception 'RESTAURANT_RESERVATION_NOT_FOUND'; end if;
    if (v_action='CONFIRM' and v_reservation.status<>'PENDING')
      or (v_action='SEAT' and v_reservation.status<>'CONFIRMED')
      or (v_action='NO_SHOW' and v_reservation.status not in ('PENDING','CONFIRMED')) then
      raise exception 'INVALID_RESERVATION_TRANSITION';
    end if;
    update public.restaurant_reservations
      set status=case v_action when 'CONFIRM' then 'CONFIRMED' when 'SEAT' then 'SEATED' else 'NO_SHOW' end,
          updated_at=now()
      where id=v_reservation.id returning * into v_reservation;
    return jsonb_build_object('id',v_reservation.id,'status',v_reservation.status,'idempotent_replay',false);
  elsif v_action='CANCEL' then
    begin v_reservation_id := (p_payload->>'reservation_id')::uuid;
    exception when others then raise exception 'INVALID_RESERVATION_ID'; end;
    select r.* into v_reservation from public.restaurant_reservations r
    where r.id=v_reservation_id and r.tenant_id=v_tenant and r.business_id=v_business and r.branch_id=v_branch
    for update;
    if not found then raise exception 'RESTAURANT_RESERVATION_NOT_FOUND'; end if;
    if v_reservation.status in ('CANCELLED','NO_SHOW') then
      return jsonb_build_object('id',v_reservation.id,'status',v_reservation.status,'idempotent_replay',true);
    end if;
    if v_reservation.status='SEATED' then raise exception 'SEATED_RESERVATION_CANNOT_BE_CANCELLED'; end if;
    update public.restaurant_reservations set status='CANCELLED',updated_at=now()
    where id=v_reservation.id returning * into v_reservation;
    return jsonb_build_object('id',v_reservation.id,'status',v_reservation.status,'idempotent_replay',false);
  else
    raise exception 'UNSUPPORTED_RESERVATION_ACTION';
  end if;
end;
$function$;

revoke all on function public.restaurant_reservation_mutate(text,jsonb) from public, anon, authenticated;
grant execute on function public.restaurant_reservation_mutate(text,jsonb) to authenticated;
