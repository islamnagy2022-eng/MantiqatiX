create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create table public.businesses(
 id uuid primary key, tenant_id varchar not null, status varchar not null default 'ACTIVE'
);
create table public.branches(
 id varchar primary key, tenant_id varchar not null, business_id uuid not null, status varchar not null default 'ACTIVE'
);
create table public.user_memberships(
 id varchar primary key, user_id uuid not null, tenant_id varchar not null, business_id uuid,
 branch_id varchar, role varchar not null, status varchar not null default 'ACTIVE'
);
create table public.restaurant_menu_items(
 id text primary key, owner_user_id uuid not null, name_ar text not null, description_ar text not null default '',
 base_price_egp numeric not null, original_price_egp numeric, category text not null,
 is_available boolean not null default true, is_popular boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 tenant_id varchar not null, business_id uuid not null, branch_id varchar not null
);
create table public.catalog_items(
 id uuid primary key default gen_random_uuid(), tenant_id varchar not null, business_id uuid not null,
 branch_id varchar, legacy_ref varchar, item_type varchar not null default 'PRODUCT',
 name_ar text not null, name_en text, description text, sku varchar, status varchar not null default 'ACTIVE',
 tax_rate numeric not null default 0, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index ux_catalog_items_business_legacy_ref on public.catalog_items(business_id,legacy_ref) where legacy_ref is not null;
create table public.catalog_item_prices(
 id uuid primary key default gen_random_uuid(), tenant_id varchar not null, catalog_item_id uuid not null,
 branch_id varchar, currency varchar not null default 'EGP', unit_price numeric not null,
 version bigint not null default 1, status varchar not null default 'ACTIVE',
 effective_from timestamptz not null default now(), effective_to timestamptz
);
create table public.audit_logs(
 id varchar primary key, tenant_id varchar not null, organization_id varchar, business_id uuid, branch_id varchar,
 actor_user_id uuid not null, action varchar not null, entity_type varchar not null, entity_id varchar not null,
 old_values jsonb default '{}'::jsonb, new_values jsonb default '{}'::jsonb,
 result varchar not null default 'SUCCESS', ip_address varchar, user_agent text, created_at timestamptz not null default now()
);

insert into public.businesses(id,tenant_id,status) values
('10000000-0000-4000-8000-000000000001','TENANT-A','ACTIVE'),
('10000000-0000-4000-8000-000000000002','TENANT-B','ACTIVE');
insert into public.branches(id,tenant_id,business_id,status) values
('BRANCH-A','TENANT-A','10000000-0000-4000-8000-000000000001','ACTIVE'),
('BRANCH-B','TENANT-B','10000000-0000-4000-8000-000000000002','ACTIVE');
insert into public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status) values
('membership-a','20000000-0000-4000-8000-000000000001','TENANT-A','10000000-0000-4000-8000-000000000001','BRANCH-A','MANAGER','ACTIVE'),
('membership-a2','20000000-0000-4000-8000-000000000003','TENANT-A','10000000-0000-4000-8000-000000000001','BRANCH-A','MANAGER','ACTIVE'),
('membership-b','20000000-0000-4000-8000-000000000002','TENANT-B','10000000-0000-4000-8000-000000000002','BRANCH-B','OWNER','ACTIVE');
