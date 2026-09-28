# RC198 — order-create Production Convergence

## Verification
- Production Edge Function: `order-create`
- Status: ACTIVE
- Previous version: v4
- New version: v5
- `verify_jwt`: true
- Production SHA-256: `7f2090ba15abe3fbc58cf8d1c5308423ac7d92bbb2544e09de27df238080e713`
- The deployed `index.ts` was read back after deployment and matches the source submitted from `supabase/functions/order-create/index.ts` for RC192.

## Security contract retained
- Bearer authentication and Supabase user validation.
- Anonymous users rejected.
- Target business must be ACTIVE and match target tenant.
- Target provider profile must remain validated by `create_order_backend`.
- Customer authorization supports target-tenant membership or an ACTIVE CUSTOMER membership elsewhere.
- Catalog, prices, options, tax and total are server-authoritative.
- `create_order_backend` remains the authoritative persistence boundary.
- JWT verification remains enabled.

## Not yet verified
- Database UNIQUE protection for `(tenant_id, client_idempotency_key)`.
- Real customer-to-provider booking E2E.
- Provider-side isolation/status transition E2E.
- Notification delivery E2E.
- Payment/refund E2E.
- CI/release gate for the current web/backend commits.
- Final rollback rehearsal.

## Release status
The `order-create` deployment drift is CLOSED. The booking release gate remains OPEN until the remaining verification items are evidenced.
