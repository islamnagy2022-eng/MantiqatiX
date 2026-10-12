-- RC463: enforce per-user SMM order idempotency at the database boundary.
-- Source-only until the complete post-RC424 migration chain is reconciled and approved.
begin;

alter table public.smm_orders
  add column if not exists idempotency_key text;

alter table public.smm_orders
  add constraint smm_orders_idempotency_key_format
  check (idempotency_key is null or idempotency_key ~ '^[A-Za-z0-9_-]{16,128}$');

create unique index if not exists smm_orders_user_idempotency_key_uidx
  on public.smm_orders (user_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.smm_orders.idempotency_key is
  'Client-generated stable key for safe SMM order retries; uniqueness is scoped to the authenticated user.';

commit;
