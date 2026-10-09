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
- Latest documented project commit: `51b4d8d4c857cab3fad43ee68025cb7b6ce838a4`
- Latest release-gate record: **RC337**
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


## RC336 — Authenticated SECURITY DEFINER hardening — 2026-10-04
- [x] Re-inventoried the 9 SECURITY DEFINER functions executable by `authenticated`; none are executable by `anon`.
- [x] Reviewed the critical RBAC/payment boundaries for `auth.uid()`, active membership and centralized permission checks.
- [x] Applied production migration `20261004003820 rc336_harden_authenticated_security_definer_search_paths` to set `search_path=public, pg_temp` on all 9 authenticated-callable SECURITY DEFINER functions.
- [x] Live SQL verification confirms all 9 retain `authenticated_execute=true`, `anon_execute=false`, and the hardened search path.
- [x] Security Advisor re-run; the 9 authenticated SECURITY DEFINER warnings remain as intentional RPC boundaries and are not falsely suppressed.
- [ ] Leaked-password protection, adversarial multi-tenant E2E, payment/finance E2E, backup/restore/rollback, browser/device/PWA/push and Android release evidence remain open.
- Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.


## RC337 — Current security/release gate snapshot — 2026-10-04
- [x] Live Supabase project remains ACTIVE_HEALTHY on PostgreSQL 17.6.1.155.
- [x] Migration history rechecked; latest production migration is `20261004003842 rc336_harden_authenticated_security_definer_search_paths`.
- [x] Added read-only reusable verification contract: `scripts/verify-rc337-security-definer-hardening.sql`.
- [x] Added evidence record: `docs/RC337_CURRENT_SECURITY_RELEASE_GATE.md`.
- [x] Static web spot-check found no `eval()`/\`new Function()\` and no direct browser `service_role` exposure; inspected dynamic public-home rendering uses escaping for user/database text and public ad URLs are normalized.
- [x] Security Advisor re-run: 1 RLS/no-policy backend-only ledger, 1 intentional anon SECURITY DEFINER ad RPC, 9 intentional authenticated SECURITY DEFINER RPCs, contextual anonymous-policy warnings, and leaked-password protection disabled.
- [x] Performance Advisor re-run: 107 unindexed FK findings and 24 multiple-permissive-policy findings remain; no blanket rewrite performed without workload evidence.
- [ ] Final Production Gate remains OPEN / NOT PRODUCTION READY YET.
- [ ] External runtime gates remain: leaked-password protection, two-user/two-tenant E2E, order/notification E2E, real payment/finance/refund E2E, browser/device/PWA/push, backup/restore/rollback, Android signed/device evidence.


## RC337 CI evidence — 2026-10-04
- [x] GitHub Actions run `37165994161` for commit `053298d6975d8e2bd3398e8e005d34392c9625b1` completed **SUCCESS**.
- [x] The preceding rapid superseded runs for the intermediate RC337 commits were CANCELLED by newer pushes and are not treated as failures.
- [ ] Final Production Gate remains OPEN because CI success does not substitute for external runtime, payment, recovery, browser/device, Auth managed-setting or Android evidence.


## RC338 — Production boundary audit — 2026-10-04
- [x] Verified RLS is enabled and policy-backed for orders, payment_intents, user_memberships, support_tickets, ticket_messages, notifications, financial_obligations, settlement_transactions and general_ledger.
- [x] Verified `payment_intents` has `UNIQUE (tenant_id, idempotency_key)`.
- [x] Re-verified the server-side payment-intent RPC validates authenticated identity, tenant/order ownership boundary, payable status, authoritative pricing snapshot, amount/currency and idempotency.
- [x] Added read-only audit contract: `scripts/verify-rc338-production-boundaries.sql`.
- [x] Added evidence record: `docs/RC338_PRODUCTION_BOUNDARY_AUDIT.md`.
- [ ] Runtime adversarial two-user/two-tenant E2E remains NOT VERIFIED.


## RC339 — Mantiqati official showcase — 2026-10-04
- [x] Applied production migration `rc339_seed_mantiqati_official_showcase` successfully.
- [x] Seeded 25 official showcase sectors/activities under `MNTY-PLATFORM`.
- [x] Seeded 24 active master modules and enabled all 24 modules for each showcase business: 600 business-module bindings.
- [x] Created 25 official business profiles, 25 OWNER memberships for the existing Super Admin identity, 25 verified/featured provider profiles, 25 primary services and provider-service links.
- [x] Respected the existing legal business activation trigger; no trigger was disabled and no consent was fabricated.
- [x] Added a narrowly scoped public RLS policy for active businesses where `settings.showcase=true`.
- [x] Added 25 SVG activity identity/logo assets under `web/assets/activities/`.
- [x] Integrated the official showcase and module catalog into the public homepage in `web/app.js`.
- [x] Live SQL verification returned 25 sectors, 24 modules, 25 active showcase businesses, 25 active owner memberships, 25 active verified profiles, 25 services and 600 enabled module bindings.
- [ ] Browser/Super Admin runtime smoke verification remains to be completed.
- [ ] Domain-specific transactional E2E remains a separate release gate.
- Production Release Gate remains **OPEN / NOT PRODUCTION READY YET**.


## RC339 final CI / admin showcase evidence — 2026-10-04
- [x] Added the Super Admin official showcase management panel to `web/app.js`; it reads actual showcase businesses, provider verification, enabled module counts and service counts.
- [x] Final GitHub Actions run `37166847421` for commit `6ae605fba630ef958d4ea24c4080859a25da9f2e` completed **SUCCESS**.
- [x] The final syntax check passed after resolving the showcase admin HTML join error; previous superseded runs are not treated as failures except the earlier syntax-error run that was explicitly corrected.
- [x] Production database evidence remains: 25 active showcase businesses, 25 OWNER memberships, 25 verified/featured profiles, 25 services and 600 enabled module bindings.
- [ ] Public browser smoke verification of the deployed homepage and Super Admin runtime panel remains an external runtime check; the public-site fetch could not be completed from this environment.
- [ ] Final Production Gate remains **OPEN / NOT PRODUCTION READY YET** because the previously documented Auth, adversarial E2E, payment, recovery, device/PWA/push and Android gates remain open.


## RC340 — 2026-10-04 — Public digital-link hardening
- [x] Hardened public digital-page links in `web/home.js`: URLs are now accepted only when their resolved protocol is `http:` or `https:`.
- [x] Removed the `#` fallback for missing/invalid digital content URLs; unavailable links remain visible as non-interactive status text instead of dead anchors.
- [x] Added the corresponding unavailable-link visual state in `web/home.css`.
- [x] Refreshed public asset versions in `web/index.html` and advanced the service-worker cache from `mnty-web-v114` to `mnty-web-v115`.
- [ ] CI/deployed-site verification is still pending for the RC340 commits; do not mark this UI hardening as production-verified until the Pages workflow provides evidence.


