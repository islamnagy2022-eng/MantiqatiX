# MantiqatiX — MASTER TODO / FINAL EXECUTION REGISTER
## الإصدار: RC-FINAL-2026-10-06

> **القاعدة العليا:** DONE لا تعني VERIFIED.  
> لا تُستخدم عبارة Production Ready أو 100% Complete إلا بعد دليل تنفيذي قابل لإعادة الاختبار.

### حالات العمل
- [ ] TODO — لم يبدأ.
- [~] IN PROGRESS — قيد التنفيذ.
- [x] DONE — التنفيذ موجود.
- [✓] VERIFIED — التنفيذ اختُبر بدليل فعلي.
- [!] BLOCKED — يحتاج اعتماد/بيئة/جهاز/مزود خارجي.
- [N] NOT VERIFIED — الكود موجود لكن الاختبار النهائي غير مثبت.

---

# 0. RELEASE GATE العام

- [N] Auth E2E متعدد المستخدمين.
- [N] RBAC/Authz E2E.
- [N] Tenant / Business / Branch isolation E2E.
- [N] Customer ↔ Provider isolation.
- [N] جميع workflows الحرجة E2E.
- [N] Payments production E2E.
- [N] Webhook replay/idempotency E2E.
- [N] Commission + settlement + GL reconciliation E2E.
- [N] Notifications delivery/click-through E2E.
- [N] Backup/restore rehearsal.
- [N] Browser production smoke.
- [!] Android release build/signing/real-device test.
- [N] Rollback rehearsal.
- [N] Post-release monitoring rehearsal.
- [!] Supabase leaked-password protection — يحتاج إعداد Auth المُدار.
- [N] Security Advisor final sign-off.

---

# 1. الإدارة والتشغيل

## 1.1 المستخدمون والعمليات
- [N] Dashboard حقيقي مبني على authoritative data.
- [N] KPI حسب tenant/business/branch.
- [N] task lifecycle: TODO → IN PROGRESS → WAIT → BLOCKED → DONE → VERIFIED.
- [ ] SLA لكل عملية.
- [ ] escalation rules.
- [ ] assignment / reassignment.
- [ ] approvals.
- [ ] operational audit trail.
- [ ] bulk actions مع authorization.
- [N] منع أي UI mutation يتجاوز backend boundary.

## 1.2 الإدارة العليا
- [ ] owner dashboard.
- [ ] business-owner dashboard.
- [ ] admin dashboard.
- [ ] manager dashboard.
- [ ] finance dashboard.
- [ ] operations dashboard.
- [ ] security dashboard.
- [ ] system-health dashboard.

---

# 2. التقنية والبرمجة

## Frontend
- [N] Web runtime.
- [N] unified Supabase client.
- [ ] route/state registry موحد.
- [ ] error boundary موحد.
- [ ] loading/empty/error states لكل module.
- [ ] accessibility keyboard/focus/ARIA audit.
- [ ] responsive regression.
- [ ] cache/version invalidation audit.

## Backend/API
- [N] sensitive mutation boundaries.
- [N] SECURITY DEFINER search_path review.
- [N] auth.uid enforcement.
- [N] tenant membership enforcement.
- [ ] standardized error taxonomy.
- [ ] correlation ID coverage لجميع العمليات الحرجة.
- [ ] rate limiting للعمليات الحساسة.
- [ ] timeout/retry policy.

## Database
- [N] RLS baseline.
- [N] PK/FK/index baseline.
- [ ] query-plan review لكل query عالية الاستخدام.
- [ ] migration reproducibility.
- [ ] schema drift detection.
- [ ] destructive migration protection.

---

# 3. الحسابات والمالية

## Accounting
- [N] journal backend boundary.
- [N] debit/credit balance validation.
- [N] tenant account validation.
- [N] financial-role validation.
- [N] settlement security.
- [N] commission calculation.
- [N] payment ledger.

