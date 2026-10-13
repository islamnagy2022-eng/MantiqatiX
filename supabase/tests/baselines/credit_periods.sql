-- OWNER-APPROVED TEST-ONLY LIVE-DERIVED CREDIT SCHEMA BASELINE
-- Approved by project owner on 2026-10-13 for disposable CI migration replay only.
-- Read-only source: catalog metadata from Supabase project moyhiluyhjsujhwlyeuu, 2026-10-13.
-- This is NOT recovered historical creation DDL and does NOT establish how/when production tables were first created.
-- This fixture exists solely to supply the observed table shape before the candidate's first dependent migration.
-- It is injected into an ephemeral CI migration directory and must NEVER be applied to production.
-- No production rows, tenant data, customer data, or financial records are included.
-- Finance-read policies are created by the later ordered migration 20260920211717; do not duplicate them here.
-- Extra restrictive live policies are not included because their historical creation lineage is not represented in the applied ledger.

CREATE TABLE public.credit_periods (
  id character varying NOT NULL,
  tenant_id character varying NOT NULL,
  credit_account_id character varying NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  billed_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  outstanding_amount numeric GENERATED ALWAYS AS (GREATEST((billed_amount - paid_amount), (0)::numeric)) STORED,
  status character varying NOT NULL DEFAULT 'OPEN',
  paid_at timestamptz,
  days_overdue integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_periods_pkey PRIMARY KEY (id),
  CONSTRAINT credit_periods_credit_account_id_period_start_period_end_key UNIQUE (credit_account_id, period_start, period_end),
  CONSTRAINT credit_periods_credit_account_id_fkey FOREIGN KEY (credit_account_id) REFERENCES public.credit_accounts(id) ON DELETE CASCADE,
  CONSTRAINT credit_periods_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT credit_periods_billed_amount_check CHECK (billed_amount >= 0::numeric),
  CONSTRAINT credit_periods_check CHECK (period_end >= period_start),
  CONSTRAINT credit_periods_days_overdue_check CHECK (days_overdue >= 0),
  CONSTRAINT credit_periods_paid_amount_check CHECK (paid_amount >= 0::numeric),
  CONSTRAINT credit_periods_status_check CHECK (status::text = ANY (ARRAY['OPEN'::character varying, 'DUE'::character varying, 'PARTIALLY_PAID'::character varying, 'PAID'::character varying, 'OVERDUE'::character varying, 'DEFAULTED'::character varying]::text[]))
);
CREATE INDEX idx_credit_periods_due ON public.credit_periods USING btree (tenant_id, due_date, status);
ALTER TABLE public.credit_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_periods FORCE ROW LEVEL SECURITY;