## RC358 — Live security/performance re-verification — 2026-10-04
- [x] Production Security Advisor re-run completed against moyhiluyhjsujhwlyeuu.
- [x] digital_page_payment_events remains intentionally backend-only with RLS enabled and no direct anon/authenticated table grants.
- [x] The targeted-ad SECURITY DEFINER RPC remains intentionally public and hardened with search_path=public, pg_temp.
- [x] All 9 authenticated-callable SECURITY DEFINER RPCs retain search_path=public, pg_temp and no anonymous EXECUTE privilege.
- [x] Performance Advisor currently reports 26 multiple-permissive-policy findings; no blanket policy rewrite was performed because several findings represent legitimate alternative authorization paths.
- [ ] Leaked Password Protection still requires the Supabase Auth managed setting to be enabled by the project owner, then independently rechecked.
- [ ] Final Production Gate remains OPEN.


## RC359 — CI security boundary contract
- Added `scripts/validate-security-definer-contract.mjs` and wired it into `.github/workflows/pages.yml`.
- The release workflow now checks that all eight authenticated SECURITY DEFINER boundaries retain the RC336 `search_path=public,pg_temp` hardening and that the RC337 live-verification contract remains present.
- This is a source/CI guard, not live authorization proof; adversarial two-user/two-tenant E2E remains open.
- Production Gate remains **OPEN / NOT PRODUCTION CERTIFIED**.

## RC359 CI evidence — 2026-10-04
- [x] GitHub Actions run `37169800396` completed SUCCESS for the RC343 closure-gate commit `da5c7dda5e66eb2f6e372f4607f9842f0ce9a800`.
- [x] `validate` passed, including the RC359 SECURITY DEFINER/RBAC source contract.
- [x] `deploy` passed and deployed-site smoke verification passed.
- [ ] Runtime release blockers remain unchanged: Auth managed setting, adversarial tenant E2E, real payment/finance, recovery/rollback, browser/device/PWA/push and Android signed/device evidence.
- Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.

## RC360 — Production gate integrity contract — 2026-10-04
- [x] Added `scripts/validate-production-gate-contract.mjs` to prevent accidental certification drift in the release documentation.
- [x] Wired the validator into `.github/workflows/pages.yml`.
- [x] The validator preserves the explicit open status of critical external/runtime gates and the required CI security contracts.
- [ ] No external gate is considered closed by this source/CI guard.
- Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.

## RC361 — Public sponsored-ad accessibility hardening — 2026-10-04
- [x] Targeted-ad cards support keyboard activation with Enter/Space while retaining the in-app modal interaction.
- [x] The production-gate validator now guards this interaction contract.
- [ ] Real browser/assistive-technology/device E2E remains NOT VERIFIED.


## RC362 — Official activity asset CI boundary

- CI now validates both the legacy `web/assets/activity/*.svg` catalog and the official `web/assets/activities/*.svg` catalog used by the public sector/activity grid.
- Commit: `66a508f1a9cdfe1595e0b297b16ea77b232baeab`.
- No production database mutation was performed by RC362.
- Live Supabase read-only verification: 25 active official showcase businesses, 25 active verified/featured official providers, 110 active services, 110 active provider-service links, 600 enabled business-module bindings, and 26 active OWNER memberships.
- These counts are catalog/readiness evidence only; they do **not** close multi-user adversarial E2E, booking E2E, payment/refund/settlement E2E, backup/restore/rollback, device testing, or final production certification.


## RC363 — Full sector directory visibility

- Public homepage sector directory now explicitly presents **all 27 canonical sectors** as a permanent visible grid rather than a shortened/hidden category presentation.
- Desktop layout remains 7 activities per row; responsive layouts use 5/3/2 columns by viewport.
- Added a visible sector-count indicator and clearer Arabic heading/copy.
- The live taxonomy source was checked in `web/home.js`: exactly 27 canonical entries are present.
- RC363 changes are UI/catalog presentation only; no production business/order/financial data was modified.

## RC364 — Sector Tile Visibility Hardening
- **Status:** IMPLEMENTED — WAITING FOR CI EVIDENCE.
- Browser screenshot review identified that the 27-sector directory was technically present but visually too faint/empty.
- Updated the public sector renderer and CSS so every sector has an explicit card, persistent visual glyph fallback, eager icon loading, stronger contrast, and accessible naming.
- This is a presentation-only hardening; no production business, order, payment, or financial records were changed.


