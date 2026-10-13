-- OWNER-APPROVED TEST-ONLY LIVE-DERIVED CREDIT SCHEMA BASELINE
-- Approved by project owner on 2026-10-13 for disposable CI migration replay only.
-- Read-only source: catalog metadata from Supabase project moyhiluyhjsujhwlyeuu, 2026-10-13.
-- This is NOT recovered historical creation DDL and does NOT establish how/when production tables were first created.
-- This fixture exists solely to supply the observed table shape before the candidate's first dependent migration.
-- It is injected into an ephemeral CI migration directory and must NEVER be applied to production.
-- No production rows, tenant data, customer data, or financial records are included.
-- Finance-read policies are created by the later ordered migration 20260920211717; do not duplicate them here.
-- Extra restrictive live policies are not included because their historical creation lineage is not represented in the applied ledger.

CREATE TABLE public.credit_policies (
  id character varying NOT NULL,
  tenant_id character varying NOT NULL,
  business_id uuid NOT NULL,
  policy_name character varying NOT NULL,
  credit_limit numeric(18,2) NOT NULL DEFAULT 0,
  billing_cycle character varying NOT NULL DEFAULT 'MONTHLY',
  payment_due_days integer NOT NULL DEFAULT 30,
  grace_days integer NOT NULL DEFAULT 0,
  warning_days integer NOT NULL DEFAULT 3,
  suspend_after_days integer NOT NULL DEFAULT 15,
  block_new_credit boolean NOT NULL DEFAULT true,
  status character varying NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_policies_pkey PRIMARY KEY (id),
  CONSTRAINT credit_policies_tenant_id_business_id_key UNIQUE (tenant_id, business_id),
  CONSTRAINT credit_policies_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT credit_policies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT credit_policies_billing_cycle_check CHECK (billing_cycle::text = 'MONTHLY'::text),
  CONSTRAINT credit_policies_credit_limit_check CHECK (credit_limit >= 0::numeric),
  CONSTRAINT credit_policies_grace_days_check CHECK (grace_days >= 0 AND grace_days <= 30),
  CONSTRAINT credit_policies_payment_due_days_check CHECK (payment_due_days >= 0 AND payment_due_days <= 90),
  CONSTRAINT credit_policies_status_check CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'SUSPENDED'::character varying, 'CLOSED'::character varying]::text[])),
  CONSTRAINT credit_policies_suspend_after_days_check CHECK (suspend_after_days >= 0 AND suspend_after_days <= 120),
  CONSTRAINT credit_policies_warning_days_check CHECK (warning_days >= 0 AND warning_days <= 30)
);
CREATE INDEX idx_credit_policies_tenant ON public.credit_policies USING btree (tenant_id);
ALTER TABLE public.credit_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_policies FORCE ROW LEVEL SECURITY;
