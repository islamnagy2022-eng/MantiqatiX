-- OWNER-APPROVED TEST-ONLY SCHEMA BASELINE
-- Approved: 2026-10-11 for isolated migration replay only.
-- Source: read-only catalog snapshot of production public.smm_provider_credentials.
-- Never apply this file to production and never move it into supabase/migrations.
-- Prerequisite: public.smm_providers must exist from an authoritative source or a separately approved test-only baseline.
-- No production rows, credential values, or secrets are included.

create table public.smm_provider_credentials (
  provider_id uuid not null,
  api_key_ciphertext text,
  configured boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint smm_provider_credentials_pkey primary key (provider_id),
  constraint smm_provider_credentials_provider_id_fkey
    foreign key (provider_id)
    references public.smm_providers(id)
    on delete cascade
);

alter table public.smm_provider_credentials enable row level security;

create policy mnty_deny_unexposed_client_access
  on public.smm_provider_credentials
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.smm_provider_credentials
  from public, anon, authenticated, service_role;

grant references, trigger, truncate on table public.smm_provider_credentials
  to service_role;
