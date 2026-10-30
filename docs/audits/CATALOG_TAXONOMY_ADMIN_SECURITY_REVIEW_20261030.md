# Taxonomy administration security review — 2026-10-30

## Scope and baseline
- Reviewed `apps/catalog-frontend/src/components/admin/AdminDashboard.tsx`, `apps/catalog-frontend/src/context/AppContext.tsx`, `apps/catalog-frontend/src/data/productionDefaults.ts`, `apps/catalog-frontend/src/lib/production.ts`, and `supabase/functions/catalog-platform-admin/index.ts` on main commit `7baafc4b5cb9305061bf0b61033af6e7b23859b8`.
- Existing administration has a taxonomy tab and category create/delete flows; this is not a safe bulk mapping management workflow.
- The platform-admin Edge Function verifies a non-anonymous Auth user and an ACTIVE platform-wide SUPER_ADMIN membership with PLATFORM/full_control scope before processing actions.
- The `SAVE_SETTINGS` action currently accepts `defaultCategories`, `categories`, and `functionalGroups` as caller-provided values, then merges and upserts the settings row. The inspected action does not structurally validate taxonomy IDs, duplicate IDs/names, allowed group references, size bounds, referenced business/listing usage, or record a dedicated immutable taxonomy-change audit event.
- `normalizeCanonicalTaxonomySettings` merges canonical defaults and saved entries at bootstrap; it is not a substitute for server-side validation or a transactional write boundary.

## Risk assessment
1. Malformed or duplicate taxonomy identifiers can be persisted in platform settings by a caller who already has platform-admin authorization.
2. A category/group can be removed or renamed while businesses/listings still reference its legacy ID or code.
3. There is no authoritative dry-run contract that returns the exact affected businesses/listings and old/new mapping without writing.
4. Settings persistence and audit logging are not a single atomic transaction in the current REST-upsert flow; simply adding a second REST insert would still permit partial success.
5. Hiding a UI control is not authorization. All validation and permission checks must remain server-side.

## Required implementation design
- Add a dedicated backend-only taxonomy preview action that is read-only and accepts a proposed mapping plus an explicit scope/version.
- Resolve and return a deterministic preview: invalid references, duplicate IDs/codes, categories in use, exact affected row counts, and a bounded sample of affected IDs with old/new values. Never return private business fields not needed for review.
- Require a preview digest/version and reject stale previews at commit time.
- Commit only through one transactional PostgreSQL RPC/migration (forward-only) that revalidates the preview, applies approved changes, and writes audit history in the same transaction.
- Preserve all existing legacy IDs and links. No deletion/merge of functional groups in this phase.
- Server-side authorization must independently verify the active platform-wide SUPER_ADMIN membership and reject anonymous users, tenant/business-scoped owners, employees, and stale/inactive memberships.
- UI is additive to the existing admin taxonomy tab; customer-facing directory/storefront screens remain unchanged.
- Require confirmation that displays affected counts and a clear before/after summary. No bulk change occurs on preview.
- Provide a rollback plan based on a recorded before-image/audit event; do not rewrite historical migrations or mutate production directly.

## Required tests
- Unauthorized guest, anonymous JWT, customer, provider, business owner, employee, tenant-scoped admin, inactive membership, and non-platform SUPER_ADMIN all denied.
- Active platform-wide SUPER_ADMIN can preview but preview performs zero writes.
- Invalid group/category IDs, duplicate IDs/codes/names, empty names, oversized payloads, stale preview digest, and referenced-category deletion are rejected.
- Commit updates only approved taxonomy fields, preserves ownership, subscription, publication, verification, contact, location, images, and specialty fields, and records an immutable audit event.
- Transaction failure rolls back both mapping changes and audit event.
- Browser tests verify preview/confirm/cancel flows, keyboard access, mobile layout, and unchanged customer-facing routes.

## Release boundary
This review is source-only. No production settings, business/listing rows, migrations, RLS policies, grants, Edge Functions, Auth settings, or audit rows were changed. Do not deploy or apply a migration until isolated PostgreSQL integration, migration replay, RBAC tests, browser E2E, backup/restore rehearsal, and release approval pass.

## Feature-branch implementation checkpoint
- Added RC459 migration `supabase/migrations/20261030130000_rc459_secure_taxonomy_mapping_preview_commit.sql`:
  - Read-only preview and transactional apply RPCs, restricted to `service_role`.
  - Server-side active platform-wide SUPER_ADMIN predicate rechecked in both RPCs.
  - Deterministic preview digest, bounded sample, affected counts, stale-preview rejection, and locks around validation/apply.
  - Only taxonomy group/category/classification fields are updated in `businesses.settings`; listing taxonomy group/category fields are changed while specialty, claim, publication, phone, ownership, billing, location and image data stay untouched.
  - Append-only audit table with FORCE RLS, no direct role grants, and compact before-image containing the fields actually changed.
- Added server actions to `catalog-platform-admin`, with the existing user-token authentication and platform-wide role gate retained, and added structural/reference guards to generic taxonomy settings saves.
- Added an additive administration panel to the existing Super Admin taxonomy tab; directory and storefront routes were not changed.
- Added disposable PostgreSQL fixtures/integration tests, including no-write preview, stale digest, non-platform OWNER rejection, field preservation, append-only audit, and forced mid-transaction rollback.
- Added browser coverage for preview/cancel/confirmed apply and a static source-contract validator.
- **Not yet verified at this checkpoint:** exact latest-head workflow completion; anonymous/customer/provider/employee/inactive/platform-scope negative JWT matrix; authoritative target-category membership validation. No Production DDL, Edge deployment, settings change, or row update occurred.
