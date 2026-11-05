# خريطة ربط Google AI Studio V6 بعقود Supabase الحية

**تاريخ الفحص:** 5 نوفمبر 2026  
**النطاق:** قراءة فقط من Supabase Production ومراجعة مصدر V6 المحلي؛ لم تُنفذ أي تغييرات على قاعدة الإنتاج أو Edge Functions أو الموقع المنشور.

## 1. نتيجة الفحص الحي

- Supabase project: `moyhiluyhjsujhwlyeuu`.
- المخطط يعرض 138 جدولًا/كائن جدول في نتيجة الفحص، منها 137 ضمن `public`.
- عدد سجلات migrations المعروضة: 309.
- وظائف Edge النشطة: 42.
- الجداول الأساسية التي فُحصت بالتفصيل لديها RLS مفعّل، ومنها: `businesses`, `branches`, `user_memberships`, `catalog_items`, `catalog_item_prices`, `orders`, `wallet_accounts`, `wallet_transactions`, `payment_intents`, `business_subscriptions`, `public_directory_listings`.
- أعداد الصفوف التي أظهرتها أداة فحص المخطط عند الفحص (لقطة تقريبية وليست جردًا تجاريًا معتمدًا): 10 businesses، 10 branches، 10 marketing provider profiles، 33 user memberships، 965 public directory listings، 49 catalog items، 30 catalog item prices. ظهرت orders وbusiness_subscriptions وwallet_accounts وwallet_transactions بلا صفوف في نتيجة الفحص.

لا تثبت هذه الأعداد أن كل سجل منشور أو موثق أو مملوك؛ يجب أن تحكم سياسات النشر والملكية وحالة التحقق كل واجهة.

## 2. نتيجة فحص مصدر V6

النسخة المستخرجة من الأرشيف الأصلي `bizcatalog-manager (5)(1).zip` تحتفظ ببنية React 19 / TypeScript / Vite 8 وملفات AI Studio وPWA.

- البصمة SHA-256 للأرشيف الأصلي: `ff5dae607ea876888068c7b66131bf12a1f1be0fd8a749f7690d311ce9cfe965`، وتطابق البصمة المسجلة.
- اختبار ZIP للأرشيف الأصلي: PASS، وعدد عناصره 150.
- فحص أمان مصدر العمل بعد تطبيق معالجة V6: `V6_SOURCE_SECURITY_AUDIT=PASS`.
- اختبارات معالجة الأمان: 2/2 PASS.
- اختبارات V6 الوحدوية: 49/49 PASS عبر مشغّل TypeScript للاختبارات.
- TypeScript syntax transpilation: يجب تسجيله كفحص نحوي فقط، وليس full type-check.
- `npm install` انتهى بمهلة التنفيذ في بيئة الفحص؛ لذلك full `tsc --noEmit` و`npm run lint` و`vite build` وBrowser/E2E لم يتم إثباتها.
- لم يتوفر مسار bytes معتمد لقراءة ملف ZIP الخاص بمرشح المعالجة الأمنية من Library؛ لذلك لا نسجل بصمة ZIP المرشح نفسه على أنها متحققة. نستخدم شجرة العمل المستخرجة ونوثق بصمتها المستقلة عند تجهيز حزمة آمنة جديدة.

### فجوة التكامل الحاسمة

لا يحتوي V6 حاليًا على عميل Supabase أو طبقة API موصولة بالمنظومة الحية. لا يظهر اعتماد `@supabase/supabase-js` في `package.json`، ولا استدعاء لعقود Supabase من مكونات V6. يعتمد `AppContext.tsx` على `localStorage`، ويضيف `INITIAL_BUSINESSES` و`INITIAL_PRODUCTS` عند التشغيل، ويحفظ المشتركين والمبيعات والإعدادات والمحافظ والرسائل والحملات في المتصفح. معالجة الأمان عطّلت الادعاء بأن هذه البيانات قاعدة إنتاج، لكنها لم تستبدل مصدر الحالة بقاعدة مشتركة.

**القرار:** يمنع عرض Seed records على أنها بيانات حقيقية، أو استخدام Local Storage كمصدر صلاحيات/ملكية/محافظ/مبيعات/اشتراكات/طلبات. يجب فصل Preview fixtures عن Runtime Production قبل فتح V6 للمستخدمين الحقيقيين.

## 3. خريطة الكيانات والحقول

