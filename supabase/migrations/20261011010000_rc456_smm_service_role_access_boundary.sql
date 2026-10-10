-- RC456: restore the SMM gateway's least-privilege service-role table boundary.
-- The Edge Function authenticates every caller and enforces user/admin scope before using these grants.
begin;

revoke all on table
  public.smm_admins,
  public.smm_providers,
  public.smm_services,
  public.smm_orders,
  public.smm_wallets,
  public.smm_order_events
from public, anon, authenticated;

grant select on table
  public.smm_admins,
  public.smm_providers,
  public.smm_wallets
to service_role;

grant select, insert, update on table
  public.smm_services,
  public.smm_orders
to service_role;

grant insert on table public.smm_order_events to service_role;

-- Provider credentials remain RPC-only; wallet transactions remain RPC-only.
revoke all on table public.smm_provider_credentials, public.smm_wallet_transactions
from public, anon, authenticated, service_role;

commit;
