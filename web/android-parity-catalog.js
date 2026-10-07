/* MNTY Unified Catalog — parity layer derived from the Android RC40 module/master-data definitions.
   This file contains reference metadata only. It does NOT seed fake customers, orders, balances, medical records, or financial transactions.
   Live operational values remain authoritative in Supabase. */
(function () {
  'use strict';

  const modules = [
    {code:'RESTAURANTS',nameAr:'المطاعم',icon:'🍽️',role:'مدير مطعم',purpose:'القوائم، الطلبات، الطاولات، المطبخ، المخزون والتوصيل',websiteTables:['restaurant_menu_items','restaurant_orders','restaurant_tables','restaurant_inventory']},
    {code:'CAFES',nameAr:'كافيهات',icon:'☕',role:'مدير كافيه',purpose:'المشروبات، الجلسات الخارجية، الطاولات والزيارات',websiteTables:['restaurant_menu_items','restaurant_tables','restaurant_orders']},
    {code:'SUPERMARKET',nameAr:'سوبر ماركت',icon:'🛒',role:'مدير سوبر ماركت',purpose:'الكتالوج، الأسعار، المخزون، العروض والمبيعات',websiteTables:['catalog_items','catalog_item_prices','inventory_transactions','orders']},
    {code:'CLOTHING',nameAr:'ملابس وأزياء',icon:'👗',role:'مدير معرض أزياء',purpose:'المنتجات، المقاسات، المجموعات، الطلبات والإرجاع',websiteTables:['fashion_products','fashion_orders','fashion_tailor_services']},
    {code:'MANTIGO',nameAr:'MantiGO — النقل والرحلات',icon:'🚕',role:'كابتن',purpose:'المشاوير، العروض، اختيار العرض، التنفيذ والتقييم',websiteTables:['mantigo_rides','mantigo_bids','mantigo_ride_ratings']},
    {code:'MARRIAGE',nameAr:'الزواج',icon:'💍',role:'وكيل زواج',purpose:'الملفات، الطلبات، الترشيحات وفتح التواصل وفق النظام',websiteTables:['matrimony_profiles','matrimony_requests','matrimony_contact_unlocks']},
    {code:'JOBS',nameAr:'وظائف',icon:'💼',role:'مسؤول توظيف',purpose:'الوظائف، المتقدمون، المقابلات والمتابعة',websiteTables:['jobs','job_applications']},
    {code:'SCHOOLS',nameAr:'مدارس خاصة',icon:'🎓',role:'مدير مدرسة',purpose:'المدارس، المدرسون، الفصول وطلبات القبول',websiteTables:['school_profiles','teacher_profiles','education_requests']},
    {code:'MAINTENANCE',nameAr:'صيانة',icon:'🔧',role:'فني صيانة',purpose:'طلبات الصيانة، التخصيص، التقدير والمتابعة',websiteTables:['indrive_requests','indrive_bids','support_tickets']},
    {code:'MARKETING',nameAr:'تسويق',icon:'📣',role:'مدير تسويق',purpose:'الحملات، العملاء المحتملون، مقدمو التسويق والمشروعات',websiteTables:['marketing_leads','marketing_provider_profiles','marketing_services','marketing_projects','marketing_plans','marketing_provider_subscriptions','marketing_project_participants','marketing_commission_rules']},
    {code:'BUSINESS_ERP',nameAr:'برامج إدارة الأعمال ERP',icon:'🏢',role:'مدير أعمال',purpose:'المبيعات، المشتريات، المخزون، الفروع، التشغيل والاشتراكات',websiteTables:['businesses','erp_purchase_orders','erp_purchase_receipts','erp_stock_transfers','warehouses']},
    {code:'ACCOUNTING',nameAr:'محاسبة',icon:'🧾',role:'محاسب',purpose:'الحسابات، القيود، الأصول، الالتزامات، الفواتير والتقارير',websiteTables:['chart_of_accounts','journal_entries','general_ledger']},
    {code:'LEGAL',nameAr:'قضاء وخدمات قانونية',icon:'⚖️',role:'محامي',purpose:'الخدمات والوثائق والمتطلبات والاتفاقيات',websiteTables:['legal_documents','legal_requirements','agreements']},
    {code:'PARTNERS',nameAr:'شركاء',icon:'🤝',role:'شريك استراتيجي',purpose:'الشركاء، التعاونات ومصادر العملاء',websiteTables:['success_partners','referred_businesses']},
    {code:'ADS',nameAr:'إعلانات',icon:'📢',role:'مدير إعلانات',purpose:'الحملات، المساحات، الميزانيات والقياس',websiteTables:['advertisements','ad_campaigns']},
    {code:'TRAVEL',nameAr:'رحلات وسفر',icon:'✈️',role:'وكيل سفر',purpose:'الباقات، الوجهات، الوكلاء والحجوزات',websiteTables:['travel_packages','travel_bookings']},
    {code:'USED_ITEMS',nameAr:'مستعمل',icon:'♻️',role:'بائع',purpose:'الإعلانات، العروض، التفاوض والبيع',websiteTables:['used_item_ads']},
    {code:'PHYSIOTHERAPY',nameAr:'العلاج الطبيعي',icon:'🧘',role:'أخصائي',purpose:'خطط العلاج والجلسات والمتابعة',websiteTables:['medical_appointments','marketing_provider_profiles']},
    {code:'PHARMACIES',nameAr:'الصيدليات',icon:'💊',role:'صيدلي',purpose:'الأدوية، المخزون، الوصفات والطلبات',websiteTables:['marketing_provider_profiles','orders']},
    {code:'CLINICS',nameAr:'عيادات الأطباء',icon:'🩺',role:'طبيب',purpose:'الأطباء، التخصصات، المواعيد والمرضى',websiteTables:['marketing_provider_profiles','medical_appointments']},
    {code:'HOSPITALS',nameAr:'المستشفيات الخاصة',icon:'🏥',role:'مدير مستشفى',purpose:'الأقسام، الخدمات، الأسرة والحالات التشغيلية',websiteTables:['marketing_provider_profiles','medical_appointments']},
    {code:'LABS',nameAr:'مراكز التحاليل والأشعة',icon:'🧪',role:'فني تحاليل',purpose:'التحاليل، الأجهزة، النتائج والحجز/الاستلام',websiteTables:['marketing_provider_profiles','medical_appointments']},
    {code:'ACCOUNTING_SERVICES',nameAr:'الخدمات المحاسبية',icon:'🧾',role:'محاسب خدمات',purpose:'طلبات المحاسبة والمزايدات والخدمات المالية',websiteTables:['indrive_requests','indrive_bids']},
    {code:'COMPANIES',nameAr:'خدمات الشركات',icon:'🏢',role:'مقدم خدمات شركات',purpose:'طلبات الشركات والعروض والتنفيذ',websiteTables:['indrive_requests','indrive_bids']},
    {code:'FACTORIES',nameAr:'المصانع والخدمات الصناعية',icon:'🏭',role:'مصنع / ورشة',purpose:'طلبات التصنيع والخدمات الصناعية والمزايدات',websiteTables:['indrive_requests','indrive_bids']},
    {code:'FLIGHTS_TRIPS',nameAr:'الرحلات والسفر',icon:'✈️',role:'وكيل سفر',purpose:'طلبات السفر والرحلات والعروض',websiteTables:['indrive_requests','indrive_bids']},
    {code:'HOME_MAINTENANCE',nameAr:'خدمات المنزل والصيانة',icon:'🔧',role:'فني صيانة',purpose:'طلبات الصيانة والمعاينة والعروض',websiteTables:['indrive_requests','indrive_bids']},
    {code:'SOFTWARE_ERP',nameAr:'البرمجيات وERP',icon:'💻',role:'مزود حلول تقنية',purpose:'طلبات البرمجيات وERP والعروض المهنية',websiteTables:['indrive_requests','indrive_bids']}
  ];

  const masterData = {
    paymentChannels:[
      {code:'CASH',nameAr:'الدفع نقدياً عند الاستلام (COD)',instant:true},
      {code:'INSTAPAY',nameAr:'تحويل فوري عبر إنستاباي (InstaPay)',instant:true},
      {code:'FAWRY',nameAr:'فوري والمحافظ الإلكترونية (Fawry / Wallets)',instant:true},
      {code:'CARD',nameAr:'بطاقة بنكية / فيزا وماستركارد',instant:true},
      {code:'WALLET',nameAr:'محفظة MantiqatiX الرقمية',instant:true}
    ],
    units:[
      {code:'PIECE',nameAr:'قطعة',symbolAr:'ق'},
      {code:'KG',nameAr:'كيلوجرام',symbolAr:'كجم'},
      {code:'GRAM',nameAr:'جرام',symbolAr:'جم'},
      {code:'LITER',nameAr:'لتر',symbolAr:'لتر'},
      {code:'METER',nameAr:'متر',symbolAr:'م'},
      {code:'HOUR',nameAr:'ساعة عمل',symbolAr:'ساعة'},
      {code:'SERVICE',nameAr:'خدمة / معاينة',symbolAr:'خدمة'}
    ],
    taxRates:[
      {code:'VAT_14',nameAr:'ضريبة القيمة المضافة (VAT)',percentage:14},
      {code:'ZERO_TAX',nameAr:'معفى ضريبياً (0%)',percentage:0}
    ],
    currencies:[
      {code:'EGP',nameAr:'جنيه مصري',symbolAr:'ج.م'},
      {code:'SAR',nameAr:'ريال سعودي',symbolAr:'ر.س'},
      {code:'USD',nameAr:'دولار أمريكي',symbolAr:'$'}
    ],
    jobCategories:[
      {code:'TECH',nameAr:'البرمجة وتقنية المعلومات',nameEn:'Technology & IT',samples:['مطور برمجيات','مصمم واجهات UI/UX','مسؤول شبكات']},
      {code:'SALES',nameAr:'المبيعات والتسويق',nameEn:'Sales & Marketing',samples:['مسؤول مبيعات عقارية','مسوق إلكتروني','مندوب دعاية طبية']},
      {code:'HEALTH',nameAr:'الرعاية الصحية والتمريض',nameEn:'Healthcare & Nursing',samples:['طبيب أخصائي','صيدلي أول','أخصائي تمريض']},
      {code:'EDUCATION',nameAr:'التدريس والتعليم',nameEn:'Education & Tutoring',samples:['معلم لغة عربية','مدرس رياضيات ولغات','أستاذ مواد علمية']},
      {code:'FINANCE',nameAr:'المحاسبة والمالية',nameEn:'Accounting & Finance',samples:['محاسب عام','محاسب قانوني','مراجع حسابات']},
      {code:'TRADES',nameAr:'الفنيون والحرفيون والسائقون',nameEn:'Trades & Logistics',samples:['سائق رخصة مهنية','فني تكييف وتبريد','فني كهرباء منازل']}
    ],
    propertyTypes:[
      {code:'APT_RES',nameAr:'شقة سكنية',commercial:false,rent:true,sale:true},
      {code:'VILLA',nameAr:'فيلا / تاون هاوس',commercial:false,rent:true,sale:true},
      {code:'SHOP',nameAr:'محل تجاري / معرض',commercial:true,rent:true,sale:true},
      {code:'OFFICE',nameAr:'مقر إداري / عيادة',commercial:true,rent:true,sale:true},
      {code:'LAND_BLD',nameAr:'أرض بناء / سكنية',commercial:false,rent:false,sale:true},
      {code:'LAND_AGR',nameAr:'أرض زراعية / استثمارية',commercial:true,rent:true,sale:true},
      {code:'WAREHOUSE',nameAr:'مخزن / مصنع / هناجر',commercial:true,rent:true,sale:true}
    ],
    medicalSpecialties:[
      {code:'DENTAL',nameAr:'طب وجراحة الأسنان',nameEn:'Dentistry',license:true},
      {code:'INTERNAL',nameAr:'أمراض الباطنة والسكر',nameEn:'Internal Medicine',license:true},
      {code:'PEDIATRICS',nameAr:'طب الأطفال وحديثي الولادة',nameEn:'Pediatrics',license:true},
      {code:'ORTHO',nameAr:'جراحة العظام والمفاصل',nameEn:'Orthopedics',license:true},
      {code:'OPHTHALMOLOGY',nameAr:'طب وجراحة العيون',nameEn:'Ophthalmology',license:true},
      {code:'CARDIO',nameAr:'أمراض القلب والأوعية الدموية',nameEn:'Cardiology',license:true},
      {code:'DERMATOLOGY',nameAr:'الجلدية والتجميل والليزر',nameEn:'Dermatology',license:true},
      {code:'ENT',nameAr:'أنف وأذن وحنجرة',nameEn:'ENT',license:true},
      {code:'OBS_GYN',nameAr:'النساء والتوليد والحقن المجهري',nameEn:'Obstetrics & Gynecology',license:true}
    ],
    weddingCategories:[
      {code:'HALLS',nameAr:'قاعات الأفراح والمناسبات'},
      {code:'ATELIER',nameAr:'أتيليهات فساتين الزفاف وبدل العرسان'},
      {code:'BEAUTY',nameAr:'خبراء التجميل والميكب أرتست'},
      {code:'PHOTO',nameAr:'استوديوهات التصوير الفوتوغرافي والفيديو'},
      {code:'FURNITURE',nameAr:'معارض الأثاث والمفروشات'},
      {code:'APPLIANCES',nameAr:'الأجهزة الكهربائية والمنزلية'},
      {code:'CARS',nameAr:'تأجير وتزيين سيارات الزفاف'}
    ]
  };

  const roleMappings = [
    ['مدير مطعم','RESTAURANTS'],['مدير كافيه','CAFES'],['مدير سوبر ماركت','SUPERMARKET'],['مدير معرض أزياء','CLOTHING'],
    ['كابتن','MANTIGO'],['وكيل زواج','MARRIAGE'],['مسؤول توظيف','JOBS'],['مدير مدرسة','SCHOOLS'],['فني صيانة','MAINTENANCE'],
    ['مدير تسويق','MARKETING'],['مدير أعمال','BUSINESS_ERP'],['محاسب','ACCOUNTING'],['محامي','LEGAL'],['شريك استراتيجي','PARTNERS'],
    ['مدير إعلانات','ADS'],['وكيل سفر','TRAVEL'],['بائع','USED_ITEMS'],['أخصائي','PHYSIOTHERAPY'],['صيدلي','PHARMACIES'],
    ['طبيب','CLINICS'],['مدير مستشفى','HOSPITALS'],['فني تحاليل','LABS']
  ].map(([role,module])=>({role,module}));

  const enterpriseCoreModules = [
    {code:'mod_restaurants',nameAr:'المطاعم والكافيهات',icon:'🍔',description:'إدارة القوائم، الحجوزات، الدليفري وتجهيز الطلبات'},
    {code:'mod_mantigo',nameAr:'MantiqatiX النقل والرحلات',icon:'🚕',description:'حجز المشاوير والتوصيل والنقل'},
    {code:'mod_medical',nameAr:'المجمع الطبي والصيدليات',icon:'🩺',description:'العيادات والمواعيد والصيدليات وتوصيل الأدوية'},
    {code:'mod_grocery',nameAr:'السوبرماركت والمقاضي',icon:'🛒',description:'المقاضي والمواد الغذائية والعروض'},
    {code:'mod_services',nameAr:'الخدمات والصيانة',icon:'🔧',description:'الفنيون والحرفيون وخدمات المنزل والسيارات'},
    {code:'mod_fashion',nameAr:'الأزياء والموضة',icon:'👗',description:'الملابس والأحذية والإكسسوارات والعروض'},
    {code:'mod_hotels',nameAr:'الفنادق والسياحة',icon:'🏨',description:'الإقامة والرحلات والشقق الفندقية'},
    {code:'mod_education',nameAr:'الأكاديميات والتعليم',icon:'🎓',description:'المدارس والأكاديميات والحصص'}
  ];

  const operationalRoles = [
    ['ROLE_CAPTAIN','كابتن توصيل وركوب','تشغيلي'],['ROLE_TECHNICIAN','فني صيانة ومعاينة','فني'],
    ['ROLE_CASHIER','كاشير ومسؤول نقطة بيع','مالي'],['ROLE_CHEF','شيف ومجهز طعام','تشغيلي'],
    ['ROLE_PHARMACIST','صيدلي / مقدم خدمة طبي','طبي'],['ROLE_RECEPTION','موظف استقبال وحجوزات','إداري'],
    ['ROLE_MANAGER','مدير فرع / متجر','إداري']
  ].map(([code,nameAr,category])=>({code,nameAr,category}));

  const permissionCatalog = [
    {code:'MOD_REST_EDIT',nameAr:'تعديل قائمة المأكولات والأسعار',module:'المطاعم'},
    {code:'MANTIGO_PRICING',nameAr:'تعديل تسعير المشاوير',module:'MantiGO'},
    {code:'MEDICAL_APPOINTMENTS',nameAr:'إدارة مواعيد الكشوفات الطبية',module:'المنظومة الطبية'},
    {code:'FINANCE_WITHDRAW',nameAr:'اعتماد وتحويل طلبات سحب الأرباح',module:'المالية'}
  ];

  window.MNTY_UNIFIED_CATALOG = Object.freeze({
    source:'Android RC40 reference catalog',
    version:'RC40-parity-2026-09-27',
    modules:Object.freeze(modules),
    masterData:Object.freeze(masterData),
    roleMappings:Object.freeze(roleMappings),
    enterpriseCoreModules:Object.freeze(enterpriseCoreModules),
    operationalRoles:Object.freeze(operationalRoles),
    permissionCatalog:Object.freeze(permissionCatalog)
  });

  function esc(v){return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function renderCatalog(){
    const c=window.MNTY_UNIFIED_CATALOG;
    const cards=c.modules.map(m=>'<article class="card"><div class="card-title">'+m.icon+' '+esc(m.nameAr)+'</div><div class="muted">'+esc(m.purpose)+'</div><div class="muted" style="margin-top:8px">الدور المرجعي: '+esc(m.role)+'</div><div class="muted" style="margin-top:8px">جداول الربط: '+esc(m.websiteTables.join('، '))+'</div></article>').join('');
    const master=(title,items,fn)=>'<section class="workspace-section"><h2>'+title+'</h2><div class="cards">'+items.map(fn).join('')+'</div></section>';
    return '<div class="workspace-head"><div><div class="eyebrow">UNIFIED CATALOG</div><h1>كتالوج المنصة الموحد</h1><p class="muted">تجميع تعريفات الوحدات والبيانات الرئيسية المستخدمة في نسخة التطبيق مع ربطها ببيانات الموقع. هذه تعريفات مرجعية وليست سجلات تشغيلية وهمية.</p></div></div>'+
      '<section class="workspace-section"><h2>الوحدات التشغيلية ('+c.modules.length+')</h2><div class="cards">'+cards+'</div></section>'+
      master('قنوات الدفع المرجعية',c.masterData.paymentChannels,x=>'<article class="card"><div class="card-title">'+esc(x.nameAr)+'</div><div class="muted">'+esc(x.code)+'</div></article>')+
      master('وحدات القياس',c.masterData.units,x=>'<article class="card"><div class="card-title">'+esc(x.nameAr)+' ('+esc(x.symbolAr)+')</div><div class="muted">'+esc(x.code)+'</div></article>')+
      master('التخصصات الطبية المرجعية',c.masterData.medicalSpecialties,x=>'<article class="card"><div class="card-title">'+esc(x.nameAr)+'</div><div class="muted">'+esc(x.nameEn)+'</div></article>')+
      master('فئات الوظائف',c.masterData.jobCategories,x=>'<article class="card"><div class="card-title">'+esc(x.nameAr)+'</div><div class="muted">'+esc(x.nameEn)+'</div></article>')+
      master('أنواع العقارات',c.masterData.propertyTypes,x=>'<article class="card"><div class="card-title">'+esc(x.nameAr)+'</div><div class="muted">'+(x.commercial?'تجاري':'غير تجاري')+' · '+(x.rent?'إيجار':'بدون إيجار')+' · '+(x.sale?'بيع':'بدون بيع')+'</div></article>')+
      master('فئات الزواج',c.masterData.weddingCategories,x=>'<article class="card"><div class="card-title">'+esc(x.nameAr)+'</div><div class="muted">'+esc(x.code)+'</div></article>')+
      master('ربط الأدوار بالوحدات',c.roleMappings,x=>'<article class="card"><div class="card-title">'+esc(x.role)+'</div><div class="muted">'+esc(x.module)+'</div></article>')+
      master('أدوار التشغيل المرجعية',c.operationalRoles,x=>'<article class="card"><div class="card-title">'+esc(x.nameAr)+'</div><div class="muted">'+esc(x.category)+' · '+esc(x.code)+'</div></article>')+
      master('صلاحيات الوحدات المرجعية',c.permissionCatalog,x=>'<article class="card"><div class="card-title">'+esc(x.nameAr)+'</div><div class="muted">'+esc(x.module)+' · '+esc(x.code)+'</div></article>')+
      '<div class="notice">تنبيه مالي: أسعار الصرف وقيم المعاملات لا تُستخدم من هذا الكتالوج. الحسابات والدفع والتسويات تظل خاضعة لبيانات Supabase الموثوقة والخدمات الخلفية.</div>';
  }

  function install(){
    if(!window.MNTY_UNIFIED_CATALOG)return;
    const addNav=()=>{
      const nav=document.querySelector('.nav');
      if(!nav || nav.querySelector('[data-mnty-unified-catalog]'))return;
      const btn=document.createElement('button');
      btn.type='button';btn.dataset.mntyUnifiedCatalog='1';
      btn.innerHTML='<span>🧬</span><span>الكتالوج الموحد</span>';
      btn.onclick=()=>{
        document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
        const page=document.getElementById('page');
        if(page)page.innerHTML=renderCatalog();
      };
      nav.insertBefore(btn,nav.children[1]||null);
    };
    const observer=new MutationObserver(addNav);
    observer.observe(document.body,{childList:true,subtree:true});
    addNav();
    window.MNTYRenderUnifiedCatalog=renderCatalog;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();