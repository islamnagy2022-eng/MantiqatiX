# MANTIQATIX — Production TODO Master List

حالات العمل: TODO / IN PROGRESS / WAIT / BLOCKED / DONE / VERIFIED / NOT VERIFIED.  
قاعدة الإغلاق: DONE لا تعني VERIFIED.

## P0 — بوابة الإطلاق (لقطة تحقق مجمعة 2026-10-31)

- [🟢] Main source CI and web deployment: main commit `9d614e69e66145af78e92df4eb29386ba731ee93` after PR #546 passed TypeScript/build, Google OAuth/session and membership contracts, dashboard browser E2E, employee RBAC PostgreSQL, Pages deployment, deployed-root verification, and deployed-origin routes/mobile/membership/permanent-QR browser checks. Evidence: Pages/deployed-origin [run 41137037072](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41137037072), primary frontend validation [run 41137037052](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41137037052), Production Health Monitor [run 41137037064](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41137037064). This certifies the web catalog deployment path only; it does not clear the global platform Production Gate.
- [ ] Auth production: Google OAuth end-to-end، session refresh/expiry، logout، membership approval، multi-role and tenant isolation. **NOT VERIFIED.** Supabase Auth Leaked Password Protection is currently disabled.
- [🟡] Authorization/RLS: prior baseline confirmed 111/111 tables with RLS. Latest Security Advisor reports 8 RLS-enabled tables without policies; read-only privilege review found no direct anon/authenticated table access on those 8. Six also have no direct service_role access; two are service_role-only. Preserve deny-by-default/RPC-only contracts; no broad policies added. A 2026-10-31 read-only synthetic anonymous-JWT claim probe (`current_user=authenticated`, `is_anonymous=true`, nonexistent UID) returned zero visible rows from 12 accessible sensitive relations; five additional inspected relations denied authenticated SELECT at the table-privilege layer. This is a useful negative check, not real Supabase anonymous-login or adversarial cross-tenant proof. Expanded read-only coverage across 77 RLS-enabled public tables returned zero rows in 73; the four with rows were active showcase businesses and active public marketing provider/catalog data. A separate `SET LOCAL ROLE anon` read-only probe confirmed direct anonymous SELECT can read 10 ACTIVE marketing provider profiles, 16 ACTIVE provider-service rows, and 122 ACTIVE marketing service rows. Four of those 10 active profiles have non-null `owner_user_id`, and all 10 have non-null `settings`; those two columns are currently selectable by `anon`. This is a confirmed over-broad public column surface, not evidence of an observed external exploit. No grant or policy change was made.
- [🟡] SECURITY DEFINER and EXECUTE: read-only Security Advisor snapshot observed `2026-10-30T22:17:57Z` reports 67 authenticated-executable and 3 anon-executable SECURITY DEFINER functions. Prior authenticated function search_path distribution remains 30 exact public, 17 public then pg_temp, 19 empty, and 1 public/auth trigger. RC440 integration passed in isolated PostgreSQL and on main [run 41003030610](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41003030610), but RC440 has NOT been applied to Production. No bulk revokes.
- [🟢] Data API grants baseline: prior targeted review found no broad anon write grants; per-function/table least-privilege review and adversarial E2E remain open.
- [🟡] Database integrity: full migration reconciliation remains a blocker. Production ledger has 308 records through 20261029083845; 0/41 exact required release migration IDs are recorded. This is a ledger-identity finding, not proof that every migration effect is absent. The current manifest tracks 60 required object contracts with a mixture of present, missing and blocked effects.
- [ ] API/Edge Functions/integrations. **NOT VERIFIED for production payment runtime.** Six critical live entrypoints remain different from current repository source: order-create v8, payment-intent v8, paymob-webhook v10, digital-page-payment-intent v5, subscription-payment-intent v4, financial-journal v3.
- [ ] Website/Admin/Owner/Manager/Employee/Customer E2E. **NOT VERIFIED** with real authorized identities across tenants/branches.
- [🟡] Finance backend controls: RC426–RC431, RC435–RC439 and RC450 isolated PostgreSQL CI jobs pass. **Paymob sandbox and real payment/finance/settlement E2E remain NOT VERIFIED.** Live RC435/RC439 schema/RPC requirements and RC450 journal schema/ACL requirements remain missing or mismatched.
- [ ] CRM + Marketing E2E.
- [ ] Regression كامل.
- [ ] Backup/Restore/DR test. **NOT VERIFIED — no restore rehearsal evidence.**
- [🟡] Monitoring/alerts/logging: Production Health Monitor passes; incident classification, alert delivery, recovery drill and measured RPO/RTO remain NOT VERIFIED.
- [ ] Production configuration/secrets. Checkout key rotation source is merged with V1 default and V1→V2 tests; live subscription Edge Function remains v4, no function deploy or secret update occurred.
- [ ] Build/Release/Rollback: web CI/deploy is verified, but backend schema/function release sequencing, signed Android build and rollback rehearsal remain open.
- [ ] External browser/device tests. Deployed-origin browser CI passed for tested routes; real-device, accessibility, offline/PWA and full authenticated role journeys remain NOT VERIFIED.
- [ ] Release approval موثق. **Overall Production Gate: BLOCKED / NOT CERTIFIED.**

## P1 — Website / Platform
- [x] Website baseline/PWA/brand.
- [x] Google OAuth sign-in path; authenticated browser/session lifecycle remains NOT VERIFIED.
- [x] user_memberships + active role.
- [x] Feature flag reading.
- [x] إزالة الأرقام التشغيلية الوهمية من الواجهة.
- [🟡] تطبيق feature flags على visibility/actions مع safe defaults — إضافة resolver للنطاقات GLOBAL/SECTOR/TENANT/BUSINESS/BRANCH، وأولوية override، وguard للوحدات المتوقفة؛ يلزم تحقق CI ومراجعة استخدام feature-level guards.
- [x] loading/error states — تمت إضافة حالة تحميل وحالة خطأ مع إعادة المحاولة.
- [ ] responsive/accessibility review.
- [ ] تنظيف legacy/duplicate render paths.
- [ ] route/import/smoke tests.
- [x] snapshot كامل بعد CI ناجح — آخر baseline موثق في CI run #110.

## P1 — Marketing & Advertising
- [x] Live counts حيث تتوفر بيانات فعلية.
- [x] إنشاء marketing lead فعلي عبر RLS.
- [🟡] قائمة leads + التفاصيل + lifecycle — أضيفت تفاصيل Lead للقراءة وفق RLS في commit `9cbae8375ab39c835b7d3ff92c0c8bef49204064`؛ lifecycle والتحديثات ما زالت متبقية لأن `marketing_leads` لا يملك حاليًا UPDATE policy للمستخدم.
- [ ] مقدمو خدمات التسويق: profiles/services — profiles قراءة فعلية في CRM، والخدمات التفصيلية ما زالت متبقية.
- [ ] marketing projects + participants.
- [ ] provider subscriptions.
- [ ] commission rules.
- [ ] advertisements + ad_spaces.
- [ ] دورة الإعلان Draft → Review → Approved → Published → Hidden/Archived.
- [ ] تقارير الحملات مع FACT/CALCULATION/ANALYSIS/EXCEPTION/RISK.
- [ ] إعادة تسمية/توحيد «التسويق الإلكتروني» ضمن منظومة التسويق والإعلان بدون كسر المسارات القديمة.

## P1 — CRM
- [ ] العملاء الحقيقيون.
- [x] leads — عرض بيانات فعلية ضمن CRM.
- [ ] lifecycle: acquisition/qualification/contact/follow-up/offer/conversion/retention/retargeting — يحتاج نموذج أحداث/صلاحيات UPDATE موثق قبل التنفيذ.
- [ ] سجل التفاعلات.
- [ ] مهام المتابعة والمسؤول.
- [x] ربط CRM بالطلبات والخدمات.
- [ ] tenant/business isolation.
- [x] منع KPI غير مستند إلى بيانات — المؤشرات غير المتوفرة تعرض — بدل أرقام مصطنعة.

## P1 — Support & Governance
- [x] عداد التذاكر وفق RLS.
- [x] إنشاء تذكرة دعم فعلي.
- [🟢] قائمة/تفاصيل التذاكر — واجهة تفاصيل التذكرة وThread الرسائل وفق RLS؛ CI #118 نجح على `4947decd99ffebd2cf1496479f9eb87ac9c878d2`.
- [🟡] ticket messages/status workflow — قراءة وإضافة الردود تعمل؛ أضيف تحديث حالة محكوم بـRLS وقيد DB للحالات `OPEN/IN_PROGRESS/RESOLVED/CLOSED` في commit `e12d8c0fa2281d3761f0659986b34068f7bafcb0`، والتحقق الآلي لهذا التعديل ما زال منتظرًا.
- [ ] Support/Support Manager authorization.
- [ ] Audit للعمليات الحساسة.
- [ ] notifications لحالات الدعم.
- [ ] complaints/exceptions إذا كانت ممثلة فعلياً في schema.

## P1 — Users / Roles / Permissions
- [x] قراءة العضويات.
- [x] عرض الدور النشط.
- [ ] role + permissions matrix.
- [ ] UI guards مع بقاء RLS هو الحاجز الحقيقي.
- [ ] إدارة المستخدمين للمخولين فقط.
- [ ] feature enable/disable per scope.
- [ ] Audit للإجراءات الإدارية.
- [ ] session/JWT lifecycle review.

## P1 — Orders / Operations
- [x] orders list وفق RLS.
- [🟡] order details — expanded the RLS-scoped order query to include immutable line-item pricing snapshots and customer delivery details; UI contract validation pending.
- [x] order status history.
- [ ] user/business/branch links.
- [ ] idempotency.
- [ ] unauthorized mutation protection.
- [ ] module-specific operations.
- [ ] task lifecycle TODO/IN PROGRESS/WAIT/BLOCKED/DONE/VERIFIED.

## P1 — Finance
- [ ] payment intents/events/provider events.
- [ ] commissions.
- [ ] subscriptions/packages.
- [ ] refunds/payouts/settlements.
- [ ] ledger/journal validation.
- [ ] reconciliation + duplicate/conflict detection.
- [ ] FACT/CALCULATION/ANALYSIS/EXCEPTION/RISK separation.
- [ ] server-authoritative sensitive financial actions.
- [ ] daily/weekly/monthly reports.

## P1 — Providers / Sectors
- [🟢] مصدر موحد للقطاعات/المجالات/الخدمات — تم توحيد دليل القطاعات العام، قاعدة `business_sectors`، ومساحة التطبيق على Registry برمجي واحد من 27 قطاعًا؛ مع منع توجيه القطاعات غير الموصولة إلى وحدات غير مطابقة.
- [🟢] التحقق من seed الحقيقي لـ business_categories/modules — تم التحقق من `business_categories`: 27/27 ACTIVE وتغطي 27/27 قطاعًا بعد RC368؛ `business_modules` تحتوي 24 module codes تشغيلية، ولا تُعامل كمرادف لعدد القطاعات.
- [ ] provider profiles + verification/featured.
- [ ] sector-specific packages/commissions/ranking.
- [ ] tenant/business/branch isolation.
- [ ] specialized sector flows.

## P1 — Content / Platform Management
- [ ] Draft → Review → Approved → Published → Hidden/Archived.
- [ ] services/packages/offers/pages management.
- [ ] منع نشر غير معتمد.
- [ ] shared-content consistency بين Website/App/Admin.
- [ ] content audit trail.

## P1 — Analytics / Reports
- [ ] operational dashboard from real data.
- [ ] customers/providers/marketing reports.
- [ ] finance/commission reports.
- [ ] usage/conversion/growth.
- [ ] FACT/CALCULATION/ANALYSIS/EXCEPTION/RISK/NOT VERIFIED labels.
- [ ] no hardcoded metrics.

## P1 — Automation / Notifications
- [ ] Event → Validation → Action → Log → Notification.
- [ ] order/support/lead/campaign notifications.
- [ ] idempotency.
- [ ] automation error log.
- [ ] enable/disable by authorized scope.
- [ ] notifications RLS/read/update verification.

## P1 — Monitoring / Maintenance
- [ ] runtime/JS errors.
- [ ] Auth failures.
- [ ] API/database errors.
- [ ] performance.
- [ ] external integrations.
- [ ] incident classification/root cause.
- [ ] post-fix monitoring.
- [ ] incident log + baseline.

## P1 — Backup / Recovery
- [ ] backup policy.
- [ ] real Restore test.
- [ ] RPO/RTO.
- [ ] rollback runbook.
- [ ] Disaster Recovery runbook.
- [ ] periodic restore test.
- [ ] إثبات أن النسخ قابلة للاستعادة.

## P1 — QA
- [ ] type/lint/static checks.
- [x] JS syntax — active legacy web checks pass CI; the retired SMM storefront JavaScript is no longer part of the client build.
- [ ] routes/imports/environment.
- [ ] DB/API tests.
- [ ] Auth/Authz.
- [ ] functional tests.
- [ ] security tests.
- [ ] regression.
- [ ] browser/device/mobile.
- [ ] كل إصلاح يُختبر في سياقه والمناطق المتأثرة.

## P1 — Release
- [ ] Development → Testing → Staging → Production.
- [ ] Release Candidate.
- [🟢] CI success — run #114 نجح للـcommit الحالي `d58e1360a170bce596494b2aeb37b5166fff6a5b`.
- [ ] release notes/version/tag.
- [ ] rollback rehearsal.
- [🟡] production smoke test — CI deployment verification is green; real browser/device interaction remains NOT VERIFIED.
- [ ] post-release monitoring.
- [ ] Baseline جديد بعد تحقق فعلي فقط.

## P2 — Design / Brand
- [ ] مراجعة الهوية على كل الشاشات.
- [ ] typography/spacing/components.
- [ ] accessibility/contrast.
- [ ] mobile UX.
- [ ] CTA consistency.
- [ ] rights verification للأصول الخارجية.
- [ ] commercial asset pack.

## P2 — Mobile App
- [ ] التطبيق عميل ثانٍ لنفس Backend/API/Business Logic.
- [ ] shared auth/contracts.
- [ ] عدم تكرار business/security logic الحساس.
- [ ] mobile-specific UX.
- [ ] build/sign/release.
- [ ] App regression مقابل Website/API.

## P2 — SMM (deferred from initial launch)
- [x] Confirmed launch scope: SMM is separate from the core Marketing & Advertising module and is deferred until a separately reviewed post-launch release.
- [x] Retired the unused interactive customer-side storefront files (`web/smm.js` and `web/smm.css`); kept `web/smm.html` as a noindex informational page stating that orders are unavailable.
- [x] Added a CI contract ensuring the placeholder has no interactive form/script/API calls and the server-side default-deny gate, authorization contract, and historical migration remain present.
- [🟡] Live source parity VERIFIED read-only on 2026-10-27: deployed `smm-gateway` version 13, bundle SHA `a45cee9f5c90beba2c2409ba4fe2927f5be3df4965fb3929f5b7d467b3121b72`, all 7 deployed TypeScript files exactly match `main`, and `SMM_INITIAL_LAUNCH_DEFERRED=true`. **NOT VERIFIED:** anonymous/authenticated negative runtime tests; keep the overall release gate blocked until these are recorded.
- [ ] POST-LAUNCH: provider/service/order/wallet review, platform RBAC, provider credential isolation, idempotency/order events, wallet reconciliation, monitoring, and administrative authorization.
- [ ] Do not delete deployed Edge Function source, security tests, or historical database migrations as part of frontend cleanup; no production schema or function changes are authorized by this task.

## P2 — Specialized Modules
- [ ] Retail/Fashion.
- [ ] Grocery/Supermarket.
- [ ] Restaurants/Kitchens.
- [ ] Medical: Clinic/Pharmacy/Lab/Radiology/Hospital.
- [ ] Maintenance.
- [ ] Professional services.
- [ ] MantiGO/reverse bidding.
- [ ] Matrimony.
- [ ] Jobs.
- [ ] Schools/Tutoring.
- [ ] Used Items.
- [ ] Accounting/Companies/Marketing/Factories/Trips/Legal/ERP.
- [ ] RBAC/RLS/integration/regression لكل موديول قبل VERIFIED.

## P3 — Commercial / Operations
- [ ] توثيق العمولة.
- [ ] الاشتراكات والباقات.
- [ ] provider onboarding.
- [ ] customer onboarding.
- [ ] privacy/terms.
- [ ] disputes/support policy.
- [ ] launch plan.
- [ ] post-launch operating plan.

## Latest security patch
- VERIFIED: `support_tickets_update_staff` now enforces the actor's ACTIVE membership on the row's current `tenant_id` in both `USING` and `WITH CHECK`, closing the previous `WITH CHECK = true` gap that could have permitted tenant reassignment during an authorized update.
- NOT VERIFIED: cross-account adversarial E2E of support tickets; requires real authenticated test accounts.

## Current verified state
- BRAND: `MantiqatiX` is the sole official public/customer-facing brand name; legacy `MNTY` identifiers are internal technical contracts only.
- PRODUCT MODEL: Customer ↔ Service Provider with Operational Service Map only when location is operationally necessary; no general GIS/GEOINT platform is assumed.
- IMPLEMENTED: Website/PWA/brand baseline.
- IMPLEMENTED: Google OAuth sign-in path; end-user browser/session lifecycle remains NOT VERIFIED.
- IMPLEMENTED: membership/active role.
- IMPLEMENTED: feature-flag reading + safe module visibility.
- IMPLEMENTED: marketing lead creation.
- IMPLEMENTED: support ticket creation + ticket list/reply path.
- IMPLEMENTED: notifications read/update path.
- IMPLEMENTED: RLS-scoped CRM leads/providers/orders/notifications reads.
- IMPLEMENTED: RLS-scoped order status history read.
- IMPLEMENTED: JS syntax check on current `web/app.js` — PASS.
- VERIFIED: all 111 public tables have RLS enabled.
- VERIFIED: CI validation run #109 succeeded for commit `6728318cd68d0848d65973994629b13ea93ae885`.
- NOT VERIFIED: production end-to-end, external browser/device, restore/DR, and full release gate.
- SECURITY VERIFIED: 111/111 public tables have RLS enabled.
- SECURITY REVIEW: anon SELECT grants are currently limited to `legal_documents` and `legal_document_versions`; no broad anon write grants were found.
- SECURITY REVIEW: 6 RLS-enabled tables have no policies; access remains deny-by-default and requires explicit product decision before adding policies.
- NOT VERIFIED: production end-to-end.
- NOT VERIFIED: restore test.
- NOT VERIFIED: full security release gate.
- SECURITY REVIEW: 6 RLS-enabled public tables currently have no policies; this is deny-by-default but still requires explicit review.
- SECURITY REVIEW: Advisor ما زال يعرض تحذير SECURITY DEFINER للوظائف التشغيلية المقصودة؛ تمت مراجعة الوظائف العشر، ويظل الاختبار الوظيفي/العدائي للـRPCs ضمن E2E.
- SECURITY REVIEW: Advisor ما زال يعرض تحذيرات Anonymous Access Policies؛ لا يتم تعديلها جماعيًا قبل تحديد ما هو مقصود كقراءة عامة وما هو مقصود للمستخدم الموثق.


## Latest build checkpoint — 2026-09-27
- [🟢] CI #120 succeeded for support status workflow hardening/docs on commit `091410b7e886d07621b5f5ef5c6de76dc41480f6`.
- [🟡] CRM lead details: read-only detail view committed as `9cbae8375ab39c835b7d3ff92c0c8bef49204064`; CI verification pending.
- [🟢] CI #118 succeeded for support ticket detail/thread UI on commit `4947decd99ffebd2cf1496479f9eb87ac9c878d2`.
- [🟡] Support status workflow: database constraint + staff status update UI committed as `e12d8c0fa2281d3761f0659986b34068f7bafcb0`; CI verification pending.
- [x] Runtime brand alignment: customer-facing brand surfaces use `MantiqatiX` as the official public name; legacy `MNTY` identifiers remain only where required by internal technical contracts.
- [🟢] CI verified: run #114 نجح للـcommit الحالي `d58e1360a170bce596494b2aeb37b5166fff6a5b` بعد تعديلات الهوية.
- [ ] استكمال P0/P1 من أول عنصر غير VERIFIED، مع عدم اعتبار أي وظيفة مكتملة قبل اختبارها في سياقها.


## Latest implementation checkpoint — 2026-09-27
- [🟡] Support ticket detail/thread UI: commits `20624048b97e30d4dd88aa897c9d66f9e01cfd4a` and `6522e9df10ec908e5279f5fdb4f0291df0ffd644` add ticket details, message thread loading, and reply entry while relying on existing RLS policies.
- [🟡] CI runs #116/#117 are pending; no production verification claim is made until the latest run succeeds.

## 2026-09-27 — GitHub Pages availability hardening
- [x] Updated `web/sw.js` cache namespace from legacy `mantix-web-v3` to `mnty-web-v5` and changed navigation handling to network-first with cached fallback.
- [x] Added post-deployment GitHub Pages smoke check to `.github/workflows/pages.yml`; deployment now verifies the published URL returns successfully and contains `MNTY`.
- [ ] External browser availability after this deployment is still NOT VERIFIED in the current execution environment because direct Pages fetch currently returns a cache-miss from the available web fetcher.
- [ ] Production E2E auth / registration approval / multi-role / backup-restore / finance / integrations / device-browser regression remain release gates.

