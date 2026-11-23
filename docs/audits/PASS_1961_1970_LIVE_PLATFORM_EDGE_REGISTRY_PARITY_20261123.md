# Pass 1961–1970 — Live platform-facing Edge registry parity — 2026-11-23

## Live/source comparison
- [x] 1961 — Compared deployed `catalog-platform-admin` v23 with current main. Live bundle differs and derives platform access from legacy `SUPER_ADMIN` membership metadata; current main verifies the caller then calls `mnty_can_platform_admin()` and requires exact boolean true before platform actions.
- [x] 1962 — Compared deployed `business-register` v9 with current main. Live code accepts a `SUPER_ADMIN` membership with null business and `permissions.scope=PLATFORM` + `full_control=true`; current main calls the registry RPC using the caller JWT and fails closed on registry error.
- [x] 1963 — Compared deployed `business-branch-admin` v5 with current main. Live code derives authorization from membership role/permission metadata; current main adds a caller-JWT registry check for platform-root actions while preserving scoped business-manager authority.
- [x] 1964 — Compared deployed `ai-gemini-proxy` v5 with current main. Live code contains `isPlatformAdminMembership` and derives platform image-write authority from membership metadata; current main uses the registry RPC and keeps ordinary catalog image writes business-scoped.
- [x] 1965 — Compared deployed `settlement-financial-atomic` v4 (2,314 bytes) with current main (7,442 bytes). Main imports a dedicated authorization module, validates tenant/business/branch authority, and requires registry authority for `MNTY-PLATFORM`; deployed v4 is a materially older implementation. No settlement request was invoked.
- [x] 1966 — Compared deployed `directory-listings` v18 (2,054 bytes) with current main (52,098 bytes). Live is a deliberate fail-closed stub; preserve it until RC472/RC473 consent, source-rights and matching Edge release gates are satisfied.
- [x] 1967 — All six inspected functions are ACTIVE. The five platform-facing functions report `verify_jwt=true`; directory-listings reports `verify_jwt=false` but remains fail-closed. A true JWT flag does not replace application-level role/scope authorization.
- [x] 1968 — Current-main `scripts/validate-directory-platform-admin-registry.mjs` asserts registry-only checks for catalog-platform-admin, catalog-admin, business-register, business-branch-admin, AI image writes and settlement; it rejects legacy membership-based root checks.
- [x] 1969 — Confirmed current live helper `mnty_can_platform_admin()` is still membership-derived (Pass 1951–1960), so deploying any of these current-main Edge bundles alone would not close the global authorization boundary.
- [x] 1970 — No Edge function, database object, migration, user, business, settlement, payment, storage object or public directory record was changed or invoked.

## Release disposition
- **P0:** five active platform-facing Edge functions still contain membership-derived platform-root logic or materially older authorization code; current main source has registry-bound replacements, but the live helper and migration chain remain old.
- Do not deploy Edge bundles individually. First reconcile and apply the database registry helper migrations (RC464/RC484 and dependencies), verify the helper against adversarial JWT identities, then deploy the matching Edge bundles together and run negative tenant-role tests.
- Keep `directory-listings` v18 fail-closed. Do not enable the public directory before RC472/RC473, owner consent, source rights and revocation checks are live.

**Production remains BLOCKED / NOT CERTIFIED.** No Production changes.
