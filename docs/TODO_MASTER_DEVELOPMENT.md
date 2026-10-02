# MNTY / MantiqatiX — MASTER DEVELOPMENT TODO
## Continuation-safe A→Z execution ledger

> هذا الملف هو نقطة الاستئناف الرسمية لكل جلسة تطوير لاحقة.
> لا تبدأ جلسة جديدة من الصفر. اقرأ هذا الملف + الأمر الرئيسي الشامل + آخر Baseline + حالة Git/Supabase، ثم تابع أول بند قابل للتنفيذ.
>
> القاعدة الإلزامية لكل Module:
> **Analyze → Impact → Prompt → Implement → Integrate → Test → Security → Verify → Release → Monitor → Baseline**
>
> **DONE لا تعني VERIFIED.**
>
> لا يجوز اعتبار وظيفة مكتملة لمجرد وجود UI أو جدول أو Edge Function؛ يجب إثبات التكامل والاختبارات المناسبة.

---

# 0) MASTER SESSION PROMPT — يُقرأ أولًا في كل جلسة

نفّذ تطوير MNTY / MantiqatiX من آخر Baseline مستقر ومتحقق منه، ولا تعِد البناء من الصفر.
قبل أي تعديل:
1. اقرأ هذا TODO.
2. اقرأ `00_الأمر_الرئيسي_الشامل.md` وبقية الأوامر المتخصصة ذات الصلة.
3. افحص Git baseline الحالي والملفات المتأثرة.
4. افحص Database/Schema/RLS/Functions/Storage ذات الصلة.
5. حدّد الوظائف الموجودة جزئيًا قبل إنشاء أي بديل.
6. أنشئ/حدّث Prompt كامل للموديول المطلوب هنا قبل التنفيذ.
7. نفّذ أقل تغيير آمن يحقق المعيار الكامل.
8. اختبر التكامل والـRegression والأمان.
9. وثّق ما تم وما بقي وما هو BLOCKED.
10. أنشئ Baseline جديد فقط بعد تحقق حقيقي.

قواعد عامة:
- لا بيانات وهمية في الإنتاج.
- لا أسرار أو service_role في المتصفح.
- كل عملية حساسة Server-side مع Authentication + Authorization + RLS + Audit عند الحاجة.
- لا تتجاوز RLS أو الصلاحيات لتسريع التطوير.
- أي تغيير Backend/DB/API/Business Logic يجب تقييم أثره على Website/Admin/Android لاحقًا.
- GitHub Pages هو واجهة Website الحالية؛ أي تعديل في `web/` يحتاج Deployment تلقائيًا عبر workflow، ثم تحقق من النسخة المنشورة وCache.
- عند وجود Blocker حقيقي لا يتم اختلاق نجاح أو بيانات اختبار.
- عند طلب المستخدم "كمل" تابع من هذا الملف ومن آخر Baseline.

---

# 1) CORE PLATFORM / IDENTITY
### الحالة: IN PROGRESS
### Prompt
طوّر هوية MNTY / MantiqatiX كمنصة Customer ↔ Service Provider + Service Discovery + Matching + Service Delivery، مع استخدام الموقع فقط عند الحاجة التشغيلية. حافظ على Website/Admin/Backend/Database/API كمنظومة واحدة، ولا تحوّل المنصة إلى GIS عام.

### Acceptance
- الهوية موحدة.
- جميع الوحدات مرتبطة بنموذج الخدمة الحقيقي.
- لا وظيفة مستقلة بلا علاقة بالعميل/مقدم الخدمة/الطلب/تنفيذ الخدمة.

---

# 2) AUTHENTICATION / ACCOUNT / PROFILE
### الحالة: PARTIAL
### Prompt
أكمل نظام الحساب من A→Z:
- تسجيل/دخول/خروج.
- حالة الدخول الواضحة في Header.
- Avatar/cover عبر المسار الآمن.
- حسابي.
- ملف شخصي عام/خاص حسب الصلاحية.
- بيانات الاتصال والإعدادات.
- عضويات وأدوار وسياق النشاط/الفرع.
- طلبات الأدوار.
- حماية الجلسة.
- Recovery/verification.
- منع الوصول غير المصرح.
- دعم Profile Portfolio المدفوع من حساب الشخص.
- صفحة نشاط مستقلة لمقدم الخدمة.
- ربط صورة النشاط والملف الشخصي دون كشف بيانات حساسة.

