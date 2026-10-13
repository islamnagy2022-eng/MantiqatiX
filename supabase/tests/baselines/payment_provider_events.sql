-- READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE
-- Captured: 2026-10-13 from read-only PostgreSQL catalog introspection of Supabase project moyhiluyhjsujhwlyeuu.
-- Table: public.payment_provider_events.
-- This is not recovered historical creation DDL and is not approval to change production.
-- Disposable migration replay only; NEVER apply this file to production or move it into supabase/migrations.
-- Contains schema only: no payment events, provider payloads, IDs, customer data, secrets, policies, or grants.
-- The ordered migration 20260920211717_security_definer_surface_reduction_and_finance_rls.sql creates
-- payment_provider_events_finance_read. Do not duplicate that policy here.
-- RC256 creates idx_payment_provider_events_tenant_id. The tracked migration history has no creation statement for
-- idx_payment_provider_events_payment_intent_id, so that observed catalog index is reproduced here for disposable parity.

CREATE TABLE public.payment_provider_events (
  id character varying NOT NULL,
  tenant_id character varying NOT NULL,
  provider character varying NOT NULL,
  event_type character varying NOT NULL,
  payment_intent_id character varying,
  external_event_id character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'RECEIVED',
  signature_verified boolean NOT NULL DEFAULT false,
  payload_hash character varying,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payment_provider_events_pkey PRIMARY KEY (id),
  CONSTRAINT payment_provider_events_provider_external_event_id_key UNIQUE (provider, external_event_id),
  CONSTRAINT payment_provider_events_payment_intent_id_fkey
    FOREIGN KEY (payment_intent_id) REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  CONSTRAINT payment_provider_events_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

CREATE INDEX idx_payment_provider_events_payment_intent_id ON public.payment_provider_events (payment_intent_id);

ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_provider_events FORCE ROW LEVEL SECURITY;
