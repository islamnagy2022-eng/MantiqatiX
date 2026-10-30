# تقرير تأمين إدارة التصنيفات — MantiqatiX
**التاريخ:** 30 أكتوبر 2026  
**الفرع:** `security/catalog-taxonomy-admin-guardrails-20261030`  
**PR:** [#540](https://github.com/islamnagy2022-eng/MantiqatiX/pull/540)  
**حد الإنتاج:** لا توجد تغييرات Production نُفذت ضمن هذا العمل.

## 1. نطاق المراجعة والمخاطر الأصلية
شملت المراجعة:
- `apps/catalog-frontend/src/components/admin/AdminDashboard.tsx`
- `apps/catalog-frontend/src/context/AppContext.tsx`
- `apps/catalog-frontend/src/data/productionDefaults.ts`
- `apps/catalog-frontend/src/lib/production.ts`
- `supabase/functions/catalog-platform-admin/index.ts`
- `supabase/functions/public-catalog-directory/index.ts`
- `supabase/functions/public-catalog/index.ts`

الملاحظات الأصلية:
1. كان تبويب التصنيفات موجودًا، لكنه لم يكن يوفر معاينة موثوقة لإعادة توزيع السجلات أو حفظًا ذريًا مرتبطًا بسجل تدقيق.
2. كان مسار `SAVE_SETTINGS` يعتمد على مدخلات إعدادات التصنيفات دون مستوى كافٍ من التحقق الهيكلي والمرجعي.
3. لم تكن هوية التصنيف المستقرة تُحفظ دائمًا عند إنشاء نشاط جديد، ما يصعّب تتبع استخدام التصنيفات المخصصة.
4. إخفاء عناصر الواجهة لا يكفي لحماية عملية إدارية؛ لا بد من فرض الصلاحية في Edge Function وقاعدة البيانات معًا.

## 2. التنفيذ المنجز على فرع المراجعة
### المعاينة وإعادة التوزيع
أضيفت migration أمامية فقط:
`supabase/migrations/20261030130000_rc459_secure_taxonomy_mapping_preview_commit.sql`

وتضيف:
- RPC للمعاينة لا يكتب أي بيانات، ويعيد عدد الأنشطة وعدد سجلات الدليل وعينة محدودة وبصمة للبيانات المقروءة.
- RPC للحفظ يعيد التحقق من البصمة ويرفض المعاينة القديمة، ثم ينفذ التعديل وسجل التدقيق داخل معاملة واحدة.
- أقفال معاملة تمنع التغييرات المتزامنة على جداول الأنشطة والدليل بين التحقق والحفظ.
- تحديث حقول التصنيف المحددة فقط. لا يُعاد بناء إعدادات النشاط أو الاشتراك ولا تتغير الملكية أو حالة النشر أو التوثيق أو الهاتف أو الصور أو التخصص الدقيق.

### الصلاحيات وحماية قاعدة البيانات
- RPCs متاحة لـ `service_role` فقط؛ لا يوجد EXECUTE مباشر لـ `anon` أو `authenticated`.
- Edge Function تتحقق من جلسة Auth ومن عضوية SUPER_ADMIN النشطة ذات النطاق `PLATFORM` والصلاحية الكاملة قبل استدعاء RPC.
- قاعدة البيانات تعيد فحص المستخدم والعضوية والنطاق داخل كل RPC، فلا تعتمد على إخفاء أزرار الواجهة.
- أضيفت قائمة خادمية تضم 226 معرف تصنيف canonical مع نوع كل منها (`activity` أو `profession`) ومطابقة آلية مع `productionDefaults.ts`.
- تُرفض المعرفات غير المعروفة أو التي لا يتوافق نوعها مع المصدر canonical.
- جدول `catalog_taxonomy_mapping_audit` يعمل مع FORCE RLS، ولا يملك مستخدمو API وصولًا مباشرًا إليه. سجل التدقيق غير قابل للتعديل أو الحذف، ويحتفظ بلقطة مقتصرة على حقول التصنيف التي تغيرت.

### حفظ هوية التصنيف أثناء إنشاء النشاط وعرضه
- إرسال `activityCategoryId` عند إنشاء النشاط.
- تحقق خادمي من التصنيف والمجال والنوع، مع دعم معرفات التصنيفات المخصصة المنشأة وفق صيغة `cat_custom_<UUID>`.
- حفظ `activity_category_id` والرمز canonical عند انطباقه.
- إعادة معرف التصنيف الآمن عبر واجهتي الدليل العام وصفحة النشاط، والحفاظ عليه في محوّل البيانات والتحميل المباشر.

### واجهة الإدارة
أضيفت لوحة داخل تبويب التصنيف الحالي، دون تغيير واجهة الدليل أو صفحة النشاط العامة. تتيح اختيار تصنيف مصدر وهدف، ثم معاينة عدد السجلات وعينة منها، وإلغاء المعاينة، وإعادة المعاينة، والتأكيد الصريح قبل الحفظ.

## 3. الاختبارات والأدلة
نجح التحقق على الالتزام `fe237e2375e2cb7ccd9a7c746c7ad28ba335712f`:

| الفحص | النتيجة | الدليل |
|---|---|---|
| RC459 isolated PostgreSQL integration | PASS | [41024457491](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457491) |
| Primary Catalog build + TypeScript + validators | PASS | [41024457221](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457221) |
| Browser E2E | PASS | ضمن [41024457221](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457221) |
| Full isolated forward migration replay | PASS | [41024457214](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457214) |
| Migration version uniqueness | PASS | [41024457047](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457047) |
| Cross-PR migration collision guard | PASS | [41024457247](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457247) |
| Migration history immutability | PASS | [41024457464](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457464) |
| Backend-only module boundary + database integrations | PASS | [41024457230](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457230) |
| Module professionalization / privacy validations | PASS | [41024457073](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457073) |

اختبار المتصفح سجّل نجاح التدفقات التالية ضمن مجموعة الاختبارات:
- رفض دخول الضيف إلى لوحة الإدارة.
- استعادة نطاق المالك والموظف وصلاحياتهم المقيدة.
- روابط النشاط الدائمة وQR.
- الموافقة على الموقع الجغرافي والرفض مع إبقاء البحث اليدوي متاحًا.
- روابط الصور الخارجية الموثقة.
- معاينة التصنيف ثم الإلغاء ثم معاينة جديدة ثم اعتماد التغيير.
- التنقل الهرمي للمجالات والتصنيفات والتخصص على شاشة هاتف 390px.

اختبار PostgreSQL شمل عدم الكتابة أثناء المعاينة، ورفض البصمة القديمة، ورفض المستخدمين غير المصرح لهم، وحفظ الحقول غير المستهدفة، والتراجع عن فشل مصطنع داخل المعاملة، وعدم قابلية سجل التدقيق للتعديل والحذف.

**قيد مهم:** أضيف بعد هذا التحقق توسيع إضافي لاختبار SUPER_ADMIN المرتبط بنشاط بصورة منفصلة عن SUPER_ADMIN المرتبط بفرع. هذا التوسيع وتحديث TODO والتقرير يحتاجان إعادة تشغيل exact-head على أحدث التزام قبل إغلاق المراجعة.

## 4. الأعمال التي ما زالت مفتوحة
1. إضافة سجل تدقيق ذري مستقل لعمليات إنشاء/تعديل/حذف تعريف التصنيفات نفسها عبر `SAVE_SETTINGS`. الحماية الحالية تمنع المعرفات غير الصالحة وحذف تصنيف مستخدم، لكن جدول RC459 يسجل عمليات إعادة توزيع السجلات فقط.
2. إعادة تشغيل الاختبارات على أحدث HEAD بعد تحديث مصفوفة صلاحيات النطاقات المنفصلة، وتسجيل النتائج النهائية.
3. مراجعة بشرية للتغييرات قبل الدمج.
4. تطبيق migration ونشر Edge Function لا يحدثان تلقائيًا؛ يتطلبان مسار إصدار مع backup/restore/rollback والموافقة المطلوبة.

## 5. حد الإنتاج
- لم تُطبق migration على Supabase Production.
- لم تُنشر Edge Function على Production.
- لم تُعدّل إعدادات المنصة أو سجلات الأنشطة أو الدليل في Production.
- لم تُجر عملية إعادة توزيع جماعي للبيانات.
- تشغيل Workflow النشر المرتبط بالـ PR اجتاز خطوات التحقق، لكن خطوة النشر نفسها كانت **SKIPPED**.
- لذلك لا تُعد هذه المراجعة تصريحًا بالدمج أو النشر، ولا تعني أن بوابة جاهزية MantiqatiX الكاملة قد أُغلقت.

**الحالة:** IMPLEMENTED ON FEATURE BRANCH / PRIOR EXACT-HEAD VALIDATION PASS / FINAL-HEAD RECHECK PENDING / PRODUCTION UNCHANGED.

## RC460 implementation
- Added `20261030150000_rc460_taxonomy_definition_audit.sql`.
- An AFTER INSERT/UPDATE trigger on `bizcatalog_platform_settings` records taxonomy definition snapshots only when `categories`, `functionalGroups`, or `defaultCategories` change. The settings row write and audit event are in one PostgreSQL transaction.
- The audit table has FORCE RLS, no direct grants to `public`, `anon`, `authenticated`, or `service_role`, and an append-only trigger rejecting UPDATE/DELETE. The trigger function uses SECURITY DEFINER and an empty search_path.
- Unrelated platform settings changes are intentionally not recorded. The audit stores taxonomy configuration snapshots, not unrelated settings or business data.
- Disposable PostgreSQL integration tests cover INSERT/UPDATE events, no audit noise for unrelated settings, append-only behavior, and rollback of the settings update if audit insertion fails.
- RC459 exact-head checks passed on `fe237e2375e2cb7ccd9a7c746c7ad28ba335712f`: build/typecheck, browser E2E, employee RBAC PostgreSQL, RC459 integration, migration collision/history guards, and full isolated forward migration replay. RC460 was added after that checkpoint and awaits fresh exact-head validation.
