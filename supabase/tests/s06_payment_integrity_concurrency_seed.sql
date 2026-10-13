-- Disposable-only seed for concurrent duplicate Paymob callback regression.
delete from public.digital_page_payment_events
where external_event_id = 'paymob:s06-concurrent-tx';

insert into public.digital_page_orders
  (id, provider, amount, currency, provider_order_id, payment_status, fulfillment_status, provider_transaction_id)
values
  ('10000000-0000-4000-8000-000000006063', 'PAYMOB', 249.50, 'EGP',
   's06-concurrency-provider-order', 'PENDING', 'REQUESTED', null)
on conflict (id) do update
set provider = excluded.provider,
    amount = excluded.amount,
    currency = excluded.currency,
    provider_order_id = excluded.provider_order_id,
    payment_status = 'PENDING',
    fulfillment_status = 'REQUESTED',
    provider_transaction_id = null,
    updated_at = now();