## TODO تفصيلي
- [N] real journal rehearsal.
- [N] duplicate journal prevention.
- [N] concurrent settlement.
- [N] reconciliation report.
- [ ] unmatched transactions report.
- [ ] failed settlement queue.
- [ ] finance approval workflow.
- [ ] period closing.
- [ ] reversal/refund journal.
- [ ] export/accounting integration.
- [N] no client-side financial authority.

## Payments
- [N] payment intent architecture.
- [N] provider event idempotency.
- [N] HMAC/signature validation.
- [N] amount/currency validation.
- [N] provider/order binding.
- [!] real Paymob transaction.
- [N] duplicate webhook structural protection.
- [N] failed payment state.
- [N] refund state — E2E NOT VERIFIED.
- [ ] chargeback/reconciliation workflow.

---

# 4. التسويق والإعلان

## Marketing
- [N] provider profiles.
- [N] services catalog.
- [N] leads.
- [N] projects.
- [N] marketing workspace.
- [ ] campaign creation lifecycle.
- [ ] campaign approval.
- [ ] budget control.
- [ ] channel management.
- [ ] content calendar.
- [ ] creative assets.
- [ ] audience segments.
- [ ] UTM/attribution.
- [ ] conversion events.
- [ ] campaign billing.
- [ ] client approval.
- [ ] agency team permissions.
- [ ] campaign audit.

## Advertising
- [N] targeted-ad serving RPC.
- [N] public ad boundary reviewed.
- [ ] campaign lifecycle.
- [ ] creatives.
- [ ] impressions.
- [ ] clicks.
- [ ] spend/budget.
- [ ] frequency control.
- [ ] reporting.
- [ ] advertiser invoice.
- [ ] anti-fraud.
- [ ] rate limits.

---

# 5. التصميم والهوية

- [N] MantiqatiX public identity.
- [N] MantiGO native identity.
- [ ] complete design tokens.
- [ ] typography audit.
- [ ] RTL/LTR audit.
- [ ] dark/light behavior if enabled.
- [ ] component consistency.
- [ ] empty/error/loading visual system.
- [ ] image optimization.
- [ ] accessibility contrast audit.
- [ ] mobile touch-target audit.

---

# 6. CRM والعملاء

- [N] customer/provider separation.
- [N] leads lifecycle.
- [N] support tickets boundary.
- [N] ticket messages boundary.
- [N] tenant scope.
- [ ] customer profile completeness.
- [ ] interaction timeline.
- [ ] follow-ups.
- [ ] segmentation.
- [ ] customer consent.
- [ ] communication preferences.
- [ ] complaint/escalation lifecycle.
- [N] CRM E2E remains NOT VERIFIED.

---

# 7. مقدمو الخدمات والقطاعات

## Provider Core
- [N] provider profile.
- [N] service catalog.
- [N] service areas.
- [N] verification.
- [N] ownership boundaries.
- [N] location-aware discovery.
- [ ] provider onboarding checklist.
- [ ] document verification.
- [ ] approval/rejection workflow.
- [ ] suspension/reactivation.
- [ ] provider analytics.
- [ ] provider payout dashboard.

## القطاعات
لكل قطاع يجب إكمال:
**Profile → Services/Products → Availability → Request/Booking → Status → Payment → Notification → Rating → Analytics → Admin → RLS → E2E.**

- [N] FOOD / Restaurants.
- [N] CAFES.
- [N] GROCERY / Supermarket.
- [N] FASHION / Clothing.
- [N] EDU / Education.
- [N] JOBS.
- [N] USED_ITEMS.
- [N] MAINTENANCE.
- [N] FREELANCER / Professional Services.
- [N] ACCOUNTING.
- [N] LEGAL.
- [N] COMPANIES / Suppliers.
- [N] ERP.
- [N] FACTORIES.
- [N] TRAVEL / Trips.
- [N] MATRIMONY — privacy-safe projection required.
- [N] HEALTH.
- [N] CLINICS.
- [N] HOSPITALS.
- [N] PHARMACY.
- [N] LABS.
- [N] RADIOLOGY.
- [N] DENTAL.
- [N] PHYSIOTHERAPY.
- [N] VETERINARY.
- [N] REAL ESTATE.
- [N] AUTO.
- [N] FITNESS.
- [N] DIGITAL / MARKETING.
- [N] TECH / SOFTWARE.