## 2026-09-27 — Registration RLS hardening
- [x] Hardened `account_registration_requests` SELECT/UPDATE/self-SELECT policies against anonymous sessions while preserving authenticated owner/admin scope.
- [x] Re-ran Supabase security advisor; the `account_registration_requests` anonymous-access warning is cleared.
- [ ] The remaining 10 authenticated-callable SECURITY DEFINER operational functions are intentionally retained for current domain workflows; each contains an authentication/ownership/role/scope guard, but adversarial multi-account E2E remains required before release.
- [ ] Broader anonymous-policy advisor findings across legacy/domain tables remain under review; no blanket policy rewrite was applied because access semantics differ by module.

## 2026-09-27 — MNTY registration approval authority
- [x] Added private authoritative `private.platform_admins` registry; no anon/authenticated access and service-role-only database privileges.
- [x] Added atomic `private.review_registration_request_atomic(...)` transaction for approval/rejection, membership provisioning, and audit logging; anon/authenticated EXECUTE is denied.
- [x] Added JWT-protected Edge Function `mnty-registration-review` as the authenticated gateway to the atomic review operation.
- [x] Added one-time `private.bootstrap_platform_admin(...)` procedure for controlled server-side bootstrap; it does not auto-create a user or seed fake production identities.
- [x] Verified the new private functions are executable by `service_role` only; current tenant/membership/platform-admin counts remain zero because no real bootstrap identity has been supplied.
- [ ] Execute the one-time platform bootstrap using the real authorized initial admin account; do not invent or seed a user.
- [ ] Add/verify Admin review UI against the Edge Function after the real platform admin exists.
- [ ] Run authenticated multi-account E2E: customer registration → pending → admin approval → active membership → customer access; provider path separately.
- [ ] Re-run full release gate after E2E, including auth/session, authorization/RLS, finance, backup/restore, monitoring, external browser/device tests, and rollback.

## 2026-09-27 — Registration review UI integration
- [x] Added an administration-only `طلبات التسجيل` workspace in `web/app.js`.
- [x] Registration requests are loaded only for SUPER_ADMIN/ADMIN/OWNER memberships and remain RLS-scoped.
- [x] Approval/rejection actions call JWT-protected Edge Function `mnty-registration-review`; no direct membership write is exposed to the browser.
- [x] Edge Function CORS narrowed to the MNTY GitHub Pages origin and remains JWT-required.
- [x] Verified bootstrap negative-path test does not create data: current counts remain tenants=0, memberships=0, platform_admins=0.
- [ ] CI verification for commits `a629cfc26e1e38a178dd345518ed67d592fcdda7` / `56a0bd48df2ae1dd820b1796d565b0028da12a64` remains pending/NOT VERIFIED through the available GitHub workflow-run query.
- [ ] Real platform-admin bootstrap and authenticated multi-account E2E remain required before release.

## 2026-09-27 — Registration security verification checkpoint
- [x] Confirmed `private.review_registration_request_atomic` and `private.bootstrap_platform_admin` EXECUTE is denied to anon/authenticated and granted to service_role only.
- [x] Confirmed `private.platform_admins` currently contains zero rows; no production identity was fabricated.
- [x] Confirmed the registration-review Edge Function is ACTIVE, version 3, and JWT verification remains enabled.
- [ ] GitHub Actions run result for the latest registration UI commits is still NOT VERIFIED through the available workflow-run connector.


## 2026-09-27 — Registration review cache isolation
- [x] Cleared `live.records.registrationRequests` at the start of each live-data reload so privileged registration-review records cannot remain in client state after a role/session transition.
- [ ] CI verification for commit `39656f0af6d23612cae5737b2b6f1cb494664255` remains pending through the available workflow-run connector.


## 2026-09-27 — Session-scoped client state reset
- [x] Reset feature flags, counts, module cache, and record cache at each live-data reload to prevent cross-session stale state.
- [x] Reset the same client-side state explicitly on logout.
- [ ] CI verification for commit `cb90678ddd7c89a798ae010943ad8a2fa50f5a5e` remains pending through the available workflow-run connector.


## 2026-09-27 — Record-table output escaping
- [x] Escaped all values rendered by the shared `recordsTable()` renderer before inserting database-backed values into HTML cells.
- [x] Closed the generic reflected/stored HTML injection path through record-table values at the shared rendering boundary.
- [ ] CI verification for commit `dc0c836e219f99c9ebb322b891038a5b2b87ebf7` remains pending through the available workflow-run connector.


## 2026-09-27 — Finance reconciliation read-scope hardening
- [x] Replaced the broad authenticated SELECT policy on `payment_financial_reconciliations` with tenant-scoped finance-role access.
- [x] Verified the new policy requires an ACTIVE membership in the row's `tenant_id` and role OWNER/ADMIN/MANAGER/FINANCE/ACCOUNTANT/FINANCE_MANAGER.
- [x] Verified anonymous SELECT remains denied and authenticated table SELECT privilege remains subject to RLS.
- [ ] Authenticated adversarial E2E across two tenants is still required before release.


## 2026-09-27 — Finance backend execution boundary review
- [x] Reviewed SECURITY DEFINER functions related to payments, commissions, settlements, refunds, and subscription payments.
- [x] Confirmed the reviewed sensitive financial backend functions are not executable by `anon` or `authenticated`; execution remains server-side only.
- [x] Confirmed `payment_financial_reconciliations` now uses tenant-scoped finance-role SELECT RLS.
- [ ] Provider/payment/subscription/refund/settlement authenticated E2E remains required; no production financial success is claimed without it.


## 2026-09-27 — Backup / monitoring verification checkpoint
- [x] Verified the database has an `audit_logs` table with tenant/actor/action/entity/result fields suitable for application audit records.
- [x] Verified `audit_logs` is not writable by `authenticated` and is not readable by `anon`; authenticated SELECT remains subject to its RLS policy.
- [x] Verified no application-level public table currently exists with an explicit backup/restore or incident/alert name; this is not treated as proof of infrastructure backup or monitoring.
- [ ] Actual Supabase backup/restore drill remains NOT VERIFIED.
- [ ] Production monitoring, alert routing, and incident-response drill remain NOT VERIFIED.
- [ ] Final release remains blocked until backup/restore and monitoring evidence exists.


## 2026-09-27 — Security advisor / CI checkpoint
- [x] Ran the live Supabase security advisor.
- [x] The six RLS-enabled/no-policy tables remain intentionally deny-by-default and have no authenticated/anon CRUD grants; no permissive policy was added.
- [x] The 10 authenticated-callable SECURITY DEFINER operational functions remain the only WARN class requiring workflow-specific E2E validation; they contain application-level auth/ownership/tenant checks and are not finance functions.
- [x] Confirmed the reviewed finance SECURITY DEFINER functions remain non-executable by `authenticated` and `anon`.
- [ ] Latest documentation commit workflow run is not yet returned by the available commit-run endpoint; CI status therefore remains NOT VERIFIED for the newest documentation checkpoint.
- [ ] Final release remains blocked pending authenticated adversarial E2E and full regression.


## 2026-09-27 — Web security CI guard
- [x] Added a production web asset scan for service-role/secret/private-key/database-URL patterns and common private API token formats.
- [x] Added the scan to the Pages validation job before deployment.
- [x] Verified the published `web/config.js` contains the publishable Supabase key and Supabase project URL only; no service-role secret is present in that file.
- [ ] This static guard is not a substitute for authenticated adversarial RLS E2E; that remains a release gate.


## 2026-09-27 — Auth / registration CI invariants
- [x] Added static invariants for Email OTP, OTP verification, valid-session gating, registration-request routing, active-membership gating, logout state reset, registration-review Edge Function usage, and admin-role guarding.
- [x] Added the auth/registration invariant scan to the Pages validation job before deployment.
- [ ] These checks validate source invariants only; real Email OTP, session expiry, multi-account approval, and adversarial RLS E2E remain NOT VERIFIED.


## 2026-09-27 — RC40 source integrity checkpoint
- [x] Inspected the uploaded `source_RC40.zip` and its production checklist/sign-off documents.
- [x] Confirmed RC40 contains an Android/Gradle CI path, backup script, read-only production invariants, and security audit documents.
- [x] Did not treat RC40's embedded `VERIFIED`/go-live claims as independent evidence; they are source assertions and require reproducible CI/UAT evidence.
- [x] Attempted local `testDebugUnitTest lintDebug assembleDebug`; execution was blocked because Gradle Wrapper attempted to download Gradle 9.3.1 from `services.gradle.org`, which is unreachable in the current execution environment.
- [ ] Android build/test result remains NOT VERIFIED in this environment.
- [ ] The uploaded RC40 Android source is not merged into the current GitHub Pages MNTY web release because the two artifacts are not yet reconciled into one verified release baseline.
- [x] SMM backend tables API DML privileges hardened — `smm_provider_credentials` and `smm_providers` have no `anon`/`authenticated` table grants; access remains backend/RLS controlled.
- [🟢] Supabase production project status — ACTIVE_HEALTHY; database PostgreSQL 17.6.1.155.
- [🟢] Edge Functions inventory — active functions reviewed; authenticated functions use JWT verification, while webhook endpoints intentionally remain public for provider callbacks.
- [🟡] Runtime log monitoring — log query could not be completed in this pass; NOT VERIFIED.
- [🔴] Real Backup/Restore rehearsal — not performed on production to avoid destructive/unsafe action without an isolated restore target.
- [🔴] Full browser/device E2E — requires real browser/device execution and OTP interaction; NOT VERIFIED.


## RC227–RC234 — 2026-10-02 Product Completion Pass
- [x] Added mandatory A→Z development prompt contract: `docs/DEVELOPMENT_PROMPTS_TODO.md`. Any future module starts by adding its complete development prompt there.
- [x] Public sector/category pages exist as reusable dynamic pages driven by `category_code`; provider profile pages now support deep-link routing.
- [x] «إضافة نشاط» is a request modal and continues through the server-authoritative provider onboarding flow; it does not create an approved activity directly from the browser.
- [x] Added commercial digital-page product catalog for Portfolio and Menu with server-authoritative pricing snapshots.
- [x] Added owner-scoped `digital_page_orders` and `digital_page_payment_events` with RLS/deny-by-default direct mutation.
- [x] Added `digital-page-order-create` JWT-protected Edge Function with product eligibility, ownership checks, price snapshot and idempotency.
- [x] Added `digital-page-payment-intent` JWT-protected Paymob intent path and routed verified Paymob webhook events into the digital-page payment ledger.
- [ ] NOT VERIFIED: real browser checkout/Paymob E2E for Portfolio/Menu; no production payment success is claimed without a real authorized transaction.
- [ ] TODO: digital page fulfillment editor/publisher, public Portfolio/Menu renderer, versioning, moderation, SEO/share/QR, and full account order management.
- [ ] TODO: integrate paid digital-page orders with wallet/cart/receipts/refunds and unified commercial-services engine without duplicating financial truth.
- [ ] TODO: full two-user/two-tenant E2E, leaked-password protection, backup/restore, monitoring/alerts, and final release gate remain open.


## RC235 — Production continuation audit — 2026-10-02

- **Baseline inspected:** main at RC234 commit `1c31938f90ba75794c1a58ee686f13efa3ef542f`.
- **Production blocker found:** GitHub Pages validation run #1230 failed at `node --check web/app.js` because the Add Activity submission path contained a literal `\\n` token outside a JavaScript string.
- **Fix implemented:** removed the invalid token without changing the onboarding business logic; commit `781899adf21ccee340145d77b0646b4f7900ffc0`.
- **Verification status:** CI verification for RC235 is **NOT VERIFIED** until the new GitHub Actions run completes successfully.
- **Security status:** Supabase project `moyhiluyhjsujhwlyeuu` is ACTIVE_HEALTHY on PostgreSQL 17.6.1.155. Security Advisor still reports leaked-password protection disabled and contextual anonymous-access-policy findings; no blanket policy rewrite was applied.
- **Release gates still open:** real browser/device E2E, multi-user/multi-tenant authorization E2E, real provider/business/catalog booking fixture, real payment/refund/webhook/reconciliation E2E, backup/restore rehearsal, monitoring/alert drill, rollback rehearsal, and final external release certification.
- **Rule:** no item above is marked VERIFIED from source inspection alone.


## RC272 — 2026-10-03
- [🟢] CI/CD VERIFIED: GitHub Actions run #1342 (run id 37129102049) succeeded for commit `e4d1d91fa0317e3d7614a40d16b2c227b20e3808`.
- [🟢] Browser mutation boundaries remain VERIFIED through the Pages validation workflow.
- [🟡] Android remains NOT VERIFIED/BLOCKED: current main has no Android Gradle project; historical RC40 Android source must be reconciled before reintroduction. Local RC40 build was blocked before compilation by unavailable Gradle network access.
- [🟡] Supabase Security Advisor rechecked 2026-10-03: RLS-enabled/no-policy finding remains limited to `digital_page_payment_events`; SECURITY DEFINER findings remain for 1 anon-callable targeted-advertisement RPC and 9 authenticated-callable operational/RBAC functions; these were previously reviewed and are not to be disabled blindly.
- [🟡] Supabase Performance Advisor remains workload-dependent: unused-index findings and 24 multiple-permissive-policy findings remain; no blanket index/policy rewrite was applied without workload/EXPLAIN evidence.
- [ ] Release remains NOT VERIFIED until authenticated multi-account E2E, finance/payment E2E, backup/restore, monitoring, external browser/device, rollback, and Android release artifact gates are closed.


## RC314 — Web UX continuity
- [🟢] Public footer dead-end links fixed: About, Terms and Privacy now open real in-app information dialogs instead of `href="#"` no-op anchors.
- [🟢] Dialog accessibility implemented: `role="dialog"`, `aria-modal`, labelled heading, Escape close, backdrop close and initial focus.
- [🟡] CI for RC314 remains pending/in progress at documentation time; no production gate was marked closed from this UI change alone.

## 2026-10-24 — PR #372 exact-head verification checkpoint

- [x] Exact-head commit `d4ee010a6835caec74fdb04c211edd6f1719b609`: chronological forward migration replay succeeded in disposable Supabase/PostgreSQL, applying 35 forward migrations after the captured production schema checkpoint.
- [x] The replay then ran the synthetic two-tenant fixture and passed both read-isolation and cross-tenant UPDATE-denial assertions for orders and payment intents in both directions; the test transaction ended with ROLLBACK.
- [x] RC431 Paymob intention-correlation / payment-integrity PostgreSQL workflow passed, including fail-closed correlation tests.
- [x] RC425 MantiGo/Paymob atomicity workflow passed, including checkout-secret crypto and source-wiring checks.
- [x] Migration history immutability, migration-version uniqueness, open-PR migration collision guard, MantiGO open-ride privacy, backend-only module boundary, and module professionalization validation workflows were reported successful for this exact head.
- [x] Web validation workflow passed. Its `deploy` job was skipped for this PR run; this checkpoint does not represent a Pages or production deployment.
- [ ] These CI results do not certify the live production database or provider flows. Production migration ledger remains unreconciled beyond RC424; backup/PITR and restore rehearsal, managed Auth leaked-password protection, live Edge Function parity, authorized Paymob/finance E2E, browser/device E2E, monitoring/alert and rollback drills remain open.
- [ ] Keep the release manifest `BLOCKED` / `NOT CERTIFIED`. No production migration, Edge Function deployment, Auth/grant/RLS change, real payment, or financial data mutation was performed.

## 2026-10-24 — قرار تأجيل الاختبارات الفعلية الشاملة إلى نهاية التطوير

- [x] تم اعتماد توجيه المشروع: تأجيل حملة الاختبارات الفعلية الشاملة لكل الموديولات إلى آخر مرحلة بعد اكتمال التطوير وتجميد مرشح الإصدار.
- [x] حتى موعد الحملة النهائية، تكون الأولوية لاستكمال الواجهات والوظائف والتكاملات والتوثيق ومراجعة الكود، مع عدم إعلان أي ميزة أو بوابة إطلاق VERIFIED لمجرد اكتمال التطوير.
- [ ] لا تبدأ الآن اختبارات E2E الفعلية الشاملة أو معاملات Paymob الحقيقية أو اختبارات الاستعادة/التراجع الإنتاجية. تُنفّذ لاحقاً ضمن خطة اختبار نهائية معتمدة، وفي بيئات معزولة/ sandbox حيثما أمكن، وبعد تحقق النسخ الاحتياطي وصلاحية الاستعادة والحصول على أي موافقات لازمة.
- [ ] احتفظ بالاختبارات الآلية الحالية التي تعمل كجزء من CI كأدلة تطوير منفصلة؛ نجاحها لا يعني أن حملة الاختبارات النهائية قد نُفذت.
- [ ] في نهاية التطوير، نفّذ حملة موحدة تغطي: المصادقة والجلسات والأدوار، عزل المستأجرين وRLS، جميع تدفقات الموديولات، الطلبات والمخزون والحسابات والمحافظ والمدفوعات وwebhooks والتسويات، SMM، الإشعارات والأتمتة، الأداء وإمكانية الوصول، Android/المتصفحات والأجهزة، النسخ الاحتياطي والاستعادة، المراقبة والتنبيه والتراجع، ثم إصلاح العيوب وإعادة الاختبار وتوثيق الأدلة.
- [ ] تظل بوابة الإنتاج `BLOCKED / NOT CERTIFIED` حتى تنجح حملة الاختبارات النهائية وتُغلق كل بوابة بدليل قابل للمراجعة. هذا القرار يؤجل الاختبارات الشاملة ولا يحول الاختبارات غير المنفذة إلى PASS.


## 2026-10-27 — Current continuation evidence (GitHub connector recheck)

- [🟡] PR #412 is CLOSED / NOT MERGED (superseded); do not merge or reuse its combined branch. Its two concerns are split into #413 (Qadam Al-Saad contact repair) and #414 (scoped feature-flag UI handling).
- [🟡] PR #413 is OPEN, not merged, based on the current recorded main SHA `0274bbd3f3657838153d1c8b62ea31ce487d1c90`. Its source migration records a Qadam Al-Saad contact repair reportedly already applied/read back from Production. Exact-head Pages workflow jobs for the PR were CANCELLED; successful isolated tests do not establish deployment.
- [🟡] PR #414 is OPEN, not merged, based on the same main SHA. It adds scoped feature-flag resolution and a contract test. Exact-head Pages workflow jobs were CANCELLED; do not mark the feature-flag visibility/actions item VERIFIED until the required validation succeeds and feature-level use is reviewed.
- [🟡] PR #347 was later superseded/closed; PR #427 now carries the exact live-ledger source reconciliation. The current disposable forward-replay evidence is run 40494929976 (52 migrations PASS); do not treat replay as proof of Production application or merge old recovery branches blindly.
- [🟡] Read-only Production ledger LEFT JOIN now covers the **34 exact migration versions required by `verify-production.mjs`** and confirms **0/34** are recorded. Source files exist in `main` and the 52-migration disposable replay passes, but the live ledger includes later October 26–27 migrations. The current production gate must not infer safe historical application from those facts. RC451's public targeted-ad SECURITY DEFINER function also still has `search_path=public, pg_temp` instead of empty search_path; its public EXECUTE is intentional and must not be revoked as a shortcut. Keep release `BLOCKED`; no historical file rewrites or direct Production migration operations.
- [🟡] Latest observed open-PR migration collision guard run for PR #413: run `40449840215` failed at “Compare changed migrations across open PRs”, but the job log shows the underlying cause was GitHub API HTTP 403 `API rate limit exceeded for installation` after five retries. Its self-test passed. This is an infrastructure/rate-limit blocker, not evidence of a concrete migration collision. Retry only after the API rate limit recovers or improve the job's GitHub API strategy without weakening the guard.
- [🟡] Exact-head workflow run `40449840182` reports isolated forward migration replay passed. The same PR’s deployment workflow `40449840167` was cancelled; no deployment claim is made.
- [ ] Keep release status `BLOCKED / NOT CERTIFIED`: Production payment/finance E2E, restore rehearsal, live Edge Function contract parity, SMM gateway parity, live Auth security settings, browser/device E2E, monitoring/alert and rollback drills remain NOT VERIFIED.
- [x] Updated follow-up: PR #427 reconciles the latest three live-ledger sources, and current branch run 40494929976 passes 52-migration replay plus tenant-isolation checks. Review final exact-head checks; keep the Production gate blocked until live migration application and external runtime evidence are proven.


## 2026-10-27 — Verified CI checkpoint; live gate still blocked

