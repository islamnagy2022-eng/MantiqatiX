# تقرير بوابة الإصدار والإطلاق — MantiqaTix

**تاريخ الفحص:** 2026-10-11  
**القرار:** `NOT CERTIFIED`  
**الإنتاج:** لم تُنفذ أي كتابة أو ترحيلات أو نشر وظائف خلفية أثناء هذه الدورة.

## 1. النطاق والأدلة المرجعية

- المستودع: `islamnagy2022-eng/MantiqaTix`
- فرع الإنتاج: `main`
- آخر SHA لفرع `main` عند تحديث التقرير: `8a56358d505d2c12878440037f7f24ba65d2ea10` (تم التحقق منه عبر مقارنة الفرع الحالي)
- مشروع Supabase: `moyhiluyhjsujhwlyeuu`
- سجل Supabase الحي: 283 ترحيلًا؛ آخر إصدار هو `20261008222845` باسم `rc424_atomic_digital_page_payment_webhook`.
- ملف المصدر المقابل: `20261009010000_rc424_atomic_digital_page_payment_webhook.sql`.
- تمت مقارنة `statements[1]` المسجلة في `supabase_migrations.schema_migrations` مع ملف المصدر، وتطابق النصان تمامًا (7,208 بايت). اختلاف الطابع الزمني موثق بوصفه اسم إصدار تاريخيًا؛ لم يُعدّل تاريخ الترحيلات المطبق.
- طلب الدمج #193 يضيف بوابة مغلقة عند وجود موانع P0. على SHA `50c4cc227be267dc12ab6ed70a620a659a03fc3c` اجتازت Pages validation فحصها، وأنتجت `PRODUCTION_GATE=BLOCKED` وتخطت النشر، وهو السلوك المقصود.
- طلب الدمج #194 أُغلق دون دمج لأنه احتوى تغييرات إضافية غير مقصودة من فرع قديم. البديل النظيف هو [PR #198](https://github.com/islamnagy2022-eng/MantiqaTix/pull/198)، ويحتوي فقط على 16 ملف ترحيل RC425–RC432 وRC434–RC441 مع توثيق المصدر. فحوص تفرد إصدارات الترحيلات وتعارض طلبات الدمج المفتوحة وعدم تغيير تاريخ الترحيلات اجتازت على SHA `7658268254f02f401aa5cc75649b2fc59f6333fe`; فحوص الموديولات والحدود الخلفية والخصوصية اجتازت أيضًا. هذا لا يثبت نجاح إعادة تشغيل السلسلة الكاملة.

## 2. حالة الموديولات

