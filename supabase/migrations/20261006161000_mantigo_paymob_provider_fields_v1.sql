-- MantiGO electronic payment provider fields.
alter table public.mantigo_financial_ledger
  add column if not exists provider text,
  add column if not exists provider_intent_id text,
  add column if not exists provider_transaction_id text;

create unique index if not exists mantigo_financial_provider_intent_uidx
  on public.mantigo_financial_ledger(provider,provider_intent_id)
  where provider_intent_id is not null;
