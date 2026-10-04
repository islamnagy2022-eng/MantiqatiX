# MantiqatiX — Project Continuity & Production Handoff

> **MANDATORY START HERE FOR EVERY FUTURE SESSION**
>
> Before changing code, database, Edge Functions, deployment, security, or release configuration, read this file first and then read `docs/MASTER_PRODUCTION_TODO.md`.
> Do not repeat completed work. Continue from the first still-open gate, and append every material development to both this file and the Master TODO.

## Current baseline

- Repository: `islamnagy2022-eng/MantiqatiX`
- Branch: `main`
- Supabase project: `moyhiluyhjsujhwlyeuu`
- Public site: `https://islamnagy2022-eng.github.io/MantiqatiX/`
- Latest documented project commit: `7d997bf718a52c4e74a076f4f6c14014fdb34e41`
- Latest release-gate record: **RC318**
- Final Production Gate: **OPEN**

## Latest web execution batch
- RC314–RC315: restaurant workspace feedback was upgraded from browser alerts/prompts to platform-native accessible toast/modal flows; source verification confirms no `alert(` or `prompt(` remains in `web/restaurant-module.js`.
- Public asset versions were refreshed and the PWA cache advanced to `mnty-web-v114`.
- These changes are **IMPLEMENTED — NOT VERIFIED** until the main-branch Pages workflow completes successfully.

## Work already completed — DO NOT REPEAT

### CI / release pipeline
- Multiple production CI runs through RC247 have been verified successful.
- Latest verified successful run before this continuity record: `36986515744`.
- GitHub Pages workflow validates the web release and deploys `./web`; it does **not** deploy Supabase Edge Functions.

### Supabase / database
- Production is healthy and active.
- 121 public base tables were verified.
- RLS is enabled on **121/121** public base tables.
- RLS presence is not equivalent to tenant-isolation E2E; real two-user/two-tenant verification remains open.
- No production financial test transactions were fabricated.

### Edge Functions source convergence
Production has 35 ACTIVE Edge Functions. The repository source tree currently contains 20 function directories.

The 16 functions originally found without matching repository source were:
`business-deactivate`, `approval-list`, `business-onboarding-status`, `financial-journal`, `settlement-financial-atomic`, `legal-consent`, `legal-cms`, `legal-gate`, `legal-center`, `subscription-start-trial`, `subscription-payment-intent`, `ai-gemini-proxy`, `erp-product-create`, `erp-purchase-receive`, `marketing-lead-create`, `mnty-provider-onboarding-review`.

**Already restored and exact-matched:**
- `mnty-provider-onboarding-review`
- Live source and GitHub source were byte-for-byte equal at 2195 bytes.
- Restore commit: `2a2b8ad1a48cb6293142ae019b920619f0188b88`.

**Still not converged:**
- `business-deactivate`
- `approval-list`
- `business-onboarding-status`
- `financial-journal`
- `settlement-financial-atomic`
- `legal-consent`
- `legal-cms`
- `legal-gate`
- `legal-center`
- `subscription-start-trial`
- `subscription-payment-intent`
- `ai-gemini-proxy`
- `erp-product-create`
- `erp-purchase-receive`
- `marketing-lead-create`

Live production source was revalidated for all of these. A GitHub source write attempt was rejected by the OpenAI/GitHub safety layer. Do **not** bypass the safety layer or invent replacement source.

### Security
- Supabase Security Advisor was re-run.
- Leaked Password Protection is still **DISABLED** and is a release security gate.
- Intentional public sanitized advertisement RPC warning remains.
- Six authenticated SECURITY DEFINER warnings remain and require per-function caller-path review; do not apply blanket revocation.
- `digital_page_payment_events` has RLS enabled with no policies; do not add broad policies merely to silence the advisor.

