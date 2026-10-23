# جرد أولي لدوال SECURITY DEFINER المتاحة للمستخدمين — فحص حي

**التاريخ:** 2026-10-24  
**المشروع:** Supabase `moyhiluyhjsujhwlyeuu`  
**النطاق:** قراءة metadata من `pg_proc` وامتيازات EXECUTE؛ لا تعديل قاعدة البيانات.  
**الحالة:** جرد فرز أولي وليس حكمًا بأن كل دالة مكشوفة قابلة للاستغلال.

## 1. ما الذي أثبته الفحص؟

عُثر على دوال في schema `public` تحمل `SECURITY DEFINER` ويملك دور `authenticated` صلاحية EXECUTE عليها. جميع الدوال الظاهرة في الاستعلام لديها `anon_execute=false` ما عدا `get_mnty_targeted_advertisements` التي لديها `anon_execute=true` و`authenticated_execute=true`. قد يكون وصول anon إلى الإعلانات العامة مقصودًا، ويجب تأكيده من عقد البيانات العامة.

وجود EXECUTE لا يثبت وحده وجود ثغرة؛ يجب مراجعة جسم الدالة، التحقق من هوية المستدعي، نطاق البيانات، صلاحيات الجداول التي تعمل عليها، وسلوك الدالة تحت جلسات مختلفة.

## 2. أولوية المراجعة

### P0 — إصلاح/تحقق فوري

- `mnty_can_platform_admin()`
- `get_mantigo_admin_dashboard_backend`
- `get_mantigo_admin_financial_report_backend`
- `settle_mantigo_captain_backend`
- `expire_stale_mantigo_rides_backend`

هذه المجموعة مرتبطة بحدود إدارة MantiGO على مستوى المنصة. يوجد إصلاح مصدر RC449 واختبارات PostgreSQL له، وقد نجحت اختبارات RC449 في CI على commit `5663e1aefccbc5d60b31cd0c3752190cc0d562ea`. لكن قائمة الترحيلات الحية لم تثبت تطبيق RC449؛ لذلك لا يُعتبر الإصلاح نافذًا في الإنتاج بعد.

### P1 — مراجعة الهوية ونطاق البيانات

تتطلب مراجعة جسم الدالة واختبارات actor-spoofing / cross-tenant:

- `create_mantigo_ride_backend`
- `create_mantigo_ride_backend_v2`
- `create_mantigo_bid_backend`
- `accept_mantigo_bid_backend`
- `list_mantigo_captain_rides_backend`
- `list_mantigo_customer_rides_backend`
- `list_open_mantigo_rides_backend`
- `get_mantigo_captain_earnings_backend`
- `match_mantigo_ride_backend`
- `lock_mantigo_fare_backend`
- `update_mantigo_trip_status_backend`
- `update_mantigo_captain_presence_backend`
- `confirm_mantigo_cash_payment_backend`
- `review_mantigo_captain_application`
- `set_mantigo_financial_config_backend`
- `submit_mantigo_captain_application`

هذه قائمة مراجعة حسب الأثر والهوية التي تتلقاها الدوال، وليست اتهامًا بأن كل واحدة منها غير آمنة. يلزم التأكد أن أي `p_user_id` أو `p_admin_user_id` لا يُعامل كهوية موثوقة دون مطابقته مع `auth.uid()` أو حارس تفويض مناسب.

### P1 — مراجعة الدوال المالية/الدفع/النشر

- `create_payment_intent_backend`
- `claim_digital_page_payment_intent_backend`
- `finalize_digital_page_payment_intent_backend`
- `release_digital_page_payment_intent_claim_backend`
- `fulfill_digital_page_publish`
- `preview_commission_backend`
- `admin_create_global_ad`

التحقق المطلوب: ربط الطلب بالمستخدم والـ tenant/business الصحيح، idempotency، قيود الانتقال بين حالات الدفع، حماية من إعادة استخدام claim token، وتفويض إداري محدد. يجب أن تتوافق اختبارات هذه الدوال مع مسارات الواجهة وEdge Functions.

### P2 — مراجعة إعدادات search_path وامتيازات التنفيذ

في metadata الحية ظهرت دوال SECURITY DEFINER بعدة إعدادات:
- `search_path=public`
- `search_path=public, pg_temp`

هذا لا يثبت وحده قابلية الاستغلال، لكنه يستحق تدقيقًا؛ ينبغي أن تستخدم الدوال الحساسة `search_path` آمنًا ومقيدًا مع تأهيل أسماء الجداول والدوال بالمخطط عند الحاجة، وفق تصميم المشروع. لا تغيّر search_path بالجملة دون اختبار، لأن بعض الدوال قد تعتمد على سلوك resolution قائم.

## 3. خطة الإغلاق

- [ ] استخراج تعريف كل دالة من المصدر الموثوق ومقارنته بتعريف الإنتاج.
- [ ] توثيق من يستطيع تنفيذ الدالة، وما إذا كانت عامة أو authenticated أو service-role فقط، ولماذا.
- [ ] مراجعة `auth.uid()` مقابل كل actor argument، والتحقق من صلاحيات الدور والنطاق والعضوية النشطة.
- [ ] إضافة اختبارات سلبية: مستخدم غير مسجل، مستخدم مسجل بهوية أخرى، tenant آخر، دور غير مخول، عضوية منتهية، ومعرّفات مزورة.
- [ ] إضافة اختبارات إيجابية للمالك الشرعي وللمسؤول المخول فقط.
- [ ] اختبار معاملات الدفع والتسوية على التكرار والتزامن وعدم مضاعفة القيود المالية.
- [ ] مراجعة `search_path` وامتيازات EXECUTE لكل overload؛ لا يكفي اسم الدالة وحده.
- [ ] تشغيل الاختبارات في PostgreSQL معزول وstaging، ثم فحص metadata الحية بعد أي migration معتمد.
- [ ] عدم إلغاء صلاحيات أو تعديل تعريفات الإنتاج تلقائيًا اعتمادًا على هذا الجرد وحده.

## 4. قرار الإطلاق

هذا الجرد يوسّع نطاق التدقيق المطلوب ولا يغلقه. تظل بوابة الإنتاج `BLOCKED / NOT CERTIFIED` حتى مراجعة أجسام الدوال واختبار التفويض لكل مسار عالي الخطورة، وتطبيق الترحيلات المعتمدة والتحقق منها حيًا. لم تُنفّذ أي تغييرات على قاعدة الإنتاج خلال هذا الفحص.
