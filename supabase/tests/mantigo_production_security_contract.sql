-- MantiGO production security regression contract.
-- Execute against the target database. This is intentionally read-only.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in (
      'mantigo_rides','mantigo_bids','mantigo_captain_profiles',
      'mantigo_financial_ledger','mantigo_financial_config','mantigo_ride_ratings'
    )
    and c.relrowsecurity;
  if v_count <> 6 then
    raise exception 'MANTIGO_RLS_CONTRACT_FAILED: expected 6 RLS-enabled tables, got %',v_count;
  end if;

  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'create_mantigo_ride_backend_v2',
      'create_mantigo_bid_backend',
      'accept_mantigo_bid_backend',
      'update_mantigo_trip_status_backend',
      'confirm_mantigo_cash_payment_backend',
      'settle_mantigo_captain_backend',
      'mantigo_rate_ride'
    )
    and p.prosecdef
    and has_function_privilege('anon',p.oid,'EXECUTE') = false
    and has_function_privilege('authenticated',p.oid,'EXECUTE') = true;
  if v_count <> 7 then
    raise exception 'MANTIGO_RPC_BOUNDARY_FAILED: expected 7 hardened RPCs, got %',v_count;
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='mantigo_rides'
      and t.tgname='mantigo_ride_rate_limit_guard' and not t.tgisinternal
  ) then
    raise exception 'MANTIGO_RATE_LIMIT_FAILED: ride trigger missing';
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='mantigo_bids'
      and t.tgname='mantigo_bid_rate_limit_guard' and not t.tgisinternal
  ) then
    raise exception 'MANTIGO_RATE_LIMIT_FAILED: bid trigger missing';
  end if;

  raise notice 'MANTIGO_SECURITY_CONTRACT: PASS';
end $$;
