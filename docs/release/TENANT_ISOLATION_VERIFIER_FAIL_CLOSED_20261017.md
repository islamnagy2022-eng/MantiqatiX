# Tenant-isolation verifier — fail-closed correction (2026-10-17)

## Finding

The existing `scripts/verify-tenant-isolation.sql` could report PASS even when the target tenant or test rows were absent: it only asserted that cross-tenant counts were zero. A zero count is not evidence of isolation if there is nothing to hide. It also selected an identity from `MNTY-PLATFORM`, which is the wrong principal for a tenant-to-tenant isolation test.

A read-only production aggregate check found `MNTY-TEST-B` exists and has one non-showcase active business, but no rows in `orders`, `payment_intents`, or `provider_onboarding_requests` for the queried tenants. Therefore the old verifier's three corresponding zero-count assertions would have been vacuous. No individual user IDs, emails, payment details, or business names are included here.

## Correction

- The verifier now requires explicit synthetic `MNTY-TEST-A` and `MNTY-TEST-B` tenants, one isolated owner per tenant, and positive fixture rows in both tenants for businesses, orders, payment intents, and provider onboarding.
- It tests both directions: A can read A's rows but not private B rows; B can read B's rows but not private A rows.
- Public showcase businesses are excluded from the cross-tenant business assertion because the schema intentionally allows active showcase rows to be read publicly.
- The script runs in a transaction and rolls back. It is for a controlled disposable fixture, not a production data seeding procedure.
- A static validator and dedicated CI workflow ensure missing fixtures fail closed.

## Verification scope

The full behavioral SQL test is executed only on the separate disposable-baseline test branch after synthetic fixture seeding. This PR does not create test identities, tenant rows, or financial rows in production. Production tenant isolation remains **NOT VERIFIED** until a controlled two-user/two-tenant test passes on an approved isolated environment and deployed-policy parity is reviewed.
