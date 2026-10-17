-- RC524: remove inherited/broad SMM service-role table privileges before granting the exact gateway boundary.
-- Forward-only correction for RC456: explicitly revoke dangerous TRUNCATE/REFERENCES/TRIGGER privileges.
-- This migration is source-only until reviewed and applied through the approved release process.
begin;

revoke all on table
  public.smm_admins,
  public.smm_providers,
  public.smm_services,
  public.smm_orders,
  public.smm_wallets,
  public.smm_order_events,
  public.smm_provider_credentials,
  public.smm_wallet_transactions
from public, anon, authenticated, service_role;

-- Trusted gateway reads only the admin allowlist, providers, and wallet balance.
grant select on table
  public.smm_admins,
  public.smm_providers,
  public.smm_wallets
to service_role;

-- The gateway needs to read and mutate catalog/order state, but not delete or truncate it.
grant select, insert, update on table
  public.smm_services,
  public.smm_orders
to service_role;

-- Event history is append-only from the gateway's perspective.
grant insert on table public.smm_order_events to service_role;

-- Provider credentials and wallet transactions are RPC-only.
-- No direct table grants are restored for either table.

commit;
