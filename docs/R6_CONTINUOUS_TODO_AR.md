# MantiqaTix R6 — قائمة TODO التنفيذية المستمرة

**آخر تحديث:** 10 نوفمبر 2026  
**Baseline:** `bizcatalog-manager (6).zip` — R6 من Google AI Studio  
**فرع العمل:** `preview/bizcatalog-manager-6-isolated`  
**الإنتاج:** `main` — محمي ولا يُعدّل ضمن مراحل Preview

## معنى الحالات

- **PASS:** تحقق عمليًا بدليل حديث.
- **IMPLEMENTED:** الكود موجود، لكن قد يلزم اختبار التكامل.
- **NOT VERIFIED:** لا يوجد دليل اختبار كافٍ.
- **TODO:** لم ينفذ بعد.
- **BLOCKED:** لا يمكن إكماله قبل إزالة العائق المحدد.
- **WAIT:** ينتظر اعتمادًا أو إعدادًا خارجيًا.

وجود شاشة أو دالة أو ملف لا يثبت اكتمال الوظيفة.

## الحالة التنفيذية الحالية

| البند | الحالة | الدليل / العائق |
|---|---|---|
| اعتماد R6 كخط أساس | PASS | قرار المصدر موثق |
| تجهيز ZIP منظف | PASS | SHA-256 ثابت، واستبعاد بيانات التشغيل وملفات البيئة |
| مسار عزل Preview | IMPLEMENTED | أربع مراحل hardening تُشغل عند الاستيراد |
| استيراد التطبيق إلى GitHub | BLOCKED | مجلد `apps/bizcatalog-manager-6-preview/` غير موجود بعد |
| CI الكامل | BLOCKED | توقف قبل install/typecheck/tests/build لغياب مجلد التطبيق؛ أضيف smoke test للحاوية لكن لم يُنفذ بعد |
| Preview live URL | TODO | لا يوجد نشر حي مثبت |
| Auth وGoogle OAuth | TODO | لا يوجد تدفق Supabase Auth/Google OAuth موثق أو credentials معتمدة في R6 |
| Backend إنتاجي دائم | TODO | R6 يستخدم JSON محليًا ولا يوجد Supabase client في المصدر المفحوص |
| Authorization وRLS | TODO | يلزم تنفيذ واختبار مركزيين قبل فتح عمليات الكتابة |
| Android/mobile | WAIT / PRESERVE | يبقى المشروع المرجعي المنفصل محفوظًا ولا يُحذف |
| Production cutover | BLOCKED | ممنوع حتى اجتياز جميع بوابات الإصدار |

## P0 — أولويات مانعة للإطلاق

- [ ] **استيراد حزمة Preview النظيفة** إلى فرع المعاينة فقط، والتحقق من SHA-256 والملفات الأساسية.
- [ ] تشغيل CI وإصلاح أخطاء الاعتماديات وTypeScript والاختبارات وVite وDocker. (أضيف smoke test للحاوية ضمن CI؛ التنفيذ ينتظر استيراد التطبيق.)
- [ ] إثبات أن Preview لا يعرض حسابات أو بيانات تشغيل أو أرصدة أو معاملات أو سجلات قديمة.
- [ ] تنفيذ Backend مستقل دائم؛ لا تستخدم ملف JSON المحلي أو قرص Cloud Run المؤقت لبيانات التشغيل.
- [ ] إعادة بناء Auth: Google OAuth عبر Supabase Auth، callback، refresh، logout، استعادة الحساب.
- [ ] إعادة بناء Authorization: RBAC + RLS + عزل المؤسسات والأنشطة + رفض الوصول غير المصرح به.
- [ ] تأمين كل mutation مالي/إداري من الخادم؛ لا تثق بالدور أو السعر أو الرصيد أو owner ID الوارد من العميل.
- [ ] حذف الأسرار الثابتة وفرض إعداد أسرار الإنتاج من secret manager؛ تدوير أي أسرار سبق استخدامها.
- [ ] اختبارات سلبية لكل endpoints الحساسة، بما فيها IDOR والطلبات غير المصرح بها والويبهوكس المكررة.

## قائمة الوظائف حسب الوحدات

