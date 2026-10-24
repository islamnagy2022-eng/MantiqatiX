# MANTIQATIX — Production TODO Master List

حالات العمل: TODO / IN PROGRESS / WAIT / BLOCKED / DONE / VERIFIED / NOT VERIFIED.  
قاعدة الإغلاق: DONE لا تعني VERIFIED.

## P0 — بوابة الإطلاق
- [🟢] Baseline CI — run #114 نجح على `main` للـcommit `d58e1360a170bce596494b2aeb37b5166fff6a5b`، وتضمن تحقق ملفات الويب وSyntax وMetadata/Security smoke.
- [ ] Auth production: Email OTP end-to-end، session، logout، expiry. **NOT VERIFIED — requires external browser/auth test.**
- [🟡] Authorization/RLS: 111/111 جدول RLS؛ تمت مراجعة سياسات المسارات الحرجة (orders/support/tickets/notifications/memberships/marketing)، وتم إصلاح `support_tickets_update_staff` لمنع تغيير `tenant_id` أثناء التحديث؛ بقي اختبار E2E بحسابات أدوار متعددة.
- [🟢] مراجعة SECURITY DEFINER وEXECUTE: تمت مراجعة الوظائف العشر القابلة للاستدعاء من authenticated؛ كلها تحتوي تحقق هوية/ملكية/عضوية/نطاق مناسب حسب وظيفتها، ولا توجد وظائف مالية حساسة مكشوفة مباشرة.
- [🟢] Data API grants baseline: anon لديه SELECT على `legal_documents` و`legal_document_versions` فقط ولا يملك INSERT/UPDATE/DELETE؛ authenticated لديه امتيازات محددة ومحمية بـRLS؛ المراجعة التفصيلية لكل مسار تبقى ضمن E2E.
- [🟡] Database constraints/indexes/integrity: 111/111 لها Primary Key و224 Foreign Keys؛ توجد 155 أعمدة FK بلا index أحادي مطابق وتحتاج مراجعة أداء حسب الاستخدام.
- [ ] API/Edge Functions/integrations. **NOT VERIFIED — external runtime test pending.**
- [ ] Website/Admin/Owner/Manager/Employee/Customer E2E. **NOT VERIFIED — requires real test accounts and external browser.**
- [🟡] Finance backend controls inspected (payment/refund/settlement/order pricing/idempotency); actual provider/payment E2E remains NOT VERIFIED.
- [ ] CRM + Marketing E2E.
- [ ] Regression كامل.
- [ ] Backup/Restore/DR test. **NOT VERIFIED — restore evidence not yet produced.**
- [ ] Monitoring/alerts/logging.
- [ ] Production configuration/secrets.
- [ ] Build/Release/Rollback.
- [ ] External browser/device tests. **NOT VERIFIED — network/browser execution unavailable in current execution environment.**
- [ ] Release approval موثق.

## P1 — Website / Platform
- [x] Website baseline/PWA/brand.
- [x] Email OTP path.
- [x] user_memberships + active role.
- [x] Feature flag reading.
- [x] إزالة الأرقام التشغيلية الوهمية من الواجهة.
- [ ] تطبيق feature flags على visibility/actions مع safe defaults.
- [x] loading/error states — تمت إضافة حالة تحميل وحالة خطأ مع إعادة المحاولة.
- [ ] responsive/accessibility review.
- [ ] تنظيف legacy/duplicate render paths.
- [ ] route/import/smoke tests.
- [x] snapshot كامل بعد CI ناجح — آخر baseline موثق في CI run #110.

## P1 — Marketing & Advertising
- [x] Live counts حيث تتوفر بيانات فعلية.
- [x] إنشاء marketing lead فعلي عبر RLS.
- [🟡] قائمة leads + التفاصيل + lifecycle — أضيف RC457 RPC محدود وربطت واجهة التفاصيل بإجراءات الحالة؛ لا توجد UPDATE policy عامة مقصودة. الميزة IMPLEMENTED — NOT VERIFIED حتى اجتياز CI والتحقق النهائي.
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
- [🟡] lifecycle: acquisition/qualification/contact/follow-up/offer/conversion/retention — RC457 يضيف انتقالات ذرية مسجلة في `audit_logs` وواجهة CRM متصلة بالـRPC؛ سجل التفاعلات ومهام المتابعة/المسؤول وretargeting ما زالت غير مكتملة.
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
- [ ] order details.
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
- [x] JS syntax — current `web/app.js` and `web/smm.js` pass CI.
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

## P2 — SMM
- [ ] providers/services/orders/wallets review.
- [ ] platform RBAC integration.
- [ ] provider credentials isolation.
- [ ] order events/idempotency.
- [ ] wallet reconciliation.
- [ ] monitoring.
- [ ] حماية الوظائف الإدارية.

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
- IMPLEMENTED: Email OTP path.
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


