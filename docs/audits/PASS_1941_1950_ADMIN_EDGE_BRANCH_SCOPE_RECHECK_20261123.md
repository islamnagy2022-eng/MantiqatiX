# Pass 1941–1950 — Remaining admin Edge source parity and branch-scope recheck — 2026-11-23

## Live/source comparison
- [x] 1941 — Compared 10 additional admin, legal, AI and business Edge entrypoints against current main.
- [x] 1942 — Exact matches: `legal-center` v4, `erp-product-create` v4, `marketing-lead-create` v8, `digital-page-order-create` v4, `approval-list` v3, `facebook-page-import` v2.
- [x] 1943 — `legal-cms` v6 differs from main. Live code authorizes by any active SUPER_ADMIN/ADMIN/LEGAL_ADMIN membership and directly inserts legal documents/versions plus audit records. Main calls `legal_assert_admin_backend`, `legal_create_document_backend`, and `legal_create_draft_version_backend` atomic backend RPCs. Those three RPCs are absent from live catalog; do not deploy main Edge source until RC482/RC483 dependencies are released.
- [x] 1944 — `business-branch-admin` v5 differs from main. Live code accepts OWNER/ADMIN/BUSINESS_OWNER/MANAGER membership scoped to a business without requiring `branch_id IS NULL`; main requires business-wide membership (null branch) or registry-backed platform admin.
- [x] 1945 — Aggregate-only live query found 2 active users with business-admin roles scoped to a branch, across 2 businesses. These are the exact memberships that the deployed branch-admin predicate does not exclude. No user IDs or branch names were selected.
- [x] 1946 — This creates a potential cross-branch management authorization gap within those businesses. Treat as P1 until negative branch-scope tests and the matching Edge source are deployed.
- [x] 1947 — `catalog-platform-admin` v23 differs from main. Live derives platform root from membership role/permissions; main requires `mnty_can_platform_admin()` and treats membership metadata as a display hint only. The live helper remains membership-derived, so Edge-only deployment is unsafe.
- [x] 1948 — `ai-gemini-proxy` v5 differs from main. Main explicitly rejects anonymous Auth for catalog image generation and checks platform scope through the registry helper; live still uses legacy platform membership metadata. Aggregate-only check found one active legacy match and it is in registry; no non-registry match.
- [x] 1949 — No legal document was created, no branch/admin operation invoked, no AI image generation called, and no membership or tenant data was selected.
- [x] 1950 — No Edge function, schema, Auth, RLS, grants, business, branch, legal document, or customer data was changed.

## Release actions
- [ ] Release RC482/RC483 legal admin guard + atomic CMS create/audit RPCs before deploying legal-cms v7.
- [ ] Deploy business-branch-admin only after branch-scope negative tests prove branch-scoped managers cannot list/create/update/delete sibling branches.
- [ ] Release RC464/RC471/RC484 registry helper chain before deploying catalog-platform-admin and AI proxy updates.
- [ ] Re-run deployed source hash and exact authorization regression tests after coordinated release.

**Disposition:** no Production changes. Full Production remains **BLOCKED / NOT CERTIFIED**.