- [x] On branch `fix/production-launch-hardening-20261027`, chronological isolated replay `40453971339` passed after correcting taxonomy seed order. It applied 50 migrations from the captured disposable checkpoint and passed both tenant directions for own-row read / cross-tenant write denial across orders and payment intents.
- [x] Exact-head CI `4eb74e97932ca93c047816ca5e6179dda83339d1`: [admin/onboarding typecheck](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40454024929), [module professionalization](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40454024908), [backend-only module boundary](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40454024878), and [MantiGO privacy boundary](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40454024869) all passed.
- [x] Production read-only verification as of 2026-10-27: 292 migration-ledger rows, latest `20261027041549 qadam_alsaad_restore_contact_fields`; `platform_feature_flags=0`; `business_modules=600` and all 600 enabled. Exact statement/source comparison now passes for live versions `20261027010135`, `20261027041411`, and `20261027041549`; the reconciliation manifest records this evidence while preserving the overall `BLOCKED` status.
- [x] Production `digital_page_payment_events` has RLS enabled and zero policies, but current effective database privileges show no SELECT/INSERT for `anon`, `authenticated`, or `service_role`; no direct access grant was found. Keep policy count zero pending confirmation of backend event ingestion contract.
- [ ] Do not merge/deploy PR #411 yet: it remains Draft and not mergeable due stale base; successful isolated replay is not Production migration reconciliation, a live restore rehearsal, nor payment/finance runtime evidence.
- [ ] Remaining P0 evidence: reconcile all 292 live migration statements/aliases with source; prove Supabase PITR/backup retention and perform isolated restore rehearsal; review exposed SECURITY DEFINER and anonymous RLS policies; enable leaked-password protection in managed Auth after impact review; run provider sandbox payment/webhook + finance E2E; verify Edge Function and SMM deployment parity; browser/device regression; monitoring/alert + rollback drill.


## 2026-10-27 — Main production-gate execution evidence

- [x] Latest Main verification run [40454352495](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40454352495) executed the production verifier and returned `PRODUCTION_GATE=BLOCKED`; the catalog/deploy path did not pass validation. This is the intended fail-closed behavior, not a successful production release.
- [x] The verifier confirmed no missing migration source files and no source timestamp/order conflicts, but correctly blocked on the live reconciliation manifest (`verified=false`, `required_release_migrations_applied=false`) and unresolved payment/finance E2E, backup/restore rehearsal, Edge Function contract, SMM parity, and live Auth security evidence.
- [ ] Resolve mismatch between the live Supabase ledger (292 entries, latest `20261027041549 qadam_alsaad_restore_contact_fields`) and the stale reconciliation manifest without rewriting historical migration versions. Confirm source-ledger statement identity for each live post-RC424 entry before updating the manifest.
- [ ] Keep deployment blocked until the reconciled evidence and all remaining P0 checks pass.


## 2026-10-27 — PR overlap and continuation coordination

- [x] Reviewed #414 and #416 diffs. They overlap on `web/app.js` and both correct the invalid `scope_type='PLATFORM'` lookup, but #414 adds a reusable resolver + contract test for GLOBAL/SECTOR/TENANT/BUSINESS/BRANCH and guarded UI features. Do not merge both unchanged; consolidate to one validated scope-aware implementation after rebasing on current main.
- [x] Reviewed #415 saved order/pricing snapshots; it correctly keeps order status mutation server-authoritative and adds a contract test. This remains a UI/data-contract fix, not proof of real order/payment E2E.
- [x] #413's source-only durable contact migration is valuable because the repair has already been read back from Production, but its PR is dirty after main moved. Rebase/update and rerun exact-head CI before merge; do not replay the data update as an extra Production write.
- [ ] Reconcile open PRs #413–#416 with current main; review independent behavior/tests, then merge only a current, clean, fully checked PR at a time. Keep #411 Draft until base conflicts and P0 release evidence are addressed.
- [ ] #347's restored SQL files are byte-identical to canonical source, but full chronological replay on the intended current base and all required acceptance evidence remain preconditions; do not merge solely because its diff is source-only.


## 2026-10-27 — Current Main checkpoint after Google OAuth fix (05:52 UTC)

- [x] Merged PR #409 as commit `60e253239963eabc389b8901f4fc8da5de996d96`: Google OAuth redirect now resolves to the canonical application base path and offers account selection. Source contract, TypeScript/build, and public catalog directory smoke checks passed on this commit. **Real external-browser sign-in and session E2E remain NOT VERIFIED**; do not state that the live login issue is closed until a real sign-in/logout/session cycle is confirmed.
- [x] The Main run [40457694938](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40457694938) passed the frontend build and source-contract checks, then correctly returned `PRODUCTION_GATE=BLOCKED`; deployment was skipped. The [web deployment run 40457694925](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40457694925) also skipped deployment after production verification failed and the exact changed-path guard rejected the mixed commit. No successful deployment is claimed.
- [x] Rechecked the live migration inventory from read-only evidence: 292 ledger rows, latest version `20261027041549 qadam_alsaad_restore_contact_fields`. The exact identity of the three post-RC424 ledger entries and checked-in source files remains unresolved; keep issue #421 open, do not rewrite or reapply the live ledger, and do not update the release manifest by inference.
- [x] Rechecked the Production Supabase Security Advisor at 2026-10-27 05:49 UTC: 48 WARN findings for authenticated-executable `SECURITY DEFINER` functions, one WARN for anonymous execution of `get_mnty_targeted_advertisements(...)`, and one INFO for `digital_page_payment_events` with RLS enabled/no policies. These are review indicators, not proof every RPC is exploitable. Review each caller/grant/search_path; do not mass-revoke or add policies before confirming the backend ingestion contract. Fresh evidence is recorded in issue #98.
- [ ] Issue #420 remains open: `.github/workflows/catalog-module-pages.yml` is a second publisher of the shared `./web` Pages root and still lacks the platform Production gate. The existing mixed-change allowlist is intentionally fail-closed; do not weaken it. Implementation requires a reviewed change to both the workflow and production-gate contract validator.
- [ ] Issue #422 remains open: leaked-password protection is reported disabled by the managed Auth Security Advisor. A project owner must enable it in the Supabase dashboard and re-run the advisor; source/SQL checks do not prove this managed setting is enabled.
- [ ] Release status remains `BLOCKED / NOT CERTIFIED`. Payment/finance provider E2E, backup/restore rehearsal, Edge Function contract parity, SMM gateway launch safety/parity, Auth security settings, external browser/device regression, monitoring/alert and rollback evidence are still required. The OAuth source fix, isolated migration replay, and passing CI are not substitutes for these live checks.



## 2026-10-27 — Exact live migration-source reconciliation

- [x] Read-only queried `supabase_migrations.schema_migrations.statements` for the three latest live entries and compared each statement string to its exact-version SQL source. All three comparisons matched character-for-character.
- [x] Restored `20261027010135_add_qadam_alsaad_homewares_store_and_catalog.sql` from the authoritative recovery branch; restored exact live-version sources for `20261027041411_mantiqatix_marketing_contact_details.sql` and `20261027041549_qadam_alsaad_restore_contact_fields.sql`.
- [x] Confirmed `20261027100000_mantiqatix_marketing_contact_details.sql` has an exact statement body match with live version `20261027041411`. Preserved the existing file unchanged because the repository's migration-immutability guard forbids deleting or renaming migration history; documented it as an idempotent source-version alias. Kept the distinct `20261027093000_add_qadam_alsaad_homewares_store.sql` follow-up unchanged for separate review.
- [x] Updated `docs/release/production-migration-reconciliation.json` with read-only evidence and current live ledger tail. `status=BLOCKED`, `verified=false`, and `required_release_migrations_applied=false` remain unchanged.
- [ ] Remaining release blockers: reconcile the live schema drift created by newer applied migrations with the 16 missing RC425–RC441 versions and obtain an approved/rollback-tested Production rollout plan; payment/finance E2E; backup/restore rehearsal; live Edge Function parity including SMM anonymous/authenticated negative runtime tests; managed Auth security settings; browser/device E2E; monitoring/alert and rollback evidence.
- Safety: no production writes, migration execution, schema/permission changes, Edge Function deployment, payment, or wallet mutation were performed.


## 2026-10-27 — Live SMM gateway parity read-back

- [x] Read-only retrieved the deployed `smm-gateway`: ACTIVE version 13, `verify_jwt=true`, bundle SHA-256 `a45cee9f5c90beba2c2409ba4fe2927f5be3df4965fb3929f5b7d467b3121b72`.
- [x] Compared all 7 deployed TypeScript files against `main`: exact matches for `index.ts`, `launch-gate.ts`, `provider-transport.ts`, `order-status.ts`, `catalog-normalization.ts`, `order-validation.ts`, and `request-validation.ts`.
- [x] Confirmed the deployed source retains `SMM_INITIAL_LAUNCH_DEFERRED=true` and returns `SMM_DEFERRED` before processing actions.
- [ ] Anonymous/authenticated negative runtime tests remain NOT VERIFIED; source parity does not replace runtime evidence. No function deployment or environment change was performed.


## 2026-10-27 — Schema-only checkpoint replay diagnosis

- [x] Inspected Forward Migration Chain Replay run [40493639400](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40493639400): it failed at `20261027010135_add_qadam_alsaad_homewares_store_and_catalog.sql` because the restored checkpoint is schema-only (`data_included=false`) and therefore lacks `MNTY-PLATFORM`.
- [x] Read-only Production checks confirmed the platform tenant and referenced owner auth identity exist in the live database. No production data was copied or changed.
- [x] Added `supabase/tests/baselines/production_data_prerequisites_fixture.sql` with only deterministic test data for those pre-existing dependencies, guarded by the explicit disposable flag. Added a local-host URL guard to the replay workflow.
- [x] Forward replay correction verified in [run 40494929976](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40494929976): all 52 post-checkpoint migrations applied in timestamp order in a disposable Supabase instance; RC117 contract ran and synthetic tenant A/B read isolation and cross-tenant order/payment-intent write denial passed.
- [x] Exact-head migration immutability, version uniqueness, open-PR collision guard, RC425 Paymob atomicity, SMM deferred-storefront contract, backend-only boundary, MantiGO privacy and module validation checks passed at this checkpoint.
- [ ] Production Gate stays BLOCKED: this isolated replay does not prove the migrations were applied to Production, and payment/finance E2E, backup/restore rehearsal, live Auth/Edge Function runtime gates, browser/device E2E, monitoring/alerts and rollback evidence remain open. Web deploy workflow skipped `validate_public_only` and `deploy`; no production deployment occurred.


## 2026-10-27 — Critical Edge Function source drift recheck

- [x] Read-only exact entrypoint comparisons against `main` show source drift in live `payment-intent` v8, `paymob-webhook` v10, `digital-page-payment-intent` v5, `subscription-payment-intent` v4, and `financial-journal` v3. Key observed differences are recorded in `docs/release/production-migration-reconciliation.json`.
- [x] Live `smm-gateway` v13 entrypoint exactly matches `main`; anonymous/authenticated negative runtime tests remain NOT VERIFIED.
- [ ] Do not deploy the five drifting functions individually. Align rollout with the missing RC425–RC441 versions, review current live schema drift, and pass payment/webhook/finance sandbox E2E plus backup/restore and rollback gates first.
- Safety: these checks retrieved code only. No Edge Function deployment or configuration change occurred.


## 2026-10-27 — Financial journal RPC and schema preflight

- [x] Read-only check confirms RC449A and RC450 are absent from the live migration ledger. The live schema lacks `journal_entries.entry_number`, `total_debit`, `total_credit`, `posted_at` and `journal_entry_lines.line_number`.
- [x] Effective ACL inspection confirms neither `post_financial_journal(jsonb,jsonb)` nor `post_financial_journal_backend(uuid,jsonb,jsonb)` currently grants `EXECUTE` to `service_role`. Live `financial-journal` v3 calls the old RPC; `main` calls the backend RPC under the RC450 contract.
- [x] Read-only counts were zero for the inspected journal headers/lines/general ledger, payment intents, subscription payment intents, ERP purchase orders/receipts, SMM orders and SMM wallet transactions. Counts are a snapshot only, not a substitute for backup/restore readiness.
- [ ] Blocker: replay RC449A → RC450 in disposable/staging, verify schema and exact grants, run finance posting/replay/tenant-isolation E2E, and approve backup/rollback before any Production migration or function deployment. No RPC invocation, grant, schema edit or deployment was performed.


## 2026-10-27 — Full required ledger inventory and strict release proof

- [x] Read-only LEFT JOIN of all 34 migration versions enforced by `scripts/production/verify-production.mjs`: **0/34** recorded in the 292-row Production ledger. Evidence and all exact required versions are in `docs/release/production-migration-reconciliation.json`.
- [x] Read-only catalog confirms `get_mnty_targeted_advertisements` remains SECURITY DEFINER and anon/authenticated executable with `search_path=public, pg_temp`; required RC451 (`20261010200000`) is not recorded. Its public read boundary is intentional; do not revoke grants blindly.
- [x] PR #428 added a strict live-evidence contract; current follow-up enumerates all 34 exact migration versions and adds RC451 proof plus tests that reject stale/missing versions and search_path drift.
- [ ] Production remains BLOCKED until the complete ordered release chain is safely reconciled with later live migrations, all object/function/ACL drift is fixed and verified, and payment/finance, backup/restore, Auth, browser/device, monitoring and rollback gates pass.


## 2026-10-27 — Object-level inventory of the 34 missing migration versions

- [x] Parsed the 34 required SQL migration sources from `main` and checked named function/table/index objects against the live PostgreSQL catalog read-only.
- [x] Added `docs/release/production-source-object-drift.json`: 39 required function names (21 absent), 4 required tables absent, and 12 of 13 selected required indexes absent. Presence of a same-named function is not treated as equivalent behavior; the inventory identifies legacy signatures/ACL/search_path drift and entries needing body-parity checks.
- [ ] Production remains BLOCKED. The next safe engineering task is a disposable/staging rehearsal against a snapshot of the *current* live schema and ledger, including the later-dated migrations already applied; do not apply historical migrations directly or mutate live grants/functions to make the inventory green.

## 2026-10-27 — Expanded production gate: RC113–RC117 and Qadam follow-up

- [x] Expanded the exact-version release gate from 34 to **41 distinct migrations**: the original payment/finance/security/order chain, six RC113–RC117 platform-feature migrations, and `20261027093000_add_qadam_alsaad_homewares_store.sql`.
- [x] Read-only live catalog checks show all six feature migrations are absent from the live ledger and their target objects are missing: 17/17 required function contracts and 11/11 selected tables/indexes are absent. These cover platform custom roles, employee hiring, control-center integration, subscriber administration, default-image triggers, and membership scope/idempotency.
- [x] Qadam data audit shows 15 active catalog items, all 12 expected price rows, three contact-for-price items with no active price, complete contact fields, one active branch, no synthetic stock tracking. Blocking defect: `MNTY-QADAM-ALSAAD-OWNER` membership is `INACTIVE`; the unrecorded follow-up migration promotes it to `ACTIVE`.
- [x] Two source-version aliases remain separate from the 41 distinct migrations: RC424 source version `20261009010000` maps to applied ledger version `20261008222845`; `20261027100000_mantiqatix_marketing_contact_details.sql` is an exact source-blob alias of live version `20261027041411`. Both require controlled ledger repair after backup/rehearsal; do not execute duplicate SQL as distinct effects.
- [ ] Overall status remains `BLOCKED / NOT CERTIFIED`: all 41 distinct required versions are still 0/41 in the live ledger; aliases are 0/2 reconciled; RC451 search_path, finance ACL/schema, five critical Edge Function source drifts, payment/finance E2E, backup/restore, Auth settings, browser/device, monitoring and rollback evidence remain open.
- Safety: no Production migration, repair, data write, grant/RLS/Auth change, Edge Function deployment, payment or wallet mutation was performed.

## 2026-10-27 — Atomic release object contract repair

- [x] Split the grouped RC435/RC436/RC437/RC441 release checks into separate function, index and table requirements. The release gate now requires **27 individual core objects + 33 feature objects = 60 object contracts**, all explicit in the manifest.
- [x] Added negative CI fixtures for absent subscription claim RPC, journal uniqueness index, ERP line receiving RPC and MantiGo admin dashboard RPC; a single row cannot stand in for multiple required objects.
- [x] Improved Production verifier diagnostics to list every non-passing object plus unresolved migration aliases and Qadam owner state.
- [ ] All 60 object contracts remain blocked or unverified; no Production migration, schema/ledger/grant change or deploy was performed.


## 2026-10-27 — Granular release object contract correction

- [x] Removed four compound object labels from the release contract. The verifier now requires 27 individually named core payment/finance/ERP/MantiGo objects plus 33 individually named RC113–RC117 feature objects: 60 total object contracts.
- [x] Read-only catalog evidence: 7/27 core objects exist by name/signature; 20 are absent. All 33 feature objects remain absent. Two existing RPCs are explicitly BLOCKED despite name presence because their live `search_path`/ACL diverges from source expectations.
- [x] Updated the reconciliation manifest to use exact object names, preventing false mismatches caused by a combined label that cannot match any catalog row.
- [ ] Keep Production blocked: 0/41 distinct required migration versions recorded; 0/2 source aliases reconciled; Qadam owner membership INACTIVE; RC451 search_path, finance schema/EXECUTE, Edge Function parity, rollback and runtime evidence still open.
- Safety: no Production writes or deployments. This change only improves the release gate's object-by-object evidence.


## 2026-10-28 — Catalog frontend and business-management request audit

Scope: user requests recorded in the recent catalog/frontend and business-management sessions. A source-code change is not treated as a deployed or browser-verified feature. Preserve the global Production Gate status above as BLOCKED / NOT CERTIFIED until its own release evidence passes.

### Catalog UI and publishing
- [x] Functional-group cards changed from image backgrounds to Lucide SVG icons with light card surfaces, selected-group styling, and per-group icon choices in `apps/catalog-frontend/src/components/DirectoryView.tsx`; commit `1a93658e7846a6b0917e0307bedac333077942f0`.
- [x] Run the catalog frontend's actual lint/typecheck and production build after the icon update; verified successful in the Pages workflow run [40684976091](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40684976091) (`Build and type-check catalog module` passed, including `npm run lint` and `npm run build`).
- [ ] Verify in a real browser that the icon cards render correctly, remain legible in Arabic/RTL, preserve counts and group filtering, and adapt to mobile/tablet/desktop layouts including the intended ten columns on wide screens.
- [x] Verify the deployed GitHub Pages URL serves the intended new electronic catalog as the primary experience, not the legacy `web/` application; the same Pages run [40684976091](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40684976091) successfully published the catalog-only artifact and passed `Verify primary catalog root after deployment`. `catalog-module-pages.yml` is now validation-only and explicitly does not publish Pages. **Visual browser/device behavior remains separately unverified in the next item.**
- [ ] Browser-verify the home COVER carousel: show currently available activities, one card/slide at a time; clicking an activity's image opens its own public page; retain the requested no-title/no-text/no-shadow overlay treatment.
- [ ] Verify persistent public links and QR-code generation/opening for every eligible activity; fix generation, routing, and scan behavior and add regression tests.
- [ ] Verify that signing in with any authorized account lands on the requested catalog home screen while retaining role-based security checks.
- [ ] Restore/check expected existing ad, interface, and default product imagery; new activities without suitable uploaded images should use a safe, appropriate placeholder until the owner uploads real assets. Do not overwrite existing business images without cause.
- [ ] Let business owners add/edit their social-profile URLs and display each supported network as a clickable icon; validate URLs and keep ownership boundaries enforced.

### Activity administration, owners, and duplicate prevention
- [ ] Implement/verify the platform-admin activity management workflow to publish, edit, hide/unpublish, and deactivate activities, with server-side authorization, status validation, and audit history; expose owners only the controls permitted for their own activity.
- [ ] Prevent repeated clicks/submissions for the same business/activity from creating duplicate records: add UI in-flight protection plus server/database idempotency or uniqueness controls where supported; test retries, double-clicks, and concurrent submits.
- [ ] Reject repeated identical submitted records according to the agreed duplicate policy, but inspect affected records before merging or deleting; preserve one valid working record and retain auditable references to any duplicate that must be retired.
- [ ] Resolve the requested duplicate account/file renaming sequence (duplicates labeled `11`, then sequential names `1`, `2`, `3`) by identifying the exact entity and file set first. **BLOCKED pending record-level identification**; do not mass-rename accounts or files based on ambiguous naming alone.
- [ ] Verify every newly created activity has the correct owner association. For activities without an owner, implement the approved platform-owner fallback using the platform's canonical user/member ID—not a hardcoded or misspelled email address—and log the assignment.
- [ ] Investigate the reported case where the newly added `Sameh Market` activity did not appear. Verify owner association, ACTIVE operational status, public-enabled/published status, and directory query/filter behavior; do not change live data without confirming the exact record.
- [ ] Reconcile requested activity/owner activation with payment recording. A claimed cash payment of EGP 0.01 must have a real auditable payment/receipt record linked to the correct owner/business before it is shown as paid; do not fabricate a transaction or infer payment from ACTIVE status. Verify the relevant membership is ACTIVE and the activity's public visibility separately.
- [ ] Resolve the Qadam Al-Saad owner membership currently recorded elsewhere in this TODO as INACTIVE, using the approved owner identity and reviewed migration/release path; do not perform an unreviewed Production database write.
- [ ] Audit the requested “Vision” catalog addition: locate the original requested scope and determine the missing implementation path before marking it done; avoid activating unrelated modules.

