
create table if not exists public.mantigo_rides (
 id text primary key,
 customer_id uuid not null references auth.users(id) on delete cascade,
 customer_name text not null default '',
 customer_phone text not null default '',
 vehicle_category text not null,
 ride_type text not null,
 pickup_location text not null,
 destination_location text not null,
 proposed_price numeric(14,2) not null,
 note text not null default '',
 status text not null default 'SEARCHING_BIDS',
 accepted_bid_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.mantigo_bids (
 id text primary key,
 ride_id text not null references public.mantigo_rides(id) on delete cascade,
 captain_id uuid not null references auth.users(id) on delete cascade,
 captain_name text not null,
 captain_phone text not null default '',
 captain_rating numeric(3,2) not null default 0,
 vehicle_category text not null,
 vehicle_model text not null,
 vehicle_plate text not null default '',
 offered_price numeric(14,2) not null,
 eta_minutes integer not null default 0,
 captain_message text not null default '',
 created_at timestamptz not null default now()
);
create table if not exists public.mantigo_ride_ratings (
 id uuid primary key default gen_random_uuid(),
 ride_id text not null references public.mantigo_rides(id) on delete cascade,
 customer_id uuid not null references auth.users(id) on delete cascade,
 captain_id uuid not null references auth.users(id) on delete cascade,
 rating integer not null check (rating between 1 and 5),
 comment text not null default '',
 created_at timestamptz not null default now(),
 unique(ride_id, customer_id)
);
alter table public.mantigo_rides enable row level security;
alter table public.mantigo_bids enable row level security;
alter table public.mantigo_ride_ratings enable row level security;
create policy mantigo_rides_select on public.mantigo_rides for select to authenticated using (customer_id=auth.uid() or public.is_platform_admin());
create policy mantigo_rides_insert on public.mantigo_rides for insert to authenticated with check (customer_id=auth.uid());
create policy mantigo_rides_update on public.mantigo_rides for update to authenticated using (customer_id=auth.uid() or public.is_platform_admin()) with check (customer_id=auth.uid() or public.is_platform_admin());
create policy mantigo_rides_delete on public.mantigo_rides for delete to authenticated using (customer_id=auth.uid() or public.is_platform_admin());
create policy mantigo_bids_select on public.mantigo_bids for select to authenticated using (captain_id=auth.uid() or exists(select 1 from public.mantigo_rides r where r.id=ride_id and r.customer_id=auth.uid()) or public.is_platform_admin());
create policy mantigo_bids_insert on public.mantigo_bids for insert to authenticated with check (captain_id=auth.uid());
create policy mantigo_bids_update on public.mantigo_bids for update to authenticated using (captain_id=auth.uid() or exists(select 1 from public.mantigo_rides r where r.id=ride_id and r.customer_id=auth.uid()) or public.is_platform_admin()) with check (captain_id=auth.uid() or exists(select 1 from public.mantigo_rides r where r.id=ride_id and r.customer_id=auth.uid()) or public.is_platform_admin());
create policy mantigo_bids_delete on public.mantigo_bids for delete to authenticated using (captain_id=auth.uid() or public.is_platform_admin());
create policy mantigo_ratings_select on public.mantigo_ride_ratings for select to authenticated using (customer_id=auth.uid() or captain_id=auth.uid() or public.is_platform_admin());
create policy mantigo_ratings_insert on public.mantigo_ride_ratings for insert to authenticated with check (customer_id=auth.uid());
grant select,insert,update,delete on public.mantigo_rides, public.mantigo_bids, public.mantigo_ride_ratings to authenticated;
