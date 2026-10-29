alter table public.public_directory_listings
  add column if not exists outreach_status text not null default 'NEW',
  add column if not exists outreach_notes text,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists subscription_offer_at timestamptz,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists outreach_assigned_to uuid references auth.users(id) on delete set null;
alter table public.public_directory_listings
  drop constraint if exists public_directory_listings_outreach_status_check;
alter table public.public_directory_listings
  add constraint public_directory_listings_outreach_status_check
  check (outreach_status in ('NEW','CONTACTED','INTERESTED','OFFER_SENT','FOLLOW_UP','SUBSCRIPTION_PENDING','SUBSCRIBED','NOT_INTERESTED','CORRECTION_REQUESTED'));
create index if not exists public_directory_listings_outreach_idx
  on public.public_directory_listings (outreach_status, next_follow_up_at);
