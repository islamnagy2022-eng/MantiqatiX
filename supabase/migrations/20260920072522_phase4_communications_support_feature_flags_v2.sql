
create table if not exists public.notifications (
  id varchar primary key, tenant_id varchar not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, type varchar not null default 'GENERAL',
  title varchar not null, body text not null, entity_type varchar, entity_id varchar,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_tenant_created_idx on public.notifications(tenant_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_insert_self on public.notifications;
create policy notifications_insert_self on public.notifications for insert to authenticated with check (user_id = auth.uid());

create table if not exists public.support_tickets (
  id varchar primary key, tenant_id varchar not null references public.tenants(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete restrict, business_id uuid references public.businesses(id) on delete set null,
  subject varchar not null, description text not null default '', category varchar not null default 'GENERAL_INQUIRY',
  priority varchar not null default 'MEDIUM', status varchar not null default 'OPEN',
  assigned_user_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), closed_at timestamptz
);
create table if not exists public.ticket_messages (
  id varchar primary key, ticket_id varchar not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  sender_role varchar not null default 'CUSTOMER', content text not null, created_at timestamptz not null default now()
);
create index if not exists support_tickets_tenant_updated_idx on public.support_tickets(tenant_id, updated_at desc);
create index if not exists support_tickets_requester_idx on public.support_tickets(requester_id, updated_at desc);
create index if not exists ticket_messages_ticket_created_idx on public.ticket_messages(ticket_id, created_at asc);
alter table public.support_tickets enable row level security; alter table public.ticket_messages enable row level security;

drop policy if exists support_tickets_select_member on public.support_tickets;
create policy support_tickets_select_member on public.support_tickets for select to authenticated using (
 requester_id=auth.uid() or assigned_user_id=auth.uid() or exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=support_tickets.tenant_id and m.status='ACTIVE' and upper(m.role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','SUPPORT','SUPPORT_MANAGER'))
);
drop policy if exists support_tickets_insert_self on public.support_tickets;
create policy support_tickets_insert_self on public.support_tickets for insert to authenticated with check (
 requester_id=auth.uid() and exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=support_tickets.tenant_id and m.status='ACTIVE')
);
drop policy if exists support_tickets_update_staff on public.support_tickets;
create policy support_tickets_update_staff on public.support_tickets for update to authenticated using (
 exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=support_tickets.tenant_id and m.status='ACTIVE' and upper(m.role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','SUPPORT','SUPPORT_MANAGER'))
) with check (true);

drop policy if exists ticket_messages_select_member on public.ticket_messages;
create policy ticket_messages_select_member on public.ticket_messages for select to authenticated using (
 exists(select 1 from public.support_tickets t where t.id=ticket_messages.ticket_id and (t.requester_id=auth.uid() or t.assigned_user_id=auth.uid() or exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=t.tenant_id and m.status='ACTIVE' and upper(m.role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','SUPPORT','SUPPORT_MANAGER'))))
);
drop policy if exists ticket_messages_insert_member on public.ticket_messages;
create policy ticket_messages_insert_member on public.ticket_messages for insert to authenticated with check (
 sender_user_id=auth.uid() and exists(select 1 from public.support_tickets t where t.id=ticket_messages.ticket_id and (t.requester_id=auth.uid() or t.assigned_user_id=auth.uid() or exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=t.tenant_id and m.status='ACTIVE' and upper(m.role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','SUPPORT','SUPPORT_MANAGER'))))
);

create table if not exists public.platform_feature_flags (
  id varchar primary key, scope_type varchar not null, scope_id varchar, sector_id varchar,
  tenant_id varchar references public.tenants(id) on delete cascade, business_id uuid references public.businesses(id) on delete cascade,
  branch_id varchar references public.branches(id) on delete cascade, module_code varchar not null, feature_code varchar,
  enabled boolean not null default true, configuration jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_feature_flags_scope_ck check(scope_type in ('GLOBAL','SECTOR','TENANT','BUSINESS','BRANCH','WIDGET'))
);
create unique index if not exists platform_feature_flags_unique_idx on public.platform_feature_flags(scope_type,coalesce(scope_id,''),coalesce(sector_id,''),coalesce(tenant_id,''),coalesce(business_id::text,''),coalesce(branch_id,''),module_code,coalesce(feature_code,''));
alter table public.platform_feature_flags enable row level security;

create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.status='ACTIVE' and upper(m.role) in ('ADMIN','SUPER_ADMIN'));
$$;
drop policy if exists feature_flags_read_member on public.platform_feature_flags;
create policy feature_flags_read_member on public.platform_feature_flags for select to authenticated using (
 public.is_platform_admin() or tenant_id is null or exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.status='ACTIVE' and m.tenant_id=platform_feature_flags.tenant_id and (m.business_id=platform_feature_flags.business_id or platform_feature_flags.business_id is null) and (m.branch_id=platform_feature_flags.branch_id or platform_feature_flags.branch_id is null))
);
drop policy if exists feature_flags_write_admin on public.platform_feature_flags;
create policy feature_flags_write_admin on public.platform_feature_flags for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());

create or replace function public.resolve_platform_feature(p_tenant_id varchar,p_business_id uuid,p_branch_id varchar,p_module_code varchar,p_feature_code varchar default null,p_sector_id varchar default null)
returns table(enabled boolean,source_scope varchar,configuration jsonb) language plpgsql stable security definer set search_path=public as $$
declare r record;
begin
 select f.enabled,f.scope_type,f.configuration into r from public.platform_feature_flags f
 where f.module_code=p_module_code and (f.feature_code is not distinct from p_feature_code)
 and ((f.scope_type='WIDGET' and f.branch_id is not distinct from p_branch_id and f.business_id is not distinct from p_business_id and f.tenant_id=p_tenant_id)
 or (f.scope_type='BRANCH' and f.branch_id is not distinct from p_branch_id and f.tenant_id=p_tenant_id and f.feature_code is null)
 or (f.scope_type='BUSINESS' and f.business_id is not distinct from p_business_id and f.tenant_id=p_tenant_id and f.feature_code is null)
 or (f.scope_type='TENANT' and f.tenant_id=p_tenant_id and f.feature_code is null)
 or (f.scope_type='SECTOR' and f.sector_id is not distinct from p_sector_id and f.feature_code is null)
 or (f.scope_type='GLOBAL' and f.feature_code is null))
 order by case f.scope_type when 'WIDGET' then 1 when 'BRANCH' then 2 when 'BUSINESS' then 3 when 'TENANT' then 4 when 'SECTOR' then 5 when 'GLOBAL' then 6 else 99 end limit 1;
 if not found then return query select true,'DEFAULT','{}'::jsonb; else return query select r.enabled,r.scope_type,r.configuration; end if;
end; $$;
revoke all on function public.resolve_platform_feature(varchar,uuid,varchar,varchar,varchar,varchar) from public;
grant execute on function public.resolve_platform_feature(varchar,uuid,varchar,varchar,varchar,varchar) to authenticated;

create or replace function public.create_support_ticket_backend(p_id varchar,p_tenant_id varchar,p_business_id uuid,p_subject varchar,p_description text,p_category varchar,p_priority varchar)
returns public.support_tickets language plpgsql security definer set search_path=public as $$
declare r public.support_tickets;
begin
 if not exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=p_tenant_id and m.status='ACTIVE') then raise exception 'TENANT_MEMBERSHIP_REQUIRED'; end if;
 insert into public.support_tickets(id,tenant_id,requester_id,business_id,subject,description,category,priority) values(p_id,p_tenant_id,auth.uid(),p_business_id,p_subject,p_description,p_category,p_priority)
 on conflict(id) do update set subject=excluded.subject returning * into r; return r;
end; $$;
grant execute on function public.create_support_ticket_backend(varchar,varchar,uuid,varchar,text,varchar,varchar) to authenticated;

create or replace function public.append_ticket_message_backend(p_id varchar,p_ticket_id varchar,p_content text,p_sender_role varchar)
returns public.ticket_messages language plpgsql security definer set search_path=public as $$
declare t public.support_tickets; r public.ticket_messages;
begin
 select * into t from public.support_tickets where id=p_ticket_id; if not found then raise exception 'TICKET_NOT_FOUND'; end if;
 if not(t.requester_id=auth.uid() or t.assigned_user_id=auth.uid() or exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=t.tenant_id and m.status='ACTIVE' and upper(m.role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','SUPPORT','SUPPORT_MANAGER'))) then raise exception 'TICKET_ACCESS_DENIED'; end if;
 insert into public.ticket_messages(id,ticket_id,sender_user_id,sender_role,content) values(p_id,p_ticket_id,auth.uid(),p_sender_role,p_content) returning * into r;
 update public.support_tickets set updated_at=now() where id=p_ticket_id; return r;
end; $$;
grant execute on function public.append_ticket_message_backend(varchar,varchar,text,varchar) to authenticated;

create or replace function public.mark_notifications_read_backend(p_notification_id varchar default null)
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 update public.notifications set read_at=coalesce(read_at,now()) where user_id=auth.uid() and (p_notification_id is null or id=p_notification_id);
 get diagnostics n=row_count; return n;
end; $$;
grant execute on function public.mark_notifications_read_backend(varchar) to authenticated;
