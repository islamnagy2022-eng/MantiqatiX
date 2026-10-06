-- MantiGO financial config is backend-only configuration.
-- The table has no direct anon/authenticated DML grants; privileged SECURITY DEFINER
-- functions read/write it after their own authorization checks.
alter table public.mantigo_financial_config enable row level security;
