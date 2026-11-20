# Pass 1350–1359 — Production SECURITY DEFINER and RLS/grant review

**Date:** 2026-11-20  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only PostgreSQL catalogs, function definitions, effective privilege checks, and Supabase Security Advisor. No application rows selected. No Production mutation.

## Security Advisor findings rechecked

- 9 exposed-schema tables have RLS enabled but no policies.
- 1 `SECURITY DEFINER` function is executable by `anon`.
- 65 `SECURITY DEFINER` functions are executable by `authenticated`.
- These counts are lint findings, not a confirmed count of vulnerabilities. A definer function may be intentionally exposed if its body enforces authorization and its grants/search path are correct.

## Function catalog inventory

Fresh catalog aggregation across `public` found:
- **149** total `SECURITY DEFINER` functions.
- **65** executable by `authenticated`.
- **1** executable by `anon`.
- **0** without an explicit function-level `search_path` setting.
- **28** configured with an empty search path.
- **91** configured with `search_path=public`.

The one anon-callable function is `public.get_mnty_targeted_advertisements(character varying,character varying,character varying,double precision,double precision,character varying,integer)`. It is configured with an empty search path; the source migration RC451 explicitly preserves anonymous execution for public advertisement discovery and schema-qualifies the application tables. Its live definition filters to active, approved, in-window ads and clamps the requested result limit to 1–50. This Advisor warning is an intentional public read boundary, not a reason to revoke its grant blindly.

## Representative authenticated definer functions reviewed

Read-only body inspection confirmed explicit authorization checks in these examples:
- `accept_mantigo_bid_backend`: caller-supplied user ID must equal `auth.uid()`; ride customer ownership and ride state are checked before accepting a bid.
- `confirm_mantigo_cash_payment_backend`: caller identity must match `auth.uid()`; the financial row must belong to the caller and be in the required payment state.
- `claim_digital_page_payment_intent_backend`: authenticated caller must match order owner; idempotency key and payment state are checked.
- `admin_create_global_ad`: requires `mnty_can_platform_admin()`.
- `mnty_active_membership`: membership lookup is bound to `auth.uid()`.
- `mnty_business_employee_list_scoped`: rejects missing/anonymous actor, validates tenant/business/branch, and checks membership or explicit HR permissions.
- `assert_financial_membership`: derives active membership using `auth.uid()` and restricts finance roles.
- `upsert_catalog_item_backend` and `upsert_catalog_price_backend`: require `auth.uid()` and validate tenant/business/branch membership and role.

This is representative review, not a complete manual audit of all 65 callable functions. Do not infer all are safe from these examples. Continue signature-by-signature review of the remainder.

## Schema CREATE and table grants

- `anon` and `authenticated` have no CREATE privilege on schema `public`.
- `service_role` also has no CREATE privilege on `public`.
- `pg_database_owner` and `postgres` have CREATE on `public`.
- `anon` and `authenticated` have no SELECT/INSERT grants on any of the nine RLS-enabled/no-policy tables inspected.
- `service_role` has SELECT/INSERT on `directory_listing_claim_requests`, `directory_source_permission_evidence`, and `public_directory_listings`; it has no SELECT/INSERT on the other six tables in this nine-table set.
- All nine tables have RLS enabled; eight have FORCE RLS, while `digital_page_payment_events` does not. Since browser roles have no table grants, the no-policy linter findings are not evidence of browser-readable rows. The service-role and definer-function access paths still require separate review.

## Disposition

- No blanket REVOKE was performed. Such a change could break legitimate authenticated product workflows.
- The public targeted-ad discovery function's anon grant is intentional per RC451; it has an empty search path and constrained public output.
- No browser-role CREATE privilege on `public` was found.
- No direct application table rows or personal data were selected.
- No Production grants, policies, functions, tables, migrations, Auth, Storage, Edge Functions, or deployment were changed.

## Remaining work

1. Complete manual review of all 65 authenticated-callable definer functions, including transitive helper authorization and unqualified object references.
2. Reconcile the 9 no-policy tables with intended service-role/RPC access contracts; preserve closed browser access unless a documented user-facing need exists.
3. Continue the P0 Edge/migration parity release work already recorded in Pass 1340–1349.
4. Keep Production **BLOCKED / NOT CERTIFIED** until the full backup/restore, migration, Edge, payment and end-to-end release gates pass.
