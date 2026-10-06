-- MantiGO trip/payment state hardening v1.
-- Prevents trip start/completion before confirmed payment and records status transitions in the audit log.

create or replace function public.update_mantigo_trip_status_backend(
  p_user_id uuid,
  p_ride_id text,
  p_target_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_status text;
  v_customer uuid;
  v_driver uuid;
  v_target text := upper(trim(p_target_status));
  v_ok boolean := false;
  v_payment_status text;
  v_financial_exists boolean := false;
begin
  if p_user_id is null or p_user_id <> auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;

  select r.status,r.customer_id,b.captain_id
    into v_status,v_customer,v_driver
  from public.mantigo_rides r
  left join public.mantigo_bids b on b.id=r.accepted_bid_id
  where r.id=p_ride_id
  for update;

  if v_status is null then raise exception 'RIDE_NOT_FOUND'; end if;

  select f.payment_status into v_payment_status
  from public.mantigo_financial_ledger f
  where f.ride_id=p_ride_id;
  v_financial_exists := found;

  if p_user_id=v_customer then
    v_ok :=
      (v_status='OPEN' and v_target in ('OPEN_FOR_BIDS','CANCELLED','EXPIRED'))
      or (v_status='OPEN_FOR_BIDS' and v_target in ('MATCHING','CANCELLED','EXPIRED'))
      or (v_status='MATCHING' and v_target='ACCEPTED');
  elsif p_user_id=v_driver then
    v_ok :=
      (v_status='ACCEPTED' and v_target='ARRIVED')
      or (v_status='ARRIVED' and v_target='STARTED' and v_financial_exists and v_payment_status in ('PAID','CASH_CONFIRMED'))
      or (v_status='STARTED' and v_target='IN_PROGRESS')
      or (v_status='IN_PROGRESS' and v_target='COMPLETED' and v_financial_exists and v_payment_status in ('PAID','CASH_CONFIRMED'))
      or (v_status in ('ACCEPTED','ARRIVED','STARTED','IN_PROGRESS') and v_target in ('FAILED','SHOW_NO'))
      or (v_status in ('ACCEPTED','ARRIVED') and v_target='CANCELLED');
  else
    raise exception 'TRIP_ACTOR_FORBIDDEN';
  end if;

  if not v_ok then
    if p_user_id=v_driver and v_target in ('STARTED','COMPLETED')
       and (not v_financial_exists or v_payment_status not in ('PAID','CASH_CONFIRMED')) then
      raise exception 'PAYMENT_REQUIRED_BEFORE_TRIP_PROGRESS';
    end if;
    raise exception 'INVALID_TRIP_TRANSITION';
  end if;

  update public.mantigo_rides set status=v_target,updated_at=now() where id=p_ride_id;

  insert into public.audit_logs(
    id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result
  ) values(
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),
    'MNTY-PLATFORM',p_user_id,'MANTIGO_TRIP_STATUS_CHANGED','MANTIGO_RIDE',p_ride_id,
    jsonb_build_object('status',v_status,'payment_status',v_payment_status),
    jsonb_build_object('status',v_target,'reason',p_reason),'SUCCESS'
  );

  return jsonb_build_object('id',p_ride_id,'previous_status',v_status,'status',v_target,'payment_status',v_payment_status,'reason',p_reason);
end $$;

revoke all on function public.update_mantigo_trip_status_backend(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.update_mantigo_trip_status_backend(uuid,text,text,text) to authenticated;
