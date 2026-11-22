# Pass 1741–1750 — Live catalog RPC authorization reconciliation

Date: 2026-11-22  
Project: `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`)  
Method: read-only `pg_proc` definition/config/ACL inspection and exact source migration/test review. No function was invoked and no application rows or identities were read.

## Live Production finding — P0

The following seven catalog/stock RPCs are currently SECURITY DEFINER in Production and still use `search_path=public`, with legacy membership metadata as the platform-root branch. The live function definitions do not call `public.is_platform_admin()` and still read `permissions->>'scope'` / `permissions->>'full_control'`:

1. `adjust_catalog_stock_backend`
2. `create_catalog_warehouse_backend`
3. `update_catalog_item_status_backend`
4. `upsert_catalog_business_profile_backend`
5. `upsert_catalog_item_backend`
6. `upsert_catalog_price_backend`
7. `upsert_catalog_settings_backend`

This confirms a source/live authorization mismatch. The current live `public.is_platform_admin()` is SECURITY INVOKER with `search_path=public` and derives from active membership roles; it is not the RC484 registry-backed SECURITY DEFINER helper.

## Existing source repair — do not duplicate

The source repository already contains the ordered repair chain:

- RC484: `20261119040000_rc484_registry_backed_is_platform_admin.sql` installs the private-registry-backed helper with empty search_path.
- RC485: `20261120200000_rc485_catalog_rpc_registry_root.sql` updates the seven functions, pins each SECURITY DEFINER search_path to empty, delegates platform-root authorization to `public.is_platform_admin()`, removes mutable tenant metadata as root credentials, and preserves tenant-local OWNER/ADMIN/MANAGER/BUSINESS_OWNER checks.
- Disposable integration test: `supabase/tests/rc485_catalog_rpc_registry_root_integration.sql` checks all seven signatures, SECURITY DEFINER status, empty search_path, registry-helper usage, absence of legacy metadata bypass, and tenant-local role paths.
- Static source validator: `scripts/validate-rc485-catalog-rpc-registry-root.mjs`.
- The full forward migration replay workflow runs RC484/RC485 in timestamp order. Previous candidate replay evidence passed in disposable PostgreSQL; latest candidate replay remains its own exact-head CI gate.

## Related read-only checks

- The nine Security Advisor RLS-enabled/no-policy relations were individually checked: no direct `anon` or `authenticated` table grants and no RLS policies were present. Preserve the backend-only boundary; do not add blanket policies.
- The one anonymous-callable SECURITY DEFINER public ads RPC has an empty search_path and returns only active/approved, scheduled, geo-filtered advertisement projection fields. Its public execution is intentional and remains a dedicated test contract.
- The 65 authenticated-callable SECURITY DEFINER Advisor entries remain an inventory requiring function-by-function authorization-aware review, not proof that all 65 are vulnerable.

## Release decision

- RC484/RC485 are **source-complete and disposable-testable**, but **not applied to Production**.
- Production must remain **BLOCKED / NOT CERTIFIED** until the complete ordered migration release, backup/restore rehearsal, coordinated Edge/database parity, and post-deployment authorization tests are approved and verified.
- Do not apply RC484/RC485 independently or one at a time. Do not create duplicate migrations. Do not use mutable `user_memberships.permissions` metadata as platform-root authority.

No Production DDL/data, function definition, ACL, RLS, Storage, Auth, Edge Function, payment, wallet or user data was changed.
