# RC44 Security Closure

Date: 2026-09-27

## Payment Intent authorization

Production API version 7 now restricts creation of payment intents to:

- the authenticated owner of the order; or
- an authorized operational role: SUPER_ADMIN, ADMIN, OWNER, MANAGER, CASHIER, STAFF; or
- a membership carrying the explicit `PAYMENT_CREATE` permission.

The previous implementation required only active tenant membership. The change closes cross-customer payment-intent creation within the same tenant.

## Verification

- GitHub source and deployed Production API source match exactly.
- Production API status: ACTIVE.
- Production API version: 7.
- JWT verification remains enabled.
- No database permissions were broadened.
- No production test data was created.

## Remaining external release gates

Auth leaked-password protection, Paymob production E2E, backup/restore drill, multi-user/multi-tenant E2E, Android signed release/device regression, and migration-source convergence still require their respective real environments/evidence.