## 2026-10-24 — CRM lead lifecycle UI/backend integration (RC457)
- [x] Added the CRM detail-drawer lifecycle actions using the server-authoritative `transition_marketing_lead_backend` RPC; actions are limited to the selected active business and source-defined allowed transitions.
- [x] Customer lead details remain requester-owner scoped; internal staff detail reads add an active-business filter. RLS/server-side membership checks remain authoritative.
- [x] Added safe UI handling for conflict/forbidden/invalid transition/idempotency/generic errors and refresh only after server-confirmed status.
- [x] Added static source guards for the lifecycle UI/RPC boundary.
- [ ] Runtime migration/RPC and adversarial role/tenant E2E remain deferred until the final comprehensive verification stage by user instruction. RC457 has not been applied to production.
- Status: **IMPLEMENTED — NOT VERIFIED**. Production release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-24 — RC457 exact-head CI refresh
- [x] GitHub Actions query for feature head `b2f0b8b618982427561cf5568dc0f83d17dbd91d` returned 9 completed successful PR workflows, including Marketing Workspace Contract, Migration Version Uniqueness, Migration History Immutability, Open PR Migration Collision Guard, and Backend-only Module Boundary.
- [x] Static validator `scripts/validate-marketing-lead-lifecycle-contract.mjs` is wired into the Pages validation workflow.
- [ ] This is source/CI evidence only. It does not verify live RPC behavior, deployed migration parity, adversarial tenant isolation, or full production readiness. PR #373 remains draft/open; RC457 is not applied to production.
- [ ] Continue implementation in a consolidated CRM/marketing batch: reconcile status vocabulary with the ordered schema/migration chain, then inspect existing interaction/audit/task structures before adding functionality; finish provider services and campaign collaboration gaps.
- Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-24 — Marketing campaign workspace source integration
- [x] Added a dedicated `campaigns` tab to the existing marketing workspace, with campaigns read filtered to the selected active business.
- [x] Campaign creation calls `create_marketing_campaign_backend` with the current actor, selected business, allowlisted objective/channel values, dates, budget, and a fresh idempotency key. It remains an internal planning action and does not publish ads to external platforms.
- [x] Campaign lifecycle actions call `update_marketing_campaign_status_backend`; direct browser writes to campaign tables are not used. UI management controls are hidden for roles outside the local manager allowlist, while backend authorization remains authoritative.
- [x] Extended the marketing static validator to assert RPC boundaries, business scoping, and the existing migration's table grants.
- [ ] Exact-head CI must pass for the campaign workspace and validator changes. Runtime campaign RPC/RLS and cross-tenant acceptance remain for the final verification stage.
- Production remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-24 — Marketing partner collaboration source integration
- [x] Added a partner invitations workspace for campaigns, scoped through the existing campaign participant RLS policy so campaign managers see their business records and provider owners can see their own invitations.
- [x] Campaign managers can invite an active, verified partner-company/freelancer profile with a role, allocation percentage, and agreed value through `invite_marketing_campaign_partner_backend`.
- [x] Verified provider owners can accept or decline their own pending invitations through `respond_marketing_campaign_invitation_backend`; UI ownership checks are supplemental and the backend remains authoritative.
- [x] Extended static source guards for both RPC paths and provider ownership checks.
- [ ] Exact-head CI and runtime RLS/RPC acceptance remain pending; no financial transfer or external ad launch is triggered by these actions.
- Production remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-24 — Marketing partner invitation fix and RC457 gate alignment
- [x] Fixed the partner invitation handler so business managers may invite other eligible verified partner profiles; it no longer incorrectly requires the invitee profile to belong to the manager. The separate response handler still requires the signed-in user to own the verified provider profile.
- [x] Strengthened the static validator to assert this separation of invite authority and response ownership.
- [x] Added RC457 to the production migration verifier and migration-chain contract while preserving the restored 34-source dependency chain plus the new forward-only RC457 migration.
- [x] Exact-head PR checks passed for code head `ea12b484d552851aedde2c1e1b6ce9813b1e3bda`: Marketing Workspace Contract, Migration Version Uniqueness, Migration History Immutability, Open PR Migration Collision Guard, Backend-only Module Boundary, Module Professionalization Validation, Approval Action Audit Atomicity, and MantiGO Open Ride Privacy Boundary. `Deploy MantiqatiX Web` workflow passed its validation job but skipped deployment because this is a pull request.
- [ ] These checks are CI/structural contracts, not a production certification or proof that RC457/RC458 have been applied. Runtime validation against the intended Supabase release target and approved migration rollout remain outstanding.
- [ ] PR #373 targets main and depends on the historical migration source restoration in PR #372. Both remain unmerged; runtime RLS/RPC tests and release evidence are still required.
- Production remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-24 — Cross-business partner directory (RC458)
- [x] Added forward-only migration `20261024210000_rc458_marketing_partner_directory_backend.sql` with a scoped, authenticated RPC for searching active, verified marketing partners.
- [x] Kept the existing provider-profile RLS policy intact; the invitation picker now uses the RPC's minimal directory fields instead of relying on cross-business profile reads.
- [x] Added RC458 to the production verifier and chronological migration-chain contract (36 required source migrations now tracked).
- [x] Extended static source guards for manager scope, active/verified partner filtering, empty search_path, authenticated-only execute grants, and the directory's minimal return columns.
- [ ] Runtime RLS/RPC tests and exact-head CI are still required. No production migration has been applied.
- Production remains **BLOCKED / NOT CERTIFIED**.

