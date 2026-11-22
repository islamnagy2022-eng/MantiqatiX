## Latest continuation checkpoint — 2026-11-22 — Website V1 deployed and verified; full-platform gate remains blocked

**Current main:** `c95ccc0d891e0670fe34d97c4c1beca6bd0f4fa2`  
**Website:** [MantiqatiX GitHub Pages](https://islamnagy2022-eng.github.io/MantiqatiX/)  
**Verified Pages deployment:** [run 45076054135](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45076054135) SUCCESS, including deployed-origin browser checks for the public root, dashboard, mobile layout and QR routes.  
**Primary Catalog exact-main validation:** [run 45076054161](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45076054161) SUCCESS.  
**Full-platform status:** **BLOCKED / NOT CERTIFIED**. The static website V1 is deployed; this does not certify every backend/payment/finance module.

### Merged website and privacy work

- PR #982 merged: default-closed national directory source gate. Exact-head checks passed; it does not enable the directory or deploy an Edge function.
- PR #984 merged: live Production migration/Edge parity checkpoint.
- PR #985 merged as `c95ccc0`: V1 frontend privacy boundary, hidden public-contact consent control, no unclaimed-directory requests, disabled-directory smoke and browser coverage.
- PR #972 closed as superseded by #985.
- PR #978 remains DRAFT: one fixed cover plus up to 10 promotional HTTPS image URLs; matching catalog writer/reader release is not deployed, and direct file upload is not implemented.

### V1 website behavior now deployed

- Public catalog root and business/catalog pages remain available.
- Public unclaimed national directory records and direct `?listing=` details are not requested or rendered.
- Owner public-contact consent control is hidden until the live audited consent writer/registry is released.
- Routine owner profile saves do not submit public-contact consent state.
- `/legacy/` rollback copy and `/v6-preview/` preview alias are retained.
- Live public readers `public-catalog` v9 and `public-catalog-directory` v19 were compared file-by-file with current main and are exact bundle matches.
- Live `directory-listings` v18 exactly matches the reviewed disabled stub; it contains no `createClient` call and preserves GET-empty / POST-503.
- Live `catalog-admin` v20 and `catalog-platform-admin` v23 remain source-drifted; do not deploy replacements individually.

### CI and release evidence

- PR #985 exact-head SHA `877a9635bea71e1cee2105af4170cb88a266f83a`: all 11 workflow runs succeeded, including Primary Catalog build/browser/RBAC, Pages validation, privacy, consent PostgreSQL, module boundaries, MantiGO/Paymob atomicity and deferred SMM contracts.
- Main Pages push run 45076054135 succeeded, including deployed-origin dashboard/mobile/QR browser verification.
- Main Primary Catalog run 45076054161 succeeded.
- Main forward migration replay run 45076054131 succeeded: 112 migrations replayed on an isolated disposable PostgreSQL instance with tenant-isolation tests. This is not a Production migration or backup/restore.
- Production Health Monitor run 45076054204 succeeded.

### Fresh read-only Production state

- Migration ledger: 310 rows, latest `20261110150618`; exact required release set **0/76 present**.
- `public.directory_listing_contact_consents` and `public.migration_release_registry` remain absent.
- Security Advisor: 9 RLS-enabled/no-policy INFO findings; 65 authenticated-callable and 1 anon-callable SECURITY DEFINER WARN findings; leaked-password protection disabled. Review by function/caller; do not mass-revoke.
- Monthly subscription checkout is **not certified**: live `subscription-payment-intent` v4 differs from current main; no signed Paymob sandbox end-to-end proof or verified secret/config state was produced. Plan/status/entitlement may be shown only where server-backed; keep unverified checkout disabled. No new Paymob integration work in V1.
- No Production DDL/DML, migration, RLS/GRANT, Auth, Storage, Edge deployment, payment, wallet, settlement or customer-data mutation occurred. GitHub Pages static deployment only.

### Next sequence

1. Preserve the deployed V1 and monitor real user-facing behavior; do not re-enable unclaimed listings or contact sharing.
2. Complete genuine encrypted off-site DB + Storage backup, Vault recovery and independent PostgreSQL 17 restore/rollback with measured RPO/RTO.
3. Reconcile all 76 exact release migration IDs and physical object/ACL dependencies; no isolated Production migrations.
4. Release RC472/RC473 consent schema, owner audit writer, matching public readers and authorization dependencies as one tested bundle.
5. Verify monthly subscription checkout through the current claim-based intent path and signed Paymob sandbox webhook before exposing activation.
6. Resume PR978 gallery only with matching writer/reader/consent release; owner-scoped file upload requires a separate Storage contract.
7. Keep Li2Lak, Paymob expansion, wallets, commissions, refunds, payouts, reconciliation, settlement and non-monthly accounting in the post-launch backlog.

**Evidence:** `docs/audits/PASS_1832_WEBSITE_V1_DEPLOYMENT_20261122.md` and `docs/release/WEBSITE_FIRST_LAUNCH_AND_POST_LAUNCH_BACKLOG_20261122.md`.

## Pass 1801–1810 — Li2Lak marketplace ad hardening — 2026-11-22

Hardened the existing Marketplace Home ad URL contract on PR #969. HTTPS is required; non-default ports, embedded credentials, localhost, `.localhost`, `.local`, and IPv4/IPv6 literal hosts are rejected. Invalid creative URLs discard the ad; invalid target URLs leave a non-clickable creative. Fixed trailing-dot hostname normalization and added regression cases. Commits: `6b3386b`, `f2411ee`, `9316c5d`, `820778a`. Evidence: `docs/audits/PASS_1801_1810_LI2LAK_MARKETPLACE_AD_HARDENING_20261122.md`. Exact-head CI was still queued at last check; no pass claimed. No Production change. Continue next with Marketplace public-offer permission/availability regression coverage and then owner-scoped media design; do not start general business reviews or video deployment without separate provenance/moderation and storage contracts. Production remains **BLOCKED / NOT CERTIFIED**.
