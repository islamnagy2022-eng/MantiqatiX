-- RC530: enforce explicit MNTY-PLATFORM super-admin scope for platform-wide MantiGO dashboard and settlement.
-- Depends on RC528's strict mnty_can_platform_admin() predicate.
-- Candidate only; do not apply until authoritative chronological replay and accounting review are complete.

CREATE OR REPLACE FUNCTION public.get_mantigo_admin_dashboard_backend(p_admin_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
 if v_user is null or p_admin_user_id is null or v_user<>p_admin_user_id then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 if not public.mnty_can_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
 select jsonb_build_object(
  'rides_total',count(*),
  'open_requests',count(*) filter(where status in('OPEN','OPEN_FOR_BIDS','MATCHING')),
  'accepted',count(*) filter(where status='ACCEPTED'),
  'arrived',count(*) filter(where status='ARRIVED'),
  'started',count(*) filter(where status='STARTED'),
  'in_progress',count(*) filter(where status='IN_PROGRESS'),
  'completed',count(*) filter(where status='COMPLETED'),
  'cancelled',count(*) filter(where status='CANCELLED'),
  'failed',count(*) filter(where status='FAILED'),
  'show_no',count(*) filter(where status='SHOW_NO'),
  'expired',count(*) filter(where status='EXPIRED'),
  'revenue',coalesce((select sum(gross_amount) from public.mantigo_financial_ledger),0),
  'commission',coalesce((select sum(commission_amount) from public.mantigo_financial_ledger),0),
  'captain_earnings',coalesce((select sum(captain_net_amount) from public.mantigo_financial_ledger),0),
  'paid',coalesce((select sum(gross_amount) from public.mantigo_financial_ledger where payment_status in('PAID','CASH_CONFIRMED')),0),
  'unsettled',coalesce((select sum(captain_net_amount) from public.mantigo_financial_ledger where settlement_status in('READY','HELD')),0)
 ) into v_result from public.mantigo_rides;
 return v_result;
end $function$
;

revoke all on function public.get_mantigo_admin_dashboard_backend(uuid) from public, anon;
grant execute on function public.get_mantigo_admin_dashboard_backend(uuid) to authenticated;
comment on function public.get_mantigo_admin_dashboard_backend(uuid) is
  'RC530: platform-wide MantiGO dashboard requires active MNTY-PLATFORM SUPER_ADMIN with PLATFORM scope and boolean full_control.';

CREATE OR REPLACE FUNCTION public.settle_mantigo_captain_backend(p_admin_user_id uuid, p_ride_id text, p_channel text DEFAULT 'BANK_TRANSFER'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_f public.mantigo_financial_ledger%rowtype; v_ride_status text; v_result jsonb;
begin
  if p_admin_user_id is null or p_admin_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if not public.mnty_can_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  select status into v_ride_status from public.mantigo_rides where id=p_ride_id;
  if v_ride_status is null then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride_status<>'COMPLETED' then raise exception 'RIDE_NOT_COMPLETED'; end if;
  select * into v_f from public.mantigo_financial_ledger where ride_id=p_ride_id for update;
  if not found then raise exception 'FINANCIAL_RECORD_NOT_FOUND'; end if;
  if v_f.payment_status not in ('PAID','CASH_CONFIRMED') then raise exception 'PAYMENT_NOT_CONFIRMED'; end if;
  if v_f.settlement_status='SETTLED' then return jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED','settlement_reference',v_f.settlement_reference,'idempotent',true); end if;
  if v_f.commission_rate is null then raise exception 'COMMISSION_NOT_LOCKED'; end if;
  v_result:=public.create_settlement_and_post_journal('MGO-SET-'||p_ride_id,'MNTY-PLATFORM','PARTNER',v_f.captain_id::text,v_f.gross_amount,v_f.commission_amount,v_f.captain_net_amount,0,coalesce(nullif(trim(p_channel),''),'BANK_TRANSFER'),p_ride_id,null,'MantiGO captain settlement for ride '||p_ride_id,p_admin_user_id);
  update public.mantigo_financial_ledger set settlement_status='SETTLED',settlement_reference='MGO-SET-'||p_ride_id,updated_at=now() where ride_id=p_ride_id;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,'MANTIGO_CAPTAIN_SETTLED','MANTIGO_FINANCIAL',v_f.id,jsonb_build_object('settlement_status',v_f.settlement_status),jsonb_build_object('settlement_status','SETTLED','settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result),'SUCCESS');
  begin
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_f.captain_id,'MANTIGO_SETTLEMENT','تمت التسوية','تمت تسوية مستحقاتك عن رحلة MantiGO بنجاح.','MANTIGO_RIDE',p_ride_id);
  exception when others then
    insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
    values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,jsonb_build_object('notification_type','MANTIGO_SETTLEMENT','error',sqlerrm),'PARTIAL');
  end;
  return jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED','settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result,'idempotent',false);
end $function$
;

revoke all on function public.settle_mantigo_captain_backend(uuid,text,text) from public, anon;
grant execute on function public.settle_mantigo_captain_backend(uuid,text,text) to authenticated;
comment on function public.settle_mantigo_captain_backend(uuid,text,text) is
  'RC530: MantiGO captain settlement requires strict platform administrator scope; accounting mapping remains separately gated.';
