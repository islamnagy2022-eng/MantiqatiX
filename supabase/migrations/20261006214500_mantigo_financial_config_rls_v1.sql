-- MantiGO financial configuration is backend-admin controlled.
-- The SECURITY DEFINER admin RPC performs its own auth + platform-admin checks.
-- Direct Data API CRUD must remain unavailable to anon/authenticated roles.

alter table public.mantigo_financial_config enable row level security;

revoke all on table public.mantigo_financial_config from anon, authenticated;
