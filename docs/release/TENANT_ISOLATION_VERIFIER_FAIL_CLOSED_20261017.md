# Tenant-isolation verifier — fail-closed correction (2026-10-17)

## Finding

The previous `scripts/verify-tenant-isolation.sql` could report PASS when the target tenant or rows were absent because it only asserted that cross-tenant counts were zero. A zero count is not evidence of isolation if there is nothing to hide. It also selected an identity from `MNTY-PLATFORM`, which is not an appropriate principal for a tenant-to-tenant adversarial test.

A read-only production aggregate check found `MNTY-TEST-B` exists with one active non-showcase business, but no rows in `orders`, `payment_intents`, or `provider_onboarding_requests` for the queried tenants. Therefore the old verifier's zero-count assertions for those three surfaces would have been vacuous. No user IDs, emails, payment details, or business names are included in this report.

## Correction

- The verifier requires synthetic `MNTY-TEST-A` and `MNTY-TEST-B`, isolated owner identities, and positive fixture rows in both tenants for businesses, orders, payment intents, and provider onboarding.
- It tests both directions: Tenant A can read its own rows but not private Tenant B rows, and vice versa.
- Public showcase businesses are excluded from the cross-tenant business assertion because the schema intentionally allows active showcase rows to be read publicly.
- The synthetic fixture uses `example.invalid` identities, is explicitly marked test-only, and refuses to run unless invoked with `psql -v mantiqati_disposable=on`.
- The verifier runs in a transaction and rolls back. A static validator and dedicated CI workflow enforce the fail-closed contract.

## Verification scope

The behavioral SQL test is run only on a separate disposable-baseline branch after schema restore and synthetic fixture seeding. This PR does not create test identities, tenant rows, or financial rows in production. Production tenant isolation remains **NOT VERIFIED** until the controlled two-user/two-tenant test passes in an approved isolated environment and deployed-policy parity is reviewed.
