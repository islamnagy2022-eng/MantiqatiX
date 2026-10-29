create table if not exists public.public_directory_listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null check (char_length(trim(display_name)) between 2 and 200),
  listing_type text not null default 'doctor'
    check (listing_type in ('doctor','clinic','pharmacy','medical_center','hospital','laboratory','health_provider','business')),
  specialty text,
  phone text,
  secondary_phone text,
  address text,
  governorate text not null default 'المنوفية',
  district text not null default 'بركة السبع',
  village text,
  source_name text not null default 'Public directory',
  source_url text,
  source_checked_at timestamptz not null default now(),
  listing_status text not null default 'PUBLISHED'
    check (listing_status in ('DRAFT','PUBLISHED','HIDDEN')),
  claim_status text not null default 'UNCLAIMED'
    check (claim_status in ('UNCLAIMED','CLAIM_PENDING','CLAIMED')),
  claimed_user_id uuid references auth.users(id) on delete set null,
  claimed_business_id uuid references public.businesses(id) on delete set null,
  claimed_at timestamptz,
  last_verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  completeness jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists public_directory_listings_type_location_idx
  on public.public_directory_listings (listing_type, governorate, district, listing_status);
create index if not exists public_directory_listings_specialty_idx
  on public.public_directory_listings (specialty);
create index if not exists public_directory_listings_claim_status_idx
  on public.public_directory_listings (claim_status, created_at desc);

create table if not exists public.directory_listing_claim_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.public_directory_listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_name text not null check (char_length(trim(contact_name)) between 2 and 160),
  contact_phone text not null check (char_length(trim(contact_phone)) between 7 and 40),
  contact_email text,
  evidence_note text,
  status text not null default 'PENDING'
    check (status in ('PENDING','REVIEWING','APPROVED','REJECTED','CANCELLED')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  linked_business_id uuid references public.businesses(id) on delete set null,
  linked_membership_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists directory_listing_claim_requests_user_idx
  on public.directory_listing_claim_requests (user_id, created_at desc);
create index if not exists directory_listing_claim_requests_status_idx
  on public.directory_listing_claim_requests (status, created_at desc);
create unique index if not exists directory_listing_claim_requests_one_open
  on public.directory_listing_claim_requests (listing_id, user_id)
  where status in ('PENDING','REVIEWING');

create or replace function public.set_public_directory_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_public_directory_listings_updated_at on public.public_directory_listings;
create trigger trg_public_directory_listings_updated_at
before update on public.public_directory_listings for each row execute function public.set_public_directory_updated_at();
drop trigger if exists trg_directory_claim_requests_updated_at on public.directory_listing_claim_requests;
create trigger trg_directory_claim_requests_updated_at
before update on public.directory_listing_claim_requests for each row execute function public.set_public_directory_updated_at();
alter table public.public_directory_listings enable row level security;
alter table public.public_directory_listings force row level security;
alter table public.directory_listing_claim_requests enable row level security;
alter table public.directory_listing_claim_requests force row level security;
revoke all on table public.public_directory_listings from anon, authenticated;
revoke all on table public.directory_listing_claim_requests from anon, authenticated;
grant all on table public.public_directory_listings to service_role;
grant all on table public.directory_listing_claim_requests to service_role;
