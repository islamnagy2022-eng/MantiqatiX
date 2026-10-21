-- RC457 concurrent duplicate-delivery workload; run against the disposable fixture only.
select public.process_verified_mantigo_paymob_event(
  'ledger-concurrent',
  'paymob:txn-concurrent',
  'PAID',
  true,
  33.00,
  'EGP',
  'txn-concurrent',
  jsonb_build_object('obj', jsonb_build_object('order', jsonb_build_object('merchant_order_id','ledger-concurrent')))
);