### Finance / payments
- Settlement journal posting order was fixed and migration applied in RC238.
- Refund backend authority was traced in RC239; no speculative refund API was added.
- Real Paymob/payment E2E is **NOT VERIFIED**.
- Real settlement transaction E2E is **NOT VERIFIED**.
- Real refund E2E is **NOT VERIFIED**.
- Do not create fake financial transactions to close these gates.

### Provider onboarding
- Submit/review flow and UI were implemented/verified to the documented extent.
- Review source is now converged in GitHub.
- Approval/rejection notification E2E remains open.

### Digital paid pages
- Pricing/order/idempotency/payment foundation exists.
- Public renderer, fulfillment/editor flow, browser payment E2E, refunds/receipts, SEO/QR/versioning and final regression remain open.

### Monitoring
- Production unified log streams are available and have been inventoried.
- Detailed severity/error aggregation and an incident drill remain open.

### Backup / recovery
- No real production restore rehearsal has been completed.
- RPO/RTO and two-tenant recovery remain open.

### Android
- No verified signed APK/AAB or device E2E release evidence exists.
- Prior build attempts were blocked by environment/network/Gradle availability.
- Do not claim Android release readiness without actual artifact/device evidence.

## Open release gates — work from here

Priority order:

1. **Safe Edge Function source convergence** for the 15 remaining live functions.
2. **Enable leaked-password protection** in Supabase Auth, then rerun Security Advisor.
3. **Per-function SECURITY DEFINER authorization review**; only change grants when the caller contract proves it is safe.
4. **Real two-user/two-tenant authorization E2E**.
5. **Real Paymob payment E2E**.
6. **Refund contract + refund E2E**, only after authoritative provider refund contract is established.
7. **Settlement/finance E2E**.
8. **Notification E2E** for onboarding review.
9. **Digital page public renderer + fulfillment/editor workflow + browser E2E**.
10. **Monitoring incident drill**.
11. **Backup/restore rehearsal and RPO/RTO evidence**.
12. **Android signed release + device verification**.
13. **Final regression and release evidence package**.

## Continuation protocol

For every future session:
1. Read this file.
2. Read the latest tail of `docs/MASTER_PRODUCTION_TODO.md`.
3. Inspect the current Git/CI/Supabase state only for the first open gate.
4. Do not repeat any checked item above unless new evidence invalidates it.
5. Never fabricate users, payments, backups, devices, or production outcomes.
6. Never bypass a security control or create speculative production source.
7. After every material change, append an RC entry to the Master TODO and update this continuity file if the baseline changed.
8. Only mark the Final Production Gate closed after all mandatory external/runtime evidence is actually verified.

## Release status

**NOT PRODUCTION READY YET.**

This status is intentional and must remain until the open gates above are independently evidenced.


## RC249 update — Digital Page content layer
- Added production `digital_pages` and `digital_page_sections` with RLS and publication lifecycle.
- Applied migration: `20261002110000_rc248_digital_page_content_publishing`.
- Added public renderer and authenticated owner editor under `web/digital-page*` and `web/digital-page-editor*`.
- Browser E2E, media/storage integration, QR and advanced fulfillment remain open.


## RC250 update — Edge Function source convergence batch 1
- Exact-matched live Production source into GitHub for: `settlement-financial-atomic` (`index.ts` + `deno.json`), `subscription-payment-intent`, `subscription-start-trial`, `financial-journal`.
- 11 of the original 16 missing active function sources remain to be converged.


## RC251 update
- Exact-matched 4 more live Edge Functions: `business-deactivate`, `business-onboarding-status`, `approval-list`, `legal-consent`.
- Original source-convergence gap is now reduced to 7 active functions: `legal-cms`, `legal-gate`, `legal-center`, `ai-gemini-proxy`, `erp-product-create`, `erp-purchase-receive`, `marketing-lead-create`.


## RC252 update — Edge Function source convergence CLOSED
- All 35 ACTIVE Production Edge Functions now have corresponding repository source.
- The original 16-function source gap is closed with exact live-vs-GitHub comparisons.
- CI/release verification for the final convergence commits remains pending; runtime/security/recovery release gates remain open.


