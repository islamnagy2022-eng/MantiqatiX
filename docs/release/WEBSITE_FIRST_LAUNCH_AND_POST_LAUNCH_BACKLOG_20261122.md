# Website First Launch and Post-Launch Backlog — 2026-11-22

## Release result

**Website V1 is deployed.**  
Production URL: https://islamnagy2022-eng.github.io/MantiqatiX/  
Deployment: [GitHub Pages run 45076054135](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45076054135) — SUCCESS. Deployed-origin browser checks passed for the public root, dashboard, mobile layout and QR routes.

Main commit: `c95ccc0d891e0670fe34d97c4c1beca6bd0f4fa2`.  
Rollback copy: `/legacy/`. V6 preview: `/v6-preview/`.

This is a scoped website launch, not certification of every backend module. Full platform remains **BLOCKED / NOT CERTIFIED**.

## V1 scope now live

- Public catalog root and public business/catalog pages.
- Public catalog business cards and the existing storefront route.
- Basic owner catalog management.
- Explicit opt-in price disclosure behavior.
- Stable business/activity share links, with deployed-origin route and QR checks.
- Existing public contact pages and site map.
- The public catalog root is deployed from `apps/catalog-frontend`; rollback copy and V6 preview alias are retained.

## V1 privacy and safety boundaries

- National unclaimed directory records are not part of V1. Frontend does not request the national listing API, direct `?listing=` routes do not reveal details, and live `directory-listings` v18 remains the reviewed disabled stub (GET empty, POST 503).
- Owner public-contact consent UI is hidden until the production audited consent writer and registry are deployed. Routine profile saves do not submit contact-consent state.
- Live `public-catalog` v9 and `public-catalog-directory` v19 match all current-main bundle files. `catalog-admin` v20 and `catalog-platform-admin` v23 remain source-drifted; do not deploy them individually.
- PR #978 promotional gallery (one cover + up to 10 HTTPS image URLs) remains DRAFT until matching writer/reader/schema release. Direct local file upload is not implemented.
- Monthly subscription plans/status/entitlement can be shown only from server-authoritative data. **Monthly checkout/activation is not certified**: live `subscription-payment-intent` v4 differs from current main, and signed Paymob sandbox end-to-end proof plus secret/config verification are outstanding. Keep checkout disabled until that gate passes.

## Post-launch work — ordered backlog

### P0 — Full-platform recovery and release certification
1. Obtain genuine encrypted off-site database and Storage backups.
2. Verify Vault recovery and perform an independent PostgreSQL 17 restore/rollback.
3. Measure and record RPO/RTO.
4. Reconcile the exact 81 required migration IDs and physical object/ACL dependencies. The current release contract includes RC479 (`20261120193000`), RC921 (`20261123010000`) and RC922 (`20261123221950`) and RC923 (`20261124121348`) and RC501 (`20261124150000`). The latest recorded read-only Production ledger baseline is 310 rows through `20261110150618`, with 0/81 exact required identifiers present. RC922 passed isolated PostgreSQL 17 behavioral/concurrency tests; RC923 anonymous-session denial passed the exact-head 80-version replay; RC501 adds empty-search_path hardening for seven SECURITY DEFINER callers and is pending exact-head 81-version replay; no Production migration execution occurred.
5. Triage Security Advisor findings per function and caller: 9 RLS-enabled/no-policy INFO, 65 authenticated-callable and 1 anon-callable SECURITY DEFINER WARN, leaked-password protection disabled. No blanket EXECUTE revocation.


**Current 2026-11-24 migration checkpoint:** RC501 adds `20261124150000` to the release contract, making it 81 required source identifiers (0/81 in the live 310-row ledger). The 80-version replay above is historical evidence for the pre-RC501 contract; the exact 81-version replay is pending on the RC501 branch. Production migrations remain unapplied.

### P1 — Monthly subscription checkout
1. Reconcile current-main claim-based subscription payment intent with live v4.
2. Verify all required RPCs, schema, ACLs, idempotency, encrypted checkout recovery and provider-order binding.
3. Run a signed Paymob sandbox callback end-to-end and prove success/failure/replay handling.
4. Only then expose monthly checkout/activation. No new provider integration expansion before this gate.

### P2 — Owner promotional gallery
1. Release the matching owner writer and public reader projections with required schema/authorization.
2. Keep one fixed cover plus up to 10 promotional images.
3. If local uploads are required, design a separate owner-scoped Storage/Edge contract, moderation and deletion flow. Current PR978 only supports HTTPS URLs.

### P3 — National directory and medical directory
1. Add RC472/RC473 contact-consent registry, source-rights evidence, owner audit writer and matching public readers as one coordinated release.
2. Add positive/negative owner consent tests, anonymous projection tests, revocation and outage tests.
3. Keep the directory closed until all gates and backups pass. Medical directory remains deferred.

### P4 — Li2Lak and financial modules
- Li2Lak marketplace/offer and listing capabilities.
- Paymob integration expansion and payment/order Edge parity.
- Wallet and financial journal.
- Flexible commission activation, refunds, payouts, reconciliation and settlement.
- Non-monthly accounting and finance workflows.

## Verified evidence

- PR #982, #984 and #985 merged; PR #972 closed as superseded.
- PR #985 exact-head SHA `877a9635bea71e1cee2105af4170cb88a266f83a`: 11 workflow runs passed.
- Main Primary Catalog validation [45076054161](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45076054161) — SUCCESS.
- Main forward migration replay [45076054131](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45076054131) — SUCCESS; 112 migrations on disposable PostgreSQL, tenant isolation passed. Not Production restore evidence.
- Production Health Monitor [45076054204](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45076054204) — SUCCESS.

## Final release statement

The public website V1 is deployed and browser-verified. Backend national directory, public-contact consent, gallery, monthly checkout and finance/payment expansion remain gated as listed above. **Full platform remains BLOCKED / NOT CERTIFIED.**
