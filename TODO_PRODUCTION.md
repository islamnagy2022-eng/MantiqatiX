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
- [🟡] قائمة leads + التفاصيل + lifecycle — القائمة الأساسية بدأت، التفاصيل والـlifecycle متبقية.
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
- [ ] lifecycle: acquisition/qualification/contact/follow-up/offer/conversion/retention/retargeting.
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
- [ ] مصدر موحد للقطاعات/المجالات/الخدمات.
- [ ] التحقق من seed الحقيقي لـ business_categories/modules قبل عرضه كبيانات production.
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
- [ ] production smoke test.
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
- BRAND: `MNTY = MantiqatiX`; MNTY is the short customer-facing identity, while MantiqatiX remains the full/original platform identity.
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
- [🟢] CI #118 succeeded for support ticket detail/thread UI on commit `4947decd99ffebd2cf1496479f9eb87ac9c878d2`.
- [🟡] Support status workflow: database constraint + staff status update UI committed as `e12d8c0fa2281d3761f0659986b34068f7bafcb0`; CI verification pending.
- [x] Runtime brand alignment: واجهات التطبيق الداخلية ومسار الدخول أصبحت تعرض `MNTY` كهوية العميل، مع بقاء `MantiqatiX` كهوية الاسم الكامل/الأصل.
- [🟢] CI verified: run #114 نجح للـcommit الحالي `d58e1360a170bce596494b2aeb37b5166fff6a5b` بعد تعديلات الهوية.
- [ ] استكمال P0/P1 من أول عنصر غير VERIFIED، مع عدم اعتبار أي وظيفة مكتملة قبل اختبارها في سياقها.


## Latest implementation checkpoint — 2026-09-27
- [🟡] Support ticket detail/thread UI: commits `20624048b97e30d4dd88aa897c9d66f9e01cfd4a` and `6522e9df10ec908e5279f5fdb4f0291df0ffd644` add ticket details, message thread loading, and reply entry while relying on existing RLS policies.
- [🟡] CI runs #116/#117 are pending; no production verification claim is made until the latest run succeeds.