- [ ] Make the requested administration permissions UI explicit: platform owner has platform-wide authority; platform employees receive only individually assigned platform permissions; each business owner administers only their own business and may assign limited permissions to that business's employees. Enforce authorization server-side/RLS, and cover each role with allow/deny tests and audit history.
- [x] Implemented and deployed the AI catalogue-image path: `ai-gemini-proxy` v5 performs active membership/role and business/branch-scope checks, enforces a limit of 20 image requests per user per hour, records audit history, calls Gemini's image-generation API, and stores generated files in `mantiqatix-profile-media` before returning an HTTPS URL. Frontend creation now requests temporary activity logo/cover images when owner uploads are absent; product/service image flows also include branch scope. `catalog-admin` v19 records whether profile images are `ai`, `auto`, or `owner`. Both live Edge Function source files match GitHub exactly; frontend build/regression checks passed.
- [ ] **NOT VERIFIED (runtime):** perform one real authenticated image generation through the business-creation UI, confirm the generated file is publicly readable, verify product/service generation and source labels, and confirm provider-key/model failures fall back without breaking activity creation. Existing owner-uploaded images must remain unchanged; generated visuals are still temporary until replaced.
- [ ] Verify the home COVER shows exactly one currently eligible activity per slide (not two simultaneous covers), allows clicking the image to open that activity's public page, and has no overlaid title/name/text or unwanted shadow/overlay. Verify the behavior after data refresh and on narrow screens.

### Validation and completion criteria
- [ ] Add regression coverage for duplicate prevention, owner isolation, publication/deactivation visibility, social links, public URLs, QR codes, and catalog-home routing.
- [ ] Run build, lint/typecheck, available automated tests, and a real browser pass. Record separate statuses for source change, CI, deployment, and live behavior.
- [ ] Reconcile these tasks with existing issues/TODO sections so there is one clear source of truth; close an item only with evidence, and use NOT VERIFIED/WAIT/BLOCKED where appropriate.


## P0 — Easy end-to-end activity creation from platform administration
- [ ] Replace the current long single-screen activity form with a mobile-first guided wizard (1. Activity basics, 2. Owner account, 3. Location/contact, 4. Logo/cover/media, 5. Products/services, 6. Billing, 7. Review and save). Allow saving a draft and resuming later.
- [ ] Create the activity, primary branch, provider profile, and owner membership as one safe server-side workflow with rollback/compensation on partial failure. Owner selection must reuse an existing Auth identity by email; if no identity exists, create the account using the established secure onboarding flow without exposing passwords or service-role secrets.
- [ ] After creation, open the activity management page automatically with clear completion checklist and status for missing fields, owner assignment, images, products/services, permanent URL, QR code, billing, and publication.
- [ ] Make image upload work from the admin screen; preserve user uploads, and use clearly marked temporary placeholders only where supported. Do not require administrators to paste image URLs.
- [ ] Allow optional product/service entry during onboarding and allow skipping this step to complete it later from the activity page.
- [ ] Keep operational activation, payment confirmation, and public publication as separate explicit actions. Never mark an unpaid activity as paid or publish without the platform approval flow.
- [ ] Add duplicate-submit/idempotency protection, clear Arabic field-level errors, progress indicator, draft preservation, and success/failure recovery without creating duplicate activities or orphaned owner memberships.
- [ ] Add automated coverage for existing/new owner identity, duplicate submissions, partial failure cleanup, activity/branch/profile linkage, image upload, draft resume, publication approval, payment-state separation, owner isolation, and mobile layout.
- [ ] Verify production end-to-end from the actual administration UI before marking this section VERIFIED. Existing activity creation currently uses a long modal and must not be described as a completed guided workflow until this is implemented and tested.


## P0 — Admin-directed publication and live production synchronization
- [ ] Treat an explicit authorized platform-admin APPROVE/PUBLISH decision as the publication authority even when optional activity profile fields, products/services, or owner-uploaded images are incomplete. Do not block publication on optional completeness checks.
- [ ] Keep required identity/safety constraints and authorization checks; missing optional fields must render gracefully (omit empty sections/use approved temporary placeholders). Do not fabricate contact details, addresses, products, payment confirmation, or legal/verification claims.
- [ ] Ensure publication visibility is derived from the canonical production business/settings and provider-profile state consistently; the admin publish action must update all required production fields in a single safe, auditable server-side workflow and return a clear actionable error if any write fails.
- [ ] Ensure every subsequent activity/profile/product/service/image/social-link update is persisted to canonical production tables/storage and reflected in the public catalog through the existing refresh/realtime/cache-invalidation path; no local-only updates or shadow copies as the source of truth.
- [ ] Preserve existing fields on partial updates; use explicit patch semantics so omitted values do not erase saved metadata. Repeated save/publish requests must be idempotent and must not create duplicate records.
- [ ] Publication remains separate from operational activation, payment status/confirmation, verification, and entitlement. Admin publication alone must never mark payment as paid or silently activate financial/transactional features.
- [ ] Add regression tests for publish-with-incomplete-optional-data, public visibility after approval, all required production-state fields, edit-to-public propagation, image/product/social-link updates, partial-update preservation, cache/realtime refresh, retries/idempotency, and owner/tenant authorization.
- [ ] Verify against the live production UI and database before marking VERIFIED. This is a required behavior specification, not proof that the implementation is already complete.

## P0 — Admin activity creation, publication override, and subscription decision (2026-10-28)
- [x] Admin creation accepts missing optional owner phone, location, address, hours, bio, and images; any supplied phone/location values are still validated.
- [x] Admin chooses PAID subscription with a positive amount and explicit due date, or FREE activation with amount 0 and no due date.
- [x] FREE is stored as `paymentStatus: "free"`, `subscriptionMode: "FREE"`, `subscriptionAmount: 0`, with admin identity/time and `freeActivationApprovedByAdmin`; it is not falsely marked paid.
- [x] Owner membership activation gates recognize the explicit admin-approved free state without bypassing the paid-payment gate for paid subscriptions.
- [x] Publication approval can create/activate a provider directory profile when missing and does not require an active owner membership when the platform administrator explicitly approves publication; the decision is audited.
- [x] Deployed `catalog-platform-admin` Edge Function version 22, `public-catalog-directory` version 8, and `public-catalog` version 4 to Supabase project `moyhiluyhjsujhwlyeuu`; verified each deployed source matches GitHub, with JWT verification enabled for the admin function.
- [x] Added frontend UI and production mapping for subscription amount, free status, and due date; free activities hide payment-confirmation and due-date-edit controls. The client-side owner/subscriber activation gate also accepts only the explicit admin-approved free state.
- [x] Updated static production-state validator to cover optional fields and free-vs-paid subscription state; corrected a stale responsive-card spacing assertion that was blocking the release workflow.
- [x] Frontend TypeScript check, canonical taxonomy contract, paid/free subscription gate, production-state validator, build, public-directory smoke test, and GitHub Pages deployment all passed for commit `edfe4b3cab77bd45987a1e30fb44a7a06ba9f06e`; post-deploy root verification passed at `https://islamnagy2022-eng.github.io/MantiqatiX/`.
- [ ] **NOT VERIFIED:** authenticated end-to-end activity creation, free activation, admin publication, public catalog visibility, and owner assignment against production.
- [ ] **NOT VERIFIED:** real browser/mobile regression and post-deploy smoke tests.


## Follow-up publication audit hardening (2026-10-28)
- [x] Admin approval reuses an existing provider profile or creates one if missing, sets the canonical public-catalog flag and `publicationStatus: "PUBLISHED"`, and does not set payment to paid.
- [x] Admin publication approval and rejection now both write distinct audit-log actions. If the audit write fails after the state update, the API returns `PUBLICATION_AUDIT_FAILED` instead of reporting a silent success.
- [x] Corrected all platform audit writes to match the live `public.audit_logs` schema: generated required `id`, required `tenant_id` and `actor_user_id`, and stored structured payloads in `old_values`/`new_values` instead of the nonexistent `details` column. Activity creation now checks the audit write and rolls back the just-created activity on failure.
- [x] Public profile visibility and sellable catalog availability now use separate persisted states: approved profiles remain in the directory while operationally paused; product/service lists are omitted while operations are inactive or frozen; manual operational status changes no longer rewrite the publication decision.
- [x] Removed the fabricated default WhatsApp number from quote-request links; normalized Egyptian local numbers to international +20 format, rejected malformed/missing numbers, and disabled the quote action with a clear message if no valid contact exists.
- [x] Extended `validate-production-catalog-real-state.mjs` with source-contract assertions for approval with incomplete optional data, provider-profile reuse/creation, publication-vs-payment separation, audit failure handling, public-directory/storefront gates, and awaited catalog refresh after profile/item changes.
- [x] Post-deploy Supabase logs showed the health endpoint returning HTTP 200 and the public catalog directory returning HTTP 200 twice after the latest Edge Function deployment. This is a read-only smoke check, not an authenticated publish-and-edit end-to-end test.
- [x] Fixed the public-only GitHub Actions path classifier so a push with no file diff is marked not applicable instead of failing on `test -s`. A failure on the prior no-content-change documentation commit was a classifier false positive.
- [x] VERIFIED 2026-10-28: GitHub Pages run #8890 succeeded on commit `87d088ab01a11e3f6092012a4930d670780fb460`; the `validate` and `deploy` jobs passed, `MANTIQATIX_CATALOG_PRIMARY_ROOT_DEPLOY=PASS`, and the live JS/CSS assets were reachable. Primary Catalog Frontend Validation run #770 also passed. Authenticated owner/admin browser E2E, cross-tenant tests, and live transaction E2E remain NOT VERIFIED and still block full production sign-off.
- [ ] Complete an authenticated production end-to-end run from the admin UI using an isolated test activity: create with optional fields missing, approve publication, confirm public visibility, edit profile/social links and products/services, then read back the canonical production records. No production activity was created, edited, or deleted during this pass.
- [ ] Verify through the authenticated administration UI that approving publication does not enable product/order operations until operational status is separately set to `ACTIVE`; static assertions and deployed public reads are not a substitute for this end-to-end check.


---

## 2026-10-30 — TODO governance alignment with owner specifications 00–19

- [x] The complete owner operating specification set is now persisted at [docs/specifications/OPERATING_SPECIFICATIONS_00_19.md](docs/specifications/OPERATING_SPECIFICATIONS_00_19.md).
- [x] Root `TODO_PRODUCTION.md` remains the detailed Website/Catalog execution register. The global module and release register remains `docs/MASTER_PRODUCTION_TODO.md`; neither replaces the other.
- [x] Read the current RC40 → Web reuse guidance at `docs/RC40_MODULE_REUSE_EXECUTION_MATRIX.md`; verified the uploaded RC40 archive SHA-256 as `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`.
- [ ] Keep all current catalog requirements below this line intact. Reconcile shared requirements with the global TODO by linking task IDs; do not delete or silently mark old requests complete.
- [ ] Preserve the current deployed catalog UI exactly unless the owner explicitly asks for a visual change. Backend and functional work may continue additively; UI changes require a minimal diff and no-regression review.
- [ ] Keep the catalog as the primary website; do not republish the legacy website or demo content as the primary entry point.
- [ ] Use current main/live contracts as truth. RC40 and dated specifications are requirements/reference sources, not proof that a feature or schema is currently deployed.
- [ ] Continue module-by-module: map each task to existing code, data contracts, RLS/RBAC, APIs/Edge Functions, and tests before adding anything new.
- [ ] Record exact commit, PR, CI, deployment, and runtime evidence separately. Unverified behavior remains NOT VERIFIED; overall production status remains BLOCKED / NOT CERTIFIED.


---

## 2026-10-30 — PR overlap reconciliation

- [x] **PR #499 closed as superseded/duplicate** after confirming that PR #500 is already merged and the current `main` contains the folder-style taxonomy browser in `DirectoryView.tsx`. No duplicate navigation implementation was merged.
- [x] Existing `main` source was read back around the taxonomy browser branch; the folder navigation is present in the merged source.
- [ ] Verify the merged taxonomy navigation in the deployed public website with browser/device coverage. Source presence and prior PR merge are not proof of current runtime behavior.
- [ ] Preserve the current homepage, card layout, verified-first ordering, geographic search, and storefront flows during any follow-up. Reintroduce only a specific missing behavior as a minimal change against current `main`.
- PR #505 remains the documentation/governance PR for owner specifications and TODO alignment; its exact-head CI was still queued/in progress at this checkpoint. No merge or deployment is claimed.
- No application source, production database, migrations, Supabase settings, secrets, payments, or deployment targets were changed in this reconciliation.
- Production status remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-30 — Read-only live Edge Function/source parity checkpoint

- Project inspected read-only: `moyhiluyhjsujhwlyeuu`.
- Retrieved live deployed function metadata and `index.ts` contents, then compared each normalized live entrypoint with the matching `main` source file under `supabase/functions/<name>/index.ts`.
- The following six critical functions are **NOT BYTE-IDENTICAL** between live and repository source at this checkpoint:
  | Function | Live version | Live SHA-256 | Live bytes | Main source bytes |
  |---|---:|---|---:|---:|
  | `order-create` | 8 | `16f9b8bb687c33afeca14d85cb4c43af9948bd8b3ef3178990cc76ca1abea782` | 10,083 | 13,988 |
  | `payment-intent` | 8 | `d6b8faee1582c73ead440614cbe983114d1e7f31aa50f69795522fb20e737f54` | 8,114 | 10,366 |
  | `paymob-webhook` | 10 | `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca` | 11,538 | 12,665 |
  | `digital-page-payment-intent` | 5 | `8aa3d2e9c025e7b74d4d1847e8a6744bc84a9ded7cfc0c721f9604efd177af4b` | 5,345 | 6,532 |
  | `subscription-payment-intent` | 4 | `4466345787ea6b10a29b1dd63e9f0ab3cae640e9bb4d8ecb6d09445809e077e5` | 5,196 | 10,896 |
  | `financial-journal` | 3 | `79ee18d0544e7cab8fe33fe84c27a5017d1163f411eb5b9e07b99fd79e16e366` | 1,591 | 3,387 |
- This is a confirmed source-parity gap, not by itself proof that the live behavior is defective. Do not deploy repository versions or overwrite live functions until each diff is reviewed for contract, auth, idempotency, HMAC, ledger, and rollback implications.
- [ ] Produce a function-by-function semantic diff and map each behavior to callers, database RPCs/tables, RLS/grants, webhook replay/idempotency tests, and rollback version.
- [ ] Reconcile each live implementation into versioned source only after code review and isolated tests; do not replace live code by blind copying.
- [ ] Run isolated integration/security tests for all six functions before proposing any production rollout.
- Read-only inspection only: no function deployment, SQL write, migration, payment, or production data mutation.
- Production remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — RC449A → RC450 ordered disposable integration completed

- [x] Added the RC449A schema-prerequisite validator to the Backend-only CI validation job.
- [x] Expanded the financial-journal PostgreSQL 16 job to use one disposable database and execute the sequence: legacy journal fixture → RC449A → RC449A backfill assertions → RC450 → existing integrity-trigger fixture → RC450 behavioral assertions.
- [x] Exact PR head `155dd540ff32dbb42b0d1fe94d42a3f6945766bd` passed Backend-only Module Boundary run [40998309448](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40998309448): static validation, RC449A schema contract, PostgreSQL 16 RC449A→RC450 ordered integration, and approval-audit integration all succeeded.
- [x] RC449A fixture assertions verified legacy journal header totals/entry-number backfill, timestamps, deterministic line numbering, and defaults. RC450 assertions verified service-role-only RPC execution, verified actor binding, tenant/business/branch isolation, balanced details, duplicate-ID rejection, inactive-account rejection, and cumulative general-ledger balances.
- [ ] The above is disposable CI evidence only. It does not prove the pending migration chain is safe to apply to the live production schema.
- [ ] Keep RC449A/RC450 production rollout blocked until full chronological migration reconciliation (including earlier missing required releases), backup/restore and rollback rehearsal, approved change window, and post-deployment verification are complete.
- No Supabase production migration, SQL write, grant/Auth/RLS change, Edge Function deployment, payment, wallet action, or financial posting was performed.
- Production remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — Fresh physical-object reconciliation (read-only)

- [x] Reconfirmed the exact migration ledger: 308 rows, latest `20261029083845`, with 0/41 exact required release-version IDs recorded.
- [x] Corrected stale RC113–RC116 object-presence evidence. The exact 83,324-character applied forward-bundle statement `20261029041815_professional_dashboard_dependencies_forward_repair` matches its checked-in source and contains RC113, RC114, RC115, RC116 and RC457 source segments. Live role/employee tables, indexes and control-center RPCs are present via that forward bundle; original migration IDs remain absent.
- [x] Verified the four role/employee tables have RLS + FORCE RLS and no direct anon/authenticated/service_role table privileges. Their controlled RPCs use actor, membership and scope checks; runtime business-owner/admin browser E2E is still a separate gate.
- [x] Confirmed RC117 default images remain absent in Production: resolver/trigger functions, trigger attachments, and marketing_services image_url/image_source columns are missing. The two RC117 forward repairs in main are not in the live migration ledger.
- [x] Refreshed physical contracts: RC425 provider-event table/RPC absent; RC426 expected five-arg finalize function absent (old four-arg function remains); RC427 index absent; RC428–430 payment/subscription RPCs absent; RC431 payment RPC search_path drift; RC432 wallet idempotency index absent; RC434/435 RPCs absent; RC436/RC449A/RC450 journal prerequisites and grants absent; RC437/438 ERP line objects absent or drifted.
- [x] Confirmed additional scope gaps: RC452 live CRM manager policies are role-only rather than tenant/business scoped; RC102 marketing-provider-services owner write grants are absent; RC453 campaign tables/RPCs are absent; RC456 SMM service_role table boundary is absent while SMM remains deferred; RC525 digital-page admin policy does not show the explicit platform-admin scope expected by the reviewed source.
- [x] Verified RC451 forward repair 20261027223523 and dashboard forward bundle are recorded; Qadam follow-up 20261027205405 is recorded and business/owner/product state is ready. Known RC424 and marketing-contact aliases remain pending ledger reconciliation; duplicate SQL must not be rerun.
- [ ] Complete a source-to-live semantic reconciliation for every missing required migration and all affected policies/functions before planning any Production changes.
- [ ] Keep Production rollout blocked pending a reviewed chronological migration plan, current backup/restore and rollback rehearsal, payment/finance E2E, Auth hardening, Edge Function source/function contract parity, and browser/device evidence.
- No Production DDL/DML, migration, grant, Auth/RLS change, Edge Function deployment, payment, wallet action or financial posting was performed.
- Full platform release remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — RC428 → RC429 → RC430 Paymob webhook atomicity tests

- [x] Added a disposable PostgreSQL 16 fixture and integration suite for the provider-failure, subscription-failure, and subscription-success webhook RPCs.
- [x] Exact source head `69bece6d280f5a720b2219944dbf7ff6a7aaee2b` passed [RC428–RC430 Paymob Webhook Atomicity run 41000540681](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41000540681): fixture load, timestamp-ordered RC428 → RC429 → RC430 migrations, and integration assertions all succeeded.
- [x] Coverage includes service-role-only EXECUTE, signature/tenant/provider/pricing/amount/currency/provider-order checks, exact replay and conflicting replay rejection, final-state non-downgrade, subscription success/failure, `PAID_PENDING_LEGAL` handling, and rollback atomicity for event + intent + subscription writes.
- [ ] This is isolated CI evidence only. It does not establish Production migration safety, live Paymob HMAC verification, provider sandbox behavior, or live Edge Function parity.
- [ ] Keep RC425–RC441 and the live `paymob-webhook` rollout blocked pending full chronological migration/effect reconciliation, approved backup/restore + rollback rehearsal, and Paymob sandbox E2E.
- No Production migration, SQL write, grant/Auth/RLS change, Edge Function deployment, payment, subscription, wallet, or financial record mutation was performed.
- Production remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — Paymob isolated integration evidence refreshed (RC426–RC431)

