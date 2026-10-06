begin;

alter table public.mantigo_rides
  add column if not exists idempotency_key text,
  add column if not exists pickup_lat double precision,
  add column if not exists pickup_lon double precision,
  add column if not exists destination_lat double precision,
  add column if not exists destination_lon double precision;

create unique index if not exists mantigo_rides_customer_idempotency_uq
on public.mantigo_rides(customer_id,idempotency_key) where idempotency_key is not null;

create index if not exists mantigo_rides_open_matching_idx
on public.mantigo_rides(status,vehicle_category,created_at desc)
where status in ('OPEN','OPEN_FOR_BIDS');

create table if not exists public.mantigo_captain_profiles(
  captain_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'PENDING' check(status in ('PENDING','ACTIVE','SUSPENDED','REJECTED')),
  verification_status text not null default 'UNVERIFIED' check(verification_status in ('UNVERIFIED','PENDING','VERIFIED','REJECTED')),
  availability_status text not null default 'OFFLINE' check(availability_status in ('OFFLINE','AVAILABLE','BUSY')),
  vehicle_category text not null,
  vehicle_model text not null default '',
  vehicle_plate text not null default '',
  service_areas jsonb not null default '[]'::jsonb,
  current_lat double precision,
  current_lon double precision,
  rating numeric(3,2) not null default 0 check(rating between 0 and 5),
  completed_rides integer not null default 0 check(completed_rides>=0),
  acceptance_rate numeric(5,2) not null default 0 check(acceptance_rate between 0 and 100),
  cancellation_rate numeric(5,2) not null default 0 check(cancellation_rate between 0 and 100),
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.mantigo_captain_profiles enable row level security;
drop policy if exists mantigo_captain_self_select on public.mantigo_captain_profiles;
create policy mantigo_captain_self_select on public.mantigo_captain_profiles for select to authenticated using(captain_id=auth.uid());
drop policy if exists mantigo_captain_self_update on public.mantigo_captain_profiles;
create policy mantigo_captain_self_update on public.mantigo_captain_profiles for update to authenticated using(captain_id=auth.uid()) with check(captain_id=auth.uid());

create index if not exists mantigo_captain_matching_idx
on public.mantigo_captain_profiles(status,verification_status,availability_status,vehicle_category,last_seen_at desc);

create or replace function public.create_mantigo_ride_backend_v2(
 p_user_id uuid,p_customer_name text,p_customer_phone text,p_vehicle_category text,p_ride_type text,
 p_pickup_location text,p_destination_location text,p_proposed_price numeric,p_note text,p_idempotency_key text,
 p_pickup_lat double precision default null,p_pickup_lon double precision default null,
 p_destination_lat double precision default null,p_destination_lon double precision default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare v_existing public.mantigo_rides%rowtype; v_id text:='RIDE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 if coalesce(trim(p_idempotency_key),'')='' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
 if coalesce(trim(p_pickup_location),'')='' or coalesce(trim(p_destination_location),'')='' then raise exception 'ROUTE_REQUIRED'; end if;
 if p_proposed_price is null or p_proposed_price<=0 then raise exception 'PRICE_REQUIRED'; end if;
 if (p_pickup_lat is not null and (p_pickup_lat < -90 or p_pickup_lat > 90)) or (p_pickup_lon is not null and (p_pickup_lon < -180 or p_pickup_lon > 180)) or (p_destination_lat is not null and (p_destination_lat < -90 or p_destination_lat > 90)) or (p_destination_lon is not null and (p_destination_lon < -180 or p_destination_lon > 180)) then raise exception 'INVALID_COORDINATES'; end if;
 select * into v_existing from public.mantigo_rides where customer_id=p_user_id and idempotency_key=trim(p_idempotency_key) limit 1;
 if found then return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'idempotent_replay',true); end if;
 insert into public.mantigo_rides(id,customer_id,customer_name,customer_phone,vehicle_category,ride_type,pickup_location,destination_location,proposed_price,note,status,idempotency_key,pickup_lat,pickup_lon,destination_lat,destination_lon)
 values(v_id,p_user_id,coalesce(nullif(trim(p_customer_name),''),'عميل MantiGO'),coalesce(trim(p_customer_phone),''),trim(p_vehicle_category),trim(p_ride_type),trim(p_pickup_location),trim(p_destination_location),p_proposed_price,coalesce(p_note,''),'OPEN',trim(p_idempotency_key),p_pickup_lat,p_pickup_lon,p_destination_lat,p_destination_lon)
 on conflict (customer_id,idempotency_key) where idempotency_key is not null do nothing;
 select * into v_existing from public.mantigo_rides where customer_id=p_user_id and idempotency_key=trim(p_idempotency_key) limit 1;
 if v_existing.id<>v_id then return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'idempotent_replay',true); end if;
 insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
 values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_RIDE_CREATED','MANTIGO_RIDE',v_id,'{}'::jsonb,jsonb_build_object('status','OPEN','proposed_price',p_proposed_price,'idempotency_key',trim(p_idempotency_key)),'SUCCESS');
 return jsonb_build_object('id',v_id,'status','OPEN','idempotent_replay',false);
