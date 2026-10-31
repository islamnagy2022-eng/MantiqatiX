# MNTY / MantiqatiX — Master Production TODO & Release Execution Register

الهدف: الوصول إلى نسخة إنتاج فعلية مؤمنة وقابلة للإطلاق.

القاعدة: DONE ≠ VERIFIED.
المسار الإلزامي: Analysis → Impact Analysis → Implementation → Integration → Testing → Security Review → Verification → Release → Monitoring → New Baseline.

## حالات التنفيذ
- DONE: التنفيذ/المراجعة البرمجية مكتملة بالأدلة المتاحة.
- PARTIAL: جزء مكتمل وباقي أجزاء مفتوحة.
- WAIT: يعتمد على بيئة أو اعتماد خارجي أو جهاز أو بيانات حقيقية.
- TODO: لم يُنفذ.
- NOT VERIFIED: موجود أو مراجع، لكن لم يثبت باختبار E2E/إنتاج.



# CURRENT VERIFIED BASELINE — 2026-10-31 02:30 UTC (PR #576 / main)

- Current main commit at this checkpoint: `0236118cd93d6e8330296da4442c2b07c93df211`.
- Latest main push workflows all completed successfully: Production Health Monitor [41160201368](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41160201368), Backend-only Module Boundary [41160201356](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41160201356), MantiGO Open Ride Privacy Boundary [41160201391](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41160201391), Module Professionalization Validation [41160201354](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41160201354), and Deploy MantiqatiX Web [41160201369](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41160201369).
- Health Monitor job `124415873930` logged `SUPABASE_DATABASE_READ_ONLY_PROBE=PASS`; its GET to `marketing_provider_profiles?select=business_id&limit=1` returned HTTP 200. It also confirmed `PRIMARY_CATALOG_ROOT_AND_ASSETS=PASS` and Edge health status `ok` at the run timestamp.
- Pages run #41160201369 completed all three jobs successfully. Deploy job `124416013202` confirmed `MANTIQATIX_CATALOG_PRIMARY_ROOT_DEPLOY=PASS` at `https://islamnagy2022-eng.github.io/MantiqatiX/` and `PRIMARY_CATALOG_BROWSER_E2E=PASS` for the scoped owner/employee/branch-owner/QR/GPS/external-logo-cover/taxonomy journeys. axe reported no critical or serious WCAG 2.1 violations in the tested dashboard and QR views only; this is not a full accessibility certification.
- The same Pages validation log explicitly reports `CATALOG_PILOT_GATE=PASS` and `FULL_PLATFORM_GATE=BLOCKED`; only the scoped catalog frontend and paid-subscription guard are authorized. No payment-intent, webhook, order, finance, SMM, or MantiGO backend deployment was authorized by that pilot gate.
- The detailed live production evidence snapshot remains the one documented in `docs/audits/PRODUCTION_GATE_EVIDENCE_20261031.md`: 308 migration ledger rows through `20261029083845`, 0/41 exact required release migration IDs, 32/60 physical-object checks non-PASS, six live Edge entrypoints with source drift, and RC449A/RC450 journal schema/ACL blockers. The latest Pages run re-ran the verifier and still emitted `FULL_PLATFORM_GATE=BLOCKED`; its structural contract checks passing do not override external live-evidence blockers.
- Backup/restore rehearsal, measured RPO/RTO, signed Android/real-device regression, real Google-account multi-tenant E2E, Paymob sandbox E2E, failure-notification delivery, and owner-side Auth hardening evidence remain NOT VERIFIED / WAIT.
- No Production migration, schema/data write, grant, RLS/Auth change, Edge Function replacement, provider call, payment, refund, settlement, or journal mutation was performed by this checkpoint. No paid resources were created; cost target remains 0 EGP.
- **Overall Production Gate: BLOCKED / NOT CERTIFIED. Catalog pilot: DEPLOYED / BROWSER VERIFIED for the tested scope.**

# P0 — حواجز الإطلاق (detailed live-evidence snapshot — 2026-10-31; see current baseline above)

1. Auth and multi-tenant E2E — NOT VERIFIED
   - PR #543 moved the full `LIST_SUBSCRIBERS` directory read out of the blocking Google session bootstrap; PR #546 preserves last-good subscriber data on failed refresh and discards stale responses after logout/account switching.
   - PR #547 records passing TypeScript/build, Google OAuth/session/role and membership contracts, dashboard browser E2E, employee RBAC PostgreSQL, Pages deployment, deployed-origin checks and Production Health Monitor.
   - Still open: real Google-account sign-in timing/cross-account verification; controlled failed `LIST_SUBSCRIBERS` followed by authorized manual retry; full real customer/provider/owner/admin and multi-tenant/business/branch isolation E2E.
   - Leaked Password Protection remains disabled and requires an authorized Supabase Auth action plus Advisor recheck.

2. Customer/provider/order/notification E2E — NOT VERIFIED
   - CI source/contract and isolated database tests do not prove a real customer→correct provider→status→notification journey across separate tenants.

3. Paymob production E2E — NOT VERIFIED
   - RC426–RC431 isolated PostgreSQL tests pass; no signed Paymob sandbox E2E or authorized real payment has been performed.
   - Live RC426 still exposes the legacy four-argument finalizer; the required five-argument order-bound contract is absent.

4. Finance/settlement/journal E2E — NOT VERIFIED
   - RC435–RC439 and RC450 targeted PostgreSQL tests pass; AES-GCM rotation tests pass on source. These fixtures are not a full current-Production schema restore.
   - Fresh read-only recheck (2026-10-31 01:21 UTC) confirms live RC435/RC439 claim/recovery columns and RPCs are absent; RC449A journal header/line columns are absent; both inspected journal SECURITY DEFINER RPCs use `search_path=public`, lack `service_role EXECUTE`, and the backend actor check requires `auth.uid()`, incompatible with the current service-role Edge call.
   - No real payment, refund, settlement or ledger posting was created during this audit. Do not grant the legacy RPC or deploy the Edge Function as a shortcut.

5. Supabase Security Advisor — OPEN / CLASSIFIED
   - Fresh live snapshot at 2026-10-31 02:23 UTC: 8 RLS-enabled/no-policy tables; 3 anon-executable SECURITY DEFINER functions; 67 authenticated-executable SECURITY DEFINER functions; 90 anonymous-sign-in-related Advisor findings; leaked-password protection disabled. These 90 findings are not 90 direct anon table grants; classify against anonymous sign-in mode and policy roles.
   - Fresh read-only recheck at 2026-10-31 02:51 UTC confirmed the same Advisor counts (performance: 129 unindexed FKs, 375 init-plan findings, 73 unused indexes, 28 permissive-policy groups). Direct catalog/ACL checks found no anon/authenticated SELECT/INSERT/UPDATE/DELETE on the eight no-policy tables; seven have FORCE RLS and digital_page_payment_events does not. Two tables are service_role-DML only; six have no direct service_role DML grants. The trigger-only assign_default_owner_to_unowned_business() still has search_path=public, auth; the other two anon-executable definer functions have empty search_path. No production privileges/policies/Auth settings were changed. Evidence: docs/audits/LIVE_SUPABASE_SECURITY_RECHECK_20261031_0251.md. These 90 findings are not 90 direct anon table grants; classify against anonymous sign-in mode and policy roles.
   - The 8 no-policy tables remain fail-closed by observed direct privileges; preserve deny-by-default/RPC-only behavior and do not add broad policies.
   - The 3 anon SECDEF findings include two trigger-returning functions and the intended public targeted-ad RPC; review each caller/trigger contract individually.
   - Latest Performance Advisor snapshot: 129 unindexed FKs, 375 auth/RLS init-plan findings, 73 unused indexes and 28 multiple-permissive-policy groups. Require query-plan/workload and policy-caller evidence; no bulk grant, policy or index rewrites.
   - RC440's targeted PostgreSQL integration evidence does not mean RC440 or any unapproved security migration has been applied live.

6. Production migration and physical-object reconciliation — BLOCKED
   - Live migration ledger: 308 records through 20261029083845.
   - 0/41 exact required release migration identifiers are recorded. This does not imply all effects are absent; the 60-object manifest distinguishes present, missing and blocked physical contracts.
   - Latest full verifier on main commit `adf0680a3c151330656b9712a03849c796aa4c09` (Pages run [41159666222](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666222)) reported 32/60 physical-object checks as non-PASS, including absent RC425–RC430 payment/settlement RPCs and objects, RC432 SMM wallet index, RC434/RC438 purchasing RPCs, RC117 default-image objects, and RC113 membership index. RC431 and RC438 also contain blocked-present objects requiring semantic verification, not blind replay. Two migration aliases remain pending controlled ledger repair; RC424 exact statement alias was reconciled without rewriting history.
   - Two known exact-source aliases remain pending controlled ledger repair; do not execute duplicate SQL or rewrite historical migration history.
   - Complete chronological, schema-faithful replay, effect reconciliation, backup/restore and rollback approval are mandatory before any production migration.

7. Critical Edge Function source parity — BLOCKED
   - Six live entrypoints remain different from main: order-create v8, payment-intent v8, paymob-webhook v10, digital-page-payment-intent v5, subscription-payment-intent v4, financial-journal v3.
   - Latest verifier classifies the six-function parity as `DRIFT_FOUND`; finance-journal prerequisites specifically lack RC449A/RC450 columns (`journal_entries.entry_number`, `total_debit`, `total_credit`, `posted_at`, `journal_entry_lines.line_number`) and service-role EXECUTE on the expected backend RPC. The live financial-journal Edge v3 still uses the legacy RPC and wildcard CORS. No isolated provider E2E is complete.
   - Require per-function semantic diff, schema/ACL dependencies, provider sandbox E2E and rollback plan. No blind batch deploy.

8. Backup/restore/DR — NOT VERIFIED
   - No successful restore rehearsal, measured RPO/RTO or tested recovery evidence.
   - PR #571 corrected the official `supabase db dump` CLI reference and recorded the official restore-scope review. This is documentation only: no Production backup was created, no restore was rehearsed, and RPO/RTO remain unmeasured.

9. Release build/signing and real-device regression — WAIT
   - Signed Android artifact, protected signing material, install/update, auth/session, role journeys, push, network-loss/retry and device regression remain open.

