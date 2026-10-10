-- Disposable RC444 CRM business-scope RLS fixture.
create schema if not exists auth;
do $roles$
begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end;
$roles$;

create or replace function auth.uid()
returns uuid language sql stable as $function$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$function$;
create or replace function auth.jwt()
returns jsonb language sql stable as $function$
 select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$function$;
grant usage on schema auth to public;
grant execute on function auth.uid() to public;
grant execute on function auth.jwt() to public;

create table public.user_memberships(
 id uuid primary key,
 user_id uuid not null,
 tenant_id text not null,
 business_id uuid,
 role text not null,
 status text not null,
 permissions jsonb not null default '{}'::jsonb
);
alter table public.user_memberships enable row level security;
grant select on public.user_memberships to authenticated;
create policy user_memberships_self_read on public.user_memberships
 for select to authenticated using (user_id=auth.uid());

create table public.marketing_leads(
 id uuid primary key,
 requester_user_id uuid,
 requester_business_id uuid,
 title text not null,
 description text,
 status text not null,
 created_at timestamptz not null default now()
);
alter table public.marketing_leads enable row level security;
grant select on public.marketing_leads to authenticated;
create policy "Users view own marketing leads" on public.marketing_leads
 for select to authenticated using (requester_user_id=auth.uid());
create policy "CRM managers view marketing leads" on public.marketing_leads
 for select to authenticated using (
  exists(select 1 from public.user_memberships um where um.user_id=auth.uid() and um.status='ACTIVE'
   and upper(um.role) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'))
 );

create table public.marketing_provider_profiles(
 id uuid primary key,
 business_id uuid,
 owner_user_id uuid,
 name_ar text not null,
 status text not null,
 is_verified boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.marketing_provider_profiles enable row level security;
grant select on public.marketing_provider_profiles to authenticated;
create policy "CRM managers view marketing providers" on public.marketing_provider_profiles
 for select to authenticated using (
  exists(select 1 from public.user_memberships um where um.user_id=auth.uid() and um.status='ACTIVE'
   and upper(um.role) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'))
 );
create policy "Public can view active marketing providers" on public.marketing_provider_profiles
 for select to authenticated using (status='ACTIVE');
create policy "Owners manage their marketing provider profile" on public.marketing_provider_profiles
 for all to authenticated using (owner_user_id=auth.uid()) with check (owner_user_id=auth.uid());