end $function$;

create or replace function public.match_mantigo_ride_backend(p_user_id uuid,p_ride_id text,p_limit integer default 10)
returns table(captain_id uuid,vehicle_category text,vehicle_model text,rating numeric,completed_rides integer,distance_km numeric,match_score numeric)
language plpgsql security definer set search_path=public as $function$
declare v_customer uuid;v_category text;v_lat double precision;v_lon double precision;v_status text;
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 if p_limit is null or p_limit<1 or p_limit>50 then raise exception 'INVALID_LIMIT'; end if;
 select r.customer_id,r.vehicle_category,r.pickup_lat,r.pickup_lon,r.status into v_customer,v_category,v_lat,v_lon,v_status from public.mantigo_rides r where r.id=p_ride_id for update;
 if v_customer is null then raise exception 'RIDE_NOT_FOUND'; end if;
 if v_customer<>p_user_id then raise exception 'RIDE_OWNER_REQUIRED'; end if;
 if v_status not in ('OPEN','OPEN_FOR_BIDS','MATCHING') then raise exception 'RIDE_NOT_MATCHABLE'; end if;
 return query
 with candidates as (
 select c.captain_id,c.vehicle_category,c.vehicle_model,c.rating,c.completed_rides,
 case when v_lat is not null and v_lon is not null and c.current_lat is not null and c.current_lon is not null then 6371.0*2*asin(sqrt(power(sin(radians(c.current_lat-v_lat)/2),2)+cos(radians(v_lat))*cos(radians(c.current_lat))*power(sin(radians(c.current_lon-v_lon)/2),2))) else null end distance_km,
 c.acceptance_rate,c.cancellation_rate,c.last_seen_at
 from public.mantigo_captain_profiles c
 where c.status='ACTIVE' and c.verification_status='VERIFIED' and c.availability_status='AVAILABLE'
 and c.vehicle_category=v_category and c.captain_id<>v_customer)
 select captain_id,vehicle_category,vehicle_model,rating,completed_rides,round(distance_km::numeric,2),
 round((least(rating/5.0,1)*35+least(completed_rides/100.0,1)*20+least(acceptance_rate/100.0,1)*15+greatest(0,1-least(cancellation_rate/100.0,1))*15+case when distance_km is null then 5 when distance_km<=2 then 15 when distance_km<=5 then 10 when distance_km<=10 then 5 else 0 end)::numeric,2)
 from candidates where distance_km is null or distance_km<=50
 order by 7 desc,distance_km nulls last,last_seen_at desc nulls last limit p_limit;
end $function$;

revoke all on function public.create_mantigo_ride_backend_v2(uuid,text,text,text,text,text,text,numeric,text,text,double precision,double precision,double precision,double precision) from public,anon;
revoke all on function public.match_mantigo_ride_backend(uuid,text,integer) from public,anon;
grant execute on function public.create_mantigo_ride_backend_v2(uuid,text,text,text,text,text,text,numeric,text,text,double precision,double precision,double precision,double precision) to authenticated;
grant execute on function public.match_mantigo_ride_backend(uuid,text,integer) to authenticated;

commit;