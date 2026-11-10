# تسليم استيراد R6 — خطوة رفع المصدر الثنائي

التاريخ: 2026-11-10

## القرار

- مصدر التطبيق الوحيد: `bizcatalog-manager (6).zip` بعد التنظيف.
- فرع الاستيراد الوحيد: `preview/bizcatalog-manager-6-isolated`.
- لا تعديل على `main` ولا نشر إنتاجي في هذه المرحلة.
- لا استيراد لبيانات تشغيل قديمة ولا اتصال بقاعدة Supabase الإنتاجية.
- Android/mobile محفوظ خارج إعادة بناء واجهة الويب.

## الحزمة المعتمدة

اسم الملف: `bizcatalog-manager-6-preview-clean.zip`

SHA-256:
`a87bfc9e80a155277e1f35d8fb29ccff159eba9c31a6f00ffc35eee555e36241`

الحجم: 13,211,088 bytes. عدد الملفات: 117. تم فحص استبعاد مجلدات البيانات المحلية وملفات الأسرار.

## حالة CI

آخر تشغيل فشل تم التحقق من تفاصيله (قد توجد تشغيلات لاحقة لم تُراجع):
- Run ID: `42710989197`
- النتيجة: `failure`
- السبب الوحيد في الخطوة التي وصل إليها: غياب `apps/bizcatalog-manager-6-preview/package.json` لأن ZIP لم يدخل المستودع بعد.
- لم تبدأ خطوات Bun install أو typecheck أو الاختبارات أو Vite build أو Docker build.

الرابط:
https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42710989197

## أداة الاستيراد الجاهزة

تم إعداد حزمة نقل خارج المستودع باسم `mantiqatix-r6-import-kit.zip`. تحتوي ZIP المصدر وأداة Windows بنقرة مزدوجة وأداة macOS/Linux.

بعد فك الحزمة:
- Windows: شغّل `run-windows.bat`.
- macOS/Linux/Git Bash: شغّل `bash ./import-r6-preview.sh`.

تتحقق الأدوات من البصمة، تستنسخ فرع Preview وحده، تشغّل أربع مراحل تنظيف، ثم تضيف التطبيق وتدفع commit إلى فرع Preview فقط. يلزم Git وPython 3 ومصادقة GitHub بصلاحية كتابة.



## تحديث مراحل التنظيف

أصبحت مراحل إعداد Preview خمس مراحل بالترتيب: `harden_r6_preview.py`، `finish_r6_preview_isolation.py`، `finish_r6_preview_core.py`، `finish_r6_preview_cleanups.py`، ثم `finish_r6_preview_contact_guard.py`.

المرحلة الخامسة تزيل أرقام التواصل الافتراضية من مسارات المعاينة، وتمنع النقر على روابط الهاتف والواتساب والدفع في المتصفح التجريبي. تم فحصها محليًا على استخراج نظيف، لكن نتائجها التشغيلية داخل التطبيق ما زالت تنتظر CI بعد الاستيراد.

## ما بعد الاستيراد

عند ظهور مجلد التطبيق في الفرع:
1. يشتغل GitHub Actions تلقائياً.
2. يجب إصلاح أي أخطاء تثبيت أو TypeScript أو unit tests أو build.
3. لا يبدأ Cloud Run قبل نجاح البناء وتوفير بيئة GCP مستقلة وأسرار Workload Identity.
4. لا يتم تفعيل Google OAuth قبل وضع بيانات الاعتماد الحقيقية في إعدادات Supabase Auth/Secret Manager والتحقق من callback والجلسة.
5. لا تستخدم Supabase الإنتاجية كقاعدة Preview.

لا يوجد رابط معاينة حي حتى اجتياز البناء والنشر وفحص `/api/health`.

## مسار الاستيراد من المتصفح

تم إعداد Codespaces بملف `.devcontainer/devcontainer.json` ودليل عربي:
`docs/R6_CODESPACES_IMPORT_AR.md`

المسار:
1. افتح فرع Preview من Chrome.
2. أنشئ Codespace على الفرع نفسه.
3. ارفع `bizcatalog-manager-6-preview-clean.zip` إلى جذر Codespace.
4. شغّل:
   `bash scripts/import-r6-preview.sh bizcatalog-manager-6-preview-clean.zip`
5. بعد نجاح commit، احذف ملف ZIP من الجذر ثم نفّذ:
   `git push origin preview/bizcatalog-manager-6-isolated`

أداة Codespaces الحالية تتحقق من SHA-256 ومسارات ZIP والتكرار والروابط الرمزية وحد التوسع، وتنفذ المعالجة في مجلد مؤقت على نفس filesystem، ولا تنقل المجلد إلى التطبيق إلا بعد نجاح مراحل التحقق. تم فحص Bash syntax وZIP preflight محليًا؛ لم يتم تشغيل importer على GitHub فعليًا.

## بوابة الجودة المحدثة

بعد Docker build، يطلق CI حاوية Preview ويشغل `scripts/smoke_test_r6_preview.sh` لفحص Health والدليل والكتالوج ورفض الكتابة وواجهات الإدارة وترويسات الحماية. هذا الاختبار مضاف ولم يعمل بعد على التطبيق.

Workflow النشر يدوي فقط ويتطلب CI ناجحًا على SHA المطابق، ثم يتحقق من نشر نفس SHA.