| الموديول | الحالة | الدليل أو المانع المتبقي |
|---|---|---|
| الهوية وتسجيل الدخول والعضويات | `PARTIAL` | اختبارات مصدر وتكامل موجودة؛ إعدادات Auth الحرجة وحماية كلمات المرور المسرّبة لم تُعتمد بالكامل. |
| الشركات والفروع وعزل المستأجرين | `NOT VERIFIED` | اختبارات نطاق جزئية؛ يلزم اختبار سلبي شامل بين شركتين في البيئة المستهدفة. |
| CRM والعملاء المحتملون | `PARTIAL` | ملفات مصدر موجودة؛ لا يوجد اعتماد شامل لدورة CRM من العميل إلى الحملة إلى التقرير. |
| الطلبات والحجوزات | `PARTIAL` | بعض عقود الطلبات موجودة؛ E2E للمنصة الكاملة غير مثبت. |
| الدفع والاشتراكات | `PARTIAL` | اجتازت اختبارات معزولة لـPaymob الذري، وربط صفحة رقمية، وحجز نية الاشتراك واستعادة checkout. اختبار Paymob Sandbox الحقيقي وتطابق النشر الحي غير مثبتين. |
| المحافظ والتسويات | `PARTIAL` | اجتازت اختبارات مصدر/تكامل محددة؛ لا توجد مطابقة إنتاجية كاملة للرصيد والتسوية والاسترداد. |
| الحسابات والقيود المالية | `PARTIAL` | اجتاز اختبار دفتر القيود المعزول؛ المطابقة الحية مع الدفع والتسويات غير مثبتة. |
| المشتريات والاستلام والمخزون | `PARTIAL` | اجتازت اختبارات RC434 للاستلام الذري وRC437 لحدود بنود أمر الشراء؛ لم تطبق الترحيلات أو الوظائف على الإنتاج. |
| مقدمو الخدمات والقطاعات | `PARTIAL` | أجزاء موجودة؛ مراجعة النطاق والصلاحيات عبر جميع القطاعات والفروع غير مكتملة. |
| التسويق الداخلي والإعلان | `PARTIAL — IN SCOPE` | يبقى ضمن الإطلاق الأول؛ يلزم استكمال بقية بوابات الأمان والتكامل العامة. |\n| خدمات التسويق الرقمي SMM | `DEFERRED — NOT CERTIFIED` | واجهة المتصفح مرشحة لتكون صفحة انتظار فقط؛ بوابة `smm-gateway` الحية لم تُعطّل أو تُعتمد آمنًا بعد، ويظل تعطيلها من جهة الخادم مع اختبار رفض حي شرطًا قبل الإطلاق. انظر issue #212. |
| الصفحات الرقمية | `PARTIAL` | اجتاز اختبار ربط الدفع المعزول؛ لم يتم اعتماد دورة النشر والدفع على البيئة الحية. |
| الإشعارات والأتمتة | `NOT VERIFIED` | يلزم إثبات التسليم الفعلي وإعادة المحاولة وعدم التكرار على بيئة متكاملة. |
| التحليلات والتقارير | `NOT VERIFIED` | لم يتم اعتماد المؤشرات التشغيلية والمالية من بيانات حقيقية عبر صلاحيات المستأجرين. |
| الإدارة والحوكمة | `PARTIAL` | اجتازت اختبارات نطاق مسؤول المنصة وسجل الموافقات الذري؛ اعتماد شامل لسجل التدقيق والقرارات ما زال مطلوبًا. |
| المراقبة والسجلات | `PARTIAL` | فحوص المصدر وCI موجودة؛ مراقبة الإنتاج والتنبيه والاستجابة التشغيلية تحتاج اختبارًا. |
| النسخ الاحتياطي والتعافي | `NOT VERIFIED` | لا يوجد دليل على نجاح استعادة كاملة من نسخة احتياطية في بيئة معزولة. |

## 3. نتائج CI المؤكدة

على SHA الوظيفي `aa014c8491c64f6996b69eb38c90e8f25ccbb520` اجتاز [Module Professionalization Validation](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38103028243) جميع الاختبارات المعروضة، بما فيها:

- دفتر القيود المالية.
- الاستلام الذري للمخزون RC434 وبنود أوامر الشراء RC437.
- استعادة checkout المشفر RC439.
- معالجة Paymob الذرية RC425 وربط الدفع للصفحات الرقمية.
- نطاق مسؤول المنصة.
- حجز نية الاشتراك RC435.
- محفظة SMM.
- search_path لإعلانات الصفحة الرئيسية ودوال SECURITY DEFINER.
- حدود خصوصية Matrimony.
- فحوص التحقق الثابت لعقود المصدر.

كما اجتازت Pages validation على [run 38103031588](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38103031588)، لكن وظيفة النشر كانت `skipped` لأن الطلب مسودة.

**تصنيف هذه النتائج:** اختبارات Static/Contract/Integration معزولة. لا تعادل Production Smoke أو E2E مع مزود الدفع أو إثبات تطابق الوظائف الحية.

## 4. مقارنة المصدر بالنشر الحي

في الفحص الحي السابق لهذه التغييرات:

- `payment-intent` إصدار 6، و`paymob-webhook` إصدار 8، و`digital-page-payment-intent` إصدار 3، و`erp-purchase-receive` إصدار 1 كانت مطابقة لمصدر `main` القديم.
- `smm-gateway` إصدار 6 لم يكن مطابقًا لمصدر `main`، وكان يفتقد عمليتي `catalog` و`my_data` الموجودتين في المصدر.
- PR #198 لا يغير أي Edge Function أو واجهة؛ هو استعادة مصدر ترحيلات فقط. [PR #199](https://github.com/islamnagy2022-eng/MantiqaTix/pull/199) هو طلب منفصل ومسودة لتغيير وظيفة الاستلام إلى RPC ذري وإضافة اختبارات RC434/RC437. اختبار RC434 اجتاز على SHA `bef58205bdd29520ad2423b783474f4296743b06`؛ اختبارات RC437 والتحقق الثابت كانت ما تزال قيد التنفيذ وقت آخر فحص. لم يُنشر هذا التغيير إلى الإنتاج.
- سجل الترحيلات الحي ينتهي عند RC424؛ وجود RC425–RC456 في المصدر لا يثبت تطبيقها.

