# RC63 — Production Edge Function Inventory & Legacy Webhook Review

Date: 2026-09-28

## Inventory result

The live project currently exposes multiple ACTIVE Edge Functions. The canonical release paths verified in this program include:

- api v10
- order-create v3
- order-status-update v2
- payment-intent v4
- paymob-webhook v4
- settlement-create v3
- mnty-registration-review v3

The live project also contains an ACTIVE `payment-webhook` v1 with JWT verification disabled. This function is not represented in the current tracked GitHub source search.

## Security review of the legacy/untracked webhook

The deployed `payment-webhook` v1 requires:
- POST only;
- `MANTIQATIX_WEBHOOK_SECRET`;
- timestamp freshness within 300 seconds;
- HMAC-SHA256 signature over `timestamp.body`;
- constant-time comparison;
- provider `signatureVerified=true` before calling `process_verified_provider_payment`.

It therefore has an authentication boundary, but its production-only/untracked status means its ownership, caller, routing, and continued necessity are not established from the tracked repository evidence.

## Decision

No deletion or modification was made. Removing an unknown production endpoint without confirming its routing/dependencies could break payment processing. It is now an explicit release inventory item requiring ownership/routing confirmation.

The canonical Paymob path remains `paymob-webhook` v4. This review does not certify or de-certify the legacy endpoint; it prevents it from being silently ignored.

No privilege, secret, migration, or production endpoint was changed in this checkpoint.
