# SMM Narrow Read Contract — Design and Acceptance Gates

**Status:** Design specification only. This document does not create a migration, grant privileges, or authorize a production change.

## Problem statement

The current `main` implementation of `supabase/functions/smm-gateway/index.ts` has no `catalog` or `my_data` actions. PR #145 adds these actions by directly selecting from `smm_services`, `smm_orders`, and `smm_wallets` through the service-role client. Read-only production ACL inspection recorded in PR #145 reports that `service_role` has no SELECT on those tables (and on `smm_providers`, `smm_provider_credentials`, `smm_order_events`, and `smm_wallet_transactions`). Therefore the candidate's direct reads cannot be presumed to work in production.

Do **not** fix this by granting broad SELECT on the underlying tables or by making the tables readable to `anon` / `authenticated`. Provider credentials, provider-cost data, internal provider identifiers, order event payloads, and wallet transactions must remain outside the public read surface.

## Proposed interface (not yet implemented)

Implement a small, reviewed database read boundary, preferably as dedicated RPCs owned by a controlled database role:

1. **Catalog read** — returns only active services and the exact public fields required by the UI:
   `id, platform, category, name, description, selling_price, min_quantity, max_quantity, refill, cancel, dripfeed`.
   - Exclude `provider_id`, `external_service_id`, `provider_cost`, raw `metadata`, provider credentials, and all provider configuration.
   - Apply deterministic ordering and a bounded result size.
   - Never include inactive services.

2. **Current-user data read** — accept a user ID only as an internal parameter from the trusted Edge Function after it verifies the bearer token with Supabase Auth.
   - Return orders only where `user_id` equals the verified user ID; use a bounded, newest-first result.
   - Return only approved order fields: `id, service_id, quantity, selling_price, status, provider_order_id, created_at, updated_at` (review whether `provider_order_id` is actually needed by the UI before exposing it; omit it by default if not required).
   - Return only the single wallet summary needed by the UI. The exact wallet field(s), cardinality, and balance semantics must be verified against the real schema and existing wallet RPCs before implementation; do not guess column names or silently convert missing/error states to zero.
   - Do not return wallet transaction history, internal ledger fields, provider data, or other users' records.

## Privilege and implementation constraints

- Prefer a narrowly scoped RPC contract to broad table grants. Do not grant `SELECT` on the seven restricted SMM tables as a shortcut.
- If using `SECURITY DEFINER`, require a fixed safe `search_path`, schema-qualified object references, a controlled non-login owner, explicit input validation, bounded outputs, and a reviewed execute-privilege matrix. Revoke default PUBLIC execution and grant execution only to the intended backend role.
- The Edge Function must verify the bearer token with `admin.auth.getUser(token)` before calling any user-scoped read. It must derive the user ID from the verified Auth result, never from request JSON.
- The catalog RPC should expose no caller-controlled user ID. The personal-data RPC must not be callable by ordinary `anon` or `authenticated` roles. Document why the backend-only service-role execution path is safe and keep service-role credentials out of the browser.
- RPC errors must be surfaced as explicit gateway errors. A database error must not be transformed into a successful empty catalog, an empty order list, or a zero wallet balance.
- Preserve the explicit SMM admin policy: `smm_admins` allowlist or active platform-scoped SUPER_ADMIN with `tenant_id='MNTY-PLATFORM'`, no business scope, `permissions.scope='PLATFORM'`, and `permissions.full_control=true`. Tenant OWNER/ADMIN membership alone is not platform-wide SMM administration.

## Required verification before a migration can be proposed

1. Inspect current schema definitions and migration history for all referenced tables and wallet RPCs; confirm types, nullability, foreign keys, unique constraints, and balance semantics.
2. Compare repository migration ledger with the actual target project's migration ledger; stop if they diverge.
3. Implement against a disposable PostgreSQL/Supabase-compatible test database first. Do not use production as a test target.
4. Add positive and negative integration tests for:
   - active services are returned; inactive services are excluded;
   - the catalog response contains exactly the approved fields;
   - provider cost, provider IDs, external IDs, metadata, and credentials never appear;
   - user A cannot read user B's orders or wallet by changing request parameters;
   - missing/invalid bearer token is rejected before personal-data RPC invocation;
   - ordinary `anon` and `authenticated` roles cannot execute backend-only RPCs;
   - database errors remain explicit errors rather than empty/zero success;
   - bounded output and deterministic ordering are enforced;
   - SMM admin authorization rejects tenant OWNER/ADMIN without explicit platform scope.
5. Run SQL lint/static migration checks, the disposable PostgreSQL integration suite, SMM gateway contract validation, module-boundary validation, and the full relevant exact-head CI matrix.
6. Review the RPC SQL and privilege diff independently before requesting migration approval.

## Rollout boundary

- Keep PR #145 Draft until it is refreshed against current `main`, the read contract is implemented and tested, and its mixed backend/UI deployment risk is resolved.
- Prefer a backend-only PR first. Deploy and smoke-test the Edge Function before enabling the matching browser assets in a separate UI PR, unless an explicitly approved coordinated rollout procedure is used.
- Before any production deployment, obtain explicit approval, record the target project and current function version, run read-only preflight, use test identities with no real provider orders or wallet mutations, and have a rollback plan.
- Passing CI or merging source does not prove the production migration or Edge Function is deployed. Release remains **NOT CERTIFIED** until live evidence is recorded.
