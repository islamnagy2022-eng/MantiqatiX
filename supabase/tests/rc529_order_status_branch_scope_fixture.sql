\set ON_ERROR_STOP on
create extension if not exists pgcrypto;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then execute 'create role anon nologin'; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then execute 'create role authenticated nologin'; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then execute 'create role service_role nologin'; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create or replace function auth.jwt()
returns jsonb language sql stable
as $$ select jsonb_build_object('sub',nullif(current_setting('request.jwt.claim.sub',true),''),'is_anonymous',false) $$;
create or replace function auth.role()
returns text language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user) $$;
grant usage on schema auth to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
grant execute on function auth.jwt() to authenticated, service_role;
grant execute on function auth.role() to authenticated, service_role;

create table public.user_memberships(
 id text primary key,user_id uuid not null,tenant_id varchar not null,business_id uuid not null,
 branch_id varchar,role varchar not null,status varchar not null default 'ACTIVE',permissions jsonb not null default '{}'
);
grant select on public.user_memberships to authenticated;

create table public.orders(
 id uuid primary key,tenant_id varchar not null,business_id uuid not null,branch_id varchar,
 customer_id uuid,status varchar not null,notes text,updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
grant select,update on public.orders to authenticated;
create policy orders_member_select on public.orders for select to authenticated using (
 exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=orders.tenant_id and m.status='ACTIVE')
);
create policy orders_member_update on public.orders for update to authenticated using (
 exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=orders.tenant_id and m.status='ACTIVE' and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','STAFF','CASHIER','DRIVER','SERVICE_PROVIDER'))
) with check (
 exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=orders.tenant_id and m.status='ACTIVE' and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','STAFF','CASHIER','DRIVER','SERVICE_PROVIDER'))
);

create table public.payment_intents(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),
 status text not null,created_at timestamptz not null default now()
);
grant select on public.payment_intents to authenticated;

insert into public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status) values
 ('staff-a','10000000-0000-0000-0000-000000000001','tenant-a','20000000-0000-0000-0000-000000000001','branch-a','STAFF','ACTIVE'),
 ('staff-b','10000000-0000-0000-0000-000000000002','tenant-a','20000000-0000-0000-0000-000000000001','branch-b','STAFF','ACTIVE'),
 ('owner-other-business','10000000-0000-0000-0000-000000000003','tenant-a','20000000-0000-0000-0000-000000000002',null,'OWNER','ACTIVE'),
 ('staff-null-status','10000000-0000-0000-0000-000000000004','tenant-a','20000000-0000-0000-0000-000000000001','branch-a','STAFF',null);

insert into public.orders(id,tenant_id,business_id,branch_id,customer_id,status,notes) values
 ('30000000-0000-0000-0000-000000000001','tenant-a','20000000-0000-0000-0000-000000000001','branch-a','40000000-0000-0000-0000-000000000001','PENDING',''),
 ('30000000-0000-0000-0000-000000000002','tenant-a','20000000-0000-0000-0000-000000000001','branch-b','40000000-0000-0000-0000-000000000002','PENDING',''),
 ('30000000-0000-0000-0000-000000000003','tenant-a','20000000-0000-0000-0000-000000000002','branch-c','40000000-0000-0000-0000-000000000003','PENDING',''),
 ('30000000-0000-0000-0000-000000000004','tenant-a','20000000-0000-0000-0000-000000000001','branch-a','10000000-0000-0000-0000-000000000099','PENDING','');
insert into public.payment_intents(order_id,status) values
 ('30000000-0000-0000-0000-000000000004','SUCCEEDED');
