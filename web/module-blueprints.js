(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plans={
 FASHION:['الكتالوج والمنتجات','المقاسات والخيارات','السلة والطلبات','المخزون','التسعير والعروض','التقارير'],
 GROCERY:['الكتالوج','الأسعار والعروض','المخزون والمستودعات','السلة والتوصيل','الطلبات','التقارير'],
 ACCOUNTING:['دليل الحسابات','طلبات المحاسبة','العروض والتفاوض','القيود اليومية','التسويات','التقارير المالية'],
 COMPANIES:['ملف الشركة','الخدمات','طلبات الأعمال','الموردون','العقود','التقارير'],
 MARKETING:['الخدمات التسويقية','العملاء المحتملون','المشروعات','الحملات','شركات التسويق الشريكة','التقارير'],
 FACTORIES:['المصانع','طلبات التوريد','المخازن','المشتريات','التحويلات','التقارير'],
 TRIPS:['الرحلات','المزايدات','اختيار العرض','التنفيذ المباشر','السائقون','التقييمات والتقارير'],
 MAINTENANCE:['طلبات الصيانة','المزايدات','مقدمو الخدمة','الجدولة','قطع الغيار','التقارير'],
 LEGAL:['الخدمات القانونية','طلبات العملاء','المستندات','الاتفاقيات','المواعيد','التقارير'],
 ERP:['أوامر الشراء','الاستلامات','المخازن','التحويلات','الموردون','التقارير'],
 MATRIMONY:['الملفات','البحث والترشيح','الطلبات','فتح التواصل','المتابعة','الخصوصية والتقارير'],
 JOBS:['الوظائف','طلبات التقديم','المرشحون','المقابلات','أصحاب العمل','التقارير'],
 MEDICAL:['الأطباء والعيادات','التخصصات والخدمات','الحجز','المواعيد','الترشيحات','التقارير'],
 RESTAURANTS:['القائمة','الإضافات','الطلبات','الطاولات','المطبخ','المخزون والتقارير'],
 EDUCATION:['المدارس','المدرسون','الدورات','طلبات التعليم','الحجوزات','التقارير'],
 USED_ITEMS:['الإعلانات','البحث والتصفية','العروض','التفاوض','المراسلات','التقارير']
};
const icons=['▣','◈','◌','◆','◇','◎'];
function runtime(m){
 const tables=Object.keys(m?.tables||{});
 const external=window.MNTYModuleRuntime?.[m?.key]?.tables||{};
 const readable=tables.filter(t=>external[t]!==null&&external[t]!==undefined).length;
 return {tables,readable,counts:external};
}
function badge(kind){
 const map={READABLE:['مصدر قابل للقراءة','pending'],PARTIAL:['قراءة جزئية','pending'],NOT_VERIFIED:['غير متحقق','planned'],SERVER:['تنفيذ خادمي','ui'],CHECK_REQUIRED:['يتطلب تحققًا','pending']};
 const x=map[kind]||map.NOT_VERIFIED;
 return '<span class="mnty-badge mnty-badge--'+x[1]+'">'+x[0]+'</span>';
}
function card(title,idx,m){
 const r=runtime(m),kind=!r.tables.length?'NOT_VERIFIED':r.readable===r.tables.length?'READABLE':'PARTIAL';
 return '<article class="mnty-blueprint-card" data-module-card="'+idx+'"><div class="mnty-blueprint-icon">'+icons[idx%icons.length]+'</div><div class="mnty-blueprint-main"><div class="row"><h3>'+esc(title)+'</h3>'+badge(kind)+'</div><p>'+esc(['مساحة تشغيل أساسية مع عرض الحالة الحالية.','استعراض البيانات المتاحة ضمن نطاق الحساب والصلاحيات.','العمليات الحساسة تمر عبر المسار الخادمي المعتمد.','متابعة الحالات والطلبات دون إنشاء بيانات تجريبية.','المؤشرات تعتمد على البيانات التشغيلية المتاحة فقط.','الإعدادات والصلاحيات تخضع لـRBAC وRLS.'][idx]||'مساحة تشغيلية للموديول.')+'</p><div class="mnty-blueprint-source"><span>'+r.tables.length+' مصادر</span><span>'+r.readable+' مقروءة</span></div><button type="button" class="linkbtn mnty-blueprint-btn" data-blueprint="'+esc(title)+'">فتح القسم ←</button></div></article>';
}
function panel(name,m){
 const list=plans[m?.key]||['نظرة عامة','البيانات','العمليات','الطلبات','التقارير','الإعدادات'];
 const r=runtime(m),kind=!r.tables.length?'NOT_VERIFIED':r.readable===r.tables.length?'LIVE':'PARTIAL';
 const rows=r.tables.map(t=>'<tr><td>'+esc(t.replace(/_/g,' '))+'</td><td>'+esc(r.counts[t]??'—')+'</td><td>'+badge(r.counts[t]==null?'NOT_VERIFIED':'READABLE')+'</td></tr>').join('');
 return '<section class="mnty-product-shell" data-module-blueprint="'+esc(m?.key||'')+'"><div class="mnty-product-head"><div><span class="eyebrow">PRODUCTION MODULE / '+esc(m?.key||'MODULE')+'</span><h2>مساحة العمل — '+esc(name)+'</h2><p>هذه الطبقة تعرض الحالة التشغيلية الفعلية للموديول ولا تعتبر وجود الواجهة دليلًا على اكتمال الخدمة.</p></div><div class="mnty-product-meta">'+badge(kind)+'<small>'+r.readable+' / '+r.tables.length+' مصادر مقروءة</small></div></div><div class="mnty-module-tabs" role="tablist">'+list.map((x,i)=>'<button type="button" class="'+(i===0?'active':'')+'" data-blueprint-tab="'+i+'" role="tab" aria-selected="'+(i===0?'true':'false')+'">'+esc(x)+'</button>').join('')+'</div><div class="mnty-blueprint-grid">'+list.map((x,i)=>card(x,i,m)).join('')+'</div><section class="mnty-runtime-panel"><div class="section-head"><div><span class="eyebrow">RUNTIME SOURCES</span><h3>مصادر البيانات الحالية</h3></div></div><div class="table-wrap"><table><thead><tr><th>المصدر</th><th>السجلات</th><th>الحالة</th></tr></thead><tbody>'+rows+'</tbody></table></div></section><div class="mnty-future-panel"><div><span class="eyebrow">SECURITY VERIFICATION</span><h3>الأمان يحتاج تحققًا مستقلًا</h3><p>نجاح قراءة الجداول لا يثبت وحده سلامة RLS أو RBAC أو مسار الكتابة. يجب اعتماد هذه الحدود عبر سياسات قاعدة البيانات واختبارات الصلاحيات والتكامل قبل اعتبار الموديول جاهزًا.</p></div><div class="mnty-future-stats"><div><b>RLS</b><span>CHECK REQUIRED</span></div><div><b>RBAC</b><span>CHECK REQUIRED</span></div><div><b>WRITE</b><span>SERVER TEST</span></div></div></div></section>';
}
window.MNTYModuleBlueprint=(name,m)=>panel(name,m);
window.MNTYBindModuleBlueprint=()=>{
 document.querySelectorAll('[data-module-blueprint]').forEach(root=>{
  const tabs=[...root.querySelectorAll('[data-blueprint-tab]')],cards=[...root.querySelectorAll('[data-module-card]')];
  tabs.forEach(btn=>btn.onclick=()=>{tabs.forEach(x=>{x.classList.remove('active');x.setAttribute('aria-selected','false')});btn.classList.add('active');btn.setAttribute('aria-selected','true');cards.forEach((c,i)=>c.hidden=i!==Number(btn.dataset.blueprintTab))});
  cards.forEach((c,i)=>c.hidden=i!==0);
  root.querySelectorAll('.mnty-blueprint-btn').forEach(btn=>btn.onclick=()=>{const idx=Number(btn.closest('[data-module-card]')?.dataset.moduleCard||0);const tab=tabs[idx];if(tab){tab.click();root.scrollIntoView?.({behavior:'smooth',block:'start'});}});
 });
};
})();