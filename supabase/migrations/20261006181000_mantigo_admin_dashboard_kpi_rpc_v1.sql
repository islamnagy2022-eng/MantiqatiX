-- Secure admin/operations KPI boundary for MantiGO
create or replace function public.get_mantigo_admin_dashboard_backend(p_admin_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
 if v_user is null or p_admin_user_id is null or v_user<>p_admin_user_id then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 if not exists(select 1 from public.user_memberships where user_id=v_user and status='ACTIVE' and upper(role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','MANAGER','OPERATIONS','OPERATIONS_MANAGER')) then raise exception 'OPERATIONS_ROLE_REQUIRED'; end if;
 select jsonb_build_object(
  'rides_total',count(*),'open_requests',count(*) filter(where status in('OPEN','OPEN_FOR_BIDS','MATCHING')),
  'accepted',count(*) filter(where status='ACCEPTED'),'arrived',count(*) filter(where status='ARRIVED'),
  'started',count(*) filter(where status='STARTED'),'in_progress',count(*) filter(where status='IN_PROGRESS'),
  'completed',count(*) filter(where status='COMPLETED'),'cancelled',count(*) filter(where status='CANCELLED'),
  'failed',count(*) filter(where status='FAILED'),'show_no',count(*) filter(where status='SHOW_NO'),'expired',count(*) filter(where status='EXPIRED'),
  'revenue',coalesce((select sum(gross_amount) from public.mantigo_financial_ledger),0),
  'commission',coalesce((select sum(commission_amount) from public.mantigo_financial_ledger),0),
  'captain_earnings',coalesce((select sum(captain_net_amount) from public.mantigo_financial_ledger),0),
  'paid',coalesce((select sum(gross_amount) from public.mantigo_financial_ledger where payment_status in('PAID','CASH_CONFIRMED')),0),
  'unsettled',coalesce((select sum(captain_net_amount) from public.mantigo_financial_ledger where settlement_status in('READY','HELD')),0)
 ) into v_result from public.mantigo_rides;
 return v_result;
end $$;
revoke all on function public.get_mantigo_admin_dashboard_backend(uuid) from public,anon;
grant execute on function public.get_mantigo_admin_dashboard_backend(uuid) to authenticated;
