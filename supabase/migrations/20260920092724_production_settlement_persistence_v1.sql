create index if not exists idx_settlement_transactions_tenant_created on public.settlement_transactions(tenant_id, created_at desc);
create index if not exists idx_settlement_transactions_reference on public.settlement_transactions(reference_id);
