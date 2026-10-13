-- PHASE 14A: Payment Method / Provider Architecture Refactor

-- 1. Modify tenant_payment_methods
ALTER TABLE tenant_payment_methods
ADD COLUMN payment_method VARCHAR(32);

-- For existing records, set payment_method to provider as a fallback
UPDATE tenant_payment_methods SET payment_method = provider WHERE payment_method IS NULL;

ALTER TABLE tenant_payment_methods
ALTER COLUMN payment_method SET NOT NULL;

-- Drop old unique constraint
ALTER TABLE tenant_payment_methods DROP CONSTRAINT IF EXISTS uk_tenant_provider;

-- Add new unique constraint
ALTER TABLE tenant_payment_methods ADD CONSTRAINT uk_tenant_method_provider UNIQUE (tenant_id, payment_method, provider);

-- 2. Modify payment_intents
ALTER TABLE payment_intents
ADD COLUMN payment_method VARCHAR(32);

UPDATE payment_intents SET payment_method = provider WHERE payment_method IS NULL;

ALTER TABLE payment_intents
ALTER COLUMN payment_method SET NOT NULL;

-- 3. Recreate the available_payment_methods view to include payment_method
DROP VIEW IF EXISTS available_payment_methods;

CREATE VIEW available_payment_methods AS
SELECT id, tenant_id, payment_method, provider, public_config
FROM tenant_payment_methods
WHERE is_enabled = true
AND EXISTS (
SELECT 1 FROM user_memberships
WHERE user_memberships.user_id = auth.uid()
AND user_memberships.tenant_id = tenant_payment_methods.tenant_id
);

-- Secure grants for the updated view
REVOKE ALL ON available_payment_methods FROM PUBLIC;

GRANT SELECT ON available_payment_methods TO authenticated;
