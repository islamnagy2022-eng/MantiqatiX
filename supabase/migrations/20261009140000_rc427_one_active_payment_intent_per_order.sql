-- RC427: prevent multiple active payment intents for one order.
-- Source-only until reviewed and applied to the intended Supabase project.
-- Fail closed if an existing environment already contains conflicting active intents.
do $$
begin
  if exists (
    select 1
    from public.payment_intents
    where upper(status) in ('CREATED', 'PENDING', 'SUCCEEDED')
    group by order_id
    having count(*) > 1
  ) then
    raise exception 'RC427_DUPLICATE_ACTIVE_PAYMENT_INTENTS_REQUIRE_RECONCILIATION';
  end if;
end $$;

create unique index if not exists uq_payment_intents_one_active_per_order
  on public.payment_intents (order_id)
  where upper(status) in ('CREATED', 'PENDING', 'SUCCEEDED');
