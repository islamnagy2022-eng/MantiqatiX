# تدقيق Supabase القائم — قراءة فقط

**تاريخ الفحص:** 10 نوفمبر 2026  
**المشروع:** `moyhiluyhjsujhwlyeuu`  
**الحالة من Supabase:** `ACTIVE_HEALTHY`  
**قاعدة التشغيل:** يعامل هذا المشروع كقاعدة الإنتاج القائمة؛ لا تستخدمه كبيئة Preview.  
**نطاق العمل:** قراءة Security/Performance Advisors وفحص تعاريف ست دوال مختارة عبر `pg_get_functiondef`. لم تنفذ أي أوامر DDL أو DML أو تغييرات Auth/RLS.

## القرار

هذه النتائج تخص مشروع Supabase القائم، ولا تثبت أن تطبيق R6 يستخدمه. فحص مصدر R6 لم يجد عميل Supabase أو تكامل Google OAuth جاهزًا. لذلك لا يُربط R6 بهذا المشروع قبل مراجعة توافق المخطط والصلاحيات وخطة فصل بيئة Preview.

## نتائج Security Advisor

| الفحص | العدد | التفسير الأولي |
|---|---:|---|
| جداول RLS مفعّل دون policies | 9 | مغلقة عبر سياسات RLS حتى تُراجع؛ قد تكون جداول داخلية عمدًا |
| SECURITY DEFINER قابل للتنفيذ من anon | 3 | تحتاج مراجعة دقيقة للنوع والغرض؛ اثنتان Trigger functions والثالثة قراءة إعلانات نشطة ومعتمدة |
| SECURITY DEFINER قابل للتنفيذ من authenticated | 67 | أعلى أولوية للمراجعة؛ لا يعني ذلك وحده وجود استغلال، لكن يجب فحص كل authorization/ownership/tenant check |
| Leaked Password Protection | تحذير واحد | Supabase Auth لا يمنع كلمات المرور المسرّبة وفق إعداد الفحص الحالي |
| Anonymous Access Policies | ظهر تحذير متكرر | أعاد Advisor عناصر متكررة؛ لا يُعامل الرقم الإجمالي على أنه عدد سياسات مستقلة قبل استخراجها والتحقق منها |

### الجداول التسعة التي ظهرت دون سياسات RLS

- `public.business_employees`
- `public.business_job_positions`
- `public.commission_rule_audit`
- `public.digital_page_payment_events`
- `public.directory_listing_claim_requests`
- `public.directory_source_permission_evidence`
- `public.platform_custom_roles`
- `public.platform_role_assignments`
- `public.public_directory_listings`

**لا تضف سياسة عامة تلقائيًا.** يجب تحديد هل كل جدول داخلي، أو API-facing، أو مخصص للوحة الإدارة؛ ثم تحديد الدور والـ ownership والـ tenant boundary المناسبين.

### الدوال التي أبلغ عنها Advisor كقابلة للتنفيذ من anon

- `assign_default_owner_to_unowned_business()` — Trigger function؛ تعريفها الحالي ينفذ تعيين مالك افتراضي آليًا.
- `capture_commission_rule_audit()` — Trigger function لتسجيل تدقيق قواعد العمولات.
- `get_mnty_targeted_advertisements(...)` — قراءة إعلانات؛ التعريف المقروء يعيد الإعلانات النشطة والمعتمدة فقط ويستخدم `search_path = ''`.

أول دالتين من نوع Trigger وليستا RPC عاديًا يعيد بيانات؛ لا يصح التعامل مع تنبيه Advisor لهما مثل دالة RPC عامة. مع ذلك، يجب مراجعة ACL/الاعتمادات قبل أي تعديل. وظيفة الإعلانات قد تكون عامة عن قصد، لكن يجب الإبقاء على قائمة الأعمدة العامة والفلاتر الصارمة فقط.

### الدوال السبع والستون التي أبلغ Advisor أن authenticated يمكنه تنفيذها

هذه قائمة مراجعة وليست اتهامًا بأن كل دالة ضعيفة:

`accept_mantigo_bid_backend`, `adjust_catalog_stock_backend`, `admin_create_global_ad`, `assign_default_owner_to_unowned_business`, `capture_commission_rule_audit`, `claim_digital_page_payment_intent_backend`, `confirm_mantigo_cash_payment_backend`, `create_catalog_warehouse_backend`, `create_education_request_backend`, `create_indrive_bid_backend`, `create_indrive_request_backend`, `create_job_backend`, `create_mantigo_bid_backend`, `create_mantigo_ride_backend`, `create_mantigo_ride_backend_v2`, `create_medical_appointment_backend`, `create_payment_intent_backend`, `expire_stale_mantigo_rides_backend`, `finalize_digital_page_payment_intent_backend`, `fulfill_digital_page_publish`, `get_mantigo_admin_dashboard_backend`, `get_mantigo_admin_financial_report_backend`, `get_mantigo_captain_earnings_backend`, `get_mnty_targeted_advertisements`, `list_mantigo_captain_rides_backend`, `list_mantigo_customer_rides_backend`, `list_open_mantigo_rides_backend`, `lock_mantigo_fare_backend`, `mantigo_rate_ride`, `mark_notifications_read_backend`, `match_mantigo_ride_backend`, `mnty_active_membership`, `mnty_business_employee_list`, `mnty_business_employee_list_scoped`, `mnty_business_employee_position_upsert`, `mnty_business_employee_upsert`, `mnty_can`, `mnty_can_platform_admin`, `mnty_commission_rule_drafts`, `mnty_platform_admin_assign_custom_role`, `mnty_platform_admin_list_audit`, `mnty_platform_admin_list_businesses`, `mnty_platform_admin_list_custom_roles`, `mnty_platform_admin_list_people`, `mnty_platform_admin_list_role_assignments`, `mnty_platform_admin_manage_business`, `mnty_platform_admin_manage_membership`, `mnty_platform_admin_upsert_custom_role`, `mnty_platform_has_permission`, `preview_commission_backend`, `preview_commission_rule_draft`, `preview_commission_rule_resolution`, `release_digital_page_payment_intent_claim_backend`, `review_mantigo_captain_application`, `set_mantigo_financial_config_backend`, `settle_mantigo_captain_backend`, `submit_job_application_backend`, `submit_mantigo_captain_application`, `update_catalog_item_status_backend`, `update_mantigo_captain_presence_backend`, `update_mantigo_trip_status_backend`, `update_medical_appointment_status_backend`, `upsert_catalog_business_profile_backend`, `upsert_catalog_item_and_price_backend`, `upsert_catalog_item_backend`, `upsert_catalog_price_backend`, `upsert_catalog_settings_backend`.