## RC253 update — Final convergence CI/release verification — 2026-10-02
- [x] Verified GitHub Actions run `36987846198` for the final Edge Function source-convergence commit `286c70896ccf8ba0eea91ee5a4d0dd1cdbe8027d`.
- [x] `validate` job completed successfully, including syntax checks and required web files.
- [x] `deploy` job completed successfully, including GitHub Pages deployment and the production deployed-site verification step.
- [x] The preceding run `36987837273` was cancelled because a newer commit/run superseded it; its completed validation steps had passed before cancellation.
- [x] Edge Function source convergence is therefore now CI/release-verified for the current main baseline.
- [ ] Final Production Gate remains OPEN for leaked-password protection, per-function SECURITY DEFINER review, real multi-tenant E2E, Paymob/finance/refund E2E, notifications, monitoring drill, backup/restore, Android release/device evidence, and final regression/release evidence.

## Current baseline after RC253
- Latest verified project commit: `286c70896ccf8ba0eea91ee5a4d0dd1cdbe8027d`.
- Latest release-gate record: **RC253**.
- Final Production Gate: **OPEN**.


## RC255 — Runtime authorization test design gate — 2026-10-02
- [x] Re-read the current continuity/TODO baseline before changing scope.
- [x] Confirmed source convergence and CI verification are already closed; no repeat implementation was performed.
- [x] Audited repository call-site search for direct client calls to the six reviewed SECURITY DEFINER functions; no direct `supabase.rpc(...)` call-site was found for the searched signatures. This does not prove absence because wrappers/dynamic calls may exist.
- [x] Kept production grants unchanged because authorization correctness must be demonstrated with authenticated identities, not inferred from static search alone.
- [x] Defined the next executable release gate as a controlled two-user/two-tenant authorization E2E covering: own-tenant read/write, cross-tenant denial, customer-to-provider order/payment boundary, provider/admin role separation, and anonymous denial for authenticated-only RPCs.
- [ ] Runtime E2E remains NOT VERIFIED because the available project environment does not provide safe disposable authenticated test identities/fixtures for two independent tenants.
- [ ] Final Production Gate remains OPEN.


## RC266–RC267 update — 2026-10-03
- CI traceability for the later docs-only commit remains unverified because the available commit-run connector operation is PR-filtered; an empty result is not evidence that a push run did not execute.
- Supplied RC40 archive was audited and confirmed to contain an Android/Gradle project, but the current `main` release tree is web-only and does not contain that Android project. Android is therefore still an external/unverified release gate; no blind source merge was performed.
- Final Production Gate remains OPEN.


## RC268 update — 2026-10-03
- Hardened marketing lead mutation boundary: browser-side direct inserts into `marketing_leads` were removed from normal lead creation and advertising booking; both now use the protected `marketing-lead-create` Edge Function.
- Added CI regression checks to prevent reintroducing direct browser inserts for this table.
- Runtime multi-user/multi-tenant E2E remains open.

## RC269 update — 2026-10-03
- Re-ran live Security Advisor after the RC268 marketing mutation hardening.
- Confirmed the remaining findings are not all safe candidates for blanket revocation: the public targeted-ad RPC is intentionally exposed for advertisement serving, while RBAC/admin SECURITY DEFINER functions already have explicit authenticated-only grants and internal authorization checks.
- Checked current Supabase billing state: organization plan is Free; production project creation cost is $0/month; a development branch is currently quoted at $0.01344/hour.
- No branch or other cost-incurring resource was created.
- Recorded the current cost envelope and external dependencies for Paymob, Android distribution, PITR, browser/device testing, and push delivery.
- Final Production Gate remains OPEN.

