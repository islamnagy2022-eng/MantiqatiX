-- READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE
-- Source: read-only information_schema/pg_constraint/pg_indexes/pg_class catalog queries
-- against Supabase project moyhiluyhjsujhwlyeuu on 2026-10-13.
-- This is NOT recovered historical creation DDL. NEVER apply this file to production.
-- CI injects it only into a fresh disposable migration replay before the historical
-- settlement_attempts_finance_read policy migration. No rows or sensitive data included.
-- The table policy and grants are intentionally omitted; the chronological historical
-- migration creates the policy and the fixture must not bypass the real security path.
-- The observed idx_settlement_attempts_obligation index has no creation statement in the
-- tracked migration history and is included here only to reproduce the disposable catalog shape.

CREATE TABLE public.settlement_attempts (
  id character varying NOT NULL,
  tenant_id character varying NOT NULL,
  obligation_id character varying NOT NULL,
  provider character varying NOT NULL,
  destination_id character varying,
  amount numeric NOT NULL,
  currency character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'PENDING',
  external_reference character varying,
  failure_code character varying,
  failure_message text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT settlement_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT settlement_attempts_amount_check CHECK (amount > 0),
  CONSTRAINT settlement_attempts_destination_id_fkey
    FOREIGN KEY (destination_id) REFERENCES public.payout_destinations(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_attempts_obligation_id_fkey
    FOREIGN KEY (obligation_id) REFERENCES public.financial_obligations(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_attempts_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_attempts_obligation_id_external_reference_key
    UNIQUE (obligation_id, external_reference)
);

CREATE INDEX idx_settlement_attempts_obligation
  ON public.settlement_attempts USING btree (obligation_id, created_at DESC);

ALTER TABLE public.settlement_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_attempts FORCE ROW LEVEL SECURITY;