### لكل قطاع: Definition of Done
- [ ] Public discovery.
- [ ] Provider detail.
- [ ] Service/product detail.
- [ ] Real transaction/request.
- [ ] Secure backend mutation.
- [ ] RLS.
- [ ] role isolation.
- [ ] tenant isolation.
- [ ] notification.
- [ ] payment where applicable.
- [ ] cancellation/refund where applicable.
- [ ] rating where applicable.
- [ ] audit.
- [ ] analytics.
- [ ] browser E2E.
- [ ] mobile E2E.

---

# 8. المستخدمون والأدوار والصلاحيات

- [N] authentication.
- [N] membership model.
- [N] role model.
- [N] tenant scope.
- [N] backend auth.uid checks.
- [N] provider/customer separation.
- [ ] permission matrix formalization.
- [ ] permission regression suite.
- [ ] session expiry E2E.
- [ ] refresh-token E2E.
- [ ] logout E2E.
- [ ] revoked membership E2E.
- [ ] role downgrade E2E.
- [ ] IDOR suite.
- [ ] cross-tenant suite.

---

# 9. قاعدة البيانات والأمان

- [N] 113/113 public tables historically checked with RLS.
- [N] no direct anon/authenticated grants on backend-only sensitive tables from the reviewed baseline.
- [N] MantiGO critical RPC public/anon execution hardened.
- [N] captain self-escalation blocked.
- [N] financial config RLS enabled backend-only.
- [N] digital-page publication gate.
- [N] MantiGO rating immutability.
- [N] provider/payment webhook security boundaries.
- [ ] complete SECURITY DEFINER inventory revalidation.
- [ ] anonymous policy contextual review.
- [ ] backend-only access-path mapping.
- [ ] PII retention review.
- [ ] audit integrity review.
- [ ] secret rotation rehearsal.
- [!] leaked-password protection.
- [ ] abuse/rate limiting.
- [ ] suspicious activity detection.

---

# 10. الموقع + التطبيق + المنصة الموحدة

## Shared
- [N] shared backend.
- [N] shared DB.
- [N] shared business rules.
- [ ] contract tests between web/app.
- [ ] version compatibility matrix.
- [ ] migration compatibility.
- [ ] feature flag strategy.

## Web
- [N] public landing.
- [N] category discovery.
- [N] provider pages.
- [N] MantiGO full-screen customer.
- [N] MantiGO captain cockpit.
- [N] runtime modules.
- [N] PWA baseline.
- [N] browser smoke NOT VERIFIED.

## Mobile
- [N] Android parity catalog.
- [ ] real release AAB.
- [ ] signing.
- [ ] installation.
- [ ] upgrade.
- [ ] push.
- [ ] offline.
- [ ] location permission.
- [ ] background restrictions.
- [ ] real-device E2E.

---

# 11. التحليلات والتقارير

- [N] authoritative event sources identified.
- [N] audit logs.
- [N] payment events.
- [N] provider events.
- [ ] KPI definitions.
- [ ] dashboard queries.
- [ ] tenant scoping.
- [ ] business scoping.
- [ ] role scoping.
- [ ] date filters.
- [ ] export.
- [ ] drill-down.
- [ ] scheduled reports.
- [ ] anomaly detection.
- [ ] MantiGO operations KPIs.
- [ ] finance reconciliation reports.

---

# 12. العمليات وإدارة المهام

- [N] task status vocabulary.
- [ ] task assignment.
- [ ] dependencies.
- [ ] SLA.
- [ ] escalation.
- [ ] approvals.
- [ ] recurring tasks.
- [ ] evidence attachment.
- [ ] VERIFIED closure.
- [ ] operational dashboard.
- [ ] blocked-task reporting.