## RC365 — قطاعـات الصفحة الرئيسية: إصلاح مسار الرسم والكاش
- الحالة: IMPLEMENTED — WAITING FOR CI EVIDENCE
- السبب المعالج: كان تحديث عداد القطاعات يتم قبل تركيب البطاقات؛ أي استثناء أثناء توليد عنصر واحد كان يترك العداد ظاهرًا مع شبكة قطاعات فارغة.
- تم جعل توليد كل بطاقة دفاعيًا مع قيم افتراضية آمنة لكل icon/label/description/code.
- تحميل صورة القطاع أصبح اختياريًا مع `onerror` لإخفائها عند فشل الأصل دون إلغاء البطاقة.
- تم رفع نسخة `home.js` إلى `rc365` ونسخة Service Worker إلى `v116` لكسر الكاش القديم.
- لا توجد تغييرات على بيانات الأعمال أو الطلبات أو المدفوعات أو البيانات المالية.


## RC366 — تثبيت مصفوفة القطاعات وعقد CI
- الحالة: IMPLEMENTED — WAITING FOR CI EVIDENCE
- تم فرض المصفوفة النهائية للقطاعات على محدد `#mx-category-grid` بعد جميع قواعد CSS التاريخية، بحيث تكون 7 أعمدة على سطح المكتب و5/3/2 حسب العرض.
- تم فرض `visibility:visible` و`opacity:1` لبطاقات القطاعات، ورفع طبقة glyph الاحتياطية فوق الصورة.
- أضيف `scripts/validate-sector-rendering.mjs` ويتحقق من 27 قطاعًا، renderer دفاعي، fallback للصورة، 7 أعمدة، وتدوير الكاش.
- تم ربط العقدة داخل Pages CI.
- لا توجد أي تغييرات على بيانات الإنتاج أو الطلبات أو المدفوعات أو الحسابات المالية.


## RC367 — Module runtime test gate
- Added a CI-enforced runtime/data contract check for all 28 catalog modules.
- This advances every module from catalog-only presence toward an explicit executable runtime contract without fabricating production transactions.
- Real customer/provider/payment/device E2E remains an external evidence gate.


## RC385 update — 2026-10-07
- Homepage visual rebuild is implemented on branch `feat/homepage-rebuild-rc385` and tracked by PR #56.
- Scope is UI/CSS plus the matching rendering validator/cache contract; no database or payment behavior was changed.
- A validator mismatch was found and corrected: the check now validates `home.css?v=rc385` rather than `home.js?v=rc385`.
- Latest branch commit: `147e288617e9144b423f0ea065862e731afa0ae`.
- Production Pages workflow supports `workflow_dispatch`, but the available connector cannot dispatch it. No deployment result for the corrected RC385 commit is therefore claimed.
- RC385 remains NOT VERIFIED for production runtime. Do not merge until CI/deployment evidence exists.
- Core production blockers remain: leaked-password protection, per-function SECURITY DEFINER review, real two-user/two-tenant E2E, payment/finance E2E, notification E2E, backup/restore, Android signed/device evidence, browser smoke, and final regression/release evidence.


## RC386 update — 2026-10-07
- Revalidated Production Supabase security state before making any security change.
- 128/128 public tables have RLS enabled; anonymous Auth users = 0; one intentional anonymous SECURITY DEFINER endpoint remains for sanitized advertisements.
- Security Advisor's anonymous-policy findings were sampled at policy level and are bound to `authenticated` with explicit non-anonymous guards; no broad policy rewrite was made.
- Leaked-password protection is still disabled and requires managed Auth/dashboard action.
- No production schema/data/payment mutation was performed.


## RC387 update — 2026-10-07
- Revalidated CI evidence for the latest RC385 branch head `39bf8aa1ee0aff029f7c6a2e2b0cabb0327ac6b6`.
- Two relevant validation workflows completed successfully; no commit statuses are attached.
- Production Pages deployment/runtime is still not evidenced for this branch head, so the homepage change remains unmerged and NOT VERIFIED in production.


## RC388 update — 2026-10-07
- Verified root cause of unchanged public homepage: RC385 exists only on the feature branch; Pages deployment is main-only.
- Updated Pages workflow so validation runs on PRs while deployment remains main-only.
- No production merge/deployment claimed; waiting for CI evidence before merge.


## RC389 — 2026-10-07 — Sponsored-ad and homepage control hardening
- [x] Reworked the homepage sponsored-ad presentation to use the live targeted-ad payload for the side advertising rail instead of a permanently static placeholder.
- [x] Added explicit live/empty states for the side sponsored-ad rail; empty state routes to the governed advertising flow.
- [x] Hardened sponsored-card activation so nested CTA buttons do not double-fire the card handler.
- [x] Featured-provider sponsored cards now open the provider profile directly instead of depending on a filtered provider-grid DOM element being present.
- [x] Refreshed homepage asset cache versions to rc389.
- [x] No production business/order/payment/financial records were mutated.
- [ ] Browser/device production smoke remains required before claiming runtime verification.


## RC390 — 2026-10-07 — Sponsored-ad RPC contract correction
- [x] Live Supabase inspection confirmed `get_mnty_targeted_advertisements(...)` returns `advertisement_id`, not `id`.
- [x] Homepage sponsored-card and side-rail rendering now use `advertisement_id` for stable activation and modal lookup.
- [x] Live RPC smoke query returned four active HOME_SPONSORED global advertisements with valid creative URLs.
- [x] No database mutation was required for this correction.
- [ ] Current commit CI/browser/device evidence remains external/unverified.

