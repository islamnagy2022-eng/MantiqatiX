# مصفوفة الأدلة الحية — RLS للكتالوج والمخزون

**التاريخ:** 2026-10-24  
**المشروع:** Supabase ref `moyhiluyhjsujhwlyeuu`  
**نوع الفحص:** استعلامات قراءة فقط على `pg_policies` و`information_schema.columns`. لم تُنفذ أي كتابة أو migration أو تغيير صلاحيات.  
**الحالة:** خطر تفويض متعدد النطاقات يحتاج معالجة معتمدة؛ لا يُعد هذا المستند إثباتًا على وقوع تسريب بيانات.

## 1. الأدلة الحية

| الجدول | السياسة | نوع العملية | ما يفرضه الشرط الحي |
|---|---|---|---|
| `catalog_items` | `catalog_items_member_read` | SELECT | عضوية نشطة للمستخدم في نفس tenant؛ لا مقارنة صريحة بـ business أو branch |
| `catalog_item_prices` | `catalog_item_prices_member_read` | SELECT | عضوية نشطة في نفس tenant؛ لا مقارنة صريحة بنطاق العنصر المرتبط أو business |
| `inventory_transactions` | `inventory_transactions_member_read` | SELECT | عضوية نشطة في نفس tenant؛ لا مقارنة صريحة بـ business/branch/warehouse |
| `inventory_transactions` | `inventory_transactions_manager_insert` | INSERT | عضوية نشطة في tenant ودور OWNER/ADMIN/MANAGER و`created_by=auth.uid()`؛ لا مقارنة صريحة بـ business/branch/warehouse |
| `stock_balances` | `stock_balances_member_read` | SELECT | عضوية نشطة في نفس tenant؛ لا مقارنة صريحة بـ business/branch/warehouse |
| `warehouses` | `warehouses_member_read` | SELECT | عضوية نشطة في نفس tenant؛ لا مقارنة صريحة بـ business/branch |
| `warehouses` | `warehouses_manager_insert/update/delete` | كتابة | عضوية نشطة في tenant ودور OWNER/ADMIN/MANAGER؛ لا مقارنة صريحة بنطاق business/branch |

الجداول المذكورة لديها كذلك عدة سياسات restrictive تمنع الجلسات anonymous. هذه الحدود تمنع نوعًا من الوصول، لكنها لا تضيف وحدها نطاق business/branch إلى سياسات العضوية المذكورة. يجب تقييم جميع السياسات معًا.

## 2. فروق المخطط المهمة

- `catalog_items.business_id` إلزامي و`branch_id` اختياري.
- `catalog_item_prices` يحتوي `tenant_id` و`catalog_item_id` و`branch_id` اختياريًا، ولا يحتوي عمود `business_id`؛ لذا يلزم تحديد ما إذا كان النطاق يُستمد من العنصر المرتبط.
- `inventory_transactions` يحتوي `tenant_id` و`business_id` و`branch_id` و`warehouse_id`، والنطاقان الأخيران قابلان لـ NULL.
- `stock_balances` يحتوي `tenant_id` و`business_id` و`branch_id` و`warehouse_id`، و`warehouse_id` إلزامي.
- `warehouses` يحتوي `tenant_id` و`business_id` و`branch_id`؛ الفرع اختياري.
- `user_memberships` يدعم `tenant_id` و`business_id` و`branch_id` معًا، لكن سياسات القراءة والكتابة المعروضة لا تقارن إلا tenant.

## 3. الاستنتاج المحدود

المنطق الحالي لبعض السياسات أوسع من النطاق الظاهر في أعمدة business/branch/warehouse. هذا يثبت وجود **مخاطرة محتملة في حدود التفويض**، لكنه لا يثبت أن مستخدمًا قرأ بيانات خارج نطاقه بالفعل؛ يلزم اختبار بجلسات authenticated منفصلة وبيانات اصطناعية.

لا يكفي تعديل شرط SELECT فقط: يجب مراجعة سياسات INSERT/UPDATE/DELETE، وسياسات permissive/restrictive الأخرى، والـ RPCs التي تكتب هذه الجداول، وتحقق التطبيق من العضوية النشطة المختارة.

## 4. قرارات مطلوبة قبل كتابة migration

1. هل العضوية التي تحمل `business_id IS NULL` مقصود بها صلاحية tenant-wide أم يجب أن تُرفض في هذه الجداول؟
2. هل `branch_id IS NULL` يعني كل فروع النشاط، سجلًا مشتركًا، أو نطاقًا غير معروف؟
3. هل يجب أن يرث السعر نطاق business من `catalog_items`، وكيف تتعامل المنظومة مع سجل سعر ذي branch مختلف؟
4. هل صلاحية المخزون تشمل business فقط أم business + branch + warehouse؟ وكيف تُعامل حركات التحويل بين مستودعين؟
5. هل يمكن للمستخدم امتلاك أكثر من عضوية نشطة في النشاط نفسه، وكيف تُختار العضوية المطبقة؟
6. ما صلاحيات الأدوار المعتمدة لكل عملية؟ لا تفترض أن OWNER/ADMIN/MANAGER على مستوى tenant مخولون تلقائيًا لكل نشاط.
7. هل يوجد استثناء منصة موثق؟ يجب أن يستخدم حارس منصة صريحًا ومختبرًا لا شرط دور عام.

## 5. خطة الإغلاق الآمنة

- [ ] اعتماد إجابات نموذج النطاق من مالك المنتج والأمن.
- [ ] إنشاء fixture PostgreSQL معزول باثنين من business وفروع ومستودعات ومستخدمين متعددين.
- [ ] إثبات القراءة والكتابة المسموح بها والمرفوضة من جلسات authenticated حقيقية، وليس من `service_role`.
- [ ] كتابة migration جديدة فقط بعد مراجعة النموذج؛ عدم تعديل migrations التاريخية.
- [ ] إضافة اختبارات regression لـ SELECT/INSERT/UPDATE/DELETE وحالات NULL والعضوية المنتهية.
- [ ] تشغيل الاختبارات في CI وعلى staging، ثم إعادة قراءة `pg_policies` بعد التطبيق.
- [ ] فحص مسارات RPC/Edge Functions والواجهة التي تصل إلى الجداول نفسها.
- [ ] توثيق نتائج ما بعد التنفيذ قبل إعادة تقييم بوابة الإنتاج.

## 6. قرار الإطلاق

**لا تُعتبر RLS مكتملة ولا تسمح هذه الوثيقة بتفعيل الكتابة في الإنتاج.** تظل هذه المجموعة من الجداول `OPEN / NOT VERIFIED` وبوابة الإطلاق `BLOCKED / NOT CERTIFIED` حتى إغلاق القرارات والاختبارات أعلاه. لم يتم تغيير قاعدة الإنتاج خلال هذا الفحص.
