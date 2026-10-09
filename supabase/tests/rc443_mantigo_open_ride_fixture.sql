-- RC443 disposable PostgreSQL fixture only.
create schema if not exists auth;
create or replace function auth.uid()
returns uuid language sql stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

create table public.mantigo_captain_profiles (
  captain_id uuid primary key,
  status text not null,
  verification_status text not null,
  availability_status text not null
);

create table public.mantigo_rides (
  id text primary key,
  customer_id uuid not null,
  customer_name text not null default '',
  vehicle_category text not null,
  ride_type text not null,
  pickup_location text not null,
  destination_location text not null,
  proposed_price numeric not null,
  note text not null default '',
  status text not null,
  created_at timestamptz not null default now()
);

create table public.mantigo_bids (
  id text primary key,
  ride_id text not null references public.mantigo_rides(id),
  status text not null
);