### فحص عينة من الدوال الحساسة

تم فحص تعاريف ست دوال فقط، دون تنفيذها:

- `adjust_catalog_stock_backend`: SECURITY DEFINER، وتستخدم `auth.uid()` و`auth.jwt()` ومعلومات tenant. يلزم التحقق من عضوية المستخدم في النشاط/المخزن وصحة قيمة المخزون والتكلفة ومنع تغيير tenant.
- `create_payment_intent_backend`: SECURITY DEFINER وتستخدم هوية الجلسة وبيانات tenant. يلزم التأكد من أن المبلغ يُشتق خادميًا من الطلب المعتمد ولا يؤخذ كقيمة موثوقة من العميل، مع idempotency.
- `admin_create_global_ad`: SECURITY DEFINER وتستدعي مساعد صلاحيات؛ يلزم اختبار رفض أي مستخدم غير مخول.
- `create_mantigo_ride_backend_v2`: SECURITY DEFINER وتتحقق من ارتباط `p_user_id` بهوية الجلسة وفق مؤشر التعريف؛ يلزم فحص كل انتقالات الرحلة والأدوار.
- `mnty_platform_admin_manage_business` و`mnty_platform_admin_manage_membership`: SECURITY DEFINER وتستخدمان هوية الجلسة وبيانات tenant؛ يجب اختبار صلاحيات Super Admin ونطاق المؤسسة ومنع تصعيد الدور.

هذه مؤشرات نصية من التعاريف وليست إثباتًا لاكتمال التفويض. يلزم تحليل جسم كل دالة واختبارات سلبية لكل دور.

## نتائج Performance Advisor

| الفحص | العدد | الأولوية |
|---|---:|---|
| Foreign keys بلا فهرس داعم | 132 | ترتيب حسب الجداول الأكثر استخدامًا والـ joins والحذف |
| RLS initplan يعاد تقييمه لكل صف | 375 | مراجعة استخدام `(select auth.uid())` ونظائره حيث يلائم |
| فهارس لم تُستخدم | 75 | لا تحذفها مباشرة؛ قد تكون نادرة الاستخدام أو لم ترصدها نافذة القياس |
| سياسات permissive متعددة على نفس الدور/العملية | 28 | مراجعة الدمج دون تغيير نتيجة الصلاحيات |

## ترتيب المعالجة المقترح

1. تصنيف كل SECURITY DEFINER function: Trigger داخلي، قراءة عامة، وظيفة عضو، أو وظيفة إدارة/مالية.
2. قراءة جميع التعاريف الـ67 وتسجيل: من يستطيع التنفيذ، هل تتحقق من `auth.uid()`، هل تتحقق من membership/role، هل تربط business_id وtenant_id بالمستخدم، وهل تقبل قيمًا مالية من العميل.
3. للوظائف الإدارية والمالية: اختبارات سلبية باستخدام anon ومستخدم authenticated عادي ومستخدم من tenant آخر.
4. مراجعة الوظائف العامة، وحصر أعمدتها في بيانات عامة فقط.
5. مراجعة الجداول التسعة التي لا تملك policies وتحديد إن كانت داخلية أو تحتاج سياسة دقيقة.
6. تقييم تفعيل Leaked Password Protection في Auth مع اختبار تجربة إنشاء الحسابات الحالية.
7. معالجة الأداء تدريجيًا عبر Staging وقياس فعلي؛ لا حذف فهارس أو دمج policies على الإنتاج دون خطة واختبارات.
8. بعد كل تغيير، تشغيل Supabase Security/Performance Advisors مجددًا ومقارنة النتائج.

## قيود التنفيذ

- لم يتم تعديل المشروع أو الجداول أو السياسات أو الدوال أو إعدادات Auth.
- لا يتم استخدام المشروع النشط كـ Preview لـ R6.
- لا تستخدم `REVOKE EXECUTE ON ALL FUNCTIONS` أو سياسة RLS موحدة؛ ذلك قد يكسر وظائف تشغيلية صحيحة.
- لا تنقل هذه الدوال إلى R6 قبل مراجعة التوافق المعماري واختبارات الصلاحيات.