### الموقع والكتالوج والبحث
- [ ] الحفاظ على واجهة R6 الحالية باعتبارها واجهة الأساس.
- [ ] التحقق من دليل الأنشطة والكتالوج والمنتجات والصور والروابط.
- [ ] تمييز الأنشطة غير المراجعة كغير موثقة وعدم اختلاق بيانات تحقق أو أرقام مبيعات.
- [ ] اعتماد تحميل القوائم تدريجيًا: 20 عنصرًا أولًا ثم «عرض المزيد» حيث يلائم.
- [ ] اختبار البحث الافتراضي على مستوى مصر، ثم القرب الجغرافي عند السماح بالموقع.
- [ ] مراجعة خريطة المواقع والمحافظات والمراكز والقرى والإحداثيات.
- [ ] مراجعة عرض الإعلانات ومساحات «أعلن معنا» وعدم عرض حملات تجريبية كحملات فعلية.

### المستخدمون والإدارة والصلاحيات
- [ ] تنفيذ الأدوار على الخادم وRLS، وليس على إخفاء عناصر الواجهة فقط.
- [ ] اختبار عزل Super Admin وAdmin والموظفين وأصحاب الأنشطة والعملاء.
- [ ] تنفيذ إدارة الحسابات والدعوات والتعطيل واستعادة الحساب والجلسات.
- [ ] حماية تغييرات الأدوار وإعدادات المنصة وتسجيلها في Audit Log.

### Backend وقاعدة البيانات
- [ ] رسم schema النهائي من احتياجات R6 الحالية قبل كتابة migrations.
- [ ] مراجعة العلاقات والقيود والفهارس وسياسات الحذف والتحديث.
- [ ] إنشاء مشروع Preview مستقل، ثم Staging مستقل، دون لمس المشروع الإنتاجي.
- [ ] نقل البيانات العامة التي تمت مراجعتها فقط، وبدء كل السجلات التشغيلية الجديدة فارغة.
- [ ] تطبيق RLS وleast-privilege grants على جميع الجداول المكشوفة.
- [ ] إضافة تحقق مدخلات typed schemas وعمليات ذرية ومعالجة الأخطاء.
- [ ] فصل مفاتيح المتصفح publishable عن أسرار الخادم secret.

### المالية والدفع والمحافظ
- [ ] إعادة بناء دفتر أستاذ غير قابل للتعديل المباشر مع قيود debit/credit وموازنة.
- [ ] حساب الأرصدة من المعاملات المعتمدة فقط، لا من قيم يرسلها المتصفح.
- [ ] ربط Paymob بعد إعداد أسرار حقيقية والتحقق من توقيع webhook والتكرار idempotency.
- [ ] اختبار التسوية والاسترداد والعمولات والاشتراكات وتواريخ الاستحقاق.
- [ ] منع أي بيانات مالية أو محافظ تجريبية من الوصول إلى المستخدمين.

### CRM والقطاعات والتسويق والمحتوى
- [ ] ربط العملاء والطلبات والرسائل بسجلات مستخدمين وأنشطة حقيقية وصلاحيات واضحة.
- [ ] التحقق من Activity ثم Specialty باعتبارهما تسلسل التصنيف.
- [ ] مراجعة بيانات القطاعات والتخصصات وعدم إعادة إدخال مجموعات قديمة متعارضة.
- [ ] تنفيذ حملات التسويق والتصميمات والعروض والميزانيات والموافقات وسجل الأداء.
- [ ] فصل محتوى المنصة عن بيانات الأنشطة، وإضافة إدارة المراجعة والنشر.
- [ ] تنفيذ قوالب استيراد CSV/XLSX والتحقق من الأعمدة والأخطاء قبل الحفظ.

### MantyGo والعمليات والأتمتة والإشعارات
- [ ] مراجعة دورة الطلب والعرض والقبول والإسناد والإلغاء من جهة الخادم.
- [ ] إضافة صلاحيات المهام ومهلة التنفيذ ومنع التكرار ومعالجة حالات الفشل.
- [ ] ربط الإشعارات بقنوات معتمدة وتفضيلات المستخدمين.
- [ ] حماية WhatsApp Cloud API وwebhooks وعدم تخزين tokens في المتصفح.
- [ ] توثيق سجلات التشغيل والأخطاء وإعادة المحاولة الآمنة.