---

# 13. الأتمتة والإشعارات

- [N] notifications table/path.
- [N] best-effort MantiGO notification inserts.
- [N] push dispatcher boundary.
- [ ] delivery E2E.
- [ ] Web Push subscription lifecycle.
- [ ] stale subscription cleanup.
- [ ] retry.
- [ ] dead-letter.
- [ ] click-through.
- [ ] deep-link routing.
- [ ] notification preferences.
- [ ] quiet hours where applicable.
- [ ] tenant/user isolation.
- [ ] operational alerts.

---

# 14. المحتوى وإدارة المنصة

- [N] public catalog.
- [N] service catalog.
- [N] provider directory.
- [N] feature flags.
- [N] digital page publication gate.
- [ ] CMS governance.
- [ ] draft/review/publish lifecycle لكل content type.
- [ ] versioning.
- [ ] rollback.
- [ ] moderation.
- [ ] media lifecycle.
- [ ] SEO metadata.
- [ ] content audit.
- [ ] localization.

---

# 15. المراقبة والصيانة

- [N] production health workflow exists.
- [N] deploy workflow exists.
- [ ] centralized error dashboard.
- [ ] frontend error telemetry.
- [ ] backend error taxonomy.
- [ ] DB slow-query monitoring.
- [ ] webhook failures.
- [ ] payment failures.
- [ ] notification failures.
- [ ] alert thresholds.
- [ ] incident runbook.
- [ ] on-call ownership.
- [ ] uptime/SLO.
- [ ] post-incident review.

---

# 16. النسخ الاحتياطي والتعافي

- [N] backup requirement documented.
- [ ] production backup verification.
- [ ] restore rehearsal.
- [ ] point-in-time recovery rehearsal.
- [ ] RPO measured.
- [ ] RTO measured.
- [ ] isolated recovery environment.
- [ ] database restore validation.
- [ ] storage restore validation.
- [ ] secrets/config recovery procedure.
- [ ] rollback procedure.
- [ ] disaster recovery runbook.

**لا يتم اعتبار DR VERIFIED بدون Restore Rehearsal موثق.**

---

# 17. الاختبارات وضمان الجودة

## Automated
- [ ] unit tests.
- [ ] integration tests.
- [ ] RPC contract tests.
- [ ] RLS tests.
- [ ] security regression.
- [ ] state-machine tests.
- [ ] concurrency tests.
- [ ] idempotency tests.
- [ ] payment tests.
- [ ] webhook tests.

## Browser
- [ ] anonymous smoke.
- [ ] customer.
- [ ] provider.
- [ ] owner.
- [ ] admin.
- [ ] finance.
- [ ] cross-tenant.
- [ ] accessibility.

## Mobile
- [ ] install.
- [ ] login.
- [ ] customer.
- [ ] provider.
- [ ] location.
- [ ] push.
- [ ] offline.
- [ ] upgrade.
- [ ] logout/session expiry.

---

# 18. الإطلاق والإصدارات

- [N] Git logical commits.
- [N] source/migration synchronization.
- [N] web deploy pipeline.
- [N] health monitor.
- [ ] protected release branch.
- [ ] release candidate tag.
- [ ] production config checklist.
- [ ] secrets verification.
- [!] Android signing.
- [ ] checksum.
- [ ] artifact retention.
- [ ] rollback rehearsal.
- [ ] release notes.
- [ ] post-deploy smoke.
- [ ] new baseline document.

---

# 19. الحوكمة والرقابة

- [N] audit logging.
- [N] admin boundaries.
- [ ] formal RACI.
- [ ] change approval.
- [ ] security approval.
- [ ] financial approval.
- [ ] data-retention policy.
- [ ] privacy review.
- [ ] incident management.
- [ ] access review.
- [ ] quarterly permission review.
- [ ] vendor risk register.

---

# 20. MantiGO — Production Master TODO

