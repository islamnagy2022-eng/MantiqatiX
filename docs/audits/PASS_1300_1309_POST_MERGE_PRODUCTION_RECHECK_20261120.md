# PASS 1300–1309 — Post-merge source and live Production recheck — 2026-11-20

## Source / CI verification

- PR #897 is merged at `e5d5aa42152bdd41b49e2e0419122e831bc7301b`.
- Exact workflow run [44683168406](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/44683168406) reports both jobs completed successfully: `source-contract` and `consent-postgres`.
- The merged endpoint tests cover authentication ordering, invalid scope/type inputs, published/claimed listing eligibility, owner/business membership binding, actor spoofing, idempotency/unique-index race behavior, and revocation attribution.
- Latest repository commit observed: `a009bc83507fe0ffc0f6d8c599f924517f3d0193` (`docs(continuity): record RC473 endpoint test validation`).
- Uploaded archive integrity: `bizcatalog-manager (11).zip` passes `unzip -t`; SHA-256 `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`.
- Uploaded master directive SHA-256: `b51078e5aa164067c46347fd327c7230c5968f3cd36df5a354691504a3364ee2`. It confirms the operating sequence, source-of-truth rules, preservation requirements and weighted progress discipline. The R7 archive remains reference-only; it is not promoted over main or Production.

## Fresh read-only Supabase Production evidence

Project: `moyhiluyhjsujhwlyeuu`; all queries in this checkpoint were read-only.

- Migration ledger: 310 rows; latest version `20261110150618`.
- `directory_listing_contact_consents` is absent from both `public` and `private`.
- `public.is_platform_admin()` still checks for any ACTIVE tenant membership with role ADMIN or SUPER_ADMIN; it is SECURITY INVOKER with `search_path=public`.
- `private.platform_admins` does not have FORCE RLS enabled.
- Current policy text inventory: 56 dependent policies in `public` plus 1 in `storage` reference `is_platform_admin()` (57 total).
- Security Advisor observed at `2026-11-20T15:07:54Z`: 9 RLS-enabled/no-policy INFO findings; 1 anon-callable SECURITY DEFINER WARN; 65 authenticated-callable SECURITY DEFINER WARN; leaked-password protection disabled WARN. These are review findings, not a count of confirmed exploitable vulnerabilities. The single anon function and each authenticated function require contract-specific review; do not blanket-revoke.
- The deployed `directory-listings` Edge Function remains v16 and does not include the RC473 consent dependencies. Do not deploy the Edge Function separately from its migration and compatible dependency chain.

## Release and safety conclusion

- PR #897 source/CI tests are PASS; the corresponding Production privacy boundary is NOT deployed.
- RC484 source hardening remains merged/tested, but its Production registry/helper state remains unchanged.
- The 64-version release migration identity gap, coordinated Edge source drift, real encrypted off-site DB + Storage backup, Vault recovery, separate PostgreSQL 17 restore, measured RPO/RTO and rollback remain open.
- No Production migration, DDL/DML, GRANT, RLS, Auth, Storage, Edge deployment, payment, wallet, settlement or customer-data mutation was performed.
- Full platform gate remains **BLOCKED / NOT CERTIFIED**.

## Next executable dependency

The authorized operator must complete encrypted off-site database and Storage exports, preserve/recover Vault secrets, and perform an isolated PostgreSQL 17 restore/rollback rehearsal with measured RPO/RTO. Then rehearse the ordered RC472/RC473/RC484 and remaining 64-version migration chain with the complete compatible Edge bundles, sandbox payment tests and negative privacy/authorization tests before any Production rollout.
