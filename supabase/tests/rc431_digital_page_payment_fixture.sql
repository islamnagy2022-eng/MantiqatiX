-- Disposable RC431 fixture: only the columns required by the digital-page payment RPC.
create table public.digital_page_orders (
  id uuid primary key,
  provider text not null,
  amount numeric not null,
  currency text not null,
  provider_order_id text,
  payment_status text not null,
  fulfillment_status text not null,
  provider_transaction_id text,
  updated_at timestamptz not null default now()
);

create table public.digital_page_payment_events (
  id uuid primary key default gen_random_uuid(),
  digital_page_order_id uuid not null references public.digital_page_orders(id),
  provider text not null,
  external_event_id text not null unique,
  event_type text not null,
  status text not null,
  signature_verified boolean not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);


-- Inert fault injection: only fires when a test explicitly enables its transaction-local flag.
create or replace function public.rc431_test_reject_order_update()
returns trigger language plpgsql as $function$
begin
  if current_setting('mantiqatix_test.rc431_fail_update', true) = 'true'
     and new.payment_status = 'PAID' then
    raise exception 'RC431_TEST_ATOMIC_ORDER_UPDATE_FAILURE';
  end if;
  return new;
end;
$function$;

create trigger rc431_test_atomic_order_update
before update on public.digital_page_orders
for each row execute function public.rc431_test_reject_order_update();
