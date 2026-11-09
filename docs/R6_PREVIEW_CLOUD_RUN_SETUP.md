# إعداد نشر R6 Preview على Google Cloud Run

هذا الإعداد خاص بفرع `preview/bizcatalog-manager-6-isolated` ولا يغير نشر الموقع الأساسي.

## GitHub Environment

أنشئ Environment باسم `r6-preview` في إعدادات المستودع، ثم أضف:

### Secrets المطلوبة

- `GCP_PROJECT_ID`: معرف مشروع Google Cloud المخصص للتجربة.
- `GCP_WIF_PROVIDER`: اسم Workload Identity Provider الكامل.
- `GCP_DEPLOYER_SERVICE_ACCOUNT`: بريد Service Account المخصص للنشر.

### Variables الاختيارية

- `GCP_REGION`: الافتراضي `europe-west1`.
- `CLOUD_RUN_PREVIEW_SERVICE`: الافتراضي `mantiqatix-r6-preview`.

## الصلاحيات المطلوبة

استخدم Workload Identity Federation ولا تضع مفتاح Service Account JSON داخل GitHub.
يحتاج حساب النشر إلى صلاحيات نشر Cloud Run وبناء المصدر، وتمرير Service Identity المحددة للخدمة.
يجب أن يكون مشروع Google Cloud وبياناته منفصلين عن الإنتاج.

## التشغيل

بعد استيراد المصدر المنظف إلى:
`apps/bizcatalog-manager-6-preview/`

سيبدأ Workflow تلقائياً عند دفع التغييرات إلى فرع Preview، أو يمكن تشغيله يدوياً من GitHub Actions.

الخدمة تنشر مع:
- `PREVIEW_MODE=true`
- `VITE_PREVIEW_MODE=true`
- `NODE_ENV=production`

لا تضع مفاتيح Paymob أو بيانات إنتاج أو مفاتيح Supabase Production في هذا Environment.

## قيد مهم

وجود Workflow لا يعني أن التطبيق نُشر. لا يظهر رابط صالح إلا بعد نجاح استيراد المصدر، وتوفر أسرار GCP، ونجاح نشر Cloud Run والتحقق من عنوان الخدمة.
