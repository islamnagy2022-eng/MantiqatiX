# CURRENT RELEASE GATE — 2026-11-28 — RC932

This overlay supersedes older migration-count and Production-state summaries below; historical entries remain unchanged.

- Current canonical source contract: **89 required migration IDs**, chronologically ordered.
- Latest direct read-only Production ledger: 310 rows through `20261110150618`; **0/89 exact required identifiers** are recorded. This is an identity gap, not proof every physical effect is absent.
- RC930 remains source-only; new RC932 (`20261127235334`) is the 89th candidate and requires `is_anonymous=false` explicitly for MantiGO open-ride location disclosure.
- RC932 regression cases: missing claim, JSON null and true denied; explicit false preserves verified/available captain access. The timestamped file was generated using pinned Supabase CLI 2.122.0 and is pending exact-head/full replay CI.
- RC932 is not applied to Production. Do not apply or deploy any migration/function separately. Backup/restore, global authorization, full DB/Edge parity, payment/finance sandbox and release approvals remain blocked.
- `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

---

# Website First Launch and Post-Launch Backlog — 2026-11-22

## Release result

**Website V1 is deployed.**  
Production URL: https://islamnagy2022-eng.github.io/MantiqatiX/  
Latest deployment: [GitHub Pages run 45865039338](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45865039338) — SUCCESS on 2026-11-26. Deployed-origin browser checks passed for the public root, dashboard, mobile layout, QR routes and activity-share dialog keyboard accessibility.

Latest main commit: `2cc6639fc0f8af04d04311910c94bc9b959e1d8b` (PR #1142).  
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

## 2026-11-26 — Activity share accessibility shipped

- PR #1142 is merged and deployed. The activity share dialog moves keyboard focus into the dialog, keeps Tab/Shift+Tab inside it, closes with Escape and restores focus to the invoking button.
- The exact-head local browser regression passed; the post-merge deployed-origin regression also passed: `ACTIVITY_SHARE_DIALOG_BROWSER_E2E=PASS focus_trap=true focus_restore=true direct_link=true`.
- The deployed-origin primary catalog browser suite, case-insensitive route checks, root/legacy/V6 checks and V6 desktop/mobile preview checks passed.
- This is a scoped frontend deployment only. It does not certify Production database migrations, RLS/ACL, Edge dependencies, payment, wallet or settlement workflows.

## V1 privacy and safety boundaries

- National unclaimed directory records are not part of V1. Frontend does not request the national listing API, direct `?listing=` routes do not reveal details, and live `directory-listings` v18 remains the reviewed disabled stub (GET empty, POST 503).
- Owner public-contact consent UI is hidden until the production audited consent writer and registry are deployed. Routine profile saves do not submit contact-consent state.
- Live `public-catalog` v9 and `public-catalog-directory` v19 match all current-main bundle files. `catalog-admin` v20 and `catalog-platform-admin` v23 remain source-drifted; do not deploy them individually.
- Promotional gallery supports one cover plus up to 10 HTTPS image URLs in source. PR #1136 is merged and adds a fail-closed save guard; actual gallery writes remain disabled until RC928 and the matching `catalog-admin`, `public-catalog` and `public-catalog-directory` bundles are released together. Direct local file upload is not implemented.
- Monthly subscription plans/status/entitlement can be shown only from server-authoritative data. **Monthly checkout/activation is not certified**: live `subscription-payment-intent` v4 differs from current main, and signed Paymob sandbox end-to-end proof plus secret/config verification are outstanding. Keep checkout disabled until that gate passes.

## Post-launch work — ordered backlog

### P0 — Full-platform recovery and release certification
1. Obtain genuine encrypted off-site database and Storage backups.
2. Verify Vault recovery and perform an independent PostgreSQL 17 restore/rollback.
3. Measure and record RPO/RTO.
   - Current release scope contains 88 required migration IDs; the live ledger still has 0/88 exact required identifiers. RC480 (`20261118210000`) remains the public digital-page anonymous-column boundary and prerequisite for RC927. RC926 (`20261125110000`) is the prior strict provider-profile identity boundary; RC927 and RC928 are source-only and remain unapplied to Production.
- RC927 (`20261125120000`) was merged source-only in PR #1122 as `ffd91df42c0cc70bfce692cc79045132cff5c383`; exact-head 17/17 workflows passed, including the 85-source strict gate and chronological PostgreSQL 17 replay (123 forward migrations). It remains unapplied to Production. RC928 (`20261126010000`) remains a source-only candidate for atomic catalog-profile/gallery persistence; its exact-head static, owner-profile PG17 and full 85-source replay were not part of PR #1122. The current combined release candidate is tracked by the 88-source gate. Neither release is applied to Production.
- RC117 image-provenance repair (`20261126020000`) was merged source-only in PR #1129; the 88-version release-gate branch adds a focused PostgreSQL 17 preservation/idempotency test and keeps it unapplied to Production.
- RC929 (`20261126030000`) remains the 87th source entry. It adds restrictive explicit-confirmed-Auth guards to order and order-history access; direct live read-back shows RLS/FORCE RLS on, anon SELECT off, but no strict missing-claim guard. Its dedicated PostgreSQL 17 baseline and positive/negative integration are wired into RC465 and full chronological replay. It remains unapplied to Production.
- RC930 (`20261127010000`) is the 88th required source migration. It serializes job-application submission against concurrent job deactivation using a `FOR SHARE` job-row lock. Its PostgreSQL 17 tests cover active, inactive, missing and duplicate applications plus two-session lock ordering. Production has no RC930 ledger row and its live RPC still lacks this lock.
5. Triage Security Advisor findings per function and caller: 9 RLS-enabled/no-policy INFO, 65 authenticated-callable and 1 anon-callable SECURITY DEFINER WARN, leaked-password protection disabled. No blanket EXECUTE revocation.

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

- RC927 is merged source-only (PR #1122, `ffd91df42c0cc70bfce692cc79045132cff5c383`); exact-head PostgreSQL 17 and 85-source chronological replay passed. RC927 remains unapplied to Production. RC928 is still a source-only candidate pending exact-head validation and must not be deployed independently.
- RC117 image-provenance repair is merged source-only (PR #1129) and must be included after RC928 and before RC929 in the chronological 88-version chain; no Production migration was applied.


## 2026-11-26 — RC929 orders identity boundary

- Source candidate branch: `security/rc929-orders-explicit-confirmed-auth-guard-20261126`.
- Direct Production read-back: `orders` and `order_status_history` have RLS/FORCE RLS enabled, anon SELECT disabled, authenticated SELECT enabled; strict explicit-confirmed-Auth restrictive guard is absent on both. Missing/null `is_anonymous` claims are a fail-open policy condition, not evidence of a confirmed breach.
- RC929 adds restrictive `FOR ALL TO authenticated` policies requiring non-null `auth.uid()` and explicit `is_anonymous=false`, preserving current RC465 branch/business scope and customer-own-order access. It is source-only and not applied to Production.
- Production contract is now 88 migrations; live ledger remains 310 rows through `20261110150618`, 0/88 exact required IDs. Full platform remains **BLOCKED / NOT CERTIFIED**.