### التحليلات والتقارير والمراقبة
- [ ] حساب KPIs من سجلات موثوقة فقط، وعدم عرض أرقام seed على أنها نتائج فعلية.
- [ ] توحيد المنطقة الزمنية والعملة وقواعد احتساب المؤشرات.
- [ ] إضافة مراقبة API وقاعدة البيانات والأخطاء والزمن والتكلفة.
- [ ] ضبط تنبيهات الإنذار والحدود ومراجعة السجلات دون تسريب بيانات حساسة.

### النسخ الاحتياطي والتعافي
- [ ] نسخ احتياطي مشفر خارج instance، ومجدول ومراقب.
- [ ] اختبار restore على بيئة مستقلة قبل اعتماد النسخة.
- [ ] توثيق RPO/RTO وخطة DR والرجوع إلى إصدار التطبيق السابق.
- [ ] اختبار استرجاع قاعدة البيانات والملفات والمفاتيح والإعدادات.

### الجودة والأمن والإطلاق
- [ ] Typecheck وlint وunit tests وintegration tests وe2e وregression.
- [ ] اختبارات API وAuth/RLS/RBAC وsecurity headers وrate limiting وCSRF/CORS.
- [ ] فحص dependencies والثغرات والأسرار والتراخيص.
- [ ] اختبار الأجهزة والمتصفحات والسرعة وإمكانية الوصول.
- [ ] Build نسخة staging وتوقيعها والتحقق من artifacts.
- [ ] مراقبة staging واختبار rollback قبل cutover.
- [ ] اعتماد Go/No-Go موثق قبل الإنتاج.

## قواعد تنفيذ ثابتة

1. لا تغييرات على `main` أو Supabase الإنتاجية خلال Preview.
2. لا دمج واجهات قديمة؛ يُعاد استخدام capability محددة بعد إثبات نقصها وتوافقها.
3. لا نقل حسابات أو مبيعات أو معاملات أو أرصدة أو رسائل أو backups من مصادر قديمة.
4. الاحتفاظ بمشروع Android/mobile المرجعي وعدم حذفه.
5. كل تغيير يمر: تحليل الأثر → تنفيذ → تكامل → اختبار → مراجعة أمان → توثيق.
6. كل نتيجة لم تُختبر عمليًا تبقى `NOT VERIFIED`.
7. لا يوصف أي إصدار بأنه Production Ready قبل اجتياز جميع بوابات الأمر الرئيسي.

## الخطوة التالية الوحيدة

**رفع الحزمة المنظفة إلى فرع Preview وتشغيل CI.** لا يبدأ ربط Supabase أو تفعيل الكتابة قبل نجاح هذه الخطوة وفحص التطبيق المستورد.


## تحديث مسار الاستيراد من المتصفح — 10 نوفمبر 2026

- **IMPLEMENTED:** إعداد Codespaces في `.devcontainer/devcontainer.json` لتوفير Node 22 وPython 3.12 وGitHub CLI وunzip.
- **IMPLEMENTED:** دليل عربي يشرح الرفع من متصفح الهاتف أو الكمبيوتر وتشغيل أداة الاستيراد: `docs/R6_CODESPACES_IMPORT_AR.md`.
- **BLOCKED:** ما زال ZIP غير موجود داخل فرع المستودع؛ يلزم رفع `bizcatalog-manager-6-preview-clean.zip` داخل جذر Codespace ثم تشغيل importer ودفع فرع Preview.
- **IMPLEMENTED:** أضيف `scripts/smoke_test_r6_preview.sh` إلى CI لفحص الدليل والكتالوج ونقاء سجلات Preview ورفض الكتابة وواجهات الإدارة وترويسات الحماية؛ **NOT VERIFIED:** الاختبار لم يعمل بعد على حاوية فعلية لأن التطبيق لم يُستورد.\n- **IMPLEMENTED:** CI أصبح يفحص نفس Commit الذي أطلق Workflow.
- **IMPLEMENTED:** Cloud Run deployment أصبح يدويًا، ويتحقق من نجاح CI على نفس SHA قبل نشر نفس SHA المختبَر.
- لا يوجد نشر حي ولم يتم تشغيل Production cutover.
## تحديث أداة الاستيراد والفحص المحلي — 10 نوفمبر 2026

