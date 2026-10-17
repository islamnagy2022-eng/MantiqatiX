-- Disposable RC427 fixture. Never apply to the live Supabase project.
create table public.payment_intents (
  id uuid primary key,
  order_id uuid not null,
  status text not null
);
