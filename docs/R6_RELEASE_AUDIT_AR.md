# MantiqatiX R6 — تقرير التدقيق الفني وبوابة الإطلاق

**التاريخ:** 10 نوفمبر 2026  
**المصدر المعتمد:** `bizcatalog-manager (6).zip` من Google AI Studio  
**SHA-256 للأصل:** `c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`  
**SHA-256 للحزمة المنظفة:** `a87bfc9e80a155277e1f35d8fb29ccff159eba9c31a6f00ffc35eee555e36241`

## القرار

- R6 هي المصدر الوحيد لتطوير واجهة الويب الجديدة. ملفات RC40 والملفات الأقدم مراجع لوظائف ناقصة فقط.
- الأصل الخام غير صالح للنشر المباشر.
- الحزمة المنظفة مهيأة لمعاينة عامة معزولة للقراءة فقط، وليست نسخة إنتاج.
- الحزمة لم تُستورد بعد داخل مجلد التطبيق بفرع GitHub، ولم يثبت build أو deploy.
- لا تعديل على `main` أو قاعدة Supabase الإنتاجية.

## حقائق مؤكدة من المصدر

- الويب مبني باستخدام React 19 وTypeScript وVite 8، والخادم Express في `server.ts`.
- تخزين الحالة في الأصل ملف JSON محلي: `.data/production-live-db.json` مع عمليات كتابة عبر `fs.writeFileSync`.
- لم يظهر في ملفات `src` والخادم و`package.json` المفحوصة أي Supabase client أو `@supabase/supabase-js` أو Google OAuth متكامل.
- تسجيل الدخول المعروض يعتمد على دوال محلية في `AppContext`.
- يوجد 12 ملف اختبار `*.test.ts`، لكن `package.json` الأصلية لا تحتوي أمر `test`، وتحتوي `lint` و`build`.
- لا يوجد مصدر Android داخل حزمة R6 للويب؛ يجب الحفاظ على مشروع الموبايل المرجعي خارج هذه الحزمة وعدم حذفه.

## موانع الإطلاق P0

### 1. المصادقة والتفويض على الخادم
لا يوجد middleware مركزي ظاهر للتحقق من الهوية والصلاحيات يحيط بمسارات API. مسار `POST /api/auth/session-token` يأخذ `userId` و`role` و`businessId` من جسم الطلب ويصدر رمزًا للدور المطلوب، مع افتراضي `super_admin`، دون تحقق اعتماد خادمي قبل الإصدار. توجد كذلك مسارات قراءة وكتابة وحذف للأنشطة والمنتجات والمشتركين والمبيعات والمحافظ والإعلانات والرسائل والفوترة والنسخ الاحتياطي.

**القرار:** لا يجوز فتح API الأصل الخام على الإنترنت أو ربطه ببيانات حقيقية حتى إعادة بناء Auth وRBAC والتحقق من ملكية كل سجل، ثم اختبار رفض الوصول غير المصرح به.

### 2. مفاتيح توقيع افتراضية ثابتة
يحتوي `server.ts` على قيم fallback ثابتة لـ `PAYMOB_HMAC_SECRET` و`SESSION_JWT_SECRET`، وتتكرر قيم ثابتة في `.env.example` لمفاتيح JWT/HMAC والنسخ الاحتياطي. يجب حذف القيم الثابتة، وفرض فشل تشغيل Production عند غياب أسرار قوية، وتدوير أي سر سبق استخدامه في بيئة عامة.

### 3. بيانات تشغيل داخل الأرشيف الخام
الأصل يحتوي مجلد `.data` يتضمن `production-live-db.json` وملفي Backup. لم تُضمّن هذه الملفات في الحزمة المنظفة. يمنع رفعها إلى GitHub أو نقلها إلى Preview أو إلى قاعدة جديدة. أي استخدام لبيانات الدليل يتطلب مراجعة خصوصية وملكية واعتمادًا.

### 4. تخزين محلي غير مناسب للإنتاج
ملف JSON المحلي لا يوفر قاعدة مشتركة ومعاملات وعزلًا وتزامنًا مناسبًا لتشغيل تجاري متعدد النسخ. كما أن قرص Cloud Run المؤقت يُحذف عند إيقاف الـ instance ولا يُشارك بين النسخ؛ لذلك لا يصلح هذا التخزين مصدرًا دائمًا على Cloud Run. يلزم Backend دائم مثل Supabase/Postgres بعد مراجعة المخطط والترحيلات وRLS.

## حماية Preview المجهزة

الحزمة المنظفة تستبعد `.data/` و`.data-preview/` و`.aistudio/` وملفات البيئة المحلية والإنتاجية. مسار الاستيراد يطبق أربع مراحل:

1. `harden_r6_preview.py`: يسمح فقط بـ GET `/api/health` و`/api/businesses` و`/api/products` في Preview؛ ويرفض بقية المسارات والكتابات.
2. `finish_r6_preview_isolation.py`: يعزل التخزين المحلي ويصفر بيانات مالية في Preview ويوقف Service Worker.
3. `finish_r6_preview_core.py`: يزيل المستخدمين التجريبيين وكلمات المرور المحلية ويجعل Preview زائرًا فقط ويبني قاعدة بداية نظيفة للدليل والكتالوج.
4. `finish_r6_preview_cleanups.py`: يصفر الأرصدة والمنح والبيانات الوهمية للحملات وPixel والقياسات ويمنع استعادة snapshots قديمة.

هذه الضوابط خاصة بالمعاينة؛ لا تمثل شهادة أمان للإنتاج ولا بديلًا عن Auth/RLS. تظل عمليات الكتابة معطلة في Preview، ولا تُستخدم قاعدة Supabase الإنتاجية.

## GitHub وCI

- فرع المعاينة: `preview/bizcatalog-manager-6-isolated`.
- مجلد التطبيق `apps/bizcatalog-manager-6-preview/` غير موجود حتى آخر فحص.
- آخر CI: Run ID `42710989197`، وفشل في خطوة التحقق من وجود `package.json` داخل مجلد التطبيق.
- لم تبدأ خطوات تثبيت Bun أو TypeScript check أو الاختبارات أو Vite build أو Docker build.
- لا يوجد رابط Preview حي مثبت.

روابط:
- [فرع Preview](https://github.com/islamnagy2022-eng/MantiqaTix/tree/preview/bizcatalog-manager-6-isolated)
- [آخر CI](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42710989197)
- [حالة النشر](https://github.com/islamnagy2022-eng/MantiqaTix/blob/preview/bizcatalog-manager-6-isolated/PREVIEW_DEPLOYMENT_STATUS.md)
- [مراجعة الأمان](https://github.com/islamnagy2022-eng/MantiqaTix/blob/preview/bizcatalog-manager-6-isolated/R6_PREVIEW_SECURITY_REVIEW.md)

## TODO — ترتيب التنفيذ

1. **استيراد الحزمة النظيفة إلى فرع Preview فقط:** مطابقة SHA-256 وظهور package.json وserver.ts وDockerfile وbun.lock داخل مجلد التطبيق.
2. **إغلاق CI:** نجاح install من lockfile وTypeScript و12+ اختبارات الوحدة وVite build وDocker build.
3. **اختبار Preview:** health check، الدليل والكتالوج، رفض أي كتابة، عدم ظهور مستخدمين أو أرصدة أو بيانات قديمة، والتأكد من عدم الاتصال بقاعدة الإنتاج.
4. **Backend مستقل:** قاعدة ومشروع Preview مستقلان، migrations مراجعة، مخطط وعلاقات وفهارس ونسخ احتياطي.
5. **Auth:** Supabase Auth وGoogle OAuth بإعدادات معتمدة، callback وrefresh وlogout واستعادة الحساب.
6. **Authorization:** RBAC وRLS وعزل النشاط/المؤسسة، أقل صلاحية، منع IDOR، واختبارات سلبية لكل دور.
7. **تفعيل الوظائف تدريجيًا:** CRM والطلبات والرسائل والمحافظ والحسابات والتسويق والإشعارات عبر API خادمي يتحقق من المدخلات والهوية والملكية، مع معاملات وidempotency للدفع والويبهوكس.
8. **QA وأمان:** unit/integration/e2e، dependency/secrets scan، rate limiting وCSRF/CORS وsecurity headers واختبار اختراق.
9. **تعافٍ وتشغيل:** نسخ احتياطي خارجي مشفر ومجدول، تجربة restore، RPO/RTO، مراقبة وتنبيهات وخطة rollback.
10. **Cutover منفصل:** لا دمج إلى `main` ولا تحويل نطاق الإنتاج إلا بعد اعتماد الاختبارات والبيانات والنسخ الاحتياطي وخطة الرجوع.

## مفاتيح Supabase
لا نخترع OAuth credentials ولا نستخدم قاعدة الإنتاج للمعاينة. استخدم Publishable key في المتصفح مع RLS، وSecret key على الخادم فقط لأنه يتجاوز RLS. توصي وثائق Supabase الحالية بالمفاتيح الجديدة `sb_publishable_...` و`sb_secret_...` بدل `anon` و`service_role` القديمة.

## حدود الاختبار
لم يثبت build محلي في بيئة المراجعة: Bun وDocker غير مثبتين، ومحاولة تنزيل حزم npm تعطلت بسبب DNS إلى `registry.npmjs.org`. لذلك لا أعتبر البناء أو الاختبارات ناجحة. بوابة CI بعد استيراد التطبيق هي الاختبار التالي.

## الحكم
**R6 CLEAN PREVIEW SOURCE PREPARED — IMPORT PENDING — CI BLOCKED BEFORE BUILD — NOT DEPLOYED — NOT PRODUCTION READY.**

مراجع تقنية:
- https://docs.cloud.google.com/run/docs/configuring/services/ephemeral-disk
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/postgres/row-level-security
