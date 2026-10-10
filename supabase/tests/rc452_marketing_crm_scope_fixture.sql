create role anon nologin;
create role authenticated nologin;
create schema auth;
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table public.businesses(id uuid primary key,tenant_id text not null,name text not null);
create table public.user_memberships(id text primary key,user_id uuid not null,tenant_id text not null,business_id uuid,role text not null,status text not null,permissions jsonb not null default '{}'::jsonb);
alter table public.user_memberships enable row level security;
create policy memberships_select_self on public.user_memberships for select to authenticated using(auth.uid()=user_id);
alter table public.businesses enable row level security;
create policy businesses_member_select on public.businesses for select to authenticated using(exists(select 1 from public.user_memberships um where um.user_id=auth.uid() and um.tenant_id=businesses.tenant_id and um.status='ACTIVE'));
create table public.marketing_provider_profiles(id uuid primary key,business_id uuid,owner_user_id uuid,name_ar text not null,status text not null);
alter table public.marketing_provider_profiles enable row level security;
create policy "CRM managers view marketing providers" on public.marketing_provider_profiles for select to authenticated using(exists(select 1 from public.user_memberships um where um.user_id=auth.uid() and um.status='ACTIVE' and upper(coalesce(um.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')));
create policy "Owners manage their marketing provider profile" on public.marketing_provider_profiles for all to authenticated using(auth.uid()=owner_user_id) with check(auth.uid()=owner_user_id);
create policy "Public can view active marketing providers" on public.marketing_provider_profiles for select to authenticated using(status='ACTIVE');
create table public.marketing_leads(id uuid primary key,requester_user_id uuid,requester_business_id uuid,title text not null,status text not null default 'OPEN',source text not null default 'PLATFORM',assigned_provider_id uuid);
alter table public.marketing_leads enable row level security;
create policy "CRM managers view marketing leads" on public.marketing_leads for select to authenticated using(exists(select 1 from public.user_memberships um where um.user_id=auth.uid() and um.status='ACTIVE' and upper(coalesce(um.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')));
create policy "Users view own marketing leads" on public.marketing_leads for select to authenticated using(requester_user_id=auth.uid());
create policy "Users create marketing leads" on public.marketing_leads for insert to authenticated with check(requester_user_id=auth.uid());
grant select on public.businesses,public.user_memberships,public.marketing_provider_profiles,public.marketing_leads to authenticated;
grant insert on public.marketing_leads to authenticated;
grant insert, update on public.marketing_provider_profiles to authenticated;
insert into public.businesses(id,tenant_id,name) values
('30000000-0000-4000-8000-000000000001','TENANT-A','Agency A'),
('30000000-0000-4000-8000-000000000002','TENANT-A','Client A2'),
('30000000-0000-4000-8000-000000000003','TENANT-B','Agency B'),
('30000000-0000-4000-8000-000000000004','TENANT-C','Agency C');
insert into public.user_memberships(id,user_id,tenant_id,business_id,role,status,permissions) values
('manager-a','30000000-0000-4000-8000-000000000011','TENANT-A','30000000-0000-4000-8000-000000000001','MANAGER','ACTIVE','{}'),
('tenant-admin-a','30000000-0000-4000-8000-000000000012','TENANT-A',null,'ADMIN','ACTIVE','{}'),
('manager-b','30000000-0000-4000-8000-000000000013','TENANT-B','30000000-0000-4000-8000-000000000003','MANAGER','ACTIVE','{}'),
('tenant-super-c','30000000-0000-4000-8000-000000000014','TENANT-C','30000000-0000-4000-8000-000000000004','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'),
('platform-admin','30000000-0000-4000-8000-000000000015','MNTY-PLATFORM',null,'SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'),
('provider-a','30000000-0000-4000-8000-000000000016','TENANT-A','30000000-0000-4000-8000-000000000001','SERVICE_PROVIDER','ACTIVE','{}'),
('lead-owner','30000000-0000-4000-8000-000000000017','TENANT-B','30000000-0000-4000-8000-000000000003','CUSTOMER','ACTIVE','{}');
insert into public.marketing_provider_profiles(id,business_id,owner_user_id,name_ar,status) values
('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000016','Provider A','ACTIVE'),
('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',null,'Pending Provider A','PENDING'),
('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003',null,'Pending Provider B','PENDING'),
('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000003',null,'Active Provider B','ACTIVE');
insert into public.marketing_leads(id,requester_user_id,requester_business_id,title,assigned_provider_id) values
('50000000-0000-4000-8000-000000000001',null,'30000000-0000-4000-8000-000000000001','Lead A1',null),
('50000000-0000-4000-8000-000000000002',null,'30000000-0000-4000-8000-000000000002','Lead A2',null),
('50000000-0000-4000-8000-000000000003',null,'30000000-0000-4000-8000-000000000003','Lead B',null),
('50000000-0000-4000-8000-000000000004',null,'30000000-0000-4000-8000-000000000004','Lead C',null),
('50000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000017',null,'Personal Lead',null),
('50000000-0000-4000-8000-000000000006',null,'30000000-0000-4000-8000-000000000003','Assigned Lead B','40000000-0000-4000-8000-000000000001');
