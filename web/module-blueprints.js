(function(){
'use strict';
if(!document.getElementById('mnty-blueprint-detail-style')){const style=document.createElement('style');style.id='mnty-blueprint-detail-style';style.textContent=".mnty-blueprint-detail{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin:16px 0;padding:18px;border:1px solid var(--border,#e4e7ec);border-radius:16px;background:linear-gradient(135deg,#fff,#f8fafc)}.mnty-blueprint-detail h3{margin:7px 0;font-size:18px}.mnty-blueprint-detail p{margin:0;color:var(--muted,#667085);line-height:1.8}.mnty-blueprint-detail-meta{display:grid;gap:7px;min-width:180px;color:var(--muted,#667085);font-size:12px}.mnty-blueprint-detail-meta span{padding:7px 10px;border:1px solid var(--border,#e4e7ec);border-radius:9px;background:#fff}@media(max-width:640px){.mnty-blueprint-detail{display:grid}.mnty-blueprint-detail-meta{min-width:0}}";document.head.appendChild(style);}

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
function card(title,idx,m){
 const r=runtime(m),kind=!r.tables.length?'NOT_VERIFIED':r.readable===r.tables.length?'LIVE':'PARTIAL';
 return '<article class="mnty-blueprint-card" data-module-card="'+idx+'"><div class="mnty-blueprint-icon">'+icons[idx%icons.length]+'</div><div class="mnty-blueprint-main"><div class="row"><h3>'+esc(title)+'</h3>'+badge(kind)+'</div><p>'+esc(['مساحة تشغيل أساسية مع عرض الحالة الحالية.','استعراض البيانات المتاحة ضمن نطاق الحساب والصلاحيات.','العمليات الحساسة تمر عبر المسار الخادمي المعتمد.','متابعة الحالات والطلبات دون إنشاء بيانات تجريبية.','المؤشرات تعتمد على البيانات التشغيلية المتاحة فقط.','الإعدادات والصلاحيات تخضع لـRBAC وRLS.'][idx]||'مساحة تشغيلية للموديول.')+'</p><div class="mnty-blueprint-source"><span>'+r.tables.length+' مصادر</span><span>'+r.readable+' مقروءة</span></div><button type="button" class="linkbtn mnty-blueprint-btn" data-blueprint="'+esc(title)+'">فتح القسم ←</button></div></article>';
}
function panel(name,m){
 const list=plans[m?.key]||['نظرة عامة','البيانات','العمليات','الطلبات','التقارير','الإعدادات'];
 const r=runtime(m),kind=!r.tables.length?'NOT_VERIFIED':r.readable===r.tables.length?'LIVE':'PARTIAL';
 const rows=r.tables.map(t=>'<tr><td>'+esc(t.replace(/_/g,' '))+'</td><td>'+esc(r.counts[t]??'—')+'</td><td>'+badge(r.counts[t]==null?'NOT_VERIFIED':'LIVE')+'</td></tr>').join('');
 return '<section class="mnty-product-shell" data-module-blueprint="'+esc(m?.key||'')+'"><div class="mnty-product-head"><div><span class="eyebrow">PRODUCTION MODULE / '+esc(m?.key||'MODULE')+'</span><h2>مساحة العمل — '+esc(name)+'</h2><p>هذه الطبقة تعرض الحالة التشغيلية الفعلية للموديول ولا تعتبر وجود الواجهة دليلًا على اكتمال الخدمة.</p></div><div class="mnty-product-meta">'+badge(kind)+'<small>'+r.readable+' / '+r.tables.length+' مصادر مقروءة</small></div></div><div class="mnty-module-tabs" role="tablist">'+list.map((x,i)=>'<button type="button" class="'+(i===0?'active':'')+'" data-blueprint-tab="'+i+'" role="tab" aria-selected="'+(i===0?'true':'false')+'">'+esc(x)+'</button>').join('')+'</div><div class="mnty-blueprint-grid">'+list.map((x,i)=>card(x,i,m)).join('')+'</div><section class="mnty-blueprint-detail" aria-live="polite"><div><span class="eyebrow">SECTION WORKSPACE</span><h3 data-blueprint-detail-title>'+esc(list[0]||'نظرة عامة')+'</h3><p data-blueprint-detail-copy>اختر تبويبًا أو افتح قسمًا لعرض سياقه ومؤشرات مصادره. لا تنفذ هذه اللوحة عمليات خلفية غير موصولة.</p></div><div class="mnty-blueprint-detail-meta"><span data-blueprint-detail-sources>مصادر الموديول: '+r.tables.length+'</span><span data-blueprint-detail-status>حالة المصادر: '+(kind==='LIVE'?'بيانات مقروءة':kind==='PARTIAL'?'قراءة جزئية':'غير متحقق')+'</span></div></section><section class="mnty-runtime-panel"><div class="section-head"><div><span class="eyebrow">RUNTIME SOURCES</span><h3>مصادر البيانات الحالية</h3></div></div><div class="table-wrap"><table><thead><tr><th>المصدر</th><th>السجلات</th><th>الحالة</th></tr></thead><tbody>'+rows+'</tbody></table></div></section><div class="mnty-future-panel"><div><span class="eyebrow">SECURITY BOUNDARY</span><h3>الكتابات الحساسة عبر الخادم</h3><p>الواجهة لا تمنح صلاحيات إضافية ولا تنفذ عمليات حساسة مباشرة؛ المسار القائم هو مصدر الحقيقة.</p></div><div class="mnty-future-stats"><div><b>RLS</b><span>ENFORCED</span></div><div><b>RBAC</b><span>ENFORCED</span></div><div><b>WRITE</b><span>SERVER</span></div></div></div></section>';
}
window.MNTYModuleBlueprint=(name,m)=>panel(name,m);
window.MNTYBindModuleBlueprint=()=>{
 document.querySelectorAll('[data-module-blueprint]').forEach(root=>{
  const tabs=[...root.querySelectorAll('[data-blueprint-tab]')],cards=[...root.querySelectorAll('[data-module-card]')];
  const detailTitle=root.querySelector('[data-blueprint-detail-title]'),detailCopy=root.querySelector('[data-blueprint-detail-copy]'),detailSources=root.querySelector('[data-blueprint-detail-sources]'),detailStatus=root.querySelector('[data-blueprint-detail-status]');
  const moduleKey=root.dataset.moduleBlueprint||'MODULE';
  const sourceCount=root.querySelectorAll('.mnty-runtime-panel tbody tr').length;
  const sourceStates=[...root.querySelectorAll('.mnty-runtime-panel tbody tr .mnty-badge')];
  const sourceStatus=sourceStates.length&&sourceStates.every(x=>x.textContent.trim()==='بيانات فعلية')?'بيانات مقروءة':sourceStates.some(x=>x.textContent.trim()==='بيانات فعلية')?'قراءة جزئية':'غير متحقق';
  const activate=(rawIndex,scroll=false)=>{
   const index=Math.max(0,Math.min(cards.length-1,Number(rawIndex)||0));
   tabs.forEach((x,i)=>{const active=i===index;x.classList.toggle('active',active);x.setAttribute('aria-selected',active?'true':'false')});
   cards.forEach((c,i)=>{c.hidden=i!==index});
   const card=cards[index],title=card?.querySelector('h3')?.textContent?.trim()||tabs[index]?.textContent?.trim()||'القسم';
   if(detailTitle)detailTitle.textContent=title;
   if(detailCopy)detailCopy.textContent='أنت داخل قسم «'+title+'» من موديول '+moduleKey+'. تعرض هذه المساحة حالة القسم ومصادر الموديول المتاحة فقط؛ الإجراءات التي تحتاج إلى خدمة خلفية غير موصولة لا تُعرض على أنها منفذة.';
   if(detailSources)detailSources.textContent='مصادر الموديول: '+sourceCount;
   if(detailStatus)detailStatus.textContent='حالة المصادر: '+sourceStatus;
   if(scroll)root.querySelector('.mnty-blueprint-detail')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  };
  tabs.forEach(btn=>btn.onclick=()=>activate(btn.dataset.blueprintTab));
  root.querySelectorAll('.mnty-blueprint-btn').forEach(btn=>btn.onclick=()=>activate(btn.closest('[data-module-card]')?.dataset.moduleCard,true));
  activate(0);
 });
};
})();