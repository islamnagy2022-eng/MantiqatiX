-- OWNER-APPROVED TEST-ONLY LIVE-DERIVED CREDIT SCHEMA BASELINE
-- Approved by project owner on 2026-10-13 for disposable CI migration replay only.
-- Read-only source: catalog metadata from Supabase project moyhiluyhjsujhwlyeuu, 2026-10-13.
-- This is NOT recovered historical creation DDL and does NOT establish how/when production tables were first created.
-- This fixture exists solely to supply the observed table shape before the candidate's first dependent migration.
-- It is injected into an ephemeral CI migration directory and must NEVER be applied to production.
-- No production rows, tenant data, customer data, or financial records are included.
-- Finance-read policies are created by the later ordered migration 20260920211717; do not duplicate them here.
-- Extra restrictive live policies are not included because their historical creation lineage is not represented in the applied ledger.

CREATE TABLE public.credit_accounts (
  id character varying NOT NULL,
  tenant_id character varying NOT NULL,
  business_id uuid NOT NULL,
  credit_policy_id character varying NOT NULL,
  approved_limit numeric(18,2) NOT NULL DEFAULT 0,
  outstanding_amount numeric(18,2) NOT NULL DEFAULT 0,
  available_amount numeric(18,2) GENERATED ALWAYS AS (GREATEST((approved_limit - outstanding_amount), (0)::numeric)) STORED,
  status character varying NOT NULL DEFAULT 'ACTIVE',
  next_due_date date,
  last_payment_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT credit_accounts_tenant_id_business_id_key UNIQUE (tenant_id, business_id),
  CONSTRAINT credit_accounts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT credit_accounts_credit_policy_id_fkey FOREIGN KEY (credit_policy_id) REFERENCES public.credit_policies(id),
  CONSTRAINT credit_accounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT credit_accounts_approved_limit_check CHECK (approved_limit >= 0::numeric),
  CONSTRAINT credit_accounts_outstanding_amount_check CHECK (outstanding_amount >= 0::numeric),
  CONSTRAINT credit_accounts_status_check CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'WARNING'::character varying, 'OVERDUE'::character varying, 'SUSPENDED'::character varying, 'BLOCKED'::character varying, 'CLOSED'::character varying]::text[]))
);
CREATE INDEX idx_credit_accounts_tenant_status ON public.credit_accounts USING btree (tenant_id, status);
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_accounts FORCE ROW LEVEL SECURITY;