### Acceptance
- Header يوضح Login/Account state.
- Account page تعرض profile + memberships + activity + digital services + orders.
- RLS/E2E للتحقق من عزل الحسابات.
- لا UUIDs أو بيانات داخلية غير لازمة للمستخدم.

---

# 3) ACTIVITY ONBOARDING / ADD ACTIVITY
### الحالة: PARTIAL
### Prompt
حوّل "إضافة نشاط" إلى Modal محترف RTL/mobile-first يرسل طلب تسجيل، ثم onboarding متدرج:
- نوع النشاط.
- الاسم.
- اللغة.
- الهاتف.
- المحافظة/المركز.
- الخدمات والتخصصات.
- الوصف.
- روابط الأعمال.
- بيانات النشاط.
- مراجعة.
- اعتماد.
- إنشاء business/branch/catalog فقط من Server-side approved flow.
- منع إنشاء نشاط تشغيلي من Browser مباشرة.
- حالات PENDING/APPROVED/REJECTED مع سبب الرفض.
- إعادة الإرسال الآمن عند الحاجة.
- إشعارات حالة الطلب.

### Acceptance
- الطلب لا يمنح صلاحيات تشغيلية قبل الاعتماد.
- لا duplicate businesses بسبب double submit.
- audit/idempotency.
- كل القطاعات مدعومة.

---

# 4) TAXONOMY / CATEGORY PAGES
### الحالة: PARTIAL
### Prompt
حوّل كل قطاع من الصفحة الرئيسية إلى Public Category Page ديناميكية قابلة لإعادة الاستخدام:
Home → Category → Services → Providers → Provider Profile → Catalog/Booking.
استخدم category_code ولا تنشئ 27 نسخة برمجية مكررة.
يجب دعم:
- hash route على GitHub Pages.
- Back/Forward/Refresh.
- الخدمات الحقيقية.
- مقدمي الخدمة الحقيقيين.
- الصور.
- التحقق.
- المناطق.
- زر الطلب/الحجز.
- Service detail.
- Provider profile.
- Empty/error/loading states.
- SEO-friendly metadata قدر الإمكان ضمن SPA.
- عدم فقد الصفحة عند Refresh.

### Acceptance
- كل TAXONOMY codes تعمل.
- لا scroll-only behavior عند الضغط على القطاع.
- Service cards تؤدي لمسار خدمة فعلي أو provider/catalog مناسب.
- Provider cards تؤدي لصفحة ملف مستقلة.

---

# 5) PROVIDER PROFILE / BUSINESS PROFILE
### الحالة: PARTIAL
### Prompt
أكمل صفحة النشاط من A→Z:
- Cover/Profile image.
- الاسم والوصف.
- التحقق.
- القطاع.
- التخصصات.
- مناطق الخدمة.
- الخدمات والأسعار المنشورة.
- ساعات العمل عند توفرها.
- الفروع.
- وسائل التواصل المسموح بها.
- Menu/Portfolio إذا مملوكة.
- Booking/Order.
- Share link.
- QR عند الحاجة.
- حالة النشاط.
- عدم عرض بيانات داخلية أو شخصية غير مصرح بها.

---

# 6) PORTFOLIO PAID SERVICE
### الحالة: IMPLEMENTED PARTIAL — يحتاج إغلاق تكامل
### Prompt
أضف خدمة تجارية مدفوعة من حساب أي شخص لطلب صفحة Portfolio شخصية:
- عرض الباقات من `digital_page_products`.
- السعر مصدره Server/DB وليس Browser.
- إنشاء `digital_page_orders` عبر Edge Function محمية.
- idempotency.
- pricing hash.
- Payment Intent.
- Paymob/بوابة الدفع.
- حالات الدفع.
- Fulfillment.
- مراجعة/تنفيذ.
- إنشاء digital_pages بعد الاستحقاق/الموافقة.
- Sections.
- Theme.
- SEO.
- Slug.
- Media.
- Publish/Unpublish.
- Versioning.
- مدة الاشتراك/الخدمة.
- تجديد.
- إلغاء/استرداد وفق السياسة.
- صفحة عامة مستقلة.
- Dashboard للمالك.
- Admin fulfillment.
- Audit trail.
- حماية tenant/user isolation.