## 5. المخاطر والعوائق المفتوحة

1. إعادة تشغيل سلسلة الترحيلات الكاملة على Supabase محلي معزول لم تثبت نجاحها. محاولات التشغيل توقفت عند بدء الخدمات بسبب سحب صور Docker/حدود السجل؛ لا توجد بيانات اعتماد Docker Hub في أسرار CI، وخطوة إعادة التشغيل الحالية ما زالت معلقة.
2. لا يوجد إثبات لتطبيق ترحيلات RC425–RC456 على الإنتاج.
3. اختبار Paymob Sandbox من بداية الدفع إلى Webhook والتسوية والقيد المالي غير مكتمل.
4. إعداد حماية كلمات المرور المسرّبة في Auth ما زال معطلًا حسب الفحص السابق.
5. أظهر فحص Supabase دوال `SECURITY DEFINER` متاحة لـ`authenticated` ودالة واحدة متاحة لـ`anon`; يلزم فحص كل دالة وفق عقدها بدل سحب الصلاحيات بالجملة.
6. جدول `digital_page_payment_events` لديه RLS دون سياسات، لكن الفحص السابق لم يجد صلاحيات قراءة مباشرة لـ`anon` أو`authenticated` أو`service_role`. يُسجل ذلك كمراجعة deny-by-default، وليس كسبب لإضافة سياسة تلقائية.
7. لا يوجد تمرين استعادة نسخة احتياطية مكتمل، ولا دليل على RPO/RTO فعليين.
8. أسرار مزود الدفع ومفاتيح تشفير checkout يجب أن تُضبط في إعدادات البيئة المستهدفة، لا في الواجهة أو Git.

## 6. ترتيب الإطلاق الآمن

1. دمج بوابة الإصدار المغلقة PR #193 قبل أي PR وظيفي، حتى تمنع نشرًا جزئيًا.
2. إبقاء PR #198 وPR #199 مسودتين حتى تكتمل مراجعة كل ترحيل، وإعادة تشغيل السلسلة الكاملة، واختبارات القبول المرتبطة بها.
3. توفير مصادقة Docker Hub للـCI أو معالجة حدود السجل، ثم إعادة تشغيل الترحيلات في بيئة محلية معزولة من البداية إلى النهاية.
4. مراجعة نواتج الترحيلات والتبعيات وRLS و`SECURITY DEFINER` قبل أي تطبيق إنتاجي.
5. تطبيق الترحيلات فقط عبر خطة معتمدة، ثم نشر الوظائف التابعة المطابقة للمخطط، ثم إجراء اختبارات Smoke وPaymob Sandbox ومصالحة الحسابات والمخزون.
6. تنفيذ اختبار استعادة من نسخة احتياطية، ثم تحديث manifest بأدلة مرتبطة بالـCommit النهائي.
7. لا يُرفع `status` إلى `VERIFIED` ولا تُزال حالة `BLOCKED` إلا بعد إثبات كل الشروط المطلوبة.

## القرار

`NOT CERTIFIED` — لا توجد موافقة على الإطلاق الفعلي. اجتياز اختبارات المصدر والتكامل المعزولة تقدم مهم، لكنه لا يثبت اكتمال سلسلة الترحيلات أو تطابق الإنتاج أو نجاح E2E والاستعادة.

## 7. تحديث تحقق مباشر — 2026-10-11

### بوابة SMM المنفصلة

