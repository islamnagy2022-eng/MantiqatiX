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
 const map={LIVE:['بيانات فعلية','live'],PARTIAL:['قراءة جزئية','pending'],NOT_VERIFIED:['غير متحقق','planned'],SERVER:['تنفيذ خادمي','ui']};
 const x=map[kind]||map.NOT_VERIFIED;
 return '<span class="mnty-badge mnty-badge--'+x[1]+'">'+x[0]+'</span>';
}
const sectionSources={
 FASHION:[['fashion_products'],['fashion_products'],['fashion_orders'],[],[],['fashion_products','fashion_orders']],
 GROCERY:[['catalog_items'],['catalog_item_prices'],['inventory_transactions','warehouses'],['orders'],['orders'],['catalog_items','catalog_item_prices','inventory_transactions','orders']],
 ACCOUNTING:[['indrive_requests'],['indrive_bids'],['indrive_bids'],['chart_of_accounts','journal_entries'],['journal_entries'],['indrive_requests','indrive_bids','chart_of_accounts','journal_entries']],
 COMPANIES:[['businesses'],['businesses'],['indrive_requests'],['indrive_bids'],['indrive_bids'],['businesses','indrive_requests','indrive_bids']],
 MARKETING:[['marketing_services'],['marketing_leads'],['marketing_projects'],['marketing_projects'],['marketing_provider_profiles'],['marketing_leads','marketing_provider_profiles','marketing_services','marketing_projects']],
 FACTORIES:[['indrive_requests'],['indrive_bids'],['warehouses','inventory_transactions'],['indrive_requests'],['inventory_transactions'],['indrive_requests','indrive_bids','warehouses','inventory_transactions']],
 TRIPS:[['mantigo_rides'],['indrive_requests','mantigo_bids'],['mantigo_bids'],['mantigo_rides'],['mantigo_rides'],['mantigo_rides','indrive_requests','indrive_bids','mantigo_bids']],
 MAINTENANCE:[['indrive_requests'],['indrive_bids'],['indrive_bids'],['indrive_requests'],['support_tickets'],['indrive_requests','indrive_bids','support_tickets']],
 LEGAL:[['legal_requirements'],['legal_requirements'],['legal_documents'],['agreements'],['legal_requirements'],['legal_documents','legal_requirements','agreements']],
 ERP:[['erp_purchase_orders'],['erp_purchase_receipts'],['warehouses'],['erp_stock_transfers'],['erp_purchase_orders','erp_purchase_receipts'],['erp_purchase_orders','erp_purchase_receipts','erp_stock_transfers','warehouses']],
 MATRIMONY:[['matrimony_profiles'],['matrimony_profiles'],['matrimony_requests'],['matrimony_contact_unlocks'],['matrimony_requests'],['matrimony_profiles','matrimony_requests','matrimony_contact_unlocks']],
 JOBS:[['jobs'],['job_applications'],['job_applications'],['job_applications'],['jobs'],['jobs','job_applications']],
 MEDICAL:[['marketing_provider_profiles'],['marketing_provider_profiles'],['medical_appointments'],['medical_appointments'],['medical_appointments'],['marketing_provider_profiles','medical_appointments']],
 RESTAURANTS:[['restaurant_menu_items'],['restaurant_menu_items'],['restaurant_orders'],['restaurant_tables'],['restaurant_orders'],['restaurant_menu_items','restaurant_orders','restaurant_tables','restaurant_inventory']],
 EDUCATION:[['school_profiles'],['teacher_profiles'],['education_requests'],['education_requests'],['education_requests'],['school_profiles','teacher_profiles','education_requests']],
 USED_ITEMS:[['used_item_ads'],['used_item_ads'],['used_item_ads'],['used_item_ads'],['used_item_ads'],['used_item_ads']]
};
function exportModuleSourcesCsv(root){
 const key=root?.dataset?.moduleBlueprint||'',counts=window.MNTYModuleRuntime?.[key]?.tables||{};
 let tables=[];try{tables=JSON.parse(root?.dataset?.moduleTables||'[]')}catch(_){}
 const safe=v=>{let x=String(v??'').replace(/[\r\n]+/g,' ').trim();if(/^[=+\-@\t]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';};
 const rows=[['الموديول','المصدر','العدد المرئي','الحالة'],...tables.map(t=>[key,t,counts[t]===null||counts[t]===undefined?'غير متاح':String(counts[t]),counts[t]===null||counts[t]===undefined?'غير متحقق':'قراءة عددية'])];
 const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mantiqatix-module-'+key.toLowerCase()+'-sources.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function sectionDetail(title,index,m){
 const r=runtime(m),plan=plans[m?.key]||['نظرة عامة','البيانات','العمليات','الطلبات','التقارير','الإعدادات'];
 const configured=sectionSources[m?.key]?.[index]||[];
 const sources=configured.filter(t=>r.tables.includes(t));
 const rows=sources.map(t=>'<tr><td>'+esc(t.replace(/_/g,' '))+'</td><td>'+esc(r.counts[t]??'—')+'</td><td>'+badge(r.counts[t]==null?'NOT_VERIFIED':'LIVE')+'</td></tr>').join('');
 return '<div class="section-head"><div><span class="eyebrow">MODULE SECTION</span><h3>'+esc(plan[index]||title)+'</h3><p>مصادر هذا القسم حسب كتالوج الموديول الحالي؛ لا يتم إنشاء سجلات أو تنفيذ تغييرات من هذه الشاشة.</p></div><span class="count">'+sources.length+' مصادر مرتبطة</span></div>'+(sources.length?'<div class="table-wrap"><table><thead><tr><th>المصدر</th><th>العدد المرئي</th><th>الحالة</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="mnty-screen-note">لا يوجد مصدر بيانات مخصص مثبت لهذا القسم في كتالوج الموديول الحالي. يلزم توصيل مصدر فعلي قبل إضافة عمليات إنشاء أو تعديل.</div>');
}
function card(title,idx,m){
 const r=runtime(m),kind=!r.tables.length?'NOT_VERIFIED':r.readable===r.tables.length?'LIVE':'PARTIAL';
 return '<article class="mnty-blueprint-card" data-module-card="'+idx+'"><div class="mnty-blueprint-icon">'+icons[idx%icons.length]+'</div><div class="mnty-blueprint-main"><div class="row"><h3>'+esc(title)+'</h3>'+badge(kind)+'</div><p>'+esc(['مساحة تشغيل أساسية مع عرض الحالة الحالية.','استعراض البيانات المتاحة ضمن نطاق الحساب والصلاحيات.','العمليات الحساسة تمر عبر المسار الخادمي المعتمد.','متابعة الحالات والطلبات دون إنشاء بيانات تجريبية.','المؤشرات تعتمد على البيانات التشغيلية المتاحة فقط.','الإعدادات والصلاحيات تخضع لـRBAC وRLS.'][idx]||'مساحة تشغيلية للموديول.')+'</p><div class="mnty-blueprint-source"><span>'+r.tables.length+' مصادر</span><span>'+r.readable+' مقروءة</span></div><button type="button" class="linkbtn mnty-blueprint-btn" data-blueprint="'+esc(title)+'" data-blueprint-index="'+idx+'">فتح القسم ←</button></div></article>';
}
function panel(name,m){
 const list=plans[m?.key]||['نظرة عامة','البيانات','العمليات','الطلبات','التقارير','الإعدادات'];
 const r=runtime(m),kind=!r.tables.length?'NOT_VERIFIED':r.readable===r.tables.length?'LIVE':'PARTIAL';
 const rows=r.tables.map(t=>'<tr><td>'+esc(t.replace(/_/g,' '))+'</td><td>'+esc(r.counts[t]??'—')+'</td><td>'+badge(r.counts[t]==null?'NOT_VERIFIED':'LIVE')+'</td></tr>').join('');
 return '<section class="mnty-product-shell" data-module-blueprint="'+esc(m?.key||'')+'" data-module-tables="'+esc(JSON.stringify(m?.tables||[]))+'"><div class="mnty-product-head"><div><span class="eyebrow">PRODUCTION MODULE / '+esc(m?.key||'MODULE')+'</span><h2>مساحة العمل — '+esc(name)+'</h2><p>هذه الطبقة تعرض الحالة التشغيلية الفعلية للموديول ولا تعتبر وجود الواجهة دليلًا على اكتمال الخدمة.</p></div><div class="mnty-product-meta">'+badge(kind)+'<small>'+r.readable+' / '+r.tables.length+' مصادر مقروءة</small><button type="button" class="linkbtn" data-module-export>تصدير المصادر CSV</button></div></div><div class="mnty-module-tabs" role="tablist">'+list.map((x,i)=>'<button type="button" class="'+(i===0?'active':'')+'" data-blueprint-tab="'+i+'" role="tab" aria-selected="'+(i===0?'true':'false')+'">'+esc(x)+'</button>').join('')+'</div><div class="mnty-blueprint-grid">'+list.map((x,i)=>card(x,i,m)).join('')+'</div><section class="mnty-runtime-panel" data-blueprint-detail aria-live="polite">'+sectionDetail(list[0],0,m)+'</section><section class="mnty-runtime-panel"><div class="section-head"><div><span class="eyebrow">RUNTIME SOURCES</span><h3>مصادر البيانات الحالية</h3></div></div><div class="table-wrap"><table><thead><tr><th>المصدر</th><th>السجلات</th><th>الحالة</th></tr></thead><tbody>'+rows+'</tbody></table></div></section><div class="mnty-future-panel"><div><span class="eyebrow">SECURITY BOUNDARY</span><h3>الكتابات الحساسة عبر الخادم</h3><p>الواجهة لا تمنح صلاحيات إضافية ولا تنفذ عمليات حساسة مباشرة؛ المسار القائم هو مصدر الحقيقة.</p></div><div class="mnty-future-stats"><div><b>RLS</b><span>ENFORCED</span></div><div><b>RBAC</b><span>ENFORCED</span></div><div><b>WRITE</b><span>SERVER</span></div></div></div></section>';
}
window.MNTYModuleBlueprint=(name,m)=>panel(name,m);
window.MNTYBindModuleBlueprint=()=>{
 document.querySelectorAll('[data-module-blueprint]').forEach(root=>{
  const tabs=[...root.querySelectorAll('[data-blueprint-tab]')],cards=[...root.querySelectorAll('[data-module-card]')];
  const selectSection=index=>{tabs.forEach(x=>{const active=Number(x.dataset.blueprintTab)===index;x.classList.toggle('active',active);x.setAttribute('aria-selected',active?'true':'false')});cards.forEach((c,i)=>c.hidden=i!==index);const detail=root.querySelector('[data-blueprint-detail]');if(detail){let tableNames=[];try{tableNames=JSON.parse(root.dataset.moduleTables||'[]')}catch(_){}detail.innerHTML=sectionDetail(plans[root.dataset.moduleBlueprint]?.[index]||tabs[index]?.textContent||'',index,{key:root.dataset.moduleBlueprint,tables:tableNames})}};
  tabs.forEach(btn=>btn.onclick=()=>selectSection(Number(btn.dataset.blueprintTab)));
  cards.forEach((c,i)=>c.hidden=i!==0);
  root.querySelectorAll('.mnty-blueprint-btn').forEach(btn=>btn.onclick=()=>selectSection(Number(btn.dataset.blueprintIndex)));
  root.querySelectorAll('[data-module-export]').forEach(btn=>btn.onclick=()=>exportModuleSourcesCsv(root));
 });
};
})();