# Payment Webhook — Live Source Convergence

## Production evidence
- Supabase project: `moyhiluyhjsujhwlyeuu`
- Function: `payment-webhook`
- Production version: `1`
- `verify_jwt`: `false` by design for provider callbacks.
- Live source SHA-256: `1a415557f2fccaec6704fcc01a4b71dbaedc95b5f9c611fef23781c4b18d8642`
- The exact live `index.ts` source was copied into the repository without behavioral modification.
- Repository commit: `8f21fb4bcb65935f3ccd59430d3e56b58a8ccf00`

## Security properties verified from the live source
1. POST-only endpoint.
2. Requires `MANTIQATIX_WEBHOOK_SECRET` server secret.
3. Requires numeric timestamp and rejects timestamps outside 300 seconds.
4. Verifies HMAC-SHA256 over `timestamp + "." + raw body`.
5. Uses constant-time comparison for the signature.
6. Parses JSON only after signature verification.
7. Requires the tenant, provider, external event, payment intent, event type, amount, currency, and provider-signature-verification fields.
8. Requires `signatureVerified === true` before settlement.
9. Requires a positive confirmed amount.
10. Uses the service-role client only server-side and delegates financial processing to `process_verified_provider_payment`.
11. Does not expose the service-role key to the caller.

## Release boundary
This commit is source tracking/convergence only. The production function was **not redeployed**, because the tracked content is intentionally identical to the inspected live source.

## Remaining verification
- Signed Paymob/provider end-to-end test with a real authorized provider event.
- Duplicate/replay event behavior verification without creating artificial financial records.
- Source convergence of the remaining live Edge Functions and historical migrations.
