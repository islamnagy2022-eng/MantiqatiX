# RC439 — Encrypted Paymob checkout recovery

## Purpose
Recover a previously-created Paymob checkout after the browser loses the Edge Function response, without creating a second payment intention and without storing client_secret in plaintext.

## Required Edge Function secrets
- PAYMOB_CHECKOUT_ENCRYPTION_KEY_VERSION=v1
- PAYMOB_CHECKOUT_ENCRYPTION_KEY_V1=<base64 of exactly 32 random bytes>

Generate a key in a trusted operator environment:

~~~sh
openssl rand -base64 32
~~~

Store the output directly in the secret manager; do not commit it, paste it into an issue, or log it. Configure it for the correct Supabase project before deploying the updated subscription-payment-intent Edge Function. Never use the same key across development, staging, and production.

## Runtime behavior
- AES-256-GCM encrypts the Paymob client secret with a fresh 96-bit random IV.
- The ciphertext, IV, and key version are persisted in the same conditional database update as the provider intent/order IDs and CORRELATED state.
- The API response strips encrypted storage columns and internal pricing/idempotency metadata.
- A retry with the same idempotency key and an already-correlated PENDING intent decrypts the stored secret and returns the existing checkout URL. It does not call Paymob's create-intention endpoint again.
- If a legacy intent has provider IDs but no encrypted secret, the endpoint returns CHECKOUT_RECOVERY_UNAVAILABLE and requires reconciliation. It must not create a replacement intention automatically.
- If Paymob accepted the intention but persistence failed before the provider IDs and ciphertext were stored, the result remains unknown and requires reconciliation; this change does not claim to eliminate every network/database ambiguity.

## Key rotation
1. Add the new versioned key to Supabase Edge Function secrets, retaining the old version key.
2. Set PAYMOB_CHECKOUT_ENCRYPTION_KEY_VERSION to the new version.
3. Deploy and verify successful create/retry recovery using Paymob sandbox.
4. Retain each old key until all rows using that version have been re-encrypted or expired and reconciled.
5. Never remove an old key while rows still reference its version.

## Verification before release
- Apply RC435 and RC439 to a disposable PostgreSQL database in migration order.
- Run the subscription intent integration test and source validator.
- Verify with sandbox that a second request after simulated client-response loss returns the same checkout URL and creates no second Paymob intention.
- Verify logs never include the client secret, encryption key, or ciphertext payload.
- Configure secrets and deploy the Edge Function only in an approved change window. This runbook does not authorize production deployment.
