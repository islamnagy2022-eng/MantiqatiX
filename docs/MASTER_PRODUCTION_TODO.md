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

# P0 — حواجز الإطلاق

1. E2E مصادقة وصلاحيات متعددة المستخدمين/المؤسسات — NOT VERIFIED
   - عميلان ومقدما خدمة من جهتين مختلفتين.
   - tenant/business/role isolation.
   - OTP، انتهاء الجلسة، logout، refresh.
   - منع IDOR والوصول إلى مستخدم/مزود آخر.

2. E2E العميل → مقدم الخدمة → الطلب → الحالة → الإشعار — NOT VERIFIED
   - إنشاء طلب حقيقي.
   - ظهور الطلب للمزود الصحيح فقط.
   - انتقالات الحالة.
   - وصول الإشعار وclick-through.
   - عزل مزودين من أعمال مختلفة.

3. Paymob production E2E — WAIT
   - معاملة حقيقية مصرح بها.
   - HMAC/replay/idempotency.
   - ربط الدفع بالطلب الصحيح.
   - حماية السعر/العملة/tenant.

4. Finance/Settlement E2E — NOT VERIFIED
   - payment success → commission → payout/settlement.
   - duplicate webhook.
   - concurrent/replay.
   - tenant isolation.
   - GL posting/account mapping/reconciliation.

5. Supabase Security Advisor — OPEN
   - 7 جداول RLS بلا policies — REVIEWED: no direct anon/authenticated grants; backend-only isolation still requires access-path documentation.
   - pg_net داخل public — CLOSED in RC107; moved to extensions and trigger dependency revalidated.
   - create_payment_intent_backend SECURITY DEFINER قابل للتنفيذ من authenticated؛ الاستدعاء مقصود حالياً لكن يلزم إغلاق/توثيق الإنذار بأمان.
   - تحذيرات anonymous policies تحتاج مراجعة حسب الجدول.
   - leaked-password protection معطل.

6. RLS بلا Policies — TODO/P0
   - private.platform_admins
   - public.erp_purchase_orders
   - public.erp_purchase_receipts
   - public.erp_stock_transfers
   - public.smm_admins
   - public.smm_provider_credentials
   - public.smm_providers
   - Direct anon/authenticated grants: VERIFIED NONE.
   - Next: map service-role/backend access paths; do not add broad policies merely to silence Advisor.

7. Leaked Password Protection — WAIT
   - تفعيلها من Supabase Auth.
   - إعادة فحص Advisor.

8. Production release build + signing — WAIT
   - protected release keystore.
   - release AAB/APK.
   - signature/checksum verification.
   - لا أسرار أو keystore في repo.

9. Real-device release test — WAIT
   - install/update.
   - auth/session.
   - customer/provider/owner/admin.
   - push.
   - network loss/retry.
   - location permission عند الحاجة فقط.

10. Public web browser smoke — NOT VERIFIED
    - الصفحة العامة أولاً.
    - auth/runtime/import.
    - responsive/accessibility.
    - PWA/service worker.
    - production URL.

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