| كيان V6 / الشاشة | مصدر الحقيقة الحالي | العقد المستخدم | ملاحظات التحويل |
|---|---|---|---|
| نشاط الدليل المنشور | `businesses` + `marketing_provider_profiles` + `branches` وحقول `settings.catalog_profile` | Edge `public-catalog-directory` v17، GET فقط | يعيد الأنشطة المسموح بنشرها فقط، بيانات الملف العام والفروع والمنتجات والأسعار المسموح عرضها. لا يعيد كل إعدادات المنصة. |
| دليل القوائم المحلية الخارجية/غير المطالب بها | `public_directory_listings` | Edge `directory-listings` v16، GET | يعيد المنشور فقط، مع `is_verified` محسوبة من وجود reviewer ولا يكشف UUID المراجع. يدعم Keyset cursor عبر `created_at,id` و`nextCursor/hasMore`. يرسل V6 `limit=20` حتى لو كان افتراضي الخادم 100. |
| مطالبة المالك بسجل دليل | `directory_listing_claim_requests` + `user_memberships` | `directory-listings` POST actions: `CLAIM_LISTING`, `REVIEW_CLAIM` | تتطلب Bearer حقيقيًا، تحقق `auth.getUser` وصلاحية عضوية/إدارة؛ لا تمنح الملكية بمجرد إدخال رقم هاتف. |
| ملف صاحب النشاط | `businesses.settings.catalog_profile` + `marketing_provider_profiles` + `branches` | `catalog-admin` v20: `CATALOG_READ`, `BUSINESS_PROFILE_UPSERT` | ملف الأعمال الأساسي مخزن جزئيًا داخل JSON settings؛ الفرع هو مصدر الهاتف/العنوان التشغيلي حسب العقد. تحديث الملف يمر عبر RPC الخلفي `upsert_catalog_business_profile_backend`. |
| المنتجات والخدمات | `catalog_items` | `catalog-admin` v20: `CATALOG_READ`, `ITEM_UPSERT`, `ITEM_STATUS_UPDATE` | `id, tenant_id, business_id, branch_id, item_type, name_ar/name_en, description, sku, status, tax_rate, metadata`. لا تحول سجل الخدمة إلى جدول منتج منفصل. |
| أسعار المنتجات والخدمات | `catalog_item_prices` | `catalog-admin` v20: `PRICE_UPSERT`, `ITEM_PRICE_UPSERT` | السعر كيان مستقل بإصدار وتاريخ سريان وفرع؛ يجب احترام سعر الفرع مقابل السعر العام وألا تُدمج الأسعار داخل seed product. |
| خيارات المنتج | `catalog_item_options` | يعاد ضمن `CATALOG_READ` | خيارات مستقلة مرتبطة بـ`catalog_item_id`، وليست حقولًا ثابتة في كائن V6 Product. |
| الفروع | `branches` | `CATALOG_READ` وملفات إدارة الكتالوج | كل فرع مقيد بـtenant وbusiness. لا تستخدم فرعًا أرسله المتصفح دون إعادة التحقق من تبعيته للنشاط والمستأجر. |
| الدخول والعضويات والصلاحيات | Supabase Auth + `user_memberships` | `api` الحالي لمسار `/api/v1/me`، وعقود Edge المخصصة | العضوية النشطة تحدد `user_id, tenant_id, organization_id, business_id, branch_id, role, permissions`. قيمة role في Local Storage أو V6 Subscriber ليست إثبات صلاحية. |
| إدارة المنصة | `tenants`, `businesses`, `user_memberships`, `audit_logs` | Edge `catalog-platform-admin` v23 | `verify_jwt=true` ويتطلب platform-scoped membership. لا يستبدل هذا العقد بصلاحية مخفية في الواجهة. |
| تسجيل نشاط جديد ومراجعته | `businesses`, `branches`, `user_memberships`, `provider_onboarding_requests` | `business-register` v9 و`business-approval` v6 | لا يُنشر النشاط تلقائيًا؛ الحالة والاشتراك وقرار المراجعة تحددها الخدمة الخلفية. |
| الطلبات | `orders` + `order_status_history` | `order-create` v8 و`order-status-update` v4 | يجب أن يحسب الخادم الأسعار والضرائب والخصومات والتوصيل من snapshot موثوق؛ لا تقبل مبالغ من V6 كحقيقة. |
| الدفع | `payment_intents`, `payment_events`, `tenant_payment_methods` | `payment-intent` v8 و`paymob-webhook` v10 | لا يُفعّل Paymob في V6 لمجرد وجود واجهة. التحقق من توقيع webhook وidempotency والتسوية وبوابة الدفع مستقل. |
| اشتراكات النشاط | `business_subscriptions`, `subscription_payment_intents`, `subscription_tier_prices` | `subscription-start-trial` v3 و`subscription-payment-intent` v4 | لا تقرأ/تكتب الاشتراك من كائن Business المحلي أو localStorage. |
| الموظفون والتوظيف | `business_job_positions`, `business_employees`, `job_applications` | يحتاج جردًا نهائيًا لعقود Edge/RPC لكل عملية | صلاحيات الموظف مرتبطة بالنشاط/الفرع وقالب الصلاحيات؛ لا تكتفِ بإخفاء عناصر الواجهة. |
| الإعلانات | `ad_spaces`, `advertisements` | الاعتماد على عقد إدارة إعلانات مصرح به بعد إغلاق #611 و#612 | لا توجد كتابة عامة مباشرة. فحص ACL وRLS وعزل النشاط/الفرع ما زال شرطًا. |
| المحافظ والقيود المالية | `wallet_accounts`, `wallet_transactions`, `general_ledger`, `journal_entries` وغيرها | RPC/Edge المالية الخلفية فقط | V6 لا تنشئ أرصدة ابتدائية ولا تسجل محاسبة في المتصفح. تبقى الوظائف المالية مغلقة حتى اجتياز ledger/idempotency/reconciliation/RBAC. |
| الدعم والإشعارات والرسائل | `support_tickets`, `notifications`, `push_subscriptions` | لا تعتمد على مخازن الذاكرة في V6 | توجد سجلات/جداول خلفية، لكن يلزم فحص عقد كل كتابة وقراءة قبل توصيل الشاشة. |

