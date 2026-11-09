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

آخر تشغيل لبوابة `R6 Preview Build`:
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

## ما بعد الاستيراد

عند ظهور مجلد التطبيق في الفرع:
1. يشتغل GitHub Actions تلقائياً.
2. يجب إصلاح أي أخطاء تثبيت أو TypeScript أو unit tests أو build.
3. لا يبدأ Cloud Run قبل نجاح البناء وتوفير بيئة GCP مستقلة وأسرار Workload Identity.
4. لا يتم تفعيل Google OAuth قبل وضع بيانات الاعتماد الحقيقية في إعدادات Supabase Auth/Secret Manager والتحقق من callback والجلسة.
5. لا تستخدم Supabase الإنتاجية كقاعدة Preview.

لا يوجد رابط معاينة حي حتى اجتياز البناء والنشر وفحص `/api/health`.
