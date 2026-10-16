# Customer Registration RPC Drift — 2026-10-16

## Decision status

**BLOCKED for source convergence.** Do not replace the deployed RPC with the repository RPC, or vice versa, based on source parity alone.

## Verified observations

- Production Edge Function `mnty-customer-registration` is ACTIVE at version 4 and calls `private.ensure_customer_membership_for_user`.
- Tracked `main` calls `private.activate_customer_registration_atomic`.
- A read-only production catalog query confirmed both functions exist, are SECURITY DEFINER, set an empty search_path, and grant EXECUTE to `service_role` while denying direct EXECUTE to `authenticated` and `anon`.
- Both reject a missing user/tenant and require an active tenant, but they are not behaviorally interchangeable.

## Material behavior differences

| Invariant | `activate_customer_registration_atomic` (RC213) | `ensure_customer_membership_for_user` (RC215) |
| --- | --- | --- |
| Advisory lock | Per user | Per user + CUSTOMER role + tenant |
| Existing membership | Selects an active CUSTOMER membership without deterministic ordering | Deterministically orders by created_at then id |
| Pending CUSTOMER registration requests | Cancels pending requests on existing and newly created membership | Does not cancel pending requests |
| Membership insert | Does not explicitly include business_id/branch_id | Explicitly inserts NULL business_id/branch_id |
| Audit write | Required; an audit insert error aborts the transaction | Audit insert failure is caught and suppressed |
| Audit action | CUSTOMER_REGISTRATION_ACTIVATED | CUSTOMER_MEMBERSHIP_AUTO_ACTIVATED |
| Additional responsibility | Request-driven activation | Also used by an auth.users trigger and historical backfill in RC215 |

## Required staging acceptance tests before choosing one contract

1. First registration creates exactly one active CUSTOMER membership and a durable audit event.
2. Replay returns the same membership with `created=false` and does not duplicate memberships.
3. Concurrent duplicate requests do not create duplicate active memberships.
4. Existing active membership plus pending CUSTOMER registration requests follows the explicitly selected cleanup policy.
5. Audit-table insert failure has the explicitly selected behavior (abort activation vs allow membership creation); it must never be silently chosen.
6. Missing/inactive tenant and null user are rejected.
7. A non-CUSTOMER membership does not satisfy the base CUSTOMER membership invariant.
8. Auth-user trigger and registration Edge Function do not race into duplicate memberships.
9. `business_id` and `branch_id` remain correctly null for a platform-wide customer membership.
10. `service_role` can invoke the selected RPC; `authenticated` and `anon` cannot invoke it directly.

## CI guard added

`scripts/validate-customer-registration-rpc-contract.mjs` protects the current reviewed repository contract and checks that the two migration definitions remain visibly distinct. It is a static source contract only, not a substitute for the staging integration tests above.

## Safety

This change adds tests and documentation only. It does not modify the Edge Function behavior, apply migrations, change grants/RLS/Auth, invoke either RPC in production, or deploy anything. Production convergence remains blocked until the invariant decision and isolated staging tests are approved.
