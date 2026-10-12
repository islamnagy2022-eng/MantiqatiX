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


## Automated 30-stage continuation audit — 2026-10-11

Candidate ref at start of this audit: `06ce8d9c01613bdcaba381913de9841586ad34dc` (PR #207, draft, not merged).

### Verified in this 30-check cycle
- PR state and exact-head workflow inventory refreshed.
- Exact-head `Module Professionalization Validation`: **success**.
- Exact-head migration history immutability, migration version uniqueness, open-PR migration collision guard, backend-only module boundary, MantiGO open-ride privacy boundary, approval-action audit atomicity, and SMM service-role access boundary: **success**.
- Exact-head Pages validation: **success**; deploy job: **skipped**. This does not establish a new deployment.
- Exact-head SMM deferred-module validation: **failure** in the SMM-specific runtime-safety assertions. The SMM page quarantine, disposable wallet idempotency test, and source-level deferred-scope checks passed; these do not replace the failed feature-safety suite.
- Candidate SMM gateway source contains the `MNTY_SMM_ENABLED` fail-closed gate before business operations, and the source validator checks this gate.
- Live Supabase project status was observed as `ACTIVE_HEALTHY`.
- Live `smm-gateway` remains `ACTIVE`, version `6`, SHA256 `ea4de98886b739ed5ce83c7f5909671fd00481a8f488849ffe58567e58be6cd6`; live source does not contain `MNTY_SMM_ENABLED` and retains order, wallet debit, and provider-call paths. Live containment remains **NOT VERIFIED**.
- Live migration listing was refreshed; the latest observed applied version remains `20261008222845` (RC424). Candidate migrations beyond this point are not proven applied.
- Repository inventory searches found explicit open work for restaurant/menu ownership editing and sector-specific flows; MantiGO integration tests exist; a medical booking restoration baseline exists; no pharmacy-specific search result was found in this query; marketing/advertising remains partial; CRM scope integration tests exist; wallet/finance, payment webhook, appointment, membership, and inventory work each have relevant source/test artifacts but still require module-specific acceptance evidence.

### Remaining blockers — not waived by this audit
1. Live SMM server-side denial and a safe negative runtime test are not evidenced.
2. SMM deferred validation still fails its post-launch feature-safety suite; keep this distinct from core launch gates.
3. Full chronological disposable migration replay is blocked by missing historical creation DDL for ten legacy SECURITY DEFINER functions referenced by `20260927095000_revoke_unused_security_definer_execute.sql`. No placeholders or synthetic production migrations are authorized.
4. Production migration reconciliation beyond RC424 is not verified.
5. Cross-tenant/branch E2E, real provider/customer/order/payment E2E, backup-restore rehearsal, auth hardening, and repository protection remain release evidence requirements.
6. Do not merge or deploy this draft. Do not alter production functions, schema, auth settings, financial data, or repository protections without the required explicit approval.

This is a 30-check audit/triage cycle, **not** a declaration that 30 business modules are complete. Continue implementation in small reviewable changes and only mark a module complete after its acceptance tests and evidence pass. Release remains `BLOCKED / NOT CERTIFIED`.

## SMM financial-safety remediation continuation — 2026-10-12

Candidate branch: `reconcile/rc425-458-current-main-20261011`. Latest remediation commit at report update: `13f079cad3b8f7f421f8e6069e3f37993822259b`.

### Source changes made on the draft branch
- Added a 15-second bounded provider request and typed non-definitive errors for network, timeout, and ambiguous HTTP/response outcomes.
- Changed order submission so uncertain provider outcomes, missing provider order IDs, wallet-debit RPC errors/non-boolean results, and provider-accepted/database-persistence failures require reconciliation and do **not** trigger automatic refunds.
- Restricted refunds to an explicitly recognized provider rejection and checks the refund RPC result, including boolean `false`.
- Made accepted-order persistence conditional on the expected `SUBMITTING` state; status polling avoids overwriting terminal order states and remains scoped to the authenticated owner.
- Routed storefront catalog, customer order/wallet data, and admin visibility through the authenticated Edge Function rather than direct browser table reads.
- Added positive finite amount validation and a stable per-attempt idempotency reference for administrative wallet credits.
- Updated the SMM static validator to check the implemented debit ambiguity contract rather than requiring a stale variable-name pattern.

### Verification and limitations
- A manual source-contract recheck matched **21/21 targeted safety predicates** against the candidate source. This is not a substitute for running the repository validators, Deno type checking, PostgreSQL integration tests, or exact-head GitHub Actions.
- The GitHub connector did not return new workflow runs for the latest commits; therefore, no exact-head CI pass is claimed for these changes.
- No live Edge Function was deployed or modified. Production `smm-gateway` remains observed as version 6 without the candidate fail-closed flag. This remains a P0 launch blocker.
- The historical migration replay dependency problem remains unresolved. No synthetic function definitions or unapproved historical baselines were introduced.
- PR #207 remains draft/unmerged; production migrations and financial data remain untouched.

**Release decision remains `BLOCKED / NOT CERTIFIED`.** Before SMM is enabled after launch, require exact-head CI, review of provider-specific definitive-rejection semantics, isolated failure-injection tests, approved deployment, and live negative verification. Core release additionally requires successful full chronological replay, production migration reconciliation, and the remaining release evidence listed above.

## 9. Exact-head SMM hardening continuation — 2026-10-12

Candidate head: `f088b02ffe799d3801c9d920a4a5f2f7bd9a57f6` on draft PR #207.

### Completed source fixes
- Repaired a literal escaped newline in `supabase/functions/smm-gateway/index.ts` that made the gateway fail TypeScript parsing.
- Added a bounded `deno check --no-lock` to SMM validation and source-contract assertions for the escaped-newline regression and for the server-side deferral gate executing before authentication/business actions.
- Corrected provider status synchronization: terminal provider states (for example COMPLETED/CANCELLED) are now persisted, while the database update predicate still prevents overwriting an already-terminal local order. If the update is ambiguous or loses a race, the handler returns `ORDER_STATUS_SYNC_UNKNOWN` with reconciliation required or rereads the current status rather than claiming an unpersisted status.
- Expanded the SMM safety validator to check terminal-state persistence and race-safe behavior.

### Exact-head evidence
- [SMM Deferred Module Validation — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38187626156): TypeScript syntax check, Deno type-check, RC432 wallet idempotency PostgreSQL test, deferred UI quarantine, and SMM safety/service-role source checks all completed successfully.
- [SMM Service Role Access Boundary — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38187626168): service-role PostgreSQL ACL boundary and Deno type-check completed successfully.
- [Migration History Immutability — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38187626149).
- [Disposable Supabase Migration Chain Replay — BLOCKED](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38187626191): the fail-closed historical-schema preflight failed; chronological replay did not start. Do not bypass this guard or invent missing historical function DDL.
- [Module Professionalization Validation completed PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38187727359) on code head `77349c32dc8db55ea6f8c29ed9823060742c3b3a`. This validates the listed isolated integration/contract jobs at that candidate head; it does not override the blocked full migration replay or live-production gates.

### Shared wallet UI boundary correction — 2026-10-12

- A second browser-side path was found in `web/app.js`: the shared wallet screen queried `smm_wallets` directly instead of using the SMM gateway. This was removed. The shared screen now displays SMM as deferred and does not show SMM balance data from the browser client.
- Added SMM services/orders/wallet transactions/events to the backend-only table set used by module-count/runtime accounting. This is an additional frontend guard, not a replacement for database ACL/RLS.
- Expanded `validate-smm-payment-safety.mjs` to reject direct `.from('smm_*')` table reads in both `web/app.js` and `web/smm.js`, and expanded the SMM workflow path filters to cover `web/app.js`.
- On code head `77349c32dc8db55ea6f8c29ed9823060742c3b3a`, [SMM Deferred Module Validation completed PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187727327): Deno type-check, RC432 wallet idempotency PostgreSQL integration, UI quarantine and SMM safety assertions succeeded. [SMM Service Role Access Boundary also completed PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187727397), including PostgreSQL ACL and source validation. [Pages validation passed with deployment skipped](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187727351). These are candidate-source checks, not proof that the live gateway has been disabled.
- No live deployment or production data mutation occurred. The live Edge Function remains version 6 without the fail-closed SMM gate; production containment remains NOT VERIFIED.

### Production comparison and release decision
- A fresh read-only lookup still reports live `smm-gateway` version 6 with source hash `ea4de98886b739ed5ce83c7f5909671fd00481a8f488849ffe58567e58be6cd6`; the live source does **not** contain the `MNTY_SMM_ENABLED` fail-closed gate. It remains an active P0 containment blocker.
- The candidate SMM code and validation changes are repository-only. No production function deployment, database migration/write, wallet/payment mutation, merge, or Auth/security configuration change was performed.
- SMM remains a separate functional module and is deferred from the initial launch UI; internal Marketing & Advertising remains in scope. The source CI pass does not certify the live SMM endpoint.
- Overall decision remains **`BLOCKED / NOT CERTIFIED`** pending historical replay, all exact-head checks, tenant/provider/payment E2E, live SMM containment under separate authorization, and remaining production/backup/restore evidence.

## 10. Latest exact-head gate refresh — 2026-10-12

Candidate head before this report-only update: `6a9867d6cc0c5827593bca85e09e215ae68aa614`.

### Latest verified workflow results
- [SMM Deferred Module Validation — PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806786).
- [SMM Service Role Access Boundary — PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806780).
- [Marketing Campaign Backend — PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806791).
- [Marketing CRM Tenant Scope — PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806752).
- [MantiGO Open Ride Privacy Boundary — PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806763).
- [Backend-only Module Boundary — PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806738).
- [Approval Action Audit Atomicity — PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806748).
- [Module Professionalization Validation — PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806743).
- [Migration History Immutability — PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806783), [Migration Version Uniqueness — PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806756), and [Open PR Migration Collision Guard — PASS](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806731).
- [Web validation — PASS, deployment job skipped](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806807). This is not a production deployment.

### Replay failure is confirmed, not a generic CI issue
The [full chronological migration replay](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38187806745) failed in its fail-closed preflight before starting Supabase or applying any migrations. The exact blocker is that `20260927095000_revoke_unused_security_definer_execute.sql` references these ten legacy function signatures before their authoritative creation DDL is available in any earlier committed migration or approved test-only baseline:
- `public.counter_offer_indrive_bid(uuid,uuid,numeric)`
- `public.fashion_erp_mutate(text,jsonb,text)`
- `public.mantigo_accept_bid(text,text)`
- `public.mantigo_cancel_ride(text)`
- `public.mantigo_create_ride(text,text,text,text,numeric,text)`
- `public.mantigo_rate_ride(text,integer,text)`
- `public.mantigo_submit_bid(text,numeric,text,text,text,text)`
- `public.mantigo_update_proposed_price(text,numeric)`
- `public.restaurant_erp_mutate(text,jsonb,text)`
- `public.restaurant_table_mutate(text,jsonb,text)`

No placeholder function DDL, skipped migration, production write, or migration-history rewrite is an acceptable workaround. Resolution requires authoritative historical definitions or an explicitly approved disposable-test baseline extracted from trusted live definitions. The current CI guard is behaving as designed.

### Current disposition
PR #207 remains draft and unmerged. Live `smm-gateway` remains version 6 without the candidate fail-closed environment gate, so live containment is still not verified. No production deployment, migration, wallet/payment mutation, or auth/security setting change was performed. Overall release remains **`BLOCKED / NOT CERTIFIED`**.


## 11. Exact-head verification refresh — 2026-10-12

Candidate head evaluated: `9baee5eb35cc7b66c7f81aac7b80089971359e3b` (documentation-only update follows this verification; rerun CI for the resulting head).

### Workflow evidence on the candidate head
- [SMM Deferred Module Validation — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205496): Deno syntax/type check, disposable PostgreSQL wallet-idempotency integration, UI quarantine, and SMM source-contract assertions passed.
- [SMM Service Role Access Boundary — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205520).
- [Marketing Campaign Backend — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205433); [Marketing CRM Tenant Scope — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205423).
- [Backend-only Module Boundary — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205478); [MantiGO Open Ride Privacy Boundary — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205528); [Approval Action Audit Atomicity — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205446); [Module Professionalization Validation — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205429).
- [Migration History Immutability — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205508); [Migration Version Uniqueness — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205570); [Open PR Migration Collision Guard — PASS](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205507).
- [Web validation — PASS; deploy job SKIPPED](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205422). No production deployment occurred.
- [Disposable chronological migration replay — BLOCKED](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38188205434). The fail-closed preflight failed before Supabase services started; migration replay did not begin and no migration was applied.

### Migration dependency search
Repository searches for the ten legacy SECURITY DEFINER signatures and their creation statements found only the privilege-revocation migration and later hardening/inspection references, not authoritative creation DDL in the committed migration history. This confirms that inventing placeholder bodies or bypassing the preflight is not justified. The safe next step is to recover trusted historical source or obtain explicit owner approval for a clearly isolated test-only baseline copied from trusted definitions; neither was done here.

### Security boundary and release decision
The SMM source validator confirms that candidate source checks `MNTY_SMM_ENABLED` before authentication and business operations. This is source-only evidence: the live Edge Function has not been changed, and its previously observed version 6 without this gate remains a P0 containment blocker until a separately authorized deployment and negative live test prove otherwise. The marketing/advertising internal module remains in launch scope; digital SMM remains deferred.

PR #207 remains draft/unmerged. No production migration, Edge Function deployment, Auth change, wallet/payment mutation, or financial data write was performed. Release status remains **`BLOCKED / NOT CERTIFIED`**.


## Latest production release recheck — 2026-10-12

**Decision remains `BLOCKED / NOT CERTIFIED`.** This is a read-only recheck plus documentation-only updates; no production change was made.

### Current live facts
- Supabase project `moyhiluyhjsujhwlyeuu` is `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.155.
- Production migration ledger remains at 283 applied versions, latest `20261008222845` / `rc424_atomic_digital_page_payment_webhook`. No post-RC424 candidate migration was applied.
- The deployed `smm-gateway` is now **ACTIVE version 8**, source hash `c16d88610845d8dbab5ee40f366452a40e9cc021df487d45ebcd8077199ee40f`. Read-only source inspection still finds no `MNTY_SMM_ENABLED` deny gate. The UI deferral therefore does not contain the live API; P0 issue [#212](https://github.com/islamnagy2022-eng/MantiqaTiX/issues/212) remains open. No function deployment was performed.
- The supplied `source_RC40.zip` SHA-256 was verified against its companion checksum. It contains original credit-control table DDL, but its numeric columns use `numeric(14,2)` while live production reports `numeric(18,2)` for five credit amount columns. It is useful historical source evidence, not an exact live-schema baseline.

### Exact candidate CI evidence
Candidate code head `3003a6186d937580cba37fe92c313d6760ffe111` completed these workflows successfully: Module Professionalization Validation [38254638082](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38254638082), SMM Deferred Module Validation [38254637874](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38254637874), Backend-only Module Boundary [38254637922](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38254637922), Migration History Immutability [38254637887](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38254637887), Migration Version Uniqueness [38254638027](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38254638027), and the related privacy, CRM, campaign, and approval-audit workflows. Pages validation passed but its deploy job was skipped [38254637872](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38254637872).

The complete disposable migration replay **failed** at `20260920155456_harden_credit_status_authorization.sql`: `public.credit_accounts` does not exist in the fresh replay database [run 38254637974](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38254637974). The uploaded RC40 source places the original table-creation migration at `20260920185000` and the original function migration at `20260920190000`, while the current candidate retains a production-ledger alias at `20260920155456`. The live database also has finance-read policies whose creation source is absent from the RC40 archive. A safe replay plan must preserve production ledger immutability and must not narrow numeric precision or silently synthesize policy definitions.

The release report and migration-blocker report received documentation-only commits on the candidate branch after that code head. Those documentation commits do not constitute a new code validation run. No merge, production deploy, database migration, Auth change, grant/RLS change, wallet/payment mutation, or customer-data write was performed.


## Supabase Advisor snapshot — 2026-10-12

A read-only Supabase Advisor run at approximately 14:51 UTC returned 133 security findings across five distinct lint categories, plus 632 performance findings across four categories. These are triage findings; they are not all confirmed exploitable vulnerabilities, and no automatic grant/RLS changes were made.

### Security items requiring disposition
- **40** `SECURITY DEFINER` functions are executable by `authenticated`. Each function needs an explicit caller/tenant authorization review; this generic lint alone does not prove each function is vulnerable.
- **1** `SECURITY DEFINER` function, `public.get_mnty_targeted_advertisements`, is executable by `anon` and `authenticated`. Its current body filters to active, approved ads and is likely part of public ad delivery, so do not blindly revoke anonymous execution. However, its live configuration uses `search_path = public, pg_temp`; review it against the candidate's hardening migration and confirm its return fields are intentionally public before any separately approved deployment. [Supabase lint 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- **90** anonymous-access policy findings were returned across tables. A separate catalog triage found 114 public tables with permissive policies for `authenticated`, of which 47 did not have a generic restrictive `FOR ALL` non-anonymous guard matching the expected JWT predicate. This is a review queue, not proof of exposure: inspect each table's policy predicates and required public/guest behavior, prioritizing financial, payment, wallet, order, membership, support, and CRM tables. Supabase anonymous users can carry the `authenticated` database role, so role membership alone is not sufficient authorization.
- `public.digital_page_payment_events` has RLS enabled but no policies. Confirm client roles have no table privileges and the intended service-role-only event path is tested before deciding whether a policy is needed. [Supabase lint 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- Leaked-password protection is reported disabled. This needs a reviewed Auth configuration change and sign-in regression tests; it was not changed during this audit.

### Performance review queue
- 375 RLS initialization-plan findings (repeated `auth.*` evaluation patterns).
- 105 foreign keys without covering indexes.
- 28 tables with multiple permissive policies for the same role/action.
- 124 indexes reported unused by current statistics.

Do not bulk-remove unused indexes or rewrite RLS policies from these counts alone. Validate query plans, data volume, expected workload, public-page requirements, and tenant-isolation tests first.

### Current release consequence
These Advisor results add an explicit security-review gate; they do not replace the existing replay and SMM containment blockers. Review and source fixes may proceed on the candidate branch, but production changes to RLS/grants, Auth settings, or Edge Functions require separate authorization and successful negative tests. Production remains **`BLOCKED / NOT CERTIFIED`**.


## Exact-head CI refresh — 2026-10-12 14:54 UTC

Candidate head: `7328e7a6b548ace698918fd2dab345d54d37f2e9` on PR #207.

Latest PR-triggered runs:
- [SMM Deferred Module Validation](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38266026538): PASS.
- [SMM Service Role Access Boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38266026314): PASS (PostgreSQL contract and validator jobs).
- [Module Professionalization Validation](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38266026441): PASS.
- [Migration History Immutability](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38266026366): PASS.
- [Migration Version Uniqueness](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38266026399): PASS.
- [Backend-only Module Boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38266026501): PASS.
- [Pages validation](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38266026432): validation PASS; deployment job SKIPPED by the release gate, as intended.
- [Disposable Supabase Migration Chain Replay](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38266026597): FAIL. The local stack initially hit public image-registry rate limits, then started successfully on retry. The actual blocker remains unchanged: migration `20260920155456_harden_credit_status_authorization.sql` references `public.credit_accounts` and `public.credit_periods`, which are absent in the empty replay database.

The replay failure is now confirmed on the latest exact PR head, not merely an earlier candidate. The repository's main migration directory and production migration ledger do not contain an authoritative credit-table creation migration. The RC40 archive provides historical DDL, but its numeric precision differs from the live schema; using a live-derived disposable baseline still requires the explicit scope approval already recorded as outstanding. No baseline was injected, no migration history was edited, and no production changes were made.

**Release remains `BLOCKED / NOT CERTIFIED`.** Continue source/test work on the candidate, but do not merge or deploy until the credit replay gap is resolved through an approved, schema-accurate disposable-only method and all required release evidence passes.


## Continuation verification — 2026-10-12 16:35 UTC (SESSION-006)

**Overall decision: BLOCKED / NOT CERTIFIED.** This entry supersedes any older status in this report where later evidence differs; historical entries are retained.

### Exact candidate head and CI
- Candidate PR #207 head before this documentation update: `7d871e19560fcce9895218f0e2f3236a974826c1`; PR #207 remains open Draft.
- Exact-head workflow batch: [Disposable replay run 38277095706](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38277095706) **FAIL**. The disposable database started and chronological replay failed at `20260920155456_harden_credit_status_authorization.sql` because `public.credit_accounts` and `public.credit_periods` are absent.
- Exact-head focused CI passed: module professionalization, backend-only module boundary, MantiGO privacy boundary, approval audit atomicity, migration collision guard, migration history immutability, migration version uniqueness, Marketing Campaign Backend, Marketing CRM Tenant Scope, SMM service-role boundary, and SMM deferred-module validation. Pages validation passed; deploy was skipped.
- The documentation-only continuation commit is `bd47bf2423cf7f6b91ab88875ddcfef6f0067eac`. No workflow runs were returned for that commit at the time of this check; do not attribute prior CI success to this new commit.

### Credit migration provenance
- Read-only live schema inspection confirms several live credit amount columns use `numeric(18,2)`; recovered RC40 DDL uses `numeric(14,2)` for several amount columns.
- Bounded GitHub code/commit searches for credit table creation and finance-read policy creation did not recover authoritative historical source. The later migration `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` alters `credit_accounts_finance_read` and `credit_periods_finance_read`, but their creation source remains missing from searchable candidate history.
- Do not inject guessed credit DDL, infer policies, alter applied history, or mark migrations applied. Continue trusted artifact/history recovery. If unavailable, prepare a separately reviewed proposal for an owner-approved disposable-only compatibility baseline or a forward repair, with explicit schema/default/constraint/RLS/grant semantics and clean-replay evidence.

### Live SMM containment
- Read-only Supabase inspection: project `moyhiluyhjsujhwlyeuu`; deployed `smm-gateway` ACTIVE v8, `verify_jwt=true`, SHA-256 `c16d88610845d8dbab5ee40f366452a40e9cc021df487d45ebcd8077199ee40f`.
- The deployed source does not contain `MNTY_SMM_ENABLED` / `SMM_POST_LAUNCH_DEFERRED`. The candidate source has the deny gate before authentication/actions, bounded provider timeout, and explicit handling for unknown wallet/provider/persistence outcomes; this is source evidence only, not live containment.
- Issue [#212](https://github.com/islamnagy2022-eng/MantiqaTiX/issues/212) remains OPEN / P0. Do not deploy without explicit production change authorization; after approval, verify live version/hash and negative runtime tests proving no order, wallet debit/refund, database write, or provider call while disabled.

### Production and release restrictions
- Live migration ledger: 283 entries, last `20261008222845` / RC424.
- No production migration, Edge Function deployment, PR merge, Auth/RLS/GRANT/secret change, wallet/payment mutation, or backup/restore operation was performed in this continuation.
- Backup/restore, full tenant isolation, complete finance/webhook E2E, and final production configuration evidence remain NOT VERIFIED.
