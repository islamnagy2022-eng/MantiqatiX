# استيراد R6 من المتصفح باستخدام GitHub Codespaces

هذه الطريقة لا تحتاج تثبيت Git أو Python على جهازك. Codespaces يفتح بيئة تطوير متصلة بفرع المعاينة، وأداة الاستيراد الموجودة في المستودع تنفذ الفحص والتنظيف قبل الـ commit.

## 1) افتح بيئة المعاينة

افتح هذا الرابط من متصفح Chrome:
https://github.com/islamnagy2022-eng/MantiqaTix/tree/preview/bizcatalog-manager-6-isolated

من زر **Code**:
1. افتح تبويب **Codespaces**.
2. اختر **Create codespace on preview/bizcatalog-manager-6-isolated**.
3. انتظر حتى يفتح محرر VS Code في المتصفح.

إذا لم يظهر تبويب Codespaces أو لم يسمح الحساب بإنشاء البيئة، لا ترفع الحزمة إلى `main`؛ استخدم الكمبيوتر مع أداة الاستيراد البديلة.

## 2) ارفع الحزمة المنظفة

داخل VS Code في المتصفح:
1. افتح Explorer.
2. من قائمة Explorer اختر **Upload Files**.
3. اختر الملف `bizcatalog-manager-6-preview-clean.zip` من Downloads.
4. ارفعه في جذر المشروع بجوار `package.json` و`scripts`، وليس داخل `apps` أو `scripts`.

بصمة الملف الصحيحة:

```text
a87bfc9e80a155277e1f35d8fb29ccff159eba9c31a6f00ffc35eee555e36241
```

لا ترفع ملفات `.data` أو `.env` أو أي backup.

## 3) نفّذ الاستيراد

افتح Terminal من قائمة Terminal ثم New Terminal. نفذ الأمر التالي:

```bash
git branch --show-current
```

يجب أن تكون النتيجة:

```text
preview/bizcatalog-manager-6-isolated
```

ثم نفذ:

```bash
bash scripts/import-r6-preview.sh bizcatalog-manager-6-preview-clean.zip
```

الأداة تتحقق من SHA-256، وترفض استبدال مجلد موجود، وتفحص محتويات ZIP، وتنفذ مراحل العزل الأربع، ثم تنشئ commit داخل مجلد التطبيق فقط.

إذا انتهى الأمر برسالة Import committed، ادفع الـ commit:

```bash
rm -f bizcatalog-manager-6-preview-clean.zip
git push origin preview/bizcatalog-manager-6-isolated
```

لا تستخدم `git push origin main` ولا تغير اسم الفرع.

## 4) تحقق من الاختبارات

افتح:
https://github.com/islamnagy2022-eng/MantiqaTix/actions

شاهد تشغيل **R6 Preview Build** على آخر commit. يجب أن تمر:
- Bun install من lockfile.
- TypeScript check.
- Unit tests.
- Vite build.
- Docker build.

عند الفشل، احتفظ برسالة الخطأ وسجل التشغيل؛ لا تبدأ النشر ولا تكرر استيراد المجلد فوق نفسه.

## 5) النشر التجريبي

النشر إلى Cloud Run ليس تلقائيًا. Workflow النشر يدوي ويتحقق بنفسه من وجود تشغيل **R6 Preview Build** ناجح على SHA المطابق تمامًا للـ commit الحالي. لا تشغّل **Deploy R6 Preview to Cloud Run** إلا بعد نجاح CI لنفس SHA وبعد إعداد أسرار GCP داخل GitHub Environment باسم `r6-preview`.

لا تستخدم Supabase الإنتاجية. لا يتم تغيير `main` ضمن هذا المسار.

## إذا توقف الاستيراد

انسخ أول رسالة خطأ ظاهرة في Terminal أو رابط تشغيل GitHub Actions وأرسلها هنا. لا ترسل كلمات مرور أو Tokens أو أسرار OAuth أو مفاتيح قواعد البيانات.
