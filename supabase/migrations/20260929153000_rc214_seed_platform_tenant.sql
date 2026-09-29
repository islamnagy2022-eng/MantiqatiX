-- RC214: Production platform tenant baseline.
-- Customer registration depends on this canonical tenant.
-- Idempotent by design; does not create any privileged membership.

insert into public.tenants(id,name,code,status,settings)
select 'MNTY-PLATFORM','MNTY Platform','MNTY-PLATFORM','ACTIVE','{}'::jsonb
where not exists (
  select 1 from public.tenants where id='MNTY-PLATFORM'
);

update public.tenants
set name='MNTY Platform',
    code='MNTY-PLATFORM',
    status='ACTIVE',
    updated_at=now()
where id='MNTY-PLATFORM'
  and status <> 'ACTIVE';
