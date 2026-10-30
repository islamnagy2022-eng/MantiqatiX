# MANTIQATIX — Production TODO Master List

حالات العمل: TODO / IN PROGRESS / WAIT / BLOCKED / DONE / VERIFIED / NOT VERIFIED.  
قاعدة الإغلاق: DONE لا تعني VERIFIED.

## P0 — بوابة الإطلاق
- [🟢] Baseline CI — run #114 نجح على `main` للـcommit `d58e1360a170bce596494b2aeb37b5166fff6a5b`، وتضمن تحقق ملفات الويب وSyntax وMetadata/Security smoke.
- [ ] Auth production: Google OAuth end-to-end، session refresh/expiry، logout، membership approval، multi-role and tenant isolation. **NOT VERIFIED — CI OAuth handshake passes, but authenticated browser E2E and live Auth security settings remain unverified.**
- [🟡] Authorization/RLS: 111/111 جدول RLS؛ تمت مراجعة سياسات المسارات الحرجة (orders/support/tickets/notifications/memberships/marketing)، وتم إصلاح `support_tickets_update_staff` لمنع تغيير `tenant_id` أثناء التحديث؛ بقي اختبار E2E بحسابات أدوار متعددة.
- [🟡] مراجعة SECURITY DEFINER وEXECUTE: العدد «10 وظائف» أدناه توثيق تاريخي وليس جردًا حاليًا. إعادة الفحص الحي يوم 2026-10-27 05:49 UTC سجلت 48 تحذيرًا لوظائف `SECURITY DEFINER` قابلة للتنفيذ من `authenticated` وتحذيرًا واحدًا لـ`anon` على `get_mnty_targeted_advertisements(...)`. هذه التحذيرات ليست وحدها إثباتًا لقابلية الاستغلال؛ يلزم جرد كل توقيع، و`search_path`، والصلاحيات، والمستدعين، ثم اختبارات قبل أي تغيير. راجع issue #98؛ ممنوع السحب الجماعي للصلاحيات.
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