## RC391 — Sponsored-ad CI contract + production deployment verification — 2026-10-07
- [x] Added `scripts/validate-home-sponsored-ads.mjs` to lock the homepage sponsored-ad contract to `advertisement_id`, `HOME_SPONSORED`, live side-rail rendering, and safe URL handling.
- [x] Added the validator to `.github/workflows/pages.yml`.
- [x] GitHub Actions Production Health Monitor for commit `00ad4b95aaecf6b5a1675d9ea008011154ace794` completed SUCCESS.
- [x] Deploy MantiqatiX Web run #1978 completed SUCCESS; validate, deploy, and deployed-site verification all completed successfully.
- [x] Live Supabase RPC smoke returned four active `HOME_SPONSORED` advertisements using `advertisement_id`; public RPC execution is intentional and hardened with `search_path=public, pg_temp`.
- [x] `digital_page_payment_events` remains fail-closed: RLS enabled and zero direct anon/authenticated table grants.
- [ ] Managed Supabase Auth Leaked Password Protection remains outside the available automation surface and is not claimed enabled.
- [ ] Full browser/device adversarial E2E, backup/restore rehearsal, rollback rehearsal, Android signed/device E2E, and independent production acceptance remain required before declaring final certification.


## RC394 — Homepage visual identity deployment checkpoint
- 2026-10-07
- Implemented the new homepage visual system against the supplied visual reference.
- Reworked header, hero, module/category presentation, sponsored area, provider grid, business-growth presentation, footer, responsive behavior, and design-token overrides.
- Preserved live search, sponsored-ad RPC contract, provider data, authentication, and existing backend boundaries.
- Cache contract advanced to RC393.
- Important: GitHub commits for RC393 exist on `main`, but no new GitHub Actions run/status was returned for the RC393 commits at verification time; therefore production Pages deployment is NOT VERIFIED yet.

- RC394: removed legacy emoji-style UI icons, added neutral CSS icon system, and advanced homepage cache to rc394. Production deployment remains NOT VERIFIED until a GitHub Pages workflow run is observed.


## Session checkpoint — 2026-10-09 — Restaurant membership/table-state hardening

- Baseline inspected: `main` at `f1f653d2112124dda85cc717d47127e03e1af541` (latest commit visible in repository history at checkpoint time).
- Working branch: `fix/restaurant-membership-table-state-20261009`.
- Pull request: #85 — `https://github.com/islamnagy2022-eng/MantiqatiX/pull/85`; OPEN, NOT MERGED. PR #84 was not merged or modified.
- Source reviewed: `web/restaurant-module.js`, `web/app.js`, `scripts/validate-restaurant-rbac-contract.mjs`, `docs/PROJECT_CONTINUITY.md`, `docs/MASTER_PRODUCTION_TODO.md`, and `docs/RC337_CURRENT_SECURITY_RELEASE_GATE.md`.
- Changes proposed on the working branch:
  1. Membership selection resolves only against ACTIVE rows belonging to the authenticated user.
  2. If no selector exists, automatic selection is permitted only when exactly one ACTIVE membership exists; multiple memberships fail closed.
  3. Invalid/stale saved membership selection and membership query errors render explicit failure states.
  4. Restaurant table edit modal preselects the row's current state rather than defaulting to EMPTY.
  5. Static contract assertions were added for the above regressions.
- Source-level checks executed against the branch content: membership ownership/status guard, ambiguity/invalid-selection fail-closed behavior, visible error state, all five table statuses preserving current selection, and existing CRM/support RBAC assertions. These checks passed after correcting the local inspection expression. This is **not** equivalent to running the Node validator, browser E2E, or authenticated production tests.
- GitHub Actions/workflow-run connector returned no workflow runs and no commit status entries for PR head `bbc69395079fc75df680a02ce4c88e9b0c642f74` at this checkpoint. CI status: **NOT VERIFIED**.
- No production database writes, migrations, Edge Function deployments, payment/refund/settlement transactions, or production data mutations were performed.
- Restaurant module remains **PARTIAL / NOT VERIFIED**. Still required: confirm current branch/tenant scope in all mutation paths; review direct client writes for table and inventory lifecycle invariants; verify canonical catalog/order/status APIs; authenticated owner/manager/provider E2E; cross-tenant and cross-branch denial; concurrency/idempotency; kitchen/table/order synchronization; and regression/runtime tests.
- Main production release gate remains **OPEN**. The master TODO still requires independent authenticated multi-tenant tests, customer→provider→order→status→notification E2E, Paymob/payment and settlement E2E, managed leaked-password protection, release-device tests, and backup/restore/rollback evidence.
- Next step: obtain CI evidence for PR #85 and review the complete restaurant mutation boundary before further code changes. Keep PR unmerged until tests and review establish safety. Then continue the first still-open P0 item in `docs/MASTER_PRODUCTION_TODO.md` using the current source as authority.


## Follow-up checkpoint — 2026-10-09 — Restaurant RBAC convergence

- Additional source finding: `web/restaurant-module.js` used a hard-coded role allowlist for all restaurant actions, despite the project having a canonical `window.MNTY_RBAC.can(role,module,action,permissions)` contract.
- Changed membership read to include the persisted `permissions` field and replaced the hard-coded allowlist with central RBAC checks.
- Menu/inventory actions now check `CATALOG` create/update permissions; table actions check `OPERATIONS` create/update permissions; order creation and status changes check `ORDERS` create/update permissions. UI controls and mutation entry points both use these guards. Server/RLS remains the ultimate authorization boundary.
- Extended `scripts/validate-restaurant-rbac-contract.mjs` to assert permissions are loaded, the central RBAC contract is used, hard-coded role allowlists are absent, and order/table actions are permission-gated.
- Current implementation commit: `e21559769cda967e6d3324b040b19353817c25ad`.
- Static source inspection still does not equal an executed Node validator or authenticated runtime test. CI evidence remains pending; no deployment or production mutation is claimed.
- Continue by validating syntax and contract tests through CI; inspect table/menu/inventory mutation scoping and double-submit/idempotency behavior next. Keep PR #85 unmerged until the full test result and review support merge.

## Follow-up checkpoint — 2026-10-09 — Live Supabase restaurant policy/index review

