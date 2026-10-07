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

5. Supabase Security Advisor — OPEN / REVIEWED
   - آخر فحص Production (2026-10-07): public.digital_page_payment_events هو الجدول الوحيد الظاهر كـ RLS enabled بدون policy؛ وهو backend-only/payment-event boundary ومقصود أن يبقى fail-closed.
   - تحذير SECURITY DEFINER للـ anon: get_mnty_targeted_advertisements — endpoint إعلانات عام مقصود، ويظل يحتاج مراجعة موثقة لا تعطيلًا أعمى.
   - 40 SECURITY DEFINER functions قابلة للتنفيذ من authenticated؛ تمت مراجعة حدود الممثل/العضوية في المسارات الحرجة، ولا يوجد حتى الآن P0 actor-spoofing defect مثبت، لكن التحذير لا يُعتبر مغلقًا حتى تكتمل المراجعة الفردية.
   - تحذيرات anonymous-policy ما زالت تحتاج مراجعة سياقية؛ لا تُعتبر وحدها إثباتًا لوصول مجهول فعلي.
   - leaked-password protection معطل — WAITING FOR OWNER / Dashboard action.

6. RLS بلا Policies — PARTIAL / FAIL-CLOSED REVIEW
   - Production الحالي: 128/128 public base tables عليها RLS.
   - 1 table فقط بلا policy: public.digital_page_payment_events، وهو backend-only/payment-event boundary.
   - لا يوجد مبرر حالي لإضافة broad policies لمجرد إسكات Advisor.
   - يلزم توثيق/إثبات access-path الخاص بالـ backend/service-role قبل اعتبار البند مغلقًا.

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

