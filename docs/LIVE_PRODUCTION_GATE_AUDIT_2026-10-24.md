# Live Production Gate Audit — 2026-10-24

## Scope and safety

This document records read-only checks against the connected Supabase project on 2026-10-24 and source review of the deployed Edge Functions. No database writes, migrations, grants, payment operations, or deployments were performed as part of this audit.

Project ref: `moyhiluyhjsujhwlyeuu`

## Confirmed P0: Restaurant order RPC identity mismatch

### Evidence

- The deployed `order-create` Edge Function (version 8) validates the incoming bearer token with `admin.auth.getUser(token)`, then calls `admin.rpc("create_order_backend", ...)` using a Supabase service-role client.
- The live `public.create_order_backend(...)` is `SECURITY DEFINER`, has EXECUTE granted to `service_role` but not `authenticated` or `anon`, and its live body currently rejects calls when `auth.uid()` is null or differs from `p_customer_id`.
- The deployed `order-status-update` Edge Function (version 4) similarly validates the bearer token with `admin.auth.getUser(token)`, then calls `admin.rpc("update_order_status_backend", ...)` through the service-role client.
- The live `public.update_order_status_backend(...)` is executable by `service_role` only, but its live body currently requires `auth.uid()` to be non-null and equal to `p_user_id`.
- These function bodies therefore do not match the deployed service-role Edge Function invocation path: the authenticated user is verified by the Edge Function, while the SQL RPC executes with the service-role JWT identity. The current definitions are expected to reject these requests with `CUSTOMER_REQUIRED` / `AUTH_MISMATCH`. This is a production-blocking integration mismatch and must be verified by an authorized non-financial E2E test after remediation.
- The live status RPC also lacks the `m.branch_id` scope predicate in its current definition. The branch-scoped replacement is present in repository migration `20261023030000_rc103_order_status_branch_scope.sql`.

### Repository remediation already present

- `20261023020000_rc102_provider_services_owner_write_grants.sql`
- `20261023030000_rc103_order_status_branch_scope.sql`
- `20261023040000_rc104_order_idempotency_scope.sql`
- `20261023050000_rc105_order_create_service_role_identity.sql`
- `20261023060000_rc106_order_status_service_role_identity.sql`

These migrations are not recorded as applied in the connected production migration history. RC105 and RC106 explicitly preserve identity binding for non-service-role callers while supporting the verified Edge Function service-role path. RC103/RC104 also enforce branch scope and idempotency scope. They must be reviewed and tested together in a non-production environment before any production application; do not cherry-pick or apply only one function replacement.

## Confirmed database security observations

- The live catalog reports 128/128 public base tables with RLS enabled. This is a useful baseline, not proof that every policy is correct.
- `public.digital_page_payment_events` has RLS enabled and no policies. The inspected role-table grants show `service_role` has only `TRUNCATE`, `REFERENCES`, and `TRIGGER` grants there, with no direct SELECT/INSERT/UPDATE/DELETE grants in `information_schema.role_table_grants`. Do not add a broad policy or grant until the exact webhook/RPC write path is verified.
- Supabase Security Advisor still reports the public `get_mnty_targeted_advertisements` SECURITY DEFINER RPC callable by `anon`, and 40 SECURITY DEFINER functions callable by `authenticated`. These findings require function-by-function authorization review; the warning count alone does not establish that all are exploitable.
- Leaked-password protection and real payment/refund/settlement E2E remain external release gates and are not verified by this database read-only audit.

## Required release sequence

1. Keep production release gate **BLOCKED / NOT CERTIFIED**.
2. Review RC102–RC106 diffs and their existing disposable-PostgreSQL integration tests; confirm all required migration dependencies and current-main CI.
3. Apply the exact migration sequence first to a non-production Supabase environment and run the order create/status integration tests with distinct customer/provider/business/branch identities.
4. Recheck grants, RLS, function definitions, idempotency replay, cross-branch denial, customer cancellation, and paid-order cancellation protection.
5. Prepare a production backup/PITR checkpoint and a reviewed rollback/forward-fix plan.
6. Only after the owner explicitly authorizes the production change, apply the reviewed migrations in order during a controlled window and immediately run read-only catalog checks plus authorized low-risk E2E smoke tests. Do not run real payments without a separately approved Paymob test plan.
7. Close the gate only after live order lifecycle, Paymob HMAC/replay/idempotency, finance settlement/reconciliation, Auth security settings, Android release signing/device tests, backup restore, monitoring/alerts, and rollback evidence are verified.

## Explicit non-actions

- No production migration or grant was applied.
- No production data or financial transaction was changed.
- No Edge Function was redeployed.
- No release readiness claim is made based on source review alone.
