-- RC446 disposable PostgreSQL fixture only.
create schema if not exists auth;
create or replace function auth.uid()
returns uuid language sql stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

create or replace function auth.jwt()
returns jsonb language sql stable
as $function$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$function$;

create table public.mantigo_captain_profiles (
  captain_id uuid primary key,
  status text not null,
  verification_status text not null,
  availability_status text not null,
  vehicle_category text
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
  captain_id uuid,
  captain_name text,
  captain_phone text,
  captain_rating numeric,
  vehicle_category text,
  vehicle_model text,
  vehicle_plate text,
  offered_price numeric,
  eta_minutes integer,
  captain_message text,
  created_at timestamptz not null default now(),
  status text not null
);

create table public.mantigo_financial_ledger (
  id text primary key,
  ride_id text
);

create table public.mantigo_ride_ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id text not null,
  customer_id uuid not null
);
