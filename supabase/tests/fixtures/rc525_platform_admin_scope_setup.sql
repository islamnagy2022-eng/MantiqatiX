-- Disposable-only fixture for RC525 policy catalog regression.
-- Never run against production or a shared database.
do $roles$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$roles$;

create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $function$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $function$;

create table public.user_memberships (
  user_id uuid not null,
  tenant_id text not null,
  status text not null,
  role text not null,
  permissions jsonb
);

create table public.digital_page_products (
  id uuid primary key default gen_random_uuid(),
  active boolean not null default true
);
alter table public.digital_page_products enable row level security;

create policy digital_page_products_admin_write
  on public.digital_page_products
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_memberships m
      where m.user_id = auth.uid()
        and m.status = 'ACTIVE'
        and m.role in ('ADMIN','SUPER_ADMIN')
    )
  )
  with check (
    exists (
      select 1 from public.user_memberships m
      where m.user_id = auth.uid()
        and m.status = 'ACTIVE'
        and m.role in ('ADMIN','SUPER_ADMIN')
    )
  );

create policy digital_page_products_public_read
  on public.digital_page_products
  for select
  to anon, authenticated
  using (active = true);

grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant select on public.user_memberships to authenticated;
grant select, insert, update, delete on public.digital_page_products to authenticated;
