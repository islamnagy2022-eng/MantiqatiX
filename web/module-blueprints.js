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
function badge(kind){const map={LIVE:['متصل','live'],UI:['الواجهة مكتملة','ui'],PENDING:['الربط لاحقًا','pending'],PLANNED:['مخطط','planned']};const x=map[kind]||map.UI;return '<span class="mnty-badge mnty-badge--'+x[1]+'">'+x[0]+'</span>'}
function card(title,idx,m){
 const liveTables=Object.keys(m?.tables||{});
 const linked=liveTables.length>0;
 const kind=linked?'LIVE':'UI';
 return '<article class="mnty-blueprint-card"><div class="mnty-blueprint-icon">'+icons[idx%icons.length]+'</div><div class="mnty-blueprint-main"><div class="row"><h3>'+esc(title)+'</h3>'+badge(kind)+'</div><p>'+esc(idx===0?'واجهة تشغيلية جاهزة للتوسع وربط البيانات الفعلية.':idx===1?'مساحة إدارة واستعراض مع الحفاظ على الصلاحيات والنطاق.':'الهيكل البصري موجود ويمكن توصيل العمليات الخلفية تدريجيًا دون إعادة تصميم الشاشة.')+'</p><div class="mnty-wire-row"><span></span><span></span><span></span></div><button type="button" class="linkbtn mnty-blueprint-btn" data-blueprint="'+esc(title)+'">فتح مساحة العمل ←</button></div></article>';
}
function panel(name,m){
 const list=plans[m?.key]||['نظرة عامة','البيانات','العمليات','الطلبات','التقارير','الإعدادات'];
 const tableCount=Object.keys(m?.tables||{}).length;
 return '<section class="mnty-product-shell"><div class="mnty-product-head"><div><span class="eyebrow">PRODUCT UI / '+esc(m.key||'MODULE')+'</span><h2>مساحة العمل الكاملة — '+esc(name)+'</h2><p>هذه الطبقة تستكمل شكل المنتج النهائي حتى عندما تكون بعض الخدمات الخلفية أو البيانات غير موصولة بعد. لا يتم إنشاء بيانات وهمية.</p></div><div class="mnty-product-meta">'+badge(tableCount?'LIVE':'PENDING')+'<small>'+tableCount+' مصدر بيانات معروف</small></div></div><div class="mnty-module-tabs">'+list.map((x,i)=>'<button type="button" class="'+(i===0?'active':'')+'" data-blueprint-tab="'+i+'">'+esc(x)+'</button>').join('')+'</div><div class="mnty-blueprint-grid">'+list.map((x,i)=>card(x,i,m)).join('')+'</div><div class="mnty-future-panel"><div><span class="eyebrow">FUTURE CONNECTION</span><h3>جاهز للربط لاحقًا بدون تغيير التصميم</h3><p>عند اكتمال الـBackend، يتم استبدال طبقة العرض/الحالة فقط مع الحفاظ على نفس المكونات ومسارات المستخدم.</p></div><div class="mnty-future-stats"><div><b>UI</b><span>READY</span></div><div><b>DATA</b><span>'+(tableCount?'CONNECTED':'PENDING')+'</span></div><div><b>WRITE</b><span>SERVER ONLY</span></div></div></div></section>';
}
window.MNTYModuleBlueprint=function(name,m){return panel(name,m)};
window.MNTYBindModuleBlueprint=function(){
 document.querySelectorAll('[data-blueprint-tab]').forEach(btn=>btn.onclick=function(){
  document.querySelectorAll('[data-blueprint-tab]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
  const cards=document.querySelectorAll('.mnty-blueprint-card');cards.forEach((x,i)=>x.style.outline=i===Number(btn.dataset.blueprintTab)?'2px solid rgba(141,13,22,.18)':'');
 });
 document.querySelectorAll('.mnty-blueprint-btn').forEach(btn=>btn.onclick=function(){
  const t=btn.dataset.blueprint;
  if(typeof window.showToast==='function')window.showToast('واجهة «'+t+'» جاهزة. الربط الخلفي يُستكمل لاحقًا دون تغيير التصميم.','success');
 });
};
})();