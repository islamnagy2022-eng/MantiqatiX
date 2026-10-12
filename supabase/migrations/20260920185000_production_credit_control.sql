-- Credit control: monthly limits, due dates, grace periods and non-payment states.
-- All tables are tenant scoped and protected by RLS.

CREATE TABLE IF NOT EXISTS public.credit_policies (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  policy_name varchar NOT NULL,
  credit_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  billing_cycle varchar NOT NULL DEFAULT 'MONTHLY' CHECK (billing_cycle = 'MONTHLY'),
  payment_due_days integer NOT NULL DEFAULT 30 CHECK (payment_due_days BETWEEN 0 AND 90),
  grace_days integer NOT NULL DEFAULT 7 CHECK (grace_days BETWEEN 0 AND 30),
  warning_days integer NOT NULL DEFAULT 3 CHECK (warning_days BETWEEN 0 AND 30),
  suspend_after_days integer NOT NULL DEFAULT 30 CHECK (suspend_after_days BETWEEN 0 AND 120),
  block_new_credit boolean NOT NULL DEFAULT false,
  status varchar NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  UNIQUE (tenant_id, business_id)
);

CREATE TABLE IF NOT EXISTS public.credit_accounts (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  credit_policy_id varchar NOT NULL REFERENCES public.credit_policies(id) ON DELETE RESTRICT,
  approved_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK (approved_limit >= 0),
  outstanding_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (outstanding_amount >= 0),
  available_amount numeric(14,2) GENERATED ALWAYS AS (GREATEST(approved_limit - outstanding_amount, 0)) STORED,
  status varchar NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','WARNING','OVERDUE','SUSPENDED','BLOCKED','CLOSED')),
  next_due_date date,
  last_payment_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  UNIQUE (tenant_id, business_id)
);

CREATE TABLE IF NOT EXISTS public.credit_periods (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  credit_account_id varchar NOT NULL REFERENCES public.credit_accounts(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  billed_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (billed_amount >= 0),
  paid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  outstanding_amount numeric(14,2) GENERATED ALWAYS AS (GREATEST(billed_amount - paid_amount, 0)) STORED,
  status varchar NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','DUE','PARTIALLY_PAID','PAID','OVERDUE','DEFAULTED')),
  paid_at timestamptz,
  days_overdue integer NOT NULL DEFAULT 0 CHECK (days_overdue >= 0),
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  UNIQUE (credit_account_id, period_start, period_end)
);

ALTER TABLE public.credit_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.credit_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_periods FORCE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['credit_policies','credit_accounts','credit_periods'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND policyname='authenticated_sessions_only'
    ) THEN
      EXECUTE format(
        'CREATE POLICY authenticated_sessions_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (COALESCE((auth.jwt() ->> ''is_anonymous''), ''false'') <> ''true'') WITH CHECK (COALESCE((auth.jwt() ->> ''is_anonymous''), ''false'') <> ''true'')',
        t
      );
    END IF;
  END LOOP;
END $$;
