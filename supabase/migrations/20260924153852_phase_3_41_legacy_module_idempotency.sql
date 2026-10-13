
create table if not exists public.legacy_module_idempotency (
  module_code text not null,
  actor_user_id uuid not null,
  idempotency_key text not null,
  request_hash text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (module_code, actor_user_id, idempotency_key)
);
alter table public.legacy_module_idempotency enable row level security;
alter table public.legacy_module_idempotency force row level security;
