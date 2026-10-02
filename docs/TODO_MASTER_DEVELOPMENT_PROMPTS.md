# MantiqatiX / MNTY — MASTER DEVELOPMENT TODO & CONTINUATION PROMPTS

هذا هو سجل الاستمرار الإلزامي. قبل أي موديول جديد: أضف Prompt كامل A-to-Z هنا، ثم نفذ Analyze → Impact → Implement → Integrate → Test → Security → Verify → Release → Monitor → New Baseline.

## MASTER PROMPT
اعمل على المشروع القائم وآخر Baseline، ولا تعِد البناء من الصفر. افحص الكود والـDB والـEdge Functions وRLS والصلاحيات والـTODO قبل أي تعديل. لا تعتبر الكود دليل اكتمال. نفذ كل موديول كاملًا من UI إلى Backend/DB/Auth/RLS/Payments/Audit/QA/Release عند الحاجة، ولا تستخدم بيانات وهمية أو service_role في المتصفح. أي وظيفة مدفوعة يجب أن تستخدم سعرًا مصدره الخادم، pricing snapshot/hash، idempotency، payment state وfulfillment state. أي استخدام للموقع يكون Purpose Limited وPermission Aware وAccess Controlled وLogged وSecure. أي تغيير في Shared Backend/DB/Business Logic يجب تقييم أثره على Website/App/Admin. عند وجود نقص، أضفه هنا ولا تتغافل عنه.

## 1. CORE / ARCHITECTURE
Prompt: راجع المعمارية الموحدة Website + Admin + Backend/API + Database + Business Logic، واكتشف التكرار والانفصال والمسارات غير الموصولة، ثم أصلحها دون كسر الموجود مع dependency map واختبارات.

## 2. WEBSITE / MODULE PAGES / ROUTING
Prompt: اجعل كل قطاع صفحة مستقلة Dynamic من Home → Category → Provider Profile → Service/Catalog → Booking/Order. استخدم hash routing المتوافق مع GitHub Pages، وادعم Refresh وBack/Forward وdeep links، مع loading/empty/error/accessibility وبيانات حية فقط.

## 3. ADD ACTIVITY
Prompt: اجعل «إضافة نشاط» Modal حقيقية تجمع البيانات اللازمة وتستخدم onboarding الحالي الآمن، مع Draft للزائر، Auth، validation، duplicate protection، approval، status tracking، وبدون إنشاء مباشر من browser.

## 4. ACCOUNT / PROFILE
Prompt: أكمل حسابي: الهوية والصورة وحالة الدخول والعضويات والأدوار والنشاط والطلبات والمحفظة والسلة والإشعارات والإعدادات، مع الفصل بين الشخص والنشاط وحماية RLS وعدم عرض UUIDs.

## 5. PUBLIC PROVIDER PROFILE
Prompt: أنشئ ملف نشاط عام مستقل يعرض فقط البيانات المنشورة والمعتمدة، ويشمل الهوية والصورة والتحقق والقطاع والخدمات والنطاق والفروع والطلب/الحجز والمشاركة، مع أدوات المالك فقط عند تحقق الصلاحية.

## 6. PAID PORTFOLIO
Prompt: من حساب المستخدم اعرض باقات Portfolio من digital_page_products، وثبّت السعر من الخادم، وأنشئ digital_page_order عبر Edge Function محمية مع idempotency وpricing_hash، ثم payment intent آمن، ولا تعتبر الدفع نشرًا. أكمل fulfillment REQUESTED → IN_REVIEW → IN_PROGRESS → PUBLISHED/REJECTED/CANCELLED، واربط الصفحة بحساب المالك.

## 7. PAID MENU
Prompt: للمطاعم والكافيهات ومقدمي الخدمات المؤهلين، اعرض باقات MENU من الخادم بعد اعتماد النشاط والصلاحية. طبّق pricing_hash/idempotency/payment/tenant scope/audit. بعد الدفع والنشر تكون Menu عامة مستقلة مرتبطة بالنشاط، وتدعم QR/share link والتصنيفات والعناصر والأسعار والصور وحالة النشر.

## 8. DIGITAL PAGE FULFILLMENT / CMS
Prompt: أكمل ما بعد الدفع: جمع المحتوى، draft/preview، review، approval، publish، edit، suspend، expiry، renewal، versioning، owner/scope، audit. لا تنشر صفحة غير مصرح بها.

## 9. WALLET / CART / ORDERS
Prompt: راجع السلة والمحفظة والطلبات كمنظومة مالية واحدة؛ الأسعار النهائية من الخادم، ومنع التلاعب بالكمية والسعر والـbusiness/branch/catalog، idempotency، checkout/payment state، cross-tenant isolation، وإعادة الإرسال الآمن.

## 10. MARKETING / ADS
Prompt: راجع التسويق والإعلانات والعملاء المحتملين والباقات والاستهداف والقياس والموافقات، مع tenant scope وsanitized public ads وعدم جعل فشل ad RPC يمنع الكتالوج.

## 11. CRM
Prompt: أكمل customer profile/interactions/leads/requests/notes/status/ownership/tenant isolation/consent/audit/search/reporting/export وفق الصلاحيات.

