-- MantiGO financial config is backend-only configuration.
-- The production migration history already contains this change under 20261006122111.
-- Keep the repository migration source synchronized with production.
alter table public.mantigo_financial_config enable row level security;
