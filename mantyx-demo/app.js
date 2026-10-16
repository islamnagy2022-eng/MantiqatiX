(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = { view:"overview", query:"", extras:[], notice:true };
  const navNames = {
    overview:"نظرة عامة",orders:"الطلبات",customers:"العملاء وCRM",providers:"مقدمو الخدمات",catalog:"القطاعات والكتالوج",
    smm:"التسويق الإلكتروني SMM",finance:"المالية والمحافظ",inventory:"المخزون والمشتريات",content:"المحتوى والمنصة",
    analytics:"التحليلات والتقارير",tasks:"العمليات والمهام",notifications:"الإشعارات",users:"المستخدمون والصلاحيات",
    security:"الأمان وسجل التدقيق",monitoring:"المراقبة والنسخ الاحتياطي",settings:"الإعدادات"
  };
  const orders = [
    {id:"MX-1048",customer:"شركة النور",service:"صيانة تكييف",provider:"مركز التميز",amount:"1,250 ج.م",status:"قيد التنفيذ",kind:"pending",date:"16 أكتوبر 2026"},
    {id:"MX-1047",customer:"أحمد سامي",service:"تنظيف منزل",provider:"خدمات البيت",amount:"850 ج.م",status:"مكتمل",kind:"success",date:"16 أكتوبر 2026"},
    {id:"MX-1046",customer:"مكتب المدار",service:"تصميم هوية",provider:"ستوديو نقطة",amount:"3,600 ج.م",status:"بانتظار التأكيد",kind:"info",date:"15 أكتوبر 2026"},
    {id:"MX-1045",customer:"سارة محمود",service:"صيانة سباكة",provider:"فني موثوق",amount:"620 ج.م",status:"مكتمل",kind:"success",date:"15 أكتوبر 2026"},
    {id:"MX-1044",customer:"متجر المدينة",service:"إدارة حملة إعلانية",provider:"Mantyx Digital",amount:"5,000 ج.م",status:"مراجعة مالية",kind:"pending",date:"14 أكتوبر 2026"}
  ];
  const customers = [
    {name:"شركة النور",type:"شركة",contact:"demo.nour@example.test",orders:"18",value:"24,800 ج.م",status:"نشط",kind:"success"},
    {name:"أحمد سامي",type:"فرد",contact:"ahmed.demo@example.test",orders:"7",value:"5,420 ج.م",status:"نشط",kind:"success"},
    {name:"مكتب المدار",type:"شركة",contact:"orbit.demo@example.test",orders:"12",value:"31,600 ج.م",status:"متابعة",kind:"pending"},
    {name:"سارة محمود",type:"فرد",contact:"sara.demo@example.test",orders:"3",value:"1,950 ج.م",status:"نشط",kind:"success"}
  ];
  const providers = [
    {name:"مركز التميز",sector:"الصيانة المنزلية",city:"القاهرة",orders:"36",rating:"4.8",status:"معتمد",kind:"success"},
    {name:"خدمات البيت",sector:"التنظيف",city:"الجيزة",orders:"28",rating:"4.7",status:"معتمد",kind:"success"},
    {name:"ستوديو نقطة",sector:"التصميم والتسويق",city:"طنطا",orders:"19",rating:"4.9",status:"قيد المراجعة",kind:"pending"},
    {name:"فني موثوق",sector:"السباكة والكهرباء",city:"شبين الكوم",orders:"14",rating:"4.6",status:"معتمد",kind:"success"}
  ];
  const campaigns = [
    {name:"حملة الوعي — أكتوبر",channel:"Meta Ads",budget:"12,000 ج.م",spent:"7,450 ج.م",leads:"184",status:"نشطة",kind:"success"},
    {name:"إطلاق خدمة جديدة",channel:"Instagram",budget:"5,000 ج.م",spent:"2,180 ج.م",leads:"73",status:"نشطة",kind:"success"},
    {name:"إعادة الاستهداف",channel:"Google Ads",budget:"8,000 ج.م",spent:"8,000 ج.م",leads:"91",status:"مكتملة",kind:"info"}
  ];
  const sectors = [
    {name:"الخدمات المنزلية",code:"SEC-001",services:"48",providers:"26",status:"نشط",kind:"success"},
    {name:"التسويق والتصميم",code:"SEC-002",services:"32",providers:"18",status:"نشط",kind:"success"},
    {name:"الصيانة والتقنية",code:"SEC-003",services:"27",providers:"15",status:"نشط",kind:"success"},
    {name:"الأعمال والتوريدات",code:"SEC-004",services:"21",providers:"9",status:"مراجعة",kind:"pending"}
  ];
  const activities = [
    ["▤","طلب جديد","تم تسجيل الطلب التجريبي MX-1048","منذ 8 دقائق"],
    ["♙","مراجعة مقدم خدمة","طلب اعتماد ستوديو نقطة","منذ 24 دقيقة"],
    ["◈","مراجعة مالية","حركة مالية تجريبية تنتظر الاعتماد","منذ 41 دقيقة"],
    ["◉","حملة تسويقية","تحديث نتائج حملة الوعي — أكتوبر","منذ ساعة"]
  ];
  const statData = [
    ["الطلبات خلال الشهر","1,284","↑ 12.8%","blue","▤"],
    ["حجم العمليات التجريبي","284.6K","↑ 8.4%","teal","◈"],
    ["العملاء المسجلون","3,642","↑ 6.2%","purple","♙"],
    ["مقدمو الخدمات","486","↑ 4.7%","orange","⌂"]
  ];
  function status(text,kind="info"){return '<span class="status '+kind+'">'+text+'</span>'}
  function panelHead(title,sub="",right=""){return '<div class="panel-head"><div><h2>'+title+'</h2>'+(sub?'<div class="panel-subtitle">'+sub+'</div>':"")+'</div>'+right+'</div>'}
  function table(headers, rows){return '<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join("")+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+c+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>'}
  function person(name,sub){return '<div class="cell-primary">'+name+'</div><div class="cell-secondary">'+sub+'</div>'}
  function stats(items=statData){return '<div class="stats-grid">'+items.map((x,i)=>'<div class="stat-card"><div class="stat-top"><span>'+x[0]+'</span><span class="stat-icon '+x[3]+'">'+x[4]+'</span></div><div class="stat-value">'+x[1]+'</div><div class="stat-foot"><span class="trend">'+x[2]+'</span><span>مقارنة بالفترة السابقة</span></div></div>').join("")+'</div>'}
  function chart(){return '<section class="panel">'+panelHead("حركة الطلبات","مؤشر شهري تجريبي",'<select class="select-small" aria-label="الفترة"><option>آخر 7 أشهر</option><option>آخر 30 يومًا</option></select>')+'<div class="chart-area">'+[[34,48],[42,62],[58,43],[51,75],[65,57],[74,86],[58,69]].map((v,i)=>'<div class="chart-col"><div class="bar" style="height:'+v[0]+'%"></div><div class="bar alt" style="height:'+v[1]+'%"></div><span class="chart-label">'+["أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر"][i]+'</span></div>').join("")+'</div><div class="chart-legend"><span><i class="legend-dot" style="background:#dce5ff"></i>طلبات جديدة</span><span><i class="legend-dot" style="background:#5075ec"></i>طلبات مكتملة</span></div></section>'}
  function donut(){return '<section class="panel">'+panelHead("توزيع القطاعات","حسب الطلبات المسجلة")+'<div class="donut-wrap"><div class="donut"><div class="donut-center"><b>1,284</b><span>طلب تجريبي</span></div></div><div class="legend-list">'+[['#456ce5','الخدمات المنزلية','41%'],['#16b5a5','التسويق والتصميم','26%'],['#9a77e7','الصيانة والتقنية','17%'],['#f3b85d','قطاعات أخرى','16%']].map(x=>'<div class="legend-row"><i class="legend-dot" style="background:'+x[0]+'"></i><span>'+x[1]+'</span><b>'+x[2]+'</b></div>').join("")+'</div></div><div class="metric-note">هذه الرسوم توضيحية مبنية على بيانات مولّدة للاختبار، ولا تمثل أداء المنصة الفعلي.</div></section>'}
  function recentOrders(){return '<section class="panel table-panel">'+panelHead("أحدث الطلبات","عينة من دورة الطلب والتشغيل",'<button class="text-link" data-view="orders">عرض الكل ←</button>')+table(["رقم الطلب","العميل / الخدمة","مقدم الخدمة","القيمة","الحالة"],orders.slice(0,4).map(o=>['<b class="cell-primary">'+o.id+'</b>',person(o.customer,o.service),o.provider,o.amount,status(o.status,o.kind)]))+'</section>'}
  function activityPanel(){return '<section class="panel">'+panelHead("آخر النشاطات","سجل تشغيلي توضيحي")+'<div class="activity-list">'+activities.map(a=>'<div class="activity"><span class="activity-icon">'+a[0]+'</span><div class="activity-text"><b>'+a[1]+'</b><br>'+a[2]+'<div class="activity-time">'+a[3]+'</div></div></div>').join("")+'</div></section>'}
  function overview(){return stats()+'<div class="dashboard-grid">'+chart()+donut()+'</div><div class="dashboard-grid">'+recentOrders()+activityPanel()+'</div>'}
  function moduleTable(view){
    if(view==="orders")return {desc:"متابعة دورة الطلب من الإنشاء حتى الإغلاق، مع إبقاء الدفع والتسوية تحت ضوابط مستقلة.",heads:["رقم الطلب","العميل / الخدمة","مقدم الخدمة","القيمة","تاريخ الإنشاء","الحالة"],rows:orders.map(o=>['<b class="cell-primary">'+o.id+'</b>',person(o.customer,o.service),o.provider,o.amount,o.date,status(o.status,o.kind)])};
    if(view==="customers")return {desc:"سجل العملاء المحتملين والعملاء الحاليين، وملخص العلاقة والقيمة التشغيلية — بيانات تجريبية.",heads:["العميل","النوع","بريد تجريبي","الطلبات","القيمة التراكمية","الحالة"],rows:customers.map(x=>[person(x.name,x.type),x.type,x.contact,x.orders,x.value,status(x.status,x.kind)])};
    if(view==="providers")return {desc:"إدارة ملفات مقدمي الخدمات والقطاعات ومناطق الخدمة وحالات الاعتماد.",heads:["مقدم الخدمة","القطاع","المدينة","الطلبات","التقييم","الحالة"],rows:providers.map(x=>[x.name,x.sector,x.city,x.orders,"★ "+x.rating,status(x.status,x.kind)])};
    if(view==="catalog")return {desc:"كتالوج موحد للقطاعات والخدمات؛ السعر النهائي يجب أن يحدده الخادم وليس المتصفح.",heads:["القطاع","رمز القطاع","الخدمات","مقدمو الخدمات","الحالة"],rows:sectors.map(x=>[x.name,x.code,x.services,x.providers,status(x.status,x.kind)])};
    if(view==="smm")return {desc:"مساحة وكالة التسويق: الحملات، القنوات، الميزانية، الإنفاق، العملاء المحتملون. لا توجد مفاتيح مزودين أو حسابات إعلانية حقيقية في هذه البيئة.",heads:["الحملة","القناة","الميزانية","الإنفاق التجريبي","Leads","الحالة"],rows:campaigns.map(x=>[x.name,x.channel,x.budget,x.spent,x.leads,status(x.status,x.kind)])};
    if(view==="finance")return {desc:"ملخص للدفتر والمحافظ والخصومات والاستردادات والتسويات. كل الأرصدة أدناه افتراضية وغير قابلة للتحويل.",heads:["المرجع","النوع","الحساب","القيمة التجريبية","التاريخ","الحالة"],rows:[["FIN-DEMO-091","تحصيل طلب","محفظة تجريبية","1,250 ج.م","16 أكتوبر",status("معلق","pending")],["FIN-DEMO-090","عمولة منصة","دفتر العمولة","125 ج.م","16 أكتوبر",status("مراجع","success")],["FIN-DEMO-089","استرداد تجريبي","محفظة تجريبية","−300 ج.م","15 أكتوبر",status("محاكاة","info")],["FIN-DEMO-088","تسوية مقدم خدمة","مستحقات","4,820 ج.م","14 أكتوبر",status("بانتظار","pending")]]};
    if(view==="inventory")return {desc:"متابعة الأصناف والمخزون والمشتريات والاستلامات مع إبقاء كل العمليات في وضع المحاكاة.",heads:["الصنف","SKU","المخزن","المتاح","حد إعادة الطلب","الحالة"],rows:[["فلتر هواء","INV-001","المخزن الرئيسي","42","10",status("متوفر","success")],["كابل توصيل","INV-002","مخزن الفرع","8","12",status("إعادة طلب","pending")],["مواد تنظيف","INV-003","المخزن الرئيسي","126","20",status("متوفر","success")],["قطعة غيار","INV-004","مخزن الصيانة","0","5",status("نفد المخزون","danger")]]};
    if(view==="content")return {desc:"إدارة الصفحات والمحتوى والإعلانات والمواد التحريرية قبل النشر.",heads:["العنوان","النوع","المالك","آخر تحديث","الحالة"],rows:[["الصفحة الرئيسية","صفحة عامة","فريق المحتوى","16 أكتوبر",status("مسودة مراجعة","pending")],["دليل مقدمي الخدمات","كتالوج","إدارة المنصة","15 أكتوبر",status("منشور تجريبي","success")],["سياسة الخصوصية","سياسة","الحوكمة","14 أكتوبر",status("تحتاج مراجعة","pending")]]};
    if(view==="analytics")return {desc:"تقارير تعتمد مستقبلًا على مصادر البيانات المعتمدة، مع نطاقات المؤسسة والدور ووقت استخراج التقرير.",heads:["التقرير","النطاق","آخر تحديث","المصدر","الحالة"],rows:[["ملخص الطلبات","شهري","16 أكتوبر","Orders (demo)",status("معاينة","info")],["أداء الحملات","شهري","16 أكتوبر","SMM (demo)",status("معاينة","info")],["ملخص مالي","شهري","15 أكتوبر","Ledger (demo)",status("مراجعة","pending")]]};
    if(view==="tasks")return {desc:"قائمة أعمال تشغيلية مع الأولوية والمالك وتاريخ الاستحقاق.",heads:["المهمة","المسؤول","الأولوية","الاستحقاق","الحالة"],rows:[["مراجعة طلب اعتماد مقدم خدمة","فريق التشغيل","عالية","اليوم",status("قيد التنفيذ","pending")],["اختبار مسار استرداد المحفظة","الفريق التقني","حرجة","قبل الإطلاق",status("محظورة حتى الاختبار","danger")],["مراجعة محتوى صفحة الخدمة","فريق المحتوى","متوسطة","غدًا",status("مفتوحة","info")]]};
    if(view==="notifications")return {desc:"مركز إشعارات تجريبي، لا يرسل بريدًا أو رسائل SMS أو Push حقيقية.",heads:["الإشعار","القناة","المستلم التجريبي","الوقت","الحالة"],rows:[["تحديث حالة الطلب MX-1048","داخل المنصة","demo.user@example.test","منذ 8 دقائق",status("معاينة","info")],["طلب اعتماد جديد","داخل المنصة","demo.admin@example.test","منذ 24 دقيقة",status("مجدول تجريبيًا","pending")]]};
    if(view==="users")return {desc:"مراجعة نموذج الأدوار ومبدأ أقل صلاحية. الأدوار هنا أمثلة وليست حسابات مصادقة فعلية.",heads:["المستخدم التجريبي","الدور","النطاق","آخر نشاط","الحالة"],rows:[["owner@example.test","OWNER","المساحة التجريبية","اليوم",status("نشط تجريبيًا","success")],["ops@example.test","OPERATIONS","المساحة التجريبية","اليوم",status("نشط تجريبيًا","success")],["provider@example.test","SERVICE_PROVIDER","مؤسسة تجريبية","أمس",status("معاينة","info")],["customer@example.test","CUSTOMER","حساب فردي تجريبي","أمس",status("معاينة","info")]]};
    if(view==="security")return {desc:"سجل مراجعة توضيحي فقط. لا يحتوي أسرارًا أو بيانات شخصية حقيقية ولا يستبدل سجل التدقيق الخلفي.",heads:["الحدث","الفاعل التجريبي","النطاق","الوقت","النتيجة"],rows:[["تسجيل دخول تجريبي","owner@example.test","Demo","10:32",status("نجاح محاكاة","success")],["رفض صلاحية غير كافية","customer@example.test","Demo","10:18",status("رفض محاكاة","danger")],["تغيير إعداد تجريبي","ops@example.test","Demo","09:55",status("قيد المراجعة","pending")]]};
    return null;
  }
  const moduleCards = [
    ["orders","الطلبات","دورة الطلب، الحالة، الإسناد ومتابعة التنفيذ","▤","blue","1,284 طلبًا"],
    ["customers","العملاء وCRM","العملاء المحتملون، العلاقات، الدعم والمتابعة","♙","purple","3,642 عميلًا"],
    ["providers","مقدمو الخدمات","الملفات، الاعتماد، الخدمات ونطاق العمل","⌂","teal","486 مقدمًا"],
    ["catalog","القطاعات والكتالوج","القطاعات الموحدة والخدمات والأسعار","▦","blue","16 قطاعًا"],
    ["smm","التسويق الإلكتروني","الحملات والقنوات والميزانيات وقياس النتائج","◉","purple","3 حملات عرض"],
    ["finance","المالية والمحافظ","دفتر مالي، أرصدة، استرداد وتسويات","◈","orange","أرقام وهمية"],
    ["inventory","المخزون والمشتريات","الأصناف، أوامر الشراء والاستلام","▧","teal","4 أصناف عرض"],
    ["content","المحتوى والمنصة","الصفحات، المواد والإعلانات","▣","blue","3 مواد عرض"],
    ["analytics","التحليلات والتقارير","مؤشرات تشغيلية وتقارير قابلة للمراجعة","⌁","purple","3 تقارير عرض"],
    ["tasks","العمليات والمهام","توزيع المسؤوليات والأولويات والمتابعة","☷","orange","3 مهام عرض"],
    ["notifications","الإشعارات","قوالب وحالات الإرسال وسجل التسليم","♧","teal","محاكاة فقط"],
    ["users","المستخدمون والصلاحيات","الأدوار ونطاق المؤسسة وأقل صلاحية","♧","blue","4 أدوار عرض"],
    ["security","الأمان وسجل التدقيق","أحداث أمنية ومراجعات وصول","⬡","orange","بيانات اصطناعية"],
    ["monitoring","المراقبة والنسخ الاحتياطي","الصحة، النسخ، الاستعادة والتنبيهات","◷","teal","لا يوجد اتصال حي"],
    ["settings","الإعدادات","تفضيلات المساحة ومعايير التجربة","⚙","purple","Demo only"]
  ];
  function monitoring(){return '<div class="simple-kpis"><div class="simple-kpi"><span>حالة واجهة العرض</span><b style="color:var(--green)">تعمل</b></div><div class="simple-kpi"><span>اتصال الإنتاج</span><b>غير متصل</b></div><div class="simple-kpi"><span>قاعدة بيانات العرض</span><b>بيانات ثابتة</b></div></div><section class="panel">'+panelHead("قائمة التحقق التشغيلية","توضيح لما يجب إثباته قبل الاعتماد")+'<div class="list-row"><div class="grow"><b>فحوص الواجهة</b><small>التنقل، العرض المتجاوب، التصفية والتصدير</small></div>'+status("معاينة","info")+'</div><div class="list-row"><div class="grow"><b>اختبارات عزل المؤسسات</b><small>تتطلب قاعدة بيانات اختبار منفصلة ومستخدمين تجريبيين</small></div>'+status("لم تُنفذ","pending")+'</div><div class="list-row"><div class="grow"><b>استعادة النسخ الاحتياطية</b><small>تتطلب تمرين استعادة موثق في بيئة معزولة</small></div>'+status("لم تُنفذ","pending")+'</div><div class="list-row"><div class="grow"><b>فحص أسرار الإنتاج</b><small>لا توجد مفاتيح إنتاج مضمنة في مشروع العرض</small></div>'+status("غير مستخدمة","success")+'</div></section>'}
  function settings(){return '<section class="panel">'+panelHead("إعدادات بيئة العرض","تغييرات محلية على الواجهة فقط")+'<div class="list-row"><div class="grow"><b>وضع البيانات التجريبية</b><small>كل الأسماء والمعاملات والأرقام مولدة للاختبار</small></div><span class="toggle on"></span></div><div class="list-row"><div class="grow"><b>الاتصال بقاعدة إنتاج</b><small>محظور في هذه النسخة ولا يوجد إعداد اتصال</small></div><span class="toggle"></span></div><div class="list-row"><div class="grow"><b>إرسال إشعارات خارجية</b><small>لا يوجد SMS أو بريد أو Push فعلي</small></div><span class="toggle"></span></div><div class="metric-note">لتحويل هذه الواجهة إلى نظام متصل، يجب ربط كل عملية بخدمة خلفية معتمدة، ومصادقة، وصلاحيات، واختبارات تكامل مستقلة. لا يُعد العرض الحالي بديلًا عن ذلك.</div></section>'}
  function tableView(view){const m=moduleTable(view);if(!m)return '<div class="module-grid">'+moduleCards.map(c=>'<button class="module-card" data-view="'+c[0]+'"><span class="stat-icon '+c[4]+'">'+c[3]+'</span><h3>'+c[1]+'</h3><p>'+c[2]+'</p><div class="module-foot"><span>'+c[5]+'</span><b>فتح الوحدة ←</b></div></button>').join("")+'</div>';
    const query=state.query.trim().toLowerCase();
    const filtered=m.rows.filter(row=>!query||row.join(" ").replace(/<[^>]*>/g," ").toLowerCase().includes(query));
    return '<p class="section-note">'+m.desc+'</p><div class="toolbar"><div class="filter-row"><input class="filter-input" id="table-filter" value="'+escapeHtml(state.query)+'" placeholder="تصفية الصفوف الحالية..."><select class="filter-input" id="status-filter"><option value="">كل الحالات</option><option>مكتمل</option><option>نشط</option><option>قيد التنفيذ</option><option>بانتظار التأكيد</option></select></div><span class="cell-secondary">عدد الصفوف في العرض: '+filtered.length+'</span></div><section class="panel table-panel">'+panelHead(navNames[view],"بيانات مولدة للعرض والمراجعة")+(filtered.length?table(m.heads,filtered):'<div class="empty-state"><div class="empty-icon">⌕</div><strong>لا توجد نتائج مطابقة</strong><span>جرّب تعديل عبارة البحث.</span></div>')+'</section><div class="metric-note">ملاحظة: هذه الشاشة نموذج واجهة وبيانات فقط. لم يتم تنفيذ عمليات قاعدة بيانات أو تغيير حالة فعلية.</div>';
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
  function render(){
    $("#crumb").textContent=navNames[state.view]||"نظرة عامة";
    $("#page-title").textContent=navNames[state.view]||"نظرة عامة";
    $("#page-description").textContent=state.view==="overview"?"صورة تشغيلية موحدة للمنصة — أرقام العرض أدناه تجريبية وليست بيانات حقيقية.":"استعراض تجريبي لوحدة "+(navNames[state.view]||"المنصة")+" ضمن Mantyx.";
    $("#primary-action").textContent=state.view==="overview"||state.view==="orders"?"＋ إنشاء طلب تجريبي":state.view==="smm"?"＋ حملة تجريبية":state.view==="tasks"?"＋ مهمة تجريبية":"＋ إضافة عنصر تجريبي";
    $("#view-root").innerHTML=state.view==="overview"?overview():state.view==="monitoring"?monitoring():state.view==="settings"?settings():tableView(state.view);
    $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
    $("#sidebar").classList.remove("open");
  }
  function toast(message){const t=$("#toast");t.textContent=message;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2600)}
  function switchView(view){if(!navNames[view])return;state.view=view;state.query="";render();window.scrollTo({top:0,behavior:"smooth"})}
  document.addEventListener("click",e=>{
    const v=e.target.closest("[data-view]");if(v){e.preventDefault();switchView(v.dataset.view);return}
  });
  $("#global-search").addEventListener("input",e=>{state.query=e.target.value;if(state.view==="overview"&&state.query){state.view="orders";render()}else render()});
  document.addEventListener("input",e=>{if(e.target.id==="table-filter"){state.query=e.target.value;const pos=e.target.selectionStart;render();const n=$("#table-filter");if(n){n.focus();n.setSelectionRange(pos,pos)}}});
  $("#menu-toggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#dismiss-notice").addEventListener("click",()=>{$(".notice").remove();state.notice=false});
  $("#top-notifications").addEventListener("click",()=>switchView("notifications"));
  $("#export-btn").addEventListener("click",()=>{
    const payload={demo:true,brand:"Mantyx",view:state.view,exported_at:new Date().toISOString(),note:"Synthetic demo data only; not production data."};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="mantyx-demo-view.json";a.click();URL.revokeObjectURL(url);toast("تم تصدير ملخص عرض تجريبي فقط");
  });
  $("#primary-action").addEventListener("click",()=>{$("#dialog-title").textContent=state.view==="smm"?"إنشاء حملة تجريبية":state.view==="tasks"?"إنشاء مهمة تجريبية":"إنشاء عنصر تجريبي";$("#action-name").value="";$("#action-dialog").showModal()});
  $("#action-form").addEventListener("submit",e=>{
    if(e.submitter?.id==="save-demo-action"){
      e.preventDefault();const name=$("#action-name").value.trim();if(!name){$("#action-name").focus();return}
      state.extras.push({name,category:$("#action-category").value,created:new Date().toLocaleString("ar-EG")});
      $("#action-dialog").close();toast("تم حفظ العنصر في جلسة العرض فقط");if(state.view==="tasks"||state.view==="orders")render();
    }
  });
  $("#action-dialog").addEventListener("click",e=>{if(e.target.id==="action-dialog")$("#action-dialog").close()});
  document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#global-search").focus()}if(e.key==="Escape")$("#sidebar").classList.remove("open")});
  render();
})();