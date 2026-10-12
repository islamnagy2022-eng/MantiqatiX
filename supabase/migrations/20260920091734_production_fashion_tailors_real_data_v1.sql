
create table if not exists public.fashion_tailor_services (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  tailor_name text not null,
  service_type text not null,
  price_estimate numeric(14,2) not null default 0,
  delivery_days integer not null default 1,
  rating numeric(3,2) not null default 0,
  address text not null default '',
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.fashion_tailor_services enable row level security;
drop policy if exists fashion_tailor_services_select on public.fashion_tailor_services;
create policy fashion_tailor_services_select on public.fashion_tailor_services
for select to authenticated
using (is_available or owner_user_id = auth.uid() or public.is_platform_admin());
drop policy if exists fashion_tailor_services_insert on public.fashion_tailor_services;
create policy fashion_tailor_services_insert on public.fashion_tailor_services
for insert to authenticated with check (owner_user_id = auth.uid());
drop policy if exists fashion_tailor_services_update on public.fashion_tailor_services;
create policy fashion_tailor_services_update on public.fashion_tailor_services
for update to authenticated
using (owner_user_id = auth.uid() or public.is_platform_admin())
with check (owner_user_id = auth.uid() or public.is_platform_admin());
drop policy if exists fashion_tailor_services_delete on public.fashion_tailor_services;
create policy fashion_tailor_services_delete on public.fashion_tailor_services
for delete to authenticated using (owner_user_id = auth.uid() or public.is_platform_admin());
grant select, insert, update, delete on public.fashion_tailor_services to authenticated;
