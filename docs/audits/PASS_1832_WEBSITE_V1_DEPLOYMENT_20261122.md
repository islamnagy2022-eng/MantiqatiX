# Pass 1832 — Website V1 deployment and post-launch handoff

**Date:** 2026-11-22  
**Main commit:** `c95ccc0d891e0670fe34d97c4c1beca6bd0f4fa2`  
**Website status:** V1 static website deployed and deployed-origin smoke passed.  
**Full-platform status:** **BLOCKED / NOT CERTIFIED**.

## Merged changes and CI

- PR #982 merged: national directory source gate is default-closed; no Production flag or Edge deployment.
- PR #984 merged: live Production migration/Edge parity checkpoint.
- PR #985 merged: V1 frontend privacy boundary, hidden contact-consent control, no unclaimed-directory API calls, disabled-directory smoke and E2E. Exact PR head `877a9635bea71e1cee2105af4170cb88a266f83a` passed all 11 workflow runs.
- PR #972 closed as superseded by #985.
- PR #978 remains DRAFT; gallery requires matching schema/writer/reader release and does not upload local files.

## Verified deployment

- Main Pages workflow: [45076054135](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45076054135) — SUCCESS.
- Pages validation, artifact upload and GitHub Pages deployment all succeeded.
- Deployed-origin browser checks passed for the public root, dashboard, mobile layout and QR routes.
- Root: https://islamnagy2022-eng.github.io/MantiqatiX/
- Rollback copy: `/legacy/`; V6 preview alias: `/v6-preview/`.
- Primary Catalog validation: [45076054161](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45076054161) — SUCCESS (build, browser E2E, employee RBAC PostgreSQL).
- Forward migration replay: [45076054131](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45076054131) — SUCCESS; 112 migrations replayed on an isolated disposable PostgreSQL instance, tenant isolation passed. This is not a Production migration or restore.
- Production Health Monitor: [45076054204](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45076054204) — SUCCESS.

## V1 release boundary

- Public catalog root, public business/catalog pages and basic owner catalog management remain in scope.
- National unclaimed listings remain disabled; frontend does not request listing pages or expose direct `?listing=` routes.
- Public-contact consent control remains hidden until the live audited writer and consent registry are released. Routine profile saves do not submit consent state.
- Live `directory-listings` v18 exactly matches the reviewed disabled stub (2,054 bytes); no `createClient` call; GET-empty / POST-503.
- Live `public-catalog` v9 and `public-catalog-directory` v19 were compared file-by-file with current main and are exact bundle matches.
- Live `catalog-admin` v20 and `catalog-platform-admin` v23 remain source-drifted; no individual deployment.
- Monthly subscription plans/status/entitlement may be displayed only from server-authoritative state. Checkout/activation is not certified: live `subscription-payment-intent` v4 differs from current main and signed Paymob sandbox E2E/secret configuration were not verified. Keep unverified checkout disabled.
- Li2Lak, Paymob integration expansion, wallets, commissions, refunds, payouts, reconciliation, settlement and non-monthly accounting remain post-launch work.

## Fresh read-only Production blockers

- Migration ledger: 310 rows, latest `20261110150618`; required release set **0/76 present**.
- `public.directory_listing_contact_consents` and `public.migration_release_registry` are absent.
- Security Advisor: 9 RLS-enabled/no-policy INFO findings; 65 authenticated-callable and 1 anon-callable SECURITY DEFINER WARN findings; leaked-password protection disabled. Review per function/caller; no blanket revoke.
- Genuine encrypted off-site database + Storage backup, Vault recovery, independent PostgreSQL 17 restore/rollback and measured RPO/RTO are still missing.

## Safety

No Production DDL/DML, migrations, RLS/GRANT, Auth, Storage, Edge deployment, payment, wallet, settlement or customer-data mutation occurred. The only production write in this pass was the intended static GitHub Pages deployment.

**Next:** preserve V1; obtain backup/restore evidence; reconcile the 76 exact migration IDs; release RC472/RC473 consent schema + audit writer + matching readers together; verify monthly subscription checkout with signed sandbox callbacks; then resume gallery and post-launch modules.
