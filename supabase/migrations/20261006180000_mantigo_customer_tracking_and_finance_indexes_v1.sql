-- MantiGO customer tracking/read boundary and finance indexes
create or replace function public.list_mantigo_customer_rides_backend(
  p_user_id uuid,
  p_ride_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null or p_user_id is null or v_user <> p_user_id then
    raise exception 'UNAUTHORIZED';
  end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'ride', to_jsonb(r),
      'bids', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at asc) from public.mantigo_bids b where b.ride_id=r.id),'[]'::jsonb),
      'financial', (select to_jsonb(f) from public.mantigo_financial_ledger f where f.ride_id=r.id),
      'rating', (select to_jsonb(rt) from public.mantigo_ride_ratings rt where rt.ride_id=r.id and rt.customer_id=v_user limit 1)
    ) order by r.created_at desc
  ),'[]'::jsonb) into v_result
  from public.mantigo_rides r
  where r.customer_id=v_user and (p_ride_id is null or r.id=p_ride_id);
  return v_result;
end;
$$;
revoke all on function public.list_mantigo_customer_rides_backend(uuid,text) from public, anon;
grant execute on function public.list_mantigo_customer_rides_backend(uuid,text) to authenticated;
create index if not exists idx_mantigo_rides_customer_status_created on public.mantigo_rides(customer_id,status,created_at desc);
create index if not exists idx_mantigo_bids_ride_status_created on public.mantigo_bids(ride_id,status,created_at desc);
create index if not exists idx_mantigo_ledger_captain_settlement on public.mantigo_financial_ledger(captain_id,settlement_status,updated_at desc);
