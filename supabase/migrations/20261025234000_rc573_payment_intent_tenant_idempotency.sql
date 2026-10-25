-- RC573: enforce payment-intent idempotency at the database boundary.
-- Forward-only: historical payment intents are never rewritten or deleted.
begin;

do $$
begin
  if exists (
    select 1
    from public.payment_intents
    group by tenant_id, idempotency_key
    having count(*) > 1
  ) then
    raise exception 'RC573_BLOCKED_DUPLICATE_PAYMENT_IDEMPOTENCY_KEYS';
  end if;
end;
$$;

create unique index if not exists uq_payment_intents_tenant_idempotency
  on public.payment_intents (tenant_id, idempotency_key);

commit;
