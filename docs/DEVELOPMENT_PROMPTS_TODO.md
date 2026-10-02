# MantiqaTix — Master Development Prompts TODO / A→Z Module Contract

## قاعدة إلزامية
قبل تنفيذ أي Module أو Feature:
1. اكتب Prompt تطوير كامل في هذا الملف.
2. الـPrompt يجب أن يغطي A→Z: discovery, source-of-truth, UX/UI, data model, API/Edge Functions, auth/RBAC/RLS, tenant/business/branch scope, payments/pricing/idempotency, storage/media, audit, notifications, analytics, accessibility, responsive web, SEO/public pages, error/loading/empty states, abuse/rate limits, tests, security, deployment, monitoring, rollback, documentation, and verification.
3. لا نستخدم DONE كبديل عن VERIFIED.
4. لا نخترع بيانات إنتاج أو هويات اختبار.
5. أي تعديل مشترك في DB/API/business logic/settings يجب أن ينعكس على كل الواجهات المتأثرة.
6. لا نكرر business/security logic الحساس في الواجهة.
7. قبل Go-Live يجب إغلاق بوابات المشروع P0 أو توثيق WAIT/BLOCKED بوضوح.

## Prompt 001 — Unified Category / Sector Pages
**الهدف:** تحويل كل قطاع من الصفحة الرئيسية إلى صفحة قطاع مستقلة قابلة للمشاركة والتحديث والرجوع، بدون 27 نسخة كود مكررة.
**A→Z:** route/hash compatible with GitHub Pages; taxonomy source; sector hero; search/filter/sort; active providers only; active services only; sponsored content with isolation; provider cards; provider profile navigation; service/catalog navigation; loading/error/empty states; auth-aware booking; back/refresh/deep-link; mobile/desktop; SEO metadata; accessibility; analytics events; cache invalidation; no fake records; regression against legacy homepage; security/RLS; tests for every taxonomy code; deployment smoke.
**Acceptance:** Home → Sector → Provider → Profile/Catalog → Booking/Order works without relying on scroll-only behavior; refresh/deep-link works.

## Prompt 002 — Add Activity Request
**الهدف:** زر «إضافة نشاط» يفتح Modal احترافي ويرسل طلب تسجيل النشاط عبر المسار الخلفي المعتمد.
**A→Z:** auth/session check; modal; draft persistence; sector; Arabic/English name; description; specialties/services; governorate/center; contact; consent; validation; duplicate pending-request guard; mnty-provider-onboarding-submit; audit; status tracking; review/reject/resubmit; notifications; mobile accessibility; secure errors; rate limiting/idempotency; E2E.
**Acceptance:** no direct privileged insert; pending request is visible in account; approval remains server-authoritative.

## Prompt 003 — Personal Portfolio Page Purchase
**الهدف:** أي مستخدم من «حسابي» يستطيع طلب Portfolio Page مدفوعة.
**A→Z:** product/pricing catalog; package selection; feature matrix; preview; profile identity; biography; skills/services; portfolio items; contact CTA; social links; media; SEO/public slug; draft/review/publish lifecycle; ownership; content moderation; payment intent; provider/webhook/idempotency; receipt; refund/cancellation policy; subscription/renewal if applicable; wallet/cart integration; notifications; audit; rate limiting; tenant/privacy; signed/private media where needed; responsive/accessibility; analytics; admin fulfillment workflow; page versioning; rollback/unpublish; tests; production payment E2E.
**Acceptance:** payment cannot publish by itself; successful payment creates an owned request/order; fulfillment/review controls publication.

## Prompt 004 — Business/Menu Page Purchase
**الهدف:** أي مطعم/كافيه/مقدم خدمة يستطيع من «حسابي» طلب صفحة Menu مدفوعة.
**A→Z:** eligibility; business/provider ownership; package/pricing; menu structure/categories/items/options/prices/images/allergens where applicable; QR/share URL; public page; draft/review/publish; catalog synchronization where safe; no duplicate price authority; payment intent/webhook/idempotency; receipt/refund; media security; analytics; admin fulfillment; notifications; audit; mobile-first; accessibility; SEO; versioning; rollback/unpublish; tests.
**Acceptance:** restaurant/cafe/provider can request and pay from account; menu page is scoped to owned activity; publication requires valid paid/approved state.

## Prompt 005 — Account / Profile / Wallet / Cart
**الهدف:** حساب موحد فعلي للمستخدم مع Profile, activity profile, portfolio/menu purchases, wallet, cart, orders, notifications.
**A→Z:** auth state; avatar/cover; personal profile; owned activities; role context; purchases; cart; wallet balance/transactions; payment methods where supported; security/session; privacy; export/delete policy; notification center; support; responsive; accessibility; no exposure of tenant/user IDs; tests.

## Prompt 006 — Provider / Business Public Profile
**الهدف:** صفحة عامة مستقلة لكل نشاط/مقدم خدمة.
**A→Z:** verified status; media; description; service areas; services/catalog; menu/portfolio when purchased and published; contact/booking/order CTA; business hours only if authoritative; reviews only if authoritative; ads/sponsored labeling; SEO slug; canonical URLs; tenant isolation; inactive/suspended handling; analytics; mobile/accessibility; share.

## Prompt 007 — Marketplace Cart / Checkout
**الهدف:** سلة موحدة دون اختراع مصدر أسعار جديد.
**A→Z:** active catalog only; branch/tenant grouping; pricing snapshot; quantity/options; stock where applicable; idempotency; checkout; payment; order creation; failure/retry; cart persistence; auth; guest restrictions; coupons only server-side; receipts; notifications; reconciliation; tests.

## Prompt 008 — Commercial Services Engine
**الهدف:** محرك موحد لبيع Portfolio/Menu/Advertising/Subscriptions وغيرها.
**A→Z:** product catalog; package versions; price/currency/tax; eligibility; purchase intent; payment; fulfillment; entitlement; expiration; renewal; refund; cancellation; invoice/receipt; idempotency; audit; RBAC/RLS; reporting; admin controls; feature flags; rollback.

## Prompt 009 — Production Closure
**الهدف:** إغلاق كل ما تبقى قبل الإطلاق.
**A→Z:** Auth E2E; multi-user/multi-tenant; RLS adversarial; Paymob; webhook replay/concurrency; finance/settlement; backup/restore; monitoring/alerts; browser regression; performance; accessibility; Security Advisor; leaked-password protection; release build; rollback; post-release smoke; final baseline.
