-- Record the authoritative activation timestamp used by subscription-expiry reminders.
-- This is source-only until the release migration chain and all production gates are approved.

alter table public.digital_page_orders
  add column if not exists paid_at timestamptz;

create or replace function public.mnty_set_digital_page_paid_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.payment_status = 'PAID' and old.payment_status is distinct from 'PAID' then
    new.paid_at := coalesce(new.paid_at, pg_catalog.now());
    if new.updated_at is not distinct from old.updated_at then
      new.updated_at := pg_catalog.now();
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.mnty_set_digital_page_paid_at() from public, anon, authenticated;

drop trigger if exists digital_page_orders_paid_at_trigger on public.digital_page_orders;
create trigger digital_page_orders_paid_at_trigger
before update of payment_status on public.digital_page_orders
for each row
when (new.payment_status = 'PAID' and old.payment_status is distinct from 'PAID')
execute function public.mnty_set_digital_page_paid_at();

comment on column public.digital_page_orders.paid_at is
  'Authoritative time payment/activation was recorded; used for subscription term and expiry reminders.';
