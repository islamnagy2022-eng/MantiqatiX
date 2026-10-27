(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(v,c='EGP')=>Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+esc(c);
const fmtDate=v=>v?new Date(v).toLocaleString('ar-EG'):'—';
const roleOK=()=>typeof canSuperAdmin==='function'&&canSuperAdmin();
const api=async(action,extra={})=>{
 if(typeof superAdminFunction!=='function')throw new Error('SUPER_ADMIN_API_UNAVAILABLE');
 return superAdminFunction('catalog-platform-admin',{action,...extra});
};
let model={tab:'audit',tenants:[],tenantId:'',status:'',actionFilter:'',entityType:'',obligationType:'',ledgerStatus:'',rows:[],total:0,offset:0,limit:50,loading:false};
const toast=(message,type='success')=>{
 if(typeof showToast==='function'){showToast(message,type);return}
 const div=document.createElement('div');div.textContent=message;div.style.cssText='position:fixed;z-index:999999;bottom:20px;left:20px;padding:12px 16px;border-radius:10px;background:'+(type==='error'?'#991b1b':'#14532d')+';color:#fff;font:700 13px Tajawal';document.body.appendChild(div);setTimeout(()=>div.remove(),4500);
};
const statusNames={DUE:'مستحق',SETTLED:'تمت التسوية',PAID:'مدفوع',PENDING:'قيد الانتظار',FAILED:'فشل',MATCHED:'متطابق',RECONCILED:'تمت المطابقة',EXCEPTION:'استثناء',POSTED:'مرحّل',COMPLETED:'مكتمل',CANCELLED:'ملغى',ACTIVE:'نشط',INACTIVE:'متوقف'};
const status=v=>'<span style="display:inline-flex;padding:5px 8px;border-radius:99px;background:#f1f5f9;font-size:11px;font-weight:800">'+esc(statusNames[String(v||'').toUpperCase()]||String(v||'—'))+'</span>';
const summary=(title,value,note)=>'<article class="card"><div class="muted">'+esc(title)+'</div><div class="kpi">'+esc(value)+'</div><small>'+esc(note)+'</small></article>';
function page(){
 if(!roleOK())return '<section class="card"><h2>غير مصرح</h2><p>هذه المساحة لمالك المنصة المخول فقط.</p></section>';
 const tabButtons=[['audit','سجل التدقيق'],['obligations','المطالبات المالية'],['reconciliations','مطابقات المدفوعات'],['commissions','معاملات العمولات']];
 const controls='<section class="card" style="margin-bottom:14px"><div class="grid3">'+
 '<label class="field"><span>نطاق الإنتاج</span><select id="mx-pf-tenant"><option value="">كل النطاقات</option>'+model.tenants.map(t=>'<option value="'+esc(t.id)+'" '+(model.tenantId===t.id?'selected':'')+'>'+esc(t.name+' ('+t.code+')')+'</option>').join('')+'</select></label>'+
 (model.tab==='audit'?'<label class="field"><span>بحث في نوع الإجراء</span><input id="mx-pf-action" value="'+esc(model.actionFilter)+'" placeholder="BUSINESS_PROFILE_UPDATED"></label><label class="field"><span>نوع الكيان</span><input id="mx-pf-entity" value="'+esc(model.entityType)+'" placeholder="business / commission_rule"></label>':
 model.tab==='obligations'?'<label class="field"><span>نوع المطالبة</span><input id="mx-pf-obligation-type" value="'+esc(model.obligationType)+'" placeholder="PLATFORM_COMMISSION"></label><label class="field"><span>الحالة</span><input id="mx-pf-status" value="'+esc(model.status)+'" placeholder="DUE / SETTLED"></label>':
 model.tab==='reconciliations'?'<label class="field"><span>حالة المطابقة</span><input id="mx-pf-status" value="'+esc(model.status)+'" placeholder="MATCHED / EXCEPTION"></label><label class="field"><span>حالة دفتر الأستاذ</span><input id="mx-pf-ledger-status" value="'+esc(model.ledgerStatus)+'" placeholder="POSTED"></label>':
 '<label class="field"><span>حالة معاملة العمولة</span><input id="mx-pf-status" value="'+esc(model.status)+'" placeholder="POSTED / COMPLETED"></label><label class="field"><span>معرّف النشاط (اختياري)</span><input id="mx-pf-business" value="" placeholder="UUID"></label>')+
 '</div><div class="action-bar"><button id="mx-pf-apply" class="btn btn-primary" type="button" style="width:auto">تطبيق الفلاتر</button><button id="mx-pf-refresh" class="btn btn-outline" type="button">تحديث</button><span class="muted">نتائج حقيقية للقراءة فقط · '+model.total+' سجل</span></div></section>';
 let table='';
 if(model.loading)table='<div class="empty-state">جاري تحميل السجلات من الخادم…</div>';
 else if(!model.rows.length)table='<div class="empty-state">لا توجد سجلات مطابقة ضمن النطاق المحدد.</div>';
 else if(model.tab==='audit')table='<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الإجراء</th><th>الكيان</th><th>النتيجة</th><th>الجهة</th><th>التفاصيل</th></tr></thead><tbody>'+model.rows.map(r=>'<tr><td>'+esc(fmtDate(r.created_at))+'</td><td><b>'+esc(r.action)+'</b><small style="display:block">'+esc(r.actor_user_id)+'</small></td><td>'+esc(r.entity_type)+'<small style="display:block">'+esc(r.entity_id)+'</small></td><td>'+status(r.result)+'</td><td>'+esc(r.tenant_id)+(r.business_id?'<small style="display:block">'+esc(r.business_id)+'</small>':'')+'</td><td><details><summary>عرض القيم</summary><pre style="white-space:pre-wrap;max-width:500px;direction:ltr;text-align:left;font-size:10px">'+esc(JSON.stringify({old:r.old_values,new:r.new_values},null,2))+'</pre></details></td></tr>').join('')+'</tbody></table></div>';
 else if(model.tab==='obligations'){
  const visibleAmount=model.rows.reduce((s,r)=>s+Number(r.amount||0),0);
  table='<div class="cards">'+summary('عدد المطالبات في الصفحة',model.rows.length,'من أصل '+model.total+' سجل')+summary('مجموع مبالغ الصفحة',money(visibleAmount,'EGP'),'مجموع الصفحة الحالية فقط، وليس الإجمالي الكلي')+summary('مطالبات منتهية التسوية',model.rows.filter(r=>r.settled_at).length,'من السجلات الظاهرة')+'</div><div class="table-wrap"><table><thead><tr><th>المطالبة</th><th>النشاط/الطلب</th><th>النوع والمستفيد</th><th>المبلغ الإجمالي</th><th>المبلغ المستحق</th><th>الحالة</th><th>الاستحقاق والتسوية</th></tr></thead><tbody>'+model.rows.map(r=>'<tr><td><b>'+esc(r.id)+'</b><small style="display:block">'+esc(fmtDate(r.created_at))+'</small></td><td>'+esc(r.business_name||r.business_id||'—')+(r.order_id?'<small style="display:block">طلب '+esc(r.order_id)+'</small>':'')+'</td><td>'+esc(r.obligation_type)+'<small style="display:block">'+esc(r.beneficiary_type)+' / '+esc(r.beneficiary_id)+'</small></td><td>'+money(r.gross_amount,r.currency)+'</td><td><b>'+money(r.amount,r.currency)+'</b></td><td>'+status(r.status)+'<small style="display:block">'+esc(r.payment_method||'—')+'</small></td><td>'+esc(fmtDate(r.due_at))+'<small style="display:block">'+esc(fmtDate(r.settled_at))+'</small></td></tr>').join('')+'</tbody></table></div>';
 } else if(model.tab==='reconciliations'){
  table='<div class="cards">'+summary('مطابقات في الصفحة',model.rows.length,'من أصل '+model.total+' سجل')+summary('استثناءات ظاهرة',model.rows.filter(r=>String(r.reconciliation_status).toUpperCase()==='EXCEPTION'||r.exception_code).length,'لا يتم اعتماد الاستثناء آليًا')+summary('حالة الدفتر غير مرحّلة',model.rows.filter(r=>!['POSTED','RECONCILED','MATCHED'].includes(String(r.ledger_status).toUpperCase())).length,'ضمن نتائج الصفحة الحالية')+'</div><div class="table-wrap"><table><thead><tr><th>المطابقة / التاريخ</th><th>الدفع/الطلب</th><th>المبالغ</th><th>حالة المطابقة</th><th>حالة الدفتر</th><th>الاستثناء</th></tr></thead><tbody>'+model.rows.map(r=>'<tr><td><b>'+esc(r.id)+'</b><small style="display:block">'+esc(fmtDate(r.created_at))+'</small></td><td>'+esc(r.payment_intent_id)+'<small style="display:block">'+esc(r.order_id)+'</small></td><td>إجمالي: '+money(r.gross_amount,r.currency)+'<small style="display:block">عمولة: '+money(r.commission_amount,r.currency)+'</small><small style="display:block">مستلم: '+money(r.provider_received_amount,r.currency)+'</small></td><td>'+status(r.reconciliation_status)+'</td><td>'+status(r.ledger_status)+'</td><td><b>'+esc(r.exception_code||'—')+'</b><details><summary>تفاصيل</summary><pre style="white-space:pre-wrap;max-width:360px;direction:ltr;text-align:left;font-size:10px">'+esc(JSON.stringify(r.metadata||{},null,2))+'</pre></details></td></tr>').join('')+'</tbody></table></div>';
 } else {
  const totalGross=model.rows.reduce((s,r)=>s+Number(r.gross_amount||0),0),totalCommission=model.rows.reduce((s,r)=>s+Number(r.commission_amount||0),0);
  table='<div class="cards">'+summary('معاملات في الصفحة',model.rows.length,'من أصل '+model.total+' سجل')+summary('إجمالي الأوامر بالصفحة',money(totalGross),'مجموع النتائج الظاهرة فقط')+summary('إجمالي العمولة بالصفحة',money(totalCommission),'مجموع الصفحة الحالية، لا يمثل أرصدة مستحقة')+'</div><div class="table-wrap"><table><thead><tr><th>المعاملة</th><th>النشاط</th><th>الطلب</th><th>الإجمالي</th><th>العمولة</th><th>الحالة</th></tr></thead><tbody>'+model.rows.map(r=>'<tr><td><b>'+esc(r.id)+'</b><small style="display:block">'+esc(fmtDate(r.created_at))+'</small></td><td>'+esc(r.business_id)+'</td><td>'+esc(r.order_id)+'</td><td>'+money(r.gross_amount)+'</td><td><b>'+money(r.commission_amount)+'</b></td><td>'+status(r.status)+'</td></tr>').join('')+'</tbody></table></div>';
 }
 const pag='<div class="action-bar" style="justify-content:space-between"><span class="muted">عرض '+(model.total?model.offset+1:0)+'–'+Math.min(model.offset+model.limit,model.total)+' من '+model.total+'</span><div><button class="btn btn-outline" id="mx-pf-prev" type="button" '+(model.offset<=0?'disabled':'')+'>السابق</button> <button class="btn btn-outline" id="mx-pf-next" type="button" '+(model.offset+model.limit>=model.total?'disabled':'')+'>التالي</button></div></div>';
 return '<section class="hero" style="margin-bottom:16px"><div class="hero-actions" style="justify-content:space-between"><div><span class="eyebrow">PLATFORM FINANCE & GOVERNANCE</span><h2>السجل المالي والتدقيق</h2><p>عرض فقط. لا توجد أزرار تسوية أو تعديل مالي في هذه الشاشة.</p></div><button class="btn btn-light" id="mx-pf-back" type="button">العودة للتحكم الكامل</button></div></section>'+
 '<section class="card"><div class="action-bar" style="gap:7px;flex-wrap:wrap">'+tabButtons.map(x=>'<button type="button" data-pf-tab="'+x[0]+'" class="btn '+(model.tab===x[0]?'btn-primary':'btn-outline')+'" style="width:auto">'+x[1]+'</button>').join('')+'</div></section>'+
 controls+'<section class="card"><div class="section-head" style="margin-top:0"><div><h3>'+esc(tabButtons.find(x=>x[0]===model.tab)?.[1]||'السجلات')+'</h3><p class="muted">النطاق والحدود واضحة؛ المجاميع المعروضة تخص الصفحة الحالية عند وجودها.</p></div></div>'+table+pag+'</section>';
}
async function loadTenants(){
 if(model.tenants.length)return;
 const r=await api('TENANT_LIST');model.tenants=Array.isArray(r.tenants)?r.tenants:[];
}
async function refresh(){
 const root=document.getElementById('page');if(!root)return;
 model.loading=true;root.innerHTML=page();bind();
 try{
  const common={tenantId:model.tenantId||undefined,limit:model.limit,offset:model.offset};
  let result;
  if(model.tab==='audit')result=await api('LIST_AUDIT_LOGS',{...common,actionFilter:model.actionFilter,entityType:model.entityType});
  else if(model.tab==='obligations')result=await api('LIST_FINANCIAL_OBLIGATIONS',{...common,status:model.status,obligationType:model.obligationType});
  else if(model.tab==='reconciliations')result=await api('LIST_FINANCIAL_RECONCILIATIONS',{...common,reconciliationStatus:model.status,ledgerStatus:model.ledgerStatus});
  else result=await api('LIST_COMMISSION_TRANSACTIONS',{...common,status:model.status,businessId:document.getElementById('mx-pf-business')?.value?.trim()||''});
  model.rows= model.tab==='audit'?result.auditLogs||[]:model.tab==='obligations'?result.obligations||[]:model.tab==='reconciliations'?result.reconciliations||[]:result.commissionTransactions||[];
  model.total=Number(result.total||0);
 }catch(e){model.rows=[];model.total=0;toast('تعذر تحميل السجلات: '+(e?.message||'خطأ غير معروف'),'error')}
 finally{model.loading=false;renderAndBind()}
}
function renderAndBind(){const root=document.getElementById('page');if(root){root.innerHTML=page();bind()}}
function bind(){
 document.getElementById('mx-pf-back')?.addEventListener('click',()=>{current='التحكم الكامل';try{localStorage.setItem('MNTYWorkspaceCurrent',current)}catch(_){};renderApp({forceWorkspace:true})});
 document.querySelectorAll('[data-pf-tab]').forEach(b=>b.addEventListener('click',()=>{model.tab=b.dataset.pfTab;model.offset=0;renderAndBind();refresh()}));
 document.getElementById('mx-pf-apply')?.addEventListener('click',()=>{
  model.tenantId=document.getElementById('mx-pf-tenant')?.value||'';
  model.actionFilter=document.getElementById('mx-pf-action')?.value?.trim()||'';
  model.entityType=document.getElementById('mx-pf-entity')?.value?.trim()||'';
  model.obligationType=document.getElementById('mx-pf-obligation-type')?.value?.trim()||'';
  model.status=document.getElementById('mx-pf-status')?.value?.trim().toUpperCase()||'';
  model.ledgerStatus=document.getElementById('mx-pf-ledger-status')?.value?.trim().toUpperCase()||'';
  model.offset=0;refresh();
 });
 document.getElementById('mx-pf-refresh')?.addEventListener('click',()=>refresh());
 document.getElementById('mx-pf-prev')?.addEventListener('click',()=>{model.offset=Math.max(0,model.offset-model.limit);refresh()});
 document.getElementById('mx-pf-next')?.addEventListener('click',()=>{if(model.offset+model.limit<model.total){model.offset+=model.limit;refresh()}});
}
async function open(tab='audit'){
 if(!roleOK()){toast('هذه الشاشة لمالك المنصة المخول فقط.','error');return}
 model.tab=tab;model.offset=0;
 current='السجل المالي والتدقيق';
 try{localStorage.setItem('MNTYWorkspaceMode','ADMIN');localStorage.setItem('MNTYWorkspaceCurrent',current)}catch(_){}
 await loadTenants();await renderApp({forceWorkspace:true});renderAndBind();await refresh();
}
window.MNTYPlatformFinance={open};
const oldEnhanced=window.enhancedPageContent;
if(typeof oldEnhanced==='function'){
 window.enhancedPageContent=function(){
  if(current==='السجل المالي والتدقيق')return page();
  const html=oldEnhanced();
  if(current==='التحكم الكامل'&&roleOK()){
   return html+'<section class="card" style="margin-top:16px;padding:18px"><span class="eyebrow">AUDIT / FINANCIAL RECONCILIATION</span><h2>السجل المالي والتدقيق</h2><p class="muted">مراجعة سجلات التدقيق، المطالبات، مطابقات المدفوعات ومعاملات العمولات. هذه الشاشة للقراءة فقط ولا تسوي معاملات مالية.</p><button class="btn btn-outline" type="button" onclick="window.MNTYPlatformFinance.open()">فتح السجل المالي والتدقيق</button></section>';
  }
  return html;
 };
}
})();