- Read-only Supabase inspection was performed against project moyhiluyhjsujhwlyeuu; no SQL writes, migrations, data changes, function deployments, or payment actions were performed.
- Live pg_policies confirms restaurant_menu_items, restaurant_tables, and restaurant_inventory have restrictive authenticated-session/non-anonymous/scope boundaries, but their permissive legacy SELECT/UPDATE policies still depend on owner_user_id = auth.uid() or is_platform_admin(). Insert policies require owner_user_id = auth.uid(). Therefore central UI RBAC for manager/staff roles does not itself grant those roles database access. This is a BLOCKED_SECURITY / database-policy mismatch requiring an approved least-privilege RLS migration and separate authenticated test identities before manager/staff workflow can be certified. Do not apply policy changes from this session without explicit authorization.
- Live restaurant_tables_owner_user_id_table_number_key is unique on (owner_user_id, table_number), not (tenant_id, business_id, branch_id, table_number). The current client can reject a duplicate among currently loaded rows, but this cannot prevent concurrent duplicate table numbers across different owners. Correct branch-scoped uniqueness requires an approved database design/migration and duplicate-data audit; no index was changed.
- Source hardening adds tenant/business/branch equality filters to legacy update calls, prevents concurrent modal-save clicks, prevents concurrent order-create clicks, and rejects table numbers duplicated in the currently loaded view. These are defensive client safeguards, not substitutes for database enforcement.
- Canonical catalog mismatch remains open: restaurant menu editing writes restaurant_menu_items, while restaurant order creation reads the central catalog API and creates through order-create. Until the menu is converged on catalog-admin/catalog_items/catalog_item_prices, editing the legacy restaurant menu may not affect what the order flow can actually sell. Do not claim catalog/order consistency until this path is migrated and tested.
- Current PR #85 remains open/unmerged. The CI connector has returned no workflow-run/status entries for the checked branch head, so Node validator/build/browser tests remain NOT VERIFIED.
- Next: inspect and document the canonical catalog RPC contracts and the existing catalog-management UI flow; prepare a minimal source-only convergence proposal without touching production schema. Then validate through CI. Obtain owner authorization for RLS/unique-index migrations and independent test identities before claiming full operational completion.

## Follow-up checkpoint — 2026-10-09 — Canonical restaurant catalog/cart and CI

- Restaurant module now reads menu items and effective EGP prices from the canonical /api/v1/catalog API rather than restaurant_menu_items. The legacy menu write path has been removed; menu editing remains read-only until an approved, executable, least-privilege catalog write path exists.
- Added multi-item cart selection, per-item quantity, catalog options, customer name/phone, TAKEAWAY/DELIVERY selection, required delivery address for DELIVERY, server-side pricing authority, and reuse of the same idempotency key when retrying an identical request payload.
- Added UI transition matrix for table states, prevents setting EMPTY while current_active_order_id exists, checks duplicates in currently loaded tables, and disables repeated saves/order-create clicks. These are client-side guards only; they do not replace server-side transition enforcement or branch-scoped uniqueness.
- Added source changes in supabase/functions/catalog-admin/index.ts to check tenant/business/branch membership and in supabase/functions/order-create/index.ts to reject metadata.is_available=false. These Edge Function changes are source-only and have NOT been deployed to Supabase.
- Important live finding: upsert_catalog_item_backend and upsert_catalog_price_backend are EXECUTE-granted to service_role only (not anon/authenticated). The current catalog-admin Edge Function forwards the user's JWT when calling these RPCs; therefore a safe executable write route still needs a coordinated server-side authorization/grant design. Do not enable catalog editing or deploy this path until that is resolved.
- Source-level JavaScript syntax and the complete restaurant contract validator assertions passed in-session against the fetched branch files. This is not a substitute for GitHub Actions; latest CI for commit 5586c90c6d8c4174bba5175e090d887f8af32141 exposed a stale validator expectation, which was corrected in commit d904e9f5e8e59efa7232012db19cc1df3f4e6343; further canonical catalog/cart/table assertions were then added.
- Current branch head at checkpoint: b9b978c21ab9cd1a68dd74a27fd7f4a164ca5d28. PR #85 remains OPEN and UNMERGED. Latest Module Professionalization Validation, Backend-only Module Boundary, and Pages validation runs are queued/pending at checkpoint time; deployment job must remain skipped for PR validation and no production deploy is claimed.
- Production blockers: manager/staff access is constrained by owner_user_id-based permissive RLS policies; table uniqueness is owner-scoped, not branch-scoped; server-side table transition/order-link lifecycle is absent; catalog writes cannot be enabled until RPC execution model is corrected; no authenticated adversarial E2E/test identities were used; no database writes, migrations, Edge Function deployments, payments, refunds, or settlement operations were performed.
- Next action: verify CI results for the latest PR head and repair any failing assertions. Then continue only source-safe work until an approved backend execution design and RLS/index migrations can be applied and verified. Keep PR #85 unmerged and the production release gate OPEN until runtime E2E and deployment evidence exists.
- CI resolution update: commit b9b978c21ab9cd1a68dd74a27fd7f4a164ca5d28 passed Module Professionalization Validation run 37929975879 and Backend-only Module Boundary run 37929975820. Pages validation run 37929975834 also passed its validate job; deploy job was SKIPPED because this is a pull request. The earlier validator failure was caused by the old legacy-menu notice assertion; it was updated to assert the canonical catalog read-only notice. The later commit 615559cd3efca0d944c5cae056a12416d0a14c6c only appends this continuity checkpoint; no source code changed after the passing b9b code head. No production deployment is claimed.

## CI result update — 2026-10-09 — Restaurant hardening PR #85

