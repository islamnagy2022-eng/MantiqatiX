-- RC441: restrict platform-wide MantiGO administration to an explicitly scoped SUPER_ADMIN.
-- Source-only until reviewed and applied through the approved migration pipeline.
-- The previous mnty_can_platform_admin() delegated to mnty_can('admin', NULL, NULL, NULL),
-- which treats tenant OWNER roles as admin for broad/null scope and is not a platform boundary.

create or replace function public.mnty_can_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.user_memberships m
    where m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and upper(m.role) = 'SUPER_ADMIN'
      and coalesce(m.permissions ->> 'scope' = 'PLATFORM', false)
      and coalesce((m.permissions ->> 'full_control')::boolean, false)
  )
$function$;

revoke all on function public.mnty_can_platform_admin() from public, anon;
grant execute on function public.mnty_can_platform_admin() to authenticated;

-- These RPCs read or mutate platform-wide ride and financial data, not a single tenant.
create or replace function public.get_mantigo_admin_dashboard_backend(p_admin_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null or p_admin_user_id is null or v_user <> p_admin_user_id then
    raise exception 'USER_CONTEXT_MISMATCH';
  end if;
  if not public.mnty_can_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  select pg_catalog.jsonb_build_object(
    'rides_total', count(*),
    'open_requests', count(*) filter (where r.status in ('OPEN','OPEN_FOR_BIDS','MATCHING')),
    'accepted', count(*) filter (where r.status='ACCEPTED'),
    'arrived', count(*) filter (where r.status='ARRIVED'),
    'started', count(*) filter (where r.status='STARTED'),
    'in_progress', count(*) filter (where r.status='IN_PROGRESS'),
    'completed', count(*) filter (where r.status='COMPLETED'),
    'cancelled', count(*) filter (where r.status='CANCELLED'),
    'failed', count(*) filter (where r.status='FAILED'),
    'show_no', count(*) filter (where r.status='SHOW_NO'),
    'expired', count(*) filter (where r.status='EXPIRED'),
    'revenue', coalesce((select sum(l.gross_amount) from public.mantigo_financial_ledger l),0),
    'commission', coalesce((select sum(l.commission_amount) from public.mantigo_financial_ledger l),0),
    'captain_earnings', coalesce((select sum(l.captain_net_amount) from public.mantigo_financial_ledger l),0),
    'paid', coalesce((select sum(l.gross_amount) from public.mantigo_financial_ledger l where l.payment_status in ('PAID','CASH_CONFIRMED')),0),
    'unsettled', coalesce((select sum(l.captain_net_amount) from public.mantigo_financial_ledger l where l.settlement_status in ('READY','HELD')),0)
  ) into v_result
  from public.mantigo_rides r;
  return v_result;
end
$function$;

create or replace function public.get_mantigo_admin_financial_report_backend(
  p_admin_user_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth uuid := auth.uid();
  v_from timestamptz := coalesce(p_from, 'epoch'::timestamptz);
  v_to timestamptz := coalesce(p_to, 'infinity'::timestamptz);
  v_ledger jsonb;
begin
  if v_auth is null or v_auth <> p_admin_user_id then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not public.mnty_can_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  select pg_catalog.jsonb_build_object(
    'ledger_count', count(*),
    'gross', coalesce(sum(l.amount),0),
    'commission', coalesce(sum(l.commission_amount),0),
    'captain_amount', coalesce(sum(l.captain_amount),0),
    'paid_count', count(*) filter (where l.payment_status in ('PAID','CASH_CONFIRMED')),
    'paid_amount', coalesce(sum(l.amount) filter (where l.payment_status in ('PAID','CASH_CONFIRMED')),0),
    'settled_count', count(*) filter (where l.settlement_status='SETTLED'),
    'settled_amount', coalesce(sum(l.captain_amount) filter (where l.settlement_status='SETTLED'),0),
    'unsettled_count', count(*) filter (where l.settlement_status is distinct from 'SETTLED'),
    'unsettled_amount', coalesce(sum(l.captain_amount) filter (where l.settlement_status is distinct from 'SETTLED'),0),
    'from', v_from, 'to', v_to
  ) into v_ledger
  from public.mantigo_financial_ledger l
  where l.created_at >= v_from and l.created_at < v_to;
  return v_ledger;
end
$function$;

create or replace function public.settle_mantigo_captain_backend(
  p_admin_user_id uuid,
  p_ride_id text,
  p_channel text default 'BANK_TRANSFER'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_f public.mantigo_financial_ledger%rowtype;
  v_ride_status text;
  v_result jsonb;
begin
  if p_admin_user_id is null or p_admin_user_id <> auth.uid() then
    raise exception 'USER_CONTEXT_MISMATCH';
  end if;
  if not public.mnty_can_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  select r.status into v_ride_status
  from public.mantigo_rides r
  where r.id = p_ride_id;
  if v_ride_status is null then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride_status <> 'COMPLETED' then raise exception 'RIDE_NOT_COMPLETED'; end if;

  select * into v_f
  from public.mantigo_financial_ledger l
  where l.ride_id = p_ride_id
  for update;
  if not found then raise exception 'FINANCIAL_RECORD_NOT_FOUND'; end if;
  if v_f.payment_status not in ('PAID','CASH_CONFIRMED') then raise exception 'PAYMENT_NOT_CONFIRMED'; end if;
  if v_f.settlement_status = 'SETTLED' then
    return pg_catalog.jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED','settlement_reference',v_f.settlement_reference,'idempotent',true);
  end if;
  if v_f.commission_rate is null then raise exception 'COMMISSION_NOT_LOCKED'; end if;

  v_result := public.create_settlement_and_post_journal(
    'MGO-SET-'||p_ride_id,'MNTY-PLATFORM','PARTNER',v_f.captain_id::text,
    v_f.gross_amount,v_f.commission_amount,v_f.captain_net_amount,0,
    coalesce(nullif(pg_catalog.btrim(p_channel),''),'BANK_TRANSFER'),p_ride_id,null,
    'MantiGO captain settlement for ride '||p_ride_id,p_admin_user_id
  );
  update public.mantigo_financial_ledger
  set settlement_status='SETTLED',settlement_reference='MGO-SET-'||p_ride_id,updated_at=pg_catalog.now()
  where ride_id=p_ride_id;

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
    'MANTIGO_CAPTAIN_SETTLED','MANTIGO_FINANCIAL',v_f.id,
    pg_catalog.jsonb_build_object('settlement_status',v_f.settlement_status),
    pg_catalog.jsonb_build_object('settlement_status','SETTLED','settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result),'SUCCESS');
  begin
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_f.captain_id,
      'MANTIGO_SETTLEMENT','تمت التسوية','تمت تسوية مستحقاتك عن رحلة MantiGO بنجاح.','MANTIGO_RIDE',p_ride_id);
  exception when others then
    insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
    values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
      'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,
      pg_catalog.jsonb_build_object('notification_type','MANTIGO_SETTLEMENT','error',sqlerrm),'PARTIAL');
  end;
  return pg_catalog.jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED',
    'settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result,'idempotent',false);
end
$function$;

create or replace function public.expire_stale_mantigo_rides_backend(
  p_admin_user_id uuid,
  p_age_minutes integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer := 0;
  v_ride record;
begin
  if p_admin_user_id is null or p_admin_user_id <> auth.uid() then
    raise exception 'USER_CONTEXT_MISMATCH';
  end if;
  if not public.mnty_can_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;
  if p_age_minutes is null or p_age_minutes < 1 or p_age_minutes > 10080 then
    raise exception 'INVALID_EXPIRATION_WINDOW';
  end if;

  for v_ride in
    select r.id,r.customer_id,r.status,r.updated_at
    from public.mantigo_rides r
    where r.status in ('OPEN','OPEN_FOR_BIDS') and r.updated_at < pg_catalog.now() - pg_catalog.make_interval(mins=>p_age_minutes)
    for update skip locked
  loop
    update public.mantigo_rides r set status='EXPIRED',updated_at=pg_catalog.now()
    where r.id=v_ride.id and r.status=v_ride.status;
    if found then
      v_count := v_count+1;
      insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
      values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
        'MANTIGO_RIDE_EXPIRED','MANTIGO_RIDE',v_ride.id,
        pg_catalog.jsonb_build_object('status',v_ride.status,'updated_at',v_ride.updated_at),
        pg_catalog.jsonb_build_object('status','EXPIRED','reason','STALE_REQUEST'),'SUCCESS');
      begin
        insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
        values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_ride.customer_id,
          'MANTIGO_EXPIRED','انتهى طلب الرحلة','انتهت مدة طلب الرحلة لعدم اكتمال المطابقة. يمكنك إنشاء طلب جديد.','MANTIGO_RIDE',v_ride.id);
      exception when others then
        insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
        values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
          'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',v_ride.id,'{}'::jsonb,
          pg_catalog.jsonb_build_object('notification_type','MANTIGO_EXPIRED','error',sqlerrm),'PARTIAL');
      end;
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('expired_count',v_count,'age_minutes',p_age_minutes);
end
$function$;

revoke all on function public.get_mantigo_admin_dashboard_backend(uuid) from public, anon;
grant execute on function public.get_mantigo_admin_dashboard_backend(uuid) to authenticated;
revoke all on function public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz) to authenticated;
revoke all on function public.settle_mantigo_captain_backend(uuid,text,text) from public, anon;
grant execute on function public.settle_mantigo_captain_backend(uuid,text,text) to authenticated;
revoke all on function public.expire_stale_mantigo_rides_backend(uuid,integer) from public, anon;
grant execute on function public.expire_stale_mantigo_rides_backend(uuid,integer) to authenticated;

comment on function public.mnty_can_platform_admin() is
  'RC441: platform scope requires an active SUPER_ADMIN membership with PLATFORM scope and full_control; tenant roles are not platform administrators.';