### Acceptance
لا يكفي إنشاء order. يجب أن يمر المسار:
Account → Choose Portfolio Plan → Order → Payment Intent → Verified Payment → Fulfillment → Digital Page → Publish → Public URL.

---

# 7) MENU PAID SERVICE
### الحالة: IMPLEMENTED PARTIAL — يحتاج إغلاق تكامل
### Prompt
أضف خدمة Menu مدفوعة للمطاعم والكافيهات ومقدمي الطعام:
- الطلب من حساب مالك النشاط.
- تحقق Server-side من ملكية business.
- اختيار MENU package.
- إنشاء order.
- Payment Intent.
- الدفع والتحقق.
- إنشاء/تجهيز digital page.
- ربطها بالنشاط/الفرع.
- ربط عناصر القائمة الحقيقية.
- categories/items/prices/images/options.
- QR.
- رابط مشاركة.
- Mobile-first menu.
- تحديث القائمة من حساب النشاط.
- حالات publish/unpublish.
- Versioning.
- مدة الخدمة والتجديد.
- Admin fulfillment.
- منع طلب Menu لنشاط غير مملوك.
- منع عرض بيانات مطعم آخر.
- Audit/idempotency.

### Acceptance
Account → Own Business → Menu Plan → Order → Payment → Fulfillment → Menu Page → QR/Public URL → Edit/Publish.

---

# 8) DIGITAL PAGE ENGINE
### الحالة: PARTIAL
### Prompt
حوّل digital_pages إلى محرك صفحات عام يدعم PORTFOLIO وMENU مع schema موحد:
- Page lifecycle.
- Sections.
- Version.
- Draft/Published/Archived.
- Slug uniqueness.
- Theme.
- SEO.
- Media.
- Public rendering.
- Owner editor.
- Preview.
- Publish.
- Rollback/version restore.
- analytics الأساسية.
- access control.
- expiration.
- renewal.
- audit.

---

# 9) CATALOG / SERVICES / PRICING
### الحالة: PARTIAL
### Prompt
أكمل catalog engine:
- Items.
- Prices.
- Options.
- Branch.
- Availability.
- Currency.
- Pricing snapshot.
- Version/hash.
- Server-side recalculation.
- Admin/Super Admin controlled writes.
- Provider self-service وفق الصلاحيات.
- Public read only للمنشور.
- تكامل الطلبات والحجوزات.

---

# 10) CART / ORDER
### الحالة: PARTIAL
### Prompt
أكمل السلة والطلبات:
- Cart state.
- Add/remove/update.
- Idempotency.
- Server-side pricing.
- Tenant/business/branch.
- Catalog validation.
- Checkout.
- Payment.
- Order lifecycle.
- Customer history.
- Provider queue.
- Status transitions.
- Notifications.
- cancellation/refund policy.
- Cross-tenant isolation.

---

# 11) WALLET / FINANCE
### الحالة: PARTIAL / NOT LIVE-DATA VERIFIED
### Prompt
أكمل Wallet:
- Customer/provider/business wallets عند الحاجة.
- Ledger.
- Balance.
- Credit/debit.
- Idempotency.
- journal integration.
- settlements.
- refunds.
- reconciliation.
- transaction history.
- permissions.
- audit.
- no direct browser mutation.
- ربط الخدمات الرقمية عند الحاجة.
- حالات الرصيد الفارغ بدون بيانات وهمية.

---

# 12) PAYMENTS
### الحالة: PARTIAL
### Prompt
وحّد الدفع لكل المنتجات والخدمات:
- Payment Intent.
- provider.
- amount snapshot.
- currency.
- pricing hash/version.
- idempotency.
- callback/webhook verification.
- Paymob.
- failure/retry.
- duplicate callback.
- payment state machine.
- fulfillment only after verified success.
- user-facing payment continuation.
- logs/audit.
- secrets server-side.

