-- MantiGO financial config: deny direct client table access and require RLS.
-- Configuration is intentionally consumed through SECURITY DEFINER backend RPCs.
alter table public.mantigo_financial_config enable row level security;

comment on table public.mantigo_financial_config is
  'Internal MantiGO commission configuration. Accessed through SECURITY DEFINER backend RPCs only; direct client table access is intentionally denied.';