- Code head ce698dc9795b653b07255ad9e91f2a7a5c75d451 passed Module Professionalization Validation (run 37930090426), Backend-only Module Boundary (run 37930090685), and the Deploy MantiqatiX Web workflow's validation job (run 37930090804). The deployment job was SKIPPED because the changes are in an unmerged pull request.
- The earlier Module Professionalization failure at run 37929783453 was caused by a stale validator expectation for the legacy-menu notice. The assertion was updated to the canonical catalog read-only state, and the later run passed.
- This is CI/source-contract evidence only. No Edge Function TypeScript build/deploy, live browser E2E, authenticated cross-tenant E2E, RLS migration, branch-unique index, or production deployment has been performed.
- PR #85 remains OPEN / UNMERGED. Production gate remains OPEN / NOT PRODUCTION READY. The next step is to resolve the service_role-only catalog RPC execution design and obtain approval for the required RLS/unique-index changes, then run approved independent-session E2E before any release decision.
## Follow-up checkpoint — 2026-10-09 — Read-only safety boundary and scope guard

- After live policy review, direct browser mutations to restaurant_tables and restaurant_inventory were removed. Both views are now read-only with explicit explanation: table writes need server-side transition/order-link enforcement; inventory writes need a canonical stock ledger and atomic event lifecycle.
- The module now fails closed when the selected ACTIVE membership does not contain a valid tenant/business/branch scope. It no longer falls back to owner_user_id reads when the operational scope is missing.
- Multi-item cart remains implemented for catalog items, quantities and options; customer name/phone and takeaway/delivery are collected; order-create receives a stable idempotency key for an identical retry payload. Dining-table linkage remains explicitly unavailable and is not claimed.
- JavaScript syntax and all assertions in scripts/validate-restaurant-rbac-contract.mjs passed in-session against current branch files. CI for code commit a20eb0ae60b6d9aea97ff86762002f6eed037e73: Module Professionalization Validation run 37930336948 PASS; Backend-only Module Boundary run 37930336922 PASS; Pages validation run 37930336925 was still IN PROGRESS at checkpoint. Deployment remains skipped for PRs.
- This code head is not deployed. RLS read/write policy mismatch, branch-scoped table uniqueness, server-side table lifecycle, catalog RPC execute model, inventory ledger integration, independent-session E2E, and Edge Function deployment remain blockers. PR #85 remains unmerged.
## Read-only production data-integrity check — 2026-10-09

- Read-only count on Production Supabase returned 0 rows in restaurant_tables, 0 in restaurant_menu_items, and 0 in restaurant_inventory at the time of inspection.
- A grouped duplicate check returned no existing duplicate (tenant_id,business_id,branch_id,table_number) groups. The scope-null check returned zero missing-scope rows because the three tables are empty.
- This reduces immediate migration/data-cleanup risk but does not remove the concurrency defect: the current unique index is owner-scoped, not branch-scoped. No schema/index migration was created or applied in this step because schema changes remain authorization-gated.
- Latest source head after deterministic membership query changes is f9ec95eb1712dc7f3e3c73defea40c11ac0706e1. The source-level syntax and contract assertions pass in-session; Module Professionalization Validation and Backend-only Module Boundary passed for that head; Pages validation was still running at last check.
## CI final update for source head f9ec95eb1712dc7f3e3c73defea40c11ac0706e1

- Module Professionalization Validation run 37930594151: SUCCESS.
- Backend-only Module Boundary run 37930594157: SUCCESS.
- Deploy MantiqatiX Web run 37930594159: workflow SUCCESS; validation completed and deployment is skipped for the unmerged PR. This is not a production deployment.
- Current branch includes a later documentation-only checkpoint commit 005b34f64a73cfabb76e745e06aa849a5361a0ba; no source code changed after f9ec95eb1712dc7f3e3c73defea40c11ac0706e1.
- Source/CI gates are green. Runtime security, RLS/index migrations, catalog RPC execution design, Edge Function deployment, table/inventory lifecycle integration, and real authenticated E2E remain open. PR #85 must remain unmerged until those blockers are resolved or explicitly accepted by the owner.
## Current E2E readiness re-check — 2026-10-09

- Read-only production counts now show 26 ACTIVE businesses, 25 ACTIVE provider profiles, 11 ACTIVE catalog items, 11 ACTIVE catalog prices, and 2 ACTIVE branches. These are current counts, not proof of a complete booking flow.
- The isolated tenant MNTY-TEST-B has one ACTIVE business, one branch, one active catalog item and one active price, but zero ACTIVE provider profiles. It therefore cannot pass order-create's active-provider requirement without a separately authorized setup action.
- MNTY-PLATFORM has existing ACTIVE memberships across customer/provider/business roles and an active catalog chain, but no approved credentials/session bundle was used. No real order or user session was created/impersonated. Runtime customer→provider→order→notification E2E remains NOT VERIFIED.
- This check confirms RC199's historical statement that no catalog chain existed is no longer globally accurate, but it does not close the E2E gate. Use only approved test identities and an isolated test business/provider chain.
## Consolidated PR checkpoint — 2026-10-09

- The implementation was consolidated from the working branch into a clean branch based on main to avoid a 50-commit review history.
- Clean branch: fix/restaurant-module-hardening-20261009. Base: f1f653d2112124dda85cc717d47127e03e1af541. Initial clean-branch head: 890ffa0955ab24fdd152a6137058296a28db5bb8. The five changed files are web/restaurant-module.js, scripts/validate-restaurant-rbac-contract.mjs, supabase/functions/catalog-admin/index.ts, supabase/functions/order-create/index.ts, and docs/PROJECT_CONTINUITY.md.
- New review: PR #86 https://github.com/islamnagy2022-eng/MantiqatiX/pull/86 (OPEN, UNMERGED, five commits). Old PR #85 was CLOSED without merge to avoid duplicate competing PRs. PR #84 remains untouched and unmerged.
- The passing CI evidence previously obtained applies to the same source content before consolidation; PR #86 requires its own CI validation before review/merge. Production release gate remains OPEN / NOT PRODUCTION READY.
## Follow-up checkpoint — 2026-10-09 — Catalog and order RPC execution boundary