---

# 13) MARKETING / ADVERTISING
### الحالة: PARTIAL
### Prompt
أكمل التسويق كقطاع تشغيلي لشركة MNTY:
- marketing provider profiles.
- campaigns.
- leads.
- ad packages.
- targeting.
- sponsored discovery.
- agency/company workflows.
- CRM linkage.
- billing.
- analytics.
- permissions.
- public discovery.
- لا تخلط خدمات التسويق مع taxonomy unrelated services.

---

# 14) CRM
### الحالة: PARTIAL
### Prompt
أكمل CRM:
- Leads.
- Customers.
- Providers.
- assignments.
- pipeline.
- notes.
- follow-ups.
- consent.
- audit.
- tenant isolation.
- marketing integration.

---

# 15) OPERATIONS / TASKS
### الحالة: PARTIAL
### Prompt
أكمل العمليات:
- Tasks.
- owners.
- priorities.
- due dates.
- status.
- dependencies.
- SLA.
- escalation.
- notifications.
- audit.
- VERIFIED closure.

---

# 16) NOTIFICATIONS / AUTOMATION
### الحالة: PARTIAL
### Prompt
أكمل notifications:
- in-app.
- email/SMS/WhatsApp only where configured.
- event-driven.
- templates.
- retries.
- deduplication.
- preference center.
- security-sensitive notification rules.
- admin monitoring.

---

# 17) CONTENT / CMS
### الحالة: PARTIAL
### Prompt
أكمل إدارة المحتوى:
- public pages.
- legal documents.
- SEO content.
- announcements.
- banners.
- categories.
- moderation.
- versioning.
- publish workflow.
- media rights.

---

# 18) ANALYTICS / REPORTING
### الحالة: PARTIAL
### Prompt
أكمل analytics:
- discovery.
- category views.
- provider views.
- orders.
- conversion.
- payment.
- digital page views.
- portfolio/menu engagement.
- marketing performance.
- role-based dashboards.
- privacy.
- no leakage across tenants.

---

# 19) ADMIN / SUPER ADMIN
### الحالة: PARTIAL
### Prompt
أكمل التحكم الإداري:
- tenant management.
- businesses.
- users.
- roles.
- approvals.
- catalog.
- digital page fulfillment.
- payments.
- finance.
- marketing.
- content.
- reports.
- audit.
- feature flags.
- support.
- safe destructive actions.
- highest role without browser service_role.

---

# 20) SECURITY / PRIVACY
### الحالة: OPEN GATES
### Prompt
نفّذ security hardening شامل:
- RLS review.
- function authorization.
- JWT.
- CORS.
- input validation.
- XSS/HTML escaping.
- CSRF considerations.
- storage isolation.
- secret handling.
- rate limiting where needed.
- idempotency.
- audit.
- tenant isolation.
- account isolation.
- payment verification.
- leaked password protection after plan support.
- Security Advisor review.
- remediation with justification for intentional public RPCs.
- no blanket permission changes.

---

# 21) STORAGE / MEDIA
### الحالة: PARTIAL
### Prompt
أكمل media:
- user avatar.
- activity logo.
- cover.
- portfolio.
- menu images.
- QR.
- signed/private access where required.
- public only when intentionally public.
- file validation.
- MIME/size limits.
- path isolation.
- deletion lifecycle.
- orphan cleanup.
- E2E storage test.

---

# 22) SEARCH / DISCOVERY / LOCATION
### الحالة: PARTIAL
### Prompt
أكمل البحث:
- service.
- provider.
- category.
- location when needed.
- ranking.
- featured/sponsored separation.
- empty states.
- no fake results.
- location permission.
- privacy.
- no continuous tracking.

---

# 23) WEBSITE / MOBILE-FIRST UX
### الحالة: IN PROGRESS
### Prompt
راجع كل الواجهات:
- desktop.
- tablet.
- mobile.
- header.
- account.
- wallet.
- cart.
- category pages.
- provider profiles.
- portfolio/menu.
- checkout.
- admin handoff.
- loading/error/empty states.
- accessibility.
- keyboard.
- RTL.
- performance.
- cache/versioning.