## Backend
- [x] ride creation + idempotency.
- [x] captain profile.
- [x] secure captain onboarding.
- [x] captain approval.
- [x] secure presence update.
- [x] secure bid creation.
- [x] matching.
- [x] secure bid acceptance.
- [x] fare lock.
- [x] cash payment.
- [x] Paymob intent.
- [x] Paymob webhook.
- [x] payment gate.
- [x] settlement backend.
- [x] rating immutability.
- [x] audit hooks.
- [N] real E2E transaction.
- [N] concurrency E2E.
- [N] notification delivery E2E.
- [N] settlement E2E.
- [N] provider payment E2E.

## Customer
- [x] full-screen request page.
- [x] pickup.
- [x] destination.
- [x] vehicle.
- [x] ride type.
- [x] proposed price.
- [x] notes.
- [x] geolocation permission when available.
- [x] idempotent publish.
- [x] full-screen ride page.
- [x] realtime ride/bid/financial subscription.
- [x] bid cards.
- [x] accept captain.
- [x] cash payment.
- [x] card payment.
- [x] cancellation path.
- [x] rating.
- [ ] map UI.
- [ ] destination coordinates.
- [ ] distance/duration.
- [ ] passenger count — schema support required before UI claim.
- [ ] price calculation engine.
- [ ] customer-side final fare display.
- [ ] captain verification/trips/rating card fields from authoritative profile.
- [ ] post-payment trip timeline.
- [ ] tracking map.
- [ ] support/report-trip.
- [ ] receipt/invoice.
- [ ] trip history UX polish.

## Captain
- [x] full-screen captain cockpit.
- [x] application.
- [x] approval status.
- [x] availability.
- [x] live open rides.
- [x] secure bid.
- [x] price/ETA/message fields.
- [N] accepted-trip cockpit E2E.
- [ ] navigation to pickup.
- [ ] ARRIVED.
- [ ] STARTED.
- [ ] IN_PROGRESS.
- [ ] COMPLETED.
- [ ] FAILED/SHOW_NO UX.
- [ ] active-trip persistence after reload.
- [ ] current trip card.
- [ ] customer-safe trip information.
- [ ] trip earnings.
- [ ] captain trip history.
- [ ] captain payout/settlement history.
- [ ] captain rating analytics.

## State machine
- [x] backend-only mutation boundary.
- [x] actor checks.
- [x] ownership checks.
- [x] accepted captain checks.
- [x] payment gate.
- [x] row lock on acceptance.
- [N] full transition matrix test.
- [N] invalid transition test.
- [N] duplicate transition test.
- [N] concurrent transition test.
- [ ] explicit transition policy/documentation for every state pair.
- [ ] reason requirements by transition.
- [ ] cancellation policy.
- [ ] timeout/expiration worker.

## Matching
- [x] ACTIVE + VERIFIED + AVAILABLE.
- [x] vehicle category.
- [x] distance scoring when coordinates exist.
- [x] rating/completion/acceptance/cancellation score.
- [x] >50km exclusion when distance known.
- [ ] configurable matching radius.
- [ ] configurable scoring weights.
- [ ] area/service-area matching.
- [ ] stale captain heartbeat handling.
- [ ] capacity/availability race handling.
- [N] load/concurrency test.

## Notifications
- [x] best-effort bid notification.
- [x] best-effort accepted notification.
- [ ] push delivery E2E.
- [ ] captain application status notification.
- [ ] arrival notification.
- [ ] trip started notification.
- [ ] completed notification.
- [ ] payment notification.
- [ ] deep links.
- [ ] retry/dead-letter.
- [ ] stale token cleanup.

## Finance
- [x] dedicated MantiGO ledger.
- [x] commission lock.
- [x] cash confirmation.
- [x] card intent.
- [x] webhook state.
- [x] settlement bridge.
- [N] real provider payment.
- [N] settlement E2E.
- [ ] refund policy.
- [ ] cancellation fee policy.
- [ ] receipt.
- [ ] reconciliation.
- [ ] captain statement.
- [ ] platform revenue report.