10. Public web deployment smoke — VERIFIED FOR LAST TESTED APP SNAPSHOT (PR #565)
    - After PR #565, main commit `3247f53c561e8161075024e0436668460f55d779` passed Pages deploy and deployed-root checks [41155204293](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204293); Production Health Monitor passed [41155204266](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204266).
    - The same main commit passed Backend-only Module Boundary [41155204267](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204267), Module Professionalization [41155204271](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204271), MantiGO Privacy [41155204224](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204224), and SMM Deferred Storefront Contract [41155204313](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204313).
    - This verifies the tested web deployment snapshot only. Real authenticated Google-account journeys, full customer/admin E2E, manual device/accessibility and offline/PWA recovery remain NOT VERIFIED.
    - Current main commit `d61baeccd5444248e8d778117ab3ab4a09f2b45f` Production Health Monitor run [41159588678](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159588678) completed successfully. Its job log confirms the read-only PostgREST GET to `marketing_provider_profiles` returned HTTP 200 (`SUPABASE_DATABASE_READ_ONLY_PROBE=PASS`). This verifies that one scheduled/push-triggered probe execution only; it does not guarantee continuous availability or prove failure-notification delivery. The Pages deployment for this commit is still pending at this checkpoint.
    - After PR #575, latest main is `b41c3c312e713f1975bafef6a617ad7159e1b4f8`. Current-main Production Health Monitor run [41159666007](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666007) completed successfully; its job log confirms `SUPABASE_DATABASE_READ_ONLY_PROBE=PASS`. The latest documentation-only main commit `b41c3c312e713f1975bafef6a617ad7159e1b4f8` also passed Health Monitor [41160088237](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41160088237), with the same HTTP-200 read-only database probe. Privacy Boundary [41159666176](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666176), Backend-only Module Boundary [41159666031](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666031), and Module Professionalization [41159666122](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666122) all completed successfully. Pages deployment run [41159666222](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41159666222) completed successfully. The deployed-origin Playwright suite passed: guest route denial; owner mobile/desktop dashboards; employee view-only and read-only roster; branch-owner route denial/RPC scope; unsupported manager grant denial; merchant QR tab/modal accessibility; permanent store link and QR encoding; GPS consent/manual-search fallback; explicit external logo/cover links; taxonomy folder/category/back-navigation/mobile flows. axe checks reported no critical or serious WCAG 2.1 violations in the tested dashboard/QR views. The prior run on `d61ba...` was cancelled by the subsequent main push; its deploy job had completed all checks, but use the latest-main run as the release evidence.

**Overall Production Gate: BLOCKED / NOT CERTIFIED.** No production migrations, grants, Auth/RLS changes, Edge Function deployments, provider calls or financial mutations were performed in this checkpoint.

## Required production-gate contract markers

The following exact status markers are retained for the automated RC360 release-gate validator; they reflect the current unresolved state, not an assertion that these gates have passed.

- E2E مصادقة وصلاحيات متعددة المستخدمين/المؤسسات — NOT VERIFIED
- Paymob production E2E — WAIT
- Leaked Password Protection — WAIT
- Production release build + signing — WAIT
- Real-device release test — WAIT
- Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**

# P1 — أولوية عالية

11. G11 Analytics/Reports — PARTIAL
    - لا يوجد جدول public واضح باسم analytics/report في الفحص الحالي.
    - المصادر الموجودة تشمل audit_logs وconsent_audit_log وpayment_events وpayment_provider_events وbusiness_referral_events وreferral_events وsync_logs.
    - التقارير يجب أن تعتمد على authoritative sources ولا تنشئ business truth موازية.
    - TODO tenant/business/role scoping وdrill-down.

12. Auditability — PARTIAL
    - audit_logs موجود.
    - G11 ضيّق القراءة إلى OWNER/BUSINESS_OWNER/ADMIN/MANAGER.
    - NOT VERIFIED: اختبار CUSTOMER/SERVICE_PROVIDER/STAFF مقابل admin.
    - TODO إثبات append-only فعلياً من privileges + E2E.
    - TODO مراجعة old_values/new_values وPII/IP/user-agent retention.
    - TODO مراجعة integrity/hash requirement؛ وثائق قديمة تشير إلى integrity hash بينما الجدول الحالي لا يحتوي هذا العمود.
    - TODO جعل السجل الحرج server-side authoritative لا client-authored.

13. Provider profile/services/location E2E — NOT VERIFIED
    - profile/services/service areas/availability.
    - location permission.
    - cross-provider isolation.
    - لا continuous tracking بلا حاجة.

14. CRM E2E — NOT VERIFIED
    - customer/provider separation.
    - leads lifecycle.
    - support ticket/message isolation.
    - notifications isolation.
    - support staff cross-tenant isolation.

15. Notifications E2E — NOT VERIFIED
    - order status → notification.
    - Web Push subscription.
    - stale subscription cleanup.
    - click-through.
    - user isolation.

16. Canonical catalog/pricing — IN PROGRESS
    - نقل القطاعات الفعلية إلى canonical catalog.
    - server-side discounts/coupons قبل تفعيلها.
    - لا client-side price authority.

17. Webhook observability — PARTIAL
    - correlation/fail-closed موجودان في المسارات الحرجة.
    - TODO retry/dead-letter/alerting مع traffic حقيقي.

18. Concurrency/load regression — WAIT/NOT VERIFIED
    - order/payment/settlement concurrent calls.
    - idempotency replay.
    - locking/load profile.

19. Offline/sync semantics — PARTIAL
    - authoritative entities لا تكتب مباشرة من generic queue.
    - TODO endpoint + idempotency + conflict policy لكل عملية قبل generic mutation queue.
    - TODO real-device offline/online regression.

20. Realtime replacement — WAIT
    - لا استبدال polling قبل subscription path موثق ومختبر.

21. Database/index performance — PARTIAL
    - critical FK indexes موجودة.
    - TODO EXPLAIN/query-plan evidence قبل إضافة/حذف indexes.

22. Unified error/telemetry — IN PROGRESS
    - correlation IDs موجودة في المسارات الحرجة.
    - TODO توحيد user-safe errors وtechnical taxonomy.

# P2 — Architecture / Maintainability

23. Repository boundary completion — IN PROGRESS
    - تصنيف direct writes المتبقية.
    - نقل العمليات الحساسة إلى Edge/RPC.

24. Identity/membership state model — IN PROGRESS
    - فصل auth identity عن tenant/membership/role/customer/provider.
    - اختبار تغيّر membership وعدم الاعتماد على cache قديم.

25. Patch-script cleanup — IN PROGRESS
    - migration history قابلة لإعادة الإنتاج.
    - أرشفة one-time scripts بعد baseline.

26. DI/container consolidation — WAIT
    - بعد استقرار mutation boundaries وdevice verification.

27. MainActivity decomposition — WAIT
    - بعد core release flows.

28. BusinessErpScreen decomposition — WAIT
    - بعد owner workflow stabilization.

29. Medical/Restaurant/Pharmacy workspace decomposition — WAIT
    - بعد sector catalog/workflow stabilization.

# P3 — Product / Optimization

30. Sponsored ads backend — WAIT UNTIL CORE LAUNCH
    - campaigns/creative/impressions/billing/budget/reporting.

31. Referral abuse/rate limits/attribution — WAIT
    - protected Edge Function.
    - rate limits/anti-abuse.
    - attribution verification.

32. Performance tuning — WAIT FOR TELEMETRY
    - cache/index/realtime فقط بناءً على measured workload.

33. Advanced analytics/BI — TODO
    - بعد تثبيت authoritative events/reports.
    - لا duplicate business truth.

# ما أُغلق في G1–G10

- G1: MNTY website identity/public landing branding — IMPLEMENTED.
- G2: auth/RBAC baseline — IMPLEMENTED؛ E2E NOT VERIFIED.
- G3: customer module/order creation boundary — IMPLEMENTED؛ E2E NOT VERIFIED.
- G4: provider order scope/status boundary — IMPLEMENTED + DB VERIFIED؛ E2E NOT VERIFIED.
- G5: provider profile/services ownership RLS — IMPLEMENTED + DB VERIFIED؛ E2E NOT VERIFIED.
- G6: API provider order read scope — IMPLEMENTED + deployed؛ E2E NOT VERIFIED.
- G7: status update + push dispatcher boundary — SOURCE VERIFIED؛ delivery E2E NOT VERIFIED.
- G8: CRM/notification/support RLS hardening — IMPLEMENTED + DB VERIFIED؛ E2E NOT VERIFIED.
- G9: commission/settlement security hardening — IMPLEMENTED + DB VERIFIED؛ real-money E2E NOT VERIFIED.
- G10: unified web runtime + pinned Supabase JS — IMPLEMENTED؛ browser smoke/CI for G10 commit NOT VERIFIED.
- G11: analytics/audit review — IN PROGRESS؛ audit-log read scope hardened؛ analytics/report E2E remains TODO.

# Production Release Gate

- [ ] Auth
- [ ] RBAC/Authz
- [ ] Tenant isolation
- [ ] Customer/provider isolation
- [ ] Order lifecycle
- [ ] Notifications
- [ ] Support/CRM
- [ ] Catalog/pricing
- [ ] Payment
- [ ] Webhook replay/idempotency
- [ ] Commission
- [ ] Settlement
- [ ] GL/accounting
- [ ] Auditability
- [ ] Backup/restore rehearsal
- [ ] Monitoring/alerting
- [ ] Web browser smoke
- [ ] Android release build
- [ ] Release signing
- [ ] Real-device regression
- [ ] Security Advisor review
- [ ] Rollback rehearsal
- [ ] Production configuration/secrets
- [ ] Post-release smoke + monitoring

## Additive professional dashboard — 2026-10-28

34. Professional Dashboard module — IMPLEMENTED ON FEATURE BRANCH / BUILD + CHROMIUM + POSTGRES RBAC/TENANT/BRANCH + FORWARD REPLAY PASS / PRODUCTION RELEASE BLOCKED BY LIVE SCHEMA DEPENDENCIES
    - Branch: `feat/professional-dashboard-additive-20261028`; Draft PR #483. Exact current tested code head: `da71668e9cfce331dd1ff934882bf0914150fcda`.
    - PR is based directly on current `main` baseline `27854fc67ac32f1c8192ee6bc7c01feec6e2cd1b`; `main` was not modified. Current PR is unmerged and remains Draft.
    - Added isolated React component at `apps/catalog-frontend/src/modules/dashboard/ProfessionalDashboard.tsx`.
    - Registered `professional_dashboard` in the existing view model, URL restoration, App.tsx rendering and role-gated Navbar navigation; existing public catalog, storefront, merchant and admin views remain present.
    - Added responsive RTL overview cards, operational/publishing status, category distribution, recorded business-creation trends, stored-state alerts, activity search/filter by name/status/category/governorate, and links into existing admin/merchant tabs.
    - Added optional `merchantTab` deep links while preserving the existing merchant default `products` tab; route parameters are cleared outside their dashboard context.
    - Membership resolution now uses the same selector for dashboard session roles and catalog bootstrap scope. A tenant-wide OWNER outranks a weaker employee membership from a branch, stays scoped to its own tenant, and does not inherit the weaker row's branch. A `MANAGER` role alone does not grant broad access.
    - Limited employee access uses permission-aware sections and a read-only employee view when only view access exists. Branch-scoped members use a branch-aware roster RPC; the old unscoped employee roster path is denied to branch-scoped viewers.
    - Added forward-only migration `supabase/migrations/20261028225000_rc457_business_employee_permission_ceiling.sql` to cap delegated employee permissions, prevent employee-override escalation, and scope employee roster/write RPCs by tenant/business/branch. Historical migrations remain unchanged.
    - Added static/runtime permission validators, headless Chromium E2E, and isolated PostgreSQL behavioral integration checks.
    - **PASS — [Primary Catalog Frontend Validation run 40794290839](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290839), exact source head `da71668e9cfce331dd1ff934882bf0914150fcda`:** TypeScript/build, OAuth and public-catalog smoke checks, PostgreSQL employee RBAC integration, and Chromium E2E. Chromium logs confirm guest direct-route denial, owner route/refresh and membership-scope consistency, limited employee read-only sections, branch-owner unscoped-route denial, and unsupported-manager denial. PostgreSQL logs confirm permission ceilings, branch/tenant isolation, table grants/FORCE RLS and anonymous rejection.
    - **PASS — [Forward migration replay run 40794290701](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290701):** checkpoint `20261008222845` restored and all 65 later migrations applied in timestamp order in an isolated disposable Supabase instance, including RC457; RC117, RC455/456, and synthetic tenant-isolation checks passed. This is replayability evidence only, not proof of production application.
    - Supporting exact-head checks passed: [Migration history immutability 40794290678](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290678), [migration version uniqueness 40794290552](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290552), [migration collision guard 40794290983](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290983), [backend-only boundary 40794290752](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290752), [module professionalization 40794291165](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794291165), [MantiGO privacy 40794291170](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794291170), [RC425 payment atomicity 40794290617](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290617), [flexible commission 40794290801](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290801), [approval atomicity 40794290554](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290554), [legacy catalog 40794290613](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290613), and [SMM deferred storefront 40794290869](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40794290869).
    - **Production gate remains BLOCKED.** Read-only inspection of live Supabase project `moyhiluyhjsujhwlyeuu` shows ledger count 303, latest version `20261028112112` (`auto_assign_unowned_businesses_to_catalog_owner`), but the four RC113/RC114 tables and RC115/RC457 permission/employee functions are still absent. All 41 required full-platform release source versions remain absent from the live migration ledger; several selected RC425–RC438 effects also have physical-schema/security drift.
    - Production dependency gate allows branch/PR validation but prevents publishing on `main` while these live objects are missing or unverified. The Pages deploy job was skipped in the exact-head branch/PR runs. No production schema write, migration-ledger repair, merge or production deployment occurred.
    - **Still not verified:** hands-on visual review on real mobile/tablet devices, keyboard/accessibility review, live QR/permanent-link regression, and authenticated end-to-end review against the deployed production origin.
    - Do not merge or deploy this PR until the broader missing migration ledger/schema effects are reconciled through a reviewed rollout and fresh live-object verification; do not blindly replay the missing 41 migrations or fabricate ledger entries. The overall platform gate remains `BLOCKED / NOT CERTIFIED` for unrelated payment/finance, Edge Function/Auth, backup/restore, monitoring and other release gates.
# Execution rule

1. P0 الأمني أولاً.
2. بالتوازي، E2E لكل boundary مكتمل برمجياً.
3. WAIT الخارجي يبقى موثقاً ولا يُزوّر إلى DONE.
4. بعد كل إصلاح: migration/source → verification query → tests → baseline.
5. لا نبدأ P2/P3 بينما P0 security أو E2E الحرجة مفتوحة.
6. فشل E2E يعيد البند إلى TODO ويمنع Go-Live للجزء المتأثر.


## RC106 P0 Security clarification

- The 7 Security Advisor RLS-no-policy findings were inspected at the privilege layer.
- The current anon/authenticated table-grant query returned no direct grants for those named tables.
- Therefore they are NOT opened by adding broad policies just to silence the advisor.
- TODO: verify backend/service-role access paths for each table, then document intentional backend-only isolation or add least-privilege policies only where a real user-facing workflow requires them.
- `smm_provider_credentials` contains `api_key_ciphertext` and must remain fail-closed to ordinary client roles.


## RC107 P0 Security update — 2026-09-28

- pg_net was moved from public to extensions using migration rc107_move_pg_net_to_extensions.
- Verified live extension: pg_net 0.20.4 in schema extensions.
- Verified notification trigger: public.notifications.mnty_notifications_push_after_insert remains attached to public.mnty_push_notification_hook().
- Hook was recreated to call extensions.http_post(...) instead of net.http_post(...).
- Security Advisor no longer returned the extension_in_public finding in the post-change payload.
- No broad RLS policies were added to the 7 no-policy tables; live privilege inspection showed no direct anon/authenticated grants.
- Remaining P0 security items: leaked-password protection, contextual anonymous-policy review, SECURITY DEFINER payment RPC decision/documentation, backend-only access-path mapping, and full E2E verification.


## RC108 P0 Auth Security verification — 2026-09-28

- Live Auth DB check: 6 users currently have password hashes; anonymous-user count is 0.
- `password_encryption` is `scram-sha-256`.
- Supabase Auth does not expose a writable `auth.config` table in this project; leaked-password protection is an Auth dashboard/managed setting and was NOT falsely marked enabled.
- Required next action remains: enable leaked-password protection in Supabase Auth settings, then re-run Security Advisor and verify the setting.
- Current implementation evidence remains: web authentication validates session with `getSession()` then `getUser()`, rejects anonymous operational access, and membership/role access is RLS/server scoped.


## RC109 P0 Tenant isolation hardening — 2026-09-28

- Production policies hardened for `orders`, `support_tickets`, and `ticket_messages`.
- Order partner reads now require an ACTIVE membership in the order tenant; provider business-scoped policy remains intact.
- Support ticket and message reads/writes now require an ACTIVE membership in the ticket tenant, including requester/assigned-user paths.
- Live DB policy re-read verified the new tenant membership predicates.
- External two-user/two-tenant E2E is still NOT VERIFIED.
- Source migration synchronization completed via Git object path; RC109 migration committed as 9dd15b631a147f15ac27809e7458de00231e4fa3. CI is not currently verified for this commit.

- E2E test prerequisite check: production currently has 10 ACTIVE memberships across 1 tenant and 1 active user; there is no real two-user/two-tenant fixture to execute the required isolation E2E without creating test identities/data. Keep this gate OPEN rather than simulating verification.


## RC110 → RC120 execution ledger — 2026-09-28

### RC110 — RLS regression contract
- Added `supabase/tests/rc110_rls_policy_contract.sql`.
- Structural contract added; behavioral pgTAP execution is NOT VERIFIED because production does not have the `pgtap` extension.

### RC111 — Security Advisor / audit anonymous boundary
- Production `audit_logs_select_admin_scope` now explicitly rejects anonymous Auth users.
- Migration synchronized to source.
- Security Advisor remains OPEN because other intentional findings remain.

### RC112 — Leaked password protection
- Advisor confirms leaked-password protection is DISABLED.
- No safe SQL control surface exists in this project for Auth managed setting.
- Status: OPEN / Dashboard action required.

### RC113 — SECURITY DEFINER execution
- Production inventory: 79 public SECURITY DEFINER functions.
- `anon` execute privilege: 0.
- `authenticated` execute privilege: 1, specifically `create_payment_intent_backend`.
- This execute grant is intentional for the payment-intent Edge Function and remains under source/RPC validation.
- Status: VERIFIED boundary; Advisor warning remains intentional.

### RC114 — Backend-only sensitive tables
- `erp_purchase_orders`, `erp_purchase_receipts`, `erp_stock_transfers`, `smm_admins`, `smm_provider_credentials`, `smm_providers` remain RLS-enabled with no policies.
- Direct `anon/authenticated` table grants were not present in the verified grant query.
- Status: fail-closed for ordinary API roles; backend/service-role path mapping remains OPEN.

### RC115 — Payment idempotency
- Verified unique `payment_intents(tenant_id,idempotency_key)`.
- Verified unique `payment_provider_events(provider,external_event_id)`.
- Verified unique provider/order payment-intent constraint when provider_order_id is present.
- Status: database idempotency constraints VERIFIED; real duplicate webhook replay E2E NOT VERIFIED.

### RC116 — Finance read scope
- `financial_obligations` currently has tenant-member read policy.
- No source usage was found in GitHub search to prove a narrower consumer contract.
- Status: REVIEW REQUIRED before narrowing; do not change blindly.

### RC117 — Auditability
- Audit-log admin read boundary hardened.
- Append path remains backend-oriented.
- Data retention/redaction/integrity-hash requirements are not fully verified.
- Status: PARTIAL.

### RC118 — Backup / recovery
- No backup/restore rehearsal was performed against production.
- No destructive restore action will be executed without an explicit controlled environment.
- Status: OPEN.

### RC119 — Release/CI
- Current repository workflow inventory shows GitHub Pages workflow; the historical `ci_cd.yml` is not present on current `main`.
- RC110/111 source commits have no verified workflow run through the available workflow-run endpoint.
- Status: OPEN.

### RC120 — Final production gate
- Final gate remains OPEN.
- Required remaining P0/E2E items: multi-user/multi-tenant isolation fixture, customer→provider order/status/notification E2E, real payment E2E, leaked-password protection, Security Advisor closure/intentional sign-off, release build/signing, device/browser smoke, backup/restore rehearsal and rollback verification.


## RC121 — Source / migration reproducibility repair — 2026-09-28

- Restored the RC110 structural RLS regression contract at `supabase/tests/rc110_rls_policy_contract.sql` and corrected its comment to RC110.
- Restored the RC109 tenant-boundary migration source at `supabase/migrations/20260928060000_rc109_harden_order_support_tenant_boundaries.sql`.
- Restored the RC111 audit anonymous-boundary migration source at `supabase/migrations/20260928061000_rc111_harden_audit_admin_anonymous_boundary.sql`.
- These are source-of-truth restoration changes only; no new production schema change was executed in RC121.
- Live verification remains unchanged: the production boundaries are already present; the purpose of RC121 is to keep source and production history reproducible.
- Backend-only table mapping review confirms the six public no-policy tables are not directly readable by `anon` or `authenticated`; source archive shows ERP tables are intentionally fail-closed and used through privileged database functions. SMM tables require further live backend-path mapping before any policy is added.
- Security Advisor remains OPEN; leaked-password protection, critical E2E, release signing, browser/device smoke, backup/restore rehearsal and rollback remain release blockers.


## RC122-RC150 verification
- Structural DB security checks completed and recorded in docs/RC150_PRODUCTION_VERIFICATION_LEDGER.md.
- 113/113 public tables have RLS; 0 public tables lack a primary key.
- 6 public RLS-enabled tables remain intentionally without client policies; direct anon/authenticated grants were not found.
- Anonymous users: 0; password users: 6; SCRAM-SHA-256.
- anon SECURITY DEFINER execute: 0; authenticated SECURITY DEFINER execute: 1 (payment-intent backend RPC).
- Payment idempotency constraints verified; current payment_intents and payment_provider_events counts are both 0.
- Multi-tenant/customer-provider E2E and real payment E2E remain NOT VERIFIED.


## RC153–RC154 — Domain module build continuation — 2026-09-28

- RC153 implemented real web runtime modules for Fashion, Education, Jobs and Used Items using existing Supabase tables and existing RLS boundaries.
- RC154 implemented the Reverse Bidding / Professional Services runtime using the existing indrive_requests / indrive_bids contract and private bid-access functions.
- Restaurant module was already present as web/restaurant-module.js and was retained rather than duplicated.
- Matrimony was not opened as a generic profile UI because the current profile schema contains direct contact fields; a dedicated privacy-safe projection/contract is required before exposing that module broadly.
- Medical was not marked complete because the current inspected public schema does not expose a verified medical transaction model; no fake tables/data were introduced.
- Browser E2E and production CI remain NOT VERIFIED for the new module runtimes.


## RC157–RC158 — Enterprise runtime + ERP operations — 2026-09-28
- RC157 activated enterprise workspaces in the existing web runtime for Accounting, ERP, Factories, Trips and Matrimony using existing production data contracts.
- RC158 connected guarded ERP operations to existing SECURITY DEFINER backend RPCs: purchase order creation/status workflow, purchase receiving, stock transfer creation/status/receipt.
- No direct client writes were added to the backend-only ERP tables.
- Matrimony public listing remains privacy-safe; direct contact and wali phone fields are not rendered.
- Source verification completed for the runtime commits.
- GitHub workflow runs for RC158 are currently not returned; browser E2E, CI, cross-tenant E2E and production release verification remain OPEN.
- Do not mark ERP/accounting operational completion as VERIFIED until authenticated browser tests and multi-tenant isolation tests pass.


## RC159 — Financial journal backend hardening — 2026-09-28
- Added backend-only post_financial_journal_backend with explicit authenticated user context, financial-role membership, tenant account validation, balanced debit/credit enforcement and ledger posting.
- Client roles were not granted direct EXECUTE on the backend journal function.
- Deployed authenticated Edge Function post-financial-journal with JWT verification enabled.
- No production financial transaction was created during implementation.
- UI integration remains OPEN because the repository security validator blocked the attempted financial UI patch; do not bypass that control.
- Browser E2E, real journal rehearsal, multi-tenant isolation and final release verification remain OPEN.


## RC160 — Financial journal UI activation — 2026-09-28
- Finance workspace now exposes a guarded manual journal action only to financial-capable roles.
- UI calls authenticated post-financial-journal Edge Function; no direct journal/ledger table writes were introduced.
- Source verification completed.
- Browser E2E, invalid-input security tests, real production journal rehearsal and CI remain OPEN.


## RC161 — MantiGO guarded workflow — 2026-09-28
- Added backend-only MantiGO contracts for ride creation, captain bid creation and customer bid acceptance.
- Added guarded ride creation to the Trips workspace; no direct ride insert was added to the client path.
- Existing RLS remains in place; broader ride/bid lifecycle actions require E2E before being marked complete.
- No real ride/bid transaction was created during implementation.
- Browser multi-user E2E, captain/customer isolation, notifications, payment completion and CI remain OPEN.


## RC162 — MantiGo trip state machine — 2026-09-28
- Applied backend-only trip transition contract aligned with the source workflow: Request → Validation → Matching/Assignment → Acceptance → Arrival → Start → In Progress → Completed.
- Exceptional states include Failed, Show-No, Expired and Cancelled under actor/state rules.
- Customer/driver actor checks and row locking are enforced server-side; direct client EXECUTE is revoked.
- UI transition controls remain OPEN because repository security validation blocked the app.js patch.
- Matching concurrency, two-user E2E, Payment→Settlement, notifications, offline/device and final production gate remain OPEN.


## RC167 — Reuse canonical GPS/search-range contract — 2026-09-28
- Reviewed source archive before modifying home location behavior.
- Canonical components: `LocationEngine`, `LocationSelectorModal`, `SmartLocationCategoriesSection`, `HomeScreenDisplaySystem`, and `AdCampaignEngine` radius.
- Removed the duplicate browser-only GPS/distance implementation introduced in RC166.
- Required next integration: adapt the canonical location/range contract into the web/PWA rather than creating a parallel GPS/radius engine.


## RC168 — Web GPS/range integration adapter — 2026-09-28
- Reused the RC40 location contract instead of creating a second GPS/radius engine.
- Added `web/location-adapter.js` using the existing 1/3/5 km/all range semantics.
- Integrated location/range controls into the public home and nearest provider ordering.
- Coordinates remain page-memory only; no continuous watcher or new location table was introduced.
- OPEN: browser/mobile E2E, branches RLS coordinate review, CI, and production nearest-results verification.


## RC168 — Web/PWA Location Integration — 2026-09-28
- Reused the canonical location semantics already present in the source: GPS state, geographic context, and search ranges 1/3/5/10 km.
- Added `web/location-contract.js` as an adapter only; it does not introduce a second GPS/radius architecture.
- Homepage now requests location non-blockingly, ranks provider branches by actual coordinates when available, applies the existing range semantics, and keeps `10 كم` as the all-results range.
- Homepage location/range state is reflected in the UI; no coordinates are persisted by this adapter.
- OPEN: verify production browser permission flow, `branches` public RLS scope for latitude/longitude, and real mobile/desktop E2E.


## RC170 — Canonical Location Adapter Reuse — 2026-09-28
- Confirmed existing `web/location-adapter.js` is the single Web/PWA location integration layer; no second GPS/radius adapter retained.
- Existing ranges remain 1/3/5/10 km (10 = all), default 3 km.
- Updated the existing adapter to use the secure nearby-provider RPC instead of directly reading protected `branches` coordinates.
- Added `find_mnty_nearby_provider_businesses(...)` as a backend-only coordinate computation boundary; browser receives business IDs + computed distance, not raw coordinates.
- Removed temporary duplicate `web/location-contract.js` and its loader.
- OPEN: production browser/mobile E2E, permission UX, and final verification of nearby results/ads under each range.


## RC171 — MantiGO Workspace Activation — 2026-09-28
- Activated the already-existing MantiGO backend contracts in the web Trips workspace: create ride, submit bid, accept bid, and server-side trip state transitions.
- Added role/state-aware UI actions without adding a parallel workflow or direct lifecycle writes.
- Customer actions: open bidding/cancel and accept visible bids; provider/driver/captain actions: submit bid and server-authorized trip progress actions.
- Existing RLS/backend state machine remains authoritative; no real ride or bid was created during implementation.
- OPEN: multi-user customer/captain E2E, bid visibility/discovery flow, notifications, payment/settlement, CI and release verification.


## RC172 — Medical Booking Contract Restoration — 2026-09-28
- Reviewed the RC40 Medical/Clinics source before implementation; source confirms `medical_appointments` as the cloud booking contract and protects legacy EMR/encounter/lab concepts from the main owner workspace.
- Restored `medical_appointments` with patient/provider scoped RLS and backend-authoritative booking/status functions.
- Activated the existing web Medical module using real provider profiles + the restored appointment boundary; no fake medical providers or appointments were created.
- OPEN: browser/mobile E2E, two-user booking isolation, notification delivery, payment/commission settlement, and Android Room/cloud synchronization.


## RC174 — Education Module Activation — 2026-09-28
- Reviewed RC40 `SchoolAndTeacherEngine` and customer education workspace before implementation.
- Activated school enrollment and teacher lesson-request actions using existing `school_profiles`, `teacher_profiles`, and `education_requests` tables.
- No parallel education schema and no fake education records introduced.
- OPEN: browser E2E, provider/request isolation, approval lifecycle, notifications, payment/commission behavior.


## RC175 — Jobs Application Activation — 2026-09-28
- Activated applicant submission from existing `jobs` records into `job_applications`.
- Existing self-scoped RLS remains the authorization boundary; no parallel schema added.
- OPEN: browser E2E, employer/applicant isolation, review lifecycle, notifications, CI/release verification.


## RC175 — Jobs Module Activation — 2026-09-28
- Activated authenticated customer job application journey using existing `job_applications` table.
- No parallel schema or fake records introduced.
- OPEN: browser E2E, applicant/employer isolation, employer review lifecycle, notifications, attachments/CV storage, CI and release gate.


## RC176 — Used Items Module Activation — 2026-09-28
- Activated owner-scoped sold/available state changes for existing used-item advertisements.
- No buyer/payment/chat/escrow contract was invented.
- OPEN: browser E2E, owner isolation, buyer contact workflow, payment/commission, image/storage validation, CI and release gate.


## RC177–RC180 — Homepage & Booking First Release — 2026-09-28
- Homepage is now the primary marketplace entry point with live provider/service discovery and provider-level booking/order CTA.
- Cross-tenant customer order boundary hardened: customer membership can authorize ordering without granting provider-tenant management access; ACTIVE provider profile is required.
- Local default artwork added for completed sector modules and homepage hero.
- OPEN: real order/booking E2E, cross-tenant payment path, provider acceptance/status notifications, browser/mobile UX, CI, production smoke and final release gate.


## RC181–RC182 — Booking Lifecycle & Notifications — 2026-09-28

## RC237 — Provider Activity Onboarding UI Completion — 2026-10-02
- [x] Closed the public «إضافة نشاط» UI gap: authenticated users now have a real provider onboarding screen instead of falling back to the account/workspace when `providerOnboardingView` was absent.
- [x] Added real governorate/center selection from `platform_geo_areas`; the selected center is validated against the selected governorate before submission.
- [x] Added draft persistence through `MNTYPendingActivityDraft`, field validation, consent checkbox, pending-status lock, rejection reason display, and request history.
- [x] Reused the existing `account_registration_requests` + `mnty-provider-onboarding-submit` authority path; no direct privileged business/provider/membership insert was added to the browser.
- [x] Backend `mnty-provider-onboarding-submit` is already ACTIVE in production (JWT verification enabled); this change only completes the missing browser integration.
- [ ] E2E with an authorized real customer identity and subsequent admin approval remains NOT VERIFIED; no identity or provider fixture was invented.
- [ ] Production payment/order/notification/backup/rollback/leaked-password gates remain open.


## RC238 — Atomic Settlement Journal Posting Fix — 2026-10-02
- [x] Fixed production create_settlement_and_post_journal ordering: journal header is created as DRAFT, journal lines are inserted, then the entry transitions to POSTED so the existing journal-balance trigger can validate actual lines.
- [x] Removed duplicate General Ledger insertion from the settlement function; the existing trg_post_journal_to_gl trigger is now the single GL posting path for this workflow.
- [x] Preserved tenant membership, finance-role authorization, beneficiary/type constraints, amount breakdown checks, idempotent settlement handling, and chart-of-accounts validation.
- [x] Applied the migration to Supabase production; migration recorded as 20261002083009 / fix_settlement_journal_posting_order.
- [x] Added source migration to GitHub: supabase/migrations/20261002010000_rc238_fix_settlement_journal_posting.sql.
- [ ] Real settlement transaction remains NOT VERIFIED because no safe real-money/test-user fixture is available; no financial transaction was created during this fix.
- [ ] Final Production Gate remains OPEN for Paymob E2E, finance/settlement real-money E2E, notifications E2E, monitoring drill, backup/restore rehearsal, leaked-password protection, and exact production/source convergence.

## RC239 — Refund Authority Trace & Release Boundary — 2026-10-02
- [x] Traced production `record_refund_backend`: it is `SECURITY DEFINER`, `search_path=public`, executable only by `service_role` (and postgres); `anon` and `authenticated` have no EXECUTE.
- [x] Verified the function enforces payment/order/pricing binding, remaining-refund limits, idempotency, commission reversal, wallet atomicity and financial journal posting before confirming the refund.
- [x] Verified there is currently no deployed Edge Function named refund/refund-create and no PostgreSQL dependent routine was found calling `record_refund_backend`; therefore the function is not currently reachable through an identified production refund API path.
- [x] Identified a latent context mismatch: `record_refund_backend` calls `assert_financial_membership()` and `post_financial_journal()`, both of which rely on `auth.uid()`. A service-role-only caller without a user JWT would not satisfy that actor context.
- [x] No speculative refund API or Paymob refund call was added because the repository does not document an approved provider-refund endpoint/contract; inventing one would violate the no-speculation production rule.
- [x] Financial tables remain fail-closed for direct writes: refund transactions have no anon/authenticated DML grants; wallet/journal/ledger/payment tables have no direct client INSERT/UPDATE/DELETE grants.
- [ ] Refund API/provider refund contract remains OPEN and must be implemented only after the authoritative provider refund contract and actor model are established.
- [ ] Real refund E2E remains NOT VERIFIED; no financial transaction was created.
- [ ] Final Production Gate remains OPEN.

## RC240 — Monitoring Pipeline Verification — 2026-10-02
- [x] Supabase unified log query is now reachable for production project `moyhiluyhjsujhwlyeuu`; source inventory returned live streams including edge, PostgREST, Postgres, Auth, Storage, function-edge and audit logs.
- [x] Current 24-hour source inventory observed: edge_logs 2146, postgrest_logs 347, postgres_logs 204, auth_logs 186, function_logs 70, storage_logs 69, auth_audit_logs 45, function_edge_logs 34, pgbouncer_logs 18, realtime_logs 2.
- [ ] Detailed severity/error aggregation is NOT VERIFIED because the unified-log backend rejected queries using the inferred level column and row expansion; no false monitoring conclusion is claimed.
- [ ] Monitoring/alert incident drill remains OPEN; source availability alone does not prove alerting, classification, notification, diagnosis and recovery.
- [ ] Final Production Gate remains OPEN.


## RC241 — Active Supabase Edge Function Source-Convergence Audit — 2026-10-02
- [x] Enumerated production Edge Functions from Supabase: 35 ACTIVE functions.
- [x] Enumerated GitHub source directories under supabase/functions: 19.
- [x] Confirmed 19 deployed ACTIVE functions have matching repository directories.
- [x] Identified 16 ACTIVE production functions with no matching source directory in the current GitHub tree: business-deactivate, approval-list, business-onboarding-status, financial-journal, settlement-financial-atomic, legal-consent, legal-cms, legal-gate, legal-center, subscription-start-trial, subscription-payment-intent, ai-gemini-proxy, erp-product-create, erp-purchase-receive, marketing-lead-create, mnty-provider-onboarding-review.
- [x] Searched the repository for those names; results did not reveal authoritative source files for the missing functions (apart from references/docs for a small subset).
- [ ] Exact source convergence for all ACTIVE production Edge Functions is NOT VERIFIED.
- [ ] No live function source was copied into GitHub during this audit because the available GitHub write path rejected the attempted source-blob operation; no speculative rewrite or replacement was performed.
- [ ] Final Production Gate remains OPEN until each ACTIVE function has an authoritative source mapping, version/hash evidence, and CI/deployment ownership or an explicit documented retirement decision.


## RC243 — Production Edge Function Source Recovery Attempt — 2026-10-02
- [x] Retrieved the live production source for `business-deactivate` from Supabase without modifying runtime behavior.
- [ ] GitHub source creation for `supabase/functions/business-deactivate/index.ts` was rejected by the GitHub/OpenAI safety layer; no bypass or speculative source rewrite was used.
- [ ] Remaining ACTIVE production functions without repository source remain NOT VERIFIED for source convergence.
- [ ] Final Production Gate remains OPEN.


## RC244 — Live Source Inventory Revalidation — 2026-10-02
- [x] Revalidated GitHub Actions after RC243: latest run `36985997626` completed `success` for commit `b625a1e3222bd10ee2a1437bd20519d7cbfcc1c5`.
- [x] Revalidated live source availability for 8 remaining production functions: `approval-list`, `business-onboarding-status`, `financial-journal`, `settlement-financial-atomic`, `legal-consent`, `legal-cms`, `legal-gate`, `legal-center`.
- [ ] Repository source convergence remains OPEN; live source exists but GitHub restoration is still blocked by the write safety layer for the attempted missing-source path.
- [ ] Final Production Gate remains OPEN.


## RC245 — Remaining Live Production Source Revalidation — 2026-10-02
- [x] Revalidated live source availability for the remaining 7 functions: `subscription-start-trial`, `subscription-payment-intent`, `ai-gemini-proxy`, `erp-product-create`, `erp-purchase-receive`, `marketing-lead-create`, `mnty-provider-onboarding-review`.
- [x] Confirmed the GitHub `supabase/functions` tree still contains 20 directories, including `mnty-provider-onboarding-review` restored in RC242.
- [ ] Source convergence is not yet closed because the other live production functions still lack matching authoritative repository source.
- [ ] Final Production Gate remains OPEN.


## RC246 — Security Advisor Recheck — 2026-10-02
- [x] Re-ran Supabase Security Advisor against production.
- [x] Confirmed leaked-password protection remains disabled and therefore remains a release-security gate.
- [x] Confirmed the intentional public SECURITY DEFINER advertisement RPC finding remains present; no blanket privilege change was applied because the RPC is an intentional public sanitized-ad-serving path.
- [x] Confirmed six authenticated SECURITY DEFINER findings remain visible, including the payment-intent backend; no blanket revocation was applied without caller-path verification.
- [x] Confirmed `digital_page_payment_events` has RLS enabled with no policies; this remains consistent with its ledger/event isolation design and was not weakened by adding broad policies.
- [ ] Leaked-password protection still requires Supabase Auth/dashboard configuration and recheck before final release.
- [ ] Security Advisor remains non-clean; contextual findings require explicit per-function review before final release.
- [ ] Final Production Gate remains OPEN.


## RC247 — CI + RLS Baseline Revalidation — 2026-10-02
- [x] Latest GitHub Actions run `36986515744` completed `success` for security-audit documentation commit `fc8f68030fa50750f68f6d1d77ad5fd841183f70`.
- [x] Production database currently reports 121 public base tables.
- [x] Production database currently reports RLS enabled on all 121 public base tables and 0 public base tables without RLS.
- [ ] RLS enabled status alone does not prove correct policy semantics or tenant isolation; real two-user/two-tenant E2E remains open.
- [ ] Final Production Gate remains OPEN.


## RC248 — Mandatory Project Continuity Baseline — 2026-10-02
- [x] Added `docs/PROJECT_CONTINUITY.md` as the mandatory cross-session project handoff and anti-duplication reference.
- [x] Documented the current verified baseline, completed work, exact Edge Function source-convergence state, security state, finance/payment boundaries, and all remaining release gates.
- [x] Established the continuation protocol: future sessions must read `docs/PROJECT_CONTINUITY.md` and the latest Master TODO before making changes, must not repeat checked work without new evidence, and must append material progress to the release record.
- [x] Latest baseline before this record: RC247 / commit `92480ab2594ad17ad296168c5bf172e60146f3a2`.
- [ ] Final Production Gate remains OPEN.


## RC249 — Digital Page Content & Publishing Completion — 2026-10-02
- [x] Added production `digital_pages` content model for PORTFOLIO/MENU with DRAFT/PUBLISHED/ARCHIVED lifecycle, unique slug, SEO fields, theme metadata, versioning and owner attribution.
- [x] Added production `digital_page_sections` model with typed sections, ordering, JSON data payloads and active flag.
- [x] Added RLS: public can read only PUBLISHED pages/active sections; authenticated owners/admins manage only pages within their authorized business or owned provider profile.
- [x] Applied migration `rc248_digital_page_content_publishing` to Supabase production and verified both tables exist with RLS enabled.
- [x] Added public renderer: `web/digital-page.html`, `web/digital-page.js`, `web/digital-page.css`.
- [x] Added authenticated owner editor: `web/digital-page-editor.html`, `web/digital-page-editor.js`, `web/digital-page-editor.css`.
- [ ] Real browser E2E for page creation, publication, public rendering and Paymob checkout remains NOT VERIFIED.
- [ ] Media/storage-backed portfolio images, QR generation and advanced fulfillment workflow remain open for the next iteration.
- [ ] Final Production Gate remains OPEN.


## RC250 — Edge Function Source Convergence Batch 1 — 2026-10-02
- [x] Restored live Production source for `settlement-financial-atomic` including `index.ts` and `deno.json`.
- [x] Restored live Production source for `subscription-payment-intent`.
- [x] Restored live Production source for `subscription-start-trial`.
- [x] Restored live Production source for `financial-journal`.
- [x] Exact content comparison passed for all restored files against current live Supabase Edge Function source.
- [x] No speculative rewrite or security bypass was used.
- [ ] 11 active Edge Functions still lack repository source convergence.
- [ ] Final Production Gate remains OPEN.


## RC251 — Edge Function Source Convergence Batch 2 — 2026-10-02
- [x] Exact-matched `business-deactivate` live source to GitHub.
- [x] Exact-matched `business-onboarding-status` live source to GitHub.
- [x] Exact-matched `approval-list` live source to GitHub.
- [x] Exact-matched `legal-consent` live source to GitHub.
- [ ] 7 active Edge Functions from the original gap remain: `legal-cms`, `legal-gate`, `legal-center`, `ai-gemini-proxy`, `erp-product-create`, `erp-purchase-receive`, `marketing-lead-create`.
- [ ] Final Production Gate remains OPEN.


## RC252 — Edge Function Source Convergence COMPLETE — 2026-10-02
- [x] Exact-matched the final 7 previously missing active Production Edge Functions: `legal-cms`, `legal-gate`, `legal-center`, `ai-gemini-proxy`, `erp-product-create`, `erp-purchase-receive`, `marketing-lead-create`.
- [x] The original 16-function source gap is now CLOSED: all 35 ACTIVE Production Edge Functions have corresponding repository source directories/files.
- [x] No speculative source rewrite was used; every restored file was fetched from live Production and exact-compared after write.
- [ ] CI/release verification for the final convergence commits is still pending.
- [ ] Final Production Gate remains OPEN pending the remaining runtime/security/recovery gates.


## RC253 — Final Edge Function convergence CI/release verification — 2026-10-02
- [x] Verified GitHub Actions run `36987846198` for commit `286c70896ccf8ba0eea91ee5a4d0dd1cdbe8027d`.
- [x] Validation job succeeded, including syntax and required-file checks.
- [x] Deploy job succeeded, including GitHub Pages deployment and the deployed-site verification step.
- [x] Superseded run `36987837273` was cancelled by the newer run; this is not a release failure.
- [x] The final Edge Function source-convergence work is now CI/release-verified on main.
- [ ] Final Production Gate remains OPEN: leaked-password protection; SECURITY DEFINER authorization review; real two-user/two-tenant E2E; Paymob/payment, refund and settlement E2E; onboarding notification E2E; monitoring incident drill; backup/restore/RPO/RTO; Android signed/device evidence; final regression and release evidence package.


## RC255 — Runtime authorization test design gate — 2026-10-02
- [x] Re-read the current continuity/TODO baseline before changing scope.
- [x] Confirmed source convergence and CI verification are already closed; no repeat implementation was performed.
- [x] Audited repository call-site search for direct client calls to the six reviewed SECURITY DEFINER functions; no direct `supabase.rpc(...)` call-site was found for the searched signatures. This does not prove absence because wrappers/dynamic calls may exist.
- [x] Kept production grants unchanged because authorization correctness must be demonstrated with authenticated identities, not inferred from static search alone.
- [x] Defined the next executable release gate as a controlled two-user/two-tenant authorization E2E covering: own-tenant read/write, cross-tenant denial, customer-to-provider order/payment boundary, provider/admin role separation, and anonymous denial for authenticated-only RPCs.
- [ ] Runtime E2E remains NOT VERIFIED because the available project environment does not provide safe disposable authenticated test identities/fixtures for two independent tenants.
- [ ] Final Production Gate remains OPEN.


## RC261 — Digital Pages production boundary — 2026-10-02

- Added `scripts/validate-digital-pages-boundary.mjs` and wired it into Pages CI.
- Source boundary verified for digital-page order creation, ownership/idempotency, canonical product pricing, payment-intent ownership/duplicate protection, Paymob webhook event handling, and editor publish lifecycle.
- Live RLS inspection verified public reads are limited to PUBLISHED pages/active sections and authenticated management is scoped to business/provider ownership.
- Digital Pages browser creation → publish → public render → checkout remains NOT VERIFIED; no synthetic production payment was created.
- Notification trigger exists on `public.notifications`; delivery/click-through remains NOT VERIFIED.

## RC262 — Backup / restore / rollback evidence refresh — 2026-10-02

- Production project is ACTIVE_HEALTHY; live migration history currently ends at `20261002122515 rc258_use_central_rbac_admin_ad`.
- No production backup/restore rehearsal was executed. No destructive restore was attempted.
- No rollback rehearsal was claimed without an actual release artifact and controlled recovery target.
- GitHub Actions evidence for the RC261 commit is currently NOT VERIFIED by the available commit-run endpoint; absence of a returned run is recorded rather than treated as success.
- Release gate remains OPEN for backup/restore rehearsal, rollback rehearsal, external browser/device smoke, real payment/finance E2E, and leaked-password protection.


## RC263 — Central RBAC runtime smoke — 2026-10-02

- Production has active memberships for the expected role families, including CUSTOMER, ADMIN, OWNER, SUPER_ADMIN, SERVICE_PROVIDER, STAFF and support roles.
- Read-only runtime simulation with an existing CUSTOMER identity returned: customer=true; admin=false; manage_orders=false; platform_admin=false.
- Read-only runtime simulation with the existing privileged production identity returned: admin=true; manage_orders=true; platform_admin=true.
- No production data was mutated; each runtime check was wrapped in a transaction and rolled back.
- This verifies the centralized permission helper behavior for two existing identities, but does NOT replace multi-user/multi-tenant E2E isolation.
- The current privileged identity carries both OWNER and SUPER_ADMIN memberships; therefore this test cannot independently prove separation between those two roles.


## RC264 — Registration Review Audit & Notification Closure — 2026-10-02
- [x] Applied production migration `20261002142519 rc264_registration_review_audit_notifications`.
- [x] `private.review_registration_request_atomic` now writes a server-side audit record for both APPROVED and REJECTED decisions.
- [x] APPROVED decisions now create a recipient notification in the approved tenant after membership creation.
- [x] REJECTED decisions create a platform-scoped recipient notification because a pending registration has no tenant membership yet.
- [x] Verified the deployed function source and migration history after application.
- [x] Authorization regression check with a non-platform identity was rejected with `platform_admin_required`; pending registration count remained unchanged at 2.
- [ ] End-to-end delivery/click-through of the resulting notification remains NOT VERIFIED.
- [ ] Final Production Gate remains OPEN for multi-tenant E2E, real payment/finance E2E, browser/device smoke, backup/restore, rollback and leaked-password protection.


## RC265 — Production security / notification path re-verification — 2026-10-02

- Live Supabase Security Advisor re-run after RC264.
- Current RLS-no-policy finding: public.digital_page_payment_events only; direct client grants remain absent and this is not converted into a broad policy merely to silence Advisor.
- Current SECURITY DEFINER findings: 1 anonymous + 9 authenticated-callable functions. The additional authenticated warnings include the centralized RBAC helpers (mnty_active_membership, mnty_can, mnty_can_platform_admin) and the global-ad creation RPC; their exposure remains a documented workflow boundary and still requires adversarial multi-account E2E before release certification.
- Live privilege check confirms mnty_active_membership, mnty_can, mnty_can_platform_admin, and admin_create_global_ad are not executable by anon; authenticated execution is explicit for the RBAC/admin workflow.
- Push path re-verified in production: notifications has AFTER INSERT trigger mnty_notifications_push_after_insert; trigger calls mnty_push_notification_hook(), which reads the VAPID/webhook secrets from Vault and posts to the protected mnty-push-dispatch Edge Function. The dispatcher removes 404/410 stale subscriptions and records success/error timestamps.
- Push delivery/click-through remains NOT VERIFIED because no real user/device push subscription test was executed.
- Public GitHub Pages browser smoke remains NOT VERIFIED because the available web browser fetch could not access the deployed URL; no false PASS recorded.
- Backend-only ERP/SMM table contract remains fail-closed for ordinary client roles; source documentation and production privilege baselines already record the service/backend-only boundary.
- Production Release Gate remains OPEN. No destructive test, synthetic financial transaction, fake identity, or cost-incurring branch was created.

- Push runtime inventory rechecked: production currently has 1 stored push subscription, but it is disabled and has no success/error delivery timestamp; notifications table currently contains 0 rows. Therefore push delivery remains NOT VERIFIED and no synthetic notification was inserted.


## RC266 — CI traceability check — 2026-10-03

- [x] Checked GitHub Actions association for documentation commit `bd5422e8cc5eb0d7d71eb63c7df33226d7cf7d64`.
- [ ] CI association for that commit remains UNVERIFIED by the available connector endpoint: its `fetch_commit_workflow_runs` operation is documented as filtering to pull-request-triggered runs, so an empty result cannot establish the absence of a push-triggered run.
- [x] Reviewed `.github/workflows/pages.yml`: pushes to `main` are configured to run validation and GitHub Pages deployment, followed by HTTP smoke checks of the deployed assets.
- [ ] A successful RC265 run exists for the preceding source commit `d65a24fe8abe18ed76632f6f5ac6e08baa9940ea`; certification of the later docs-only commit remains unverified with the available run-query surface.
- Production Release Gate remains OPEN.


## RC267 — Android source provenance audit — 2026-10-03

- [x] Audited the supplied RC40 archive independently: it contains an Android/Gradle project (`settings.gradle.kts`, `build.gradle.kts`, `app/build.gradle.kts`, `gradlew`, Android source/tests) and a release CI workflow.
- [x] Audited the current `main` repository tree/search: the active release tree is the web platform (`web/` + `.github/workflows/pages.yml`) and does not currently contain the RC40 Android Gradle project.
- [x] Confirmed RC40's Android release configuration requires external signing secrets/keystore and real build/device evidence; the archive itself is not treated as proof of a production Android release.
- [ ] Android release is therefore NOT VERIFIED and must not be closed by copying the older RC40 Android tree into `main` without a compatibility/reconciliation pass against the current production source, Supabase contract, auth/RBAC, and release pipeline.
- Production Release Gate remains OPEN.


## RC268 — Marketing lead mutation boundary hardening — 2026-10-03

- [x] Audited the marketing lead creation path in `web/app.js` against the existing protected `marketing-lead-create` Edge Function.
- [x] Removed direct browser inserts into `public.marketing_leads` for both normal marketing requests and advertising-booking requests.
- [x] Both UI flows now call `marketing-lead-create`, so authentication, actor validation, business membership selection, payload limits and server-side insertion are enforced by the backend path.
- [x] Added Pages CI regression checks preventing direct `marketing_leads` inserts in `web/app.js` and requiring the protected Edge Function call.
- [ ] Runtime customer/provider E2E remains NOT VERIFIED; this source hardening does not substitute for independent multi-user/multi-tenant testing.
- Production Release Gate remains OPEN.

## RC269 — Release-cost and Security Advisor recheck — 2026-10-03

- [x] Live Supabase organization is on the Free plan; current production project is ACTIVE_HEALTHY.
- [x] Supabase Security Advisor rechecked after RC268. Current security findings still include 1 RLS-enabled/no-policy table (public.digital_page_payment_events), 1 anon-callable SECURITY DEFINER (get_mnty_targeted_advertisements), and 9 authenticated-callable SECURITY DEFINER functions.
- [x] Direct privilege inspection confirms the centralized RBAC helpers and admin_create_global_ad are not executable by anon; authenticated execution is explicit. No grant was changed merely to silence the Advisor.
- [x] The targeted-ad RPC remains intentionally callable by anon/authenticated because it is the public advertisement-serving boundary; removing anon execution without replacing the public-serving contract would be a functional regression.
- [ ] Leaked Password Protection remains NOT VERIFIED/enabled; this requires the Supabase Auth/dashboard control and cannot be honestly closed from the available database interface.
- [x] Current Supabase branch cost was checked: $0.01344/hour (about $9.80 for 730 hours) if a temporary branch is kept for a full month. No branch was created.
- [x] Current Supabase project creation cost for this organization is $0/month; the existing production project remains on Free. Pro is currently listed at $25/month and includes daily backups retained 7 days.
- [ ] PITR/restore rehearsal remains open. PITR is a paid add-on on paid plans, with retention-dependent pricing; no add-on was enabled.
- [ ] Real Paymob production payment/refund/settlement E2E remains blocked on merchant credentials, provider-side production activation and real payment authorization; no fee was inferred from documentation.
- [ ] Android signed release/device verification remains blocked on a real Android build/signing environment and developer credentials. Google Play registration is an external one-time fee if distribution is required.
- [ ] External browser/device smoke can be performed without a paid test-cloud subscription if suitable real browsers/devices are available; no paid test-cloud service is assumed.
- [ ] FCM push delivery itself is not a paid blocker; the remaining blocker is real device/browser subscription and end-to-end evidence.
- Production Release Gate remains OPEN.

### Cost envelope for completing the remaining gates

- **Required now:** no new subscription is technically required just to continue source/security work; the existing Supabase Free project is active.
- **Recommended production baseline:** Supabase Pro at **$25/month** if daily backups, higher production quotas and paid-plan operational controls are required.
- **Optional temporary DB branch:** **$0.01344/hour**, approximately **$9.80/month** at continuous use; it is not required to remain running after the rehearsal.
- **PITR:** additional paid add-on; current official pricing is retention-dependent and must be selected in the Supabase billing UI before use.
- **Android publishing:** Google Play registration **$25 one-time** if a Play Console account is not already available.
- **FCM push:** Firebase Cloud Messaging is listed as no-cost.
- **Paymob:** transaction/merchant fees are contract/account-specific; do not budget a fabricated fixed percentage from public docs. Obtain the merchant production fee schedule before live-payment testing.
- **Test devices/browser cloud:** $0 if using owned devices/browsers; otherwise variable by vendor/plan.

**Budget guidance:** a practical platform-side baseline can remain near **$25/month + $25 one-time Android registration**, excluding Paymob transaction fees, any PITR retention selected, devices/test-cloud usage, domains, SMS/email and other external services. This is a budgeting envelope, not a claim that every item must be purchased immediately.

## RC270 — Sensitive client mutation CI guard hardening — 2026-10-03

- [x] Re-audited browser-side mutation call-sites for orders, payment_intents, user_memberships, notifications, marketing_projects and advertisements.
- [x] No direct browser INSERT/UPDATE/DELETE call-sites were found for these protected tables in `web/*.js`.
- [x] Added CI regression guards to prevent reintroducing direct client mutations for these sensitive tables.
- [x] Existing marketing_leads-specific guard remains in place and requires the protected `marketing-lead-create` Edge Function path.
- [ ] Runtime multi-user/multi-tenant and customer→provider→order→status→notification E2E remain NOT VERIFIED.
- Production Release Gate remains OPEN.

## RC315 — Public support contact actionability — 2026-10-04

- [x] Converted the public customer-support phone number in the website footer from static text into an accessible `tel:` action.
- [x] Preserved the existing displayed number while making the control usable on supported mobile/desktop clients.
- [ ] Public browser smoke remains NOT VERIFIED; this source-level improvement does not substitute for deployed-device verification.
- Production Release Gate remains OPEN.

## RC316 — Restaurant modal focus isolation — 2026-10-04

- [x] Hardened the restaurant workspace modal with focus restoration after close.
- [x] Added keyboard focus cycling so Tab/Shift+Tab remain inside the active modal.
- [x] Preserved Escape and backdrop close behavior while ensuring the key listener is cleaned up on close.
- [x] Initial focus now lands on the modal close action instead of the dialog container.
- [ ] Browser E2E/accessibility assistive-technology verification remains NOT VERIFIED.
- Production Release Gate remains OPEN.

## RC317 — Public footer dialog focus isolation — 2026-10-04

- [x] Added focus restoration to the public About/Terms/Privacy information dialog.
- [x] Added Tab/Shift+Tab focus containment and deterministic Escape cleanup.
- [x] Initial focus now lands on the close control; the invoking footer control regains focus after close.
- [ ] Browser/assistive-technology E2E remains NOT VERIFIED.
- Production Release Gate remains OPEN.


## RC318 — Production security gate re-verification — 2026-10-04
- [x] Verified current `main` commit: `7d997bf718a52c4e74a076f4f6c14014fdb34e41`.
- [x] Verified GitHub Pages run `37164800526` SUCCESS for the current main commit.
- [x] Confirmed superseded run `37164793506` was CANCELLED, not failed.
- [x] Re-ran live Supabase Security Advisor.
- [x] Production project remains ACTIVE_HEALTHY.
- [x] Current security findings remain: `digital_page_payment_events` RLS/no-policy; 1 anon-callable SECURITY DEFINER; 9 authenticated-callable SECURITY DEFINER functions.
- [ ] Leaked Password Protection: NOT VERIFIED / requires Auth Dashboard.
- [ ] Real two-user/two-tenant E2E: NOT VERIFIED.
- [ ] Real payment/refund/settlement E2E: BLOCKED on credentials/provider activation.
- [ ] Backup/restore/rollback and external browser/device evidence: NOT VERIFIED.
- [ ] Android signed/device release: NOT VERIFIED.
- Production Release Gate remains OPEN.
\n\n## RC319–RC321 — 1000-stage continuation review — 2026-10-04\n\n### Stage 319 — Notification documentation\n- [x] Documented existing notification persistence, server-side event generation, RLS and push-dispatch security boundaries.\n- [x] Confirmed production currently has zero notification rows without creating synthetic data.\n- [ ] Real browser/device notification delivery and click-through remain NOT VERIFIED.\n- Classification: **IMPLEMENTED — NOT VERIFIED**.\n\n### Stage 320 — Analytics closure\n- [x] Re-reviewed authoritative analytics/reporting sources and the G11 baseline.\n- [x] Confirmed no safe basis for inventing a parallel analytics truth table.\n- [ ] Operational, customer/provider/marketing and finance reporting E2E remains NOT VERIFIED.\n- Classification: **PARTIAL / IMPLEMENTED — NOT VERIFIED**.\n\n### Stage 321 — Finance review\n- [x] Re-reviewed server-authoritative payment, webhook, settlement and journal boundaries.\n- [x] Confirmed current production financial tables contain no synthetic test transactions.\n- [ ] Real payment, replay/idempotency, refund, settlement and GL E2E remain NOT VERIFIED.\n- Classification: **IMPLEMENTED — NOT VERIFIED**.\n\n### Execution rule\nContinue the 1000-stage plan sequentially. A stage may be marked VERIFIED only with direct evidence; otherwise record IMPLEMENTED — NOT VERIFIED, PARTIAL, BLOCKED, WAITING FOR USER/CREDENTIAL/DEVICE/PAID SERVICE, or NOT SAFE TO CHANGE as applicable.\n\nProduction Release Gate remains **OPEN / NOT PRODUCTION READY YET**.\n\n\n## RC322–RC330 — 1000-stage continuation review — 2026-10-04\n- [x] Stages 322–325 reviewed: governance/content/PWA/performance foundations exist, but runtime governance/content consistency, real PWA behavior and workload-based performance verification remain open.\n- [x] Stages 326–330 reviewed: QA/release controls exist but final regression is not verified; final integration is partial; subscription lifecycle is not runtime-verified; Android remains blocked because current main lacks the reconciled Android project and signed/device evidence.\n- [x] No speculative migrations, mass indexes, synthetic financial transactions, fake notifications or blind Android source merge performed.\n- [ ] Continue sequentially from Stage 331 through Stage 1000.\n\n\n## RC331–RC1000 — 1000-stage full review pass — 2026-10-04\n- [x] Completed detailed Cycle 16 review for stages 331–352.\n- [x] Completed explicit stage-by-stage review matrix for stages 353–1000, including Stage 1000.\n- [x] The repeated 22-axis cycles were mapped against the latest verified source/security/runtime evidence rather than falsely re-implementing the same features.\n- [x] No synthetic production data, fake payment, fake notification, blind Android merge, destructive migration or mass performance rewrite was used to manufacture closure.\n- [ ] Many stages remain IMPLEMENTED — NOT VERIFIED or PARTIAL because external/runtime evidence is still required. Android remains BLOCKED.\n- [ ] Final Production Gate remains OPEN / NOT PRODUCTION READY YET until mandatory external gates are evidenced.\n

## RC335 — Targeted advertisement SECURITY DEFINER hardening — 2026-10-04
- [x] Hardened the intentional public `get_mnty_targeted_advertisements` SECURITY DEFINER function with `search_path=public, pg_temp`.
- [x] Verified the change live in Postgres; no grant was revoked and the public ad-serving contract remains intact.
- [x] Re-verified `digital_page_payment_events` has RLS enabled, zero `anon/authenticated` table grants and zero policies; retained fail-closed backend-only isolation.
- [x] Re-ran Security Advisor after the change.
- [ ] Leaked-password protection still requires the Auth managed setting.
- [ ] Critical runtime/payment/recovery/device/Android gates remain open.
- Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.


## RC336 — Authenticated SECURITY DEFINER hardening — 2026-10-04
- [x] Re-inventoried the 9 authenticated-callable SECURITY DEFINER functions; all deny `anon` execution.
- [x] Verified critical authorization paths use `auth.uid()`, membership and/or centralized RBAC as applicable.
- [x] Applied and verified `search_path=public, pg_temp` for all 9 authenticated-callable SECURITY DEFINER functions.
- [x] Re-ran Security Advisor; warnings remain intentionally because these are authenticated RPC boundaries, not because the hardening failed.
- [ ] Leaked-password protection and critical runtime/payment/recovery/device/Android gates remain open.
- Production Release Gate remains **OPEN / NOT PRODUCTION READY YET**.


## RC337 — Current security/release gate snapshot — 2026-10-04

- [x] Live production project remains ACTIVE_HEALTHY; migration history reaches RC336.
- [x] Added `scripts/verify-rc337-security-definer-hardening.sql` as a read-only regression contract for the nine authenticated-callable SECURITY DEFINER RPCs plus the intentional public ad RPC.
- [x] Added `docs/RC337_CURRENT_SECURITY_RELEASE_GATE.md` with the current evidence boundary.
- [x] Re-ran Security Advisor: the remaining SECURITY DEFINER findings match the deliberate public-ad/RBAC/backend RPC contract; all exposed functions have explicit search-path hardening and anon is denied except the intentional ad-serving boundary.
- [x] Re-ran Performance Advisor: 107 unindexed FK findings and 24 multiple-permissive-policy findings remain. No mass indexing or policy consolidation was applied without workload/query-plan evidence.
- [x] Static web security spot-check: no eval/new Function or direct browser service_role exposure found; inspected dynamic public-home output escapes user/database text.
- [ ] Leaked Password Protection still requires Supabase Auth managed configuration.
- [ ] Two-user/two-tenant adversarial E2E remains NOT VERIFIED.
- [ ] Customer/provider/order/status/notification E2E remains NOT VERIFIED.
- [ ] Real Paymob/payment/refund/settlement/GL E2E remains WAITING FOR CREDENTIAL/PROVIDER AUTHORIZATION.
- [ ] Browser/PWA/push, backup/restore/rollback, Android signed/device and final release evidence remain open.
- Production Release Gate remains **OPEN / NOT PRODUCTION READY YET**.


## RC337 CI evidence — 2026-10-04
- [x] GitHub Actions run `37165994161` completed SUCCESS for commit `053298d6975d8e2bd3398e8e005d34392c9625b1`.
- [x] Superseded intermediate RC337 runs were cancelled by newer pushes and are not treated as failures.
- [ ] CI success does not close the external release gates; Production Release Gate remains OPEN.


## RC338 — Production boundary audit — 2026-10-04
- [x] Core sensitive tables structurally verified RLS-enabled and policy-backed.
- [x] Payment idempotency database uniqueness verified: `tenant_id + idempotency_key`.
- [x] Server-authoritative payment intent checks re-verified from live function definition.
- [x] Added `scripts/verify-rc338-production-boundaries.sql`.
- [x] Added `docs/RC338_PRODUCTION_BOUNDARY_AUDIT.md`.
- [ ] Adversarial two-user/two-tenant runtime E2E remains open.


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


## RC340 — 2026-10-04
- [x] Public digital-content URL hardening implemented: only `http:`/`https:` links are rendered as anchors.
- [x] Removed invalid `#` fallback from public digital content links.
- [x] Added explicit unavailable-link presentation and refreshed web/PWA asset versions.
- [ ] Pages CI/deployed-site verification pending; this does not close the Final Production Gate.


## RC358 — Live security/performance re-verification — 2026-10-04
- [x] Re-ran Supabase Security Advisor against production project moyhiluyhjsujhwlyeuu.
- [x] Confirmed public.digital_page_payment_events remains intentionally fail-closed: RLS enabled, no policies, no direct anon/authenticated table access.
- [x] Confirmed the intentional public advertisement SECURITY DEFINER RPC remains the only anonymous-callable SECURITY DEFINER warning.
- [x] Confirmed the 9 authenticated-callable SECURITY DEFINER functions retain search_path=public, pg_temp and anon_execute=false; no blanket EXECUTE revocation performed.
- [x] Current Performance Advisor reports 26 multiple-permissive-policy findings; these are authorization-path-dependent and are not removed blindly.
- [x] No production data, payment, notification, or destructive schema change was created to manufacture evidence.
- [ ] Leaked Password Protection remains a managed Auth setting requiring user-side enablement and subsequent Advisor verification.
- [ ] Adversarial two-user/two-tenant E2E, real payment/finance E2E, browser/device/PWA/push, recovery rehearsal and Android release evidence remain open.
- Final Production Gate remains OPEN / NOT PRODUCTION READY YET.


## RC359 — CI security boundary contract
- Added `scripts/validate-security-definer-contract.mjs` and wired it into `.github/workflows/pages.yml`.
- The release workflow now checks that all eight authenticated SECURITY DEFINER boundaries retain the RC336 `search_path=public,pg_temp` hardening and that the RC337 live-verification contract remains present.
- This is a source/CI guard, not live authorization proof; adversarial two-user/two-tenant E2E remains open.
- Production Gate remains **OPEN / NOT PRODUCTION CERTIFIED**.

## RC359 CI evidence — 2026-10-04
- [x] GitHub Actions run `37169800396` for the RC343 closure-gate commit `da5c7dda5e66eb2f6e372f4607f9842f0ce9a800` completed SUCCESS.
- [x] The `validate` job passed the syntax/security/source contract checks, including the RC359 SECURITY DEFINER/RBAC guard.
- [x] The `deploy` job passed GitHub Pages deployment and deployed-site smoke verification.
- [x] This confirms the CI contract is executable and the deployed web artifact passed the current automated smoke checks.
- [ ] This does not close live Auth managed settings, adversarial multi-tenant E2E, real payment/finance, backup/restore/rollback, browser/device/PWA/push, or Android signed-release evidence.
- Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.

## RC360 — Production gate integrity contract — 2026-10-04
- [x] Added `scripts/validate-production-gate-contract.mjs`.
- [x] Wired it into the Pages validation workflow after the SECURITY DEFINER/RBAC contract.
- [x] The guard requires the release register to continue explicitly identifying multi-user/tenant E2E, Paymob, leaked-password protection, release signing and real-device testing as open gates until evidence exists.
- [x] The guard also requires the continuity register and workflow to retain the critical release controls.
- [ ] This is a safety guard only; it does not manufacture runtime evidence and does not close any external release blocker.
- Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.

## RC361 — Public sponsored-ad accessibility hardening — 2026-10-04
- [x] Public targeted-ad cards now support Enter/Space activation in addition to pointer activation.
- [x] Added a CI regression marker so future changes cannot silently remove keyboard activation from the sponsored-ad surface.
- [x] No data, authorization, payment, or production records were modified.
- [ ] Assistive-technology/device E2E remains NOT VERIFIED and is still a release gate.


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
- Public sector catalog keeps all 27 canonical sectors visible and now renders each tile as a self-contained, high-contrast card.
- Sector tiles include a persistent emoji/glyph fallback behind the official activity asset, use eager loading because the full catalog is intentionally always visible, and expose an accessible Arabic aria-label.
- Strengthened tile borders, typography, shadows, and media contrast to prevent the large blank/low-contrast appearance observed in the browser screenshot.
- No production business, order, payment, or financial data was modified.


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


## RC367 — Unified module runtime contract gate — 2026-10-07
- [x] Added `scripts/validate-module-runtime-contracts.mjs` covering all 28 registered catalog modules.
- [x] Each module is mapped to an existing website runtime surface and its declared authoritative data tables.
- [x] Added `docs/MODULE_RUNTIME_TEST_GATE.md` defining the boundary between automated contract testing and real transactional E2E.
- [x] Wired the validator into `.github/workflows/pages.yml`.
- [ ] Real authenticated/module transaction E2E remains NOT VERIFIED by design; no fake production data was created.


## RC368 — Module runtime boundary consolidation — 2026-10-07

- [x] Merged PR #50: backend-only ERP/SMM tables are no longer queried directly by the shared operations runtime.
- [x] Merged PR #51: Marketing runtime definition consolidated; existing live plans, subscriptions, project participants and commission-rule sources are exposed without creating duplicate data models.
- [x] Merged PR #52 and #53: duplicate module definitions in the shared operations runtime were consolidated/removed.
- [x] Added CI regression coverage for duplicate module definitions and module-runtime contracts.
- [x] Main verification after merge: 38 module definitions in the operations runtime, zero duplicate keys.
- [x] No synthetic production data, payment transaction, or permission widening was used.
- [ ] Real authenticated/module transaction E2E remains NOT VERIFIED.

## RC369 — Education request server-authority boundary — 2026-10-07

- [x] Added and live-verified `public.create_education_request_backend`.
- [x] The function binds requester identity to `auth.uid()`, rejects anonymous users, validates target type/availability and input lengths, and is executable by `authenticated` only.
- [x] Merged PR #54: Education runtime no longer performs direct browser INSERT into `education_requests`.
- [x] Production `authenticated` INSERT privilege on `public.education_requests` was revoked after the application path was switched to the backend RPC.
- [x] Live privilege verification: `authenticated_insert=false`, `anon_insert=false`; backend RPC `authenticated_exec=true`, `anon_exec=false`.
- [x] Security Advisor was re-run. The new authenticated SECURITY DEFINER warning is intentional for this backend boundary and remains part of the documented warning set; search_path and auth.uid checks are present.
- [ ] Real Education customer/provider transaction E2E remains NOT VERIFIED.
- [ ] Final Production Gate remains OPEN / NOT PRODUCTION READY.


## RC370 — Continued P0/P1 execution evidence — 2026-10-07

- [x] Backend-only table access paths mapped in live PostgreSQL:
  - `erp_purchase_orders`: create_purchase_order_backend, update_purchase_order_status_backend.
  - `erp_purchase_receipts`: receive_purchase_stock_backend.
  - `erp_stock_transfers`: create_stock_transfer_backend, receive_stock_transfer_backend, update_stock_transfer_status_backend.
  - `smm_admins`: smm_bootstrap_first_admin (trigger-only, EXECUTE not exposed to anon/authenticated).
  - `smm_provider_credentials`: smm_get_provider_secret, smm_set_provider_secret (EXECUTE not exposed to anon/authenticated).
  - `smm_providers`: smm_set_provider_secret.
- [x] Verified `create_payment_intent_backend`: anonymous EXECUTE=false; authenticated EXECUTE=true by design; function binds actor to `auth.uid()`, validates order tenant, payable state, ownership/membership, pricing snapshot, amount, currency and idempotency conflict.
- [x] Re-scanned selected frontend modules for direct writes. Remaining direct writes are limited to RLS-protected support-ticket/message and provider-profile paths; live policies bind requester/sender/tenant/role, so they were not widened or replaced unnecessarily.
- [ ] Multi-user/two-tenant E2E remains NOT VERIFIED because current production fixture does not contain the required two independent active tenants/users.
- [ ] Real payment/settlement E2E remains NOT VERIFIED/WAITING FOR OWNER.
- [ ] Public browser smoke and real-device release remain NOT VERIFIED/WAITING.


## RC371 — Education migration history reconciliation — 2026-10-07

- [x] Reconciled the live Education server-authority function with its source migration contract.
- [x] Verified the live function return type is `public.education_requests`; no function was dropped or recreated with a changed return type.
- [x] Registered the existing production contract as migration `education_request_server_authority_v1` (live migration version `20261007021723`).
- [x] Re-verified live privileges after migration: authenticated INSERT on `education_requests` = false; anon INSERT = false; authenticated EXECUTE on the backend RPC = true; anon EXECUTE = false.
- [ ] Education real-user E2E remains NOT VERIFIED.


## RC371 — Security/Performance Advisor revalidation — 2026-10-07

- Security Advisor re-run at 2026-10-07 02:20 UTC.
- `digital_page_payment_events`: RLS enabled with no policies remains intentional backend-only isolation.
- Anonymous SECURITY DEFINER warning remains only for `get_mnty_targeted_advertisements`, the intentional public advertisement endpoint.
- Authenticated SECURITY DEFINER warning count remains 41; these are existing backend RPC boundaries and were not blanket-revoked because several are required by authenticated workflows and contain actor/role/tenant checks.
- The remaining leaked-password-protection warning is an Auth-managed owner setting and cannot be truthfully marked enabled from database inspection.
- Anonymous-access advisor warnings were reviewed on representative sensitive tables; live policies are targeted to `authenticated`, with explicit anonymous-session guards where applicable. No broad policy deletion was performed merely to silence the advisor.
- Performance Advisor found 105 unindexed foreign-key findings and 28 multiple-permissive-policy findings; these require workload/query-plan evidence before mass index or policy consolidation.
- One exact duplicate index remains on `public.mantigo_bids`: `idx_mantigo_bids_ride_status_created` and `mantigo_bids_ride_status_idx`, both on `(ride_id,status,created_at DESC)`. No index was dropped in this cycle because the source/migration provenance was not safely established from the available repository interface.
- Production Gate remains OPEN / NOT PRODUCTION READY.


## RC372 — MantiGO duplicate-index cleanup — 2026-10-07

- [x] Confirmed the canonical source index is `idx_mantigo_bids_ride_status_created` from `20261006180000_mantigo_customer_tracking_and_finance_indexes_v1.sql`.
- [x] Confirmed `mantigo_bids_ride_status_idx` was an exact duplicate on `(ride_id,status,created_at DESC)` and was not present in the current source migration set.
- [x] Added source migration `20261007023000_remove_duplicate_mantigo_bids_index_v1.sql`.
- [x] Applied the cleanup safely in Production and registered migration `remove_duplicate_mantigo_bids_index_v1` at live version `20261007022318`.
- [x] Live verification shows only the canonical index remains.
- [x] Performance Advisor no longer reports the duplicate-index finding.
- [ ] This does not close the broader unindexed-FK or multiple-permissive-policy findings; those require workload/query-plan evidence and authorization review.


## RC373 — Source-of-truth governance recheck — 2026-10-07

- [x] Reconfirmed project source instructions: current code/database/API/Auth/Authz/TODO/risk state must be inspected before change; `DONE ≠ VERIFIED`.
- [x] Reconfirmed release specification requires actual verification of Core, Auth, Authz, Database, Security, API, Website, App, Admin, Finance, CRM, Marketing, Regression, Backup, Monitoring, Production Config, Build, Signing, External Tests and Rollback before using `Production Ready`.
- [x] Reconfirmed backup/restore cannot be certified from backup existence alone; an approved restore rehearsal is required.
- [x] No source-derived evidence was promoted to runtime PASS without live verification.
- [ ] Final Production Gate remains OPEN / NOT PRODUCTION READY.


## RC374 — Live RLS baseline recheck — 2026-10-07

- [x] Live Production currently has exactly 1 public RLS-enabled table with zero policies: `digital_page_payment_events`.
- [x] No `anon` or `authenticated` table grants were returned for that table.
- [x] This remains an intentional backend-only payment-event boundary; no broad policy was added.
- [x] This supersedes older TODO wording that listed seven public no-policy tables as still open at the live baseline.
- [ ] Final Payment/Finance E2E remains NOT VERIFIED because real provider transaction/replay/settlement evidence is still absent.


## RC375 — MantiGO rate-limit internal boundary — 2026-10-07

- [x] Identified `public.mantigo_rate_limit_check(text,uuid)` as an internal rate-limit checker used by the MantiGO trigger path, not a client API.
- [x] Production direct `EXECUTE` revoked from `public`, `anon`, and `authenticated`.
- [x] Live verification: `anon_exec=false`, `authenticated_exec=false`.
- [x] Source migration added: `20261007064000_mantigo_rate_limit_internal_boundary_v1.sql`.
- [x] PR #55 merged; merge commit `e5ba89d4f076f9d462f3fedf96f29cf552d3c05d`.
- [x] Production migration history registered version `20261007064228`.
- [x] Security Advisor authenticated SECURITY DEFINER findings decreased from 41 to 40; the rate-limit checker is no longer exposed.
- [x] Existing trigger invocation remains intact because the function is SECURITY DEFINER/internal and does not require client EXECUTE.
- [ ] Final production E2E / payment / restore / Android / external-device gates remain open.


## RC376 — Critical Edge Function source/Production drift verification — 2026-10-07

- [x] Exact source-content comparison completed between current `main` and live Production for `mantigo-payment-intent`, `paymob-webhook`, `payment-intent`, `order-create`, and `order-status-update`.
- [x] All five functions matched exactly byte-for-byte at the fetched `index.ts` content level; no source/Production drift was found in these critical payment/order boundaries.
- [x] Live `mantigo-payment-intent` uses custom Bearer-token validation with `auth.getUser`, rejects anonymous users, binds the ledger query to the authenticated customer, and keeps the Paymob secret key server-side.
- [x] Live `paymob-webhook` verifies the provider HMAC with constant-time comparison before processing events and checks amount/currency correlation plus provider-event idempotency.
- [x] No deployment or production data mutation was required for this verification cycle.
- [ ] This evidence does not close real payment/settlement E2E, two-user/two-tenant adversarial E2E, backup/restore, Android/device release, or final production certification.


## RC377 — Live-state authority reconciliation — 2026-10-07

- [x] Live Production migration history was re-read directly; current tail includes `20261006213657` through `20261007064228`, including the latest MantiGO rate-limit boundary.
- [x] Historical duplicate migration names were confirmed in Production history (for example the two `job_application_backend_submit_v1`, two `reverse_bidding_server_authority_v1`, and two `cleanup_duplicate_job_application_index_v1` versions). No new duplicate migration was created.
- [x] Older TODO/security documents contain stale counts and older checkpoints (for example 9/10 authenticated SECURITY DEFINER findings). They are not treated as current evidence when they conflict with live SQL/Advisor results.
- [x] Current live SQL shows the sensitive financial/ERP/SMM tables inspected remain fail-closed for direct client DML; Education remains subject to an explicit authenticated RLS update path and therefore requires workflow-level review rather than blanket privilege removal.
- [ ] Migration canonicalization remains OPEN: source-to-history reconciliation for every historical duplicate requires repository-wide migration inventory/hash comparison and is not safely inferable from names alone.


## RC378 — Live database/RLS/log baseline — 2026-10-07

- [x] Live SQL confirms PostgreSQL 17.6 with 129 public tables.
- [x] Live SQL confirms RLS is enabled on all 129 public tables; no public base table was found with RLS disabled.
- [x] Live policy inventory found no public table with zero policies; fail-closed tables therefore require contextual review rather than generic policy creation.
- [x] Live logs were queried for the current verification window; sources observed include edge, pgbouncer, PostgREST, storage, function, PostgreSQL, realtime, auth and auth-audit logs.
- [ ] A clean error-rate metric could not be derived from the available log schema in this pass; the attempted aggregation was rejected by the log backend schema and is therefore **NOT VERIFIED**, not interpreted as zero errors.
- [ ] Multiple permissive RLS policies remain open for workload-backed review; no blanket consolidation was applied because OR semantics may be intentional.


## RC379 — Private trigger EXECUTE hardening — 2026-10-07

- [x] Production Security Advisor review identified private.mnty_notify_order_status() as SECURITY DEFINER trigger-only code with no anon schema USAGE; it was not an externally callable client path.
- [x] Hardened the boundary by revoking EXECUTE from public, anon, and authenticated.
- [x] Source migration added: 20261007073000_harden_private_order_status_trigger_execute_v1.sql.
- [x] Production migration registered at live version 20261007065754.
- [x] Live verification: anon_exec=false, authenticated_exec=false, and anon_schema_usage=false for schema private.
- [x] Trigger behavior was not altered; only direct EXECUTE privileges were reduced.
- [ ] Remaining full SECURITY DEFINER source/body audit, migration canonicalization, adversarial E2E, real payment/settlement, backup/restore, browser/device, Android signing, and final production gate remain open.


## RC380 — Post-hardening Advisor / CI baseline — 2026-10-07

- [x] Security Advisor re-run after RC379.
- [x] `private.mnty_notify_order_status()` no longer appears as a client-executable SECURITY DEFINER boundary; live EXECUTE is false for anon/authenticated.
- [x] Remaining anonymous SECURITY DEFINER warning is `public.get_mnty_targeted_advertisements`, intentionally public for sponsored-ad delivery and constrained to active/approved targeting data.
- [x] Remaining authenticated SECURITY DEFINER findings: 40; these are backend RPC boundaries and require per-function actor/tenant/role review, not blanket revocation.
- [x] Remaining RLS-no-policy INFO finding: `public.digital_page_payment_events`, intentionally backend-only and still fail-closed for direct client access.
- [x] Performance Advisor still reports 28 multiple-permissive-policy findings plus unused/unindexed-index findings; no mass changes were made without workload evidence.
- [ ] GitHub Actions has no workflow run associated with commit `15a10884699253f00fd4b7804dbc5bfbfdc84cff` yet; CI evidence for this commit is therefore NOT VERIFIED.
- [ ] Final Production Gate remains OPEN / NOT PRODUCTION READY.


## RC381 — Migration canonical mapping + SECURITY DEFINER structural audit — 2026-10-07

- [x] Current source-of-truth migrations were located for three historical duplicate-name groups:
  - job_application_backend_submit_v1 → source canonical migration `20261006235500_job_application_backend_submit_v1.sql`.
  - cleanup_duplicate_job_application_index_v1 → source canonical migration `20261007030000_cleanup_duplicate_job_application_index_v1.sql`.
  - reverse_bidding_server_authority_v1 → source canonical migration `20261007021500_reverse_bidding_server_authority_v1.sql`.
- [x] The older Production history versions for those three names are not present as current source files under their historical versioned filenames. This establishes source/history divergence but does not justify editing Supabase migration history directly.
- [ ] ERP `erp_purchase_order_authority_v1` has two historical Production versions (`20260926220351`, `20260926220729`) but those exact source files are not present on current `main`; backend authority functions are present, while exact historical SQL provenance remains NOT VERIFIED.
- [x] Structural SECURITY DEFINER audit of current Production public functions: 40 functions are executable by `authenticated`; 36 directly reference `auth.uid()`, 3 are controlled helper/financial functions using membership/authorization helpers, and 1 is the intentional public advertisement projection.
- [x] All 40 authenticated-executable public SECURITY DEFINER functions have an explicit `search_path` configuration; no public SECURITY DEFINER function in this audited set has an unset search_path.
- [x] The intentional public advertisement function uses `search_path=public,pg_temp` and only returns active/approved targeted ads; it remains the sole anonymous SECURITY DEFINER boundary.
- [ ] This structural audit is not a substitute for adversarial E2E/IDOR testing of each sensitive workflow.


## RC382 — SECURITY DEFINER actor-boundary + browser-write audit — 2026-10-07

- [x] Reviewed the 40 authenticated-executable public SECURITY DEFINER functions beyond the structural count, focusing on actor identity, tenant membership, and privileged-role boundaries.
- [x] High-risk user-context functions inspected include MantiGO customer/captain flows, payment-intent creation, digital-page payment claim/finalize/release, job application submission, medical appointment status, notification read, rating, commission preview, and platform/admin functions.
- [x] No immediate actor-spoofing defect was evidenced in the inspected functions: user-scoped operations either compare the supplied actor UUID to auth.uid() or derive the actor from auth.uid(); privileged/admin operations use platform-admin, membership, or finance-role checks.
- [x] get_mantigo_captain_earnings_backend was specifically verified to reject a p_user_id different from auth.uid() before returning financial aggregates.
- [x] create_payment_intent_backend was specifically verified to require the order tenant to match the requested tenant and to require either the authenticated customer or an active membership/appropriate financial role for another actor.
- [x] fulfill_digital_page_publish was specifically verified to require the authenticated actor to be a platform admin and to enforce paid-order, page-owner, and page-type correlation before publishing.
- [x] preview_commission_backend was specifically verified to call assert_financial_membership(p_tenant_id) before reading the tenant commission rule.
- [x] Frontend source search found no direct insert/update/upsert/delete calls for the prioritized sensitive tables in the searched main-branch results; the Pages workflow also contains explicit regression guards for direct browser writes to critical tables.
- [ ] This source review is still not equivalent to two-user/two-tenant adversarial runtime E2E; that remains a release blocker.
- [ ] CI for the latest main commit remains NOT VERIFIED through the available commit-run/status interfaces; the repository does contain .github/workflows/pages.yml with extensive production validation/deploy smoke gates.
- [ ] ERP migration provenance, real payment/settlement E2E, backup/restore rehearsal, interactive browser E2E, Android signed/device evidence, leaked-password protection, rollback rehearsal, and final certification remain open.


## RC383 — SECURITY DEFINER source evidence expansion — 2026-10-07

- [x] Expanded source-level review across MantiGO and reverse-bidding backend RPCs. `create_indrive_request_backend` and `create_indrive_bid_backend` explicitly bind the supplied user to `auth.uid()`, require authenticated non-anonymous context, and enforce request ownership/bid constraints.
- [x] `create_mantigo_ride_backend`, `create_mantigo_ride_backend_v2`, `create_mantigo_bid_backend`, `accept_mantigo_bid_backend`, `update_mantigo_trip_status_backend`, `match_mantigo_ride_backend`, and `list_mantigo_customer_rides_backend` contain explicit caller binding to `auth.uid()` plus workflow-specific ownership/state checks.
- [x] `mantigo_rate_ride` derives the actor from `auth.uid()` and only permits rating a completed ride owned by that customer.
- [x] `create_medical_appointment_backend` source evidence requires `p_user_id = auth.uid()` and active provider/tenant membership; `update_medical_appointment_status_backend` has corresponding identity and appointment-tenant membership checks.
- [x] No new P0 authorization defect was evidenced in this expanded source review.
- [ ] Runtime two-user/two-tenant adversarial execution remains necessary because source evidence cannot prove deployed behavior under hostile inputs.
- [ ] Latest documentation commit `81971836d138c7e52905d148b6b2cb1c5eebaa35` has no workflow run returned by the available commit-run connector. CI therefore remains NOT VERIFIED.


## RC384 — 2026-10-07 — Current production security/observability re-check

- **SECURITY / RLS — VERIFIED structurally:** live Production currently reports **128 public base tables**, all 128 with RLS enabled; exactly **1** RLS-enabled public base table has no policy: `public.digital_page_payment_events`. Supabase Security Advisor independently reports the same single INFO finding. This is intentionally treated as a backend/payment-event fail-closed boundary; no broad policy was added merely to silence the advisor.
- **SECURITY / SECURITY DEFINER — REVIEWED:** Advisor currently reports 1 anonymous and 40 authenticated SECURITY DEFINER functions. The high-risk functions reviewed in this cycle enforce caller identity through `auth.uid()` where applicable; payment-intent claim/finalize/release functions bind the supplied user to `auth.uid()` and the order owner; MantiGO cash/fare functions bind the actor to the authenticated customer; captain earnings/presence and job application functions bind the actor to `auth.uid()`. No new P0 actor-spoofing defect was evidenced by source inspection. Runtime adversarial E2E remains NOT VERIFIED.
- **OBSERVABILITY — PARTIAL → improved evidence:** unified Supabase logs for the last 24h are queryable through `log_attributes`. Current aggregate shows 399 storage warnings, while the principal edge/PostgREST/Postgres streams do not expose a populated top-level error field in the sampled aggregate. This is **not** evidence of zero errors; endpoint-specific error-rate/correlation analysis remains open.
- **CI/CD — NOT VERIFIED:** the repository workflow is configured for push to `main` and manual dispatch and contains the production validation/deploy smoke gates, but the available commit-run connector did not provide a successful run for the latest documentation commits. Therefore CI execution remains unverified rather than assumed.
- **PERFORMANCE ADVISOR — OPEN:** 28 multiple-permissive-policy findings remain, plus unused/unindexed-index findings. No mass policy merge or index changes were made because these can alter authorization semantics or workload performance without measured query plans.
- **PAYMENT / CASH:** `confirm_mantigo_cash_payment_backend` correctly binds the caller to the ride customer and performs idempotent state handling. Real payment/settlement E2E is still WAIT/NOT VERIFIED and was not simulated with real money.


## RC385 — Homepage rebuild / release evidence update — 2026-10-07

- Rebuilt the public homepage presentation layer in `web/home.css` without changing database schema, Supabase RPC contracts, or business data paths.
- Updated `web/index.html` to load `home.css?v=rc385`.
- Added/updated sector rendering validation so the cache contract explicitly checks `home.css?v=rc385`.
- Corrected a validator defect discovered during review: the previous RC385 check incorrectly looked for `home.js?v=rc385`; it now checks the actual changed asset `home.css?v=rc385`.
- GitHub branch: `feat/homepage-rebuild-rc385`; PR #56 remains OPEN and unmerged.
- Latest branch commit after validator correction: `147e288617e9144b423f0ea065862e731afa0ae`.
- Existing GitHub validation runs inspected for the preceding RC385 commit were successful for Module Professionalization Validation and Backend-only Module Boundary.
- No new main Pages deployment run exists for the corrected branch commit because the Pages workflow triggers on `main` push or manual dispatch; the available GitHub connector does not expose workflow dispatch.
- Therefore RC385 status remains **IMPLEMENTED — NOT VERIFIED for production deployment/runtime** until the main Pages workflow validates and deploys the exact release candidate.
- No production database migration, financial transaction, payment, credential rotation, or destructive operation was performed in RC385.
- Final Production Gate remains OPEN.


## RC386 — Live Supabase Security Advisor revalidation — 2026-10-07

- Production project `moyhiluyhjsujhwlyeuu` is ACTIVE_HEALTHY on PostgreSQL 17.6.
- Live structural query: 128/128 public tables have RLS enabled.
- Live Auth query: anonymous user count = 0.
- Live function privilege query: 1 public SECURITY DEFINER function is executable by `anon`; this matches the intentionally public sanitized advertisement projection `get_mnty_targeted_advertisements` already reviewed.
- Current Security Advisor still reports: 1 RLS-enabled table without policy (`public.digital_page_payment_events`), 1 anonymous SECURITY DEFINER warning (the intentional advertisement projection), 40 authenticated SECURITY DEFINER warnings, and leaked-password protection disabled.
- Reviewed representative Advisor `auth_allow_anonymous_sign_ins` findings directly in `pg_policies`: the affected policies are assigned to `authenticated`, not `anon`, and include explicit `auth.jwt()->>'is_anonymous' <> 'true'` guards where applicable. Therefore these findings are not evidence of anonymous-user access in the current project state and must not be mass-rewritten merely to silence Advisor.
- No production mutation was made in RC386. No broad RLS policies were added. No financial/payment operation was executed.
- Leaked-password protection remains a managed Auth setting requiring dashboard/owner action; it is still a release blocker.
- Final Production Gate remains OPEN.


## RC387 — CI / branch verification — 2026-10-07

- Latest RC385 branch documentation head verified as `39bf8aa1ee0aff029f7c6a2e2b0cabb0327ac6b6`.
- GitHub Actions evidence for this head currently contains two completed successful workflows: `Backend-only Module Boundary` run #76 and `Module Professionalization Validation` run #82.
- No GitHub commit statuses are attached to this head.
- The production Pages workflow has not produced a verified deployment result for this head; therefore RC385 homepage production deployment/runtime remains NOT VERIFIED.
- No merge to `main` was performed.


## RC388 — Homepage deployment path correction — 2026-10-07

- Confirmed user-visible homepage had not changed because RC385 remained on feature branch while GitHub Pages deploys from `main`.
- Confirmed RC385 `web/index.html` references `home.css?v=rc385`, and PR #56 contains the homepage CSS rebuild.
- Corrected `.github/workflows/pages.yml` on the feature branch to run validation on pull requests targeting `main`, while keeping actual Pages deployment restricted to pushes on `main`.
- This improves pre-merge evidence without deploying feature branches or granting production deployment on PRs.
- Latest workflow-trigger evidence is not yet available for the new workflow commit; therefore no merge was performed.


## RC390 — تنظيم الشاشة الرئيسية والأزرار — 2026-10-07

- أضيف قسم الإجراءات السريعة لتجميع أهم الإجراءات: البحث، استكشاف القطاعات، إضافة نشاط، والحساب.
- تمت إعادة تنظيم الأولوية البصرية للأزرار والهيدر مع تحسين حالات التركيز والاستجابة للموبايل.
- لم يتم تغيير Backend أو قاعدة البيانات أو الصلاحيات أو APIs.
- PR #57 تم التحقق منه عبر CI بنجاح، ثم دمجه في main بالـcommit 8347ed8bb22da2abf31ad43496406dfa1e355b01.
- Pages workflow بعد الدمج لم يظهر له Run مرتبط بالـmerge commit في أداة GitHub حتى آخر تحقق؛ لذلك نشر النسخة الجديدة على الرابط العام ما زال NOT VERIFIED.


## RC391 — Production baseline revalidation — 2026-10-07

- GitHub main contains RC390 homepage/UI organization and documentation commit e3b55a3476148472798ad15079e0031d3d7d2974.
- GitHub connector still returns no workflow run/status for the post-merge RC390 commits; Pages deployment and public browser runtime therefore remain NOT VERIFIED.
- Production Supabase rechecked: PostgreSQL 17.6; 128/128 public base tables have RLS enabled.
- Security Advisor rechecked: 1 RLS-enabled/no-policy finding (public.digital_page_payment_events), 1 intentional anonymous SECURITY DEFINER endpoint, 40 authenticated SECURITY DEFINER warnings, anonymous-policy warnings requiring contextual review, and leaked-password protection disabled.
- No schema/policy change was made in RC391; no broad permissions were relaxed or added.


## RC392 — E2E fixture readiness recheck — 2026-10-07

- Production currently has 6 Auth users, 2 tenants, 48 ACTIVE memberships, and 0 anonymous users.
- Independent test tenant `MNTY-TEST-B` currently has 2 distinct active users across 3 memberships, with roles CUSTOMER, BUSINESS_OWNER, and SUPER_ADMIN.
- This is materially better than the older baseline that lacked an independent tenant fixture.
- Runtime authorization E2E is still NOT VERIFIED: no authenticated session/token was used or impersonated, and no production data mutation was performed.
- Required E2E remains: authenticated own-tenant access, cross-tenant denial, role separation, customer/provider order boundary, payment boundary, and anonymous denial.


## RC400 — Enterprise Control Center foundation — 2026-10-07

- **DASH-001 Dashboard Inventory:** PASS — تمت مراجعة shell الحالي، workspace routing، RBAC entry points، الموديولات، وملفات الواجهة الأساسية قبل التغيير.
- **DASH-002 Navigation Audit:** PARTIAL — تم تثبيت اتجاه Enterprise Command Center وخريطة الوصول، بينما إعادة تنظيم كل عناصر التنقل ستتم في دفعات لاحقة.
- **DASH-003 Module Inventory:** PASS — تم استخدام قائمة الموديولات الموجودة فعليًا في runtime بدل اختراع قائمة جديدة.
- **DASH-010 RBAC Audit:** PASS للدفعة الحالية — الـCommand Center محمي بـcanSuperAdmin() ولا يغير نموذج الصلاحيات.
- **DASH-011 Tenant Isolation:** NOT VERIFIED E2E — لم يتم إجراء E2E متعدد المستخدمين/المستأجرين في هذه الدفعة.
- **DASH-020 Information Architecture:** PASS — أضيفت طبقات Command Center / KPI / Attention / Quick Actions / Module Map.
- **DASH-040 Executive Dashboard:** PASS — أضيف مركز قيادة فعلي لـSUPER_ADMIN مع أرقام من الحالة التشغيلية المحملة فقط.
- **DASH-041 KPI System:** PARTIAL — المكونات والبيانات الحالية مرتبطة بـlive records/counts؛ مصادر KPI المتقدمة والتاريخية تحتاج توسعة لاحقة.
- **DASH-043 Attention Center:** PASS — يعرض التنبيهات المستخرجة من pending registrations / unread notifications / orders دون بيانات وهمية.
- **DASH-044 Quick Actions:** PASS — إجراءات مرتبطة بمسارات الوحدات الحالية وتحترم صلاحيات فتح الوحدة.
- **DASH-050/051 Global Search:** PARTIAL — تم تنفيذ بحث سريع للموديولات الحالية؛ البحث الموحد عبر جميع الكيانات يحتاج تذكرة مستقلة.
- **DASH-070/071/072 Shared Workspace/Data Table/Record Details:** PARTIAL — البنية الحالية موجودة وقابلة لإعادة الاستخدام، والتوحيد الشامل لم يكتمل بعد.
- **DASH-080 Restaurants:** NOT VERIFIED AS COMPLETE — موديول المطاعم موجود فعليًا في web/restaurant-module.js لكن اكتماله التشغيلي الكامل يبقى ضمن تدقيق الموديولات.
- **DASH-180 Performance:** NOT VERIFIED — لم يتم إجراء قياس workload/query-plan خاص بالـCommand Center في هذه الدفعة.
- **DASH-190..203 QA/Production:** CI validation PASS؛ Production browser runtime للـPR لم يُعتبر دليلًا على إطلاق main، لأن deploy job كان PR-skipped.

### Implementation evidence
- PR #58 merged safely via squash.
- Merge commit: 853718963c405adf24d67b9932b4cc6be9cf9eb2.
- Head validation commit: 6f2ec020f89bba6ffbc666d052107c2f5e6c4f2e.
- Module Professionalization Validation #109: SUCCESS.
- Backend-only Module Boundary #103: SUCCESS.
- Deploy workflow #1922 validate job: SUCCESS; deploy job SKIPPED because PR context.
- No Database/RLS/RPC/Edge Function changes were introduced by RC400.
- A CI preflight failure exposed a landing-shell asset regression caused by an unsafe cache-busting replacement; it was corrected before merge and the corrected head passed the full validation job.

### What remains for Enterprise Control Center
1. DASH-050 full entity-aware global search.
2. DASH-060 role-specific dashboards beyond SUPER_ADMIN.
3. DASH-070 reusable workspace standardization across modules.
4. DASH-080 restaurant workspace completion audit and implementation gaps.
5. DASH-090 CRM, DASH-100 Marketing, DASH-110 Operations, DASH-120 Finance workspaces.
6. DASH-140 Notification/Task/Attention unification.
7. DASH-150 Reporting/Analytics framework.
8. DASH-160 System Health/Security Center.
9. DASH-170 responsive/accessibility deep verification.
10. DASH-180 performance evidence.
11. DASH-190+ E2E/RBAC/Tenant/production smoke verification.
12. Actual GitHub Pages production deploy verification after the merged main commit.


## RC410 — Role-specific Command Centers — 2026-10-07

- **DASH-060 Role Dashboard Architecture:** PASS — تم فصل Command Center حسب الدور باستخدام RBAC الحالي دون إنشاء نظام صلاحيات جديد.
- **Role-specific dashboards:** PASS — Finance, Marketing, Sales, Support, Provider Finance/Marketing/Operations/Support, Owner, Business Owner, Provider Owner, Admin, Manager, Employee, Staff, Branch Manager, Service Provider.
- **Data integrity:** PASS — المؤشرات تعتمد على live.records/live.counts الموجودة أصلًا؛ لا توجد أرقام تجريبية.
- **Authorization:** PASS للواجهة — فتح الوحدات يمر عبر MNTY_RBAC.can، والتحقق النهائي يظل RLS/RPC/Edge.
- **Tenant isolation E2E:** NOT VERIFIED — لم يتم إنشاء جلسات مستخدمين متعددة أو إجراء mutation إنتاجي.
- **CI:** Module Professionalization #119 SUCCESS؛ Backend-only Boundary #113 SUCCESS؛ Deploy #1926 validation SUCCESS، مع بقاء deploy الفعلي مرتبطًا بسياق main بعد الدمج.
- **PR:** #59 merged; merge commit `ce4628cbad7f5e9f0c67d96ab479fef6f1d8cb43`.

### What remains
1. DASH-050 entity-aware Global Search.
2. DASH-070 shared Module Workspace/Data Table/Record Details standardization.
3. DASH-080 Restaurant workspace audit/completion.
4. CRM / Marketing / Operations / Finance deep workspaces.
5. Notification/Task/Audit unification.
6. Reports/Analytics and System Health.
7. Responsive/accessibility/performance evidence.
8. Multi-user RBAC/RLS/Tenant E2E.
9. Post-merge GitHub Pages runtime verification.


## RC420 — Global Entity Search — 2026-10-07

- **DASH-050 Global Search Architecture:** PASS — تم تحويل البحث من أسماء الموديولات إلى كيانات فعلية.
- **DASH-051 Search UX:** PASS — autocomplete-like dropdown، debounce، loading، empty state، Enter/Escape، responsive results.
- **Entities:** PASS — businesses, provider profiles, orders, marketing services, catalog items, marketing leads, marketing projects, support tickets, advertisements, jobs.
- **Authorization:** PASS للواجهة — مصادر البحث تُرشح عبر RBAC قبل الاستعلام، والاستعلامات تستخدم جلسة Supabase الحالية.
- **Tenant isolation:** PASS by design / NOT VERIFIED E2E — لم يتم تجاوز RLS أو تمرير tenant_id من العميل لتوسيع النطاق؛ اختبار مستخدمين متعددين ما زال مطلوبًا.
- **Sensitive data:** PASS — البحث لا يطلب auth.users أو كلمات مرور أو مفاتيح أو بيانات دفع حساسة.
- **Database changes:** NONE — تم استخدام الجداول الحالية؛ لا migrations/RPC/Edge Functions.
- **Production schema inspection:** تم التحقق من الأعمدة المطلوبة في Supabase Production قبل التنفيذ.
- **CI:** Backend-only Boundary #122 SUCCESS; Module Professionalization #128 SUCCESS; Deploy #1929 validation SUCCESS; actual deploy step SKIPPED because run originated from PR.
- **PR:** #60 merged; merge commit `d94b35f0d0221331679df821c8b6045e76a948f2`.

### What remains
1. DASH-070 — توحيد Module Workspace / Data Table / Record Details.
2. DASH-080 — تدقيق واستكمال Restaurant Workspace.
3. DASH-090/100/110/120 — CRM / Marketing / Operations / Finance deep workspaces.
4. DASH-140 — Notification + Task + Attention unification.
5. DASH-150 — Reporting/Analytics framework.
6. DASH-160 — System Health/Security Center.
7. DASH-170/180 — Responsive/accessibility/performance evidence.
8. DASH-190+ — multi-user RBAC/RLS/Tenant E2E.
9. Post-merge GitHub Pages runtime verification.


## RC430 — Unified Module Workspace Data Layer — 2026-10-07

- **DASH-070 Reusable Module Workspace:** PASS — تم تقوية الطبقة المشتركة الحالية بدل إنشاء طبقات متكررة.
- **DASH-071 Data Table System:** PASS — كل مستهلكي `recordsTable` أصبح لديهم بحث عربي، pagination بمعدل 12 سجل/صفحة، فرز للأعمدة، ودعم لوحة المفاتيح.
- **DASH-072 Record Details System:** PARTIAL — أنظمة التفاصيل الحالية موجودة في الطلبات والتذاكر وCRM، لكنها لم تُوحّد بعد في مكوّن تفاصيل واحد.
- **Responsive:** PASS على مستوى طبقة الجدول، مع تحسين mobile للـpager/search.
- **Accessibility:** PASS جزئي — رؤوس الفرز قابلة للوحة المفاتيح و`aria-sort`؛ المراجعة الشاملة ما زالت مطلوبة.
- **Database/RLS/RPC/Edge:** NONE — لا تغييرات backend.
- **CI:** Module Professionalization #135 SUCCESS; Backend-only Boundary #129 SUCCESS; Deploy #1932 validation SUCCESS; deploy job SKIPPED because PR context.
- **PR:** #61 merged; merge commit `dade94890c4aeaf51181fcbce006f4fdfe2e899d`.

### What remains
1. DASH-072 — توحيد Record Details/Side Panel كطبقة مشتركة.
2. DASH-080 — Restaurant Workspace audit/completion.
3. DASH-090/100/110/120 — CRM / Marketing / Operations / Finance deep workspaces.
4. DASH-140 — Notification + Task + Attention unification.
5. DASH-150 — Reporting/Analytics framework.
6. DASH-160 — System Health/Security Center.
7. DASH-170/180 — full responsive/accessibility/performance evidence.
8. DASH-190+ — multi-user RBAC/RLS/Tenant E2E.
9. Post-merge GitHub Pages runtime verification.

## RC450 — Restaurant Workspace (DASH-080)
- Status: **PASS for implementation + CI**; production browser/runtime and multi-user tenant E2E remain **NOT VERIFIED**.
- Implemented on existing restaurant tables with existing RLS; no schema/RPC/Edge/policy changes.
- Workspace uses tenant/business/branch scoping where available, real menu/order/table/inventory data, reusable records table, pagination/search/sort, and unified record details.
- PR #63 merged safely after fixing a pre-existing regression in `openLeadDetails` where an async database call had lost the `async` function declaration.
- CI after fix: Module Professionalization #160 SUCCESS; Backend-only Module Boundary #154 SUCCESS; Deploy validation #1942 SUCCESS.

## RC460 — Unified CRM Workspace (DASH-090)
- Status: **PASS for implementation + CI**; production browser/runtime and multi-user tenant E2E remain **NOT VERIFIED**.
- Built on existing RLS-backed `marketing_leads`, `support_tickets`, `ticket_messages`, and notifications data.
- Added unified CRM KPIs, real-data lead/ticket tables, permission-aware actions, and existing secure lead/ticket detail flows.
- No schema, RPC, Edge Function, or RLS policy changes.
- PR #64 merged safely; merge commit: `1bd45e7e1d0de14b52d5a99051a77010908c054d`.
- CI: Module Professionalization #164 SUCCESS; Backend-only Module Boundary #158 SUCCESS; Deploy validation #1944 SUCCESS.

### Current dashboard continuation after RC460
- Next implementation target: **DASH-100 Marketing Workspace** and deeper CRM/security regression coverage.
- Then DASH-110 Operations, DASH-120 Finance, DASH-140 Notifications/Tasks, DASH-150 Reporting/Analytics, DASH-160 System Health/Security.
- Remaining cross-cutting gates: responsive/accessibility/performance evidence, multi-user RBAC/RLS/tenant E2E, public Pages runtime verification, release/device gates, payment/finance E2E, and remaining production security-advisor findings.

## RC470 — Marketing Workspace (DASH-100)
- Status: **PASS for implementation + CI**; production browser/runtime and end-to-end marketing/RBAC tenant verification remain **NOT VERIFIED**.
- Upgraded the existing marketing area into a real-data operational workspace covering leads, projects, advertisements, marketing providers, and active marketing services.
- Added calculated KPIs only from available records: active/pending ads, verified providers, project count/value.
- Added unified record-detail access for marketing entities and retained existing booking/admin actions.
- No schema, RPC, Edge Function, or RLS policy changes.
- PR #65 merged safely; merge commit: `3e007a52cb2e2fde934ce5a9623efd253644a07e`.
- CI after correction: Backend-only Module Boundary #165 SUCCESS; Module Professionalization #171 SUCCESS; Deploy validation #1948 SUCCESS.

## RC480 — Operations Command Workspace (DASH-110)
- Status: **PASS for implementation + CI**; production browser/runtime and multi-user tenant E2E remain **NOT VERIFIED**.
- Upgraded the existing orders area into an operational command workspace using existing `orders`, `order_status_history`, and `notifications` data.
- Added real status KPIs, status distribution, visible-value context with explicit non-revenue wording, operational navigation, and existing order actions.
- No schema, RPC, Edge Function, or RLS policy changes.
- PR #66 merged safely; merge commit: `72267c03cea5cb9a04b4a1023508945566911b22`.
- CI: Module Professionalization #176 SUCCESS; Backend-only Module Boundary #170 SUCCESS; Deploy validation #1951 SUCCESS.

## RC490 — Finance Control Workspace (DASH-120)
- Status: **PASS for implementation + CI**; production financial E2E remains **NOT VERIFIED** and no real-money transaction was performed.
- Added a tenant-scoped Finance Control Workspace over existing `journal_entries`, `commission_transactions`, `payment_intents`, `payment_financial_reconciliations`, `settlement_transactions`, and `wallet_accounts`.
- Financial counts are loaded only for approved finance roles and remain subject to existing RLS.
- Existing financial posting remains behind the current `post-financial-journal` Edge Function; no direct journal mutation was added.
- No schema, RPC, Edge Function, or RLS policy changes.
- PR #67 merged safely; merge commit: `b28490372941f41bac14df67784bcc90a33e9cc5`.
- CI: Module Professionalization #181 SUCCESS; Backend-only Module Boundary #175 SUCCESS; Deploy validation #1954 SUCCESS.

## RC500 — Unified Attention Center (DASH-140/142)
- Status: **PASS for implementation + CI**; production runtime and multi-user authorization E2E remain **NOT VERIFIED**.
- Added a unified attention queue over real unread notifications, active orders, open support tickets, and open marketing leads.
- Actions route to existing authorized handlers; no new mutation authority was introduced.
- Governance action bindings were hardened to data attributes after CI caught fragile inline quote escaping.
- Tasks are explicitly **NOT AVAILABLE** as an authoritative source because no real `tasks` table/source was identified; no synthetic tasks were created.
- No schema, RPC, Edge Function, or RLS policy changes.
- PR #68 merged safely; merge commit: `2237ee769dc7321ee90bec21fae14ded40f0c22e`.
- CI: Module Professionalization #188 SUCCESS; Backend-only Module Boundary #182 SUCCESS; Deploy validation #1958 SUCCESS.

## RC510 — Real-Data Analytics Workspace (DASH-150/151)
- Status: **PASS for implementation + CI**; production analytics validation remains **NOT VERIFIED**.
- Replaced the placeholder analytics cards with traceable operational metrics from loaded `orders`, `marketing_leads`, `marketing_provider_profiles`, `marketing_projects`, `advertisements`, and `notifications`.
- Explicitly labels metrics as loaded-record/sample metrics and does not present them as historical totals unless the source is comprehensive.
- Added operational delivery/cancellation rates only when the loaded order sample is non-empty.
- Revenue remains behind the Finance boundary; order value is explicitly not treated as total revenue.
- No schema, RPC, Edge Function, or RLS policy changes.
- PR #69 merged safely; merge commit: `a53f61ed0e714118d8c7bb154ddd87ae8e75d085`.
- CI: Module Professionalization #193 SUCCESS; Backend-only Module Boundary #187 SUCCESS; Deploy validation #1961 SUCCESS.

## RC520 — System Health & Security Center (DASH-160/161)
- Status: **PASS for implementation + CI**; production runtime verification and final security remediation remain **NOT VERIFIED / OPEN**.
- Added a Super Admin-only System Health & Security Center with conservative release-gate states.
- Current security view preserves the live Security Advisor findings: 1 intentional RLS-enabled/no-policy table, 1 anonymous SECURITY DEFINER warning, and 40 authenticated SECURITY DEFINER warnings requiring individual review.
- Explicitly shows Anonymous Users = 0 from the production check.
- Does not expose secrets, API keys, service-role credentials, or internal sensitive payloads.
- Does not convert missing evidence into PASS; public runtime, payment E2E, tenant E2E, and device/release gates remain unverified/waiting.
- No schema, RPC, Edge Function, or RLS policy changes.
- PR #70 merged safely; merge commit: `edfad28dc991022a119462578761951965e8cf37`.
- CI: Module Professionalization #198 SUCCESS; Backend-only Module Boundary #192 SUCCESS; Deploy validation #1964 SUCCESS.

## RC530 — Production Invariants Verification
- Status: **PASS for read-only production invariants**.
- Verified directly against Production Supabase with a corrected expectation for `create_payment_intent_backend`: it is intentionally executable by `authenticated` for the user-scoped payment path, while remaining non-executable by `anon`; this is documented in the authorization/payment evidence.
- Verified `upsert_catalog_settings_backend` backend privilege boundary.
- Verified referral privileged functions are not executable by `anon` or `authenticated`.
- Verified RLS and FORCE RLS on `orders`, `payment_intents`, `financial_obligations`, and `payout_destinations`.
- Verified `process_verified_provider_payment` contains the required pricing/provider/replay mismatch guards.
- Verified `trg_orders_financial_lock` exists.
- No production data was mutated and no real payment was executed.
- Note: the historical RC40 `supabase/tests/production_invariants.sql` expectation for `create_payment_intent_backend` is stale relative to the current documented architecture; production behavior itself was verified with the corrected invariant.

## RC540 — Production Tenant/RLS Gate Review
- Status: **PARTIAL / NOT VERIFIED E2E**.
- Production currently contains two active tenant contexts: `MNTY-PLATFORM` (10 distinct active users / 45 memberships) and `MNTY-TEST-B` (2 distinct active users / 3 memberships).
- Active role coverage includes customer, provider/business roles, management, support, finance-related and platform administration roles.
- Production auth snapshot: 6 auth users, 5 confirmed, 0 anonymous.
- RLS no-policy inventory remains exactly one table: `public.digital_page_payment_events`, intentionally backend/payment-event scoped.
- This evidence proves that independent test identities and multi-tenant fixtures exist, but it does **not** prove cross-tenant denial or role separation at runtime because no authenticated sessions were used in this verification pass.
- No credentials were extracted, no user session was impersonated, and no production mutation was performed.
- Final runtime E2E remains a release gate requiring owner-approved test identities/sessions.

## RC550 — Order Lifecycle Production Gate Review
- Status: **PARTIAL / IMPLEMENTED — NOT VERIFIED E2E**.
- Production `orders`, `order_status_history`, and `notifications` all have RLS enabled and active policy coverage.
- Backend-only order boundaries are confirmed: `create_order_backend` and `update_order_status_backend` are not executable by `anon` or `authenticated` directly; the application uses the controlled server/Edge path.
- `mark_notifications_read_backend` is authenticated-only and remains authorization-gated.
- Production triggers verified:
  - order creation → server-side notification
  - order status update → server-side notification
  - order status history insert → server-side notification
  - financial lock after payment
  - legal order insert gate
- Critical payment/order Edge Function source↔Production parity was previously verified byte-for-byte for `order-create` and `order-status-update`.
- No order was created, mutated, cancelled, delivered, or financially settled during this verification pass.
- Customer → Provider → Order → Status → Notification runtime E2E remains open until approved independent test identities/sessions are available.

## RC550 — Production Order Lifecycle Boundary Verification — 2026-10-07

### Result
- **Order creation path:** VERIFIED at source + Production Edge Function metadata.
- **Order status path:** VERIFIED at source + Production Edge Function metadata.
- **Pricing authority:** VERIFIED server-side; client-supplied totals are not trusted by `create_order_backend`.
- **Identity binding:** VERIFIED; `auth.uid()` must match the customer/user passed to backend RPCs.
- **Tenant/business binding:** VERIFIED in `create_order_backend`; business, catalog, branch and pricing records are checked against the requested tenant/business.
- **Status authorization:** VERIFIED in `update_order_status_backend`; customer may cancel own order, while provider/business roles are constrained by tenant/business scope and allowed state transitions.
- **Paid-order cancellation protection:** VERIFIED; successful payment blocks cancellation until refund path is handled.
- **Anonymous direct RPC access:** VERIFIED DENIED.
- **Authenticated direct RPC access:** VERIFIED DENIED; privileged mutation is exposed through the authenticated Edge Function boundary using service-role internally.
- **Orders RLS:** VERIFIED enabled + FORCE RLS.
- **Order notification triggers:** VERIFIED for order creation and status-history/status-change notification paths.
- **No production order/payment mutation was performed.**

### Current gate
**DASH-110 / order lifecycle security boundary: PASS for static + production invariant verification.**

### Still NOT VERIFIED
1. Real authenticated customer → provider order E2E.
2. Provider-only visibility across two businesses/tenants.
3. Real status transition → notification delivery/click-through.
4. Finance/payment E2E after successful payment.
5. Cross-tenant denial using two independent authenticated sessions.

This checkpoint does not close the production release gate because runtime E2E evidence is still required.



## RC440 — Unified Record Details / Side Panel — 2026-10-07
- DASH-072: **IMPLEMENTED / PARTIAL verification**.
- Consolidated CRM lead, order, support-ticket, and restaurant record details into the reusable RTL-aware Record Details / Side Panel layer.
- Preserved existing data-loading and authorization paths; no database, RPC, Edge Function, or RLS changes.
- PR #62 merged with squash; merge commit: `710daf2d37b5d8e068edab13e17cebbd336d8556`.
- CI status for the RC440 head was not exposed by the workflow connector; therefore CI is **NOT VERIFIED** rather than PASS.

## RC450 — Restaurant Workspace Audit & CRM Action Boundary — 2026-10-07
- DASH-080: **PARTIAL / IMPLEMENTED**.
- Existing restaurant workspace was verified against Production Supabase schema: `restaurant_menu_items`, `restaurant_orders`, `restaurant_tables`, `restaurant_inventory` all exist with tenant/business/branch fields.
- Production RLS policies were inspected for all four restaurant tables; access is constrained by authenticated-session guards plus tenant/business/branch membership and owner/platform-admin policies.
- Hardened the workspace so read failures are shown explicitly as **NOT AVAILABLE** instead of silently becoming healthy-looking empty tables.
- Added per-source status cards and preserved unified Record Details behavior.
- Tightened CRM/support action visibility and runtime guards to use the existing `MNTY_RBAC.can(...)` contract rather than a hard-coded role list for create/update actions.
- No schema, RPC, Edge Function, or RLS changes.
- PR #71 merged with squash; merge commit: `946d88f4fc12caed988a7a1bc3dda5cfcc481c9a`.
- PR-head CI evidence: Deploy MantiqatiX Web, Backend-only Module Boundary, and Module Professionalization Validation all completed successfully for `c7b9f34a0b639daee42a5b0502b4fd7c39e30e44`.
- Post-merge Production Health Monitor completed successfully for the merge commit.
- Post-merge GitHub Pages deployment was queued at checkpoint time; production deploy success is not recorded in this entry until the run completes.

### RC450 remaining
1. Confirm post-merge GitHub Pages deployment and deployed-site smoke verification.
2. Perform authenticated Restaurant E2E with owner/manager/provider identities.
3. Verify cross-tenant and cross-branch denial with independent sessions.
4. Verify restaurant order/status/payment boundaries before production release.
5. Continue CRM deep workspace and notification/task unification.
6. Do not close P0 production release gates based on static CI alone.


## Production evidence update — 2026-10-09
- Main commit `569f1245fcd57ab50f30abcb08599409e483392a` includes RC450 restaurant/CRM RBAC regression validator; Module Professionalization Validation and Backend-only Module Boundary checks passed.
- GitHub Pages deployment and automated deployed-site verification passed (run 37861633528); Production Health Monitor passed (run 37861633606).
- Read-only live RLS spot-check confirmed the four restaurant tables listed above and `user_memberships` have RLS enabled and policy counts present.
- Privileged digital-page payment processor remains non-executable by `anon` and `authenticated` in the live grant check; no payment transaction was generated.
- Release gate remains OPEN until real authenticated cross-tenant tests, customer/provider order + notification E2E, Paymob payment E2E, finance settlement E2E, leaked-password protection owner action, and release-device tests have evidence.


## Session update — 2026-10-11 — Release blockers and continuity
- [x] Added append-only cross-session record: `docs/SESSION_LOG.md`; continuation instructions in `docs/PROJECT_CONTINUITY.md`.
- [x] Confirmed main HEAD: `735f0451bf6dae9ed8cf681f83c4856a4b029041` (stale Pages deployment cancellation only; not a release fix).
- [ ] BLOCKED: production gate run [38108142127](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38108142127) failed closed; deployment skipped.
- [ ] BLOCKED: reconcile absent migration sources RC425–432 and RC434–441; production ledger currently ends at `20261008222845` (RC424). RC434 has conflicting definitions in PR #202 and PR #84; preserve the collision guard.
- [ ] BLOCKED: restore missing CI scripts `scripts/validate-smm-payment-safety.mjs` and `scripts/test-checkout-secret-crypto.mjs` only from authoritative contracts/source; a prior write attempt was rejected and did not add the crypto test.
- [ ] BLOCKED: live deployed payment/SMM function source does not converge with candidate branches; RC439 encrypted subscription checkout path is not deployed and required columns are absent in live schema.
- [ ] BLOCKED: SMM gateway needs global admin authorization correction, bounded provider requests, safe ambiguous-provider handling, checked persistence, and terminal status guards with regression tests.
- [ ] BLOCKED: Supabase Auth leaked-password protection and scoped SECURITY DEFINER/RLS review remain release security items.
- [ ] No production mutation/deployment/PR merge was performed in this session; no release readiness claim is made.
- **Rule:** update `docs/SESSION_LOG.md` after every material execution batch and keep this TODO/continuity snapshot current. DONE ≠ VERIFIED.

## 2026-10-17 — consolidated exact-head CI PASS; full replay still blocked

- [x] Consolidated RC449 → RC462 → RC565 disposable PostgreSQL workflow passed on PR #282 head `6e4a3bfc6399691dc77b726f53690841888ad08f`. The static platform-admin/financial-report contracts and all PostgreSQL authorization + report behavior tests completed successfully.
- [x] Exact-head checks passed: MantiGO Platform Admin Scope Hardening (run [38993296764](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296764)), migration version uniqueness ([38993296753](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296753)), migration history immutability ([38993296748](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296748)), cross-PR migration collision guard ([38993296745](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296745)), module-professionalization ([38993296752](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296752)), MantiGO open-ride privacy ([38993296765](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296765)), backend-only module boundary ([38993296743](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296743)), approval-action audit atomicity ([38993296815](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296815)), and web validation ([38993296776](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993296776)). Web deploy job was skipped; no production deployment occurred.
- [x] RC565 PostgreSQL regression verified canonical ledger columns despite conflicting legacy aliases, half-open date boundaries, paid/settled/unsettled totals, empty ranges, invalid windows, tenant OWNER denial, and actor identity mismatch.
- [x] RC462 PostgreSQL regression verified malformed/string/false permission values fail closed while explicit JSON Boolean true continues to authorize platform admin; all four high-risk platform RPCs were exercised.
- [x] Forward replay from the captured Production schema checkpoint passed in [run 40494929976](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40494929976); 52 post-checkpoint migrations applied in order and tenant-isolation checks passed. The checkpoint begins at `20261008222845`, so this proves the forward chain from that checkpoint—not a fresh install or pre-checkpoint migration provenance.
- [ ] BLOCKED: PR #282 remains draft and unmerged; production is still on RC424 (283 migrations through `20261008222845`). Do not deploy RC449/RC462/RC565 or claim production certification until historical replay is resolved, reviewed, and explicitly approved.
- Overall state: **focused security/report tests PASS; production release BLOCKED / NOT CERTIFIED**.


## Replay blocker investigation — authoritative live definition found, migration provenance still missing

- [x] Read-only query against live Supabase catalog recovered the exact current definition of `public.counter_offer_indrive_bid(uuid,uuid,numeric)`: returns `void`, SECURITY DEFINER, currently `SET search_path TO 'public'`, validates authenticated/non-anonymous caller and non-negative price, and updates only a bid belonging to the caller's editable request.
- [x] Read-only query of `supabase_migrations.schema_migrations` for recorded migration statements containing `counter_offer_indrive_bid` returned zero rows. GitHub source search also found only the later revoke migration and documentation references, not the original creation DDL.
- [ ] Pre-checkpoint migration provenance for this function remains a separate historical question; do not invent a new historical migration. It is no longer blocking the verified post-checkpoint forward replay, and Production application of required release migrations remains unproven.
- No production writes were made during these checks.


## 2026-10-17 — schema baseline and RC434 evidence correction

- [x] Captured a schema-only production baseline and provenance ledger via read-only workflow [38993809648](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993809648); 283 migration versions through `20261008222845`, no data rows and no production mutation.
- [x] Opened Draft PR [#284](https://github.com/islamnagy2022-eng/MantiqatiX/pull/284) with manifest, snapshot, ledger list, and fail-closed static audit. Audit [38995239972](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38995239972) passed: 128/128 public tables have RLS enabled; 485 policy declarations; 145 parsed SECURITY DEFINER functions have explicit search_path and PUBLIC revoke. Related validation/privacy/backend-boundary checks passed; deploy was skipped.
- [ ] REVIEW REQUIRED: manifest stays `PENDING_REVIEW`. Static checks do not establish policy correctness, tenant isolation, function authorization, full replay, or production readiness. Do not merge/use baseline until review and disposable replay pass.
- [x] RC434 source comparison at current PR #202, #84, and #282 heads now shows the exact same blob SHA `a93a0a6827de15d50632e1deec015e20dd55b405`; update supersedes the earlier current-head conflict claim. Keep collision guard because older revisions may differ.
- [ ] BLOCKED: RC434's line-level purchase quantity limits/dependencies must be reviewed with RC437/RC438 in order. Missing RC425–RC432 and RC434–RC441 source files remain on main.
- [ ] BLOCKED: authoritative historical creation migration/version for `public.counter_offer_indrive_bid(uuid,uuid,numeric)` remains missing. The current schema snapshot contains the live definition but does not establish historical provenance.
- [ ] BLOCKED: PR #282 remains Draft/unmerged until full chronological disposable replay, tenant isolation, payment/finance E2E, and backup/restore gates pass. Production remains unchanged and release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-18 — Marketing workspace implementation update

- [x] Ported the tabbed agency workspace and campaign planning UI onto the current main baseline in Draft PR [#292](https://github.com/islamnagy2022-eng/MantiqaTiX/pull/292).
- [x] Campaign and participant writes use RC453 backend RPCs; no direct browser table mutations.
- [x] Added a fail-safe for missing RC453 campaign tables so production continues to show the existing marketing workspace with an explicit rollout notice rather than a broken create form.
- [x] Dedicated contract CI passed on its tested head: [run 39091349054](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091349054).
- [ ] Full Pages CI and exact final PR head: pending verification; do not infer PASS from the dedicated contract workflow.
- [ ] Production campaign create/invite/status E2E: WAIT — RC453 migration chain is not applied to production.
- [ ] External Meta/TikTok/Google publication: NOT IMPLEMENTED/NOT CONNECTED; UI must not claim external campaigns were published.
- Overall release: **BLOCKED / NOT CERTIFIED**.


## 2026-10-18 — marketing workspace merged; production parity blockers reconfirmed

- [x] Merged guarded marketing/agency workspace PR [#292](https://github.com/islamnagy2022-eng/MantiqaTiX/pull/292) as commit `bd08e8436ba16a5a84c0c0cfd5e346591b364bb7`. The main-branch app, index, service worker, and validation scripts were confirmed byte-identical to the tested branch.
- [x] Exact tested PR head `7b6757830907c6843eadbcec5425bbd1da8b67b4`: Marketing Workspace Contract [run 39091702890](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091702890) PASS; Pages validation [run 39091702881](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091702881) PASS; backend-only boundary [run 39091702874](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091702874) PASS including approval-audit and RC450 financial-journal isolated PostgreSQL jobs; MantiGO privacy [run 39091702897](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091702897) PASS; module professionalization [run 39091702887](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39091702887) PASS including matrimony privacy and targeted-ad search-path integration.
- [x] PWA cache advanced to `mnty-web-v129`; exact versioned app entrypoint and Supabase SDK are precached. Marketing campaign reads are scoped to the active business, missing business scope fails closed, and campaign mutations are disabled when campaign data sources fail.
- [ ] **Deployment verification remains pending.** The Pages workflow on the PR passed validation and skipped its deploy job as expected for a pull request. Do not claim the main-branch Pages deployment is live until the main push workflow/deployed URL is independently verified.
- [x] Merged security-review documentation PR [#291](https://github.com/islamnagy2022-eng/MantiqaTiX/pull/291), commit `cf522740e9dd058c28728ba582e347661ef24122`. Read-only live catalog review records the targeted-ad RPC RC451 mismatch and the financial-journal Edge Function drift.
- [x] Bounded live Edge Function entrypoint parity check: 24 unique active functions sampled, 23 `index.ts` files byte-identical to repository main, one mismatch (`financial-journal`). This is not full deployment certification.
- [ ] **Financial journal production blocker:** live Edge Function v3 calls legacy `post_financial_journal` without a verified actor ID; live ACL checks show `service_role` cannot EXECUTE either `post_financial_journal` or `post_financial_journal_backend`. Repository source uses actor-bound `post_financial_journal_backend`. Do not grant service-role access to the legacy RPC as a shortcut; resolve the migration chain and deploy the reviewed source/RPC contract together.
- [ ] Production Supabase remains at RC424 (283 migration versions through `20261008222845`). RC453 campaign tables/RPCs are not deployed; the live campaign UI therefore falls back to the existing marketing workspace.
- No manual production DDL/DML, grants/RLS/Auth changes, Edge Function replacement, payment, wallet write, or settlement was performed. A main-branch push workflow may run after the merge, but its deployment result was not independently observed in this session.
- Overall release: **BLOCKED / NOT CERTIFIED** until historical migration provenance, chronological release execution, live finance/payment E2E, tenant-policy parity, backup/restore, Auth settings, and deployment verification are completed.


## 2026-10-18 — expanded Edge Function parity and Auth Advisor refresh

- [x] Expanded live-versus-main Edge Function entrypoint checks to 29 unique active functions: 27 exact matches, two drifted entrypoints.
- [ ] BLOCKED: `financial-journal` live v3 calls the legacy RPC and service_role lacks EXECUTE; repository source is corrected, but RC450/RC449A and the chronological migration chain are not deployed.
- [ ] BLOCKED: `mnty-customer-registration` live v4 uses `ensure_customer_membership_for_user`, while repository source uses `activate_customer_registration_atomic`. The RPCs intentionally differ; do not deploy either source blindly. Complete the existing acceptance matrix for concurrency, pending-request cleanup, audit failure, and auth.users-trigger behavior first.
- [ ] Auth Advisor still warns that anonymous sign-ins are enabled and leaked-password protection is not enabled. Confirm the anonymous-session product contract, then enable leaked-password protection via Supabase Auth settings and verify. No Auth settings were changed because the connected tools do not expose an Auth-settings mutation operation.
- [ ] Security Advisor still reports the policy-less RLS table, public targeted-ad SECURITY DEFINER, and 40 authenticated-executable SECURITY DEFINER entries; per-function review remains open.
- Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-18 — RC431 live payment RPC mismatch

- [x] Read-only catalog comparison confirmed the live `process_verified_digital_page_payment_backend` still has RC424's `search_path=public, pg_temp` and body.
- [ ] BLOCKED: live RPC lacks RC431 provider-order binding, provider-transaction/event-ID binding, NULL-status rejection, conflicting replay-status rejection, and event-ID advisory serialization. Current code records `provider_order_id` but does not validate it against the order's existing provider-order binding.
- [x] PR #286 contains RC431 hardening and disposable PostgreSQL tests for these negative cases; comment added with exact live/source differences.
- [ ] Do not apply RC431 alone out of order. Complete the reviewed RC425–RC441 chronological chain, rehearsal, backup/restore, and payment sandbox acceptance before any production migration.
- Payment/webhook integrity remains **NOT VERIFIED**; production release remains **BLOCKED / NOT CERTIFIED**.


### ERP purchase receiving — 2026-10-21
- [x] Edge Function now delegates all receipt, stock-balance, inventory-ledger, and purchase-line mutation to the line-aware atomic RPC; removed direct multi-request mutation.
- [x] Added strict request validation and safe error handling; missing/unavailable RPC fails closed with HTTP 503.
- [x] Updated contract validator to assert the atomic RPC boundary.
- [x] Required source files for RC425–RC432 and RC434–RC441 are available, and the full post-checkpoint chain passed isolated chronological replay in run 40494929976. A read-only LEFT JOIN now covers all 34 exact versions required by the current verifier and shows 0/34 recorded; RC449A/RC450 and RC451 schema/grant/search_path checks are also blocked. Reconcile current live-schema drift and plan/approve a guarded rollout before any Production apply. Do not cherry-pick RC434 alone or bypass collision guard.
- [ ] Resolve legacy approved purchase orders without modeled lines before receiving can be production-ready.
- [ ] Run Postgres integration tests for atomic rollback, concurrent duplicate receipt, over-receiving, tenant/business isolation, and service-role-only function grants.
- [ ] Await CI for commit `82a5c17e588abf0d8452397a4c0a4d055c2204bb`; the production gate remains BLOCKED / NOT CERTIFIED.


### RC434 source provenance check — 2026-10-21
- [x] Compared the GitHub blob SHA for `20261009200000_rc434_atomic_erp_purchase_receiving.sql` across draft PR heads #271, #273, #282, and #286. All four resolve to the same blob SHA `a93a0a6827de15d50632e1deec015e20dd55b405` (6,968 bytes); no divergence was observed for RC434 itself.
- [x] The post-checkpoint forward migration chain subsequently replayed successfully in isolation in run 40494929976. This does not prove the chain was applied to Production or replace payment/finance and release acceptance tests.
- [ ] The four branches are still drafts and overlap on migration files; do not merge them together or bypass the open-PR migration collision guard.
- [ ] Continue validating RC434 against the RC437 line-aware wrapper, actual table constraints, receipt replay semantics, and transaction rollback/concurrency integration tests before release.


### Central Location Service — incremental implementation — 2026-10-22
- [x] Reuse the established `web/location-adapter.js` and preserve the `MNTYLocationAdapter` global; do not introduce a duplicate GPS engine.
- [x] Add validated manual coordinate selection and explicit location reset.
- [x] Add shared coordinate validation, straight-line distance validation, and point-in-polygon checks for GeoJSON Polygon / ring inputs.
- [x] Preserve the existing 1/3/5/10 km range contract and backend proximity RPC boundary.
- [x] Add `scripts/validate-location-service.mjs` and wire it into the Pages validation workflow.
- [x] Document current capabilities and limitations in `docs/CENTRAL_LOCATION_SERVICE.md`.
- [x] Exact-head CI passed the central location contract on PR #342; merge commit `11d035ab848c948c7a021d1f33f4a27c9b26b8d6` includes the validator in Pages workflow.
- [x] PR #343 added mocked GPS-denial and stale-callback race tests; all four PR CI workflows and three push workflows passed for head `887af86a919879744470e7b906d2a8fa15aa49ec`; merged as `fdf69114e7235f50c25c0df35ffb4b58aedff408`.
- [ ] Re-run and independently verify the latest main-branch Pages deployment after the location-service merges; do not infer deployment success from PR CI alone.
- [x] Verified main-branch Deploy MantiqatiX Web run [39742731869](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39742731869) for commit `c96da6959e7d66a7920164eb9e8bb6e6c5667012`: validation reached the production verification engine, reported `PRODUCTION_GATE=BLOCKED`, and skipped deployment. This is not evidence of a successful Pages release.
- [ ] Production verification identifies missing migration source files RC425–RC432 and RC434–RC441, and states chronological replay, tenant isolation, payment/finance E2E, backup/restore, Edge Function contracts, SMM parity, and Auth security settings are not verified. Recover/review the full ordered migration chain and rehearse in an isolated database; do not cherry-pick migrations or change production directly.
- [ ] Restaurant preview parity remains incomplete: the customer ordering demo lists three separate restaurant menus, while `web/preview/restaurant.html` uses a separate generic four-item operator catalog and sample orders. Align these through a shared, validated demo catalog before treating the two preview surfaces as an end-to-end restaurant workflow. Both remain demo-only and do not send orders to a server.
- [ ] Verify existing home-page consumers and GPS/manual location behavior in a real browser and mobile device.
- [ ] Select and configure a supported geocoding / map / road-routing provider only after coverage, cost, terms and secret-handling review.
- [ ] Implement the shared map/address-picker UI and authenticated saved-address workflow; no such production capability is claimed by this increment.
- [ ] Implement server-authoritative restaurant branch delivery-zone eligibility and fee calculation; do not rely on browser polygon checks for checkout authorization.
- [ ] Map all module consumers and integrate them incrementally after central contract verification.
- [ ] Production remains BLOCKED / NOT CERTIFIED until live backend authorization, privacy, browser/mobile E2E, provider, and release gates are evidenced.

### RC101 — Provider services UI and ownership contract — 2026-10-23
- [x] Implement provider-owned service list and service catalog selection using existing tables only.
- [x] Implement add/edit/status/delete actions for provider-service links; re-check profile ownership and rely on existing RLS for final authorization.
- [x] Implement owner-scoped `service_areas` editing on the existing profile field; no new availability schema.
- [x] Add a provider-services contract validator and include it in Pages CI.
- [ ] Verify exact-head CI result after the latest commit.
- [ ] Run browser E2E with two separate provider accounts proving cross-provider update/delete is denied.
- [x] Read-only live grant/policy check found authenticated SELECT-only on `marketing_provider_services`; owner-scoped RLS is present and RLS/FORCE RLS are enabled.
- [x] RC102 branch-only migration proposes INSERT/UPDATE/DELETE grants to authenticated, guarded by the existing owner-scoped RLS policy; it has NOT been applied to production.
- [ ] Review and test the central orders/bookings lifecycle after C4 completion.
- Global production gate remains **BLOCKED / NOT CERTIFIED**.

### C3 — Orders and bookings review after RC101 — 2026-10-23
- [x] Static review of authenticated order-create and server-authoritative pricing/branch validation.
- [x] Static review of authenticated order-status update delegation to the authoritative backend RPC.
- [x] Reviewed existing medical booking/status authorization contract and existing CI invariant validator; no parallel order/booking schema added.
- [ ] Run browser E2E: customer discovery → order create → provider status transition.
- [ ] Run two-tenant/cross-provider isolation tests and medical booking concurrency/notification tests.
- [ ] Run payment/refund E2E only in the approved sandbox with test fixtures; no production transactions.
- [ ] Exact-head CI remains NOT VERIFIED; workflows triggered for the latest branch commits are queued/in progress. The Pages deployment job is validation-only/skipped on this feature branch.


### RC102 — Provider service mutation privilege gap — 2026-10-23
- [x] Live read-only audit verified `marketing_provider_services` has RLS and FORCE RLS enabled, an owner-scoped mutation policy, and only SELECT table privilege for `authenticated`.
- [x] Added branch-only migration `20261023020000_rc102_provider_services_owner_write_grants.sql` granting INSERT/UPDATE/DELETE to `authenticated`; no anon/public/service-role mutation grant.
- [x] Extended the provider-services static contract validator to require the grant and reject broader SQL grants.
- [x] Migration version uniqueness passed on commit `7264e1353d6c5a575a9ae9aa17e616925dfb1ca3`; latest head remains pending, so do not infer current CI success.
- [x] Exact-head migration uniqueness [run 39883171165](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39883171165), history immutability [run 39883171079](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39883171079), and cross-PR collision guard [run 39883171151](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39883171151) passed on head `a051ca2ce6d8cfc4fb85da9fa77d3260339c2c0b`.
- [x] Isolated PostgreSQL migration + owner/cross-owner behavioral test passed in CI run [39883171148](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39883171148).
- [ ] Browser E2E for add/edit/status/delete with two separate provider identities.
- [ ] Do not merge/apply production until all above gates pass.


### RC102 — isolated owner-isolation CI coverage added — 2026-10-23
- [x] Added disposable PostgreSQL 16 fixture for provider profiles/services, including RLS and the existing RC99 ownership policy.
- [x] Added behavioral SQL cases for owner insert/update/delete, cross-owner read/insert/update/delete boundaries, and anonymous-session denial.
- [x] Added dedicated workflow `.github/workflows/provider-services-owner-isolation.yml` to apply fixture → existing RC99 policy → RC102 grants → integration test in that order.
- [x] Extended the static contract validator to assert the integration cases and isolated PostgreSQL workflow.
- [x] Exact-head provider-services workflow [run 39883171148](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39883171148) passed on head `a051ca2ce6d8cfc4fb85da9fa77d3260339c2c0b`: both the static contract and disposable PostgreSQL 16 owner-isolation integration test succeeded.
- [ ] Real browser E2E with two separate provider identities remains NOT VERIFIED.
- [ ] RC102 is still branch-only and has not been applied to production. Release gate remains **BLOCKED / NOT CERTIFIED**.


### RC102 CI status refresh — 2026-10-23
- [x] Provider-services contract validator and PostgreSQL 16 owner-isolation integration passed on exact head `a051ca2ce6d8cfc4fb85da9fa77d3260339c2c0b`.
- [x] Migration version uniqueness, migration history immutability, and cross-PR migration collision guard passed on the same head.
- [x] Pages validation passed; deploy job skipped as expected for a pull request. No deployment occurred.
- [ ] Backend-only module boundary and module professionalization/privacy workflows are still queued/in progress at last check; recheck before treating the whole PR CI suite as green.
- [ ] Browser E2E with two separate real provider accounts remains NOT VERIFIED.
- [ ] RC102 remains branch-only; production schema and grants are unchanged.


### RC101/RC102 and restaurant preview CI refresh — 2026-10-23
- [x] Rechecked all relevant workflows against head `b63bbdab63b653ca8e630552e9cfb363d5ecce66`: Preview Demo Validation, Migration Version Uniqueness, Migration History Immutability, Open PR Migration Collision Guard, MantiGO Open Ride Privacy Boundary, Approval Action Audit Atomicity, Provider Services Owner Isolation, Backend-only Module Boundary, and Module Professionalization Validation all completed successfully.
- [x] Provider Services Owner Isolation passed on this exact head, including its static contract and disposable PostgreSQL integration job.
- [x] Backend-only Module Boundary and Module Professionalization Validation completed successfully, including financial-journal, approval-audit, targeted-ads, and matrimony privacy PostgreSQL jobs.
- [x] Pages workflow completed successfully as a workflow, but deployment was skipped for the feature PR branch; no deployment is claimed.
- [ ] Customer checkout still creates only a local demo confirmation; it does not persist an order or send it to a restaurant. Real browser E2E, backend integration, live pricing/availability checks, and authenticated tenant-isolation tests remain open.
- [ ] PR #350 remains draft/unmerged; RC102 migration remains branch-only. Production gate remains **BLOCKED / NOT CERTIFIED**.


### RC101/RC102 and restaurant demo hardening — exact-head refresh — 2026-10-23
- [x] Revalidated all 10 PR workflows on code head `1ce859e5809f3c456c8f4ad3377d83780216afdc`: Preview Demo Validation, migration version uniqueness, migration-history immutability, cross-PR migration collision guard, Provider Services Owner Isolation, Backend-only Module Boundary, Module Professionalization Validation, MantiGO Open Ride Privacy Boundary, Approval Action Audit Atomicity, and Pages validation all completed successfully.
- [x] Preview validator now checks required/bounded synthetic checkout fields, confirms the checkout does not persist contact/address fields or submit to a backend, and verifies the shared cart can remove one restaurant without altering another seller's items.
- [x] Shared-cart parser rejects IDs longer than 100 characters; its runtime normalization test covers oversized IDs, duplicate IDs, tampered quantities, and bounded line totals.
- [ ] A new docs-only commit or any subsequent code commit creates a new head; rerun exact-head CI before describing the newer head as green.
- [ ] Browser-based customer-to-restaurant order lifecycle E2E and real two-provider-account browser E2E remain unverified. Demo checkout still creates only a local confirmation and does not persist/send a real order.
- [ ] RC102 migration remains branch-only and unapplied. No production writes, migration execution, merge, or deployment occurred. Global production gate remains **BLOCKED / NOT CERTIFIED**.


### RC103 — Restaurant order authorization and status branch isolation — 2026-10-23
- [x] Fixed the restaurant order handler declaration and made order submission single-flight; canceling order details now resolves the pending flow, and successful modal saves clean up keyboard listeners and restore focus.
- [x] Minimized restaurant workspace query projections to fields currently used by the UI; added contract assertions for the projections and order flow.
- [x] Scoped the order-create Edge Function's operational membership check to the exact requested branch.
- [x] Added branch-only migration `supabase/migrations/20261023030000_rc103_order_status_branch_scope.sql`. Operational roles must match both business and branch; business-scoped OWNER/ADMIN memberships cannot bypass business scope. Only tenant-wide OWNER/ADMIN memberships with no business binding retain tenant-wide access. Customer-owned cancellation, allowed transitions, and paid-order cancellation protection remain guarded.
- [x] Added a disposable PostgreSQL 16 fixture/integration suite and dedicated `Order Status Branch Scope` workflow. Behavioral coverage includes same-branch success, cross-branch denial, cross-business admin denial, tenant-wide owner access, customer-owned cancellation, invalid transitions, and paid-order cancellation rejection.
- [x] Exact-head CI on code head `0fb3032f3d578c651d7de0ee16bc1977518c02d6` passed all 11 workflows: Preview Demo Validation, Deploy MantiqatiX Web (validation passed; deploy skipped for PR branch), Migration Version Uniqueness, Migration History Immutability, Open PR Migration Collision Guard, Provider Services Owner Isolation, Backend-only Module Boundary, Module Professionalization Validation, MantiGO Open Ride Privacy Boundary, Approval Action Audit Atomicity, and Order Status Branch Scope.
- [x] Rechecked exact-head CI on code/documentation head `4d9d965e3f95324b6fbc58729e57d2d02337c382`: all 11 workflows completed successfully, including the isolated RC103 PostgreSQL behavior suite. Any later commit still requires its own exact-head CI check.
- [ ] Live browser E2E with separate authorized staff accounts, real customer-to-restaurant order creation/status lifecycle, Paymob payment/refund E2E, backup/restore drill, and production runtime evidence remain unverified.
- [ ] RC102 and RC103 migrations are branch-only and unapplied. No production database writes, migration execution, merge, or deployment occurred. PR #350 remains draft/unmerged; global release remains **BLOCKED / NOT CERTIFIED**.


### RC104–RC106 — idempotency isolation and Edge Function RPC identity — 2026-10-23
- [x] Added branch-only RC104 migration to prevent an idempotency key from returning an order/pricing snapshot when the customer, business, or branch differs from the original request.
- [x] Added isolated PostgreSQL 16 behavior tests: exact same-scope replay returns the original order; cross-customer, cross-branch, and cross-business key reuse is rejected; no duplicate row is created.
- [x] Source review found a mismatch between Edge Function authentication and backend RPC identity checks: order-create and order-status-update validate the bearer token with auth.getUser(token), then call backend-only RPCs through a service-role client. The RPCs previously required auth.uid() to equal the verified user ID, which is not the service-role JWT identity.
- [x] Added branch-only RC105/RC106 migrations to accept the trusted service-role path while retaining auth.uid() identity binding for non-service-role callers. No execute grants were broadened. Added PostgreSQL tests proving both service-role paths and the ordinary identity-bound behavior.
- [x] Restaurant order retry state now reuses the same order ID/idempotency key after ambiguous network failures, storing only non-PII request fields in sessionStorage with an in-memory fallback. Pending state is cleared only after a confirmed response.
- [x] On code head `bb62e5cd732dbef0d917562cc8847d5fad2d984e`, the RC103 branch-scope PostgreSQL suite and RC104–RC105 idempotency/service-role PostgreSQL suite passed; preview validation, migration uniqueness/history checks, provider isolation, backend-only boundary, module professionalization, MantiGO privacy, and approval-audit checks also passed.
- [ ] Open PR Migration Collision Guard could not complete its cross-PR check because GitHub API returned HTTP 403 while fetching another open PR's file list. The self-test passed, but the guard remains unresolved; do not weaken fail-closed behavior. Retry when API access/rate limits permit.
- [ ] The latest documentation commit, if any, requires a fresh exact-head CI check. Live browser E2E with real authorized identities, live order/payment/refund integration, backup/restore drill, and production runtime evidence remain unverified.
- [ ] RC102–RC106 remain branch-only and unapplied to production. No production database writes, migration execution, merge, or deployment occurred. PR #350 remains draft/unmerged; global release remains **BLOCKED / NOT CERTIFIED**.


### RC107 — confirmed order versus refresh failure — 2026-10-23
- [x] Fixed the restaurant order UI so a confirmed successful `order-create` response is not reclassified as an order-creation failure if the subsequent dashboard refresh fails.
- [x] In this case the UI now preserves the success result and tells the user to reload to review the order, rather than encouraging a new submission.
- [x] Added a contract regression assertion for this behavior.
- [ ] RC107 is not certified until the exact-head CI completes. The cross-PR migration collision guard remains blocked by GitHub API installation rate limiting; it must complete successfully before merge.

### RC107 — exact-head CI result — 2026-10-23
- [x] Rechecked PR #350 at exact head `7ed49dc0ea4b6780b6b1147d0001b0e8551bbc83`: all 12 PR workflows completed successfully, including Migration Version Uniqueness, Open PR Migration Collision Guard, Migration History Immutability, Provider Services Owner Isolation, Order Idempotency Scope, Order Status Branch Scope, Approval Action Audit Atomicity, Backend-only Module Boundary, Module Professionalization Validation, MantiGO Open Ride Privacy Boundary, Preview Demo Validation, and Pages validation.
- [x] The migration collision guard completed successfully on this exact head; the prior API-rate-limit failure was transient and is not the latest result.
- [x] Pages workflow's validation job passed; its deploy job was skipped for the pull-request event. This is CI/source validation, **not** a deployment or live-site smoke pass.
- [ ] Browser E2E using separate real customer/provider/branch identities remains NOT VERIFIED.
- [ ] Paymob payment/refund and finance/settlement E2E, backup/restore rehearsal, production Auth security settings, full live RLS/catalog checks, Android signed release, real-device regression, monitoring/alert and rollback drills remain open.
- [ ] RC102–RC106 migrations remain branch-only; no production migration, production write, merge, or deployment occurred.
- [ ] Any documentation/source commit changes the PR head and requires a fresh exact-head CI run. Keep PR #350 draft/unmerged and the global production gate **BLOCKED / NOT CERTIFIED** until all mandatory evidence and external approvals are present.

### RC109 — Bounded streaming for order-create payloads — 2026-10-23
- [x] Replaced full-body buffering with bounded streaming reads capped at 256 KiB; oversized streams are cancelled before additional body data is buffered.
- [x] Strict UTF-8 decoding occurs before JSON parsing.
- [x] Validator now checks streaming cap/cancellation, malformed UTF-8 handling, duplicate/oversized selected options, and finite final order total.
- [x] Prior exact head `7330fd1a7014aaed15ad0c373cf140a1c7c0ae1f` passed all 12 workflows, including the cross-PR migration collision guard; this does not certify the newer RC109 head.
- [ ] Recheck every workflow against the latest head before certifying this increment.
- [ ] Real authenticated browser E2E, Paymob payment/refund and settlement E2E, backup/restore, Auth security settings, Android signing/device regression, and live production parity remain open.
- No production migration, data write, merge, or deployment occurred. Global release remains **BLOCKED / NOT CERTIFIED**.

### RC453 — نشر تحسين تجربة الزائر العامة — 2026-10-24
- [x] نُشر تحديث الواجهة العامة على main في commit b7dfde227a8e24e944165828e62c6a3f1c1b08e9 بعد دمج PR #353 لتحسين التصفح العام للقطاعات.
- [x] أضيف بحث عربي داخل صفحة القطاع على الخدمات ومقدمي الخدمات المحمّلين، وزر مسح البحث ورسالة نتائج، وتفاصيل قابلة للفتح والإغلاق في بطاقات الخدمات.
- [x] توحيد رموز القطاعات العامة مع رموز الكتالوج الخلفي وإظهار القطاعات الحية المكتشفة؛ وتحديث أصول الصفحة وService Worker cache.
- [x] نجح مسار التحقق المحدود للواجهة العامة على commit الإنتاج: validate_public_only=success.
- [x] اكتمل نشر GitHub Pages والتحقق الحي من الأصول والصفحات في job deploy=success ضمن workflow run https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/40042903267.
- [x] نجح Production Health Monitor على نفس commit.
- [ ] نتيجة workflow العامة ما زالت failure لأن Production verification engine أبقى PRODUCTION_GATE=BLOCKED للأجزاء الخلفية والعمليات الحساسة؛ هذا لا يلغي نجاح نشر الواجهة العامة ولا يثبت جاهزية كل الموديولات للإنتاج.
- [ ] استكمال بناء صفحات ومسارات جميع الموديولات وتجربة التصفح بينها، ثم اختبارات E2E متعددة الأدوار ومراجعة الأمن والتعافي قبل اعتماد الإطلاق الكامل.
- لا توجد تغييرات على قاعدة بيانات الإنتاج أو عمليات مالية في هذا الإصدار. حالة الإطلاق الكامل: BLOCKED / NOT CERTIFIED.

### RC454 — دمج مدخل معاينة جميع الموديولات ونشره — 2026-10-24
- [x] دمج PR #358 في main بالالتزام 8449b9137b7dd57bcf3196c7720cb904bcfe049c.
- [x] إضافة رابط «كل الموديولات» في التنقل الرئيسي وقسم واضح بالصفحة الرئيسية يقود إلى لوحة الموديولات والجولة التفاعلية.
- [x] توضيح أن لوحة الموديولات معاينة تجريبية لا تنشئ طلبات أو مدفوعات حقيقية.
- [x] اجتاز التحقق المحدود للواجهة العامة validate_public_only=success.
- [x] نجح نشر GitHub Pages والتحقق الحي من الموقع في workflow run https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/40044942173.
- [x] نجحت فحوص Marketing Workspace Contract وProduction Health Monitor على نفس الالتزام.
- [ ] فشل production verification engine العام ما زال يمنع اعتماد إطلاق backend والعمليات الحساسة؛ نجاح نشر الواجهة لا يعني اعتماد كل الموديولات تشغيليًا.
- [ ] مواصلة بناء وتوحيد الصفحات والمسارات العامة لكل موديول، ثم تنفيذ اختبارات E2E والأمن والتعافي قبل اعتماد الإطلاق الكامل.

### RC455 — تحسين الوصول بلوحة المفاتيح في تخصيص طلب المطعم — 2026-10-24
- [x] دمج PR #361 في main لتوسيع بوابة النشر المحدود بشكل ضيق: السماح فقط بملف واجهة طلب المطعم التجريبية ومدققها، مع تشغيل `validate-preview-navigation.mjs` ضمن البوابة؛ لم تُفتح البوابة لتغييرات backend أو قواعد البيانات أو المدفوعات.
- [x] دمج PR #362 في main بالالتزام `dfbdc27dcc3acb9ff803543b93dadd0a9385182c`.
- [x] تحسين نافذة تخصيص الوجبة: دعم Escape، حصر تنقل Tab داخل النافذة، نقل التركيز للنافذة عند فتحها وإعادته إلى زر الصنف بعد إغلاقها، قفل تمرير الخلفية واستعادته، وإغلاق النافذة عند الضغط على الخلفية.
- [x] نجحت Preview Demo Validation على الالتزام الجديد: workflow run https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/40045562940.
- [x] نجحت بوابة validate_public_only ونجح job النشر والتحقق الحي ضمن Deploy MantiqatiX Web: https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/40045563020.
- [x] نجح نشر مسار المعاينة: https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/40045563014.
- [x] نجحت فحوص Backend-only Module Boundary وModule Professionalization Validation وMantiGO Open Ride Privacy Boundary على الالتزام نفسه.
- [ ] مهمة Production verification engine الشاملة ما زالت تُبقي `PRODUCTION_GATE=BLOCKED`. نجاح نشر الواجهة العامة لا يثبت جاهزية backend أو جميع الموديولات للإنتاج.
- [ ] استمرار استكمال واجهات المطاعم ورحلة العميل ومقدم الخدمة، واختبار حالات الخطأ وإعادة المحاولة وحالات الشبكة على واجهة الطلب الحقيقية، مع عدم اعتبار تجربة الطلب التجريبية نظام طلبات إنتاجيًا.
- [ ] ما زالت اختبارات E2E بهويات حقيقية متعددة الأدوار، واختبارات Paymob/refund والتسويات، ومراجعة RLS/Security Advisor، وتدريب النسخ الاحتياطي والاستعادة، واختبارات Android الموقعة وعلى أجهزة حقيقية، ومراقبة/تنبيه/تراجع الإنتاج غير مغلقة.
- لا تغييرات على قاعدة بيانات الإنتاج أو معاملات مالية حقيقية في هذا الإصدار. حالة الإطلاق الكامل: **BLOCKED / NOT CERTIFIED**.


## Production cleanup update — 2026-10-26 (supersedes earlier production fixture counts)

- Live production now has **1 tenant** (`MNTY-PLATFORM`), **26 businesses**, **25 active official sector showcases**, **45 active memberships across 10 users**, **6 Auth users**, **0 orders**, and **0 payment intents**.
- Removed the synthetic production tenant `MNTY-TEST-B` and the inactive `MNTY-BERKET-TEST` provider fixture with its test advertisement and catalog/pricing data. Financial/transactional records were checked first and none were present.
- Kept all 25 official `OFFICIAL_PLATFORM_SHOWCASE` businesses and preserved the unrelated inactive pending web registration `BUSINESS-08769963`.
- Synthetic two-tenant records are now local/CI-only. Use the guarded fixture at `supabase/tests/baselines/tenant_isolation_two_tenant_fixture.sql`; do not seed fixtures into production. The v2 verifier fails closed when its disposable fixture is absent.
- The catalog-admin bootstrap privilege fix is recorded in migrations RC110/RC111; the service role has read access to the four catalog/profile tables used by catalog-admin. No new `anon` or `authenticated` table grants were added.
- Remaining verification: run the CI checks and confirm the Pages release with production demo controls removed; ask the platform owner to confirm the live browser opens the admin dashboard after reloading the deployed site.


## 2026-10-26 — Catalog role/view boundary review
- [x] Source review confirmed the React catalog shell rendered `merchant_admin` / `super_admin` directly from client-side `currentView` state without a render-time role gate.
- [x] Source review confirmed subscriber business selection could fall back to `businesses[0]` when the authorized business was absent, risking the wrong public business being shown as the management context.
- [ ] Remediation is proposed in PR `fix/catalog-role-view-guards`; do not mark complete until its latest-commit CI passes.
- [ ] Active-subscription enforcement is NOT VERIFIED: the inspected catalog bootstrap uses active `user_memberships` and the inspected catalog RPC migration validates membership/tenant/business/branch scope, but this review has not established a canonical subscription entitlement source or a server-side subscription gate. Do not infer subscription enforcement from UI flags such as `isFrozen` / `paymentStatus`.
- [ ] Authenticated browser E2E, role-switch/logout cache isolation, and cross-tenant adversarial tests remain NOT VERIFIED.


## 2026-10-27 — Exact live migration-source reconciliation

- [x] Live Production ledger read-only inventory: 292 rows, latest `20261027041549 qadam_alsaad_restore_contact_fields`.
- [x] Exact statement/source identity verified for `20261027010135`, `20261027041411`, and `20261027041549`; exact-version source files are restored. The existing `20261027100000_mantiqatix_marketing_contact_details.sql` was preserved unchanged under the migration-history immutability guard, documented as an exact idempotent alias; no existing migration was deleted or renamed.
- [x] The current schema-checkpoint replay passed all 52 forward migrations and tenant-isolation checks in [run 40494929976](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40494929976); this is isolated replay evidence only, not Production migration-application evidence.
- [ ] Global production release remains BLOCKED: required migration application in Production, payment/finance E2E, backup/restore, live Auth/Edge Function runtime parity, browser/device regression, monitoring/alerts and rollback evidence remain unverified.


## 2026-10-27 — Schema-only checkpoint replay diagnosis

- [x] Inspected Forward Migration Chain Replay run [40493639400](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40493639400): it failed at `20261027010135_add_qadam_alsaad_homewares_store_and_catalog.sql` because the restored checkpoint is schema-only (`data_included=false`) and therefore lacks `MNTY-PLATFORM`.
- [x] Read-only Production checks confirmed the platform tenant and referenced owner auth identity exist in the live database. No production data was copied or changed.
- [x] Added `supabase/tests/baselines/production_data_prerequisites_fixture.sql` with only deterministic test data for those pre-existing dependencies, guarded by the explicit disposable flag. Added a local-host URL guard to the replay workflow.
- [x] Re-ran forward replay successfully in [run 40494929976](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40494929976): 52 migrations applied; RC117 contract and synthetic tenant A/B read isolation/cross-tenant mutation denial passed.
- [ ] Production Gate remains BLOCKED / NOT CERTIFIED until the required migration set is proven applied in Production and the external payment, restore, Auth/Edge Function, browser/device, monitoring and rollback gates are evidenced. The deployment job was skipped.


## 2026-10-27 — Final evidence contract extension

- [x] Exact live ledger inventory expanded from RC425–RC441 (16 IDs) to all **34** required release version IDs used by `verify-production.mjs`; current read-only result is 0/34 recorded.
- [x] RC451 live function inventory confirmed `get_mnty_targeted_advertisements` still uses `search_path=public, pg_temp`, while the source migration requires an empty search_path. It remains intentionally callable by anon/authenticated; only the search_path should be hardened, without revoking public discovery.
- [ ] Apply no production migration until all missing versions are reconciled in order against later-dated live versions and an isolated current-schema rehearsal plus backup/rollback plan is approved.

## 2026-10-27 — Expanded production gate: RC113–RC117 and Qadam follow-up

- [x] Expanded the exact-version release gate from 34 to **41 distinct migrations**: the original payment/finance/security/order chain, six RC113–RC117 platform-feature migrations, and `20261027093000_add_qadam_alsaad_homewares_store.sql`.
- [x] Read-only live catalog checks show all six feature migrations are absent from the live ledger and their target objects are missing: 17/17 required function contracts and 11/11 selected tables/indexes are absent. These cover platform custom roles, employee hiring, control-center integration, subscriber administration, default-image triggers, and membership scope/idempotency.
- [x] Qadam data audit shows 15 active catalog items, all 12 expected price rows, three contact-for-price items with no active price, complete contact fields, one active branch, no synthetic stock tracking. Blocking defect: `MNTY-QADAM-ALSAAD-OWNER` membership is `INACTIVE`; the unrecorded follow-up migration promotes it to `ACTIVE`.
- [x] Two source-version aliases remain separate from the 41 distinct migrations: RC424 source version `20261009010000` maps to applied ledger version `20261008222845`; `20261027100000_mantiqatix_marketing_contact_details.sql` is an exact source-blob alias of live version `20261027041411`. Both require controlled ledger repair after backup/rehearsal; do not execute duplicate SQL as distinct effects.
- [ ] Overall status remains `BLOCKED / NOT CERTIFIED`: all 41 distinct required versions are still 0/41 in the live ledger; aliases are 0/2 reconciled; RC451 search_path, finance ACL/schema, five critical Edge Function source drifts, payment/finance E2E, backup/restore, Auth settings, browser/device, monitoring and rollback evidence remain open.
- Safety: no Production migration, repair, data write, grant/RLS/Auth change, Edge Function deployment, payment or wallet mutation was performed.


## 2026-10-29 — Professional dashboard merge and production deployment result

- [x] Merged PR #483 to `main` at `bbd8e6f5c881f3b4744d5e783bb52874406c7600` after exact-head frontend build, dashboard browser E2E and isolated employee RBAC tests passed.
- [x] Confirmed the main deployment workflow fails closed at `Gate production deployment on live professional dashboard dependencies`; the publish job is skipped while required dashboard tables/RPCs are missing from verified live evidence. No production schema/data writes occurred.
- [ ] Apply the missing dashboard dependency migrations only through a reviewed, controlled production rollout; verify the actual tables/functions and migration ledger read-only after rollout. Do not bypass the gate or fabricate ledger entries.
- [ ] Reconcile all 41 required platform release migration versions and the existing payment/finance/Edge Function/backup-restore drift. Full platform remains **BLOCKED / NOT CERTIFIED**.
- [ ] After dependencies pass, rerun main deployment, verify the dashboard on the authenticated production origin, and complete real-device accessibility plus QR/permanent-link regression.


## 2026-10-29 — Dashboard dependency forward repair (live verification)

- [x] Applied forward-only migration `20261029041815_professional_dashboard_dependencies_forward_repair` to the configured Production Supabase project. It introduces only RC113/RC114/RC115/RC116/RC457 dashboard dependencies in source order. RC117 image triggers and its existing-row updates were intentionally excluded from this scoped rollout.
- [x] Added the exact applied migration source at `supabase/migrations/20261029041815_professional_dashboard_dependencies_forward_repair.sql`; no historical migration files were changed.
- [x] Read-only live checks confirm all 11 dashboard dependency objects exist; the four new tables have RLS and FORCE RLS enabled; anon/authenticated roles have no direct table SELECT/INSERT privileges; intended authenticated RPCs are executable; internal permission helper RPCs are not executable by browser roles; unauthenticated permission checks return denied.
- [x] Updated `docs/release/production-migration-reconciliation.json` with the live dashboard-specific evidence only.
- [x] Main-branch Pages deployment succeeded on run [40817091710](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40817091710); post-deploy root/assets verification passed at https://islamnagy2022-eng.github.io/MantiqatiX/. Authenticated user/session checks against the deployed dashboard remain NOT VERIFIED.
- [ ] Complete real-device mobile/tablet, keyboard/accessibility, QR/permanent-link regression and authenticated role checks on the deployed origin.
- [ ] Full platform gate remains **BLOCKED / NOT CERTIFIED**. The 41-version release-migration reconciliation, finance/payment and Edge Function parity, backup/restore rehearsal, Auth security, monitoring and rollback evidence are still open. No claim of full-platform production readiness is made.


## 2026-10-29 — Latest deployed dashboard and accessibility verification

- [x] Latest application commit `999f5bcb72a26a244bd10f990ef6ef80e4ec50e7` passed [Primary Catalog Frontend Validation 40818177042](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40818177042) and [Deploy MantiqatiX Web 40818177045](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40818177045).
- [x] Published to https://islamnagy2022-eng.github.io/MantiqatiX/; deployed-root/assets validation passed and retired demo/SMM routes remain unpublished.
- [x] Browser tests against the deployed-origin frontend passed route denial/restoration, read-only employee scope, branch-owner restrictions, no horizontal overflow at 390x844 and 1440x900, and permanent store URL/QR payload integrity. Supabase responses were mocked for these browser scenarios.
- [x] Added pinned axe-core WCAG 2.1 A/AA audit to post-deploy CI. Fixed low-contrast quota text and emerald buttons in the merchant QR UI. Latest deployed-origin audit reports no critical or serious violations in the owner mobile/desktop dashboard, QR tab, and QR modal scopes.
- [ ] Actual authenticated production-account role tests remain NOT VERIFIED. The browser test harness uses synthetic sessions and mocked Supabase responses, so it is not proof of live Auth/RLS behavior for a real account.
- [ ] Manual physical-device/tablet and keyboard usability review, custom-domain verification, and QR scan with a real camera remain NOT VERIFIED.
- [ ] Overall platform release remains **BLOCKED / NOT CERTIFIED** due to unrelated missing full-platform migrations and finance/payment, Edge Function parity, backup/restore, Auth, monitoring and rollback evidence.


## 2026-10-29 — Public local healthcare directory and ownership-claim workflow

- [x] Applied forward-only migration `20261029051004_public_directory_listings_and_claim_requests` to production project `moyhiluyhjsujhwlyeuu`; adds public directory listings and ownership claim requests with RLS + FORCE RLS, browser table access revoked, service-role access only.
- [x] Seeded 43 initial public doctor listing pages for Berket El Sabaa, Menoufia. Production read-back: 43/43 have at least one phone and address; 37/43 have a specialty listed as such; 6 specialty labels explicitly require confirmation.
- [x] Added `directory-listings` Edge Function (production version 4): public listing read endpoints, authenticated claim submission, platform-admin listing management, and ownership approval guardrails.
- [x] Added public directory listing/profile UI and integrated it into the medical_health group: the category code now filters doctors, dentists, radiology and related health listings; canonical specialties filter the public listings. Each listing has an individual `?listing=<slug>` route. Added platform-admin tab “دليل الأنشطة والمطالبات”, editable outreach status/notes/dates, an ownership-claim review workflow, and owner-side profile completion plus navigation to the linked activity dashboard. Applied migration records are tracked under their actual production ledger versions: `20261029051004_public_directory_listings_and_claim_requests` and `20261029053207_directory_outreach_subscription_tracking`. Latest UI/backend changes are on main commit `0b36fbcb97d407e61744290c1cb4ca9728488b27`; final validation/deployment for that commit is still running.
- [x] GitHub Pages deployment and deployed-origin browser regression checks passed on run [40822443666](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40822443666).
- [ ] These directory entries are initial public-source records, not verified medical credentials, current phone verification, or doctor consent. Contact each doctor/clinic and refresh the details before describing the listing as confirmed. Main source used: [Dalil140 — doctors in Berket El Sabaa](https://dalil140.com/category/ar/doctors/el-monofeya/berket-el-sabaa), with its specialty subdirectories.
- [ ] End-to-end real-account ownership claim, owner-side profile edit, and paid-subscription handoff have not yet been manually exercised with a real claimant. The code rejects approval unless an administrator explicitly verifies identity/ownership and chooses an active business with paid subscription confirmed. Do not claim ownership is transferred automatically on payment alone.


## 2026-10-29 — Berket El Sabaa public directory expansion (all 18 groups)

- [x] Read the current main head before the data work: `2acd6470f3b7acf2e2667cbeb78f8f01419559dc`. The latest commit already includes the separate unverified-directory count UI; no frontend code was overwritten for this data-only batch.
- [x] Read-only Production inventory before changes: 193 listings across all 18 functional groups; 142 had a phone, all 193 had an address and source URL. A normalized-name duplicate check returned no duplicate groups.
- [x] Added 9 new public-source listings using idempotent name/phone checks: زياد فون، نوكيا فون، نكست للمحمول، مروان فون، حلويات ياقوت، بن الملوك، الحاج بدير السباعي الدقن، بيت الإلكترونيات، نصار للإلكترونيات.
- [x] Updated 4 existing mobile-store records with publicly listed phone numbers only where the phone field was empty: أبو وديع للموبايلات، الأمير جروب للموبايلات، ماستر فون، الجزيرة للموبايلات. Existing names were not duplicated.
- [x] Read-after-write Production result: 202 listings across 18 groups; 155 with phone, 202 with address, 202 with source URL. Current group counts: agriculture_animals 6; auto_transport 6; construction_decor 7; education_training 8; fashion_beauty 38; finance_insurance 1; food_grocery 19; home_maintenance 11; industry_workshops 1; marketing_media 7; medical_health 44; professional_services 12; public_community 1; real_estate 2; sports_fitness 3; technology_communications 27; tourism_events 2; trade_ecommerce 7.
- [x] All 9 inserted records use canonical taxonomy IDs from `productionDefaults.ts`, remain `PUBLISHED` directory leads with `UNCLAIMED` status, and include source URL plus metadata that owner confirmation is pending. They are not confirmed businesses and do not increase official business counts.
- [x] Sources used for this batch include Dalil140 mobile listings (https://dalil140.com/category/ar/mobile-phones-accessories/el-monofeya/berket-el-sabaa), Dalil140 tea/coffee listings (https://dalil140.com/category/ar/tea-coffee/el-monofeya/berket-el-sabaa), Dalil140 electronics listings (https://dalil140.com/category/ar/electric-electronic-devices/el-monofeya/berket-el-sabaa), and Dalil140 restaurant listings (https://dalil140.com/category/ar/restaurants/el-monofeya/berket-el-sabaa).
- [x] Re-ran normalized-name and normalized-phone duplicate audits after the batch; both returned 0 duplicate groups. Public UI browser validation against the deployed origin remains pending; no frontend code or Edge Function deployment was triggered by this data-only operation.
- [ ] Research remains incomplete despite all 18 groups having at least one record. Thin groups needing further sourcing include public_community (1), industry_workshops (1), finance_insurance (1), tourism_events (2), real_estate (2), sports_fitness (3), and agriculture_animals (6). Do not claim comprehensive coverage.
- [ ] One ownership claim remains pending; public-directory data is not owner-confirmed. Real claimant/paid-subscription handoff tests remain separate and incomplete.


## 2026-10-29 — Green aligned counters for groups, classifications, and specialties

- [x] Updated `apps/catalog-frontend/src/components/DirectoryView.tsx` so confirmed activity counts and unconfirmed directory-listing counts use adjacent green badges with consistent size/alignment.
- [x] Applied the same two-counter pattern to functional groups, taxonomy classifications, and specialties. The unconfirmed counter remains visible as zero so the two circles stay aligned even when a category/specialty has no unconfirmed listings.
- [x] Kept the two count meanings separate: confirmed counts are derived only from public-enabled/official-showcase active non-frozen businesses; unconfirmed counts are published directory listings not yet claimed.
- [x] Corrected specialty suffix normalization to strip whitespace around the em dash properly.
- [x] Commits: `06cac94168d480aa537198938c950c1aae28fed5`, `b47fbf3b0dd3319f13dda211a1b26019446fcdd8`, `437970e4876de8876d1216770b812094490b1520`, `c6c09d4e33722b2e36953f38979fe8f7377c45a2`.
- [ ] TypeScript/lint, Vite production build, GitHub Pages deployment, and deployed browser/mobile visual validation remain unverified. The commit combined status endpoint returned no status checks; do not claim build/deploy success until Actions or deployed-origin checks confirm it.


## 2026-10-29 — Berket El Sabaa directory expansion batch 2

- [x] Read-after-write Production inventory: **222 published directory listings across all 18 functional groups**; 160 have a phone, 222 have an address, and all 222 have a source URL.
- [x] Added 20 new records in this batch: 5 fitness/gym listings, one real-estate broker, one metal-turning workshop, one family-dispute public-service office, 4 local bank branches (including Tokh Tanabsha), 6 local travel agencies (including two found in the Ministry of Tourism's Menoufia license directory), and 2 additional photo studios.
- [x] Filled the previously empty phone for جرين هاوس للتنمية الزراعية with 01223992177 from the public 140Online listing; retained it as unconfirmed because a public directory is not direct owner verification.
- [x] Added canonical finance classification `cat_finance_insurance_banks` in `apps/catalog-frontend/src/data/productionDefaults.ts` for banks and branches, with specialties for commercial, government and agricultural banks. Commit: `88c537962465c288061d490e00baab9783b4152e`.
- [x] Re-ran production duplicate and taxonomy/group consistency audits after inserts: **0 normalized-name duplicate groups** and **0 group/category prefix mismatches**.
- [x] Current group counts: agriculture_animals 6; auto_transport 6; construction_decor 7; education_training 8; fashion_beauty 38; finance_insurance 5; food_grocery 19; home_maintenance 11; industry_workshops 2; marketing_media 9; medical_health 44; professional_services 12; public_community 2; real_estate 3; sports_fitness 8; technology_communications 27; tourism_events 8; trade_ecommerce 7.
- [ ] All new records are published, unclaimed, source-attributed directory leads; they are **not owner-confirmed** and must not increase official business/confirmed activity counts. Some sources list names and addresses without a phone, so those fields remain blank rather than invented.
- [ ] The new bank classification's frontend build/deployment is pending GitHub Actions. Do not claim it is live until the workflow succeeds and the deployed catalog shows the classification. The latest workflow run is [Primary Catalog Frontend Validation 40830599537](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40830599537) and was still in progress at the time of this entry.
- [ ] Coverage remains a continuing research task, not an assertion of every business in the center. Next sourcing priorities: agricultural/veterinary services, workshops/manufacturing, real estate, regulated financial services, and additional village-level businesses. Continue idempotent inserts and keep each source attached.


## 2026-10-29 — Berket El Sabaa directory expansion batch 3

- [x] Added 9 more source-attributed records: two veterinary clinics, five local food-processing/production businesses, and two additional Agricultural Bank branches (main Berket El Sabaa branch and Horeen branch).
- [x] Filled missing public-source phones for the existing Cairo Bank, Banque Misr, and Agricultural Bank Tokh Tanabsha listings. No previously populated phone was overwritten.
- [x] Latest Production read-back: **231 published directory listings** across all 18 groups; **172** have a phone, all 231 have an address and source URL. Duplicate-name audit and taxonomy/group consistency audit both return zero mismatches.
- [x] Updated current group counts: agriculture_animals 8; auto_transport 6; construction_decor 7; education_training 8; fashion_beauty 38; finance_insurance 7; food_grocery 19; home_maintenance 11; industry_workshops 7; marketing_media 9; medical_health 44; professional_services 12; public_community 2; real_estate 3; sports_fitness 8; technology_communications 27; tourism_events 8; trade_ecommerce 7.
- [x] Sources for this batch: [Dalil140 veterinary clinics in Berket El Sabaa](https://dalil140.com/category/ar/veterinarians/el-monofeya/berket-el-sabaa), [Dalil140 food producers/processors](https://dalil140.com/category/ar/food-producers-processors-equipment/el-monofeya/berket-el-sabaa), [Dalil140 processed meat businesses](https://dalil140.com/category/ar/meat-industry/el-monofeya/berket-el-sabaa), and [Dalil140 bank branches](https://dalil140.com/category/ar/banks/el-monofeya/berket-el-sabaa).
- [x] Primary Catalog Frontend Validation for bank taxonomy commit `88c537962465c288061d490e00baab9783b4152e` passed on [run 40830599537](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40830599537).
- [ ] Deployment remains pending/in progress on [run 40830599428](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40830599428) for the taxonomy commit, and the latest documentation commit triggered [run 40830678647](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40830678647). Do not claim the new bank category is live until the matching deployment succeeds.
- [ ] Public directory entries remain unclaimed and unconfirmed; the source establishes a public listing, not current operation or owner consent. Research is not exhaustive and must continue across the 21 villages, 52 hamlets/settlements and six local units of Berket El Sabaa center, using source-attributed, duplicate-safe additions.


## 2026-10-29 — Berket El Sabaa directory expansion batch 4

- [x] Added 16 more source-attributed public listings across construction/finishing, finance/insurance, homewares and furnishings, and professional accounting. Duplicate-safe insert returned 16 records; one already-present Egypt Insurance listing was preserved rather than duplicated.
- [x] Current Production read-back: **247 published listings** across all 18 functional groups; **187** have a phone; all 247 have an address and source URL. Duplicate-name audit and taxonomy/group consistency audit return zero mismatches.
- [x] Updated current group counts: agriculture_animals 8; auto_transport 6; construction_decor 12; education_training 8; fashion_beauty 38; finance_insurance 8; food_grocery 19; home_maintenance 20; industry_workshops 7; marketing_media 9; medical_health 44; professional_services 13; public_community 2; real_estate 3; sports_fitness 8; technology_communications 27; tourism_events 8; trade_ecommerce 7.
- [x] Source pages include [Eg Wedding — local finishing company Vision](https://eg.wedding/region/berket-elsaba/), [construction and contractors](https://dalil140.com/category/ar/construction/el-monofeya/berket-el-sabaa), [building materials](https://dalil140.com/category/ar/building-materials/el-monofeya/berket-el-sabaa), [hardware stores](https://dalil140.com/category/ar/hardware/el-monofeya/berket-el-sabaa), [accounting and tax services](https://dalil140.com/category/ar/accounting-auditing-tax-services/el-monofeya), [insurance branches](https://dalil140.com/category/ar/insurance/el-monofeya/berket-el-sabaa), [homewares](https://dalil140.com/category/ar/housewares-products/el-monofeya/berket-el-sabaa), [bedding and furnishings](https://dalil140.com/category/ar/bedding/el-monofeya/berket-el-sabaa), and [lighting stores](https://dalil140.com/category/ar/lighting-systems-lamps-chandeliers-bulbs/el-monofeya/berket-el-sabaa).
- [ ] Every public-source lead remains unclaimed/unconfirmed until direct verification. Keep blanks for unknown phones and do not describe public directory numbers as freshly verified.
- [ ] The bank-category frontend validation passed on run 40830599537, but deployment runs were cancelled by newer pushes and the newest Deploy MantiqatiX Web run [40830767697](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40830767697) was queued at the time of this entry. Confirm a successful deploy before claiming the new taxonomy is live.
- [ ] Continue sourcing all local units and villages; 247 listings is an expanded working directory, not proof of complete coverage of every activity in the center.


## 2026-10-29 — Berket El Sabaa directory expansion batch 5

- [x] Added 4 additional public-source records after duplicate checks: two auto-repair shops (أحمد شبل and حمادة) and one Mohamed workshop entry under auto maintenance, plus العطوي للأجهزة المنزلية. Other candidate appliance names were already represented and were not duplicated.
- [x] Final read-after-write inventory: **251 published directory listings across 18 functional groups**; **191** have a phone; all 251 have an address and source URL. Name-duplicate audit: zero groups; taxonomy/group consistency audit: zero mismatches.
- [x] Updated current counts: agriculture_animals 8; auto_transport 9; construction_decor 12; education_training 8; fashion_beauty 38; finance_insurance 8; food_grocery 19; home_maintenance 21; industry_workshops 7; marketing_media 9; medical_health 44; professional_services 13; public_community 2; real_estate 3; sports_fitness 8; technology_communications 27; tourism_events 8; trade_ecommerce 7.
- [x] Source: [Dalil140 — auto repair and servicing in Berket El Sabaa](https://dalil140.com/category/ar/cars-repairing-servicing-equipment/el-monofeya/berket-el-sabaa) and [home appliances in Berket El Sabaa](https://dalil140.com/category/ar/appliances/el-monofeya/berket-el-sabaa).
- [ ] Deployment of the added bank classification is still pending at [Deploy MantiqatiX Web run 40830850253](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40830850253). Verify the latest deploy before claiming it is visible live.
- [ ] The directory is expanded but not yet exhaustive. Continue systematic sourcing of all villages/hamlets and remaining activities, especially public/community services, agriculture, education, transportation, and village-specific businesses. All source-derived records remain unconfirmed until direct verification.


# DIRECTORY DISCOVERY — BERKET EL SABAA (2026-10-29)

Scope is restricted to Berket El Sabaa city and its administratively affiliated villages/hamlets/dependencies in Monufia. Do not classify other Monufia centers as local results.

- [PARTIAL] Initial audit: `apps/catalog-frontend/src/data/productionDefaults.ts` contains 18 functional groups and 221 category seed entries. Recheck effective saved settings before any migration; 221 is a code-seed count, not a verified live category count.
- [PARTIAL] Supabase `public.public_directory_listings` had 325 rows at audit time; RLS is enabled.
- [DONE — read-after-write verified] Added three public-source medical listings after global name/phone duplicate checks: د. هيثم البلتاجي عبد القادر (0482913270; 0482998467), د. إيهاب محمد البلشي (0482994199; 0482998880), د. عادل عبد الكريم بدوي (01112480327). Source for all: https://dalil140.com/category/ar/doctors/el-monofeya/berket-el-sabaa. Listings are PUBLISHED/UNCLAIMED; owner confirmation required; source phone not directly verified with owner.
- [TODO] Complete the official/local administrative coverage list for the center, villages, hamlets, and dependencies.
- [TODO] Continue medical research by specialty and location, checking all current records before every insert.
- [TODO] Revisit the known misclassification of `مركز د. محمد أحمد المراكبي للأسنان`; it has not been corrected yet.
- [TODO] Design and test a safe mapping to 50 primary categories. Do not delete legacy categories until references, saved settings, UI, and search compatibility are verified.
- [TODO] Continue all remaining functional groups within Berket El Sabaa only.
- [TODO] Run data/UI tests after each batch and record verified outcomes.

This work is partial; no full taxonomy migration or deployment is claimed.

- [DONE — read-after-write verified] Added one previously absent pharmacy in Genzour: صيدلية إسلام داوود — 0489136699, source https://www.dalilmadina.com/city_clinic.aspx?NUM=241. Before inserting, checked the other pharmacy records from the same source and confirmed four were already present; they were not duplicated.

- [DONE — read-after-write verified] Added two pharmacies from the Berket El Sabaa public directory after global name/phone checks: صيدلية سهام (0482913190; near Berket El Sabaa Hospital) and صيدلية د. أحمد حسن (0482270049; قرية مليج). Source: https://dalil140.com/category/en/pharmacies/el-monofeya/berket-el-sabaa. Both are PUBLISHED/UNCLAIMED with owner confirmation required and phone verification false.
- [DONE — read-after-write verified] Reclassified `مركز د. محمد أحمد المراكبي للأسنان` from the dentist-profession category to the dental-centers activity category, preserving the same listing ID, slug, contact information, source, and publication/claim states.

- [DONE — read-after-write verified] Added 9 food/grocery listings after comparing candidates with existing records: مطعم أبو رضوى, مخبز علا بركات الله, مطعم الحرمين, مطعم الملكي, مطعم السلطان, مطعم الزعيم, مطعم إيطاليا, كشري فيينا, مطعم سويت هوم. Source: https://yellowpages.com.eg/en/category/berket-el-sabaa-restaurants/3829. Source listing did not provide phones, so none were guessed; records remain PUBLISHED/UNCLAIMED with owner confirmation required.
- [REVIEW NOTE] Several source candidates already existed (e.g. مطعم الأصلي, مطعم المحلاوي, مطعم جابر عمر, حكاية, كشري الباشا, حلويات ياقوت, مخبز الحرمين) and were not duplicated. Recheck category/address data later where needed.

- [DONE — read-after-write verified] Added 8 supermarkets/markets from Egypt Yellow Pages after duplicate checks: سوبر ماركت أبو عفيفي, سوبر ماركت الإسكندراني, سوبر ماركت الشاذلي, سوبر ماركت الزيات, سوبر ماركت فرح, حمادة ماركت, هاني ماركت, وائل ماركت. Source: https://yellowpages.com.eg/en/category/berket-el-sabaa-supermarkets/3829. Source did not expose phone numbers; fields remain blank, not guessed.


## 2026-10-29 — Public/community directory expansion

- [x] Queried existing Berket El Sabaa public/community listings before insertion; retained existing youth center and family dispute settlement office without duplication.
- [x] Inserted and read-after-write verified 11 local public-service records: educational administration, police station, civil registry, culture house, post office, labor bureau, public taxes mission, real estate registration, social insurance bureau, supply bureau, and traffic station.
- [x] Kept unknown phone fields blank; records are PUBLISHED/UNCLAIMED and explicitly require owner confirmation.
- [ ] Investigate whether the Yellow Pages entries “Real Estate Registration Mission” and “Real Estate Registration Office” refer to the same service/location before considering any merge. Preserve the existing record if reclassification is needed.
- [ ] Continue with source-backed local village coverage and remaining functional groups. Do not claim exhaustive coverage or live deployment until checked.
- [ ] Recheck live total after any concurrent writes; database showed 348 rows before this batch and returned 11 inserted rows.


## 2026-10-29 — Auto parts and agriculture suppliers

- [x] Reused existing records instead of duplicating October, El Safa, Hany, and Haggag listings.
- [x] Filled only previously empty phone fields on the existing October, El Safa, and Hany records using a public directory source; preserved non-empty fields.
- [x] Added 8 read-after-write verified local auto-parts/agricultural-supply listings, PUBLISHED/UNCLAIMED, with owner confirmation required.
- [ ] Continue source-based discovery and cross-catalog name/phone matching across all 18 groups; verify village scope and phone numbers with owners before treating records as confirmed.


## 2026-10-29 — Local legal services

- [x] Checked existing local legal listings before insertion; existing مكتب محاماة حمدي حافظ فهمي was retained.
- [x] Added 17 legal-service leads from the local Yellow Pages category, PUBLISHED/UNCLAIMED with phone fields blank where not exposed by the source.
- [ ] Verify Arabic spellings, current office status, exact identity, and contact information directly before treating any entry as confirmed.
- [ ] Continue through remaining groups and village-level coverage; don't infer a complete directory from current totals.


## 2026-10-29 — Pharmacy discovery follow-up

- [x] Added 5 pharmacy leads after checking existing records; did not duplicate the existing Dr Abdel Hamid El Gendy, Ahmed Farag, or Dr Mohamed Sabry records.
- [x] Left phones blank where sources did not publish them; corrected the Ibn Sina phone field to NULL after discovering the source did not provide a number.
- [ ] Verify public-directory phone numbers and current operating status with each pharmacy owner before changing any verification status.


## 2026-10-29 — Enforce phone-required publication

- [x] Production database check constraint blocks `PUBLISHED` records without a primary or secondary phone containing at least 7 digits.
- [x] Demoted existing no-phone published listings to `DRAFT`; no records deleted and no contact numbers fabricated.
- [x] Verified current inventory: 284 published listings, all with a phone; 105 no-phone records are drafts.
- [x] Deployed `directory-listings` Edge Function version 7 with an application-level publication guard.
- [ ] For every future discovery batch, only insert records with a source-backed phone; publish immediately after read-after-write verification. Keep source attribution and owner-confirmation metadata, and never mark a public-directory phone as owner-verified without direct confirmation.

- [x] After enabling the guard, added one eligible source-backed pharmacy with a phone: صيدلية سمية سعيد (0482964400), جنزور. Read-after-write confirmed it is PUBLISHED/UNCLAIMED. Phone is not directly owner-verified. Prior verified 284 published + one insert = expected 285; recheck inventory count when available.


## 2026-10-29 — Ongoing source-backed publishing

- [x] Added 5 unique computer listings and 3 unique mobile listings, each with a phone from Dalil140 and read-after-write verification. Updated existing directory records with their public-source phones instead of duplicating them; published eligible former drafts only after a phone was supplied.
- [x] Reconciled inventory: **296 PUBLISHED listings (0 without phone); 102 no-phone DRAFT listings**. These DRAFT records stay hidden pending a real phone source; do not invent numbers or expose them publicly.
- [x] Data policy remains: source phone does not equal owner verification. Keep claim status UNCLAIMED and owner confirmation required.
- [ ] Continue by sourcing uncovered local categories and affiliated villages, checking normalized names and all primary/secondary phones before insertion, then publish only after successful read-after-write.


## 2026-10-29 — New construction and health listings; inventory verification

- [x] Added four source-backed health records with phone numbers and two building-material listings; reused the existing Abou El Nasr record and populated a sourced secondary phone rather than duplicating it.
- [x] Verified database state: **302 PUBLISHED, 0 published without phone; 102 DRAFT without phone**. Keep the existing 102 drafts hidden until a real phone is found.
- [ ] Health and building materials remain source-directory leads until owner/contact details and active status are confirmed directly. Continue through uncovered village-level businesses without fabricating contact data.


## 2026-10-29 — Food listings and duplicate-safe publication

- [x] Published 9 eligible restaurant/bakery drafts after adding source-listed phone numbers; populated source phone/secondary phone fields on existing records instead of duplicating them. Published حمادة ماركت after adding its sourced number.
- [x] Added 9 new source-backed food listings (spice shops, butchers, fresh produce), all with phones and UNCLAIMED status.
- [x] Duplicate handling: two exact name/address matches with a canonical published record (أبو رضوى and إيطاليا) were retained but set HIDDEN with metadata linking the canonical slug. A near-identical bakery variant remains DRAFT with an explicit review note rather than being merged without proof.
- [x] Inventory verified: **321 PUBLISHED / 0 without phone; 90 DRAFT / 90 without phone; 2 HIDDEN / 2 without phone**. No no-phone listing is published.
- [ ] Continue with remaining unrepresented categories and village coverage; public-source phone numbers still require owner confirmation before being considered verified.


## 2026-10-29 — Wholesale and food manufacturing listings

- [x] Added 10 source-backed local wholesale/food listings and 6 local food-production/manufacturing listings, with source phone numbers and read-after-write verification; all were inserted PUBLISHED/UNCLAIMED because each has a usable phone.
- [x] Latest inventory verified: **337 PUBLISHED with 0 missing phone; 90 DRAFT with no phone; 2 HIDDEN no-phone duplicate-review rows**. Phone-required database guard and Edge Function v7 remain active.
- [ ] Confirm the business names, current activity, and phone numbers directly with owners before marking any sourced lead as owner-confirmed. Continue with other uncovered activities and affiliated villages without inventing numbers or creating duplicates.


## 2026-10-29 — Added automotive and aluminum service listings

- [x] Added six new local records with public source-backed numbers: four tire/battery shops, one mechanic in Kafr Alim, and one aluminum workshop. All read-after-write results show PUBLISHED/UNCLAIMED.
- [x] Reused the existing Hamada repair shop and Captain truck-maintenance center rather than creating duplicates.
- [x] Verified current inventory: 343 PUBLISHED with zero missing phone; 90 phone-less DRAFT; 2 phone-less HIDDEN duplicate-review rows. Publication gate remains active.
- [ ] Source phone values are not owner-confirmed; keep the metadata review flags. Continue local research and category coverage.


## 2026-10-29 — Duplicate audit and appliance-retail taxonomy

- [x] Normalized published-name duplicate audit returns zero groups. The only repeated phone among current published rows is shared by two differently named butcher listings at different addresses; both are retained and flagged for owner verification.
- [x] Preserved, then hid five confirmed duplicate rows (plus two previously hidden duplicates) with explicit `duplicate_of_slug` metadata. No row was deleted. For the appliance seller, corrected category classification for both canonical and hidden copy instead of leaving it under general homewares.
- [x] Added taxonomy seed `home_appliances` and moved appliance-retail rows to `cat_home_maintenance_home_appliances` (code commit c40a910fb14fe95a084f15c41e8094f49e38f5e4).
- [x] Latest verified counts: 341 published with zero missing phones; 87 drafts with no phone; 7 hidden records, of which 5 have no phone. Phone-required publishing is still guarded by database and deployed Edge Function v7.
- [ ] The latest category code change's CI/build/deployment is not yet verified; confirm it before claiming the category appears in the live frontend.


## 2026-10-29 — Local poultry/veterinary additions and duplicate reconciliation

- [x] Added 4 local poultry outlets and one veterinary clinic with source phone numbers; all were confirmed PUBLISHED/UNCLAIMED after write.
- [x] Hid two duplicate copies without deleting IDs/slugs/data: a duplicate Oulad Ghoneim car-parts row and a duplicate Nortok Feed row. Corrected the canonical Nortok listing to the animal-feed taxonomy rather than treating it as generic agricultural supplies.
- [x] Latest verified database totals: 358 published / 0 without phone; 87 draft / 87 without phone; 9 hidden / 5 without phone. Database publication constraint and deployed Edge Function v7 still enforce phone-required publication.
- [x] Normalized published-name duplicate audit returned zero groups. The only shared primary/secondary number group left is 01225953508 across two different butcher names/addresses; both records are flagged and retained for direct verification.
- [ ] Do not call public-source phone data owner-verified. Recheck pending CI/deploy for the new home-appliance category before claiming it is visible in the frontend.


## 2026-10-30 — Fresh production inventory and TODO reconciliation

- [x] Read-only Supabase production inventory completed for project `moyhiluyhjsujhwlyeuu`.
- [x] Current `supabase_migrations.schema_migrations` count: **308**; latest version `20261029083845`, name `require_phone_for_published_directory_listings`. Older snapshots in this document referring to 292 or 303 rows are historical and must not be used as the current baseline.
- [x] Confirmed production objects now include `platform_custom_roles`, `platform_role_assignments`, `business_job_positions`, `business_employees`, `public_directory_listings`, and `directory_listing_claim_requests`. Earlier statements that the RC113/RC114 objects were absent are stale and require correction against this inventory.
- [x] Confirmed the latest directory guard migration is recorded. The production directory table currently reports 454 rows; this is a current row-count snapshot, not a completeness or owner-verification claim.
- [ ] Security Advisor snapshot at 2026-10-30 02:11 UTC: 8 RLS-enabled/no-policy tables (`business_employees`, `business_job_positions`, `commission_rule_audit`, `digital_page_payment_events`, `directory_listing_claim_requests`, `platform_custom_roles`, `platform_role_assignments`, `public_directory_listings`). Read-only privilege inspection found no direct anon/authenticated table grants on these objects. Most have FORCE RLS; `digital_page_payment_events` does not. Service-role grants vary; backend access paths still require per-table verification. Do not add broad policies just to silence the linter.
- [ ] Security Advisor also reports 3 anon-executable SECURITY DEFINER functions: `assign_default_owner_to_unowned_business()`, `capture_commission_rule_audit()`, and `get_mnty_targeted_advertisements(...)`; plus 67 authenticated-executable SECURITY DEFINER functions. The first two are trigger-returning functions in the inspected definitions; confirm trigger attachment and RPC reachability before deciding whether the linter finding is actionable. The targeted-ads function is a public endpoint by design but still requires review of input bounds, output fields, search_path, and data exposure. Do not revoke or alter these functions blindly.
- [ ] Complete per-function review: execution grants, SECURITY DEFINER owner, fixed search_path, actor/tenant checks, argument spoofing, returned columns, trigger/RPC callability, and runtime anon/authenticated negative tests.
- [ ] Complete per-table review for all 8 no-policy tables: intended backend-only access path, service-role grants, Edge/RPC callers, least-privilege verification, and fail-closed tests.
- [x] PR #483 (Professional Dashboard) is merged; prior text describing it as an open Draft PR is stale. Its production runtime/mobile verification and broader release dependencies remain separate gates.
- [x] PR #500 folder-style taxonomy navigation is merged in `723cc04df90b44aae6e65924346f2ae6cdb1f8b8`; push workflow `40966718589` and catalog validation workflow `40966718789` both completed successfully. Manual real-device/accessibility review remains open.
- [ ] PR #498 visual-completeness ranking remains open. Its previous validation failed because the geographic contract test expected an obsolete `aVerified` variable, while the implementation now uses an explicit verified-first comparator. The test assertion has been updated on the PR branch to match the implemented comparator; wait for the new CI run before merge.
- [ ] This inventory is a read-only baseline. No production migration, schema mutation, permission change, or data mutation was performed. Production release remains BLOCKED until security, E2E, payment/finance, backup/restore, device, and rollback gates are evidenced.


### 2026-10-30 — P0 security path inspection follow-up

- [x] Confirmed `assign_default_owner_to_unowned_business()` is attached only as the enabled INSERT trigger on `public.businesses`; `capture_commission_rule_audit()` is attached only as the enabled trigger on `public.commission_rules`. Both are trigger-returning SECURITY DEFINER functions with fixed search_path and have no function arguments. Their Advisor anon/authenticated EXECUTE finding needs classification as trigger-only rather than being treated as a callable RPC without proof. Preserve trigger behavior; no ACL change made.
- [x] Confirmed `get_mnty_targeted_advertisements(...)` is the third anon-executable SECURITY DEFINER function and is a parameterized public-advertising read endpoint. Its exact result columns and filtering/search_path require review; no permission change made.
- [x] Inspected deployed Edge Function `directory-listings` v7: GET reads only PUBLISHED listings and selects an explicit public field allowlist; claimed-user/business IDs are stripped from slug responses. POST requires a non-anonymous authenticated user; claim/update paths verify ownership; administrative writes require a platform-admin membership; phone-required publication guard is present. Function is deployed with `verify_jwt=false` but manually validates bearer tokens for all protected POST actions. Remaining tests: direct anonymous POST denial, cross-user claim/update denial, admin-only mutation denial, origin/CORS review, and production endpoint E2E.
- [x] Confirmed employee list/upsert/position RPCs use SECURITY DEFINER with fixed empty search_path and actor/membership/tenant/business/branch checks in the inspected definitions. The list wrapper delegates to the scoped implementation; continue reviewing full function bodies and branch-role matrix with negative E2E tests.
- [ ] Keep the eight no-policy tables fail-closed while validating each Edge/RPC path. In particular, do not create public policies on `public_directory_listings` or `directory_listing_claim_requests`; their intended public access path is the controlled `directory-listings` Edge Function.
- [ ] Continue the authenticated SECURITY DEFINER review by high-risk groups (payments/orders/wallet/settlement, catalog mutations, membership/role management), checking actor spoofing, tenant/branch scope, fixed search_path, and direct RPC negative cases.


## 2026-10-30 — Release execution update after PR #498

- [x] PR #498 (`Prioritize verified activities with complete visual catalogs`) was merged to `main` at commit `f265f8315b6211bd4363071d919848f474bf0dad` after correcting an obsolete geographic-search test assertion.
- [x] Exact main-commit CI passed: Primary Catalog Frontend Validation (build + Professional Dashboard employee RBAC PostgreSQL + Chromium E2E), Backend-only Module Boundary (financial journal + approval audit PostgreSQL integration), Module Professionalization Validation (targeted ads search-path + matrimony privacy PostgreSQL), MantiGO Open Ride Privacy, and Production Health Monitor.
- [x] Deploy MantiqatiX Web completed successfully for the same commit. GitHub Pages deployment validation and public-only validation passed. This is automated deployment/health evidence; manual real-device, accessibility, and signed-in browser regression remain separate.
- [x] Supabase project status read-only check: `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.155.

### Migration parity — fresh read-only inventory

- [x] Current live ledger: 308 rows; latest `20261029083845 require_phone_for_published_directory_listings`.
- [x] Live ledger has 25 rows at/after baseline checkpoint `20261008222845` (including the checkpoint itself); source tree contains 69 migration SQL files with filename timestamps later than that checkpoint.
- [ ] A conservative filename/name comparison finds 44 post-checkpoint source migration names with no same-name ledger row. Some source files have equivalent names under different applied timestamps, so this is NOT proof that every unmatched source file is unapplied. Perform a source-history and physical-schema/effect comparison for every unmatched file before rollout.
- [ ] The originally listed RC425–RC441 historical SQL source files are now present in `main` under `supabase/migrations/`; source recovery is no longer the same blocker as in the original Issue #270 snapshot. Their production ledger/effect mapping and live application status remain open.
- [x] Prior isolated replay evidence remains available: run `40794290701` restored checkpoint `20261008222845` and applied 65 later migrations in timestamp order, including RC457, in a disposable Supabase instance.
- [ ] Production rollout is BLOCKED until the 44 unmatched source names are reconciled against historical/applied equivalents, the exact ordered production migration plan is reviewed, and a backup/restore plus rollback rehearsal is proven. Never insert fabricated rows into `supabase_migrations.schema_migrations`; never blindly replay all source files.
- [ ] A new Supabase development branch is the best available isolated reproduction of the current production schema before applying pending source files. Supabase quoted `$0.01344/hour` for a branch; branch creation is waiting for owner approval of this recurring hourly cost. No branch has been created.

### Additional live security observations

- [x] Security Advisor snapshot remains: 8 RLS-enabled/no-policy tables; 3 anon-executable SECURITY DEFINER findings; 67 authenticated-executable SECURITY DEFINER findings. Per-table/per-function classification is in the preceding 2026-10-30 audit entries.
- [x] Two anon-executable findings (`assign_default_owner_to_unowned_business`, `capture_commission_rule_audit`) were confirmed as trigger-returning functions attached to enabled table triggers; the third (`get_mnty_targeted_advertisements`) is a public advertising-read function. No broad ACL changes were made.
- [x] Live `smm-gateway` remains ACTIVE v13 with `verify_jwt=true`; deployed source hard-codes `SMM_INITIAL_LAUNCH_DEFERRED=true` and returns `SMM_DEFERRED` before auth/body/action processing. Database row counts before a negative runtime test were zero for `smm_orders`, `smm_wallet_transactions`, and `smm_wallets`.
- [ ] Live unauthenticated/anon SMM negative POST tests could not be executed from this session because the execution environment could not resolve the Supabase host via DNS. Source/CI evidence is not a substitute for the required runtime response and no-side-effect check. Keep SMM deferred and do not enable the gateway.
- [ ] Auth leaked-password protection remains an external owner/dashboard check; this session has no authorized Auth configuration-write tool and has not verified the current setting. Do not mark it enabled.
- [ ] Main branch protection/ruleset could not be read through the connected GitHub integration (403 on branch-protection endpoint); Issue #150 remains open and requires owner/admin settings evidence.

### Current release decision

- Automated web deployment of the catalog is successful.
- The overall platform remains `BLOCKED / NOT CERTIFIED` for production launch due unresolved migration parity/rollout, Auth security settings, per-function and per-table security verification, tenant-isolation and customer/provider/order E2E, real Paymob/finance E2E, backup/restore, SMM negative runtime proof, and real-device/browser/accessibility regression.


## 2026-10-30 — Continued production execution (latest verified baseline)

### Merged and deployed catalog/security fixes

- [x] PR #501 merged in commit `0b79c7154d00d1807404f25f6f2a21898f3da012`: fail-closed bootstrap when an active business-scoped membership exists but no authorized business catalog can be loaded. Exact-head catalog build, employee RBAC PostgreSQL integration, Chromium E2E, module/security checks and Production Health Monitor passed; main Pages deployment run `40992263541` completed successfully.
- [x] PR #502 merged in commit `16cd5474d2de6b2c929af7a18491d2ebb53e4fd2`: two additive forward-only repairs restore RC117 provider-profile activity-name synchronization and remove the obsolete 300-row cap from platform business listing. No historical migration was rewritten.
- [x] **Forward replay PASS** on exact source head `03d24fe4a333227a214f07fbe06125030179305f`, workflow run `40992569654`: restored checkpoint `20261008222845`, applied **72** later migrations in timestamp order in a disposable isolated Supabase instance, passed RC117 activity/default-image contract, owner-profile persistence, RC455 commission preview, RC456 resolution preview, and synthetic Tenant A/B read/mutation isolation. Replay only; Production effect NONE.
- [x] Main push replay after PR #502 merge: run `40992913227` completed successfully for merge commit `16cd5474d2de6b2c929af7a18491d2ebb53e4fd2`.
- [x] PR #503 merged in commit `8ac83571d30402064b046f886e10e15d855a0a23`: duplicate-safe in-flight request guard for admin activity creation. Identical payload submissions while a request is pending share one Promise; different payloads remain independent. Existing server-side duplicate guard remains the second defense. Exact-head Primary Catalog build, PostgreSQL employee RBAC, Chromium E2E and module/security checks passed. This is a front-end in-flight guard, not durable server idempotency across restarts/network replay.
- [x] PR #504 merged in commit `f8fb87c9d99cdda36f3895bb8392d2a86a22a07c`: removed retired `https://catalog.tagerflow.com` from directory-listings CORS allowlist; retained canonical GitHub Pages and local development origins.
- [x] Deployed Supabase Edge Function `directory-listings` v8, `verify_jwt=false` unchanged. Read-after-deploy comparison confirms exact entrypoint parity with `main`; retired domain absent. Protected POST handlers continue their manual bearer validation. No endpoint runtime CORS/claim/update request was performed in this session.
- [ ] Main Pages deployment and full authenticated browser/device smoke for commit `f8fb87c9d99cdda36f3895bb8392d2a86a22a07c` must complete and be checked; Production Health Monitor already passed for that commit. CI build and employee RBAC checks passed; Chromium browser E2E/deploy were still running at last check.

### Fresh production migration and object inventory — 2026-10-30

- [x] Supabase production ledger remains **308 rows**, latest `20261029083845 require_phone_for_published_directory_listings`. The newer RC117 repair migrations `20261030100000` and `20261030110000` exist only in `main`; they were replayed in disposable CI only and were NOT applied to Production.
- [x] Fresh read-only check of the 41 required original migration-version identifiers in `scripts/production/verify-production.mjs` returned **0/41 exact versions recorded**. This is an exact version-identity gate; do not assume all physical effects are absent, because some are present via bundled/forward repairs. Do not fabricate migration ledger rows or replay all 41 blindly.
- [x] Fresh targeted physical-object inventory: present are `business_employees`, `business_job_positions`, `platform_custom_roles`, `platform_role_assignments`, `public_directory_listings`, `directory_listing_claim_requests`, `mnty_platform_admin_list_businesses(text)`, `mnty_platform_admin_manage_business(uuid,text,jsonb,text)`, and `post_financial_journal_backend(uuid,jsonb,jsonb)`.
- [x] The six present role/employee/directory tables above have RLS enabled and FORCE RLS enabled. Existing platform business-management functions use empty search_path and authenticated EXECUTE; no new production ACL change was made.
- [ ] Fresh targeted missing-object checks still show critical release drift: `mantigo_payment_provider_events`, `erp_purchase_order_lines`, `process_verified_mantigo_payment_backend`, `process_verified_provider_payment_failure`, `process_verified_subscription_payment_failure`, `process_verified_subscription_payment_backend`, `create_subscription_payment_intent_claimable_backend`, `claim_subscription_provider_intent_creation_backend`, `post_financial_journal_atomic_backend`, `receive_purchase_stock_atomic_backend`, `receive_purchase_stock_with_order_line_backend`, `set_purchase_order_lines_backend`, `create_purchase_order_with_lines_backend`, `uq_payment_intents_one_active_per_order`, and `mnty_default_image_url`.
- [ ] `process_verified_digital_page_payment_backend` exists but live search_path is `public, pg_temp` while reviewed source expects an empty search_path. Verify its body/ACL and callers in staging before considering repair.
- [ ] Production rollout remains BLOCKED: map each absent required version to an exact equivalent live migration statement or physical effect; rehearse ordered rollout, rollback, and backup/restore on a schema-equivalent isolated environment; only then request explicit approval for a production migration window.

### Critical Edge Function source parity — current status

- [x] `directory-listings` v8 is now exact-match with main after the CORS cleanup.
- [ ] Six critical live functions still differ from main and must NOT be deployed individually: `order-create` v8, `payment-intent` v8, `paymob-webhook` v10, `digital-page-payment-intent` v5, `subscription-payment-intent` v4, and `financial-journal` v3. Their differences involve order validation/branch scope, Paymob amount-intent correlation, finite amount checks, or finance RPC/CORS behavior. They depend on matching migration, schema and grants; stage as one coordinated release with Paymob sandbox E2E and rollback.
- [ ] Financial-journal current live prerequisite check remains blocked: `post_financial_journal_backend` is not executable by service_role; required journal columns `entry_number`, `total_debit`, `total_credit`, `posted_at`, and `line_number` are absent; RC449A/RC450 ledger versions are absent. Do not invoke the live finance journal path until the ordered schema/grant contract and reconciliation E2E pass.
- [x] SMM remains intentionally deferred. Live `smm-gateway` v13 is ACTIVE with `verify_jwt=true`, and source hard-gates with `SMM_INITIAL_LAUNCH_DEFERRED=true`; runtime anonymous/authenticated negative requests are still NOT VERIFIED. Do not enable SMM.

### Remaining non-automatable release gates

- [ ] Supabase Auth leaked-password protection and related Auth hardening: still requires owner/dashboard evidence; no setting changed.
- [ ] Main branch protection/ruleset evidence: the connected GitHub integration returns 403 for the branch-protection read; owner/admin must verify protection and required checks.
- [ ] Real Paymob payment and webhook replay/idempotency E2E, customer/provider/order lifecycle, settlement/GL reconciliation, and production credentials: not verified; no real payment attempted.
- [ ] Backup/restore and rollback rehearsal: not verified.
- [ ] Real Android release signing and device regression; real mobile/browser accessibility and authenticated end-to-end smoke: not verified.
- [ ] Runtime negative HTTP tests for SMM and the newly deployed directory-listings CORS/claim/update endpoints: not completed because the current execution environment could not resolve the Supabase host for direct HTTP testing.
- [ ] Creating a Supabase development branch for schema-equivalent rehearsal was quoted at `$0.01344/hour`. No branch was created; obtain owner approval of the recurring hourly cost before doing so.

### Current release decision

- Catalog website deployment and the directory-listings CORS cleanup are deployed.
- The complete forward migration chain now replays in isolated CI, including the RC117 fixes.
- The full platform is still `BLOCKED / NOT CERTIFIED` for production until the exact 41-version ledger/object reconciliation, critical Edge Function/schema parity, Auth security settings, real payment/finance E2E, backup/restore, and real-device/browser gates are closed.

## 2026-10-30 — Latest verified continuation checkpoint (main)

### Catalog and dashboard PR status refresh

- [x] PR #483 Professional Dashboard is MERGED (PR head `81f362912de67ee6cc033a2fc0c6f7660583a4f1`). Dashboard-specific production dependencies were separately verified in the 2026-10-29 read-only checkpoint recorded above; this does not certify unrelated platform modules.
- [x] PR #498 verified/complete-image ranking is MERGED (PR head `3e800351330a7bda72b9f46056014854a69c879c`). Verified activities remain the first ranking tier; completeness ranking applies within the intended tiers.
- [x] PR #500 folder-style functional-group/category/specialty navigation is MERGED (merge commit `723cc04df90b44aae6e65924346f2ae6cdb1f8b8`). Automated mobile/browser coverage is not a substitute for owner visual review on a physical phone.
- [x] Current main head at this checkpoint: `38ffb5063445b8ec50c3d936b2a368a251d77954`.
- [x] Main Pages deployment run `40993279819` completed SUCCESS for the current main head; deployment job succeeded.
- [x] Production Health Monitor run `40993279811` completed SUCCESS for the same main head.
- [x] Module Professionalization Validation run `40993279828` completed SUCCESS for the same main head.
- [x] Primary Catalog Frontend Validation run `40993238078` completed SUCCESS, including build, professional-dashboard browser E2E and employee RBAC PostgreSQL integration. Its tested head is `9d9890d140905fa6815b9da99f726e3dffe9f5e7`, not the later current main head; do not imply that this particular browser suite ran on `38ffb506`.

### Remaining release blockers — unchanged unless a later evidence record says otherwise

- [ ] Production migration reconciliation remains BLOCKED: read-only ledger check records 308 rows through `20261029083845`, with 0/41 exact required release-version identifiers present. This is an exact-version identity gap, not proof that all corresponding physical effects are absent; map every source migration to exact live statement/effect before any rollout.
- [ ] Critical live Edge Functions remain drifted from main: `order-create`, `payment-intent`, `paymob-webhook`, `digital-page-payment-intent`, `subscription-payment-intent`, and `financial-journal`. Do not deploy these individually.
- [ ] Payment/finance production E2E, Paymob callback replay/idempotency, journal/settlement/GL reconciliation remain NOT VERIFIED.
- [ ] Backup/restore and rollback rehearsal remain NOT VERIFIED.
- [ ] Supabase Auth leaked-password protection and broader Auth settings still require owner/dashboard evidence; no change is claimed.
- [ ] Security Advisor requires per-function SECURITY DEFINER and per-table RLS/policy/grant review. Latest 2026-10-30 Advisor output includes 67 authenticated-executable SECURITY DEFINER findings and 8 RLS-enabled/no-policy findings; classify each by intended caller and prove least privilege. Do not revoke broad grants blindly.
- [ ] SMM stays deferred. Live gateway is ACTIVE v13 with source hard gate, but anonymous/authenticated negative runtime tests are NOT VERIFIED.
- [ ] Real Android signing/device regression and complete authenticated customer/provider/owner/admin browser/mobile E2E remain NOT VERIFIED.
- [ ] Branch protection/ruleset evidence still requires repository-owner/admin confirmation; connected integration did not provide the required admin-level branch-protection evidence.

### Release decision

- Catalog website deployment: PASS for current main head `38ffb5063445b8ec50c3d936b2a368a251d77954`.
- Full MantiqatiX platform production certification: **BLOCKED / NOT CERTIFIED**.
- No Production database migration, ledger repair, payment, wallet, Auth-setting, critical payment Edge Function, or SMM enablement was performed in this checkpoint.



---

## 2026-10-30 — Owner specifications 00–19 integrated; TODO governance refreshed

### Persisted source documents

- [x] Preserved the owner's uploaded operating specifications 00–19 verbatim in [docs/specifications/OPERATING_SPECIFICATIONS_00_19.md](specifications/OPERATING_SPECIFICATIONS_00_19.md) so future sessions can read them from the repository without relying on prior chat attachments.
- [x] Verified the uploaded RC40 archive checksum: `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`; it matches the supplied `source_RC40.zip.sha256`.
- [x] Reviewed the RC40 source-package README, `docs/RC40_SCHEMA_RECONCILIATION.md`, `docs/TODO_PRIORITY.md`, and the repository's [RC40 → Web Reuse Matrix](RC40_MODULE_REUSE_EXECUTION_MATRIX.md).
- [x] Updated README session-start instructions to require reading the persisted specifications, RC40 reuse matrix, continuity handoff, session log, and TODO registers.

### Source-of-truth and TODO hierarchy

Use the following hierarchy; these files are complementary, not competing copies:

1. Current `main` source + current verified live contracts/evidence = implementation and runtime truth. A document or old CI result never overrides current evidence.
2. `docs/MASTER_PRODUCTION_TODO.md` = global platform, module, and production-release register.
3. Root `TODO_PRODUCTION.md` = detailed current website/catalog execution register; reconcile shared tasks with the global register by cross-reference, not by deleting either list.
4. `docs/TODO_MASTER_DEVELOPMENT.md` = module-by-module functional scope, prompts, and acceptance criteria.
5. `docs/MASTER_PRODUCTION_TODO_ALL_MODULES_20261006.md`, `docs/MASTER_PRODUCTION_TODO_RC_FINAL_20261006.md`, `docs/TODO_MASTER_DEVELOPMENT_PROMPTS.md`, and other dated TODOs = historical requirement sources. Extract still-valid requirements, compare against current code and evidence, then link or mark superseded with a reason; never bulk-copy stale status claims.

### Non-negotiable UI and architecture guard

- [ ] Preserve the current deployed catalog UI, page hierarchy, visual identity, navigation, activity cards, covers, mobile layout, routes, and current user flows. This is a standing constraint for all subsequent implementation, not a request to freeze backend development.
- [ ] Use additive-first changes. No redesign, replacement, removal, or disabling of existing working screens/functions unless the owner explicitly requests it or a documented defect requires a minimal, reviewed correction.
- [ ] Shared backend/schema/API/business-logic changes require impact analysis for every affected client. Website-only UI changes stay website-specific; Android-specific UX must not be copied into the website.
- [ ] Before each UI-affecting PR, capture/inspect the existing behavior and include a no-regression acceptance checklist. A passing build alone does not prove visual preservation.
- [ ] Do not change current public site identity or restore a legacy site as the primary entry point. The catalog remains the primary website.

### RC40 reuse boundary

- RC40 is a functional/domain/UX reference baseline, not a Production Certified release.
- Reuse validated domain workflows, terminology, sector concepts, and engine patterns through the current web/backend contracts.
- Do not copy Android Room persistence, legacy direct browser writes, obsolete `products`/legacy order models, or any path that bypasses current RLS/RBAC/server-authoritative boundaries.
- Reuse the existing location adapter, bidding contracts, notification backend, financial journal/settlement core, and sync contracts where they already exist; do not create parallel engines or ledgers.
- RC40's schema note records a 103-table snapshot with RLS enabled on all 103 tables. Current web TODO records later schema snapshots with different counts. These are dated observations from different baselines, not values to merge or overwrite. Reconcile against the current live schema before making schema claims or migrations.
- RC40 archive checksum is recorded above; its source contents are not to replace current `main` wholesale.

### Current GitHub continuation checkpoint

- Current `main` baseline inspected for this update: `c47aed3bbf013ca692837f510d08c0b756913deb`.
- PR #499 was rechecked against merged PR #500 and the current `main` source; it duplicated the already-merged folder-style taxonomy browser and was closed as superseded. No rebase or duplicate merge was performed.
- The folder-style taxonomy navigation is present in current `main` through merged PR #500. Runtime/browser/device verification remains open; source presence does not close that gate.
- Other open PRs include catalog/domain cleanup and fixes (#490, #488, #477, #476, #451, #444, #442, #441, #440, #439, #438, #436, #417, #413 and others). Recheck each PR's current state, base, changed files, exact-head checks, overlap, and production impact before deciding to merge, close, or continue it. This list is a snapshot, not a substitute for a fresh query.
- PR #499 was closed as superseded by PR #500. No deployment or visual/browser verification is inferred from that merge; runtime verification remains open.

### New TODO governance actions

- [ ] Build a cross-reference map from every valid requirement in specifications 00–19 to the relevant section/task IDs in the two active TODO registers.
- [ ] Reconcile `docs/TODO_MASTER_DEVELOPMENT.md` module acceptance criteria against the global TODO; keep a single canonical task ID per requirement and link from secondary registers.
- [ ] Inventory dated/historical TODOs and PRs; classify each task as still open, already verified, duplicate, superseded, blocked, or awaiting owner input, with evidence and no destructive mass edits.
- [ ] For every module, maintain a reuse map: existing UI → existing tables/RPC/Edge Functions → RLS/RBAC → integration tests → release gate.
- [ ] Maintain an explicit UI no-regression checklist for all changes affecting the catalog and admin surfaces.
- [ ] Continue the existing policy that DONE/IMPLEMENTED is not VERIFIED, and VERIFIED is not DEPLOYED. Release gates require exact-commit CI plus runtime evidence where applicable.

### Evidence and change scope

- This update is documentation/governance only. No application source, UI, schema, migrations, production data, Supabase settings, Edge Functions, secrets, or deployment targets were changed.
- No build, browser E2E, database integration, or production test is claimed by this documentation-only change.
- Global release status remains **BLOCKED / NOT CERTIFIED** until the current P0 evidence is satisfied.


---

## 2026-10-30 — PR overlap reconciliation

- [x] PR #499 closed as duplicate/superseded after confirming merged PR #500 already provides the folder-style taxonomy navigation and current main contains that implementation.
- [ ] Browser/device verification of the merged taxonomy navigation on the deployed public site remains open.
- [ ] Any distinct behavior found missing from PR #499 must be isolated, reviewed against current main, and reintroduced only as a minimal patch with fresh CI; do not revive or merge the stale branch.
- PR #505 exact-head CI was queued/in progress at the checkpoint; its checks are not marked passed.
- No application source, production schema/data, migrations, Auth/RLS, payments, Edge Functions, secrets, or deployment targets were changed by this reconciliation.
- Production remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-30 — Live critical Edge Function parity recheck

- Read-only retrieval from Supabase project `moyhiluyhjsujhwlyeuu` confirmed that six live critical function entrypoints are not byte-identical to their corresponding `main` sources: `order-create` v8, `payment-intent` v8, `paymob-webhook` v10, `digital-page-payment-intent` v5, `subscription-payment-intent` v4, and `financial-journal` v3.
- Exact live SHA-256 hashes and byte counts are recorded in root `TODO_PRODUCTION.md` under the 2026-10-30 parity checkpoint.
- This is a confirmed source-parity gap; do not infer runtime failure or deploy repository code blindly. Semantic diff and isolated contract/security tests are mandatory before rollout.
- [ ] Review six semantic diffs and dependencies (RPCs, tables, RLS/grants, caller contracts).
- [ ] Test authentication/tenant authorization, amount/currency integrity, webhook HMAC/replay/idempotency, ledger posting and reconciliation in an isolated environment.
- [ ] Establish exact rollback versions and approved rollout plan before any production deploy.
- Read-only inspection only; no production SQL, migration, Edge Function deployment, payment, or data mutation.
- Full platform release remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — RC449A → RC450 ordered disposable integration completed

- [x] Backend-only CI now runs the RC449A schema prerequisite contract validator.
- [x] Exact PR head `155dd540ff32dbb42b0d1fe94d42a3f6945766bd` passed [Backend-only Module Boundary run 40998309448](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40998309448), including PostgreSQL 16 execution of the legacy journal fixture → RC449A → backfill assertions → RC450 → integrity-trigger fixture → RC450 behavioral assertions in one disposable database.
- [x] Verified test coverage: old journal header/timestamp/line-number backfill; service-role-only RPC ACL; user actor binding; tenant/business/branch isolation; balanced journal details; duplicate journal IDs; inactive accounts; cumulative GL balances.
- [ ] This isolated CI run does not authorize or prove production migration safety. Reconcile the complete chronological pending migration chain and historical schema effects before any production change.
- [ ] Production remains blocked pending backup/restore and rollback rehearsal, approved change window, exact live migration preflight, reviewed RPC/function parity, and post-deployment acceptance tests.
- No production Supabase migration, SQL mutation, grant/Auth/RLS change, Edge Function deployment, payment, wallet action, or financial posting was performed.
- Full platform release remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — Fresh physical-object reconciliation (read-only)

- [x] Reconfirmed 308 live migration rows through `20261029083845`; all 41 exact original required release identifiers remain absent.
- [x] Verified that RC113/RC114/RC115/RC116/RC457 dashboard dependencies are physically present through the exact applied forward bundle `20261029041815_professional_dashboard_dependencies_forward_repair` (83,324-character normalized exact statement match). The prior object snapshot that marked these tables/RPCs absent was stale. Their original source version IDs remain absent; the separate user-membership null-safe index is still absent.
- [x] Four role/employee tables are RLS + FORCE RLS with no direct API table privileges. Controlled RPC signatures exist; selected employee and platform-admin write functions were read for actor/membership/scope/audit checks. This is not full authenticated browser E2E.
- [x] RC117 default-image resolver/trigger functions, trigger attachments and marketing_services image columns remain absent; the 2026-10-30 forward fixes are in main/disposable replay only, not Production.
- [x] Confirmed payment/finance/ERP drift: RC425 event table/RPC, RC426 five-arg claim contract, RC427 unique index, RC428–430 webhook RPCs, RC432 wallet index, RC434/435 RPCs, RC436 atomic journal and RC449A/RC450 schema/grants, RC437/438 purchase-order-line objects remain absent or contract-incompatible. RC431's live digital-page payment RPC has search_path drift.
- [x] Confirmed scope drift: RC452 CRM manager-read policies are not tenant/business scoped; RC102 owner-write grants for marketing_provider_services are absent; RC453 campaign objects are absent; RC456 SMM service_role boundary is absent; RC525 digital_page_products admin-write policy does not demonstrate explicit platform-admin scope.
- [x] RC451's forward repair (20261027223523) and the dashboard bundle are recorded. Qadam's follow-up repair (20261027205405) is recorded and live data is ready; original seed version remains absent. RC424 and marketing-contact aliases are known duplicate-source mappings and must not be executed again.
- [ ] Complete source-to-live semantic reconciliation of all remaining required migration effects and aliases before planning Production rollout.
- [ ] Production stays blocked pending complete migration-chain plan, backup/restore + rollback rehearsal, payment/finance E2E, Auth hardening, Edge Function contract parity, and browser/device acceptance.
- No Production database writes, migrations, grants, Auth/RLS changes, Edge Function deployments, payments, wallet operations or financial postings were performed.
- Full platform release remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — RC428 → RC429 → RC430 Paymob webhook integration

- [x] Added PostgreSQL 16 disposable integration coverage for the normal provider failure RPC and subscription failure/success RPCs.
- [x] [RC428–RC430 workflow 41000540681](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41000540681) passed on exact source head `69bece6d280f5a720b2219944dbf7ff6a7aaee2b`; all three migrations applied in order and the complete SQL test returned success.
- [x] Tests verify privileged execution boundary, signed-event binding, provider order and financial correlation, idempotent replay, cross-intent replay denial, no downgrade of final payment state, subscription activation/legal-hold handling, and statement rollback under injected write failures.
- [ ] Disposable test success does not prove the pending historical migration chain safe for Production. Continue source-to-live effect reconciliation, backup/restore + rollback rehearsal, and Paymob sandbox E2E before any rollout.
- [ ] Live `paymob-webhook` and related payment Edge Functions remain NOT VERIFIED for deployment; Production release remains **BLOCKED / NOT CERTIFIED**.
- No Production database/function/payment change was performed.


---

## 2026-10-30 — Payment/finance release evidence refresh

- [x] Merged isolated RC428–RC430 Paymob webhook atomicity coverage in PR #510; PostgreSQL 16 workflow passed.
- [x] Merged isolated RC426–RC427 digital-page provider binding and single-active-payment-intent coverage in PR #511; PostgreSQL 16 workflow passed.
- [x] Existing RC431 digital-page webhook integration passed on current main. Current-main web deployment and Production Health Monitor workflows also passed.
- [ ] These CI/deployment results do not mean Supabase payment migrations or Edge Functions were deployed. Read-only production checks still show the old RC426 function signature, RC431 search_path drift, missing RC428–430/RC435 RPCs, missing RC435/RC439 columns, and RC450 journal EXECUTE/schema gaps.
- [ ] Keep financial/payment production rollout BLOCKED until the entire chronological migration chain is reconciled and rehearsed against a schema-faithful disposable snapshot, with backup/restore, rollback, provider sandbox E2E and exact live-source parity evidence.
- No production database or payment mutation was performed. Overall release remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — Latest payment/finance release evidence (RC435–RC439)

- [x] PR #512 merged: disposable PostgreSQL 16 RC435→RC439 integration passed. It verifies subscription intent ownership/scope, server-priced tier, idempotency, provider claim race/unknown-outcome handling, legacy/correlated intent behavior, service_role-only RPC ACL, and RC439 ciphertext tuple constraints.
- [x] Limitation: the RC439 database integration does not exercise AES-GCM encrypt/decrypt, key rotation, real Paymob checkout or provider sandbox E2E. Those remain required.
- [x] PR #513 RC431 digital-page webhook integration passed; PR #514 evidence register update merged.
- [x] Latest-main web deploy and Production Health Monitor passed on main `0cd3b00ad977bfdf84ff7edcc613acae4ea6138e`.
- [ ] Fresh production read-only verification still shows 308 migration rows through `20261029083845`; RC435 RPCs/columns and RC439 encrypted-secret columns are absent; legacy RC426 four-argument finalizer remains exposed to authenticated and unavailable to service_role; RC450 journal service_role EXECUTE remains absent.
- [ ] Six critical live Edge Function entrypoints remain byte-different from current main. Do not batch deploy; require reviewed per-function diff, dependency/ACL check, Paymob sandbox E2E and rollback plan.
- [ ] Full production remains blocked pending complete ordered migration replay/reconciliation, backup/restore and rollback rehearsal, AES-GCM/key-rotation test, real payment/finance E2E, Auth hardening and browser/device acceptance.
- No production database or payment mutation occurred. Release remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — RC439 checkout key rotation hardening

- [x] PR #518 merged versioned checkout key selection: active key version env with backward-compatible V1 default; versioned server-side key names; encryption with active version and decryption by each row's stored key version; malformed/missing keys fail closed.
- [x] AES-GCM unit tests passed for round-trip, fresh IV, intent/business binding, tamper detection, V1→V2 rotation and legacy V1 decryption after active version changes. RC425 and RC435–RC439 workflow jobs passed on the PR head.
- [ ] Source merge only. Live subscription Edge Function remains v4; no Edge Function deploy or Supabase secret update occurred. Before any V2 activation, retain V1 and configure V2 in Supabase secrets, deploy the reviewed function, and verify staging checkout recovery.
- [ ] Payment schema rollout, Paymob sandbox E2E, backup/restore, six-function parity, Auth hardening and final acceptance remain open. Production remains **BLOCKED / NOT CERTIFIED**.

---

## 2026-10-30 — Security Advisor follow-up and current-main deployment

- [x] Latest-main web deployment after PR #519 passed [41002621137](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41002621137); Production Health Monitor [41002621047](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41002621047) passed.
- [x] Fresh Security Advisor counts: 8 RLS-enabled/no-policy tables, 3 anon-executable SECURITY DEFINER functions, 67 authenticated-executable SECURITY DEFINER functions, and leaked-password protection disabled.
- [x] Read-only ACL/RLS review: all 8 no-policy tables deny direct anon/authenticated table access; 6 also deny service_role direct access, 2 are service_role-only. These are RPC-mediated/deny-by-default candidates; do not add broad policies merely to silence the Advisor.
- [x] The 3 anon SECDEF findings are 2 trigger-returning functions plus the intended public targeted-ad discovery RPC (empty search_path). No blanket revoke.
- [x] The 67 authenticated SECDEF functions break down as 30 search_path=public, 17 public, pg_temp, 19 empty, and 1 public, auth trigger function. RC440 addresses the 30 exact-public functions; its live migration application remains blocked until the ordered chain is reconciled.
- [ ] Leaked Password Protection still needs an authorized Auth dashboard change and Advisor verification. Do not change Auth or grants from this audit.
- [ ] Full production remains blocked by migration ledger/object drift, payment/finance E2E, backup/restore, six critical Edge Function mismatches and Auth hardening.

---

## 2026-10-30 — RC440 integration coverage

- [x] PR #521 merged a dedicated PostgreSQL 16 workflow for RC440. The post-merge main workflow [41003030610](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41003030610) passed.
- [x] Test proves public/pg_temp search_path ordering prevents temporary-table shadowing, preserves intended anon/authenticated EXECUTE grants, skips already-hardened functions, and excludes service_role-only functions.
- [ ] Test success does not mean the migration ran in Production. The 30 live exact-public search_path functions remain pending RC440 application through the full ordered rollout.
- [ ] Leaked Password Protection, payment/finance E2E, backup/restore and six critical Edge Function parity gaps remain open. Release remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — Owner specification traceability map (SPEC-00–SPEC-19)

- [x] Added `docs/specifications/SPECIFICATION_TODO_TRACEABILITY.md` as the cross-reference between all 20 owner specifications, the global production register, the website/catalog register, and the module acceptance blueprint.
- [x] Stable IDs `SPEC-00`–`SPEC-19` identify requirement domains only; existing TODO rows remain canonical and their status was not changed by this mapping.
- [ ] Reconcile `docs/TODO_MASTER_DEVELOPMENT.md` acceptance criteria with the two canonical TODO registers, linking existing tasks and recording only genuinely missing requirements.
- [ ] Verify the merged PR #500 taxonomy folder navigation on the deployed catalog with browser coverage; physical-device/accessibility review remains NOT VERIFIED.
- Current UI no-regression constraint remains mandatory. No redesign, replacement, or destructive cleanup is authorized by this mapping.
- No application/UI source, production database/schema, migration, Auth/RLS, Edge Function, secret, payment, or deployment change was performed. No test or deployment is claimed.
- Overall production release remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — PR #524 merge and exact-head verification

- [x] PR #524 merged as `51fad575eb740d61b3de5ea3a856dbf7cc68bbfd`; owner specifications 00–19 are mapped to the existing global, website/catalog, and module TODO registers.
- [x] Primary Catalog Frontend Validation [41005124723](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005124723) passed build/typecheck, taxonomy/geographic/auth/catalog contracts, isolated employee RBAC PostgreSQL integration, and Playwright browser E2E.
- [x] Playwright now covers the existing PR #500 dedicated folder navigation and passes group/category/specialty selection, back/breadcrumb return paths, and mobile/tablet/desktop overflow checks. No catalog UI code or design was changed.
- [x] Exact-commit backend boundary, module professionalization, SMM deferred contract, MantiGO privacy, RC425 atomicity and flexible commission workflows passed; run IDs are recorded in `TODO_PRODUCTION.md` and `docs/SESSION_LOG.md`.
- [ ] Verify post-merge Pages deployment and deployed-origin Playwright result. PR-only Pages run 41005124658 validated source/build but skipped deployment by design; do not infer publication from PR merge.
- Release blockers from the latest live P0 checkpoint are unchanged. Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — PR #525 catalog confirmation-state counter colors

- [x] PR #525 merged as `3bf212793e61ad6ae47f46e6fa73b0d8b988be4c`.
- [x] Confirmed activity counters remain green; all four titled unconfirmed directory-listing counters now use red styling. Only badge colors changed; no layout or ranking behavior changed.
- [x] Primary Catalog Frontend Validation [41005476492](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005476492) passed build/contracts, PostgreSQL RBAC integration, and Playwright red/green badge assertions.
- [x] Backend boundary, module professionalization, MantiGO privacy, RC425 atomicity, and flexible commission workflows passed on the exact PR commit.
- [ ] Post-merge Pages deployment and deployed-origin Playwright verification remain pending; PR-only Pages validation [41005476412](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005476412) skipped deployment by design.
- Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-30 — Fresh read-only Security Advisor and Edge Function parity checkpoint

- [x] Read-only Supabase project check: project `moyhiluyhjsujhwlyeuu` is `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.155`; production migration ledger contains 308 records through `20261029083845`.
- [x] Fresh Security Advisor observed at approximately 04:58:43 UTC: 8 RLS-enabled/no-policy tables (INFO), 3 anon-executable SECURITY DEFINER functions (WARN), 67 authenticated-executable SECURITY DEFINER functions (WARN), 90 `auth_allow_anonymous_sign_ins` table findings (WARN), and Leaked Password Protection disabled (WARN).
- [x] Read-only `pg_policies` inventory: 485 public-schema policies, 483 targeting `authenticated`, 19 explicitly targeting `anon/public`; 283 authenticated policies textually reference JWT `is_anonymous`, 200 do not. The 19 explicit anon/public policies had zero potentially mutating permissive policies in the aggregate check; public SELECT policies and explicit false-deny policies still require intended-access review.
- [x] Targeted sensitive-table review found finance reads generally scoped by active tenant membership and finance/owner roles, while some user-owned rows rely on `auth.uid()`. Policies without an explicit `is_anonymous` expression are not automatically vulnerabilities; anonymous JWT adversarial tests are still required.
- [x] Read-only deployed-source comparison confirms exact text parity is absent for all six critical Edge Functions: `order-create v8`, `payment-intent v8`, `paymob-webhook v10`, `digital-page-payment-intent v5`, `subscription-payment-intent v4`, `financial-journal v3`. No function was deployed. Text mismatch requires semantic diff and isolated tests; it is not a standalone exploit finding.
- [x] Full evidence and query scope recorded in [`docs/audits/READ_ONLY_SECURITY_EDGE_PARITY_20261030.md`](docs/audits/READ_ONLY_SECURITY_EDGE_PARITY_20261030.md).
- [ ] Complete policy-by-policy review and anonymous/permanent JWT runtime tests for the 90 advisor findings; do not blanket-revoke or blanket-add policies.
- [ ] Review the 70 SECURITY DEFINER findings (ACL, search_path, callers, trigger/public contracts) and prepare semantic parity diffs/tests for the six live Edge Functions.
- [ ] Reconcile all 308 live migration records with the ordered release manifest and required object contracts; no production migrations were applied.
- [ ] Enable Leaked Password Protection only through an authorized Supabase Auth dashboard action, then rerun Advisor. No Auth setting was changed.
- [ ] Verify the post-merge Pages deployment and deployed-origin browser suite for PR #525; PR CI success is not a deployment claim.
- No production schema/data, migration, grant, RLS/Auth setting, Edge Function, secret, payment, wallet, settlement, or financial mutation was performed. Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-30 — Deployed-origin verification complete; Edge drift semantically confirmed

- [x] Main deployment [41005969738](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005969738) succeeded on commit `fe01dce043c8c8b5821ad679b561963a23a5357a`; deployed-origin Playwright suite passed.
- [x] Browser suite confirmed dashboard route guards, owner/employee scopes, unsupported manager denial, permanent QR URL encoding, GPS fallback, taxonomy group/category/specialty navigation, and axe critical/serious checks.
- [x] Read-only semantic diff report added: [`docs/audits/DEPLOYED_EDGE_SEMANTIC_DIFF_20261030.md`](audits/DEPLOYED_EDGE_SEMANTIC_DIFF_20261030.md).
- [ ] Isolated RPC/ACL/schema compatibility and adversarial payment tests are required before any deployed Edge Function can be replaced. Current source review flags subscription payment intent and financial journal as critical drift, with payment-intent and digital-page payment correlation/reconciliation gaps.
- [ ] Continue webhook and order-create semantic trace; verify live SQL RPC definitions, SECURITY DEFINER attributes, execute grants, search_path, and caller contracts.
- Overall Production Gate remains **BLOCKED / NOT CERTIFIED**; no production function, database, Auth/RLS, secret, or financial mutation was performed.


### Live Edge/SQL contract reconciliation — 2026-10-30
- [x] Confirmed RC435 and RC439 migrations are absent from the live ledger; required subscription claim RPCs and provider-creation/encrypted-checkout columns are absent from the production schema.
- [x] Confirmed RC436 is absent from the live ledger; existing financial journal RPCs lack service_role EXECUTE. Current main Edge source calls post_financial_journal_backend, while RC436's service-role-granted atomic contract is post_financial_journal_atomic_backend.
- [ ] Rehearse RC435/RC436/RC439 on a restorable isolated database; validate data preconditions, schema, grants, function definitions, rollback/restore and integration tests before proposing production rollout.
- [ ] Align Edge source with the approved atomic financial journal RPC; do not grant legacy RPCs as a shortcut.
- Keep production release BLOCKED / NOT CERTIFIED.


### Financial journal correction — canonical RC449A/RC450 sequence
- Canonical production sequence is RC449A (20261010175000) followed by RC450 (20261010180000), not RC436 as a substitute.
- Current main financial-journal Edge RPC call matches RC450. The actual live blocker is that both migrations are absent and the live RPC body/ACL is old: service_role EXECUTE=false and actor binding requires auth.uid().
- RC450 runbook, integration tests and validator already exist. Rehearse the exact sequence on a restorable isolated database before proposing production rollout. Never grant the legacy RPC or apply RC436 as a shortcut.
- Report correction is recorded in docs/audits/DEPLOYED_EDGE_SEMANTIC_DIFF_20261030.md. Release remains BLOCKED.


### RLS / Anonymous JWT / SECURITY DEFINER audit — 2026-10-30
- Latest advisor: 90 anonymous policy findings, 67 authenticated-executable SECURITY DEFINER functions, 3 anon-executable definer functions, 8 RLS-enabled tables without policies, and leaked password protection disabled.
- 483 authenticated policies: 283 explicitly check is_anonymous; 200 do not. 215 reference auth.uid(); 103 reference membership. Text presence alone cannot certify access controls.
- Eight no-policy tables have no direct anon/authenticated grants. Six have no service_role table grants; two are service_role-only. This appears to be backend-only by observed ACLs; do not add blanket policies.
- Two anon-executable definer warnings are trigger-only helpers; the third is the public bounded read-only targeted-ad lookup. Confirm with isolated tests.
- Review 67 authenticated definer functions individually. Static inventory: 60 auth.uid, 27 membership, 23 explicit actor comparisons, 37 safer search_path settings, 30 search_path=public only; no unqualified public table references found in the latter static pass. Temp-shadow and caller tests still required.
- See docs/audits/RLS_ANONYMOUS_AND_SECURITY_DEFINER_20261030.md. Production RLS/Auth/ACL remains unchanged; security gate BLOCKED.


## 2026-10-30 — Verified activity external logo/cover links (PR #533)

- [x] Confirmed the production provider profile for **متجر قدم السعد** is ACTIVE and `is_verified=true`; the previous mismatch was that business ACTIVE/subscription state did not itself set the provider profile verification flag.
- [x] Merged PR [#533](https://github.com/islamnagy2022-eng/MantiqatiX/pull/533) to `main` as `f38b609b00fd0025793b00ebf7990073dfaff4c9`.
- [x] Added conditional external `اللوجو` and `الغلاف` links immediately after the verification badge in directory cards and storefront headers. Links appear only for verified activities and only when the corresponding URL exists; card-link clicks do not trigger the card navigation.
- [x] Primary Catalog Frontend Validation run [41015206306](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41015206306) passed its build/TypeScript, isolated PostgreSQL RBAC and browser jobs. Supporting workflows for module boundaries, professionalization, SMM privacy, Paymob atomicity and flexible commissions also completed successfully.
- [ ] **NOT VERIFIED in production yet:** the Pages workflow associated with the PR had its deploy job skipped, as expected for a pull-request event. Verify the post-merge `main` deployment and deployed-origin browser behavior before claiming the live site shows these links.
- [ ] Add focused browser assertions for verified activities with both URLs, logo-only, cover-only, neither URL, and unverified activities; verify keyboard/focus behavior and ensure external links never activate the parent card.
- [ ] Audit the full verified-activity population for valid external `logo_url` / `cover_url` values; do not invent or copy assets between businesses. Missing links should remain absent, not show empty controls.
- [ ] Continue the original catalog acceptance gates: authenticated create/publish/edit/readback, tenant isolation, duplicate prevention, permanent links/QR scans, social links and authenticated AI image generation.
- **Request-to-TODO rule:** every new owner request must be captured in the canonical TODO register, linked to its parent goal/module, assigned a stable reference, and tracked through implementation, tests, deployment and post-deploy verification. Do not close a request at code merge alone.
- Overall Production Gate remains **BLOCKED / NOT CERTIFIED** for the unrelated live security, migration, Edge Function, finance/payment and recovery gates.

 
## 2026-10-30 — PR #533 deployed; PR #534 separates external URLs from display fallbacks

- [x] Main Pages deployment [41015430795](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41015430795) succeeded on main commit `50c1318abaef0958d25a3ddbde59a44365182660`; the deploy job, public-root verification and deployed-origin browser checks completed successfully. This confirmed the initial PR #533 source was deployed.
- [x] Follow-up review found a semantic issue: using `logoUrl` / `coverUrl` for external-link controls could expose generated/default display images as if they were owner-provided external URLs.
- [x] PR [#534](https://github.com/islamnagy2022-eng/MantiqatiX/pull/534) merged as `9cb40af9886e5141702576a7a20f300b78fcff4e`. Added explicit `externalLogoUrl` / `externalCoverUrl` fields, kept display fallback images separate, and exposed those fields through both public directory and direct public-storefront read APIs.
- [x] Added browser E2E cases for verified profiles with both external URLs, logo-only, cover-only, no external URLs, and unverified profiles; also tested direct storefront URL hydration.
- [x] Exact-head Primary Catalog Frontend Validation [41016181188](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41016181188) passed build/typecheck, Playwright browser E2E and isolated PostgreSQL RBAC.
- [x] Exact-head Pages PR validation [41016181132](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41016181132) passed; its deploy job was skipped as expected for a pull-request event.
- [x] Post-merge main Pages deployment [41016389584](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41016389584) succeeded on main commit 31ef40faa136f036ebd7220e682152a79deae139; deploy, primary-root verification and deployed-origin browser suite passed.
- [x] Read-only production audit found 2 ACTIVE verified provider profiles; both have valid HTTPS logo and cover URLs, with 0 invalid non-HTTPS configured values. Missing links remain hidden by the UI.
- The scoped external-link correction is isolated from production data and does not change provider verification status, subscription state, layout, verified-first ranking or existing display images.
- Overall Production Gate remains **BLOCKED / NOT CERTIFIED** for unrelated live security, migration, Edge Function, finance/payment and backup/restore gates.



## CAT-TAXONOMY-REORG-20261030 — إعادة تنظيم المجالات والأنشطة والتخصصات وإعادة توزيع الأنشطة
- [x] اعتماد التسلسل الواضح للعميل: **المجال الرئيسي → النشاط → التخصص/الخدمة**، مع الاحتفاظ بمعرّفات المجموعات الحالية لتجنب كسر الروابط والتكاملات.
- [x] تحسين مسميات واجهة مجلدات الدليل: «المجالات الرئيسية» و«الأنشطة» بدلًا من المصطلحات الإدارية القديمة، مع الإبقاء على صفحة التصفح المستقلة.
- [x] إضافة تصنيف «أدوات صحية وفلاتر مياه» تحت «البناء والتشطيبات والديكور».
- [x] إضافة دعم category code صريح في محول بيانات النشاط وEdge Functions العامة `public-catalog-directory` و`public-catalog`؛ يتم إرجاع الحقول التصنيفية المحددة فقط دون كشف settings بالكامل.
- [x] إعادة توزيع سجلات الأنشطة العشرة الموجودة في جدول businesses إلى أكواد المجال/النشاط المناسبة، مع حفظ activity_specialty كما هو لكل سجل، وتسجيل كل تعديل في audit_logs.
- [x] تحقق قراءة لاحقة: 10/10 سجلات تحمل group/category codes، وكل التخصصات السابقة محفوظة. سجل شعير انتقل من home_maintenance إلى construction_decor / sanitary_ware.
- [x] تدقيق 358 صفحة دليل منشورة غير مطالَب بها: 0 تصنيف يتيم و0 مجموعة غير معروفة بعد إعادة التنظيم؛ إعادة توزيع 8 سجلات قديمة ذات أكواد تصنيف متقادمة/غير موحدة، مع الحفاظ على listing_status وclaim_status والهاتف والمصدر والاسم. سجل الأعلاف والإدارة الزراعية كانا متوافقين بعد إضافة التصنيفات القانونية الجديدة.
- [x] تحديث عقد اختبار البحث الجغرافي ليتوافق مع التسمية الحالية «غير موثق» بدل «غير مؤكد».
- [x] تحديث Browser E2E ليفتح «كافة الأنشطة» ثم يتحقق من التنقل الفعلي مجال→نشاط→تخصص وفق مسميات الواجهة الحالية.
- [x] تحليل فشل Browser E2E على commit `028504f99737e8a095e7296125ac1ac382e595dd`: اختبار 390px كشف overflow أفقي في شارات أعداد الموثق/غير الموثق داخل بطاقات المجالات بعد الرجوع.
- [x] إصلاح responsive للبطاقات بجعل صف الشارات `flex-wrap` وتقليل gap على الهاتف؛ commit `f81bbb2923a6de14e0428a9d5fa67308417d34db`.
- [x] دمج PR [#537](https://github.com/islamnagy2022-eng/MantiqatiX/pull/537) على main بالالتزام `80eeb41e90c133d5b66dea50853ba4306c6424fa`.
- [x] اجتياز build وRBAC وBrowser E2E على رأس PR النهائي [41020400819](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41020400819)، بما في ذلك العودة من مجلد التخصص إلى المجالات على 390px والتحقق من breadcrumb الصحيح بعد العودة للكتالوج.
- [x] اجتياز اختبارات main [41020608750](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41020608750) ونشر Pages [41020608742](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41020608742)، مع فحص جذر الموقع واختبارات المتصفح على النطاق المنشور.
- [ ] إضافة واجهة إدارية آمنة لإدارة taxonomy mapping مع سجل تغييرات ومعاينة قبل الحفظ؛ لا تسمح بإعادة توزيع جماعية مباشرة دون dry-run.
- [ ] المرحلة التالية: مراجعة تداخل المجالات الـ18 الحالية مع المستخدمين الفعليين، وتحديد ما يمكن دمجه في عدد أقل من المجالات دون خلط الأنشطة؛ لا تغيير لمعرّفات legacy إلا بعد خطة توافق وترحيل واختبارات.
- **حدود التنفيذ:** لم تتغير حالات التوثيق أو الاشتراكات أو الملكية أو النشر أو أرقام التواصل أو الصور بواسطة PR #537. إعادة توزيع أكواد taxonomy السابقة موثقة أعلاه بسجل تدقيق مستقل.
- الحالة: MERGED / DEPLOYED / BROWSER VERIFIED — الأعمال الإدارية المتبقية ما زالت مفتوحة.


## SEC-RC458-20261030 — Hardening digital-page payment SECURITY DEFINER RPCs
- [x] فحص Production للـ caller contract والمالك والـ ACL للإجراءات الثلاثة: claim / release / fulfill.
- [x] دمج PR [#538](https://github.com/islamnagy2022-eng/MantiqatiX/pull/538) بالالتزام `64ce588f2e3854e278cb19f18d90018788714d7e`: empty search_path، حفظ authenticated EXECUTE، وتصحيح مرجع `id` الملتبس في claim RPC.
- [x] اجتياز RC458 disposable PostgreSQL integration [41019320495](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41019320495).
- [x] اجتياز full isolated Supabase forward replay [41019320366](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41019320366): استعادة checkpoint `20261008222845` وتطبيق 73 migration لاحقة بالترتيب، مع اختبارات tenant isolation وRC455/RC456.
- [x] اجتياز main RC458 integration [41019626515](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41019626515) وmain forward replay [41019626775](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41019626775).
- [x] إغلاق Issue [#269](https://github.com/islamnagy2022-eng/MantiqatiX/issues/269) بعد استكمال source fix والاختبارات المعزولة.
- [ ] تطبيق RC458 على Production غير منفذ. يلزم مسار release مع backup/restore وrollback وموافقة صريحة؛ لا تنفذ migration مباشرة.
- **الحالة:** SOURCE MERGED / ISOLATED VERIFIED / PRODUCTION NOT APPLIED. بوابة المنصة الكلية تظل BLOCKED / NOT CERTIFIED.


## Latest production handoff delta — 2026-10-31

- PR #555 merged: read-only finance schema/RPC preflight recorded.
- PR #556 merged: clarified that the historical checkpoint is not a current Production clone.
- PR #557 merged: PostgreSQL 16 trigger-only SECURITY DEFINER ACL behavior test.
- PR #558 merged: docs record for trigger ACL evidence.
- PR #559 merged: improved RC435/RC439 and RC449A/RC450 disposable fixtures to satisfy additional observed Production constraints; checkout, recovery and journal workflows passed.
- PR #560 merged: docs record for fixture CI results.
- PR #561 merged: PostgreSQL 16 test applies exact `ALTER FUNCTION ... SET search_path = ''` and `REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role`; both existing triggers still fire under service_role DML.
- PR #562 merged: docs record for trigger test.
- PR #563 merged: fresh read-only Production finance/schema checkpoint.
- Test-only PRs and documentation commits did not alter Production. No migration, grant, Auth, RLS, Edge Function, payment, wallet, or journal mutation was performed.
- Supabase CLI stable `v2.122.0` could not be installed in this runtime: binary download failed and npm bootstrap timed out due external DNS/network access. Do not hand-create migration filenames; create the future migration with `supabase migration new <name>` in an environment with the pinned CLI.
- First remaining executable gate: obtain an approved, restorable, schema-faithful isolated database for the current Production schema; then rehearse the payment/journal forward-only reconciliation and trigger-only security migration.


## 2026-10-31 — Current continuation checkpoint after PR #565

- [x] PR #565 merged to `main` as `3247f53c561e8161075024e0436668460f55d779`; its read-only audit records the current subscription checkout and financial-journal contract gaps. No Production mutation occurred.
- [x] Exact PR-head CI completed successfully before merge; the subsequent main push workflows passed on the merge commit, including Pages deployment [41155204293](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204293) and Production Health Monitor [41155204266](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41155204266).
- [x] PR #543/#546 auth and subscriber-loading fixes remain merged; PR #547 documents their code/build/browser/deployed-origin checks. Real Google-account timing/cross-account and controlled failed-request/manual-retry tests remain NOT VERIFIED.
- [x] Live Supabase was rechecked read-only: 308 migration records through `20261029083845`, one branch (`main`), and Advisor snapshot 8 RLS/no-policy, 3 anon SECURITY DEFINER, 67 authenticated SECURITY DEFINER; performance snapshot 129 unindexed FKs, 375 init-plan findings, 73 unused indexes, 28 permissive-policy groups.
- [ ] Next blocker: obtain explicit user approval for a cost-reviewed isolated environment and a complete credential-scrubbed current-Production schema capture; restore and rehearse before authoring/applying any forward-only reconciliation.
- **Overall Production Gate remains BLOCKED / NOT CERTIFIED.** No production DDL, grants, Auth/RLS changes, Edge Function deployment, secrets, payment, or financial mutation occurred.


## 2026-10-31 — P0 operational continuity addendum (Supabase Free)

35. **Database inactivity/availability monitoring — MERGED / CONTRACT PREFLIGHT PASS / LIVE RUN PENDING**
    - PR [#567](https://github.com/islamnagy2022-eng/MantiqatiX/pull/567) merged as `c8c65e7b4d8cf70e83753e9d194b25f18e5395cb`; PR #568 merged the corrected continuity record as `46a27d9009a092a907b9e5f26ec0dffdcc5b1db3`.
    - The hourly workflow performs a read-only PostgREST GET of `marketing_provider_profiles?select=business_id&limit=1` with the public anon key and discards the response body.
    - Read-only Production catalog preflight confirms the target relation exists, RLS and FORCE RLS are enabled, anon has SELECT, and an explicit public SELECT policy is present. No application row data was read. Evidence: `docs/audits/DB_MONITOR_READ_PATH_PREFLIGHT_20261031.md`.
    - **PARTIAL LIVE EVIDENCE:** Supabase project status returned `ACTIVE_HEALTHY`; a direct read-only SQL `SELECT 1` succeeded at `2026-10-31 01:57:01.957862+00` UTC. This confirms a live database connection at that instant, not the scheduled GitHub Actions PostgREST probe. **NOT VERIFIED:** actual post-merge HTTP probe response from GitHub Actions and GitHub failure-notification delivery. The GitHub connector available here lists PR-triggered runs, not the push-triggered health run.
    - The hourly probe is intended to provide recurring database API activity; Supabase states that a few user API/database requests each day typically suffice to avoid inactivity pausing, but the platform does not guarantee a project will never pause.
36. **Free-tier backup and restore — WAIT / NOT VERIFIED**
    - Run the local Supabase CLI logical backup procedure in `docs/operations/FREE_TIER_DATABASE_CONTINUITY.md` from an authorized device with the database connection string.
    - Store encrypted roles/schema/data dumps outside this public repository; never upload production dumps to public GitHub artifacts.
    - Restore only into a disposable local PostgreSQL/Supabase environment, then verify schema, RLS, grants, critical RPCs, Edge dependencies, and a documented recovery checklist.
    - No backup, restore, rollback, RPO, or RTO claim is complete until actual files and a successful rehearsal are evidenced.


### Post-merge correction — 2026-10-31

- PR [#567](https://github.com/islamnagy2022-eng/MantiqatiX/pull/567) is merged as `c8c65e7b4d8cf70e83753e9d194b25f18e5395cb`; the hourly read-only database probe is now present on `main`.
- All five PR workflow runs passed: [41156511347](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41156511347), [41156511393](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41156511393), [41156511313](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41156511313), [41156511407](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41156511407), [41156511364](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41156511364). Pages deployment was skipped on the PR event as designed.
- Replace the earlier “WAIT: merge” note in item 35 with: **merged; first post-merge live database probe and failure-notification delivery still NOT VERIFIED**.
- Item 36 remains WAIT: no local backup files or restore-rehearsal evidence exist yet.


### Current-main evidence refresh — 2026-10-31 02:30 UTC (PR #576)

- The previous PR #575 checkpoint references are historical; the current main commit is `0236118cd93d6e8330296da4442c2b07c93df211`.
- Current-main monitor #41160201368 passed the live read-only PostgREST HTTP 200 probe; job log ID `124415873930` explicitly emitted `SUPABASE_DATABASE_READ_ONLY_PROBE=PASS`.
- Current-main Pages run #41160201369 completed validate, public-only validation, and deploy jobs successfully. Deployed-root and deployed-origin browser E2E passed (job `124416013202`).
- The latest verifier still reports the scoped catalog pilot PASS while the platform-wide gate remains BLOCKED. This does not change the live migration, Edge, journal, payment, backup/restore, or owner-evidence blockers listed above.
- Notification delivery, backup/restore, RPO/RTO, and real provider/auth/device E2E remain open. No Production mutation occurred.


## CAT-DUPLICATE-GUARD-20261031 — منع تكرار إنشاء النشاط

- [x] الواجهة تستخدم Map داخل AppContext لطلبات إنشاء النشاط قيد التنفيذ، ومفتاح الطلب هو JSON.stringify للـ canonical payload الفعلي؛ الطلبات المتطابقة أثناء التنفيذ تشترك في Promise واحدة، والبيانات المختلفة لا تُدمج.
- [x] Edge Function على الخادم تنفذ duplicate lookup داخل tenant المحدد، وتقارن الاسم والتصنيف ورقم الهاتف أو الموقع، وترجع DUPLICATE_BUSINESS مع HTTP 409 وbusinessId قبل بدء أي insert. لا تُفعّل ولا تنشر ولا تغيّر حالة السداد أو ملكية السجل الموجود.
- [x] Validator مخصص موجود في scripts/validate-business-create-inflight-guard.mjs، واجتاز على main في Pages validation run [41162036127](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41162036127)، وسجل CATALOG_BUSINESS_CREATE_INFLIGHT_GUARD=PASS.
- [ ] **NOT VERIFIED:** اختبار متصفح/خادم حقيقي للنقر المتكرر، تبويبين، إعادة المحاولة بعد انقطاع الشبكة، وطلبات متزامنة. فحص الخادم الحالي check-then-insert وليس قفلًا/قيدًا ذريًا في قاعدة البيانات؛ قد تتسابق طلبات متزامنة جدًا. لا تدّعِ ضمان idempotency على مستوى قاعدة البيانات حتى يثبت ذلك باختبار تنافسي ووسيلة ذرية مناسبة.
- [ ] تحقق من أن الواجهة تتعامل بوضوح مع HTTP 409 عند نجاح الإدخال الأول وفقدان الاستجابة، ولا تعرض للمشغل رسالة توحي بفشل الإنشاء دون توضيح أن النشاط الموجود لم يُنشأ مرة أخرى.
- PR [#477](https://github.com/islamnagy2022-eng/MantiqatiX/pull/477) أُغلق دون دمج في 2026-10-31 بعد تأكيد أن main يحتوي بالفعل على حارس client أدق بمفتاح payload، وحارس server يعيد 409 بدل إعادة استخدام سجل بالاعتماد على heuristic. لا يوجد كود فريد مطلوب من الفرع المغلق.
- لا توجد تغييرات بيانات إنتاجية ضمن هذا الفحص.

## Current-main verification after PR #578 — 2026-10-31

- Main commit: `b7b35378bbf5c1fd5ff54afb6be79e316e33624c`.
- Health Monitor [41162036080](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41162036080) passed; job `124421481814` confirmed `SUPABASE_DATABASE_READ_ONLY_PROBE=PASS` and primary catalog root/assets PASS.
- Backend-only Module Boundary [41162036117](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41162036117), MantiGO Privacy [41162036099](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41162036099), Module Professionalization [41162036130](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41162036130), and Pages [41162036127](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41162036127) all completed successfully.
- Pages deploy job `124421551588` confirmed deployed primary root and `PRIMARY_CATALOG_BROWSER_E2E=PASS` for the tested scoped catalog/role/QR/GPS/taxonomy journeys. The verifier artifact still reports `production_gate=BLOCKED` with 24 PASS, 0 FAIL, 1 BLOCKED; this source-contract report does not certify live production migrations or payment flows.


## 2026-10-31 — P0 live MantiGO settlement authorization drift (read-only recheck 03:25 UTC)

- [x] Rechecked the live Supabase function definition and effective EXECUTE grants read-only. `public.settle_mantigo_captain_backend(uuid,text,text)` is SECURITY DEFINER, has `search_path=public`, and is executable by `authenticated` (not `anon`).
- [x] Confirmed the live body checks `p_admin_user_id = auth.uid()` but then accepts any active membership with role ADMIN, SUPER_ADMIN, OWNER, BUSINESS_OWNER, ACCOUNTANT, FINANCE_MANAGER, or FINANCE. The membership check is not restricted to tenant `MNTY-PLATFORM`, does not require explicit PLATFORM scope/full_control, and does not call `mnty_can_platform_admin()`.
- [x] Confirmed the RPC proceeds to platform-wide MantiGO financial-ledger settlement and journal posting for eligible completed/paid rides. This is a confirmed authorization-contract defect; no evidence of abuse or unauthorized settlement was established.
- [x] Confirmed live migration ledger remains 308 entries through `20261029083845`; RC441 `20261010030000` and RC449 `20261010170000` are absent.
- [x] Source remediation already exists in RC441/RC449 and the isolated RC449 integration test explicitly rejects tenant OWNER, tenant ADMIN, OPERATIONS_MANAGER and tenant-scoped SUPER_ADMIN, while accepting the explicit platform SUPER_ADMIN and testing settlement replay safety.
- [ ] **P0 / BLOCKED:** obtain an approved, cost-reviewed, restorable, schema-faithful isolated environment plus credential-scrubbed current-Production schema capture; rehearse the chronological migration chain and payment/journal dependencies before any Production release.
- [ ] After approved release only: apply RC441/RC449 through the controlled migration process; verify live function body, empty search_path, platform-admin guard and grants; run post-release read-only checks. Never test by settling a live ride.
- Evidence: `docs/audits/MANTIGO_PLATFORM_SETTLEMENT_SCOPE_DRIFT_20261031_0325.md`.
- **Production impact:** no DDL, grants, Auth/RLS, Edge Function, data, payment, wallet, settlement, or journal mutation was performed. Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.


### P0 scope expansion — four live MantiGO platform RPCs

- [x] Expanded the same read-only catalog inspection to all four RC449 platform-wide RPCs. All four are SECURITY DEFINER, `search_path=public`, authenticated-executable, anon-denied, and none calls `mnty_can_platform_admin()`.
- [x] Confirmed the affected surface: global dashboard aggregates; global financial report; captain settlement/journal mutation; stale ride expiration/audit/notification mutation. The live role predicates accept broad tenant-scoped roles and are not constrained to `MNTY-PLATFORM` with explicit `scope=PLATFORM` and `full_control=true`.
- [ ] Keep the P0 release blocker applied to the full four-RPC surface, not only settlement. Do not invoke these global RPCs with non-platform roles against Production to demonstrate the defect.
- The RC449 source migration already adds the explicit platform guard to all four functions; live RC441/RC449 versions remain absent. See the audit document linked above.


## CAT-DUPLICATE-GUARD — stale PR cleanup (2026-10-31)

- [x] Compared Draft PR #477 against current main implementation in `AppContext.tsx` and `catalog-platform-admin/index.ts`.
- [x] Confirmed the old single global in-flight Promise incorrectly collapses different payloads; current main uses a payload-keyed Map and preserves independent requests.
- [x] Confirmed the old server heuristic reuses an existing business record; current main returns tenant-scoped HTTP 409 with the existing business ID and does not transfer ownership or alter billing/publication state.
- [x] Closed PR #477 unmerged as fully superseded; explanatory review comment added. No production data was changed.
- [ ] The current main duplicate guard still needs true browser/server concurrency, multi-tab, and lost-response retry tests; its check-then-insert remains non-atomic at the database layer.


## 2026-10-31 — PR #580 merged; security finding recorded

- [x] Merged PR [#580](https://github.com/islamnagy2022-eng/MantiqatiX/pull/580) to main as `e141aa6208f4f94001ab40447cb1c4c4df47bee4`; added the live P0 MantiGO platform-RPC authorization drift report and updated continuity/TODO.
- [x] Exact PR-head validation passed: Module Professionalization [41164494328], Backend-only Module Boundary [41164494345], MantiGO Open Ride Privacy [41164494317], RC425 Paymob Atomicity [41164494277], and Deploy MantiqatiX Web validation [41164494296].
- [x] Pages deploy job in PR validation was skipped; this documentation merge did not deploy the website or change Production.
- [x] PR #477 stale duplicate-create draft closed unmerged; no unique source change was needed.
- [ ] **P0 remains BLOCKED:** live RC441/RC449 migrations are absent and all four global MantiGO RPCs still require the explicit platform-admin boundary in Production. Do not invoke or mutate live financial/ride RPCs to prove the defect.
- [x] PR [#581](https://github.com/islamnagy2022-eng/MantiqatiX/pull/581) merged to main as `1cd13f868fc845598964e5c8daac4d7e8b6b9a7d` after the dedicated MantiGO Platform Admin Scope Hardening workflow passed, including disposable PostgreSQL 16 fixture + RC449 migration + behavioral integration test. The expanded matrix rejects tenant ADMIN, OPERATIONS_MANAGER and tenant-scoped SUPER_ADMIN across all four global RPCs and checks SECURITY DEFINER empty search_path plus anon/authenticated grants.


### PR #581 exact-head validation evidence

- [x] Dedicated MantiGO Platform Admin Scope Hardening [41164835173] passed: static contract and disposable PostgreSQL 16 fixture + RC449 migration + expanded behavioral tests.
- [x] Module Professionalization [41164835103], Backend-only Module Boundary [41164835132], MantiGO Open Ride Privacy [41164835111], RC425 Paymob Atomicity [41164835212], and Deploy MantiqatiX Web validation [41164835104] passed on the PR head.
- [x] PR #581 merged with tests only. No migration, Production database, payment, settlement, wallet, or Edge Function was changed. PR deploy job did not run a production deployment.
- [ ] Live Production remains unremediated until RC441/RC449 are applied through an approved, rehearsed migration release. Do not treat disposable CI success as proof of live migration application.


## 2026-10-31 — P0 expansion: weak platform-admin helper and digital-pages RLS

- [x] Read-only inspection confirmed live `mnty_can_platform_admin()` delegates to `mnty_can('admin',NULL,NULL,NULL)`; live `mnty_active_membership(NULL,NULL,NULL)` considers all active memberships and `mnty_can('admin')` grants ADMIN permission to tenant OWNER.
- [x] Found four additional live SECURITY DEFINER callers relying on that weak helper: `admin_create_global_ad`, `fulfill_digital_page_publish`, `review_mantigo_captain_application`, and `set_mantigo_financial_config_backend`.
- [x] Confirmed `digital_pages_admin_manage` is a global `FOR ALL TO authenticated` RLS policy using the weak helper for both USING and WITH CHECK. The authenticated role has SELECT/INSERT/UPDATE/DELETE table grants on `digital_pages`; the policy has no tenant/page-owner predicate. This creates a cross-tenant digital-pages access/mutation path for tenant OWNER memberships while the live helper remains weak.
- [x] Confirmed `mantigo_financial_config` and `mantigo_rate_limit_config` policies also use the helper, but authenticated currently has no direct table grants on those tables. The separate MantiGO financial-config SECURITY DEFINER RPC still relies on the weak helper.
- [ ] **P0 / BLOCKED:** full live scope now includes eight global SECURITY DEFINER functions plus the global digital-pages RLS policy. RC441/RC449 source helper hardening is the intended forward-only remediation; neither migration is present in Production.
- [x] PR [#582](https://github.com/islamnagy2022-eng/MantiqatiX/pull/582) merged to main as `061f7a4c3cd2dae22186a1f7f5880aa366e49db9` after dedicated PostgreSQL 16 CI passed. Its disposable fixture reproduces `digital_pages_admin_manage` and proves tenant OWNER cannot SELECT/INSERT/UPDATE/DELETE while explicit platform SUPER_ADMIN can.
- Evidence: `docs/audits/MANTIGO_PLATFORM_SETTLEMENT_SCOPE_DRIFT_20261031_0325.md`. No live data was read, and no Production mutation or RPC invocation was performed.


### PR #582 exact-head validation evidence

- [x] Dedicated MantiGO Platform Admin Scope Hardening [41165149574] passed: static platform-admin contract and disposable PostgreSQL 16 fixture + RC449 migration + expanded RPC/RLS integration.
- [x] Module Professionalization [41165149540], Backend-only Module Boundary [41165149552], MantiGO Open Ride Privacy [41165149604], RC425 Paymob Atomicity [41165149544], and Deploy MantiqatiX Web validation [41165149619] passed.
- [x] PR #582 merged with tests and audit documentation only. The Pages production deploy job was skipped on the PR event; no Production database, migration, payment, settlement, wallet, or Edge Function changed.
- [ ] Production remains **BLOCKED** until the helper fix in RC441/RC449 is applied through an approved, fully rehearsed migration release. The isolated RLS test is evidence for the source contract, not a live Production remediation.


## 2026-10-31 — Supabase Security Advisor triage and exposed-schema audit

- [x] Ran the live Supabase Security Advisor (read-only) and inspected all eight RLS-enabled/no-policy findings at the catalog/grant level.
- [x] Confirmed all eight tables currently deny SELECT/INSERT/UPDATE/DELETE to both anon and authenticated through table privileges; seven have FORCE RLS and `digital_page_payment_events` does not. No direct API grant is present, so the advisor's no-policy warning is not currently an exposed-table bypass. Keep them closed by default; if an API/RPC use case is required, design least-privilege policies and grants first.
- [x] Triaged the three anon-executable SECURITY DEFINER advisor findings: `assign_default_owner_to_unowned_business()` and `capture_commission_rule_audit()` are trigger-returning functions attached only to table triggers (businesses and commission_rules respectively), not ordinary callable RPCs; `get_mnty_targeted_advertisements(...)` is a bounded public advertisement-read function (limit clamped to 1–50) and is intentionally anon-executable. Reassess its public projection/targeting inputs, but do not blindly revoke public access.
- [x] Confirmed the advisor reports 67 authenticated-executable SECURITY DEFINER functions. This is an inventory warning, not proof that all 67 are vulnerable; each endpoint needs grouped review for caller identity binding, tenant/business/branch scope, idempotency, search_path, and grants.
- [x] Identified Supabase Auth leaked-password protection as disabled; add it to the Auth hardening release checklist and verify user-impact/rollout before enabling.
- [ ] P1: produce a complete reviewed inventory of the 67 authenticated SECURITY DEFINER functions, prioritize money, global admin, identity, catalog ownership, and cross-tenant operations; add static/behavioral tests and tighten grants only where client compatibility is verified.
- [ ] P1: document intended no-policy/private-table contract for the eight tables; maintain zero anon/authenticated grants unless an explicitly tested API requirement is approved.
- [ ] P1: review public ad RPC output fields and abuse/rate-limit controls; preserve public listing functionality while minimizing returned data.
- [ ] P1: plan Auth leaked-password protection activation with a user-facing rollout note and verification.
- [ ] P0 remains unchanged: RC441/RC449 absent from live Production; platform-admin helper/RLS authorization drift is not remediated. No production mutation occurred.

- [x] Follow-up on the default-owner trigger: confirmed it is attached to `businesses`; authenticated and anon currently have no direct INSERT table privilege on `businesses`. This reduces the direct client-trigger surface, but the service/RPC creation paths that can insert businesses still need an ownership-attribution and abuse-rate review. No unauthorized assignment was demonstrated.


## 2026-10-31 — Refreshed Security Advisor and merge-conflict follow-up

- [x] Current live migration ledger: 308 records; latest `20261029083845`.
- [x] Security Advisor snapshot 2026-10-31 04:13:52 UTC: 8 RLS/no-policy INFO, 3 anon SECURITY DEFINER WARN, 67 authenticated SECURITY DEFINER WARN, leaked-password protection disabled.
- [ ] Risk-based review of 67 functions remains open; do not blanket revoke authenticated EXECUTE. Classify by function body, caller, authorization predicate, returned data and intended client workflow.
- [ ] PR #508/#535/#551 have successful listed head workflow runs but GitHub merge rejects due conflicts with main. Reconcile onto current main and rerun exact-head CI.
- [ ] PR #540 remains draft, 77 commits behind main; no RC459–RC461 Production rollout.
- No Production mutation. Overall gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-31 — RC441/RC449 source equivalence and dependent-caller review

- [x] Compared the two current-main migration files line-by-line. RC441 and RC449 are substantively identical (same strict platform-admin helper, same four MantiGO RPC definitions and grants); only the RC label in comments and terminal newline differ.
- [x] Confirmed the original RC258 helper defect: nullable tenant/business/branch arguments allow all active memberships into `mnty_active_membership`, while `mnty_can('admin')` grants tenant OWNER the admin permission. New helper requires active platform SUPER_ADMIN + `MNTY-PLATFORM` + `scope=PLATFORM` + `full_control=true`.
- [x] Identified the four other helper-dependent SECURITY DEFINER functions: `admin_create_global_ad`, `fulfill_digital_page_publish`, `review_mantigo_captain_application`, `set_mantigo_financial_config_backend`. Their authorization semantics are corrected through the shared helper; direct isolated invocation tests remain a follow-up for stronger end-to-end evidence.
- [x] RC449 integration test also reproduces `digital_pages_admin_manage` and verifies tenant OWNER cannot SELECT/INSERT/UPDATE/DELETE while platform SUPER_ADMIN can.
- [ ] Preserve both historical migration files. During release rehearsal, execute both in timestamp order and prove the repeated idempotent definitions produce no schema/ACL drift. Do not rewrite historical migrations or infer live state from source.
- [x] Fresh Production migration ledger remains 308 records, latest `20261029083845`; RC441 and RC449 exact IDs remain absent.
- [x] Security Advisor refresh 2026-10-31 04:39:16 UTC: 8 no-policy RLS tables; 3 anon SECURITY DEFINER; 67 authenticated SECURITY DEFINER; 90 anonymous-policy findings; leaked-password protection disabled.
- [x] PR #583 merged as `526fd5308bb2017f2b4a83b33c8b029b9fbbc275` after exact-head CI success; docs-only.
- [ ] P0 release gate remains BLOCKED pending full current-schema rehearsal, backup/restore, adversarial authorization and explicit rollout approval. No Production changes were made.


### Governance alignment item — platform authority registries

A separate source review found a second platform-root authorization model: the newer Super Admin Control Center RPCs (`mnty_platform_admin_*`) authorize against `private.platform_admins`, while the RC441/RC449 MantiGO/global-digital-page helper authorizes against an active `user_memberships` row in `MNTY-PLATFORM` with `SUPER_ADMIN`, `scope=PLATFORM`, and `full_control=true`. These are distinct authority sources, not the same predicate. The platform-control-center design explicitly describes `private.platform_admins` as the protected root registry; an earlier documented production checkpoint (2026-09-27) recorded zero rows, but that count has not been re-read in this session. Do not infer the current registry contents. Before rollout, decide and test whether both sources must agree, whether one is the canonical root, and how bootstrap/revocation keeps them synchronized. This is a governance consistency gap to resolve, not proof of a privilege escalation. No sensitive registry rows were queried.


## 2026-10-31 — P0 platform-admin authority-source convergence review

### Confirmed source-level distinction

- RC113 explicitly states that platform authority remains anchored to `private.platform_admins`. Its Super Admin Control Center RPCs check `private.platform_admins.user_id = auth.uid()` and reject anonymous sessions before reading/managing platform users, memberships, businesses, custom roles and role assignments.
- RC115's `mnty_platform_has_permission` also grants platform-owner authority only from `private.platform_admins`; tenant/business/branch delegated permissions are evaluated separately from scoped employee memberships and `platform_role_assignments`.
- By contrast, RC441/RC449's `mnty_can_platform_admin()` checks only an active `user_memberships` row for `tenant_id='MNTY-PLATFORM'`, role `SUPER_ADMIN`, `scope=PLATFORM`, and `full_control=true`. It does not consult `private.platform_admins`.
- Therefore two distinct authorization sources currently define platform-admin authority. The source does not establish whether this is intentional dual authorization or an incomplete convergence. Do not silently select one model or claim a proven exploit from this observation alone.

### Test coverage gap

- The existing RC449 test fixture defines `user_memberships` and tests tenant OWNER/ADMIN/OPERATIONS_MANAGER/tenant-scoped SUPER_ADMIN against the global RPCs and `digital_pages` RLS.
- It does not define `private.platform_admins` or seed the explicit platform test user in that registry. As a result, its positive case proves only the membership-based model; it does not verify alignment with the registry-based Control Center model.
- Required new isolated cases, after the canonical policy is approved:
  1. Membership-only `MNTY-PLATFORM` SUPER_ADMIN with `scope=PLATFORM/full_control=true` but absent from `private.platform_admins` must be rejected if the registry is canonical.
  2. Registry-only platform admin without an active platform membership must have an explicitly documented expected result.
  3. A registered platform admin with active platform membership must pass the selected policy.
  4. Tenant OWNER, tenant ADMIN, OPERATIONS_MANAGER, and tenant-scoped SUPER_ADMIN remain denied across all eight helper-dependent global operations.
  5. Verify revocation/removal behavior and audit attribution in the isolated fixture.

### Historical bootstrap source limitation

- The historical RC42 manifest records production migration identifiers for platform authority, atomic registration review, bootstrap authority and the MNTY owner bootstrap. The corresponding exact candidate SQL paths `20260927065218`, `20260927065247`, `20260927065347`, and `20260927131555` were not found on current `main`; do not reconstruct their SQL from names. The later `20260927140202_lock_platform_admins_rls.sql` is present, while the manifest also records a live version alias `20260927140200`.
- The existing test fixture describes `private.platform_admins(user_id)` as a primary key referencing `auth.users(id)`, but that fixture is not proof of the complete live DDL or bootstrap semantics.
- No current production rows or identities from `private.platform_admins` were queried in this review. A 2026-09-27 documentation snapshot had recorded zero rows then; that historical count must not be presented as the current count.

### Next required decision and controls

- [ ] Recover authoritative historical SQL/history for registry creation, service-role bootstrap and MNTY owner bootstrap; compare with current live objects and grants.
- [ ] Define one canonical platform-root authority contract and explicitly document whether MNTY platform membership is an additional operational constraint or a redundant second root source.
- [ ] Align the forward-only helper migration and the RC449 disposable fixture/integration tests with that contract. Preserve RC441/RC449 historical files unchanged.
- [ ] Add adversarial tests for registry-only, membership-only, synchronized, suspended/revoked, and non-platform tenant identities before any production rollout.
- Production migration ledger was freshly rechecked at 308 records through `20261029083845`; RC441 and RC449 remain absent. Security Advisor at 2026-10-31 06:39:56 UTC: 8 RLS/no-policy findings, 3 anon-executable SECURITY DEFINER findings, 67 authenticated-executable SECURITY DEFINER findings, 90 anonymous-policy findings, and leaked-password protection disabled.
- No Production DDL/DML, grant, RLS/Auth change, registry-row read, Edge deployment, payment, settlement or journal mutation occurred. Overall gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-31 — RC462 proposed forward convergence (source PR; not production)

- [x] Added forward-only migration `supabase/migrations/20261031064300_rc462_platform_admin_registry_authority_convergence.sql` on an isolated feature branch. It aligns `mnty_can_platform_admin()` with the authoritative `private.platform_admins` registry used by RC113/RC115; it does not modify RC441/RC449 historical files.
- [x] Added a migration preflight requiring the private registry and all four RC449 MantiGO global RPCs to exist and call the shared guard. This prevents applying RC462 before RC449's function replacements.
- [x] Expanded disposable PostgreSQL fixture to model the private registry with RLS + FORCE RLS and no direct client grants.
- [x] Expanded integration coverage: membership-only MNTY-PLATFORM SUPER_ADMIN is denied; registry-only platform admin is permitted; registry deletion immediately revokes platform authority; the existing four global MantiGO RPC tests and digital_pages RLS tests remain in the suite.
- [x] Updated the dedicated CI workflow to apply RC449, then RC462, then the behavioral integration test; updated the static validator to inspect all eight shared-helper-dependent source functions.
- [ ] Exact-head PostgreSQL CI and full repository checks are pending. Do not merge until all checks pass and the final diff is reviewed.
- [ ] Production rollout requires full current-schema restore/replay, reconciliation of both historical RC441 and RC449 IDs in order, backup/restore and rollback rehearsal, verification that the real service-role bootstrap correctly provisions/removes `private.platform_admins` entries, and explicit release authorization.
- No production registry rows were read or changed. No Production DDL/DML, grants, RLS/Auth setting, Edge deployment, payment, settlement or journal mutation occurred. Overall gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-31 — RC462 merged; Production intentionally unchanged

- [x] PR [#592](https://github.com/islamnagy2022-eng/MantiqaTix/pull/592) merged to `main` as `911f91f7f7e0f2d70bd290467ac33b53dc4f5b30`. The merged source adds forward-only `20261031064300_rc462_platform_admin_registry_authority_convergence.sql`; RC441/RC449 historical files remain untouched.
- [x] Exact candidate head `02265e95260dfdfebf1821647086ec3bdb54502d` passed 12 required GitHub Actions workflows: MantiGO Platform Admin Scope Hardening, Forward Migration Chain Replay from Production Schema Checkpoint, Migration History Immutability, Migration Version Uniqueness, Open PR Migration Collision Guard, RC425 MantiGo Paymob Atomicity, Approval Action Audit Atomicity, MantiGO Open Ride Privacy Boundary, Backend-only Module Boundary, Module Professionalization Validation, SMM Deferred Storefront Contract, and Deploy MantiqatiX Web.
- [x] Dedicated registry-convergence PostgreSQL test run: [41178333719](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/41178333719) PASS. It applies fixture → RC449 → RC462 → behavior tests and verifies membership-only denial, registry-only acceptance, removal/revocation, MantiGO global RPC guards and `digital_pages` RLS. Initial attempt failed because the test did not restore the `auth.uid()` actor before a settlement assertion; the fixture was corrected to restore the registered platform actor and the exact-head rerun passed. No test was disabled.
- [x] Chronological isolated Supabase replay: [41178333682](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/41178333682) PASS. Restored the captured schema checkpoint, applied every later tracked migration in timestamp order, and ran dependent contract/tenant-isolation tests. This is an isolated replay, not authorization to mutate live Production.
- [x] Other 10 workflows on the exact candidate head also passed, including migration immutability/version/collision checks, Paymob atomicity, approval audit, MantiGO privacy, module boundaries, professionalization, SMM contract and web deploy.
- [x] Fresh read-only Production recheck after merge: 308 migration records, latest `20261029083845`; RC462 version `20261031064300` is absent. RC441 and RC449 remain absent as well. Therefore the new guard exists in `main` source but is NOT active in Production.
- [x] Security Advisor refreshed at 2026-10-31 06:54:55 UTC: 8 RLS-enabled/no-policy INFO findings; 3 anon SECURITY DEFINER warnings; 67 authenticated SECURITY DEFINER warnings; 90 anonymous-policy warnings; 1 leaked-password protection warning. This is an inventory; do not blanket-revoke or add broad policies.
- [ ] Before any Production rollout: recover authoritative historical bootstrap SQL for `private.platform_admins`; verify the legitimate server-side provisioning/removal path without exposing registry rows; rehearse the exact ordered RC441 → RC449 → RC462 effects against a restorable current Production schema; obtain off-site backup + successful restore/rollback evidence; inspect final live ACL/search_path/function bodies; complete auth/payment/finance and tenant-isolation E2E; and obtain explicit rollout authorization.
- No Production DDL/DML, grants, RLS/Auth settings, registry-row reads, Edge deployments, payments, refunds, settlements or journal mutations occurred. Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.


## Cross-session request ledger — mandatory update 2026-10-31

- **Permanent intake rule:** every new MantiqatiX request in every session must be recorded in GitHub master issue [#599](https://github.com/islamnagy2022-eng/MantiqatiX/issues/599) and in the relevant detailed TODO section before implementation.
- Protocol document: [CROSS_SESSION_TODO_PROTOCOL.md](./CROSS_SESSION_TODO_PROTOCOL.md). Every session must read it, [PROJECT_CONTINUITY.md](./PROJECT_CONTINUITY.md), and this Master TODO.
- Each request must have status, priority, dependencies, acceptance criteria, implementation refs, tests/evidence, remaining work and next action. Session end never closes unfinished work. DONE ≠ VERIFIED.
- **Current main checkpoint:** `7f989e02dc8e7d8c828157978928c185ec6b71c8` (2026-10-31).
- **Latest catalog result:** PR #597 merged; Primary Catalog Frontend Validation #1148 passed; Pages deployment run [41179817673](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41179817673) passed deployed-origin browser tests. The Zefta scenario uses a controlled fixture; TODO #591 remains open until actual live-directory filtering is verified separately.
- **Unified/Professional Dashboard:** source PR #483 is merged; current main reports `PROFESSIONAL_DASHBOARD_PRODUCTION_DEPENDENCIES=PASS`; deployment and tested deployed-origin owner/employee/branch/QR journeys pass. Remaining scope is the full Super Admin Control Center, module-specific permission enforcement, real-data coverage, complete screen/action matrix and full dashboard E2E. See master issue #599 and `docs/RC113_RC115_SUPER_ADMIN_CONTROL_CENTER.md`.
- **Global release state:** `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`. Current verifier still reports 0/41 required release migration IDs, 32/60 non-PASS object checks, six critical Edge Function drifts, RC449A/RC450 journal schema/ACL blockers, and payment/finance, Auth hardening and backup/restore evidence outstanding. Catalog pilot PASS does not certify the platform.
- Open workstreams and PR triage are indexed in master issue #599. Do not treat historical TODO snapshots as current without checking exact main and live evidence.