## 4. عقود Edge Function التي تم فحص مصدرها الحي

### `public-catalog-directory` v17
- الحالة ACTIVE، و`verify_jwt=false`؛ هذه واجهة قراءة عامة فقط، وليست واجهة كتابة.
- تقبل GET/OPTIONS فقط، ومصدرها يستخدم service key داخل الخادم.
- لا تُظهر إلا الأنشطة ذات `catalog_public_enabled=true` أو Showcase رسمي.
- تعيد حتى 100 نشاطًا في استدعاء واحد، حتى 150 عنصر كتالوج للنشاط، وأسعارًا محدودة؛ لا يوجد cursor pagination. لا تستخدمها كمصدر وحيد لدليل وطني متزايد الحجم.
- تخفي السعر إذا كانت `metadata.catalog_public.show_price=false`، ولا تعيد إعدادات الدفع/المخزون الخاصة.

### `directory-listings` v16
- الحالة ACTIVE، و`verify_jwt=false`، لكن POST يتحقق يدويًا من Bearer token عبر `auth.getUser` ومن العضويات والصلاحيات.
- GET يقتصر على `listing_status=PUBLISHED`.
- pagination ثابتة باستخدام `created_at,id`; يطبق البحث والفلاتر في SQL قبل LIMIT.
- الخادم يقبل `limit` من 1 إلى 100؛ على V6 إرسال 20 لكل صفحة، ثم استعمال `nextCursor`.
- لا تكشف حقول reviewer/claim الخاصة؛ `is_verified` قيمة Boolean مشتقة.

### `catalog-admin` v20
- الحالة ACTIVE و`verify_jwt=false` على مستوى إعداد Function، لكن الكود يتحقق يدويًا من Bearer/Auth/active memberships، ثم يقيّد tenant/business/branch.
- العمليات التي ظهرت في المصدر: `BUSINESS_LIST`, `CATALOG_READ`, `BUSINESS_PROFILE_UPSERT`, `ITEM_PRICE_UPSERT`, `ITEM_STATUS_UPDATE`, `WAREHOUSE_CREATE`, `STOCK_ADJUST`, `ITEM_UPSERT`, `PRICE_UPSERT`, `SETTINGS_UPSERT`.
- عمليات الكتابة تستخدم RPCs خلفية؛ لا تستبدلها بـdirect REST insert/update.

### `catalog-platform-admin` v23
- الحالة ACTIVE و`verify_jwt=true`.
- يتحقق من عضوية platform-scoped وtenant المصرح قبل إدارة الأنشطة والعضويات؛ يحافظ على audit.
- مخصص للوحة إدارة المنصة، لا للعميل أو صاحب النشاط العادي.