## 12. PROVIDERS / SECTORS
Prompt: راجع taxonomy وprovider kinds وspecialties وprovider-service relations، واجعل كل قطاع تجربة تشغيل مناسبة دون فرض نموذج واحد على الجميع.

## 13. DATABASE / RLS / SECURITY
Prompt: راجع RLS وdirect privileges وSECURITY DEFINER وgrants وJWT وCORS وtenant isolation وownership وstorage وinput validation وsecrets وaudit. لا تسكت Advisor بإلغاء الحماية؛ صنّف التحذيرات ووثق authorization evidence.

## 14. AUTH / RBAC
Prompt: راجع signup/login/logout/session/verification/roles/memberships/SUPER_ADMIN/tenant/business/branch scope، مع server-side authorization وعدم استخدام SUPER_ADMIN كـbrowser bypass.

## 15. FINANCE / PAYMENTS / SETTLEMENT
Prompt: راجع price → order → payment intent → webhook → payment state → journal → wallet/settlement → refund/cancel، مع state machine وidempotency وpricing hash وsignature verification وreconciliation ومنع double charge/settlement.

## 16. OPERATIONS / NOTIFICATIONS
Prompt: أكمل tasks/assignment/SLA/status/notifications/retries/failures/audit/tenant scope، ولا ترسل إشعارًا بلا حدث حقيقي.

## 17. CONTENT / CMS
Prompt: افصل draft/published/archived، مع review/permissions/audit/versioning وعدم نشر محتوى مستخدم قبل الحالة المطلوبة.

## 18. ANALYTICS / REPORTS
Prompt: اربط التحليلات بمصادر حقيقية، وافصل operational/marketing/financial metrics، وامنع PII، واجعل كل رقم قابلًا للتتبع.

## 19. MONITORING / INCIDENTS
Prompt: أكمل edge/auth/postgres/storage/realtime/function logs وerror aggregation وhealth/alerts وincident workflow، مع drills واقعية دون اختلاق بيانات.

## 20. BACKUP / RECOVERY / ROLLBACK
Prompt: تحقق من backup وrestore وRPO/RTO وmigration rollback وrelease rollback وstorage recovery، ولا تعتبر وجود backup دليل restore قبل الاختبار.

## 21. QA / REGRESSION
Prompt: اختبر Home وكل category وprovider profile/search/auth/account/add activity/wallet/cart/order/payment/Portfolio/Menu/mobile/desktop/accessibility/network failure/refresh/back/forward، ثم regression بعد كل release.

## 22. GITHUB PAGES / CI-CD
Prompt: كل تعديل web يمر validation/build ثم Pages deployment. راجع artifact والـpublished commit. أبلغ المستخدم دائمًا هل يلزم Run يدوي أم أن push إلى main يطلق workflow تلقائيًا، وهل يحتاج انتظار cache/Hard Refresh.

## 23. RELEASE / GOVERNANCE
Prompt: لا تعتبر Production Ready إلا بعد gates: Core/Auth/DB/Security/API/Website/Admin/Finance/CRM/Marketing/Regression/Backup/Monitoring/Production config/Build/External E2E/Rollback، مع VERIFIED أو BLOCKED لكل gate.

## 24. OPEN GATES
- independent two-user/two-tenant E2E يحتاج test identities معتمدة.
- Storage runtime E2E يحتاج users/objects اختبار.
- Paymob live/test callback E2E.
- Backup restore/RPO-RTO drill.
- Rollback drill.
- leaked-password protection يحتاج إكمالًا مدعومًا من Supabase.
- browser regression على الأجهزة والمتصفحات الفعلية.
- production monitoring/alert drill.
- Security Advisor intentional warnings تحتاج evidence.
- Performance Advisor FK indexes تحتاج workload-based review.

## 25. RULE FOR EVERY FUTURE MODULE
عند قول المستخدم «أريد موديول X»: لا تبدأ بالكود. أولًا أضف Prompt A-to-Z هنا، حدد affected systems، راجع الموجود، نفذ UI+Backend+DB+Auth+Security+Payments عند الحاجة، اختبر، وثق، ثم أصدر. لا يوجد «موجود في الكود» كبديل عن VERIFIED.

## 26. CURRENT EXECUTION LOG — RC230/RC231
- RC230: تم ربط زر إضافة نشاط بنافذة الطلب الحالية.
- RC230: تم تحسين deep-link/refresh/back-forward لصفحات category وprovider العامة.
- Live verification: digital_page_products موجودة وبها 4 باقات نشطة.
- Live verification: digital_page_orders موجودة.
- Live verification: digital-page-order-create وdigital-page-payment-intent ACTIVE.
- Portfolio/Menu موجودان في حساب المستخدم بمسار طلب ودفع محمي.
- ما بعد الدفع كـCMS/fulfillment الكامل ما زال مفتوحًا.
- Browser E2E، Paymob E2E، two-tenant E2E، backup restore، rollback، monitoring drill وleaked-password protection ما زالت gates مفتوحة.

## Definition of Done
UI + Backend + DB/RLS + Auth/RBAC + validation/errors + audit/idempotency + payment lifecycle عند الحاجة + responsive + deep-link/refresh/back/forward + CI/CD + لا بيانات وهمية + اختبار فعلي أو BLOCKED موثق + تحديث Release/Baseline/TODO.