- [x] Added a bounded partner search input (80-character maximum) backed by the same scoped RPC, with a maximum of 50 directory results per request.
- [x] The later code head `ea12b484d552851aedde2c1e1b6ce9813b1e3bda` received successful results for all nine PR workflows. Later commits on this branch updated only release notes and PR metadata; no application code changed after that CI head.


## 2026-10-24 — RC458 invitation directory metadata and CI result
- [x] Invitation directory now uses the scoped backend RPC rather than reading cross-business provider profiles directly.
- [x] Provider invitation list retrieves only `id,title,status` for campaign IDs referenced by that provider's own RLS-visible active invitations; no broad campaign query or RLS relaxation was introduced.
- [x] Added static contract checks for this ownership-derived ID set and minimal campaign projection.
- [x] CI for code head `ea12b484d552851aedde2c1e1b6ce9813b1e3bda` completed all nine PR workflows successfully. Production deployment was skipped by the workflow's pull-request guard.
- Production remains **BLOCKED / NOT CERTIFIED**; no migration has been applied to production.


## 2026-10-24 — RC458 PostgreSQL runtime integration verified on PR branch
- [x] Added `supabase/tests/rc458_marketing_partner_directory_integration.sql` covering eligible cross-business profiles, unverified/same-business exclusion, search filtering, result cap, actor spoofing, manager business scope, overlong search rejection, and anon/authenticated EXECUTE grants.
- [x] Extended the disposable RC453 campaign fixture with `name_en` and kept the test isolated to a temporary PostgreSQL 16 service.
- [x] Updated `.github/workflows/marketing-campaign-backend.yml` to apply the prerequisite RC453 fixture/migration/tests and then RC458 plus the new behavioral integration test; PR path filters include both RC458 files.
- [x] Added static guards that ensure the behavioral test remains wired to the PostgreSQL workflow and checks the expected authorization boundaries.
- [x] Exact current PR #373 head `b58eac839f7fb2cad814c63795ca1dfde9ee73b3`: all 10 workflows passed. The PostgreSQL job output explicitly reports `RC453 marketing campaign and partner workflow integration: PASS` and `RC458 scoped marketing partner directory integration: PASS`.
- [x] PR #372 current head `5a6def775558b1415db53c06d0584ea4cf5738b5`: all 11 workflows passed, including the isolated forward migration chain replay from the production schema checkpoint.
- [ ] This is isolated CI runtime evidence, not proof that the target Supabase production project has the same schema/data or that a production rollout was applied. Confirm the intended release target, recovery/restore evidence, and obtain explicit release authorization before applying migrations.
- Production remains **BLOCKED / NOT CERTIFIED**. Both PRs remain open/draft and unmerged.


## RC457 lifecycle behavioral coverage — 2026-10-24
- Added `supabase/tests/rc457_marketing_lead_lifecycle_integration.sql` for disposable PostgreSQL coverage of valid status persistence, scoped audit metadata, idempotent replay without duplicate audit, idempotency-key conflicts, stale expected state, disallowed/unknown status, actor spoofing, cross-business isolation, missing authentication, and RPC execute grants.
- Extended the shared RC453 disposable fixture with only the minimal `marketing_leads` table/records needed for the RC457 test. This fixture change is test-only; it is not a production schema change.
- Updated `.github/workflows/marketing-campaign-backend.yml` to run RC453 fixture/migration/tests, then RC457 migration/integration, then RC458 migration/integration. Added RC457 files to workflow path filters and added static source guards for the RC457 test contract.
- [ ] Await CI on the new head before marking RC457 behavioral coverage passed. Previous RC453/RC458 green results apply to the prior code head only.
- Production remains **BLOCKED / NOT CERTIFIED**; no merge or production migration was performed.


## RC457 integration verification closed — 2026-10-24
- [x] Fixed the RC457 PostgreSQL assertion to qualify the audit result column and corrected the lifecycle validator's JavaScript regular expressions after the first run exposed both issues.
- [x] Latest verified code head `951183e686ce3d221a950e875063dc034c5b3f18`: all 10 PR workflows completed successfully. Marketing Campaign Backend PostgreSQL 16 logs explicitly report `RC453 marketing campaign and partner workflow integration: PASS`, `RC457 marketing lead lifecycle integration: PASS`, and `RC458 scoped marketing partner directory integration: PASS`.
- [x] Production verification syntax check passed on the latest head; web deploy job was skipped by the PR guard.
- [ ] Live target-Supabase parity, final end-to-end acceptance, recovery/restore evidence, and explicit release authorization remain outstanding. Do not merge/apply migrations to production on the basis of isolated CI alone.
- PR #373 remains draft/open and PR #372 remains a dependency for historical migration restoration. Production remains **BLOCKED / NOT CERTIFIED**.