- **IMPLEMENTED:** فحص ZIP يرفض المسارات المطلقة وPath Traversal وأسماء العناصر المكررة وSymlinks.
- **IMPLEMENTED:** منع مجلدات البيانات والأسرار وملفات البيئة غير المسموح بها، مع السماح بـ .env.example.
- **IMPLEMENTED:** حد أقصى 100 MiB للحجم بعد فك الضغط والتحقق من الملفات الأساسية المطلوبة.
- **IMPLEMENTED:** تنظيف مجلد التطبيق الجزئي الذي أنشأته محاولة الاستيراد فقط عند فشل مراحل التنظيف قبل Commit.
- **PASS (local checks):** SHA-256 للحزمة النظيفة مطابق، وفحص unzip سليم، وفاحص الأرشيف قبل 117 ملفًا و15,591,628 بايت بعد الفك، وملف devcontainer JSON صالح.
- **BLOCKED:** لم ينفذ Git push من بيئة الجلسة؛ DNS لم يتمكن من الوصول إلى github.com. يلزم رفع الحزمة عبر Codespaces أو تشغيل أداة الاستيراد على جهاز متصل.
- **NOT VERIFIED:** بناء التطبيق واختباراته الفعلية لم تبدأ بعد لأن مجلد التطبيق لم يدخل الفرع.

- **PASS (importer safety):** Bash syntax passed; validator accepted the exact 117-file ZIP; a simulated sanitation failure in an isolated mock repository exited safely and left no partial app directory or temporary extraction folder.
- **IMPLEMENTED:** extraction now occurs in a unique temporary directory, followed by atomic same-filesystem move; cleanup removes the final app folder only when the current execution created it and had not committed.
- **NOT VERIFIED:** successful run of all four live sanitation scripts on the final Codespaces checkout and successful GitHub push.


## Supabase legacy review — 10 نوفمبر 2026

- **PASS (read-only inventory):** تم التأكد من أن مشروع Supabase القائم ما زال ACTIVE_HEALTHY، ولم تُنفذ أي تغييرات عليه.
- **IMPLEMENTED:** أضيف تقرير `docs/LEGACY_SUPABASE_READONLY_AUDIT_AR.md` ويشمل Security/Performance Advisor و9 جداول RLS بلا سياسات و3 تنبيهات anon SECURITY DEFINER و67 دالة SECURITY DEFINER متاحة لـ authenticated.
- **BLOCKED:** لا تربط R6 بالمشروع النشط ولا تنقل دواله قبل مراجعة authorization وtenant ownership لكل function وتجهيز Preview backend منفصل.
- **TODO:** فحص التعاريف الـ67 واختبارات الصلاحيات السلبية؛ مراجعة الجداول التسعة؛ تقييم Leaked Password Protection؛ ترتيب تحسينات الأداء في بيئة Staging.



## Final preflight checks — 10 نوفمبر 2026

- **PASS:** ZIP integrity verified; 117 files and 15,591,628 bytes expanded; required app files exist; no duplicate paths, path traversal, symlinks, blocked data folders, or secret environment paths found.
- **PASS:** current Codespaces importer Bash syntax validated locally; importer now stages on the same filesystem, cleans temporary state on every exit, removes only an incomplete destination from its own run, and supplies a fallback Git commit identity.
- **PASS:** smoke-test Bash syntax validated locally.
- **IMPLEMENTED / NOT VERIFIED:** Preview health response now identifies itself as `MantiqaTix Isolated Preview Backend`; the container smoke test checks this. Runtime test awaits app import and CI.
- **BLOCKED:** No app source has yet been committed to `apps/bizcatalog-manager-6-preview/`; therefore none of the application build, unit test, Docker runtime, or Preview smoke results can be claimed.

## آخر مراجعة لمصدر R6 — HTML والبيانات السرية