## RC270 update — 2026-10-03
- Added CI regression guards covering sensitive browser mutation boundaries: orders, payment_intents, user_memberships, notifications, marketing_projects and advertisements.
- Verified the current `web/*.js` source has no direct INSERT/UPDATE/DELETE calls for those protected tables.
- Marketing lead protection remains enforced through the dedicated Edge Function guard.
- Runtime E2E, Paymob/finance, backup/restore, Android and external device/browser gates remain open.
- Final Production Gate remains OPEN.


## RC272 — 2026-10-03
- [🟢] CI/CD VERIFIED: GitHub Actions run #1342 (run id 37129102049) succeeded for commit `e4d1d91fa0317e3d7614a40d16b2c227b20e3808`.
- [🟢] Browser mutation boundaries remain VERIFIED through the Pages validation workflow.
- [🟡] Android remains NOT VERIFIED/BLOCKED: current main has no Android Gradle project; historical RC40 Android source must be reconciled before reintroduction. Local RC40 build was blocked before compilation by unavailable Gradle network access.
- [🟡] Supabase Security Advisor rechecked 2026-10-03: RLS-enabled/no-policy finding remains limited to `digital_page_payment_events`; SECURITY DEFINER findings remain for 1 anon-callable targeted-advertisement RPC and 9 authenticated-callable operational/RBAC functions; these were previously reviewed and are not to be disabled blindly.
- [🟡] Supabase Performance Advisor remains workload-dependent: unused-index findings and 24 multiple-permissive-policy findings remain; no blanket index/policy rewrite was applied without workload/EXPLAIN evidence.
- [ ] Release remains NOT VERIFIED until authenticated multi-account E2E, finance/payment E2E, backup/restore, monitoring, external browser/device, rollback, and Android release artifact gates are closed.


## RC314 — 2026-10-04
- Continued the 1000-stage execution track with a concrete public-web UX fix.
- Replaced the three footer `href="#"` no-op links (About / Terms / Privacy) with functional in-app information dialogs.
- Added accessible dialog semantics, initial focus, Escape close and backdrop close.
- RC314 CI was triggered; production readiness remains OPEN because the independent authenticated E2E/payment/backup/device/monitoring gates are not closed.

## RC315–RC316 update — 2026-10-04
- Continued the web-only 1000-stage execution track without reopening completed UI work.
- RC315: made the public customer-support phone number an accessible `tel:` action.
- RC316: hardened the restaurant modal with focus restoration, Tab/Shift+Tab containment, Escape/backdrop close cleanup, and initial focus on the close control.
- Latest material documentation commit: `6ffac78d3af33e6ca90f3b1a909b2a2d4fbb9013`.
- These are source-level web UX/accessibility improvements; public browser E2E and final production gates remain OPEN.

## RC317 update — 2026-10-04
- Hardened the public footer information dialog with focus containment and restoration, matching the restaurant modal accessibility pattern.
- This is a source-level web accessibility improvement; deployed browser/assistive-technology E2E remains NOT VERIFIED.
- Latest material commit: `5510a060de371d83579eb463870f1bd5edbe67c8`.


