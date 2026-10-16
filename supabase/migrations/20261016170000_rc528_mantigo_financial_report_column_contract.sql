-- RC528: align the platform MantiGO financial report with canonical ledger columns.
-- Forward-only fix. Do not edit the historical RC449 migration.
-- Apply only after the approved migration chain has been reconciled and replayed.
-- This migration deliberately owns the platform scope predicate so it cannot inherit
-- the older broad/null-scope mnty_can('admin', NULL, NULL, NULL) behavior.
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
      and m.tenant_id = 'MNTY-PLATFORM'
      and m.status = 'ACTIVE'
      and upper(m.role) = 'SUPER_ADMIN'
      and coalesce(m.permissions ->> 'scope' = 'PLATFORM', false)
      and m.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb
  )
$function$;

revoke all on function public.mnty_can_platform_admin() from public, anon;
grant execute on function public.mnty_can_platform_admin() to authenticated;

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
  if v_from >= v_to then
    raise exception 'INVALID_DATE_RANGE';
  end if;

  select pg_catalog.jsonb_build_object(
    'ledger_count', count(*),
    'gross', coalesce(sum(l.gross_amount), 0),
    'commission', coalesce(sum(l.commission_amount), 0),
    'captain_amount', coalesce(sum(l.captain_net_amount), 0),
    'paid_count', count(*) filter (where l.payment_status in ('PAID','CASH_CONFIRMED')),
    'paid_amount', coalesce(sum(l.gross_amount) filter (where l.payment_status in ('PAID','CASH_CONFIRMED')), 0),
    'settled_count', count(*) filter (where l.settlement_status = 'SETTLED'),
    'settled_amount', coalesce(sum(l.captain_net_amount) filter (where l.settlement_status = 'SETTLED'), 0),
    'unsettled_count', count(*) filter (where l.settlement_status is distinct from 'SETTLED'),
    'unsettled_amount', coalesce(sum(l.captain_net_amount) filter (where l.settlement_status is distinct from 'SETTLED'), 0),
    'from', v_from,
    'to', v_to
  ) into v_ledger
  from public.mantigo_financial_ledger l
  where l.created_at >= v_from
    and l.created_at < v_to;

  return v_ledger;
end
$function$;

revoke all on function public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz) to authenticated;

comment on function public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz) is
  'RC528: platform-scoped MantiGO financial report using canonical gross_amount and captain_net_amount ledger columns.';
comment on function public.mnty_can_platform_admin() is
  'RC528: platform scope requires an active SUPER_ADMIN membership for MNTY-PLATFORM with PLATFORM scope and full_control.';
