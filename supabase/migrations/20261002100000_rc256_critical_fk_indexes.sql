-- RC256: cover critical production foreign keys used by order, payment, catalog, digital-page, and onboarding paths.
-- Non-destructive indexes; each uses IF NOT EXISTS for safe re-application.
create index if not exists idx_branches_organization_id on public.branches (organization_id);
create index if not exists idx_catalog_item_prices_branch_id on public.catalog_item_prices (branch_id);
create index if not exists idx_digital_page_orders_product_id on public.digital_page_orders (product_id);
create index if not exists idx_digital_page_payment_events_order_id on public.digital_page_payment_events (digital_page_order_id);
create index if not exists idx_orders_assigned_partner_id on public.orders (assigned_partner_id);
create index if not exists idx_orders_business_id on public.orders (business_id);
create index if not exists idx_orders_organization_id on public.orders (organization_id);
create index if not exists idx_payment_provider_events_tenant_id on public.payment_provider_events (tenant_id);
create index if not exists idx_provider_onboarding_requests_organization_id on public.provider_onboarding_requests (organization_id);
create index if not exists idx_provider_onboarding_requests_reviewed_by on public.provider_onboarding_requests (reviewed_by);
create index if not exists idx_provider_onboarding_requests_tenant_id on public.provider_onboarding_requests (tenant_id);
