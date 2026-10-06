create or replace function public.get_mantigo_admin_financial_report_backend(
  p_admin_user_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_auth uuid:=auth.uid();
  v_from timestamptz:=coalesce(p_from,'epoch'::timestamptz);
  v_to timestamptz:=coalesce(p_to,'infinity'::timestamptz);
  v_role text;
  v_ledger jsonb;
begin
  if v_auth is null or v_auth<>p_admin_user_id then raise exception 'AUTH_REQUIRED'; end if;
  select upper(role) into v_role from public.user_memberships
   where user_id=v_auth and status='ACTIVE'
   order by case when upper(role) in ('SUPER_ADMIN','OWNER','BUSINESS_OWNER','ADMIN','OPERATIONS','OPERATIONS_MANAGER') then 0 else 1 end, id
   limit 1;
  if v_role is null or v_role not in ('SUPER_ADMIN','OWNER','BUSINESS_OWNER','ADMIN','OPERATIONS','OPERATIONS_MANAGER') then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;
  select jsonb_build_object(
    'ledger_count',count(*),'gross',coalesce(sum(l.amount),0),
    'commission',coalesce(sum(l.commission_amount),0),
    'captain_amount',coalesce(sum(l.captain_amount),0),
    'paid_count',count(*) filter(where l.payment_status in ('PAID','CASH_CONFIRMED')),
    'paid_amount',coalesce(sum(l.amount) filter(where l.payment_status in ('PAID','CASH_CONFIRMED')),0),
    'settled_count',count(*) filter(where l.settlement_status='SETTLED'),
    'settled_amount',coalesce(sum(l.captain_amount) filter(where l.settlement_status='SETTLED'),0),
    'unsettled_count',count(*) filter(where l.settlement_status is distinct from 'SETTLED'),
    'unsettled_amount',coalesce(sum(l.captain_amount) filter(where l.settlement_status is distinct from 'SETTLED'),0),
    'from',v_from,'to',v_to
  ) into v_ledger
  from public.mantigo_financial_ledger l
  where l.created_at>=v_from and l.created_at<v_to;
  return v_ledger;
end;
$$;
revoke all on function public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz) to authenticated;