## RC318 — Production security gate re-verification — 2026-10-04
- [x] Main branch verified at `7d997bf718a52c4e74a076f4f6c14014fdb34e41`.
- [x] GitHub Pages run `37164800526` for that exact commit completed SUCCESS.
- [x] Superseded run `37164793506` was CANCELLED by the newer commit and is not treated as a failure.
- [x] Live Supabase Security Advisor re-run.
- [x] Production project is ACTIVE_HEALTHY.
- [x] Current Advisor still reports `digital_page_payment_events` RLS-enabled/no-policy, 1 anonymous-callable SECURITY DEFINER function, and 9 authenticated-callable SECURITY DEFINER functions.
- [ ] Leaked Password Protection remains NOT VERIFIED/enabled and requires the Auth/Dashboard control.
- [ ] Two-user/two-tenant adversarial E2E remains NOT VERIFIED.
- [ ] Payment/refund/settlement E2E remains blocked on production credentials and safe real-payment authorization.
- [ ] Backup/restore, rollback, browser/device smoke, and Android signed/device evidence remain open.
- Final Production Gate remains OPEN; project is NOT PRODUCTION READY YET.
\n\n## RC319–RC321 — 1000-stage continuation review — 2026-10-04\n- [x] Stage 319 reviewed: notification persistence, RLS, server-generated events, push dispatcher and existing security boundary are implemented; real browser/device delivery remains NOT VERIFIED.\n- [x] Stage 320 reviewed: analytics/reporting must remain derived from authoritative operational/event sources; no parallel analytics truth is introduced. Operational/report E2E remains NOT VERIFIED and the stage is PARTIAL.\n- [x] Stage 321 reviewed: payment/pricing/webhook/settlement/journal boundaries remain server-authoritative; real payment/refund/settlement/GL lifecycle remains NOT VERIFIED.\n- [x] Live production counts rechecked without mutation: notifications=0, audit_logs=9, payment_intents=0, payment_provider_events=0, journal_entries=0, general_ledger=0, orders=0.\n- [x] No synthetic notification, payment, order or financial record was created to manufacture evidence.\n- [ ] Final Production Gate remains OPEN.\n- Next 1000-stage execution target: Stage 322 governance → 323 content → 324 PWA → 325 performance, continuing sequentially until Stage 1000, while independently recording blockers and evidence.\n\n\n## RC322–RC330 — 1000-stage continuation review — 2026-10-04\n- [x] Stages 322–325 reviewed: governance/content/PWA/performance foundations exist, but runtime governance/content consistency, real PWA behavior and workload-based performance verification remain open.\n- [x] Stages 326–330 reviewed: QA/release controls exist but final regression is not verified; final integration is partial; subscription lifecycle is not runtime-verified; Android remains blocked because current main lacks the reconciled Android project and signed/device evidence.\n- [x] No speculative migrations, mass indexes, synthetic financial transactions, fake notifications or blind Android source merge performed.\n- [ ] Continue sequentially from Stage 331 through Stage 1000.\n\n\n## RC331–RC1000 — 1000-stage full review pass — 2026-10-04\n- [x] Completed detailed Cycle 16 review for stages 331–352.\n- [x] Completed explicit stage-by-stage review matrix for stages 353–1000, including Stage 1000.\n- [x] The repeated 22-axis cycles were mapped against the latest verified source/security/runtime evidence rather than falsely re-implementing the same features.\n- [x] No synthetic production data, fake payment, fake notification, blind Android merge, destructive migration or mass performance rewrite was used to manufacture closure.\n- [ ] Many stages remain IMPLEMENTED — NOT VERIFIED or PARTIAL because external/runtime evidence is still required. Android remains BLOCKED.\n- [ ] Final Production Gate remains OPEN / NOT PRODUCTION READY YET until mandatory external gates are evidenced.\n

## RC335 — Targeted advertisement SECURITY DEFINER hardening — 2026-10-04
- [x] Re-verified `public.digital_page_payment_events`: RLS enabled, zero `anon/authenticated` table grants, zero policies; retained as fail-closed backend-only event ledger.
- [x] Re-verified `public.get_mnty_targeted_advertisements(...)`: intentional public ad-serving boundary, still `SECURITY DEFINER` and callable by `anon`/`authenticated`.
- [x] Applied production migration `20261004003742 rc335_harden_targeted_ad_security_definer_search_path` to set `search_path = public, pg_temp`.
- [x] Live SQL verification confirms the hardened function configuration.
- [ ] Security Advisor still reports the intentional public SECURITY DEFINER warning; this is not falsely marked closed because the public-serving contract remains intentional.
- [ ] Leaked-password protection, adversarial multi-tenant E2E, payment/finance E2E, backup/restore, browser/device/push, and Android release evidence remain open.
- Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.