---

# 24) ANDROID / FUTURE CLIENT
### الحالة: BLOCKED/DEFERRED
### Prompt
لا تنسخ Website UI إلى Android.
أعد استخدام Backend/API/Business Logic.
بعد استقرار Website وBackend:
- build.
- auth.
- deep links.
- push.
- payment.
- storage.
- E2E.
- signing.
- release.

---

# 25) TESTING / QA
### الحالة: OPEN
### Prompt
أنشئ test matrix:
- unit.
- integration.
- E2E.
- auth.
- authorization.
- RLS.
- tenant isolation.
- category navigation.
- profile.
- onboarding.
- cart/order.
- payment.
- portfolio.
- menu.
- storage.
- admin.
- rollback.
- backup restore.
- browser regression.
- mobile responsive.
- accessibility.

---

# 26) BACKUP / RECOVERY / RELEASE
### الحالة: OPEN GATES
### Prompt
أكمل:
- backup.
- restore drill.
- RPO/RTO.
- migration safety.
- rollback.
- deployment.
- cache invalidation.
- production config.
- external payment callback.
- monitoring.
- incident response.
- release ledger.

---

# 27) OBSERVABILITY / MONITORING
### الحالة: PARTIAL
### Prompt
أكمل monitoring:
- edge logs.
- auth.
- DB.
- storage.
- payment.
- errors.
- latency.
- failed functions.
- alerting.
- audit.
- incident drill.

---

# 28) GOVERNANCE / COMPLIANCE
### الحالة: PARTIAL
### Prompt
أكمل:
- role governance.
- approvals.
- audit.
- legal documents.
- privacy.
- terms.
- data retention.
- deletion.
- ownership.
- moderation.
- dispute/refund policies.

---

# 29) PRODUCTION RELEASE GATE
### الحالة: NOT PRODUCTION CERTIFIED
### Prompt
لا تعلن Production Certified إلا بعد:
- core verified.
- auth/authz verified.
- RLS verified.
- tenant isolation independently verified.
- payment E2E verified.
- backup restore verified.
- rollback verified.
- storage E2E verified.
- browser regression verified.
- Android gate if included.
- production config verified.
- monitoring/alerts verified.
- Security Advisor reviewed.
- all blockers explicitly closed.

---

# 30) CURRENT KNOWN GAPS TO CLOSE FIRST
1. إظهار `commercialHtml` داخل Account page؛ حاليًا يتم بناؤه لكنه لا يدخل فعليًا في HTML.
2. إضافة `business_id` إلى provider profile query حتى يعمل طلب Menu للنشاط المملوك.
3. إكمال Payment Intent داخل Digital Page Order flow بدل إنشاء order فقط.
4. إكمال مسار Paymob checkout/user continuation وعدم اعتبار إنشاء payment intent دفعًا ناجحًا.
5. ربط fulfillment بإنشاء/publish digital_pages بعد الدفع الموثق.
6. صفحة إدارة Portfolio/Menu لصاحب الطلب.
7. صفحة عامة فعلية لـ digital_pages مع slug.
8. ربط Menu بعناصر القائمة الحقيقية.
9. إغلاق Service Detail في Category Page؛ الزر الحالي لا يفتح تفاصيل حقيقية.
10. اختبار category/profile routing بعد refresh وBack/Forward على GitHub Pages.
11. E2E مستقل للـtenant isolation عند توفر حسابات اختبار معتمدة.
12. Storage E2E عند توفر identity/objects اختبارية.
13. Backup restore/RPO-RTO drill.
14. Leaked password protection بعد توفر الخطة التي تسمح بالحفظ.
15. Payment/Paymob E2E.
16. Production release certification.

---

# 31) REQUIRED PROMPT FORMAT FOR EVERY NEW MODULE

