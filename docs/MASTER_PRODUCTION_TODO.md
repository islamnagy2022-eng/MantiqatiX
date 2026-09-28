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
