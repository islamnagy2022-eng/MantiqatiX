-- Disposable RC522 fixture only. Models the overly broad prior API-role grants.
do $roles$
begin
  if not exists(select 1 from pg_catalog.pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_catalog.pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_catalog.pg_roles where rolname='service_role') then create role service_role nologin; end if;
end;
$roles$;
create table public.audit_logs(
  id text primary key,
  tenant_id text,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  result text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
grant all on table public.audit_logs to anon, authenticated, service_role;