عند طلب المستخدم: "أريد Module X":
أنشئ أولًا داخل هذا الملف قسمًا كاملًا:
- Objective
- Scope
- Actors
- UX/UI
- Routes
- Database impact
- RLS
- APIs/Edge Functions
- Business rules
- Permissions
- Payments
- Notifications
- Audit
- Storage
- Analytics
- Admin
- Failure states
- Security
- Tests
- E2E
- Release gates
- Rollback
- Acceptance criteria
ثم ابدأ التنفيذ.

---

# 32) SESSION CHECKPOINT

## Latest checkpoint — 2026-10-02
### Baseline / commits
- RC227: `305db3d435a9975ee3ccd95c4d34270851884054` — master continuation TODO/prompts.
- RC228: `188a9b2ad562a90f2e10bb2215e0510447d6d318` — Account digital services wiring + Payment Intent handoff.
- RC229: `202ca3538dcc43ce8b4a42b4539c72334cc98904` — public digital page route/renderer.
- RC230: `1c4c1970eb47bab2a9f8b1c26a4c2456216a0ead` — digital page styles.
- RC231: `4474cd5620ad9a7a1194b211120dd653759e8fd0` — web asset revision bump.

### Implemented in this continuation
- Master A→Z TODO and reusable module prompts committed.
- Account now actually inserts the commercial digital-services section that was previously constructed but omitted from the page HTML.
- Provider profile query includes `business_id`, enabling Menu purchase for an owned activity when the profile is available.
- Digital page order flow now creates the order and then invokes the protected payment-intent function.
- Payment-intent Edge Function v2 can return a Paymob Unified Checkout URL when `PAYMOB_PUBLIC_KEY` is configured server-side.
- Paymob webhook already contains verified digital-page payment handling and changes successful orders to `PAID / IN_REVIEW`.
- Public published digital pages now have a GitHub Pages-safe hash route: `#page/<slug>`.
- Public digital page renderer reads only `PUBLISHED` pages and active public sections.
- Website asset revisions were bumped to prevent stale home/app CSS/JS after deployment.

### Verified
- Live database contains active PORTFOLIO and MENU products:
  - Portfolio Basic / Pro.
  - Menu Basic / Pro.
- `digital_pages` and `digital_page_sections` have public-read policies only for PUBLISHED/active content.
- `digital_page_orders` owner-read is restricted to `auth.uid()`.
- `digital_page_products` public read is limited to active products; writes are admin-controlled.
- `digital_page_sections` owner management is scoped to business membership or provider ownership.
- Payment webhook has a digital-page path with HMAC-verified processing.
- Payment Intent Edge Function remains JWT protected.

### Still OPEN / NOT VERIFIED
- `PAYMOB_PUBLIC_KEY` production configuration is not verified/set through an available secrets-management tool; therefore checkout redirect cannot be declared live-ready.
- Independent real payment E2E remains unverified.
- Successful payment currently moves the digital order to `IN_REVIEW`; automated fulfillment that creates the final `digital_pages` record and publishes it is not yet closed.
- Owner editor for Portfolio/Menu content is not yet closed.
- Menu content synchronization from `restaurant_menu_items` into published digital page sections is not yet closed.
- Public page SEO/share/QR generation is partially implemented; final production metadata/QR lifecycle remains open.
- Category Service Detail currently has a placeholder action and needs a real service detail/catalog route.
- Independent tenant-isolation browser E2E is blocked by lack of a suitable authorized test identity.
- Storage E2E, backup restore/RPO-RTO, rollback drill, browser regression, and leaked-password protection remain open.
- Production status remains **NOT PRODUCTION CERTIFIED**.

### GitHub Pages deployment
- **YES — deployment is required after these Website commits.**
- The repository's GitHub Pages workflow publishes `web/` from `main`; no manual Run should be necessary when the workflow succeeds.
- After deployment, verify the published site, hard refresh if needed, and confirm the new asset revisions `mnty119` are loaded.

### Next execution priority
1. Close digital-page fulfillment after verified payment.
2. Add owner editor for Portfolio/Menu and safe media management.
3. Add Menu public content model/section generation and QR/share.
4. Close service-detail route.
5. Continue release gates: payment E2E → storage E2E → backup/restore → rollback → browser regression → security → production certification.
