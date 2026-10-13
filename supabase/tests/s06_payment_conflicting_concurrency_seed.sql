-- Disposable-only seed for a race between conflicting statuses for one provider event ID.
delete from public.digital_page_payment_events
where external_event_id = 'paymob:s06-conflicting-race';

insert into public.digital_page_orders
  (id, provider, amount, currency, provider_order_id, payment_status, fulfillment_status, provider_transaction_id)
values
  ('10000000-0000-4000-8000-000000006064', 'PAYMOB', 249.50, 'EGP',
   's06-conflicting-race-order', 'PENDING', 'REQUESTED', null)
on conflict (id) do update
set provider = excluded.provider,
    amount = excluded.amount,
    currency = excluded.currency,
    provider_order_id = excluded.provider_order_id,
    payment_status = 'PENDING',
    fulfillment_status = 'REQUESTED',
    provider_transaction_id = null,
    updated_at = now();
