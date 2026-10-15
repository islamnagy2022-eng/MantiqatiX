
create table if not exists public.indrive_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  domain_type text not null,
  category_name text not null,
  title text not null,
  details_description text not null,
  user_proposed_price numeric(14,2) not null default 0,
  target_provider_type text not null,
  selected_ad_platform text,
  req_location_district text,
  status text not null default 'OPEN_FOR_BIDS',
  accepted_bid_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.indrive_bids (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.indrive_requests(id) on delete cascade,
  provider_user_id uuid not null references auth.users(id) on delete cascade,
  provider_name text not null,
  provider_type text not null,
  provider_rating numeric(3,2) not null default 0,
  completed_orders_count integer not null default 0,
  offered_price numeric(14,2) not null,
  note text not null default '',
  estimated_delivery_time text not null default '',
  created_at timestamptz not null default now()
);

alter table public.indrive_requests
  add constraint indrive_requests_accepted_bid_fk
  foreign key (accepted_bid_id) references public.indrive_bids(id) on delete set null;

create index if not exists idx_indrive_requests_domain_status on public.indrive_requests(domain_type, status);
create index if not exists idx_indrive_requests_owner on public.indrive_requests(owner_user_id);
create index if not exists idx_indrive_bids_request on public.indrive_bids(request_id);
create index if not exists idx_indrive_bids_provider on public.indrive_bids(provider_user_id);

alter table public.indrive_requests enable row level security;
alter table public.indrive_bids enable row level security;

drop policy if exists indrive_requests_select on public.indrive_requests;
create policy indrive_requests_select on public.indrive_requests
for select to authenticated
using (owner_user_id = auth.uid() or exists (select 1 from public.indrive_bids b where b.request_id = id and b.provider_user_id = auth.uid()) or public.is_platform_admin());

drop policy if exists indrive_requests_insert on public.indrive_requests;
create policy indrive_requests_insert on public.indrive_requests
for insert to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists indrive_requests_update on public.indrive_requests;
create policy indrive_requests_update on public.indrive_requests
for update to authenticated
using (owner_user_id = auth.uid() or public.is_platform_admin())
with check (owner_user_id = auth.uid() or public.is_platform_admin());

drop policy if exists indrive_requests_delete on public.indrive_requests;
create policy indrive_requests_delete on public.indrive_requests
for delete to authenticated
using (owner_user_id = auth.uid() or public.is_platform_admin());

drop policy if exists indrive_bids_select on public.indrive_bids;
create policy indrive_bids_select on public.indrive_bids
for select to authenticated
using (
  provider_user_id = auth.uid()
  or exists (select 1 from public.indrive_requests r where r.id = request_id and r.owner_user_id = auth.uid())
  or public.is_platform_admin()
);

drop policy if exists indrive_bids_insert on public.indrive_bids;
create policy indrive_bids_insert on public.indrive_bids
for insert to authenticated
with check (provider_user_id = auth.uid());

drop policy if exists indrive_bids_update on public.indrive_bids;
create policy indrive_bids_update on public.indrive_bids
for update to authenticated
using (
  provider_user_id = auth.uid()
  or exists (select 1 from public.indrive_requests r where r.id = request_id and r.owner_user_id = auth.uid())
  or public.is_platform_admin()
)
with check (
  provider_user_id = auth.uid()
  or exists (select 1 from public.indrive_requests r where r.id = request_id and r.owner_user_id = auth.uid())
  or public.is_platform_admin()
);

drop policy if exists indrive_bids_delete on public.indrive_bids;
create policy indrive_bids_delete on public.indrive_bids
for delete to authenticated
using (provider_user_id = auth.uid() or public.is_platform_admin());

grant select, insert, update, delete on public.indrive_requests to authenticated;
grant select, insert, update, delete on public.indrive_bids to authenticated;
