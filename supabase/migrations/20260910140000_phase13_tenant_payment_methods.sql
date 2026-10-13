-- PHASE 13: Per-Tenant Payment Methods

CREATE TABLE IF NOT EXISTS tenant_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL, -- 'CASH_ON_DELIVERY', 'BANK_TRANSFER', 'MOBILE_WALLET', 'FAWRY', 'CARD'
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    public_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Safe client-facing config (e.g. bank_name, account_number, wallet_number, display_name, instructions)
    provider_secrets JSONB NOT NULL DEFAULT '{}'::jsonb, -- Server-side only secrets (API keys, webhooks)
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tenant_provider UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tpm_tenant_enabled ON tenant_payment_methods(tenant_id, is_enabled);

-- RLS
ALTER TABLE tenant_payment_methods ENABLE ROW LEVEL SECURITY;

-- 1. Read: Customers can read ENABLED payment methods (but WITHOUT secrets)
-- Actually, PostgREST doesn't support column-level SELECT RLS natively without views. 
-- We should create a view for available methods.
CREATE OR REPLACE VIEW available_payment_methods AS
SELECT id, tenant_id, provider, public_config
FROM tenant_payment_methods
WHERE is_enabled = true
AND EXISTS (
    SELECT 1 FROM user_memberships
    WHERE user_memberships.user_id = auth.uid()
      AND user_memberships.tenant_id = tenant_payment_methods.tenant_id
);

-- For owners/admins/managers: can manage their own tenant payment methods
CREATE POLICY "Tenant admins can manage payment methods" ON tenant_payment_methods
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_memberships
        WHERE user_memberships.user_id = auth.uid()
          AND user_memberships.tenant_id = tenant_payment_methods.tenant_id
          AND user_memberships.role IN ('OWNER', 'ADMIN', 'MANAGER')
          AND user_memberships.status = 'ACTIVE'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_memberships
        WHERE user_memberships.user_id = auth.uid()
          AND user_memberships.tenant_id = tenant_payment_methods.tenant_id
          AND user_memberships.role IN ('OWNER', 'ADMIN', 'MANAGER')
          AND user_memberships.status = 'ACTIVE'
    )
);

-- Note: We do not expose provider_secrets in any client view.
-- SECURE GRANTS FOR VIEW
REVOKE ALL ON available_payment_methods FROM PUBLIC;

GRANT SELECT ON available_payment_methods TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_payment_methods TO service_role;
