-- ============================================================
-- MantiqatiX
-- Phase 04 Reconciliation
-- Non-destructive schema alignment
--
-- IMPORTANT:
-- - Do NOT modify existing tenant ID types.
-- - tenant_id remains VARCHAR.
-- - business_id remains UUID.
-- - order_id remains UUID.
-- - Existing payment tables are preserved.
-- - No existing data is deleted.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. BUSINESSES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id VARCHAR NOT NULL
        REFERENCES public.tenants(id),

    organization_id VARCHAR NULL
        REFERENCES public.organizations(id),

    name VARCHAR NOT NULL,
    code VARCHAR NOT NULL,

    status VARCHAR NOT NULL DEFAULT 'ACTIVE',

    settings JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT businesses_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS businesses_tenant_code_uidx
ON public.businesses (tenant_id, code);

-- ============================================================
-- 2. BUSINESS -> ORGANIZATION / TENANT CONSISTENCY
-- ============================================================

CREATE INDEX IF NOT EXISTS businesses_tenant_id_idx
ON public.businesses (tenant_id);

CREATE INDEX IF NOT EXISTS businesses_organization_id_idx
ON public.businesses (organization_id);

-- ============================================================
-- 3. RECONNECT EXISTING TABLES TO BUSINESSES
-- ============================================================

-- branches.business_id already exists as UUID.
-- Add FK only if it does not already exist.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'branches_business_id_fkey'
          AND conrelid = 'public.branches'::regclass
    ) THEN
        ALTER TABLE public.branches
        ADD CONSTRAINT branches_business_id_fkey
        FOREIGN KEY (business_id)
        REFERENCES public.businesses(id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'departments_business_id_fkey'
          AND conrelid = 'public.departments'::regclass
    ) THEN
        ALTER TABLE public.departments
        ADD CONSTRAINT departments_business_id_fkey
        FOREIGN KEY (business_id)
        REFERENCES public.businesses(id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_memberships_business_id_fkey'
          AND conrelid = 'public.user_memberships'::regclass
    ) THEN
        ALTER TABLE public.user_memberships
        ADD CONSTRAINT user_memberships_business_id_fkey
        FOREIGN KEY (business_id)
        REFERENCES public.businesses(id);
    END IF;
END
$$;

-- ============================================================
-- 4. BUSINESS INDEXES FOR EXISTING TABLES
-- ============================================================

CREATE INDEX IF NOT EXISTS branches_business_id_idx
ON public.branches (business_id);

CREATE INDEX IF NOT EXISTS departments_business_id_idx
ON public.departments (business_id);

CREATE INDEX IF NOT EXISTS user_memberships_business_id_idx
ON public.user_memberships (business_id);

-- ============================================================
-- 5. ORGANIZATION / BUSINESS TENANT INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS organizations_tenant_id_idx
ON public.organizations (tenant_id);

-- ============================================================
-- 6. PAYMENT INTENT -> ORDER
--
-- orders does NOT exist yet.
-- Therefore we deliberately DO NOT create this FK here.
--
-- It will be added by the Orders reconciliation migration
-- after the canonical orders schema is restored.
-- ============================================================


-- ============================================================
-- 7. PAYMENT TENANT INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS payment_intents_tenant_id_idx
ON public.payment_intents (tenant_id);

CREATE INDEX IF NOT EXISTS payment_events_tenant_id_idx
ON public.payment_events (tenant_id);

CREATE INDEX IF NOT EXISTS payment_intents_order_id_idx
ON public.payment_intents (order_id);

-- ============================================================
-- 8. UPDATED_AT FUNCTION
--
-- Only create if absent.
-- Does not replace an existing implementation.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ============================================================
-- 9. BUSINESS UPDATED_AT TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS trg_businesses_updated_at
ON public.businesses;

CREATE TRIGGER trg_businesses_updated_at
BEFORE UPDATE ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 10. RLS
-- ============================================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 11. BUSINESS READ POLICY
--
-- A user can only read businesses belonging to a tenant in
-- which the user has an ACTIVE membership.
-- ============================================================

DROP POLICY IF EXISTS businesses_tenant_read
ON public.businesses;

CREATE POLICY businesses_tenant_read
ON public.businesses
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.user_memberships um
        WHERE um.user_id = auth.uid()
          AND um.tenant_id = businesses.tenant_id
          AND um.status = 'ACTIVE'
    )
);

-- ============================================================
-- 12. BUSINESS MANAGEMENT POLICY
--
-- OWNER / ADMIN / MANAGER only.
-- ============================================================

DROP POLICY IF EXISTS businesses_tenant_manage
ON public.businesses;

CREATE POLICY businesses_tenant_manage
ON public.businesses
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.user_memberships um
        WHERE um.user_id = auth.uid()
          AND um.tenant_id = businesses.tenant_id
          AND um.status = 'ACTIVE'
          AND um.role IN ('OWNER', 'ADMIN', 'MANAGER')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.user_memberships um
        WHERE um.user_id = auth.uid()
          AND um.tenant_id = businesses.tenant_id
          AND um.status = 'ACTIVE'
          AND um.role IN ('OWNER', 'ADMIN', 'MANAGER')
    )
);

COMMIT;