- **PASS (source check):** تم تأكيد أن fallback التوقيع في R6 ليس سرًا ثابتًا: يستخدم randomBytes(32) خارج Production، بينما يتطلب Production أسرارًا حقيقية ويوقف التشغيل عند غيابها. `.env.example` يحتوي قيمًا فارغة فقط. لا تضع أسرارًا فعلية في Git.
- **IMPLEMENTED:** مرحلة التنظيف تزيل كتلة Meta Pixel المضمنة في index.html وتزيل تعليمات الدخول التجريبي القديمة من PREVIEW_README_AR.md.
- **PASS (pattern verification):** تعبير التنظيف يطابق كتلة Meta Pixel الموجودة في ZIP مرة واحدة ويزيل المعرف وwindow.fbq وPageView منها. يلزم تنفيذ مرحلة التنظيف الكاملة بعد الاستيراد للتحقق النهائي.
- **BLOCKED:** استيراد التطبيق ودفعه إلى GitHub ما زالا مطلوبين؛ لا توجد حاليًا نتائج CI ناجحة على التطبيق نفسه.

## بوابة فحص المصدر قبل البناء — 10 نوفمبر 2026

- **IMPLEMENTED:** أضيف `scripts/verify_r6_preview_source.sh` إلى CI قبل تثبيت الاعتماديات.
- **PASS (mock fixture):** فحص Bash يعمل على بنية Preview نظيفة تجريبية، ويتحقق من الملفات الأساسية، عدم وجود data/env، وضع guest، حظر handlers المحلية، فراغ الحسابات التجريبية، غياب Meta Pixel من HTML والـ engine، وخلو README من بيانات الدخول القديمة.
- **IMPLEMENTED:** عدّاد حظر الدخول يشترط وجود حواجز لكل 3 handlers محلية، لا مجرد تطابق واحد.
- **BLOCKED:** لا يمكن تشغيل الفحص على نسخة التطبيق الفعلية قبل رفع ZIP وتشغيل مراحل sanitizer الأربع.


## Preview contact-safety pass — 10 نوفمبر 2026

- **IMPLEMENTED:** إضافة `scripts/finish_r6_preview_contact_guard.py` كمرحلة خامسة بعد تنظيف البيانات.
- **PASS (local isolated preflight):** شُغلت المرحلة على استخراج جديد للحزمة النظيفة؛ اجتازت invariants، ولم تظهر أخطاء صياغة TypeScript في 16 ملفًا معدلًا عند transpilation.
- **IMPLEMENTED / NOT VERIFIED at runtime:** منع روابط `tel:` و`sms:` وWhatsApp والدفع في Preview، مع إبقاء روابط المواقع العامة متاحة.
- **IMPLEMENTED:** إزالة أرقام الاتصال الافتراضية من تدفقات إنشاء روابط واتساب/الحجز وبيانات عروض B2B التجريبية في Preview.
- **BLOCKED:** لا تزال اختبارات التفاعل داخل المتصفح والبناء الكامل وsmoke test runtime تنتظر استيراد التطبيق وتشغيل CI.


## Work completed in this continuation — 10 نوفمبر 2026

- **PASS (archive):** إعادة التحقق من ZIP: SHA-256 مطابق، ZIP integrity PASS، 117 ملفًا، 15,591,628 bytes expanded.
- **PASS (contact guard):** تشغيل `finish_r6_preview_contact_guard.py` على استخراج جديد من ZIP؛ اكتمل دون أخطاء.
- **IMPLEMENTED:** مرحلة الاستيراد تشمل الآن حماية روابط الهاتف وWhatsApp والدفع، وتعطيل fallback لأرقام الاتصال غير الموثقة في وضع Preview.
- **IMPLEMENTED:** Dockerfile الناتج يستخدم Bun 1.4.4 المثبت مثل CI، `bun install --frozen-lockfile`، multi-stage build، ومستخدم runtime غير root.
- **IMPLEMENTED:** CI يتحقق من صياغة contact guard ومن invariants الخاصة بصورة Docker وحماية outbound actions قبل build.
- **BLOCKED:** التطبيق لم يُرفع بعد إلى `apps/bizcatalog-manager-6-preview/`; لا يوجد حتى الآن install/typecheck/unit test/build/container smoke/deploy ناجح.
- **BLOCKED — required handoff:** رفع ZIP المنظف إلى Codespaces على فرع Preview وتشغيل importer ثم `git push`. لا توجد عملية binary upload من أداة GitHub المتاحة في جلسة ChatGPT.
- **PROTECTED:** `main` وSupabase الإنتاجي لم يتم تعديلهما.

