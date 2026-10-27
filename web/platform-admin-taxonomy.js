(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role=()=>String(window.MNTYAuthState?.role||'').toUpperCase();
const call=(action,extra={})=>{
 if(typeof window.superAdminFunction!=='function')throw new Error('ADMIN_FUNCTION_UNAVAILABLE');
 return window.superAdminFunction('catalog-platform-admin',{action,...extra});
};
let rows=[], editing=null, loading=false;
function statusLabel(s){return s==='ACTIVE'?'نشط':s==='INACTIVE'?'متوقف':'مؤرشف'}
function treeRows(){
 const byParent=new Map();
 rows.forEach(r=>{const k=r.parent_id||'';if(!byParent.has(k))byParent.set(k,[]);byParent.get(k).push(r)});
 for(const v of byParent.values())v.sort((a,b)=>(a.sort_order-b.sort_order)||a.name_ar.localeCompare(b.name_ar,'ar'));
 const out=[];const visit=(parent,depth)=>{(byParent.get(parent)||[]).forEach(r=>{out.push({...r,depth});visit(r.id,depth+1)})};
 visit('',0);return out;
}
function formHtml(){
 const groups=rows.filter(r=>r.node_type==='SECTOR_GROUP');
 const sectors=groups.map(g=>'<option value="'+esc(g.sector_id)+'" '+(editing?.sector_id===g.sector_id?'selected':'')+'>'+esc(g.name_ar)+'</option>').join('');
 const parents=rows.filter(r=>r.node_type!=='SPECIALTY'||r.node_type==='ACTIVITY').map(r=>'<option value="'+esc(r.id)+'" '+(editing?.parent_id===r.id?'selected':'')+'>'+esc(r.name_ar)+' — '+esc(r.code)+'</option>').join('');
 const type=editing?.node_type||'ACTIVITY';
 return '<section class="card" style="padding:18px;margin:16px 0"><div class="section-head"><div><span class="eyebrow">TAXONOMY EDITOR</span><h2>'+(editing?'تعديل عنصر التصنيف':'إضافة قطاع أو نشاط')+'</h2><p>كل عنصر له رمز ثابت. التغيير يُحفظ عبر Edge Function محمية بصلاحية مالك المنصة ويُسجل في سجل التدقيق.</p></div><button class="btn btn-outline" type="button" id="mx-tax-reset">تفريغ النموذج</button></div>'+
 '<form id="mx-tax-form"><div class="grid2">'+
 '<label class="field"><span>المعرّف الثابت *</span><input id="mx-tax-id" maxlength="100" required pattern="[A-Za-z0-9_-]{2,100}" value="'+esc(editing?.id||'')+'" '+(editing?'readonly':'')+' placeholder="activity-refrigeration-technician"></label>'+
 '<label class="field"><span>الرمز *</span><input id="mx-tax-code" maxlength="100" required pattern="[A-Za-z0-9_-]{2,100}" value="'+esc(editing?.code||'')+'" placeholder="REFRIGERATION_TECHNICIAN"></label>'+
 '<label class="field"><span>الاسم بالعربية *</span><input id="mx-tax-ar" maxlength="160" required value="'+esc(editing?.name_ar||'')+'"></label>'+
 '<label class="field"><span>الاسم بالإنجليزية</span><input id="mx-tax-en" maxlength="160" value="'+esc(editing?.name_en||'')+'"></label>'+
 '<label class="field"><span>القطاع *</span><select id="mx-tax-sector" required>'+sectors+'</select></label>'+
 '<label class="field"><span>النوع *</span><select id="mx-tax-type"><option value="SECTOR_GROUP" '+(type==='SECTOR_GROUP'?'selected':'')+'>قطاع / مجموعة</option><option value="ACTIVITY" '+(type==='ACTIVITY'?'selected':'')+'>نشاط</option><option value="SPECIALTY" '+(type==='SPECIALTY'?'selected':'')+'>تخصص فرعي</option></select></label>'+
 '<label class="field"><span>العنصر الأب</span><select id="mx-tax-parent"><option value="">— لا يوجد (للمجموعة الرئيسية فقط) —</option>'+parents+'</select></label>'+
 '<label class="field"><span>ترتيب العرض</span><input id="mx-tax-order" type="number" min="0" max="100000" value="'+esc(editing?.sort_order??100)+'"></label>'+
 '</div><div class="action-bar"><button class="btn btn-primary" type="submit" id="mx-tax-save">حفظ التعديل</button></div><p id="mx-tax-message" aria-live="polite" class="muted"></p></form></section>';
}
function page(){
 if(role()!=='SUPER_ADMIN')return '<section class="card"><h2>غير مصرح</h2><p>إدارة القطاعات والأنشطة متاحة لمالك المنصة المخول فقط.</p></section>';
 const list=treeRows();
 return '<section class="hero"><div><span class="eyebrow">MantiqatiX · PLATFORM CONTROL</span><h2>إدارة القطاعات والأنشطة</h2><p>هيكل هرمي موحد للقطاعات والأنشطة والتخصصات، منفصل عن الموديولات البرمجية. لا يتم حذف السجلات المرتبطة؛ استخدم الإيقاف أو الأرشفة.</p><div class="hero-actions"><button class="btn btn-light" onclick="window.MNTYTaxonomyAdmin.back()">العودة للوحة الإدارة</button><button class="btn btn-ghost" id="mx-tax-refresh">تحديث البيانات</button></div></div></section>'+
 '<section class="cards"><div class="card"><div class="muted">العناصر المحملة</div><div class="kpi">'+rows.length+'</div><small>من قاعدة البيانات عبر المسار الإداري المحمي</small></div><div class="card"><div class="muted">المجموعات الرئيسية</div><div class="kpi">'+rows.filter(r=>r.node_type==='SECTOR_GROUP').length+'</div><small>تجميع القطاعات الحالية</small></div><div class="card"><div class="muted">الأنشطة والتخصصات النشطة</div><div class="kpi">'+rows.filter(r=>r.status==='ACTIVE'&&r.node_type!=='SECTOR_GROUP').length+'</div><small>سجلات فعلية وليست أرقام DEMO</small></div></section>'+
 formHtml()+
 '<section class="card" style="padding:18px"><div class="section-head"><div><span class="eyebrow">ACTIVITY REGISTRY</span><h2>سجل القطاعات والأنشطة</h2><p>استخدم البحث لتصفية الاسم أو الرمز. العناصر الأبناء تظهر بمسافة بادئة.</p></div><input id="mx-tax-search" aria-label="بحث التصنيفات" placeholder="بحث بالاسم أو الرمز" style="max-width:280px"></div>'+
 '<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الرمز</th><th>القطاع</th><th>النوع</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody id="mx-tax-table">'+list.map(rowHtml).join('')+'</tbody></table></div><p class="muted" id="mx-tax-count">عدد النتائج: '+list.length+'</p></section>';
}
function rowHtml(r){
 const sector=rows.find(s=>s.node_type==='SECTOR_GROUP'&&s.sector_id===r.sector_id);
 const indent=Math.min(Number(r.depth||0),5)*18;
 return '<tr data-tax-row data-search="'+esc((r.name_ar+' '+r.name_en+' '+r.code).toLowerCase())+'"><td><span style="display:inline-block;width:'+indent+'px"></span><strong>'+esc(r.name_ar)+'</strong><small style="display:block;color:#667085">'+esc(r.id)+'</small></td><td>'+esc(r.code)+'</td><td>'+esc(sector?.name_ar||r.sector_id)+'</td><td>'+esc(r.node_type==='SECTOR_GROUP'?'مجموعة':r.node_type==='ACTIVITY'?'نشاط':'تخصص')+'</td><td>'+esc(statusLabel(r.status))+'</td><td><button class="btn btn-outline" data-tax-edit="'+esc(r.id)+'" type="button">تعديل</button> <button class="btn btn-outline" data-tax-status="'+esc(r.id)+'" data-status="'+esc(r.status)+'" type="button">'+(r.status==='ACTIVE'?'إيقاف':'تفعيل')+'</button></td></tr>';
}
async function refresh(){
 const root=document.getElementById('page');if(!root)return;
 root.innerHTML='<div class="empty-state">جاري تحميل سجل القطاعات والأنشطة من الخادم…</div>';
 try{const result=await call('LIST_ACTIVITY_TYPES');rows=Array.isArray(result.activityTypes)?result.activityTypes:[];editing=null;root.innerHTML=page();bind();}
 catch(e){root.innerHTML='<section class="card"><h2>تعذر تحميل سجل التصنيفات</h2><p>'+esc(e?.message||'حدث خطأ')+'</p><button class="btn btn-primary" id="mx-tax-retry">إعادة المحاولة</button><p class="muted">لا يتم عرض بيانات تجريبية عند تعذر الاتصال.</p></section>';root.querySelector('#mx-tax-retry')?.addEventListener('click',refresh)}
}
function bind(){
 document.getElementById('mx-tax-refresh')?.addEventListener('click',refresh);
 document.getElementById('mx-tax-reset')?.addEventListener('click',()=>{editing=null;const root=document.getElementById('page');root.innerHTML=page();bind()});
 document.getElementById('mx-tax-search')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();let n=0;document.querySelectorAll('[data-tax-row]').forEach(tr=>{const yes=tr.dataset.search.includes(q);tr.hidden=!yes;if(yes)n++});const c=document.getElementById('mx-tax-count');if(c)c.textContent='عدد النتائج: '+n});
 document.querySelectorAll('[data-tax-edit]').forEach(btn=>btn.addEventListener('click',()=>{editing=rows.find(r=>r.id===btn.dataset.taxEdit)||null;const root=document.getElementById('page');root.innerHTML=page();bind();document.getElementById('mx-tax-form')?.scrollIntoView({behavior:'smooth',block:'start'})}));
 document.querySelectorAll('[data-tax-status]').forEach(btn=>btn.addEventListener('click',async()=>{const row=rows.find(r=>r.id===btn.dataset.taxStatus);if(!row)return;const next=row.status==='ACTIVE'?'INACTIVE':'ACTIVE';const reason=window.prompt('اكتب سبب '+(next==='ACTIVE'?'التفعيل':'الإيقاف')+' (إلزامي):');if(!reason||reason.trim().length<3)return;btn.disabled=true;try{await call('SET_ACTIVITY_TYPE_STATUS',{id:row.id,status:next,reason:reason.trim()});await refresh()}catch(e){window.alert('لم يتم تغيير الحالة: '+(e?.message||'خطأ غير معروف'));btn.disabled=false}}));
 const form=document.getElementById('mx-tax-form');if(form)form.addEventListener('submit',async e=>{
  e.preventDefault();const msg=document.getElementById('mx-tax-message'),btn=document.getElementById('mx-tax-save');btn.disabled=true;msg.textContent='جاري الحفظ والتحقق من الصلاحيات…';
  const type=document.getElementById('mx-tax-type').value,parent=document.getElementById('mx-tax-parent').value||null;
  const sector=document.getElementById('mx-tax-sector').value;
  const group=rows.find(r=>r.node_type==='SECTOR_GROUP'&&r.sector_id===sector);
  const parentId=type==='SECTOR_GROUP'?null:(parent||group?.id||null);
  const payload={id:document.getElementById('mx-tax-id').value.trim(),code:document.getElementById('mx-tax-code').value.trim().toUpperCase(),name_ar:document.getElementById('mx-tax-ar').value.trim(),name_en:document.getElementById('mx-tax-en').value.trim(),sector_id:sector,parent_id:parentId,node_type:type,status:editing?.status||'ACTIVE',sort_order:Number(document.getElementById('mx-tax-order').value||100),legacy_category_id:editing?.legacy_category_id||null,metadata:editing?.metadata||{}};
  try{await call('UPSERT_ACTIVITY_TYPE',{activityType:payload});editing=null;await refresh()}catch(err){msg.textContent='تعذر الحفظ: '+(err?.message||'خطأ غير معروف');btn.disabled=false}
 });
}
function back(){current='التحكم الكامل';try{localStorage.setItem('MNTYWorkspaceCurrent',current)}catch(_){}renderApp({forceWorkspace:true})}\nfunction open(){if(role()!=='SUPER_ADMIN'){window.alert('هذه الشاشة لمالك المنصة المخول فقط.');return}current='إدارة القطاعات والأنشطة';try{localStorage.setItem('MNTYWorkspaceMode','ADMIN');localStorage.setItem('MNTYWorkspaceCurrent',current)}catch(_){}renderApp({forceWorkspace:true})}
window.MNTYTaxonomyAdmin={open,back,refresh,render:page,loadDashboard};
async function loadDashboard(){
 const root=document.getElementById('mx-platform-admin-dashboard-data');if(!root)return;
 root.innerHTML='<p class="muted">جاري تحميل المؤشرات الحقيقية…</p>';
 try{
  const result=await call('PLATFORM_DASHBOARD_METRICS');
  const m=result.metrics||{};
  const card=(label,value,note)=>'<article class="card"><div class="muted">'+esc(label)+'</div><div class="kpi">'+esc(value===null||value===undefined?'غير موصل':value)+'</div><small>'+esc(note||'من البيانات الحية')+'</small></article>';
  root.innerHTML='<div class="cards">'+
   card('إجمالي الأنشطة',m.businesses,'سجلات الأنشطة ضمن نطاقات الإنتاج')+
   card('الأنشطة النشطة',m.activeBusinesses,'الحالة ACTIVE')+
   card('الأنشطة المتوقفة',m.inactiveBusinesses,'الحالة INACTIVE')+
   card('الأنشطة المعلقة',m.suspendedBusinesses,'الحالة SUSPENDED')+
   card('ملاك الأنشطة النشطون',m.activeOwners,'عدد العضويات النشطة')+
   card('أنشطة بلا مالك نشط',m.unassignedBusinesses,'غير متاح إذا تجاوزت قراءة السجلات الحد الآمن')+
   card('العملاء',m.customers,'عضويات CUSTOMER النشطة')+
   card('الاشتراكات النشطة',m.activeSubscriptions,m.status==='LIVE'?'حالة الاشتراك ACTIVE':'مصدر الاشتراكات غير موصول')+
   card('اشتراكات متأخرة',m.pastDueSubscriptions,'PAST_DUE / UNPAID')+
   card('اشتراكات ملغاة',m.cancelledSubscriptions,'CANCELLED')+
   card('المجموعات الرئيسية',m.activeActivityGroups,'سجل التصنيفات الهرمي')+
   card('الأنشطة والتخصصات',m.activeActivities,'سجل التصنيفات الهرمي')+
   card('الزيارات',m.visits,'غير موصول: لا يوجد مصدر تحليلات موثق')+
   card('العمولات والمطالبات',m.commissionAccrued,'غير موصول حتى اعتماد ربط دفتر الأستاذ والتسويات')+
   '</div>'+
   '<section class="card" style="margin-top:14px;padding:16px"><h3>آخر الإجراءات الإدارية</h3>'+
   ((result.recentAudit||[]).length?'<div class="table-wrap"><table><thead><tr><th>الإجراء</th><th>الكيان</th><th>النتيجة</th><th>الوقت</th></tr></thead><tbody>'+
    result.recentAudit.map(a=>'<tr><td>'+esc(a.action)+'</td><td>'+esc(a.entity_type)+' / '+esc(a.entity_id)+'</td><td>'+esc(a.result)+'</td><td>'+esc(a.created_at?new Date(a.created_at).toLocaleString('ar-EG'):'—')+'</td></tr>').join('')+
   '</tbody></table></div>':'<p class="muted">لا توجد إجراءات إدارية مسجلة ضمن النطاق الحالي.</p>')+
   '<p class="muted">الزيارات والعمولات والمطالبات تعرض «غير موصل» إلى أن يثبت مصدرها وتعريفاتها؛ لن تُعرض أرقام تقديرية.</p></section>';
 }catch(e){root.innerHTML='<div class="empty-state">تعذر تحميل لوحة المؤشرات من الخادم: '+esc(e?.message||'خطأ غير معروف')+'. لا يتم استخدام بيانات DEMO.</div>'}
}
const oldEnhanced=window.enhancedPageContent;
if(typeof oldEnhanced==='function'){
 window.enhancedPageContent=function(){
  if(current==='إدارة القطاعات والأنشطة')return page();
  const html=oldEnhanced();
  if(current==='التحكم الكامل'&&role()==='SUPER_ADMIN'){setTimeout(loadDashboard,0);return html+'<section class="card" style="margin-top:16px;padding:18px"><div class="section-head"><div><span class="eyebrow">PLATFORM ADMIN DASHBOARD</span><h2>لوحة مؤشرات المنصة</h2><p>الأرقام التي تظهر هنا من البيانات الحقيقية. أي مؤشر غير موصول يظل واضحًا بدل اختلاق قيمة.</p></div><button class="btn btn-outline" type="button" onclick="window.MNTYTaxonomyAdmin.loadDashboard()">تحديث المؤشرات</button></div><div id="mx-platform-admin-dashboard-data"><p class="muted">جاري تحميل المؤشرات…</p></div></section><section class="card" style="margin-top:16px;padding:18px"><span class="eyebrow">ACTIVITY TAXONOMY</span><h2>إدارة القطاعات والأنشطة</h2><p>تحكم في القطاعات والأنشطة والتخصصات من سجل هرمي واحد.</p><button class="btn btn-primary" type="button" onclick="window.MNTYTaxonomyAdmin.open()">فتح إدارة القطاعات والأنشطة</button></section>';}
  return html;
 };
}
})();