- راجعنا طلب التغيير [PR #214](https://github.com/islamnagy2022-eng/MantiqaTix/pull/214)، الرأس الحالي `b5ececafa6930837e5e392bb999e318e1038bd10`. يضيف رفضًا افتراضيًا من جهة الخادم قبل المصادقة وأي إجراء ما لم تكن `MNTY_SMM_ENABLED=true`، ويستبدل صفحة SMM بصفحة انتظار ثابتة، ويضيف فحص مصدر في CI.
- فحوص الرأس المحدد ناجحة: Module Professionalization Validation، وBackend-only Module Boundary، وMantiGO Open Ride Privacy Boundary، وSMM Service Role Access Boundary. تحقق الويب اكتمل بنجاح لكن مهمة `deploy` تخطت التنفيذ؛ لا يعد ذلك دليل نشر.
- الفحص الحي المستقل لـSupabase ما زال يعرض `smm-gateway` بالحالة `ACTIVE`، الإصدار 6، وبصمة `ea4de98886b739ed5ce83c7f5909671fd00481a8f488849ffe58567e58be6cd6`. المصدر الحي لا يحتوي على بوابة `MNTY_SMM_ENABLED`، ولا يزال يحتوي مسار `place_order` وخصم المحفظة واستدعاء المزود. إذن SMM **لم يُحتوَ في الإنتاج**، وتظل المسألة #212 مانع P0. لا تنشر هذا التغيير دون تفويض مستقل صريح واختبار سلبي حي يثبت عدم إنشاء طلب أو تغيير محفظة/استرداد أو استدعاء مزود أثناء التعطيل.
- قرار النطاق لا يتغير: واجهة SMM مؤجلة، أما قسم التسويق والإعلان الداخلي فيبقى ضمن نطاق الإطلاق الأول.

### فحص Security Advisor وقاعدة البيانات

- سجل Supabase الحي يحتوي 283 ترحيلًا وينتهي عند `20261008222845` (`rc424_atomic_digital_page_payment_webhook`). لا يثبت وجود ترحيلات RC425–RC458 في المستودع أنها طُبقت في الإنتاج.
- أحدث فحص Security Advisor يعرض 40 تحذيرًا لدوال `SECURITY DEFINER` متاحة للمستخدمين المسجلين، وتحذيرًا واحدًا لدالة متاحة لـ`anon`، وتحذيرًا لتعطيل حماية كلمات المرور المسرّبة، وملاحظة واحدة عن RLS بلا سياسات. هذه نتائج فرز ومراجعة؛ ليست وحدها إثبات استغلال. يجب مراجعة كل دالة بحسب صلاحياتها وحواجز الملكية والنطاق.
- استعلام كتالوج للجدول `public.digital_page_payment_events` أكد تفعيل RLS وعدم وجود سياسات، وعدم وجود صلاحيات DML/SELECT مباشرة لـ`anon` أو`authenticated` أو`service_role` في نتيجة المنح. هذا نمط رفض افتراضي محتمل لجدول أحداث داخلي، ولا ينبغي إنشاء سياسة عامة لمعالجة التحذير فقط؛ يجب إثبات مسار الكتابة/القراءة المقصود عبر RPC الموثوق.
- تحذير حماية كلمات المرور المسرّبة يحتاج تفعيلًا واعتمادًا من إعدادات Auth بعد الموافقة التشغيلية؛ لم تُغيّر إعدادات الإنتاج أثناء هذا الفحص.

### قرار الإصدار

`NOT CERTIFIED / BLOCKED`. لم يحدث دمج أو نشر أو تغيير إعدادات إنتاج أو تعديل بيانات مالية. لا يُسمح بتجاوز بوابة الإصدار بسبب نجاح CI للمصدر وحده.

### متابعة إضافية: دالة عرض الإعلانات العامة

- فحص `pg_get_functiondef` للوظيفة الحية `public.get_mnty_targeted_advertisements(...)` أكد أنها `SECURITY DEFINER` وتسمح بالتنفيذ لـ`anon` و`authenticated`، مع `search_path=public, pg_temp`. جسمها يرشّح الإعلانات النشطة والمعتمدة ويستخدم أسماء جداول مؤهلة بالمخطط؛ لذلك التحذير ليس وحده دليل استغلال، لكنه يبرر إزالة اعتماد `search_path` على مخطط `public`.
- الترحيل المرشح RC451 في هذا الفرع يغيّر إعداد الوظيفة إلى `search_path = ''` ويحافظ على تنفيذ `anon` و`authenticated` المقصود لاكتشاف الإعلانات العامة. اختبار RC451 المعزول يتحقق من المسار الفارغ، استمرار منح الدورين، وعدم منح `PUBLIC` تنفيذًا عامًا.
- هذا الإصلاح **مصدر مرشح فقط**؛ لا يثبت سجل الإنتاج الذي ينتهي عند RC424 أنه مطبق. لا تُزال ملاحظة Security Advisor ولا يُغلق مانع الإصدار قبل نجاح إعادة التشغيل المعزولة، تطبيق الترحيل عبر خطة معتمدة، ثم فحص الإعداد والمنح الحية بعد النشر.

### متابعة إضافية: نطاق صلاحيات إدارة MantiGO

- المراجعة السابقة للوظائف الحية أشارت إلى أن صلاحيات بعض عمليات الإدارة المالية والتسوية العامة تعتمد على عضوية نشطة ودور إداري دون اشتراط نطاق منصة صريح. لا يُعد هذا إصلاحًا مطبقًا لمجرد وجود ترحيل مرشح في المستودع؛ تظل المراجعة الحية والتطبيق المرحلي مطلوبين.
- اكتشفت مراجعة CI أن اختبار التكامل كان يطبق RC441 فقط، رغم أن RC449 يعيد تعريف حارس مسؤول المنصة ولوحة الإدارة والتقرير المالي والتسوية وانتهاء الرحلات القديمة. عُدّل مسار الاختبار ليطبق RC441 ثم RC449 ويشغل اختبار الرفض/السماح بعد الترحيل الأخير، كما وُسّع الفاحص الثابت ليتحقق من حدود RC449 و`search_path` الفارغ لكل RPC حساس.
- هذا تحسين لتغطية الاختبار، وليس إثباتًا لنجاحه بعد. يجب انتظار نتيجة exact-head CI ومراجعة الاختبار، ثم إجراء إعادة التشغيل الكاملة قبل أي تطبيق إنتاجي. لا تُجرى تعديلات مباشرة على الوظائف الحية.

## 8. Exact-head recheck — 2026-10-11

**Candidate evaluated:** `5107ac977a0afa1ffbe65e309e77bb10b279411b` on draft PR #207. This is the exact head before this report-only update; a fresh CI run is required for the resulting documentation commit.

### CI evidence
- `Module Professionalization Validation`: **PASS** — all 15 listed integration/validation jobs completed successfully, including ERP branch scope RC458, financial journal RC450/RC457, checkout recovery, Paymob atomicity, RC434 receiving, RC437 order-line limits, RC449 platform-admin scope, targeted-ad search-path integration, and SECURITY DEFINER search-path integration.
- Migration history immutability, migration version uniqueness, open-PR migration collision guard, backend-only module boundary, MantiGO open-ride privacy boundary, approval-action audit atomicity, and SMM service-role access boundary: **PASS**.
- Pages workflow: validation **PASS**, deploy **SKIPPED**. No deployment occurred.
- Separate SMM deferred validation: **FAIL** with 15 post-launch SMM functional-safety assertions. These include bounded provider timeout, typed ambiguous outcomes/reconciliation, no automatic refund for uncertain outcomes, conditional persistence, missing provider ID ambiguity, backend-derived admin visibility, wallet RPC result checking, terminal-state protection, idempotent/validated admin credits, and authenticated-session enforcement. These failures remain visible; they are not reclassified as core-launch passes.

### Live-state recheck
- Supabase project remains `ACTIVE_HEALTHY`; the live migration ledger contains 283 versions and ends at `20261008222845` / RC424. RC425+ remain **not proven applied**.
- Live `smm-gateway` remains **ACTIVE v6**, SHA256 `ea4de98886b739ed5ce83c7f5909671fd00481a8f488849ffe58567e58be6cd6`. Its live source does not contain `MNTY_SMM_ENABLED` and still includes order, wallet-debit, and provider-call paths. Candidate source deferral therefore does not contain the live API; issue #212 remains a P0 launch blocker.
- The clean chronological replay remains fail-closed before service startup because ten legacy SECURITY DEFINER function creation dependencies are missing from the committed historical migration source before `20260927095000_revoke_unused_security_definer_execute.sql`. The uploaded RC40 source archive was also checked and contains none of those ten function names in its SQL files; this does not establish historical DDL. No privileged-function baseline has been approved or added.
- Security Advisor and Auth findings described above remain open for evidence-based review; no Auth setting was changed.

### Release decision and boundary
**`BLOCKED / NOT CERTIFIED`.** This is not an approval to merge or deploy. No production migration, Edge Function change, Auth setting change, wallet/payment/financial write, or repository protection change was performed. Before launch, require an explicitly approved server-side SMM disable/deny deployment and negative live test, authoritative or separately approved test-only replay dependency resolution, successful full disposable chronological replay, current exact-head CI, production migration reconciliation, tenant-isolation/payment-finance E2E, backup-restore rehearsal, and approved repository protection.
