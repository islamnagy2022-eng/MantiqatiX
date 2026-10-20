-- RC459: enable cash-on-delivery for tenants with at least one active business.
-- Electronic providers remain disabled; existing tenant-specific payment method rows are preserved.
begin;
insert into public.tenant_payment_methods (
  tenant_id, provider, is_enabled, public_config, provider_secrets, payment_method
)
select distinct
  b.tenant_id,
  'CASH_ON_DELIVERY',
  true,
  '{}'::jsonb,
  '{}'::jsonb,
  'CASH_ON_DELIVERY'
from public.businesses b
where upper(coalesce(b.status, '')) = 'ACTIVE'
  and nullif(trim(b.tenant_id), '') is not null
on conflict (tenant_id, payment_method, provider) do nothing;
commit;