### عقود أخرى
تم التحقق من وجود/إصدارات: `business-register` v9، `business-approval` v6، `order-create` v8، `order-status-update` v4، `payment-intent` v8، `paymob-webhook` v10، `subscription-start-trial` v3، `subscription-payment-intent` v4. تسجيل وجود الوظيفة وإصدارها لا يساوي اجتياز اختبار E2E لجميع مساراتها.

## 5. قواعد Mapping داخل V6

1. استخدم Adapter/DTO layer بين الكائنات الحالية لـV6 والعقود الفعلية؛ لا تجعل `Business` أو `Product` شكل API مباشرًا.
2. `Business.id` يجب أن يحمل UUID الفعلي من `businesses.id` عند كونه نشاطًا مسجلًا؛ لا تمزج UUID سجل دليل خارجي مع UUID نشاط تجاري في مساحة المعرفات نفسها.
3. حوّل الاسم/الاسم المختصر/القطاع/النبذة والصور والموقع من `marketing_provider_profiles` و`businesses.settings.catalog_profile` والفرع وفق قواعد موثقة، ولا تُنشئ بيانات فوترة من قيم افتراضية.
4. `Product` في V6 يتطلب `price` واحدًا، بينما المصدر الفعلي يفصل `catalog_items` عن `catalog_item_prices` و`catalog_item_options`. يجب إنشاء view model تجميعي يحترم branch/effective dates/quote-only flags.
5. اعرض النشاط الموثق قبل غير الموثق، واحتفظ بمصدر السجل وحق النشر وحالة claim؛ لا تمنح Verified من مجرد وجود سجل أو ملف تجريبي.
6. ترتيب العرض المطلوب يظل النشاط ثم التخصص مباشرة. لا تضف طبقة واجهة باسم «المجموعات الوظيفية»؛ حقول التصنيف الخلفية تبقى metadata/filters إذا احتاجها عقد المصدر.
7. ابدأ الدليل بـ20 نتيجة، «رؤية المزيد» بصفحات لاحقة، واستخدم cursor؛ لا تحمّل 965 سجلًا أو كامل الدليل دفعة واحدة.
8. استخدم Supabase Auth session حقيقية. لا تستنتج role من `localStorage` ولا من `Subscriber.password`.
9. كل write يرسل access token، ويتحقق الخادم من المستخدم والعضوية والنطاق؛ لا تقم بأي write مالي من المتصفح.
10. أوقف seed business/product/subscriber fixtures في Production runtime. يمكن استخدامها للاختبارات والمعاينة المنفصلة فقط.

## 6. ترتيب التنفيذ التالي

1. اعتماد هذا العقد كخريطة مصدر قبل كتابة أي Adapter.
2. إضافة عميل Auth/Edge موحد إلى V6 من خلال متغيرات بيئة عامة غير سرية؛ لا تستخدم service_role أو secret key في المتصفح.
3. تنفيذ Read-only adapters أولًا: directory listings (20/keyset)، business profiles، catalog items/prices/options، membership bootstrap.
4. إضافة تطابق ترجمة/اختبارات DTO مع عينة حقيقية منقّحة من البيانات، مع عدم نسخ بيانات المستخدمين أو المالية إلى repository.
5. استبدال مصادر العرض المحلية في AppContext بمصدر read adapter، وفصل Preview fixtures عن Production.
6. بعد نجاح القراءة والـAuth/RBAC، تنفيذ كتابات ملف النشاط والكتالوج عبر `catalog-admin` فقط.
7. توصيل الطلبات والاشتراكات ثم الوحدات المالية كل على حدة بعد اختبارات idempotency/authorization/reconciliation.
8. تشغيل TypeScript/lint/build وE2E وtenant/branch isolation ثم Preview وRollback. لا cutover قبل اعتماد كل بوابة.

## 7. الحالة

- Backend inventory: READ-ONLY INSPECTED.
- Current V6 Supabase adapter: NOT IMPLEMENTED.
- V6 public directory read adapter: NOT IMPLEMENTED.
- V6 Auth/session/active membership adapter: NOT IMPLEMENTED.
- V6 shared writes: BLOCKED.
- Payment/finance enablement: BLOCKED.
- Production cutover: NOT AUTHORIZED.