## Admin
- [ ] MantiGO Operations dashboard.
- [ ] active trips KPI.
- [ ] open requests KPI.
- [ ] pending bids KPI.
- [ ] accepted trips KPI.
- [ ] in-progress KPI.
- [ ] completed/cancelled/failed/show-no.
- [ ] revenue.
- [ ] commission.
- [ ] captain earnings.
- [ ] date/status/area/captain/customer/vehicle filters.
- [ ] captain approval queue.
- [ ] trip intervention workflow.
- [ ] dispute workflow.
- [ ] audit explorer.

## MantiGO security
- [x] anonymous execute blocked on critical RPCs.
- [x] direct captain profile update blocked.
- [x] backend captain identity source.
- [x] financial config backend-only.
- [x] rating mutation backend-only.
- [N] full RLS behavioral E2E.
- [N] customer/captain cross-access.
- [N] IDOR.
- [N] concurrent accept.
- [N] duplicate payment.
- [N] webhook replay.
- [N] stale captain race.
- [ ] rate limiting.
- [ ] abuse detection.

## MantiGO mobile/offline
- [N] architecture baseline.
- [ ] offline create-ride queue semantics.
- [ ] offline bid semantics.
- [ ] offline accept semantics.
- [ ] offline transition semantics.
- [ ] idempotency recovery.
- [ ] conflict resolution.
- [ ] reconnect.
- [ ] background location policy.
- [ ] real device E2E.

---

# 21. Definition of Done لكل Module

لا يغلق أي Module إلا إذا توفرت:
1. UI customer/provider/admin عند الحاجة.
2. authoritative DB model.
3. RLS.
4. backend mutation boundary.
5. role/tenant authorization.
6. idempotency عند العمليات القابلة لإعادة الإرسال.
7. concurrency policy.
8. notifications.
9. financial policy عند وجود مال.
10. audit.
11. analytics source.
12. error handling.
13. browser test.
14. mobile test عند دعم mobile.
15. production deploy verification.
16. rollback path.

---

# 22. قواعد التنفيذ

1. افحص الموجود قبل البناء.
2. لا تنشئ duplicate implementation.
3. لا تستخدم بيانات وهمية.
4. لا تجعل JavaScript مصدر business truth.
5. لا تمنح client direct mutation للكيانات الحساسة.
6. كل migration يجب أن تكون reproducible.
7. كل تغيير منطقي في commit مستقل.
8. بعد كل مرحلة: source → DB → test → security → CI → deploy → post-deploy.
9. أي اعتماد خارجي يبقى WAIT.
10. أي اختبار لم ينفذ يبقى NOT VERIFIED.
11. لا تُصدر شهادة Production قبل إغلاق P0.
12. أي فشل E2E يعيد البند إلى TODO ويمنع Go-Live للجزء المتأثر.

---

# 23. Current blockers

- [!] Supabase Auth leaked-password protection.
- [N] multi-user/multi-tenant E2E.
- [N] real Paymob E2E.
- [N] finance/settlement E2E.
- [N] notification delivery E2E.
- [N] browser production smoke.
- [!] Android signed release + real-device E2E.
- [N] backup/restore rehearsal.
- [N] rollback rehearsal.
- [N] final Security Advisor sign-off.
- [N] MantiGO complete state-machine E2E.
- [N] MantiGO captain active-trip E2E.

---

# 24. Final certification rule

**Current status: PRODUCTION CERTIFICATION NOT ISSUED.**

سبب ذلك ليس نقصًا في وجود الكود فقط، بل لأن الأدلة النهائية المطلوبة — خصوصًا E2E متعدد المستخدمين، الدفع الحقيقي، الاستعادة، الجهاز الحقيقي، والإطلاق/الرجوع — لم تُثبت بعد.

هذا الملف هو سجل التنفيذ الرئيسي؛ يتم تحديثه بعد كل تغيير verified ولا يُستخدم لإخفاء أي فجوة اختبارية.
