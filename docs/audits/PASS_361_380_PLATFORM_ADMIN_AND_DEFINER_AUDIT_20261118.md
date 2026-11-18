# Pass 361–380 — P0 Platform Admin and SECURITY DEFINER production audit

Date: 2026-11-18  
Project: `moyhiluyhjsujhwlyeuu` (`MANTIQATIX FINAL`)  
Scope: read-only Production authorization, function ACL, RLS dependency and migration-parity review.

## 1. Live SECURITY DEFINER inventory

- 149 SECURITY DEFINER functions exist in `public`.
- 65 are executable by `authenticated`.
- 1 is executable by `anon` (also authenticated).
- Of the 65 authenticated-executable functions, 47 have a `public` or mixed `public, pg_temp` search_path; 18 use an empty search_path.
- No mass ACL or search_path change was made. Every function needs a body/ownership/tenant/branch and dependency review before changing its execution context.

## 2. Platform-admin helper and dependency map

Live helper body:
`mnty_can_platform_admin() → mnty_can('admin', NULL, NULL, NULL)`.

It does not directly consult `private.platform_admins`. The `mnty_can` role matrix can grant `admin` to OWNER/ADMIN roles or an explicit admin permission, while the canonical platform-root authority is the private registry.

Four live SECURITY DEFINER functions call this helper:
- `admin_create_global_ad`
- `fulfill_digital_page_publish`
- `review_mantigo_captain_application`
- `set_mantigo_financial_config_backend`

Five live RLS policies also depend on it:
- `digital_pages_admin_manage`
- `mantigo_financial_config_admin_select`
- `mantigo_financial_config_admin_update`
- `mantigo_rate_limit_config_admin_select`
- `mantigo_rate_limit_config_admin_update`

The authenticated role can execute the helper, but cannot directly read the private registry; anon cannot execute the helper. The policies therefore depend on the helper's correctness.

## 3. Corrected live account-population interpretation

A previous read-only JWT simulation showed the OWNER role evaluating the helper as true. The live cross-check now shows:
- The only distinct active OWNER user is also registered in `private.platform_admins`.
- Five non-registry business users currently have no `admin` or `platform` permission flag and no OWNER/ADMIN/SUPER_ADMIN role.
- Therefore the earlier simulation did **not** prove that a currently existing non-registry business owner can bypass platform authorization. It tested a user who already had canonical platform-admin registry membership.
- The helper implementation remains a latent design defect because it derives platform authority from the general tenant permission system rather than the canonical registry. It must still be replaced before launch.

## 4. Source fix and regression evidence

RC464 source migration `20261113214500_rc464_platform_admin_live_registry_hardening.sql`:
- Preflights registry existence, RLS, client table grants and registry/function owner compatibility.
- Forces RLS on `private.platform_admins`.
- Replaces the helper with a SECURITY DEFINER query directly against `private.platform_admins`, bound to `auth.uid()`, with empty search_path.
- Replaces the four MantiGO global RPCs with explicit platform guard checks and empty search_path.
- Verifies the five dependent RLS policies and four shared-helper callers.

RC471 source migration `20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql`:
- Replaces the four MantiGO global RPCs with the canonical helper.
- Adds empty search_path and canonical platform checks to additional global RPCs.
- Preserves settlement idempotency and audit behavior.

Disposable regression evidence:
- RC464 baseline creates synthetic tenant OWNER, ADMIN and operations users and demonstrates the weak helper/global endpoints are reachable before the fix.
- RC464 integration tests verify those tenant roles are rejected after the fix, a registry-only platform admin is accepted, and the registry remains inaccessible to API client roles.
- RC464 PostgreSQL workflow `43596176271` completed successfully.
- Current-main RC471 PostgreSQL workflow `44213092970` completed successfully.

## 5. Production parity and release order

- Production migration ledger remains at `20261110150618`; 310 rows are recorded.
- RC464, RC471, RC472 and RC473 are not applied.
- Live `directory-listings` Edge Function remains version 16 and does not contain the RC472 transactional claim RPC or RC473 consent-aware projection.
- Organization plan is Free. Supabase documentation recommends CLI logical dumps and off-site backups for Free projects; no verified off-site backup or restore artifact is currently available.
- No development branch exists; only the default production branch is listed.
- Correct release order is **backup + restore proof → RC464 → RC471 → RC472 → RC473**, with each Edge Function deployed only after its matching migration and with post-deploy smoke tests.

## 6. Remaining function audit

The next review tranche must prioritize payment, financial, order, inventory and user-data SECURITY DEFINER functions, and verify:
- actor identity from `auth.uid()`, not caller-supplied IDs;
- tenant/business/branch scope;
- search_path pinning and schema-qualified references;
- execute grants and PUBLIC/anon exposure;
- idempotency and audit behavior for financial mutations.

The anonymous targeted-ad function is a deliberate public API. Its live definition has empty search_path, schema-qualified tables, ACTIVE/APPROVED/date filters, a 1–50 limit and a seven-column output projection. RC451 integration test passes empty-path, anon/authenticated grant and no-PUBLIC-execute assertions. Its fixture currently defines a stub returning no rows, so behavioral output/geographic/limit coverage remains pending.

**Disposition:** latent platform-root authorization defect fixed in source but not in Production. No Production DB, Auth, RLS, GRANT, Edge, payment or settlement mutation occurred. Full Production remains **BLOCKED / NOT CERTIFIED**.
