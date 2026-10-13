alter table public.payment_intents add column if not exists provider_order_id text;
create unique index if not exists uq_payment_intents_provider_order on public.payment_intents(provider,provider_order_id) where provider_order_id is not null;