- Found a second live execution mismatch: create_order_backend is service_role-only and checks auth.uid() = p_customer_id, while order-create uses a service-role client without the user JWT for the RPC. The production order-create function is still version 6; this fix is source-only.
- Updated catalog-admin source to verify the bearer user with admin.auth.getUser, require active tenant/business/branch membership and action-specific CATALOG permissions, validate IDs/prices/tax/settings, restrict browser CORS to the production origin, and call service-role-only RPCs only after authorization.
- Added migration supabase/migrations/20261009130000_catalog_edge_service_role_boundary.sql. It updates catalog RPCs and create_order_backend to permit the trusted service-role execution path while keeping EXECUTE revoked from public/anon/authenticated and keeping search_path pinned to public,pg_temp. The Edge Function is responsible for the verified actor and action/scope authorization; SQL retains tenant/business/catalog/branch/provider/membership checks.
- The migration hardens order creation: verifies actor membership, scopes idempotency key reuse to the same customer/business/branch, rejects conflicting payload reuse for new keyed orders, uses ON CONFLICT against the existing tenant/idempotency unique index for concurrent retries, rejects catalog items marked unavailable, validates customer contact/address invariants, and avoids charging the delivery fee for TAKEAWAY orders.
- Updated order-create source to require either an active CUSTOMER membership or a business role with ORDERS:create (OWNER/SALES or a full-control platform SUPER_ADMIN), constrain branch-assigned users to their branch, validate customer phone/name, and require a delivery address when metadata.order_type is DELIVERY.
- Source-level restaurant/catalog/order contract checks pass. Security-definer release contract passes in-session. GitHub Actions for source head fe39d65a6d8ad579f1aa6d5e2267960aac8284ec: Module Professionalization Validation run 37932047784 SUCCESS; Backend-only Module Boundary run 37932047748 SUCCESS; Pages validation run 37932047898 SUCCESS with deploy job SKIPPED.
- Production state unchanged: catalog-admin remains deployed version 3 with wildcard CORS; order-create remains version 6. The new migration is NOT applied, and neither Edge Function has been deployed. This is intentional because the migration and function source must be validated and deployed as a coordinated release, followed by authenticated runtime tests.
- Remaining gates: execute migration only through approved release procedure; deploy catalog-admin and order-create after migration; test valid/invalid roles, tenant/branch boundaries, idempotency under concurrency, catalog unavailable items, delivery vs takeaway pricing, provider requirement, and real customer/provider flow using approved isolated test identities; verify no regression in other order clients. PR #86 remains OPEN/UNMERGED.
## Final checkpoint — 2026-10-09 — Scoped catalog/order repair

- Additional schema inspection confirmed branches.id is VARCHAR and production branch IDs include opaque identifiers such as MNTY-BERKET-MAIN. catalog-admin validation was corrected to validate business UUIDs but treat branch IDs as bounded opaque identifiers rather than UUIDs.
- The catalog migration now prevents moving an existing catalog item across branch scopes and prevents writing a branch-specific price for an item assigned to a different branch. Price-version allocation locks the catalog item row before incrementing the version.
- Order RPC idempotency now hashes the logical request (item IDs, quantities, selected options, order type, customer details, address, notes), rejects conflicting reuse for newer orders, and uses the existing partial unique index with ON CONFLICT DO NOTHING to handle concurrent retries. Cross-customer/business/branch reuse is rejected.
- Current source head at this checkpoint: 8ef28b7e70c06bb3b1490d3fd01dafa40c343949. In-session restaurant syntax, restaurant/catalog/order contract, and security-definer release contract checks all PASS. CI: Module Professionalization Validation run 37932380166 SUCCESS; Backend-only Module Boundary run 37932380135 SUCCESS; Pages validation run 37932380156 SUCCESS with deploy job SKIPPED.
- Branch is 30 commits ahead of main and 0 commits behind. PR #86 remains open and unmerged.
- Production verification: migration 20261009130000 is not applied. catalog-admin remains version 3 and order-create remains version 6. No production DB writes, migration execution, or Edge Function deployments were performed.
- The only safe next validation step is an isolated Supabase development branch and authenticated integration tests before coordinated migration/function rollout. No Supabase development branch currently exists. Branch creation requires organization selection and explicit cost confirmation; do not create billable resources without that confirmation.

## Continuation checkpoint — 2026-10-09 — CI repair and RBAC alignment

- Diagnosed the latest CI failure: the added RC450 security-definer validator contained an invalid JavaScript string around the SQL function marker. Fixed the marker to check the stable `set search_path=public,pg_temp` fragment. The validator now passes a syntax check.
- Tightened `order-create` source authorization: only active CUSTOMER membership or scoped OWNER/BUSINESS_OWNER/ADMIN/MANAGER roles can use the business-side order creation path; branch-bound memberships must match the requested branch. Removed the unsupported SALES allowance so the Edge Function aligns with the backend RPC's accepted role model.
- Expanded the restaurant contract validator to cover branch-scope immutability, branch-specific price scope, safe SECURITY DEFINER search_path, public/authenticated execute revocation, idempotency payload conflicts, and concurrent retry protection.
- In-session verification at commit `a77f2e9fc59093e3c39fa7eac6c40f92ac6aa212`: restaurant/catalog/order contract PASS; security-definer validator syntax PASS; restaurant JavaScript syntax PASS; catalog backend-RPC structural checks PASS; order RBAC/service-RPC structural checks PASS.
- GitHub Actions for `a77f2e9fc59093e3c39fa7eac6c40f92ac6aa212` were queued at the time of this checkpoint; do not mark CI green until the run concludes. A previous commit's CI exposed the validator syntax defect; the subsequent correction is source-only.
- Production remains unchanged: no migration applied, no Edge Function deployed, no order/payment/data mutation executed. `catalog-admin` and `order-create` deployed versions remain unverified in this checkpoint and must be re-read before any release.
- PR #86 remains OPEN/UNMERGED. The production gate remains BLOCKED pending CI confirmation, isolated authenticated integration tests, coordinated migration + Edge Function rollout, and runtime verification of customer/provider and tenant/branch boundaries.


