create or replace function public.get_mantigo_captain_earnings_backend(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_auth uuid := auth.uid();
  v_total bigint;
  v_completed bigint;
  v_cancelled bigint;
  v_failed bigint;
  v_gross numeric := 0;
  v_commission numeric := 0;
  v_net numeric := 0;
  v_settled numeric := 0;
  v_unsettled numeric := 0;
  v_paid bigint := 0;
begin
  if v_auth is null or v_auth <> p_user_id then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.mantigo_captain_profiles where captain_id=p_user_id) then
    raise exception 'CAPTAIN_PROFILE_REQUIRED';
  end if;
  select count(*) into v_total from public.mantigo_rides r where exists (select 1 from public.mantigo_bids b where b.ride_id=r.id and b.captain_id=p_user_id and b.status='ACCEPTED');
  select count(*) into v_completed from public.mantigo_rides r where r.status='COMPLETED' and exists (select 1 from public.mantigo_bids b where b.ride_id=r.id and b.captain_id=p_user_id and b.status='ACCEPTED');
  select count(*) into v_cancelled from public.mantigo_rides r where r.status='CANCELLED' and exists (select 1 from public.mantigo_bids b where b.ride_id=r.id and b.captain_id=p_user_id and b.status='ACCEPTED');
  select count(*) into v_failed from public.mantigo_rides r where r.status in ('FAILED','SHOW_NO') and exists (select 1 from public.mantigo_bids b where b.ride_id=r.id and b.captain_id=p_user_id and b.status='ACCEPTED');
  select coalesce(sum(l.amount),0),coalesce(sum(l.commission_amount),0),coalesce(sum(l.captain_amount),0),
         coalesce(sum(case when l.settlement_status='SETTLED' then l.captain_amount else 0 end),0),
         coalesce(sum(case when l.settlement_status is distinct from 'SETTLED' then l.captain_amount else 0 end),0),
         count(*) filter (where l.payment_status in ('PAID','CASH_CONFIRMED'))
  into v_gross,v_commission,v_net,v_settled,v_unsettled,v_paid
  from public.mantigo_financial_ledger l where l.captain_id=p_user_id;
  return jsonb_build_object('rides_total',v_total,'completed',v_completed,'cancelled',v_cancelled,'failed',v_failed,'gross',v_gross,'commission',v_commission,'net',v_net,'settled',v_settled,'unsettled',v_unsettled,'paid_rides',v_paid);
end;
$$;
revoke all on function public.get_mantigo_captain_earnings_backend(uuid) from public, anon;
grant execute on function public.get_mantigo_captain_earnings_backend(uuid) to authenticated;
