-- RC443 behavioral privacy tests; disposable PostgreSQL only.
do $test$
declare
  captain uuid := '10000000-0000-4000-8000-000000000443';
  ordinary_user uuid := '10000000-0000-4000-8000-000000000444';
  v_count integer;
  v_bid_count bigint;
  v_status text;
  v_config text;
begin
  if has_function_privilege('anon','public.list_open_mantigo_rides_backend(uuid)','EXECUTE') then
    raise exception 'anon must not execute the open-ride RPC';
  end if;
  if not has_function_privilege('authenticated','public.list_open_mantigo_rides_backend(uuid)','EXECUTE') then
    raise exception 'authenticated callers must reach the in-function captain guard';
  end if;
  select pg_catalog.array_to_string(p.proconfig, ',') into v_config
  from pg_catalog.pg_proc p
  where p.oid='public.list_open_mantigo_rides_backend(uuid)'::regprocedure;
  if v_config not like '%search_path=pg_catalog%' then
    raise exception 'RPC must use a trusted search_path, got %',v_config;
  end if;

  insert into public.mantigo_rides(id,customer_id,customer_name,vehicle_category,ride_type,pickup_location,destination_location,proposed_price,note,status,created_at) values
    ('ride-visible',ordinary_user,'Customer A','SEDAN','CITY','Pickup A','Destination A',100,'note A','OPEN',pg_catalog.now()-interval '2 minutes'),
    ('ride-open-bids',ordinary_user,'Customer B','SUV','CITY','Pickup B','Destination B',150,'note B','OPEN_FOR_BIDS',pg_catalog.now()-interval '1 minute'),
    ('ride-own',captain,'Captain Own Ride','SEDAN','CITY','Private Pickup','Private Destination',90,'private','OPEN',pg_catalog.now()),
    ('ride-accepted',ordinary_user,'Customer C','SEDAN','CITY','Pickup C','Destination C',120,'note C','ACCEPTED',pg_catalog.now());
  insert into public.mantigo_bids(id,ride_id,status) values
    ('bid-offered','ride-visible','OFFERED'),
    ('bid-declined','ride-visible','DECLINED'),
    ('bid-open-bids','ride-open-bids','OFFERED');

  -- Actor spoofing must fail before profile checks.
  perform pg_catalog.set_config('request.jwt.claim.sub',captain::text,true);
  begin
    perform * from public.list_open_mantigo_rides_backend(ordinary_user);
    raise exception 'actor spoof unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%USER_CONTEXT_MISMATCH%' then raise; end if;
  end;

  -- An ordinary authenticated user has no right to retrieve customer locations.
  perform pg_catalog.set_config('request.jwt.claim.sub',ordinary_user::text,true);
  begin
    perform * from public.list_open_mantigo_rides_backend(ordinary_user);
    raise exception 'ordinary user unexpectedly read open-ride locations';
  exception when others then
    if sqlerrm not like '%MANTIGO_CAPTAIN_PROFILE_REQUIRED%' then raise; end if;
  end;

  -- Each invalid captain state must be denied.
  perform pg_catalog.set_config('request.jwt.claim.sub',captain::text,true);
  insert into public.mantigo_captain_profiles values(captain,'PENDING','VERIFIED','AVAILABLE');
  begin
    perform * from public.list_open_mantigo_rides_backend(captain);
    raise exception 'pending captain unexpectedly read open-ride locations';
  exception when others then
    if sqlerrm not like '%MANTIGO_CAPTAIN_PROFILE_REQUIRED%' then raise; end if;
  end;
  update public.mantigo_captain_profiles set status='ACTIVE',verification_status='UNVERIFIED',availability_status='AVAILABLE' where captain_id=captain;
  begin
    perform * from public.list_open_mantigo_rides_backend(captain);
    raise exception 'unverified captain unexpectedly read open-ride locations';
  exception when others then
    if sqlerrm not like '%MANTIGO_CAPTAIN_PROFILE_REQUIRED%' then raise; end if;
  end;
  update public.mantigo_captain_profiles set verification_status='VERIFIED',availability_status='OFFLINE' where captain_id=captain;
  begin
    perform * from public.list_open_mantigo_rides_backend(captain);
    raise exception 'offline captain unexpectedly read open-ride locations';
  exception when others then
    if sqlerrm not like '%MANTIGO_CAPTAIN_PROFILE_REQUIRED%' then raise; end if;
  end;
  update public.mantigo_captain_profiles set availability_status='BUSY' where captain_id=captain;
  begin
    perform * from public.list_open_mantigo_rides_backend(captain);
    raise exception 'busy captain unexpectedly read open-ride locations';
  exception when others then
    if sqlerrm not like '%MANTIGO_CAPTAIN_PROFILE_REQUIRED%' then raise; end if;
  end;

  -- Only an active, verified, available captain receives open requests; own rides and non-open statuses are excluded.
  update public.mantigo_captain_profiles set status='ACTIVE',verification_status='VERIFIED',availability_status='AVAILABLE' where captain_id=captain;
  select count(*) into v_count from public.list_open_mantigo_rides_backend(captain);
  if v_count <> 2 then raise exception 'expected two eligible open rides, got %',v_count; end if;
  select bid_count into v_bid_count from public.list_open_mantigo_rides_backend(captain) where id='ride-visible';
  if v_bid_count <> 1 then raise exception 'only OFFERED bids should be counted, got %',v_bid_count; end if;
  if exists(select 1 from public.list_open_mantigo_rides_backend(captain) where id in ('ride-own','ride-accepted')) then
    raise exception 'own ride or non-open ride leaked into result';
  end if;
end;
$test$;

select 'RC443 MantiGO open-ride privacy integration: PASS' as result;
