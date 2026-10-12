-- Harden payment_intents
ALTER TABLE payment_intents ALTER COLUMN currency DROP DEFAULT;

ALTER TABLE payment_intents ADD CONSTRAINT chk_payment_status CHECK (status IN ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'));
