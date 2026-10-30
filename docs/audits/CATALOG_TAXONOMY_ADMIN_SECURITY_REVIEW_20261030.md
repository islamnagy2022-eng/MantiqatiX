# تقرير تأمين إدارة التصنيفات — MantiqatiX

**التاريخ:** 30 أكتوبر 2026  
**PR:** [#540](https://github.com/islamnagy2022-eng/MantiqatiX/pull/540)  
**الفرع:** `security/catalog-taxonomy-admin-guardrails-20261030`  
**نطاق التغيير:** إدارة التصنيفات داخل الكتالوج فقط. واجهة الدليل والمتجر العام لم تتغير.

## 1. ما تم تنفيذه

### RC459 — معاينة وربط التصنيفات وإعادة توزيع السجلات
أضيفت migration أمامية فقط:
`supabase/migrations/20261030130000_rc459_secure_taxonomy_mapping_preview_commit.sql`

تشمل:
- معاينة read-only تُرجع أعداد الأنشطة وسجلات الدليل وعينة محدودة وبصمة للبيانات.
- حفظًا ذريًا يعيد التحقق من البصمة ويرفض المعاينة القديمة.
- أقفالًا داخل المعاملة تمنع التغييرات المتزامنة أثناء إعادة التحقق والحفظ.
- تحديث الحقول التصنيفية فقط في النشاط والدليل.
- سجل تدقيق immutable يحفظ قبل/بعد الحقول التصنيفية التي تم تغييرها، دون نسخ إعدادات النشاط الكاملة.
- RPCs مقيدة بـ `service_role` فقط، مع رفض EXECUTE المباشر من `anon` و`authenticated`.

أضيفت قائمة خادمية تضم 226 تصنيفًا canonical مع النوع المحدد لكل تصنيف (activity/profession)، وتتم مطابقتها آليًا مع مصدر `productionDefaults.ts`.

**تصحيح اتساق مهم:** النقل يحدث الآن `activity_category_id` مع `activity_category_code` و`activity_group_code` و`activity_classification_type`. كما دخل المعرف المستقر في بصمة المعاينة ولقطة التدقيق، حتى لا ينتقل النشاط ويظل معروضًا بمعرف التصنيف القديم.

### RC460 — تدقيق تعريفات التصنيفات نفسها
أضيفت migration:
`supabase/migrations/20261030150000_rc460_taxonomy_definition_audit.sql`

- Trigger بعد INSERT/UPDATE على `bizcatalog_platform_settings` يسجل تغييرات `categories` و`functionalGroups` و`defaultCategories` فقط.
- تغييرات إعدادات المنصة الأخرى لا تولد ضوضاء في سجل taxonomy.
- سجل التدقيق يكتب داخل معاملة حفظ الإعدادات نفسها؛ فشل تسجيل التدقيق يؤدي إلى التراجع عن حفظ الإعدادات.
- Trigger قاعدة البيانات يعيد التحقق من أن `updated_by` يملك عضوية SUPER_ADMIN نشطة بنطاق PLATFORM كامل. لا يقبل actor غير موجود في الصلاحيات أو هوية مزيفة.
- سجل التعريفات محمي بـ FORCE RLS، ولا توجد صلاحيات وصول مباشرة لـ `public` أو `anon` أو `authenticated` أو `service_role`.
- سجل التدقيق غير قابل للتعديل أو الحذف. إزالة تصنيف من مصفوفة الإعدادات تسجل كتحديث يحفظ قبل/بعد.

### حفظ هوية التصنيف عبر دورة النشاط
- إنشاء النشاط يرسل `activityCategoryId` إلى الخادم.
- الخادم يتحقق من المعرف والمجال ونوع التصنيف، ويحفظ `activity_category_id` والرمز canonical عند انطباقه.
- الدليل العام وصفحة النشاط يعيدان المعرف الآمن، ومحوّل البيانات يحافظ عليه أثناء hydration.
- التصنيف المخصص يتبع صيغة `cat_custom_<UUID>`; الحماية تمنع حذفه أو نقله عند وجود سجلات تستخدمه.

### واجهة الإدارة
تمت إضافة لوحة داخل تبويب التصنيفات الحالي تتيح معاينة العدد والعينة، وإلغاء المعاينة، وإعادة المعاينة، ثم التأكيد الصريح. لم تتغير واجهات العملاء العامة.

## 2. الصلاحيات والضمانات
- Edge Function تتحقق من جلسة Auth وعضوية SUPER_ADMIN النشطة بنطاق PLATFORM/full_control.
- RPCs تعيد التحقق من هوية المستخدم وعضويته داخل قاعدة البيانات.
- RC460 يتحقق مرة أخرى من صلاحية actor داخل Trigger إعدادات المنصة قبل تسجيل التغيير.
- لا تعتمد الحماية على إظهار أو إخفاء الأزرار فقط.
- لا تتغير الملكية أو الاشتراكات أو التوثيق أو النشر أو الهاتف أو الصور أو التخصص الدقيق أثناء إعادة توزيع التصنيفات.

## 3. الاختبارات
نجح checkpoint سابق على الالتزام `fe237e2375e2cb7ccd9a7c746c7ad28ba335712f`:

| الفحص | النتيجة السابقة | التشغيل |
|---|---|---|
| RC459 PostgreSQL integration | PASS | [41024457491](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457491) |
| Primary catalog build/typecheck/validators | PASS | [41024457221](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457221) |
| Browser E2E including preview/cancel/confirm | PASS | ضمن [41024457221](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457221) |
| Full isolated forward migration replay | PASS | [41024457214](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457214) |
| Migration uniqueness/history/collision | PASS | [41024457047](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457047), [41024457464](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457464), [41024457247](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457247) |
| Backend module/database integrations | PASS | [41024457230](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41024457230) |

بعد ذلك أضيفت تغييرات إضافية يجب عدم اعتبارها مغطاة تلقائيًا بنتائج checkpoint السابق:
- فصل اختبار رفض SUPER_ADMIN ذي نطاق النشاط عن ذي نطاق الفرع.
- RC460 definition audit.
- رفض actor غير مخول داخل trigger قاعدة البيانات.
- اختبار إزالة تعريف تصنيف مع حفظ before/after.
- تحديث RC459 ليغير `activity_category_id` مع باقي حقول التصنيف.

**الحالة الحالية للاختبارات:** إعادة التحقق على أحدث HEAD مطلوبة بعد هذه التغييرات. تشغيلات GitHub Actions الأحدث أُنشئت، ولم تُعامل كنجاح حتى تظهر نتيجة نهائية ناجحة.

## 4. ما يزال مفتوحًا
1. إكمال إعادة التحقق على أحدث HEAD لكل من RC459 وRC460، وPrimary Catalog build/browser E2E، وforward migration replay، وmigration guards.
2. أداة إعادة التوزيع الحالية تشمل التصنيفات canonical فقط. دعم نقل التصنيفات المخصصة `cat_custom_<UUID>` ما زال TODO؛ حذف التصنيف المخصص المستخدم مرفوض حاليًا.
3. مراجعة بشرية للتغييرات قبل الدمج.
4. تطبيق migrations ونشر Edge Functions يتطلبان release plan مع backup/restore/rollback وموافقة صريحة.

## 5. حد الإنتاج
- لم تُطبق RC459 أو RC460 على Supabase Production.
- لم تُنشر Edge Functions على Production.
- لم تتغير بيانات الأنشطة أو الدليل أو إعدادات المنصة في Production.
- لم تحدث إعادة توزيع جماعية لأي بيانات.
- مهام النشر المرتبطة بالـ PR لا تمثل نشرًا إنتاجيًا؛ النشر يظل محجوبًا عن هذا العمل.
- بوابة جاهزية MantiqatiX الكاملة تظل **BLOCKED / NOT CERTIFIED**.

**الحالة:** RC459 + RC460 IMPLEMENTED ON FEATURE BRANCH / FINAL-HEAD VALIDATION PENDING / PRODUCTION UNCHANGED.
