create role anon nologin;
create role authenticated nologin;
create schema auth;
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.businesses(
 id uuid primary key,tenant_id text not null,organization_id text,name text not null,code text not null,status text not null default 'ACTIVE',settings jsonb not null default '{}'::jsonb
);
create table public.user_memberships(
 id text primary key,user_id uuid not null,tenant_id text not null,organization_id text,business_id uuid,branch_id text,role text not null,permissions jsonb not null default '{}'::jsonb,status text not null default 'ACTIVE'
);
alter table public.user_memberships enable row level security;
create policy memberships_select_self on public.user_memberships for select to authenticated using(auth.uid()=user_id);
alter table public.businesses enable row level security;
create policy businesses_member_select on public.businesses for select to authenticated using(exists(select 1 from public.user_memberships um where um.user_id=auth.uid() and um.tenant_id=businesses.tenant_id and um.status='ACTIVE'));

create table public.marketing_provider_profiles(
 id uuid primary key,business_id uuid,owner_user_id uuid,provider_kind text not null,name_ar text not null,slug text not null,status text not null,is_verified boolean not null default false
);
alter table public.marketing_provider_profiles enable row level security;
create policy "Owners manage their marketing provider profile" on public.marketing_provider_profiles for all to authenticated using(auth.uid()=owner_user_id) with check(auth.uid()=owner_user_id);
create policy "Public can view active marketing providers" on public.marketing_provider_profiles for select to authenticated using(status='ACTIVE');

create table public.audit_logs(
 id varchar primary key,tenant_id varchar not null,organization_id varchar,business_id uuid,branch_id varchar,actor_user_id uuid not null,action varchar not null,entity_type varchar not null,entity_id varchar not null,old_values jsonb default '{}'::jsonb,new_values jsonb default '{}'::jsonb,result varchar not null default 'SUCCESS',created_at timestamptz not null default now()
);
create table public.notifications(
 id varchar primary key,tenant_id varchar not null,user_id uuid not null,type varchar not null default 'GENERAL',title varchar not null,body text not null,entity_type varchar,entity_id varchar,read_at timestamptz,created_at timestamptz not null default now()
);
grant select on public.businesses,public.user_memberships,public.marketing_provider_profiles to authenticated;
-- Test-only read grants let assertions verify atomic audit/notification writes; never used by the production migration.
grant select on public.audit_logs,public.notifications to authenticated;

insert into public.businesses(id,tenant_id,organization_id,name,code,status) values
('30000000-0000-4000-8000-000000000001','TENANT-A','ORG-A','Agency A','AG-A','ACTIVE'),
('30000000-0000-4000-8000-000000000002','TENANT-B','ORG-B','Agency B','AG-B','ACTIVE'),
('30000000-0000-4000-8000-000000000003','TENANT-C','ORG-C','Agency C','AG-C','ACTIVE');

insert into public.user_memberships(id,user_id,tenant_id,organization_id,business_id,role,permissions,status) values
('manager-a','30000000-0000-4000-8000-000000000011','TENANT-A','ORG-A','30000000-0000-4000-8000-000000000001','MANAGER','{}','ACTIVE'),
('manager-b','30000000-0000-4000-8000-000000000012','TENANT-B','ORG-B','30000000-0000-4000-8000-000000000002','ADMIN','{}','ACTIVE'),
('tenant-super-c','30000000-0000-4000-8000-000000000013','TENANT-C','ORG-C','30000000-0000-4000-8000-000000000003','SUPER_ADMIN','{"scope":"PLATFORM","full_control":true}','ACTIVE'),
('platform-admin','30000000-0000-4000-8000-000000000014','MNTY-PLATFORM',null,null,'SUPER_ADMIN','{"scope":"PLATFORM","full_control":true}','ACTIVE'),
('provider-b','30000000-0000-4000-8000-000000000015','TENANT-B','ORG-B','30000000-0000-4000-8000-000000000002','SERVICE_PROVIDER','{}','ACTIVE'),
('customer-b','30000000-0000-4000-8000-000000000016','TENANT-B','ORG-B','30000000-0000-4000-8000-000000000002','CUSTOMER','{}','ACTIVE');

insert into public.marketing_provider_profiles(id,business_id,owner_user_id,provider_kind,name_ar,slug,status,is_verified) values
('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000015','PARTNER_COMPANY','Verified Partner B','partner-b','ACTIVE',true),
('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000017','PARTNER_COMPANY','Unverified Partner','partner-unverified','ACTIVE',false),
('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000018','FREELANCER','Verified Freelancer C','freelancer-c','ACTIVE',true);