- [x] PR [#510](https://github.com/islamnagy2022-eng/MantiqatiX/pull/510) merged as `2144759cdfdfc1d9d230ae77570e036c4e4f17f1`. Its disposable PostgreSQL 16 workflow [41000675401](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41000675401) passed RC428 → RC429 → RC430 in timestamp order, including provider correlation, replay, final-state protection, paid-pending-legal, and injected atomic rollback assertions.
- [x] PR [#511](https://github.com/islamnagy2022-eng/MantiqatiX/pull/511) merged as `de2493ed772e23ab3091e2ea1f44ff33c6d495dd`. Its disposable PostgreSQL 16 workflow [41001093795](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001093795) passed RC426 → RC427, covering owner/claim-token binding, required Paymob intent/order IDs, one active intent per order, and retry only after FAILED.
- [x] On current main `7d10152bf226fdd08d1dc70ed9c452bc37947bb8`, the existing RC431 digital-page payment integration workflow [41001452642](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001452642) passed. It exercises signature, provider order/transaction correlation, amount/currency, NULL status, replay status, cross-order reuse, and atomic rollback in disposable PostgreSQL.
- [x] Current-main web deployment workflow [41001452658](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001452658) completed with `validate_public_only=SUCCESS`, `validate=SUCCESS`, and `deploy=SUCCESS`. Production Health Monitor [41001452657](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001452657) also passed. This confirms the web deployment workflow, not payment database migration deployment.
- [x] Additional main checks passed: Backend-only Module Boundary [41001471918](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001471918), Module Professionalization Validation [41001471905](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001471905), and MantiGO Open Ride Privacy Boundary [41001471884](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001471884).
- [x] Fresh read-only Supabase verification still reports 308 migration records, latest `20261029083845`. Live database still has only the legacy four-argument `finalize_digital_page_payment_intent_backend`; its old `search_path=public, pg_temp` and authenticated EXECUTE remain. The expected five-argument RC426 function is not present.
- [x] Fresh read-only function/ACL inspection confirms the live RC431 RPC still has `search_path=public, pg_temp` rather than the hardened empty search_path. Live RC428/429/430 backend RPCs and RC435 claimable subscription RPCs were not found in the queried live function set. The RC450 journal RPCs still have no service_role EXECUTE.
- [x] Fresh read-only column inspection confirms RC435 `provider_creation_state/provider_creation_claimed_at` and RC439 encrypted checkout columns are absent from live `subscription_payment_intents`; the RC449A journal header/line columns remain absent from live schema.
- [ ] Do NOT apply RC426–RC431 or RC435/RC439 independently or out of order. The current production migration ledger and physical objects remain divergent from the required chronological source chain. The 41 exact required release identifiers are still not represented by their original IDs; reconcile each exact effect, forward bundle, duplicate alias and dependency before proposing rollout.
- [ ] Still required before any payment/finance production migration: disposable replay of the complete dependency chain against a schema-faithful snapshot, reviewed migration ordering, backup/restore and rollback rehearsal, provider sandbox end-to-end acceptance, semantic Edge Function parity review, approved change window, and post-deployment verification.
- No production Supabase migration, SQL write, grant, Auth/RLS change, Edge Function deployment, payment, subscription, wallet operation, or financial posting was performed during this checkpoint.
- Production remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — RC435–RC439 subscription checkout safety and latest-main production recheck

- [x] PR [#512](https://github.com/islamnagy2022-eng/MantiqatiX/pull/512) merged as `31b7256928b49af9a5f52c4aa69e55db7f1c91f1`. Disposable PostgreSQL 16 workflow [41001833105](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001833105) passed in fixture → RC435 → RC439 → integration order.
- [x] RC435 integration asserts service_role-only EXECUTE for both subscription intent creation and provider-claim RPCs; owner/business scope; server-side tier price; idempotent reuse and mismatch rejection; free/inactive tier rejection; non-owner and wrong-actor denial; one worker claim; second claim/legacy pending intent fail closed as outcome-unknown; correlated provider IDs return the existing binding.
- [x] RC439 integration asserts the three ciphertext/IV/key-version columns exist and the tuple is all-or-none. Important limit: this PostgreSQL test does not itself exercise AES-GCM encrypt/decrypt, real Paymob checkout, or key rotation. Source wiring/static validation is not a substitute for cryptographic runtime and provider sandbox E2E.
- [x] PR [#513](https://github.com/islamnagy2022-eng/MantiqatiX/pull/513) merged as `7d10152bf226fdd08d1dc70ed9c452bc37947bb8`; RC431 digital-page webhook integration passed in [41001452642](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001452642).
- [x] PR [#514](https://github.com/islamnagy2022-eng/MantiqatiX/pull/514) merged as `02ed2ee0c2894bc849190bb12fea757801f618d7`, recording the prior checkpoint. Latest main is now `0cd3b00ad977bfdf84ff7edcc613acae4ea6138e` after PR #512.
- [x] Latest-main web deployment [41001833124](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001833124) passed validation and deploy; Production Health Monitor [41001833032](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001833032) passed. Backend-only Module Boundary [41001833090](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001833090), Module Professionalization Validation [41001833036](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001833036), and MantiGO Open Ride Privacy [41001833049](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001833049) passed.
- [x] Fresh read-only Supabase check reconfirmed 308 migration rows, latest `20261029083845`. Live RC435 claimable subscription RPCs are absent; `subscription_payment_intents` has none of `provider_creation_state`, `provider_creation_claimed_at`, `client_secret_ciphertext`, `client_secret_iv`, or `client_secret_key_version`.
- [x] Fresh read-only function/ACL check: only legacy `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)` exists, with `search_path=public, pg_temp`, authenticated EXECUTE=true and service_role EXECUTE=false; the required five-argument finalizer is absent. Both live `post_financial_journal` and `post_financial_journal_backend` remain `search_path=public` and service_role EXECUTE=false.
- [x] Re-read all six critical live Edge Function entrypoints against current main. All remain non-identical: `order-create` v8 (10,083 live bytes vs 13,988 main), `payment-intent` v8 (8,114 vs 10,366), `paymob-webhook` v10 (11,538 vs 12,665), `digital-page-payment-intent` v5 (5,345 vs 6,532), `subscription-payment-intent` v4 (5,196 vs 10,896), and `financial-journal` v3 (1,591 vs 3,387). Do not deploy as a blind batch; each requires function-specific diff, schema/ACL dependency verification, sandbox E2E and rollback plan.
- [ ] No payment/finance migration or critical Edge Function is approved for production deployment. Do not apply RC426–RC431, RC435/RC439 or RC449A/RC450 individually/out of order; reconcile the full chronological chain and exact live object effects first.
- [ ] Still open: complete schema-faithful replay of the whole missing chain, exact migration alias/forward-bundle mapping, backup/restore and rollback rehearsal, Paymob sandbox E2E, AES-GCM runtime/key-rotation test, real authenticated cross-tenant browser E2E, Auth leaked-password protection, and SMM deferred negative runtime evidence.
- No production SQL writes, migrations, grants, Auth/RLS changes, Edge Function deployments, provider calls, payment/subscription/wallet operations or financial postings were performed during this checkpoint.
- Overall production release remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — RC439 versioned checkout-key rotation implemented (PR #518)

- [x] PR [#518](https://github.com/islamnagy2022-eng/MantiqatiX/pull/518) merged as `5f3415b8b736c2bed6cbb16a749319dc5d552d60`.
- [x] Subscription checkout encryption now reads active version from `PAYMOB_CHECKOUT_ENCRYPTION_ACTIVE_VERSION` (defaults to `v1` for backward compatibility) and selects key material from versioned server-side secrets such as `PAYMOB_CHECKOUT_ENCRYPTION_KEY_V1` and `..._V2`.
- [x] New checkout secrets are encrypted using the active key version; existing rows are decrypted using their stored `client_secret_key_version`. Malformed versions and missing keys fail closed.
- [x] Expanded AES-GCM unit coverage passed on exact PR head: round-trip, unique IV, intent/business associated-data binding, tamper rejection, V1→V2 rotation while retaining V1 decrypt, and missing/malformed key rejection. RC425 crypto step and RC435–RC439 checkout workflow both passed on PR #518.
- [x] Payment wiring validation, build, professional dashboard browser E2E, employee RBAC PostgreSQL, targeted-ad search-path, matrimony privacy, MantiGO privacy, RC450 journal, and approval-audit checks passed on PR #518.
- [ ] The change is merged to source only. It does **not** deploy the Supabase Edge Function or change secrets. Live `subscription-payment-intent` remains v4 until a separately approved deployment; do not activate V2 until both V1 and V2 keys are configured in Supabase secrets and staging checkout/recovery is verified.
- [ ] Production payment migrations and all six critical Edge Function parity mismatches remain separate blockers. Do not treat PR #518 as payment production approval.
- No production migration, Edge Function deployment, environment-secret update, provider call, checkout, payment, wallet or financial posting was performed.
- Full production remains **BLOCKED / NOT CERTIFIED**.

---

## 2026-10-30 — Fresh Supabase Security Advisor classification (read-only)

- [x] Latest-main web deploy after PR #519 passed: [41002621137](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41002621137). Production Health Monitor passed: [41002621047](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41002621047). Backend-only boundary, Module Professionalization, MantiGO privacy and SMM deferred contract also passed on main 5fd3d3589282e07232311154bd95d35c9a91cc71.
- [x] Fresh Supabase Security Advisor at 2026-10-30 04:23 UTC: 8 RLS-enabled/no-policy tables; 3 anon-executable SECURITY DEFINER functions; 67 authenticated-executable SECURITY DEFINER functions; leaked-password protection DISABLED.
- [x] Classified the 8 no-policy tables: all 8 have RLS enabled and no direct anon/authenticated table privileges; 6 also have no direct service_role table privileges, while 2 are service_role-only. Seven have FORCE RLS; digital_page_payment_events does not, but has no direct anon/authenticated/service_role table privileges. Treat these as deny-by-default/RPC-mediated contracts pending per-table caller review, not as a reason to add broad policies.
- [x] Classified the 3 anon SECURITY DEFINER warnings: assign_default_owner_to_unowned_business() and capture_commission_rule_audit() are trigger-returning functions attached to table triggers, not ordinary client RPCs; get_mnty_targeted_advertisements(...) is the intended public discovery RPC and has empty search_path. The default-owner trigger is attached to deferred AFTER INSERT on businesses; preserve its intended ownership contract but review its fixed search_path separately.
- [x] Classified all 67 authenticated-executable SECURITY DEFINER functions by function-level search_path: 30 use exactly search_path=public; 17 use search_path=public, pg_temp; 19 use empty search_path; 1 trigger function uses search_path=public, auth. anon and authenticated have no CREATE privilege on public or auth schemas. RC440 is the existing reviewed migration intended to move the 30 exact-public functions to public, pg_temp, preventing implicit temporary-schema precedence; RC440 is still absent from the live ledger and must remain in the full ordered migration plan.
- [ ] Leaked Password Protection remains DISABLED and requires an authorized Supabase Auth dashboard setting change followed by Advisor recheck. No setting was changed.
- [ ] Do not bulk-revoke the 67 function grants or add policies to the 8 no-policy tables. Review each function's caller/ACL and each table's intended RPC-only access; preserve public ad discovery and required trigger behavior while applying RC440 in the approved ordered chain.
- No production SQL writes, grants, RLS/Auth changes, Edge Function deployments, provider calls, payments, wallet operations or financial postings were performed.
- Full production remains **BLOCKED / NOT CERTIFIED**.

---

## 2026-10-30 — RC440 SECURITY DEFINER search_path integration gate merged

- [x] PR [#520](https://github.com/islamnagy2022-eng/MantiqatiX/pull/520) merged as cbc474cbfd39afb87061aed3a720ca666effed91, recording the latest read-only Security Advisor classification.
- [x] PR [#521](https://github.com/islamnagy2022-eng/MantiqatiX/pull/521) merged as fd89faca30aca45622f0a012f283896ef20e4e08, adding a dedicated PostgreSQL 16 RC440 integration workflow and isolated fixture.
- [x] RC440 CI passed on the PR head and again on main in [41003030610](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41003030610). Assertions cover anonymous/authenticated function search_path hardening to public, pg_temp; temporary-table shadowing prevention; preservation of intended anon/authenticated EXECUTE grants; unchanged already-hardened functions; and exclusion of service_role-only functions.
- [ ] This is test coverage only. RC440 has not been applied to Production; read-only inventory still shows 30 authenticated-executable SECURITY DEFINER functions with exact search_path=public. Keep RC440 inside the approved chronological migration plan.
- No production SQL, migration, grant, RLS/Auth setting, Edge Function deployment, provider call, payment or financial mutation occurred.
- Production remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — Owner specification cross-reference completed (SPEC-00–SPEC-19)

- [x] Created [docs/specifications/SPECIFICATION_TODO_TRACEABILITY.md](docs/specifications/SPECIFICATION_TODO_TRACEABILITY.md), mapping all 20 persisted owner specifications to the existing global, website/catalog, and module-acceptance TODO registers.
- [x] Assigned stable cross-reference keys `SPEC-00`–`SPEC-19`; these are mapping keys only and do not replace existing TODOs or mark implementation complete.
- [x] Preserved the current TODO entries and their existing checkboxes/statuses. No historical tasks were bulk-closed or deleted.
- [ ] Continue reconciling `docs/TODO_MASTER_DEVELOPMENT.md` acceptance criteria against the global and website/catalog registers; add links rather than duplicate tasks.
- [ ] Verify the already-merged PR #500 taxonomy folder navigation against the deployed public catalog with browser coverage; real-device/accessibility review remains separate.
- UI guard remains active: no redesign, no replacement of existing screens, and no removal of current homepage, cards, covers, verified-first ordering, geographic search, or storefront behavior.
- No application source, UI, database, migrations, production data, Auth/RLS, Edge Functions, secrets, or deployment targets were changed. No browser/runtime test is claimed by this documentation update.
- Production remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — PR #524 merged; taxonomy browser regression verified in CI

- [x] PR [#524](https://github.com/islamnagy2022-eng/MantiqatiX/pull/524) merged to `main` as `51fad575eb740d61b3de5ea3a856dbf7cc68bbfd`.
- [x] Owner specifications 00–19 cross-reference is now on `main`: `docs/specifications/SPECIFICATION_TODO_TRACEABILITY.md`, with updates to the three TODO registers, session log and continuity handoff.
- [x] Exact-PR Primary Catalog Frontend Validation [run 41005124723](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005124723) passed all three jobs: TypeScript/taxonomy/geographic/auth/catalog contracts and production build; isolated PostgreSQL employee RBAC; Playwright browser E2E.
- [x] The new Playwright cases passed for group → category → specialty navigation, breadcrumb/back navigation, return to catalog, and 390/768/1440 px overflow checks. Existing dashboard browser cases passed in the same suite.
- [x] Other exact-commit workflows passed: Backend-only Module Boundary [41005124684](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005124684), Module Professionalization [41005124752](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005124752), SMM deferred contract [41005124687](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005124687), MantiGO privacy [41005124756](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005124756), RC425 Paymob atomicity [41005124735](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005124735), flexible commission drafts [41005124782](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005124782).
- [x] Pages workflow on the PR event passed its validation job in [run 41005124658](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005124658); `validate_public_only` and `deploy` were skipped as expected for a pull-request event. This is not a production deployment claim.
- [ ] Confirm the post-merge `main` Pages deployment and its deployed-origin Playwright run. `.github/workflows/pages.yml` already runs this same browser suite against the deployed origin after a successful main deployment; the merged taxonomy tests will therefore be exercised against the deployed catalog when that workflow completes.
- No application UI, styling, layout, routes, production schema/data, migrations, Auth/RLS/grants, Edge Functions, secrets, payment records or financial data were changed. Test changes only.
- Current UI no-regression guard remains active. Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.


---

## 2026-10-30 — PR #525 merged: confirmed green / unconfirmed red counters

- [x] PR [#525](https://github.com/islamnagy2022-eng/MantiqatiX/pull/525) merged to `main` as `3bf212793e61ad6ae47f46e6fa73b0d8b988be4c`.
- [x] Corrected the four titled unconfirmed-directory count markers in `DirectoryView.tsx` to use the red treatment `bg-red-50 text-red-700`.
- [x] Preserved confirmed activity count styling in green; no layout, typography, spacing, group order, verified-first ranking, filter, or business logic was changed.
- [x] Exact-PR Primary Catalog Frontend Validation [41005476492](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005476492) passed all jobs: build/typecheck/contracts, isolated PostgreSQL employee RBAC, and Playwright browser E2E. The new assertions verify all unconfirmed counters are red and the confirmed counter remains green.
- [x] Supporting exact-commit workflows passed: Backend-only Module Boundary [41005476414](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005476414), Module Professionalization [41005476508](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005476508), MantiGO privacy [41005476429](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005476429), RC425 Paymob atomicity [41005476528](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005476528), and Flexible Commission Drafts [41005476427](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005476427).
- [x] Pages PR validation [41005476412](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41005476412) passed its validation job; public-only validation and deploy were skipped as expected for the pull-request event.
- [ ] Verify the post-merge main Pages deployment and deployed-origin Playwright outcome. Do not treat PR merge/CI as proof that the live catalog is updated.
- The change is a minimal, explicitly requested color correction. No database, migration, production data, Auth/RLS/grant, Edge Function, secret, payment, or financial data was changed. Full Production Gate remains **BLOCKED / NOT CERTIFIED**.


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
 

## 2026-10-30 — Post-deploy browser verification and Edge semantic diff

- [x] Main Pages deployment run [41005969738](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/41005969738) completed successfully on `fe01dce043c8c8b5821ad679b561963a23a5357a`; artifact upload, Pages deploy, and primary catalog root verification passed.
- [x] Deployed-origin Playwright step passed: guest direct-route denial; owner dashboard mobile/desktop; axe critical/serious WCAG 2.1 checks; owner refresh and membership scope; employee view-only/roster read-only; legacy route denial and RPC scoping; unsupported manager grant denial; QR modal/tab accessibility; permanent store URL/QR base-path and stable business ID; GPS consent/manual fallback; taxonomy folder navigation and specialty selection.
- [x] Confirmed the deployed browser run executed `apps/catalog-frontend/tests/professional-dashboard.browser.e2e.mjs` and emitted `PRIMARY_CATALOG_BROWSER_E2E=PASS`.
- [x] Completed a read-only semantic source comparison for six deployed Edge Functions. Report: [`docs/audits/DEPLOYED_EDGE_SEMANTIC_DIFF_20261030.md`](docs/audits/DEPLOYED_EDGE_SEMANTIC_DIFF_20261030.md).
- [x] Identified material source-level drift in deployed `payment-intent v8`, `digital-page-payment-intent v5`, `subscription-payment-intent v4`, and `financial-journal v3`; webhook and order-create remain under detailed contract review.
- [ ] Build an isolated restorable schema and verify live RPC definitions/ACLs/search_path against current migrations before any function deployment.
- [ ] Add/run adversarial and integration tests for provider amount/currency/reference mismatch, missing provider order ID, unknown provider outcomes, duplicate/replayed webhooks, concurrent subscription claims, checkout-secret encryption/recovery, and financial actor-role denial.
- [ ] Prepare reviewed, one-function-at-a-time deployment/rollback plan only after all database contracts and secrets are verified.
- The Pages/browser gate is now VERIFIED for this deployed commit. The overall platform Production Gate remains **BLOCKED / NOT CERTIFIED** due to live Edge Function semantic drift, anonymous JWT/RLS review, SECURITY DEFINER review, migration reconciliation, financial/payment E2E, and backup/restore gates. No production Supabase or payment mutation was performed.


### Additional live SQL contract findings — 2026-10-30
- [x] Read-only live pg_proc/ACL/column/ledger checks confirmed current production lacks RC435 subscription claim functions and columns, and RC439 encrypted checkout columns. The corresponding migration versions 20261009210000 and 20261010010000 are absent from the live ledger.
- [x] Confirmed the RC436 atomic financial journal migration 20261009220000 is absent from the live ledger. The only existing post_financial_journal and post_financial_journal_backend RPCs have no service_role EXECUTE privilege.
- [x] Confirmed current main financial-journal Edge source still calls post_financial_journal_backend, while RC436 defines the service-role-granted post_financial_journal_atomic_backend; source-to-migration contract must be corrected and tested before deployment.
- [ ] Restore production schema into an isolated database; rehearse RC435/RC436/RC439 migrations and run their full integration/rollback tests. Never apply these migrations directly to production as an exploratory fix.
- [ ] Correct the financial-journal Edge RPC call to the atomic contract only after source tests prove the argument/actor context and the isolated migration rehearsal passes.
- Release remains BLOCKED / NOT CERTIFIED. No production SQL, migration, grant, payment, or Edge Function mutation was performed.


### Correction to financial-journal rollout interpretation — 2026-10-30
- [x] Deeper review confirms RC449A → RC450 is the canonical production migration sequence; RC436 is an earlier alternative and must not be applied as a substitute.
- [x] Current main Edge Function RPC name/signature matches RC450 (post_financial_journal_backend(uuid,jsonb,jsonb)). The earlier note claiming a mismatch with an RC436-only atomic RPC is withdrawn.
- [x] Read-only live check confirms RC449A 20261010175000 and RC450 20261010180000 are both absent. The live RPC has only postgres EXECUTE ACL, service_role cannot execute, and the old body requires p_user_id=auth.uid() rather than supporting the trusted service-role actor flow and RC450 business/branch/organization scope.
- [x] Existing reviewed assets: docs/runbooks/RC450_FINANCIAL_JOURNAL_ROLLOUT.md, RC450 integration SQL, and service-role source-contract validator.
- [ ] Rehearse RC449A then RC450 in a restorable isolated database; only then plan approved production migration and matching Edge deployment.
- [ ] Do not apply RC436 as a shortcut or grant EXECUTE on the legacy RPC.
- The financial journal remains CRITICAL / BLOCKED pending the canonical rollout.


## 2026-10-30 — RLS / Anonymous JWT / SECURITY DEFINER review
- [x] Fresh Security Advisor: 90 anonymous-policy warnings, 67 authenticated-executable SECURITY DEFINER functions, 3 anon-executable SECURITY DEFINER functions, 8 RLS-enabled/no-policy INFO findings, and leaked-password protection disabled.
- [x] Policy inventory: 483 authenticated policies; 283 explicitly mention is_anonymous; 200 do not. 215 reference auth.uid(); 103 reference user_memberships. These are overlapping text indicators, not proof of safety or vulnerability.
- [x] No-policy table ACL check: none of the eight grant direct table privileges to anon/authenticated; six have no service_role table privileges, and two are service_role-only. No broad RLS policy was added.
- [x] Triage of anon SECURITY DEFINER: two are trigger-only functions; one is the intentionally public read-only targeted-ad lookup with empty search_path and bounded results. Trigger paths and public response fields still require tests.
- [x] 67 authenticated SECURITY DEFINER static triage: 60 reference auth.uid(); 27 reference membership; 23 explicitly compare actor IDs; 37 have empty/explicit pg_temp-last paths; 30 use search_path=public only. A static scan found no unqualified public table references in those 30, but temp-object tests and function-by-function review remain open.
- [x] Detailed evidence and safe test plan: docs/audits/RLS_ANONYMOUS_AND_SECURITY_DEFINER_20261030.md.
- [ ] Run anonymous JWT and cross-tenant/business/branch adversarial tests on an isolated restorable database; do not create anonymous users or probe sensitive rows in production.
- [ ] Review all 67 SECURITY DEFINER functions, callers, actor binding, grants, owners and search_path; make narrow fixes only after tests.
- [ ] Enable Leaked Password Protection through approved Auth configuration and test password flows.
- Security gate remains BLOCKED / NOT CERTIFIED; no production RLS/ACL/Auth change was made.

- [x] Follow-up table-level cross-check: 126 public tables have authenticated policies; 71 have a restrictive is_anonymous guard and 55 do not. The 55 are not vulnerabilities by count because some individual permissive predicates explicitly reject anonymous JWTs or bind to auth.uid()/membership. Detailed caveat added to the RLS audit report.


## 2026-10-30 — Production gate manifest refresh
- [x] Refreshed docs/release/production-migration-reconciliation.json with latest read-only ledger snapshot (308 rows, latest 20261029083845), 41 required original release-source versions still absent, corrected RC449A→RC450 financial-journal path, RC435/RC439 missing subscription contracts, and fresh RLS/SECURITY DEFINER advisor snapshot.
- [x] Corrected the financial-journal note: current main Edge RPC name matches RC450; production is blocked by missing RC449A/RC450 and the old live RPC ACL/body. Deployed Edge v3 remains legacy and must not be restored blindly.
- [ ] Continue exact stored-statement-to-source reconciliation and physical schema checks for the 41 required versions; do not replay aliases or fabricate migration ledger records.
- Overall platform gate remains BLOCKED / NOT CERTIFIED.


## 2026-10-30 — Legacy catalog convergence and verified-first result summary

- [x] Audited all supplied sources: owner operating specifications 00–19, RC40 Android/source archive, and the older `bizcatalog-manager (3).zip` React/Vite catalog snapshot. The 20 operating specifications and their SPEC-00…SPEC-19 traceability were already preserved in the repository; RC40 checksum was verified against the uploaded archive bytes.
- [x] Recorded the old-catalog-to-current-main mapping in `docs/CATALOG_SOURCE_CONVERGENCE_AUDIT_20261030.md`; the current `apps/catalog-frontend` implementation remains canonical. The older `seedData.ts`, AI Studio temporary media, and browser-side Gemini credentials are explicitly excluded from production import.
- [x] Preserved RC40 reuse rules: reuse domain concepts only through current shared APIs/Edge Functions/RLS/RBAC; do not copy Android Room persistence, legacy direct writes, or parallel business/financial engines.
- [x] Existing verified-first ranking remains authoritative: verified registered activities sort before unverified registered activities; published unclaimed directory listings remain in the unified result grid after verified businesses. Geographic distance and profile completeness remain secondary sort keys and cannot outrank verification.
- [x] Added a compact green verified / red unverified count summary above the existing result grid. Unverified count includes unverified registered businesses and published unclaimed directory listings. Existing homepage, cards, three-column mobile grid, taxonomy folders, filters, covers, routes, and storefront were preserved.
- [x] PR #531 merged as `907e2448584015095de47432ee62ff61b9c1edf7`; exact-PR Primary Catalog Frontend Validation run [41013793105](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41013793105) passed build, RBAC PostgreSQL, and browser E2E. Main validation [41013924236](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41013924236) passed the same checks. Main Pages deploy [41013924305](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41013924305) passed deployment, primary-root verification, and deployed-origin browser checks. Full evidence: `docs/CATALOG_SOURCE_CONVERGENCE_AUDIT_20261030.md`.
- [ ] Continue the remaining catalog E2E tasks already listed above: authenticated create/publish/edit/readback, owner and tenant isolation, duplicate prevention, permanent links/QR scans, social links, and authenticated AI image generation.
- Production migration/Auth/RLS/Edge Function/payment/finance/backup/restore gates remain governed by the P0 release section above. No production database or financial mutation was performed by this catalog convergence change.



## 2026-10-30 — Verified activity external brand links (PR #533)
- [x] قدم السعد provider profile is confirmed `is_verified=true` in production.
- [x] PR [#533](https://github.com/islamnagy2022-eng/MantiqatiX/pull/533) merged to `main` as `f38b609b00fd0025793b00ebf7990073dfaff4c9`; directory cards and storefront headers now render external logo/cover links immediately after the verification badge when the URLs exist.
- [x] Primary Catalog Frontend Validation [41015206306](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41015206306) passed build/TypeScript, isolated PostgreSQL RBAC and browser jobs.
- [ ] Post-merge Pages deployment and deployed-origin verification of the logo/cover links. PR-triggered Pages deploy was skipped; do not claim production publication yet.
- [ ] Focused E2E for both URLs / logo-only / cover-only / no URLs / unverified; confirm no parent-card click propagation.
- [ ] Audit all verified activities for valid external logo and cover URLs; do not fabricate missing assets.
- [ ] For every new user request, add a linked item to the canonical TODO register and keep it open until implementation, tests, deployment and applicable production verification are complete.
- Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.

 
## 2026-10-30 — PR #534: explicit external logo/cover URLs

- [x] Confirmed PR #533 deployment succeeded on main in Pages run [41015430795](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41015430795).
- [x] Corrected the distinction between display images and external links: generated/default logo and cover images remain display-only; only explicitly configured HTTPS URLs are exposed as external actions.
- [x] PR [#534](https://github.com/islamnagy2022-eng/MantiqatiX/pull/534) merged to `main` as `9cb40af9886e5141702576a7a20f300b78fcff4e`; both public directory and direct public storefront responses now carry explicit external URL fields.
- [x] Browser E2E covers both URLs, logo-only, cover-only, neither URL, unverified profile, and direct storefront hydration. Primary Catalog Frontend Validation [41016181188](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41016181188) passed build, browser E2E and PostgreSQL RBAC.
- [x] Pages PR validation [41016181132](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41016181132) passed; deployment skipped on PR by design.
- [x] Post-merge main Pages deployment [41016389584](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41016389584) passed deployment, root verification and deployed-origin browser checks.
- [x] Read-only production audit: 2 ACTIVE verified profiles, both with HTTPS logo and cover URLs; 0 invalid configured URLs. Fallback images remain display-only.
- Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-30 — RC458 digital-page payment RPC search-path hardening (Issue #269)

- [x] Read-only Production inventory of `claim_digital_page_payment_intent_backend`, `release_digital_page_payment_intent_claim_backend`, and `fulfill_digital_page_publish`: all are postgres-owned SECURITY DEFINER functions with `search_path=public, pg_temp`; authenticated EXECUTE is intentional, anon is not granted.
- [x] Confirmed the existing caller contract: claim/release bind the supplied user to `auth.uid()`; publication binds actor to `auth.uid()` and checks platform-admin authority. Preserve these checks and the authenticated grants.
- [x] Prepared forward-only RC458 migration `20261030120000_rc458_digital_page_payment_rpc_empty_search_path.sql`, changing only the function search_path to empty for the three RPCs. No function body, ACL, or production state is changed by the migration source itself.
- [x] Added disposable PostgreSQL fixture, cross-user / unauthorized-publication / temporary-table-shadow / ACL regression suite, and CI workflow. See `docs/audits/DIGITAL_PAGE_PAYMENT_RPC_SEARCH_PATH_20261030.md`.
- [x] First RC458 CI run exposed an ambiguous `id` reference in the claim RPC (output parameter vs table column). Forward migration now aliases `digital_page_orders` in both SELECT and UPDATE; the regression suite asserts the qualified reference.
- [x] Pinned the forward-replay workflow to Supabase CLI v2.122.0 after its latest-release lookup hit GitHub API throttling; public ECR image pulls were also rate-limited in that first attempt.
- [x] PR [#538](https://github.com/islamnagy2022-eng/MantiqatiX/pull/538) merged as `64ce588f2e3854e278cb19f18d90018788714d7e`; RC458 changes the three procedures to empty `search_path`, preserves authenticated EXECUTE, and qualifies the claim RPC table references to fix the discovered ambiguous `id` bug.
- [x] Disposable PostgreSQL regression [41019320495](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41019320495) passed ACL preservation, cross-user claim/release denial, temp-table shadow resistance, actor binding, non-admin publish denial and idempotent admin publication.
- [x] Full isolated Supabase forward replay [41019320366](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41019320366) passed from checkpoint `20261008222845`; 73 later migrations applied in order, including RC458, with owner-profile, RC455/RC456 and two-tenant isolation assertions.
- [x] Main post-merge RC458 integration [41019626515](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41019626515) and full replay [41019626775](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41019626775) passed. Migration history immutability, version uniqueness and cross-PR collision checks passed.
- [x] Issue [#269](https://github.com/islamnagy2022-eng/MantiqatiX/issues/269) closed for source remediation and isolated verification only.
- [ ] Production rollout remains separate and NOT performed. RC458 is not applied to Production. Before any production migration, complete the global release gate, backup/restore and rollback evidence, then obtain explicit approval. Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.



## 2026-10-30 — CAT-TAXONOMY-REORG: merge, browser verification and deployment

- [x] PR [#537](https://github.com/islamnagy2022-eng/MantiqatiX/pull/537) merged as `80eeb41e90c133d5b66dea50853ba4306c6424fa`.
- [x] Canonical hierarchy is now **المجال الرئيسي → النشاط → التخصص/الخدمة**; explicit activity category codes are consumed by the current directory mapper and narrow public directory/storefront APIs.
- [x] Existing taxonomy identifiers and the current homepage, unified results, verified-first ranking, geography filters, storefront and owner/employee boundaries were preserved.
- [x] Exact-head browser validation [41020400819](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41020400819) passed build, employee RBAC PostgreSQL and browser E2E, including folder back-navigation, specialty selection, 390px mobile overflow checks and 390/768/1440px responsive checks.
- [x] Main Primary Catalog validation [41020608750](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41020608750) passed build, RBAC and browser E2E.
- [x] Main Pages deployment [41020608742](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41020608742) passed deploy, primary-root verification and deployed-origin browser checks.
- [x] The taxonomy audit records the previously audited redistribution of 10 business records and 8 public listings; PR #537 itself did not write production data or change verification, subscription, ownership, publication or contact states.
- [ ] Add the secure admin taxonomy-mapping interface with dry-run preview and audit history.
- [ ] Evaluate whether the 18 existing functional domains can be consolidated without breaking legacy identifiers or mixing unrelated activities. This requires a compatibility plan and regression tests.
- Overall Production Gate remains **BLOCKED / NOT CERTIFIED** for unrelated live migrations, payments/finance, Auth, Edge parity and backup/restore gates.

## 2026-10-30 — Google OAuth / subscription bootstrap performance

- [x] Root-cause review found that authenticated bootstrap loaded each authorized business catalog sequentially (one `CATALOG_READ` Edge request at a time, up to 250 rows), making Google sign-in latency grow with the number of memberships/businesses.
- [x] Root-cause review found that `TOKEN_REFRESHED` was treated as a new bootstrap key because the access token was included in the deduplication key. Routine token rotation therefore reloaded memberships, businesses, products, and platform subscriber/settings data despite an unchanged Google user identity.
- [x] Changed auth bootstrap deduplication to stable user ID and stopped triggering full catalog bootstrap on routine `TOKEN_REFRESHED`; actual identity changes, sign-in/out, and explicit user/password recovery events remain handled.
- [x] Replaced serial business catalog reads with a bounded 8-worker pool. Tenant business-list requests now run concurrently, and platform subscriber/settings reads run in parallel. Existing 250-row cap, membership selection, branch scope, role checks, and fail-closed behavior are preserved.
- [x] Extended Google OAuth contract validation to assert token-refresh deduplication and bounded concurrency.
- [x] Exact-head TypeScript/build, Google OAuth contract, browser E2E, employee RBAC, privacy boundaries, and related integration checks passed on the final fix head before merge.
- [ ] Verify with real Google accounts representing platform admin, one-business owner, multi-business owner, and customer-only user; record sign-in-to-ready timings and ensure no duplicate memberships/subscriptions are created or hidden.
- [x] Merged after exact-head CI passed; Pages deployment job and post-deploy Production Health Monitor both passed on main commit `ff2f3176017db83e0fb80d1d768fdf79f1d42e1e` (2026-10-30). This is a frontend performance fix; no subscription/payment/financial records or Supabase production settings were changed.
- [ ] Complete real-account timing verification for platform admin, one-business owner, multi-business owner, and customer-only user; compare sign-in-to-ready timings and confirm no duplicate memberships/subscriptions are created or hidden.


## 2026-10-30 — Subscriber directory stale-response protection and manual refresh

- [x] Follow-up review found logout did not immediately invalidate the in-flight auth sequence; a delayed admin subscriber response could theoretically settle before the asynchronous `SIGNED_OUT` event.
- [x] Logout now increments the auth-load sequence and clears the active identity before calling Supabase sign-out, invalidating pending background directory writes immediately.
- [x] Added an admin-only manual subscriber-directory refresh guarded by the current user ID and auth sequence; non-admin sessions cannot invoke it through the UI or context action.
- [x] Added a loaded-record count and explicit refresh/loading state in the existing subscribers tab without changing its overall layout.
- [x] Latest `main` commit `16c63134f4e802a59065f736fc304a41b0c7daef`: TypeScript check, production catalog build, Google OAuth session/role contract, membership fail-closed and paid-activation contracts, browser dashboard E2E, and employee RBAC PostgreSQL CI all passed. Evidence: Primary Catalog Frontend Validation [run 41114467609](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/41114467609).
- [x] The same `main` commit was deployed to GitHub Pages; deploy job and deployed-origin browser checks passed [run 41114467653](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/41114467653), and Production Health Monitor passed [run 41114467602](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/41114467602).
- [ ] Real-account verification remains open: logout during an in-flight `LIST_SUBSCRIBERS` request, switching between distinct Google identities, failed directory read followed by manual retry, and successful retry after a later session; confirm no previous-account data is rendered or retained.
- [ ] Record measured sign-in-to-home readiness and subscriber-directory completion timings using authorized Google test accounts for platform admin, one-business owner, multi-business owner, and customer-only user. Do not infer timings from CI.
- [x] PR #543 and its logout/race-guard follow-up changed frontend/context, admin UI, contract tests, and TODO documentation only; no database migrations, subscription/membership/payment records, RLS policies, or production Supabase settings were changed.

## 2026-10-30 — Defer full platform subscriber directory from Google sign-in

- [x] Additional root-cause review found `bootstrapProductionUser` awaited `LIST_SUBSCRIBERS` and mapped the complete platform subscriber directory before returning the authenticated workspace. This made a large administrative directory part of the critical Google sign-in path.
- [x] Extracted `fetchPlatformSubscribers()` as a separate admin-only data loader; removed `LIST_SUBSCRIBERS` from the blocking authentication bootstrap. The existing `GET_SETTINGS` read remains in bootstrap for platform configuration.
- [x] Start the subscriber directory request asynchronously after the authenticated admin workspace has been established; keep it tied to the current auth sequence/user so a late response cannot populate a different user's session.
- [x] Added a separate subscriber-directory loading indicator in the admin subscribers tab; subscriber data, orphan-membership warning and directory errors are applied when the background request completes.
- [x] Added contract assertions that the main auth bootstrap does not invoke `LIST_SUBSCRIBERS` and that the directory loads asynchronously.
- [x] Exact-head TypeScript/build, Google OAuth contract, admin browser E2E, employee RBAC, backend boundaries, privacy integrations, and related checks passed on PR #543 head `cb219cb800a8c158712875c24cdd73966689fa56`.
- [ ] Verify real platform-admin Google sign-in reaches the home workspace before the subscriber directory finishes; verify the directory subsequently fills accurately and errors are displayed without converting a successful sign-in into an auth failure.
- [x] PR #543 merged as `5e420c327b2d6197938e5252a61a73617fb8d458`; Pages deployment run [41106764523](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41106764523) passed, and post-deploy Production Health Monitor [41106764621](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41106764621) passed (2026-10-30). Main catalog browser/employee RBAC validation [41106764544](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41106764544) passed.
- [x] No subscriptions, identities, membership rows, payments, or RLS policies were deleted, merged, or rewritten by this optimization.
- [ ] Complete real Google-account timing verification for platform admin and business owners; record first-screen readiness separately from subscriber-directory completion.


## 2026-10-31 — Subscriber refresh failure resilience

- [x] Review confirmed that `fetchPlatformSubscribers()` returns an empty list together with an error when the backend request fails.
- [x] Preserve the last successfully loaded subscriber directory on background/manual refresh errors; still expose the error and clear the loading indicator so the platform admin can retry.
- [x] Extend the Google OAuth contract test to assert stale-response guards for logout/account switching, admin-only manual refresh, and preservation of last-good subscriber data on failed refresh.
- [x] Exact-head TypeScript, production build, Google OAuth/session/role and membership contracts passed in primary frontend validation [run 41137037052](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41137037052); dashboard local browser E2E and employee RBAC PostgreSQL passed in the same run.
- [x] Main Pages deployment, primary-root verification, and deployed-origin browser checks for dashboard routes, mobile layout, membership scopes, and permanent QR links passed [run 41137037072](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41137037072); Production Health Monitor passed [run 41137037064](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41137037064).
- [ ] Exercise a controlled failed `LIST_SUBSCRIBERS` response followed by a successful manual retry in an authorized admin browser session.
- [ ] Real Google-account timing and cross-account verification remain NOT VERIFIED; do not infer results from static contracts or CI.
- [x] No database migrations, memberships, subscriptions, payments, RLS policies, or production Supabase settings changed.


## 2026-10-31 — Fresh production security and Edge Function parity audit (read-only)

- [x] Refreshed the Supabase Security Advisor without changing production settings. Snapshot observed at `2026-10-30T22:17:57Z`: 8 RLS-enabled/no-policy tables (INFO); 3 anon-executable SECURITY DEFINER functions (WARN); 67 authenticated-executable SECURITY DEFINER functions (WARN); 90 anonymous-sign-in policy findings across exposed tables (WARN); Supabase Auth Leaked Password Protection remains DISABLED (WARN).
- [x] Rechecked the production migration ledger: 308 recorded migration rows; latest `20261029083845`. The required release reconciliation remains 0/41 exact required migration IDs recorded. This is a ledger-identity finding, not proof that all migration effects are absent.
- [x] Read the deployed Supabase Edge Function inventory and fetched each of the six critical live entrypoints plus the matching `main` source file. Live versions remain: `order-create v8`, `payment-intent v8`, `paymob-webhook v10`, `digital-page-payment-intent v5`, `subscription-payment-intent v4`, `financial-journal v3`. All six deployed entrypoint contents differ from the current `main` source; exact live SHA-256 fingerprints and source blob SHAs were obtained during this audit.

| Edge Function | Live version | `main` source blob SHA | Live entrypoint SHA-256 |
|---|---:|---|---|
| `order-create` | 8 | `3a6777683e537dcff1ad30cbd1c89e431f77d926` | `16f9b8bb687c33afeca14d85cb4c43af9948bd8b3ef3178990cc76ca1abea782` |
| `payment-intent` | 8 | `c88f62db0d3781f949ca5da77590a04590e8ae7d` | `d6b8faee1582c73ead440614cbe983114d1e7f31aa50f69795522fb20e737f54` |
| `paymob-webhook` | 10 | `b7a386d4b4fd7aa74187df7186e9235046ad660f` | `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca` |
| `digital-page-payment-intent` | 5 | `0d0476b0120996d83fff1299e06ea2c037e62e8e` | `8aa3d2e9c025e7b74d4d1847e8a6744bc84a9ded7cfc0c721f9604efd177af4b` |
| `subscription-payment-intent` | 4 | `c702d7a70ea85727ec5e14695ebf8fb26158514e` | `4466345787ea6b10a29b1dd63e9f0ab3cae640e9bb4d8ecb6d09445809e077e5` |
| `financial-journal` | 3 | `49706589cc6d77af713ae44bcc0818066de72243` | `79ee18d0544e7cab8fe33fe84c27a5017d1163f411eb5b9e07b99fd79e16e366` |

- [ ] `order-create`: reconcile missing live request-body size bounds and exact selected-branch membership enforcement in the deployed implementation; add adversarial tests for branch-scoped staff versus customer checkout before any rollout.
- [ ] `payment-intent`: reconcile live behavior with source-side amount-cent precision checks, Paymob intention/reference/amount/currency correlation, and ambiguous provider-outcome handling; run provider sandbox tests and verify pending/reconciliation semantics.
- [ ] `paymob-webhook`: reconcile provider-order correlation for subscription/digital-page/order/MantiGo references and atomic verified-failure processing. The deployed version contains direct status/ledger updates in paths where current source uses dedicated processing RPCs; verify idempotency, duplicate delivery, failed-payment atomicity, and event/ledger consistency in disposable PostgreSQL plus Paymob sandbox.
- [ ] `digital-page-payment-intent`: reconcile live provider-response validation and finalization arguments with source-side amount/currency/reference correlation and provider-order ID binding; test claim release, retry, and ambiguous outcomes.
- [ ] `subscription-payment-intent`: reconcile the deployed direct intent creation flow with source-side claimable intent creation, duplicate-provider-call prevention, AES-GCM client-secret encryption, and versioned key recovery/rotation; do not deploy until schema/RPC dependencies and key availability are proven.
- [ ] `financial-journal`: reconcile the deployed wildcard CORS behavior with source-side origin allowlisting and actor/tenant-scoped journal contract; verify active financial membership, posted-state restriction, and cross-tenant denial in authenticated E2E.
- [ ] Do NOT deploy these functions individually. First reconcile the full chronological missing migration chain and all schema/RPC/ACL dependencies in an isolated schema-faithful environment; pass duplicate/replay, payment, webhook, finance and settlement tests; complete backup/restore and rollback rehearsal; obtain explicit change approval; then deploy as one reviewed release plan with immediate post-deploy verification.
- [ ] Production Auth leaked-password protection requires an authorized configuration change followed by Security Advisor recheck and password-flow regression. No setting was changed during this audit.
- [x] This checkpoint was read-only: no production migration, table/data mutation, function deployment, secret rotation, Auth setting change, RLS/grant/policy change, or financial action was performed. Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-31 — Anonymous-JWT read-only RLS probe

- [x] Simulated the Supabase anonymous-session database claims inside a transaction explicitly marked READ ONLY, with effective Postgres role `authenticated`, `auth.uid()=00000000-0000-4000-8000-000000000001` (nonexistent test identity), and `auth.jwt()->>'is_anonymous'='true'`.
- [x] Confirmed zero visible rows for that identity across 12 sensitive relations: `payment_intents`, `payment_provider_events`, `journal_entries`, `general_ledger`, `wallet_accounts`, `wallet_transactions`, `subscription_payment_intents`, `business_subscriptions`, `notifications`, `support_tickets`, `marketing_leads`, and `matrimony_profiles`. A prior read-only probe also observed zero visible rows in `payment_financial_reconciliations`, for 13 relations total across the probes.
- [x] Confirmed direct SELECT is not granted to either `anon` or `authenticated` for the five inspected relations `payment_events`, `refund_transactions`, `settlement_attempts`, `ticket_messages`, and `medical_appointments`. All five had RLS and FORCE RLS enabled.
- [ ] NOT VERIFIED: a real Supabase anonymous Auth account/session; anonymous identity creation and revocation; adversarial tests with an existing authorized user whose session is anonymous; cross-user/cross-tenant/other-business/other-branch attempts using realistic fixture memberships in isolated PostgreSQL.
- [ ] Keep anonymous-sign-in policy findings open until each sensitive policy has isolated positive/negative tests and the Auth setting is reviewed. Do not revoke policies or grants in bulk.
- [x] This probe was read-only and used a nonexistent synthetic UID. No production data, schema, grants, policies, Auth settings, Edge Functions, secrets, or financial records were changed.
- Overall Security and Production Gate remain **BLOCKED / NOT CERTIFIED**.


## 2026-10-31 — Anonymous direct Data API exposure: marketing provider profiles

- [x] Executed an actual Postgres-role probe under `SET LOCAL ROLE anon` in a READ ONLY transaction with no JWT UID. Public SELECT returned 10 ACTIVE rows from `marketing_provider_profiles`, 16 ACTIVE rows from `marketing_provider_services`, and 122 ACTIVE rows from `marketing_services`.
- [x] Confirmed the current anon grants are table-level SELECT on all three tables, and RLS public-read policies filter rows to `status = 'ACTIVE'`. The `businesses` table has no direct anon SELECT grant; its public directory content is served through Edge Functions.
- [x] Confirmed `marketing_provider_profiles` contains 19 columns exposed to anon, including `owner_user_id` and `settings`. Aggregate-only query results showed 4 of the 10 active rows have a non-null owner UUID and all 10 have non-null settings. No owner UUID or setting values were retrieved.
- [x] Enumerated only the settings keys visible to anon: `activity_classification_type`, `activity_code`, `activity_group_code`, `activity_specialty`, `brand`, `category_code`, `icon`, `location_label`, `managed_by`, `official_showcase`, `pricing_display`, `show_prices`. Values were not read.
- [x] Read-only source review confirms public Edge Functions `public-catalog-directory` (live v9) and `public-catalog` (live v5) access the provider profile using the service-role key and explicit public-field projections (`business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured)); their returned provider object does not include `owner_user_id` or profile-level `settings`. Their `verify_jwt=false` setting is intentional for public read routes; their code still uses explicit business publication/status gates.
- [x] Current repository code search found no direct `marketing_provider_profiles` table query in the primary catalog frontend `apps/catalog-frontend`; the app calls the public Edge Function. `web/android-parity-catalog.js` lists the table as module metadata, not a query. Other server-side admin/API functions use the service-role client.
- [ ] Narrow the anonymous Data API surface for `marketing_provider_profiles`: retain only reviewed public profile columns for `anon` or remove direct anon table access and rely on the public Edge Functions. Minimum proposed private-column exclusion: `owner_user_id` and `settings`.
- [ ] Confirm whether any external/legacy consumer depends on direct anonymous SELECT from `marketing_provider_services` or `marketing_services` before changing those grants; do not assume repository search covers third-party clients.
- [ ] Build a forward-only migration using `supabase migration new`, then add disposable PostgreSQL privilege tests and explicit-column client compatibility checks. Supabase documents that column-restricted roles cannot use wildcard `select *`; verify all intended public clients explicitly select their approved columns before using column-level grants.
- [ ] Verify post-migration: anon can retrieve only approved active public profile columns; anon cannot select owner UUID or private settings; authenticated owner/CRM/admin workflows retain required profile fields and existing RLS; service-role public Edge Functions continue returning the approved public projection.
- [ ] Do not change Production grants/policies directly. Any rollout must be part of the reviewed chronological migration plan, pass isolated tests and deployed-origin public directory E2E, and follow the production approval/backup/rollback gate.
- [x] This audit was read-only. No production grants, RLS policies, schema, data, Auth settings, secrets, Edge Functions, or financial records changed.
- Overall Security and Production Gate remain **BLOCKED / NOT CERTIFIED**.


## 2026-10-31 — Fresh Supabase security, performance and finance schema checkpoint (read-only)

- [x] Re-ran Security Advisor at `2026-10-30T22:52:38Z`. Current findings: 8 RLS-enabled tables without policies (INFO); 3 anon-executable SECURITY DEFINER functions (WARN); 67 authenticated-executable SECURITY DEFINER functions (WARN); 90 policies flagged by the advisor as applying to roles that allow anonymous access (WARN); leaked-password protection remains disabled (WARN).
- [ ] Review all 90 anonymous-policy findings individually against actual Postgres role semantics and intended public/private product behavior. Do not bulk-revoke policies or assume each finding is an exploitable anonymous data path. In particular, several policy names indicate authenticated/member-only intent; prove actual `TO` role binding and effective grants before changing anything.
- [ ] Review the 8 RLS-enabled/no-policy tables individually: `business_employees`, `business_job_positions`, `commission_rule_audit`, `digital_page_payment_events`, `directory_listing_claim_requests`, `platform_custom_roles`, `platform_role_assignments`, `public_directory_listings`. Confirm direct table grants remain deny-by-default and each access path is intentional (RPC/service-only where designed); no policies were added.
- [ ] Triage SECURITY DEFINER findings by function owner, argument trust, explicit actor binding, tenant/business/branch scope, search_path, and effective EXECUTE grants. Do not revoke EXECUTE in bulk; authenticated-executable is not automatically a vulnerability when the function is intentionally exposed and enforces authorization internally.
- [x] Rechecked financial-journal physical schema read-only: all 7 RC449A/RC450 prerequisite columns remain absent (`journal_entries.entry_number`, `total_debit`, `total_credit`, `posted_at`, `updated_at`, `reversed_by_entry_id`; `journal_entry_lines.line_number`). Current row counts are zero in `journal_entries`, `journal_entry_lines`, and `general_ledger`; zero rows do not remove the schema blocker.
- [x] Rechecked journal RPC ACL read-only: both `post_financial_journal(jsonb,jsonb)` and `post_financial_journal_backend(uuid,jsonb,jsonb)` are SECURITY DEFINER with `search_path=public`; current ACL is `postgres=X/postgres` only. `service_role` has no EXECUTE on the canonical backend RPC, and authenticated has no EXECUTE. RC449A/RC450 remain absent from the live migration ledger; do not deploy the current Edge Function or apply either migration independently.
- [x] Fresh Performance Advisor snapshot at `2026-10-30T22:52:24Z`: 129 unindexed foreign keys (INFO), 375 auth RLS initplan findings (WARN), 73 unused indexes (INFO), and 28 multiple-permissive-policy findings (WARN). These are optimization/audit queues, not permission to create/drop indexes or rewrite RLS without query plans, workload evidence, and regression tests.
- [ ] Prioritize RLS initplan and multiple-permissive-policy findings by high-traffic catalog, authentication, order, payment, subscription and finance queries; inspect actual plans and preserve exact authorization semantics before proposing additive SQL.
- [ ] Review the 129 unindexed foreign keys against table size, write rate, existing composite indexes, and query plans. Add only proven missing indexes concurrently/through the approved migration pipeline; do not create all advisor suggestions indiscriminately.
- [x] Read-only check only. No production policy/grant/index/RPC changes, no migration, no data mutation, no Edge Function deployment, no Auth setting change. Global Production Gate remains **BLOCKED / NOT CERTIFIED**.


### Anonymous-policy warning reconciliation (same read-only checkpoint)

- [x] Cross-checked `pg_policies` rather than treating the 90 Advisor warnings as 90 direct `anon` grants. The live catalog contains 19 policies whose explicit role arrays include `anon` or `public`: 18 use `{anon,authenticated}`, and one uses `{public}`.
- [x] The 19 explicit anon/public policies are SELECT-only public catalogue/showcase/active-content reads, or explicit deny policies (`USING false` / `WITH CHECK false`) for ERP/SMM/legacy tables. The one `{public}` policy is an explicit deny policy. No direct anon write policy appeared in this 19-policy result.
- [ ] The remaining Security Advisor anonymous-policy warnings include policies granted to `authenticated` while Supabase anonymous sign-ins are enabled. Review those policies for explicit `auth.uid()`, `is_anonymous`, ownership and tenant checks; distinguish an anonymous authenticated session from a truly signed-in user before any policy change.
- [x] On the 8 RLS-enabled/no-policy tables, read-only `information_schema.role_table_grants` showed no direct `anon` or `authenticated` table privileges. Six had only service-role metadata privileges; `directory_listing_claim_requests` and `public_directory_listings` had service_role CRUD. This supports deny-by-default for direct client table access, but does not replace review of RPC/function paths.


### Exact release-object contract reconciliation from the checked-in live snapshot

- [x] The checked-in `docs/release/production-migration-reconciliation.json` snapshot reports 60 granular release-object contracts: 7 present and 53 missing or blocked. This is distinct from the 41 missing exact original migration version IDs; neither count alone proves every migration effect is absent.
- [ ] Payment/webhook: RC425 provider-event idempotency table and atomic MantiGo payment RPC absent; RC426 expected five-argument digital-page finalizer absent (only an older four-argument signature exists); RC427 one-active-intent unique index absent; RC428/RC429 verified-failure RPCs absent; RC430 subscription-success RPC absent.
- [ ] SMM: RC432 wallet reference-type idempotency unique index absent, although related wallet RPC names exist. SMM gateway remains deferred and anonymous/authenticated negative runtime proof is still required.
- [ ] ERP: RC434 atomic stock receipt RPC absent; RC438 purchase-order-with-lines RPC absent; live two-argument purchase-order status RPC exists but its search_path/ACL does not satisfy source contract. RC437 order-line table, line-aware receipt/management RPCs, and related indexes are absent.
- [ ] Catalog/default images: RC117 default-image resolver, three trigger functions, three triggers, and marketing-services image columns remain absent in the recorded object inventory. RC113 membership NULL-safe idempotency index is also absent.
- [ ] Subscription checkout: RC435/RC439 claimable intent/provider-claim RPCs and five provider-creation/encrypted-secret columns remain absent in the recorded live contract.
- [ ] Financial journal: canonical RC449A/RC450 schema fields and service-role RPC boundary remain absent; do not substitute the non-canonical RC436 path.
- [ ] Reconcile each object against the actual stored migration statements and physical schema on an isolated clone. Resolve forward-bundle aliases and old signatures explicitly; never replay missing source migrations blindly or fabricate migration ledger rows.

## 2026-10-31 — RC520 follow-up: exact anonymous provider-profile column inventory

- [x] Re-ran a read-only information_schema.columns + information_schema.role_table_grants query against Production project moyhiluyhjsujhwlyeuu; confirmed 19 columns on public.marketing_provider_profiles and table-level SELECT for anon applies to every column.
- [x] Confirmed the exact column inventory: id, provider_kind, business_id, owner_user_id, name_ar, name_en, slug, description, specialties, service_areas, portfolio, status, is_verified, is_featured, ranking_weight, settings, created_at, updated_at, profile_image_path.
- [x] Confirmed the query was metadata-only; no owner UUIDs, settings JSON values, profile records, or other row contents were selected.
- [x] Reconfirmed the primary apps/catalog-frontend reads public provider data through the curated Edge Function contract; it has no direct marketing_provider_profiles PostgREST query in the checked source. The public Edge Function projections omit owner_user_id and profile-level settings.
- [ ] Replace the original anon-only proposal: remove direct base-table SELECT for anon and authenticated only after public, owner, CRM, RLS and storage contracts are migrated to reviewed server-side boundaries. A public column allowlist alone is insufficient because authenticated also has broad SELECT and the active-public RLS policy exposes private fields.
- [ ] Before migration approval, search and test every first-party and known legacy client for select('*'), implicit wildcard, and explicit-column reads; verify public active-only RLS remains effective and public Edge Functions continue to work.
- [ ] Add isolated PostgreSQL tests proving anon and authenticated cannot directly read the base profile table; verify public Edge Functions remain usable and owner/admin/CRM workflows function only through their scoped server-side contracts.
- [ ] Verify deployed-origin directory and storefront behavior after the migration in a disposable environment first. Production application remains subject to the chronological migration reconciliation, backup/restore rehearsal, rollback plan, and explicit release approval.
- Safety: no production DDL, grants, RLS, data, Auth, Edge Function, or financial changes were performed. This is a documentation and verification checkpoint only.

## 2026-10-31 — RC520 follow-up: effective grants and authenticated exposure

- [x] Rechecked effective privileges with read-only `has_table_privilege` / `has_column_privilege`: `anon` currently has effective table SELECT and can select both `owner_user_id` and `settings`; `authenticated` also has table-level SELECT/INSERT/UPDATE/DELETE and can select those columns. This is an effective-privilege check, not a row-data extraction.
- [x] Re-read live RLS policy metadata only. `Public can view active marketing providers` applies to both `anon` and `authenticated` with only `status = 'ACTIVE'`; therefore every authenticated user who can reach the table can also read all active profiles under this policy. The additional `CRM managers view marketing providers` policy checks an active privileged role but has no tenant/business predicate. The owner policy scopes owner writes by `auth.uid() = owner_user_id`; it does not narrow the public SELECT policy.
- [x] Confirmed current main's canonical entry chain redirects the legacy `/web/` entry to `/catalog-app/`. However, legacy `web/home.js` still contains direct profile reads, including queries requesting `owner_user_id` and `settings`; treat it as a compatibility/legacy consumer until the redirect/boot boundary is proven to prevent execution. Do not mark the consumer inventory complete based only on the new frontend source scan.
- [x] Confirmed the main `apps/catalog-frontend` contract remains direct-table-free and the two public Edge Functions use service-role reads with explicit public profile projections.
- [ ] P0 security design: do not assume an anon-only column allowlist fully solves profile confidentiality. Authenticated currently has table-wide SELECT and the active-public RLS policy, so private fields remain available to any signed-in user. Design a safe boundary for private profile fields (for example, a private owner/CRM data relation or narrowly authenticated server-side RPCs) while preserving owner editing and CRM workflows; include tenant/business scoping for CRM reads. No column revoke is approved until these consumers and contracts are redesigned and tested.
- [ ] Verify the legacy redirect cannot start `web/home.js` data requests after navigation begins, or retire that compatibility boot path without changing the canonical catalog UI. Add a regression test for the redirect boundary.
- Safety: read-only metadata/policy checks only. No production DDL, grants, RLS, data, Auth settings, Edge Functions, payments, or financial changes were made. Production remains BLOCKED / NOT CERTIFIED.

- [x] Reviewed the attached `source_RC40.zip` Android source snapshot (internal file timestamps 2026-09-27): no direct `marketing_provider_profiles` table-name references were found in that snapshot. This is limited historical-source evidence, not proof about a newer Android build or third-party consumers.
- [x] PR #554 merged as `93d2bd719328d1f56a799ac42ea8a4a7ae8a7183` and its source guard passed CI. Follow-up inspection of `.github/workflows/pages.yml` confirms this change is NOT part of the production artifact: Pages composes only `apps/catalog-frontend/dist` and explicitly asserts no `web` directory is published. Do not claim a live `/web/` redirect fix; the legacy files are not shipped in the current canonical artifact.

- [x] PR #554 source validation: exact head `db1891e5683137c8a85b36470ff05480686e8e63`; Pages workflow run [41144995767](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41144995767), legacy catalog validation [41144995735](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41144995735), and Marketing Workspace Contract [41144995777](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41144995777) passed. However, the main production artifact is built only from `apps/catalog-frontend/dist`, with an explicit `test ! -e SITE_DIR/web`; PR #554's `web/index.html` edit is not shipped and does not change production behavior.
- [x] Confirmed the production artifact excludes `/web/`; no live `/web/` redirect is expected from the canonical Pages composition. Continue validating Google OAuth on the actual root catalog route, not the legacy path.

## 2026-10-31 — RC520 dependency inventory before profile privilege redesign

### Direct source consumers found on main
- `web/home.js` contains legacy direct PostgREST reads for provider counts, owner labels, category listings and profile details (including `owner_user_id` and `settings`). These are stale source consumers, NOT part of the current production runtime: `.github/workflows/pages.yml` publishes only `apps/catalog-frontend/dist` and asserts that the artifact contains no `web/` directory. Keep them out of any future public artifact; do not treat PR #554 as a deployed protection.
- `web/operations-modules.js` contains stale owner service-management reads, service-area updates, and generic `select('*')` provider tabs. It is not in the current production artifact, but must be migrated or permanently excluded before any future release reintroduces it.
- Canonical `apps/catalog-frontend` remains direct-table-free for provider profiles and consumes the curated `public-catalog` / `public-catalog-directory` Edge Functions. The two public functions use service-role access and explicit public projections; they do not return `owner_user_id` or profile-level `settings`.
- Server-side Edge Function consumers found include `catalog-admin`, `api`, and `catalog-platform-admin`; these use service-role clients and explicit projections or server-side writes. Preserve the service_role boundary.

### Live RLS dependency inventory (read-only `pg_policies`)
The live policy catalog contains provider-profile subqueries in:
- `digital_pages`: owner INSERT, SELECT, UPDATE policies.
- `digital_page_sections`: owner ALL policy.
- `marketing_provider_services`: owner-manage ALL policy.
- `marketing_project_participants`: assigned-project SELECT policy.
- `marketing_provider_subscriptions`: owner-subscription SELECT policy.
- `storage.objects`: provider-media owner INSERT, UPDATE, DELETE policies.
These policies currently depend on reading `marketing_provider_profiles` to prove ownership. A direct SELECT revoke may break them unless the ownership check is moved to a tightly scoped, reviewed helper or equivalent secure backend contract and tested with the actual Postgres roles. Do not assume a view or grant change is behavior-neutral.

### Other backend dependencies
- `create_medical_appointment_backend` resolves an active provider profile while creating appointments (SECURITY DEFINER; verify deployed body/ACL before any migration).
- `find_mnty_nearest_provider_businesses` has a historical public discovery contract, but a later security migration revokes client EXECUTE; verify live ACL and do not re-enable it.
- Marketing campaign participant authorization joins provider profiles in RC453 source; preserve owner checks and verify exact live migration parity.
- Public catalog Edge Functions and trusted admin Edge Functions use service_role and must retain only the exact server-side access they need.

### Required target architecture — design only, not yet implemented
1. Public directory: all customer-facing reads use the existing curated Edge Functions; responses expose only reviewed public fields. No direct `anon` table access.
2. Provider owner: a dedicated authenticated, non-anonymous, owner-bound RPC returns only the signed-in user's own profile fields needed by the owner workspace. Remove `owner_user_id` from the client response; ownership is enforced server-side.
3. Owner writes: a dedicated owner-bound RPC handles service-area/profile mutations and returns a minimal success projection; do not depend on table-wide SELECT for UPDATE ... RETURNING.
4. CRM: a separate role-aware contract returns only the fields needed for CRM, scoped to active tenant/business membership. Platform-wide visibility requires explicit `MNTY-PLATFORM` SUPER_ADMIN + PLATFORM scope + `full_control=true`; never infer platform-wide scope from a role name alone.
5. RLS/storage dependencies: introduce the ownership predicate in the non-exposed `private` schema (not `public`), using SECURITY DEFINER only where bypassing table SELECT/RLS is required; set an empty `search_path`, schema-qualify every relation/function, bind to `auth.uid()`, reject `auth.jwt()->>'is_anonymous' = 'true'`, return only a boolean, revoke EXECUTE from PUBLIC/anon, and grant only the minimum authenticated role plus schema USAGE needed for policy evaluation. Replace each dependent policy with this helper and test owner/non-owner/anonymous behavior before revoking base-table SELECT. Do not create a public SECURITY DEFINER RPC for this check.
6. After all source consumers and policy dependencies are migrated, remove `anon` and `authenticated` base-table SELECT and prove public reads, owner editing, CRM, digital-page management, provider-service management, assigned projects, subscriptions, and media storage still work.

### Release gates
- [x] Live effective privileges rechecked read-only: `anon` and `authenticated` have table-level SELECT; authenticated also has INSERT/UPDATE/DELETE; service_role retains server-side privileges.
- [x] Read-only live policy dependency inventory captured as above.
- [ ] Obtain exact current production function definitions/ACLs for every provider-profile dependency and compare with main source.
- [ ] Implement forward-only migration only after `supabase migration new` and isolated replay tooling are available; do not hand-create migration timestamps or apply DDL through `execute_sql`.
- [ ] Add disposable PostgreSQL adversarial tests for anon, anonymous-authenticated, normal authenticated owner, non-owner, same-tenant manager, cross-tenant manager, platform admin, and service_role.
- [ ] Add browser E2E for canonical public directory, owner workspace mutations, CRM, digital pages, provider services, assigned projects/subscriptions, and media upload/delete.
- [ ] Deploy only after exact-head CI and approval; verify live effective grants/policies and deployed-origin flows.
- Safety: no production DDL/grants/RLS/data/Auth/Edge Function/payment/finance changes were made during this inventory.


- [x] Documentation checkpoint PR #553 merged as `d7ec37d2a970d6d4111e363c4f762e366826d446`; it records the complete RC520 column/grant/source/policy dependency inventory and the target security architecture. This is documentation only, not a database fix.


### RC520 — live function-definition and ACL dependency review (read-only, 2026-10-31)
- [x] Read-only `pg_proc` inventory captured every current public/private function body containing `marketing_provider_profiles`, including SECURITY DEFINER flag, function configuration/search_path, and ACL. No function body or row data was modified.
- [x] `private.review_provider_onboarding_atomic(uuid,uuid,text,text)`: SECURITY DEFINER, empty search_path, EXECUTE limited to postgres/service_role; creates the provider profile as part of the atomic onboarding approval workflow.
- [x] `public.create_medical_appointment_backend(uuid,text,uuid,text,bigint,text)`: SECURITY DEFINER, `search_path=public, pg_temp`, EXECUTE for authenticated only. Source binds supplied user to `auth.uid()`, validates active provider/business and active tenant membership, and rejects duplicate appointment IDs or occupied slots. Search-path hardening and deployed-source parity remain separate review items.
- [x] `public.create_order_backend(...)`: SECURITY DEFINER, `search_path=public`, EXECUTE for postgres/service_role only. Its source verifies an active provider for the requested business and performs server-authoritative order pricing/idempotency.
- [x] `public.upsert_catalog_business_profile_backend(...)`: SECURITY DEFINER, `search_path=public`, EXECUTE for postgres/authenticated. Its source rejects anonymous sessions, binds identity through `auth.uid()`, checks active tenant/business membership and platform scope, then updates the selected provider profile.
- [x] `public.find_mnty_nearby_provider_businesses(...)` and `public.find_mnty_nearest_provider_businesses(...)`: SECURITY DEFINER with `search_path=public`; live ACL is postgres-only, so no anon/authenticated EXECUTE remains. Do not re-enable based on historical source.
- [x] `public.mnty_platform_admin_delete_business(...)`: invoker (not SECURITY DEFINER), empty search_path, postgres/service_role EXECUTE; service-role backend deletes provider rows as part of a protected business deletion workflow.
- [ ] Before any profile-table grant/policy migration, compare these exact live definitions with the matching current-main migration/function sources and include their owner/ACL/search_path expectations in isolated replay tests. SECURITY DEFINER execution paths do not justify exposing base-table SELECT to client roles.
- [ ] Separately harden/verify the medical appointment function's non-empty search_path under its own reviewed forward-only migration; do not bundle unrelated behavior changes into the provider-profile privacy fix.
- Safety: metadata and function source inspection only. No production SQL writes, DDL, grants, RLS, Auth, Edge Function, payment, or finance changes.


### Production artifact boundary clarification (2026-10-31)
- [x] Reviewed the Pages composition job in `.github/workflows/pages.yml`: it copies only `apps/catalog-frontend/dist` into the Pages artifact and asserts `test ! -e SITE_DIR/web`, `test ! -e SITE_DIR/preview`, and `test ! -e SITE_DIR/smm.html`. The canonical production app is the React catalog, not `web/home.js` or `web/operations-modules.js`.
- [x] Therefore legacy direct profile-table calls in `web/` are repository-only/stale source, not live production frontend consumers under the current workflow. Keep the path excluded from every future artifact and do not rely on PR #554 as a live-site security fix.
- [ ] The real production exposure remains direct Supabase Data API grants on `marketing_provider_profiles` for anon and authenticated. Public customer reads already go through curated Edge Functions; authenticated direct table SELECT can be revoked only after replacing all live RLS/storage ownership subqueries with a safe helper and proving dependent owner/CRM flows on isolated PostgreSQL.


### 2026-10-31 — public taxonomy Edge Function source parity restored
- [x] Compared live `public-catalog-directory` v9 and `public-catalog` v5 with current main. The live directory omitted the approved `activityCategoryCode` response field; the live storefront omitted all four canonical taxonomy metadata fields (`activityGroupCode`, `activityCategoryCode`, `activityClassificationType`, `activitySpecialty`). No unrelated code differences were found in the focused diff.
- [x] Confirmed PR #537 merged the source change as `80eeb41e90c133d5b66dea50853ba4306c6424fa`; its exact-head browser suite passed [41020400819](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41020400819), and main Pages validation/deployment passed [41020608750](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41020608750) / [41020608742](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41020608742).
- [x] Deployed current-main source to Production: `public-catalog-directory` v10 and `public-catalog` v6. Both remain ACTIVE with `verify_jwt=false` as before; only explicit safe taxonomy metadata fields were added to their public response objects. No database schema, grants, RLS, data, Auth, payments, or financial records changed.
- [x] Post-deploy source verification: live `public-catalog-directory` v10 and `public-catalog` v6 each match their exact main source files byte-for-byte; both expected taxonomy response contracts are present.
- [ ] Runtime HTTP invocation/deployed browser smoke for these two functions remains pending because this execution environment could not reach the public network. Do not equate exact source parity with a live response assertion.

- [x] Supabase skill re-read before the design update: confirmed views bypass RLS by default unless `security_invoker=true`, UPDATE requires a SELECT policy, and SECURITY DEFINER functions should live in a non-exposed schema with strict caller checks and explicit EXECUTE ACLs. These constraints are incorporated into the proposed helper design; no helper has been created yet.


## 2026-10-31 — Fresh Supabase Advisor snapshot after Edge Function parity repair (read-only)
Observed advisor timestamp: `2026-10-30T23:39:47Z`. No database writes were performed.
- [x] Security Advisor: 8 RLS-enabled tables without policies (INFO); 67 authenticated-callable SECURITY DEFINER functions (WARN); 3 anon-callable SECURITY DEFINER functions (WARN); anonymous sign-ins enabled (WARN); leaked-password protection disabled (WARN).
- [x] Investigated the three anon-callable SECURITY DEFINER findings. `assign_default_owner_to_unowned_business()` and `capture_commission_rule_audit()` are trigger functions only, each attached to an enabled trigger (`businesses` AFTER INSERT, deferred; `commission_rules` AFTER INSERT/UPDATE/DELETE). Their default EXECUTE ACL is unnecessary for client roles and should be explicitly revoked in a reviewed migration; the assignment trigger also has non-empty `search_path=public,auth` and needs schema-qualified hardening. The third function, `get_mnty_targeted_advertisements(...)`, is an intentional public advertisement-discovery function with empty search_path and bounded result limit; retain only after its public output/authorization contract tests remain green.
- [ ] Add a narrow forward-only migration to revoke direct EXECUTE on the two trigger functions from PUBLIC/anon/authenticated (trigger firing must remain intact), harden the assignment trigger function to empty search_path with fully qualified references, and prove both triggers still fire in disposable PostgreSQL. Do not revoke the public advertisement-discovery RPC without an approved replacement.
- [ ] Evaluate anonymous sign-in usage in the current canonical app and all supported auth flows before changing the Supabase Auth setting. Do not disable it solely to clear the Advisor warning.
- [ ] Enable leaked-password protection only after reviewing the user-facing sign-in/recovery impact and explicit Auth-setting approval; current setting remains disabled.
- [x] Performance Advisor snapshot: 129 unindexed foreign keys, 375 RLS initplan findings, 73 unused indexes, and 28 multiple permissive policy findings. Treat these as workload/schema-specific review queues; do not apply blanket index or policy changes.
- Safety: advisor and function/trigger metadata inspection only. No DDL, grants, policies, Auth settings, data, Edge Functions, payment, or finance changes were made in this advisor pass.

- [x] Post-deploy Supabase function logs confirm `public-catalog-directory` v10 received 2 GET requests with HTTP 200 after deployment (latest 2026-10-30T23:40:15Z; observed p95 execution about 2.1s for this tiny sample). No v6 `public-catalog` invocation appeared in the queried post-deploy log window; storefront endpoint smoke remains open.


## 2026-10-31 — RC435/RC439/RC449A/RC450 live prerequisite recheck (read-only)

### Live Edge Function versions and source parity
- [x] Re-fetched all six critical live Edge Functions and their current-main entrypoints. All are ACTIVE but none are byte-identical to main:
  - `order-create` v8, verify_jwt=true: live 10,083 chars vs main 13,988.
  - `payment-intent` v8, verify_jwt=true: live 8,114 vs main 10,366.
  - `paymob-webhook` v10, verify_jwt=false: live 11,538 vs main 12,665.
  - `digital-page-payment-intent` v5, verify_jwt=true: live 5,345 vs main 6,532.
  - `subscription-payment-intent` v4, verify_jwt=true: live 5,196 vs main 11,100.
  - `financial-journal` v3, verify_jwt=true: live 1,591 vs main 3,387.
- [x] Current production migration ledger rechecked: 308 recorded versions; latest is `20261029083845` / `require_phone_for_published_directory_listings`. The required RC435 (`20261009210000`), RC439 (`20261010010000`), RC449A (`20261010175000`), and RC450 (`20261010180000`) versions are all absent. This is exact ledger identity, not a claim that every physical object is absent.

### Subscription checkout — current live blocker
- [x] `public.create_subscription_payment_intent_backend(uuid,text,text,text,text,uuid)` exists and is executable by service_role only; current main requires `create_subscription_payment_intent_claimable_backend`, which is absent.
- [x] Current main also requires `claim_subscription_provider_intent_creation_backend(uuid,uuid)`; this function is absent from live `pg_proc`.
- [x] Live `subscription_payment_intents` has amount/currency/status/provider/provider_intent_id/provider_order_id/provider_transaction_id/idempotency_key, but does not have the RC439 encrypted checkout fields `client_secret_ciphertext`, `client_secret_iv`, `client_secret_key_version`.
- [ ] Do not deploy current `subscription-payment-intent` v-main until RC435/RC439 schema/functions, encrypted key configuration, Paymob sandbox concurrency/replay tests, and rollback are rehearsed on an isolated restorable database.

### Financial journal — current live blocker
- [x] Live `post_financial_journal(jsonb,jsonb)` exists, but service_role EXECUTE=false; authenticated/anon EXECUTE=false.
- [x] Live `post_financial_journal_backend(uuid,jsonb,jsonb)` exists, but service_role EXECUTE=false; authenticated/anon EXECUTE=false. Its current live body requires `p_user_id=auth.uid()`, which is incompatible with a service-role-only Edge Function call unless the reviewed actor-bound contract is applied.
- [x] Current main Edge Function calls `post_financial_journal_backend`; canonical RC450 requires the schema prerequisites in RC449A and the approved service_role-only grant/actor/tenant scope. Both versions are absent from the live ledger.
- [ ] Do not invoke or deploy the financial journal endpoint until RC449A → RC450 is rehearsed on an isolated database, the deployed RPC signature/body/ACL match the runbook, and finance regression + reversal/rollback rehearsal pass.

### Scope and safety
- This checkpoint used read-only `pg_proc`, `has_function_privilege`, `information_schema.columns`, Edge Function source retrieval, and migration-ledger inspection.
- No live payment intent, Paymob request/webhook, financial journal entry, migration, DDL, grant, RLS, data, Auth setting, or Edge Function deployment was performed in this checkpoint.
- Production remains **BLOCKED / NOT CERTIFIED**. Next safe action: prepare and run the RC435/RC439/RC449A/RC450 chain in a restorable isolated environment, not Production.


### RC449A preflight — live journal schema/data baseline (read-only, 2026-10-31)
- [x] Confirmed live `journal_entries`, `journal_entry_lines`, and `general_ledger` tables exist.
- [x] Confirmed RC449A-required fields are absent from live schema: `journal_entries.entry_number`, `total_debit`, `total_credit`, `posted_at`, `updated_at`, `reversed_by_entry_id`, and `journal_entry_lines.line_number`. Existing `general_ledger.posted_at` and `running_balance` are present.
- [x] Aggregate-only read found 0 rows in `journal_entries`, 0 in `journal_entry_lines`, and 0 in `general_ledger` at this checkpoint. Therefore RC449A's data backfill would currently affect zero existing journal/ledger rows, but its DDL, trigger interactions, lock duration, and rollback still require isolated rehearsal.
- [ ] Since the live migration ledger already contains later versions through `20261029083845`, do not apply historical RC449A/RC450 files directly or fabricate old migration ledger entries. Build a forward-only reconciliation release with a newly generated migration version after reviewing the exact current schema and the canonical RC449A/RC450 effects; follow the Supabase CLI migration-generation process.
- [ ] Run the generated forward repair against a disposable PostgreSQL 16 restore with the exact production schema, then run RC450 integration tests and validate zero duplicate ledger lines, balanced journals, actor/tenant/business/branch scope, and role grants before any production window.


### Isolated CI evidence revalidated — RC435/RC439 and RC450 (2026-10-31)
- [x] Rechecked GitHub Actions job details rather than relying on a prior summary:
  - RC435→RC439 disposable PostgreSQL 16 fixture/migration/integration job [41001833105](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41001833105): PASS; AES-GCM checkout-secret crypto step PASS; fixture → RC435 → RC439 → integration assertions PASS. The corresponding source/test PR #512 is merged as `31b7256928b49af9a5f52c4aa69e55db7f1c91f1`.
  - RC450 financial-journal isolated PostgreSQL 16 integration job [39091702874](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39091702874): PASS; job explicitly applied RC450 to disposable PostgreSQL and ran behavioral tests. PR #169 test correction is merged as `3d7669ca0043db847dfe14fe1b81b86329c4377f`.
- [x] These tests establish the tested source/fixture contracts only. They do not establish that Production's later-dated schema is compatible with historical RC435/RC439/RC449A/RC450, do not repair the missing live RPCs/columns/grants, and do not authorize applying those migrations out of order.
- [ ] Still required: exact-production-schema disposable restore, forward-only reconciliation migration, migration replay/rollback, and payment/finance sandbox acceptance.


## 2026-10-31 — Fresh Supabase Advisor snapshot and anonymous-auth source triage

- [x] Re-ran Supabase Security Advisor: 8 RLS-enabled/no-policy INFO; 3 anon-executable SECURITY DEFINER WARN; 67 authenticated-executable SECURITY DEFINER WARN; 90 `auth_allow_anonymous_sign_ins` policy findings; 1 leaked-password-protection-disabled Auth warning.
- [x] Re-ran Performance Advisor: 129 unindexed-FK INFO; 375 auth/RLS init-plan WARN; 73 unused-index INFO; 28 multiple-permissive-policy WARN.
- [x] Repository-wide source search found no `signInAnonymously` call in current main. This does not prove no external client or legacy consumer relies on anonymous sign-ins; do not disable the project setting without product-owner confirmation and a deployed-session regression plan.
- [x] Existing live policy audit explains that the 90 labels are not 90 direct `anon` table grants. They are policies attached to the `authenticated` Postgres role while Supabase anonymous sign-in is enabled; anonymous-authenticated sessions must be distinguished by the JWT `is_anonymous` claim. Keep per-policy/role review and anonymous-JWT adversarial testing open.
- [ ] Leaked Password Protection remains a managed Auth setting and cannot be changed through the available connected Supabase actions. An authorized project owner must enable it in Supabase Auth settings and then rerun Advisor and password signup regression.
- [ ] Do not mass-rewrite the 90 policy findings, bulk-revoke the 67 SECURITY DEFINER functions, add broad policies to the 8 fail-closed tables, or mass-create indexes for the performance findings. Resolve by caller/tenant/query-specific review with regression tests.


## 2026-10-31 — Fresh read-only production finance preflight

- [x] Re-read the live Supabase migration ledger: **308 records**, latest remains `20261029083845 require_phone_for_published_directory_listings`. No migration was applied.
- [x] Re-ran a read-only schema/RPC/ACL preflight at `2026-10-31 01:52 Cairo (2026-10-30T23:52:42Z)`. Subscription table still lacks `provider_creation_state`, `provider_creation_claimed_at`, `client_secret_ciphertext`, `client_secret_iv`, and `client_secret_key_version`; only the legacy `create_subscription_payment_intent_backend` RPC is present in the inspected contract set, with service_role EXECUTE. The two claim/recovery RPCs remain absent.
- [x] Financial journal still lacks `journal_entries.entry_number/total_debit/total_credit/posted_at/updated_at/reversed_by_entry_id` and `journal_entry_lines.line_number`. Both inspected journal RPCs remain service_role EXECUTE=false; current legacy backend function has `search_path=public`. The inspected journal header/line/general-ledger tables each still contain zero rows at this snapshot.
- [x] These results reconfirm the existing RC435/RC439 and RC449A/RC450 blockers; they do not authorize a production migration, grant, RPC invocation, function deployment, or financial test transaction.
- [ ] Next executable step remains an **isolated, restorable, schema-faithful rehearsal** of the current production state and a forward-only reconciliation plan. No isolated Supabase branch/project was created because cost/organization confirmation is still pending; no production mutation occurred.
- **Release remains BLOCKED / NOT CERTIFIED.**


## 2026-10-31 — Supabase baseline freshness and finance fixture compatibility

- [x] PR #555 merged as `169a8271f14ef99e83b2bea8046f0f5cb6b9d0c5`. Exact-head checks passed for `validate`, `contract`, `financial-journal-rc450-integration`, `targeted-ads-search-path-integration`, `approval-action-audit-postgres`, `rc425-mantigo-paymob-atomicity`, `matrimony-privacy-postgres`, and `mantigo-open-ride-privacy-integration`; Pages deploy was skipped as expected for documentation-only changes.
- [x] Rechecked Supabase development branches: only the default `main` branch exists; no isolated development branch is available yet.
- [x] Fresh verbose table inventory confirms current Production journal row counts are zero (`journal_entries=0`, `journal_entry_lines=0`, `general_ledger=0`) and `subscription_payment_intents=0`; `subscription_tier_prices` has four active seeded tiers. Current counts are a snapshot, not restore evidence.
- [x] Fresh schema inventory shows why the existing minimal PostgreSQL fixtures cannot be applied unchanged to a production-schema clone: live `businesses` requires `name` and `code`; `user_memberships` requires `id` and `tenant_id`; `chart_of_accounts` requires `account_code`, `account_name`, and `account_type`; `branches` requires `name` and `code`. Any full-schema rehearsal fixture must satisfy the real constraints and use unique deterministic test tenants/businesses/tiers.
- [x] Confirmed the tracked baseline manifest is still `review_status=PENDING_REVIEW`, captured `2026-10-17T02:10:22Z`, and represents checkpoint `20261008222845`; Production's latest ledger is `20261029083845` with 308 records. Existing full forward replay proves ordered migration replay from that historical checkpoint, but does **not** prove exact compatibility with the current later-dated Production physical schema.
- [ ] New P0 blocker: create/approve a schema-faithful isolated branch or refreshed schema-only baseline from the current Production state, preserve a restorable recovery path, then run RC435/RC439 and RC449A/RC450 against real table constraints and a controlled disposable dataset. Do not copy Production rows into CI or execute test writes on Production.
- [ ] No development branch/project was created because branch creation can incur charges and a cost quote requires the user's confirmation of the Supabase organization ID. Current Production remains unchanged.
- **Overall Production Gate remains BLOCKED / NOT CERTIFIED.**