## Verification checkpoint — 2026-10-09 — Order-type default and CI recovery

- Follow-up review found a fail-open edge case: an omitted `metadata.order_type` could be treated as delivery for pricing while skipping the delivery-address check. Fixed both `order-create` and the proposed RPC migration to default an unspecified order type to `DELIVERY` and require a non-empty delivery address. The restaurant UI explicitly sends `TAKEAWAY` or `DELIVERY`.
- Added a regression assertion for this default behavior. In-session tests at code commit `9750dc606abd3ed59ab2a7f6fb8d4a72c46ff4e7`: 6 checks PASS (restaurant/catalog/order contract, security-validator syntax, restaurant syntax, catalog service-role boundary, order role/branch/address guards, migration grants/search_path/idempotency invariants).
- GitHub Actions for code commit `9750dc606abd3ed59ab2a7f6fb8d4a72c46ff4e7`: Module Professionalization Validation run 37933712857 SUCCESS; Backend-only Module Boundary run 37933713040 SUCCESS; Pages workflow run 37933712978 SUCCESS, with the `deploy` job SKIPPED because PR #86 remains unmerged.
- Live Supabase was re-read: `catalog-admin` is still deployed version 3 with wildcard CORS and the old JWT-forwarding RPC path; `order-create` is still deployed version 6 with the previous membership/catalog validation. Neither updated source nor migration has reached production.
- Current production gate remains BLOCKED / NOT PRODUCTION READY. Next safe step is isolated integration testing of the migration + both Edge Functions, then a coordinated authorized release; do not apply the migration or deploy the Edge Functions without release authorization and rollback readiness.



## Verification checkpoint — 2026-10-09 — Order authorization and idempotency defense-in-depth

- Hardened `create_order_backend` in the proposed migration with a database-side membership backstop: an active CUSTOMER membership, or a business-side OWNER/BUSINESS_OWNER/ADMIN/MANAGER membership scoped to the target business and branch, or a platform SUPER_ADMIN membership with explicit full-control permission is required.
- Hardened idempotent retries: existing orders whose metadata lacks a verifiable `request_hash` now fail closed with `IDEMPOTENCY_LEGACY_PAYLOAD_UNVERIFIABLE`; existing keys are no longer accepted merely because customer/business/branch match.
- Added regression assertions to `scripts/validate-restaurant-rbac-contract.mjs` for the membership backstop and legacy idempotency behavior. Static source-pattern checks for the new authorization and idempotency invariants pass.
- Latest source commit: `903d1e1d4ffc34693e2df51a0a4f6002eb8a9746`. GitHub Actions runs 37934254010 (Module Professionalization Validation) and 37934254016 (Backend-only Module Boundary) completed SUCCESS; Pages workflow 37934254082 completed SUCCESS with validation SUCCESS and deployment SKIPPED because PR #86 remains unmerged.
- Supabase security advisors warn about anonymous access policies on multiple tables, including restaurant tables/menu/orders, and report that leaked-password protection is disabled. A read-only `pg_policies` check found no policies explicitly granted to `anon` or `public` on the reviewed restaurant/catalog/order tables; the listed restaurant policies target `authenticated` and include restrictive non-anonymous guards. Treat the advisor findings as requiring policy-by-policy validation, not proof of direct anonymous access; do not globally remove policies without understanding legitimate access flows.
- Production remains unchanged: no migration applied, no Edge Function deployed, no production writes, and no PR merge. The proposed migration and Edge Function changes still require SQL/runtime validation and isolated authenticated integration tests before any release.


## RC560 continuation update — 2026-10-09
- Current work branch: `fix/restaurant-module-hardening-20261009`; PR #86 remains open and unmerged.
- Restaurant order RPC migration and regression assertions were hardened as recorded in `docs/MASTER_PRODUCTION_TODO.md` RC560.
- Source-level checks for strict ACTIVE membership, order item cap, selected-option array shape, tenant-scoped settings, and mismatch failure all passed.
- CI for the newest source commits is not verified; a GitHub workflow lookup returned no associated runs/statuses. Do not label this a green CI release.
- A proposed Edge Function fix was blocked by the repository safety layer; do not bypass that control. The source fix remains open for the supported review path.
- No production migration, Edge Function deployment, data write, or PR merge was performed.
- Restaurant module remains **PARTIAL / NOT PRODUCTION READY** until SQL/runtime validation, successful CI, authenticated customer/provider E2E, cross-tenant/branch denial, and notification/payment lifecycle tests are evidenced.


## RC561 continuation update — 2026-10-09
- Added database-side EGP enforcement, a 200-character idempotency-key limit, persisted tax/price validation, and a non-negative selected-option unit-price invariant to the restaurant order RPC migration.
- Added matching regression assertions to the restaurant RBAC/order contract validator.
- Latest source-head CI: Module Professionalization Validation `37935319134` **SUCCESS**; Backend-only Module Boundary `37935319156` **SUCCESS**; Pages run `37935319261` validation **SUCCESS**, deploy **SKIPPED** because PR #86 remains unmerged.
- These are source/CI results only; PostgreSQL migration execution and authenticated runtime E2E remain unverified.
- The Edge Function normalization change remains open because the repository safety layer blocked that write; do not bypass the control.
- No production database mutation, migration, Edge Function deployment, or PR merge occurred.
