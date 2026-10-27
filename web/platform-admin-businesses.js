(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allowedKinds=[
 ['ACCOUNTING','المحاسبة والأعمال'],['AUTO','السيارات والمركبات'],['COMPANIES','الشركات والخدمات المؤسسية'],['DENTAL','طب الأسنان'],['EDU','التعليم والتدريب'],['TECH','البرمجيات والخدمات التقنية'],['FASHION','الأزياء والخياطة'],['FOOD','الطعام والمطاعم'],['FREELANCER','المهن والخدمات المستقلة'],['GROCERY','البقالة والتجزئة'],['HEALTH','الأطباء والتخصصات الطبية'],['HOSPITAL','المستشفيات والرعاية الطبية'],['JOBS','الوظائف والتوظيف'],['LABS','المعامل والتحاليل'],['LEGAL','المحاماة والخدمات القانونية'],['MAINTENANCE','الصيانة والحرف'],['MANTIGO','النقل والتوصيل'],['DIGITAL','التسويق والإعلان'],['MATRIMONY','الزواج والتوفيق'],['MEDICAL','المراكز الطبية'],['PHARMACY','الصيدليات'],['RADIOLOGY','الأشعة والتصوير الطبي'],['REAL_ESTATE','العقارات'],['FITNESS','الرياضة واللياقة'],['TRAVEL','السياحة والرحلات'],['USED_ITEMS','المستعمل والإعلانات المبوبة'],['VETERINARY','الطب البيطري والحيوانات']
];
let state={businesses:[],total:0,offset:0,limit:25,search:'',filterStatus:'',tenants:[],rules:[],rulesTenant:'',editingBusiness:null,editingRule:null,loading:false,tab:'businesses'};
let toastTimer=null;
const roleOK=()=>typeof canSuperAdmin==='function'&&canSuperAdmin();
const api=async(action,extra={})=>{
 if(typeof superAdminFunction!=='function')throw new Error('SUPER_ADMIN_API_UNAVAILABLE');
 return superAdminFunction('catalog-platform-admin',{action,...extra});
};
const notify=(message,type='success')=>{
 if(typeof showToast==='function'){showToast(message,type);return}
 let old=document.getElementById('mx-admin-business-toast');if(old)old.remove();
 const el=document.createElement('div');el.id='mx-admin-business-toast';el.textContent=message;
 el.style.cssText='position:fixed;left:16px;bottom:18px;z-index:99999;max-width:min(480px,90vw);padding:13px 16px;border-radius:12px;background:'+(type==='error'?'#991b1b':'#133d2a')+';color:#fff;box-shadow:0 12px 30px #0002;font:700 13px Tajawal,Arial';
 document.body.appendChild(el);if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.remove(),4500);
};
const labelStatus=s=>({ACTIVE:'نشط',INACTIVE:'متوقف',SUSPENDED:'معلّق',TRIALING:'تجريبي',PENDING_PAYMENT:'بانتظار الدفع',PAST_DUE:'متأخر',CANCELLED:'ملغى',EXPIRED:'منتهي'}[String(s||'').toUpperCase()]||String(s||'—'));
const labelKind=k=>allowedKinds.find(x=>x[0]===String(k||'').toUpperCase())?.[1]||k||'—';
function modal(title,body,actions=''){
 const overlay=document.createElement('div');overlay.className='mx-modal';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('dir','rtl');
 overlay.style.cssText='position:fixed;inset:0;z-index:20000;background:rgba(15,23,42,.6);display:grid;place-items:center;padding:10px;backdrop-filter:blur(6px)';
 overlay.innerHTML='<section class="mx-modal-card" style="width:min(820px,100%);max-height:94dvh;overflow:auto;background:#fff;border-radius:20px;padding:20px;border:1px solid #e5e7eb;box-shadow:0 25px 80px #0003"><div class="section-head" style="margin-top:0"><div><span class="eyebrow">MANTIQATIX · PLATFORM ADMIN</span><h2>'+esc(title)+'</h2></div><button type="button" class="btn btn-outline" data-close>إغلاق</button></div>'+body+actions+'</section>';
 document.body.appendChild(overlay);
 const close=()=>overlay.remove();overlay.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',close));
 overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
 return {overlay,close};
}
function field(id,label,value='',type='text',placeholder=''){
 return '<label class="field"><span>'+esc(label)+'</span><input id="'+esc(id)+'" type="'+esc(type)+'" value="'+esc(value??'')+'" placeholder="'+esc(placeholder)+'" maxlength="2000"></label>';
}
function selectField(id,label,items,value=''){
 return '<label class="field"><span>'+esc(label)+'</span><select id="'+esc(id)+'">'+items.map(x=>'<option value="'+esc(x.value)+'" '+(String(value)===String(x.value)?'selected':'')+'>'+esc(x.label)+'</option>').join('')+'</select></label>';
}
function statusItems(value,options){
 return options.map(x=>({value:x,label:labelStatus(x)}));
}
function statusChip(value){
 const s=String(value||'').toUpperCase();const bg=s==='ACTIVE'?'#dcfce7':s==='SUSPENDED'||s==='PAST_DUE'?'#fef3c7':s==='INACTIVE'||s==='CANCELLED'||s==='EXPIRED'?'#fee2e2':'#f1f5f9';
 return '<span style="display:inline-flex;padding:5px 9px;border-radius:99px;font-size:11px;font-weight:900;background:'+bg+'">'+esc(labelStatus(s))+'</span>';
}
function shell(title,subtitle,body){
 return '<section class="hero" style="margin-bottom:16px"><div class="hero-actions" style="margin-top:0;justify-content:space-between;align-items:center"><div><span class="eyebrow">PLATFORM CONTROL / REAL DATA</span><h2>'+esc(title)+'</h2><p>'+esc(subtitle)+'</p></div><button class="btn btn-light" id="mx-pba-back" type="button">العودة للتحكم الكامل</button></div></section>'+body;
}
function pageBusinesses(){
 if(!roleOK())return '<section class="card"><h2>غير مصرح</h2><p>هذه الشاشة مخصصة لمالك المنصة بصلاحية SUPER_ADMIN.</p></section>';
 const start=Math.floor(state.offset/state.limit)+1,end=Math.min(state.offset+state.limit,state.total);
 const cards='<section class="cards"><article class="card"><div class="muted">عدد النتائج المطابقة</div><div class="kpi">'+state.total+'</div><small>من قاعدة البيانات ضمن نطاق الإنتاج</small></article><article class="card"><div class="muted">المعروض في الصفحة</div><div class="kpi">'+state.businesses.length+'</div><small>حد الصفحة '+state.limit+'</small></article><article class="card"><div class="muted">بدون مالك نشط</div><div class="kpi">'+state.businesses.filter(b=>!(b.owners||[]).some(o=>o.status==='ACTIVE')).length+'</div><small>ضمن السجلات المعروضة فقط</small></article><article class="card"><div class="muted">اشتراك نشط</div><div class="kpi">'+state.businesses.filter(b=>b.subscription?.status==='ACTIVE').length+'</div><small>ضمن السجلات المعروضة فقط</small></article></section>';
 const tenantOptions=[{value:'',label:'كل نطاقات الإنتاج'},...state.tenants.map(t=>({value:t.id,label:t.name+' ('+t.code+')'}))];
 const tenantSelect=selectField('mx-pba-tenant','نطاق المستأجر',tenantOptions,'');
 const table=state.loading?'<div class="empty-state">جاري تحميل البيانات الحقيقية…</div>':state.businesses.length?'<div class="table-wrap"><table><thead><tr><th>النشاط</th><th>التصنيف</th><th>الحالة</th><th>المالك</th><th>الاشتراك</th><th>تاريخ التحديث</th><th>إجراءات</th></tr></thead><tbody>'+state.businesses.map(b=>{
  const owner=(b.owners||[]).filter(o=>o.status==='ACTIVE').map(o=>o.email||o.name||o.userId).join('، ')||'لا يوجد مالك نشط';
  const subscription=b.subscription;
  const isArchived=Boolean(b.settings?.deleted_at);
  const actions='<div style="display:flex;gap:6px;flex-wrap:wrap;min-width:245px">'+
   '<button class="btn btn-outline" type="button" data-pba-edit="'+esc(b.id)+'">تعديل البيانات</button>'+
   '<button class="btn btn-outline" type="button" data-pba-owner="'+esc(b.id)+'">تعيين المالك</button>'+
   '<button class="btn btn-outline" type="button" data-pba-sub="'+esc(b.id)+'">الاشتراك</button>'+
   '<button class="btn btn-outline" type="button" data-pba-status="'+esc(b.id)+'">'+(b.status==='ACTIVE'?'إيقاف/تعليق':'تفعيل')+'</button>'+
   (isArchived?'<button class="btn btn-outline" type="button" data-pba-restore="'+esc(b.id)+'">استعادة</button>':'<button class="btn btn-outline" type="button" data-pba-archive="'+esc(b.id)+'">أرشفة</button>')+
   '</div>';
  const profile=b.settings?.catalog_profile||{};
  return '<tr><td><strong>'+esc(b.name)+'</strong><small style="display:block;color:#667085">'+esc(b.code)+' · '+esc(b.id)+'</small></td><td>'+esc(labelKind(b.settings?.activity_code||b.settings?.category_code||profile.activity_code))+'</td><td>'+statusChip(b.status)+(isArchived?'<small style="display:block;color:#991b1b">مؤرشف</small>':'')+'</td><td>'+esc(owner)+'</td><td>'+(subscription?statusChip(subscription.status)+'<small style="display:block">'+esc(subscription.tier_code)+' · '+esc(subscription.billing_cycle)+'</small>':'<span class="muted">لا يوجد اشتراك</span>')+'</td><td>'+esc(b.updatedAt?new Date(b.updatedAt).toLocaleDateString('ar-EG'):'—')+'</td><td>'+actions+'</td></tr>';
 }).join('')+'</tbody></table></div>':'<div class="empty-state">لا توجد أنشطة مطابقة للفلاتر.</div>';
 return shell('إدارة الأنشطة التجارية','البحث والتعديل وتعيين المالك وإدارة الحالة والاشتراك دون حذف سجلات مالية نهائيًا.',
 cards+
 '<section class="card" style="margin-bottom:16px"><div class="section-head" style="margin-top:0"><div><h3>البحث والتصفية</h3><p class="muted">البيانات تجلب من المسار الإداري المحمي. لا توجد بيانات DEMO.</p></div><button class="btn btn-primary" type="button" id="mx-pba-create" style="width:auto">+ إنشاء نشاط</button></div><div class="grid3">'+
 field('mx-pba-search','البحث باسم النشاط أو جزء من الاسم',state.search,'search')+
 selectField('mx-pba-status','حالة النشاط',[{value:'',label:'كل الحالات'},{value:'ACTIVE',label:'نشط'},{value:'INACTIVE',label:'متوقف'},{value:'SUSPENDED',label:'معلّق'}],state.filterStatus)+tenantSelect+
 '</div><div class="action-bar"><button class="btn btn-primary" id="mx-pba-run-search" type="button" style="width:auto">تطبيق</button><button class="btn btn-outline" id="mx-pba-refresh" type="button">تحديث البيانات</button><span class="muted">'+(state.total?('عرض '+start+'–'+end+' من '+state.total):'لا توجد نتائج')+'</span></div></section>'+
 '<section class="card"><div class="section-head" style="margin-top:0"><div><h3>سجل الأنشطة</h3><p class="muted">الأرشفة إيقاف منطقي يحافظ على العلاقات والدفاتر المالية. لا يوجد حذف نهائي هنا.</p></div><div class="action-bar"><button class="btn btn-outline" id="mx-pba-prev" type="button" '+(state.offset<=0?'disabled':'')+'>السابق</button><button class="btn btn-outline" id="mx-pba-next" type="button" '+(state.offset+state.limit>=state.total?'disabled':'')+'>التالي</button></div></div>'+table+'</section>');
}
function pageRules(){
 if(!roleOK())return '<section class="card"><h2>غير مصرح</h2></section>';
 const rows=state.rules;
 return shell('إدارة العمولات','إدارة قواعد النسبة المئوية المتوافقة مع محرك الطلبات الحالي. لا يدعم التدفق المالي الحالي fixed/per-item أو stacking يدويًا.',
 '<section class="cards"><article class="card"><div class="muted">قواعد محملة</div><div class="kpi">'+rows.length+'</div><small>حد القراءة 1000 قاعدة</small></article><article class="card"><div class="muted">قواعد نشطة</div><div class="kpi">'+rows.filter(r=>r.active).length+'</div><small>النطاقات النشطة تتطلب قاعدة واحدة فقط</small></article><article class="card"><div class="muted">قواعد غير صالحة للطلب</div><div class="kpi">'+rows.filter(r=>r.rule_type!=='PERCENTAGE'||Number(r.percentage)<0||Number(r.percentage)>100).length+'</div><small>لن يتم تغييرها تلقائيًا</small></article></section>'+
 '<section class="card"><div class="section-head" style="margin-top:0"><div><h3>قواعد العمولة</h3><p class="muted">لا تعدل نسبة قاعدة مستخدمة في معاملات سابقة؛ أنشئ قاعدة جديدة ثم أوقف السابقة.</p></div><div class="action-bar"><select id="mx-pbr-tenant" aria-label="نطاق العمولة">'+state.tenants.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===state.rulesTenant?'selected':'')+'>'+esc(t.name+' ('+t.code+')')+'</option>').join('')+'</select><button class="btn btn-primary" type="button" id="mx-pbr-create" style="width:auto">+ قاعدة جديدة</button></div></div>'+
 (rows.length?'<div class="table-wrap"><table><thead><tr><th>القاعدة</th><th>النطاق</th><th>النسبة</th><th>الحالة</th><th>تاريخ التحديث</th><th>الإجراءات</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><strong>'+esc(r.id)+'</strong><small style="display:block;color:#667085">'+esc(r.rule_type)+'</small></td><td>'+esc(r.business_name||'عام')+'<small style="display:block">'+esc(r.module_id||'كل الموديولات')+' · '+esc(r.tenant_id)+'</small></td><td>'+esc(r.percentage)+'%</td><td>'+statusChip(r.active?'ACTIVE':'INACTIVE')+'</td><td>'+esc(r.updated_at?new Date(r.updated_at).toLocaleDateString('ar-EG'):'—')+'</td><td><button class="btn btn-outline" type="button" data-pbr-edit="'+esc(r.id)+'">تعديل/تفعيل</button></td></tr>').join('')+'</tbody></table></div>':'<div class="empty-state">لا توجد قواعد عمولة محملة لهذا النطاق.</div>')+
 '<p class="muted">اختيار القاعدة في محرك التسعير الحالي يكون بحسب أكثر نطاق محدد (نشاط ثم موديول) ثم آخر تحديث. مخطط قاعدة البيانات لا يحتوي حقل أولوية أو تواريخ سريان، لذلك لا تظهر هنا سياسة stacking منفصلة.</p></section>');
}
function render(){
 const root=document.getElementById('page');if(!root)return;
 root.innerHTML=state.tab==='rules'?pageRules():pageBusinesses();
 bind();
}
async function refreshBusinesses(){
 state.loading=true;render();
 try{
  const tenantEl=document.getElementById('mx-pba-tenant');
  const tenantId=tenantEl?.value||'';
  const result=await api('LIST_BUSINESSES',{limit:state.limit,offset:state.offset,search:state.search,status:state.filterStatus,tenantId});
  state.businesses=Array.isArray(result.businesses)?result.businesses:[];
  state.total=Number(result.total||0);
 }catch(e){state.businesses=[];state.total=0;notify('تعذر تحميل الأنشطة: '+(e?.message||'خطأ غير معروف'),'error')}
 finally{state.loading=false;render()}
}
async function refreshRules(){
 state.loading=true;render();
 try{
  if(!state.rulesTenant)state.rulesTenant=state.tenants[0]?.id||'';
  const result=await api('LIST_COMMISSION_RULES',{tenantId:state.rulesTenant});
  state.rules=Array.isArray(result.rules)?result.rules:[];
 }catch(e){state.rules=[];notify('تعذر تحميل قواعد العمولات: '+(e?.message||'خطأ غير معروف'),'error')}
 finally{state.loading=false;render()}
}
async function loadTenants(){
 if(state.tenants.length)return;
 const res=await api('TENANT_LIST');
 state.tenants=Array.isArray(res.tenants)?res.tenants:[];
 if(!state.rulesTenant)state.rulesTenant=state.tenants[0]?.id||'';
}
function readBusinessForm(overlay){
 const val=id=>overlay.querySelector('#'+id)?.value?.trim()||'';
 return {id:val('mx-biz-id'),name:val('mx-biz-name'),activityCode:val('mx-biz-kind'),nameEn:val('mx-biz-en'),phone:val('mx-biz-phone'),address:val('mx-biz-address'),bio:val('mx-biz-bio'),governorate:val('mx-biz-gov'),markaz:val('mx-biz-markaz'),village:val('mx-biz-village'),workingHours:val('mx-biz-hours'),logoUrl:val('mx-biz-logo'),coverUrl:val('mx-biz-cover')};
}
function openCreate(){
 const body='<form id="mx-biz-create-form" class="form-grid"><div class="grid2">'+field('mx-biz-name','اسم النشاط *','','text','اسم النشاط')+
 selectField('mx-biz-kind','القطاع / التصنيف *',allowedKinds.map(x=>({value:x[0],label:x[1]})),'FOOD')+
 field('mx-biz-phone','رقم الهاتف','','tel','رقم التواصل')+field('mx-biz-address','العنوان')+
 field('mx-biz-en','الاسم بالإنجليزية')+'</div><p class="muted">الإنشاء لا ينشئ كلمة مرور. لتعيين المالك، يجب أن يكون لديه حساب Google موثق. يمكن تعيينه لاحقًا بعد تسجيله.</p>'+
 '<div class="action-bar"><button class="btn btn-primary" id="mx-biz-create-save" type="submit" style="width:auto">إنشاء النشاط</button></div><p id="mx-biz-create-status" class="muted" aria-live="polite"></p></form>';
 const m=modal('إنشاء نشاط جديد',body);
 const form=m.overlay.querySelector('#mx-biz-create-form');
 form.addEventListener('submit',async e=>{
  e.preventDefault();const button=m.overlay.querySelector('#mx-biz-create-save'),out=m.overlay.querySelector('#mx-biz-create-status');button.disabled=true;out.textContent='جارٍ الإنشاء…';
  try{
   const name=m.overlay.querySelector('#mx-biz-name').value.trim();if(name.length<2)throw new Error('اسم النشاط مطلوب');
   await loadTenants();const tenantId=state.tenants[0]?.id;if(!tenantId)throw new Error('لا يوجد نطاق إنتاج نشط');
   const kind=m.overlay.querySelector('#mx-biz-kind').value,phone=m.overlay.querySelector('#mx-biz-phone').value.trim(),address=m.overlay.querySelector('#mx-biz-address').value.trim(),nameEn=m.overlay.querySelector('#mx-biz-en').value.trim();
   const result=await api('CREATE_BUSINESS',{tenantId,business:{name,category:kind,phone,address,bio:'',slug:nameEn||name}});
   const businessId=String(result.business?.id||'');if(!businessId)throw new Error('تم الإنشاء دون رقم نشاط صالح');
   out.textContent='تم إنشاء النشاط '+businessId+'. يمكن تعيين مالكه الآن بعد إنشاء حساب Google الخاص به.';
   notify('تم إنشاء النشاط دون مالك؛ اربطه بحساب Google لاحقًا.','success');
   state.offset=0;await refreshBusinesses();
  }catch(e){out.textContent='تعذر الإنشاء: '+(e?.message||'خطأ غير معروف');button.disabled=false}
 });
}
function openEdit(b){
 const settings=b.settings||{},p=settings.catalog_profile||{};
 const body='<form id="mx-biz-edit-form" class="form-grid"><input id="mx-biz-id" type="hidden" value="'+esc(b.id)+'"><div class="grid2">'+
 field('mx-biz-name','اسم النشاط *',b.name)+
 selectField('mx-biz-kind','القطاع / التصنيف',allowedKinds.map(x=>({value:x[0],label:x[1]})),settings.activity_code||'FREELANCER')+
 field('mx-biz-en','الاسم بالإنجليزية',b.owners?.[0]?.name||'')+
 field('mx-biz-phone','رقم الهاتف',p.phone||settings.contact_phone||'','tel')+
 field('mx-biz-address','العنوان',p.address||settings.contact_address||'')+
 field('mx-biz-gov','المحافظة',p.governorate||'')+field('mx-biz-markaz','المركز/المدينة',p.markaz||'')+field('mx-biz-village','المنطقة/القرية',p.village||'')+
 field('mx-biz-hours','مواعيد العمل',p.working_hours||'')+field('mx-biz-logo','رابط الشعار',p.logo_url||'','url')+field('mx-biz-cover','رابط الغلاف',p.cover_url||'','url')+
 '</div><label class="field"><span>وصف النشاط</span><textarea id="mx-biz-bio" rows="4" maxlength="3000">'+esc(p.bio||'')+'</textarea></label>'+
 '<label class="field"><span>سبب التعديل *</span><input id="mx-biz-reason" maxlength="500" required placeholder="سبب تعديل بيانات النشاط"></label>'+
 '<div class="action-bar"><button class="btn btn-primary" type="submit" style="width:auto">حفظ بيانات النشاط</button></div><p class="muted" id="mx-biz-edit-status" aria-live="polite"></p></form>';
 const m=modal('تعديل بيانات النشاط',body);
 m.overlay.querySelector('#mx-biz-edit-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=m.overlay.querySelector('[type=submit]'),out=m.overlay.querySelector('#mx-biz-edit-status');button.disabled=true;out.textContent='جارٍ الحفظ…';
  try{
   const data=readBusinessForm(m.overlay),reason=m.overlay.querySelector('#mx-biz-reason').value.trim();
   if(data.name.length<2||reason.length<3)throw new Error('راجع اسم النشاط وسبب التعديل');
   await api('UPDATE_BUSINESS_PROFILE',{tenantId:b.tenantId,business:data,reason});
   notify('تم تحديث بيانات النشاط.','success');m.close();await refreshBusinesses();
  }catch(e){out.textContent='تعذر الحفظ: '+(e?.message||'خطأ غير معروف');button.disabled=false}
 });
}
async function assignOwner(b){
 const email=window.prompt('أدخل بريد Google الموثق لصاحب النشاط. لن يتم إنشاء كلمة مرور، ويجب أن يكون الحساب قد سجل الدخول مرة واحدة على الأقل.');
 if(!email||!email.trim())return;
 const reason=window.prompt('اكتب سبب تعيين المالك (إلزامي، 3 أحرف على الأقل):','تعيين مالك النشاط بعد التسجيل');
 if(!reason||reason.trim().length<3)return notify('تم إلغاء تعيين المالك لعدم إدخال السبب.','error');
 try{
  const result=await api('ASSIGN_BUSINESS_OWNER',{tenantId:b.tenantId,businessId:b.id,ownerEmail:email.trim(),reason:reason.trim()});
  notify('تم ربط '+result.ownerEmail+' بملكية النشاط.','success');await refreshBusinesses();
 }catch(e){notify('تعذر تعيين المالك: '+(e?.message||'خطأ غير معروف'),'error')}
}
async function changeBusinessStatus(b){
 const status=b.status==='ACTIVE'?'SUSPENDED':'ACTIVE';
 if(!window.confirm((status==='ACTIVE'?'تفعيل':'تعليق')+' نشاط '+b.name+'؟'))return;
 const reason=window.prompt('سبب تغيير الحالة (إلزامي):',status==='ACTIVE'?'إعادة تفعيل بعد المراجعة':'إيقاف مؤقت للنشاط');
 if(!reason||reason.trim().length<3)return;
 try{await api('SET_BUSINESS_STATUS',{tenantId:b.tenantId,businessId:b.id,status,reason:reason.trim()});notify('تم تغيير حالة النشاط.','success');await refreshBusinesses()}
 catch(e){notify('تعذر تغيير الحالة: '+(e?.message||'خطأ غير معروف'),'error')}
}
async function archiveBusiness(b){
 if(!window.confirm('أرشفة '+b.name+'؟ سيُوقف الظهور العام مع الاحتفاظ بالسجلات المالية والطلبات.'))return;
 const reason=window.prompt('سبب الأرشفة (إلزامي):','طلب الإدارة بأرشفة النشاط');
 if(!reason||reason.trim().length<3)return;
 try{await api('SOFT_DELETE_BUSINESS',{tenantId:b.tenantId,businessId:b.id,reason:reason.trim()});notify('تمت الأرشفة المنطقية.','success');await refreshBusinesses()}
 catch(e){notify('تعذر الأرشفة: '+(e?.message||'خطأ غير معروف'),'error')}
}
async function restoreBusiness(b){
 if(!window.confirm('استعادة '+b.name+' من الأرشيف؟ سيظل كتالوج النشاط غير منشور حتى تفعيله بشكل منفصل.'))return;
 const reason=window.prompt('سبب الاستعادة (إلزامي):','استعادة بعد مراجعة الإدارة');
 if(!reason||reason.trim().length<3)return;
 try{await api('RESTORE_BUSINESS',{tenantId:b.tenantId,businessId:b.id,reason:reason.trim()});notify('تمت الاستعادة.','success');await refreshBusinesses()}
 catch(e){notify('تعذر الاستعادة: '+(e?.message||'خطأ غير معروف'),'error')}
}
function openSubscription(b){
 const sub=b.subscription||{};
 const statuses=['TRIALING','PENDING_PAYMENT','ACTIVE','PAST_DUE','CANCELLED','EXPIRED'].map(x=>({value:x,label:labelStatus(x)}));
 const cycles=['MONTHLY','ANNUAL','TRIAL'].map(x=>({value:x,label:x==='MONTHLY'?'شهري':x==='ANNUAL'?'سنوي':'تجريبي'}));
 const today=new Date().toISOString().slice(0,10);
 const endDate=sub.ends_at?String(sub.ends_at).slice(0,10):'';
 const body='<form id="mx-sub-form" class="form-grid"><div class="grid2">'+
 field('mx-sub-id','معرّف الاشتراك (اختياري)',sub.id||'')+
 field('mx-sub-tier','رمز الباقة *',sub.tier_code||'BASIC')+
 selectField('mx-sub-cycle','دورة الفوترة',cycles,sub.billing_cycle||'MONTHLY')+
 selectField('mx-sub-status','حالة الاشتراك',statuses,sub.status||'PENDING_PAYMENT')+
 field('mx-sub-start','يبدأ في',sub.starts_at?String(sub.starts_at).slice(0,10):today,'date')+
 field('mx-sub-end','ينتهي في (اختياري)',endDate,'date')+
 '</div><label class="field"><span>سبب تعديل الاشتراك *</span><input id="mx-sub-reason" required maxlength="500" placeholder="سبب التعديل أو المنح اليدوي"></label>'+
 '<div style="padding:12px;background:#fff7e6;border:1px solid #f1d28b;border-radius:12px;color:#754915;font-size:12px;line-height:1.8">هذا الإجراء يغير حالة الاشتراك فقط. لا ينشئ دفعة ولا يثبت سدادًا ولا يغير سجلات التحصيل؛ لا تختَر «نشط» إلا إذا كان هذا قرارًا إداريًا موثقًا.</div>'+
 '<div class="action-bar"><button class="btn btn-primary" type="submit" style="width:auto">حفظ الاشتراك</button></div><p class="muted" id="mx-sub-status-msg" aria-live="polite"></p></form>';
 const m=modal('إدارة اشتراك النشاط',body);
 m.overlay.querySelector('#mx-sub-form').addEventListener('submit',async e=>{
  e.preventDefault();const btn=m.overlay.querySelector('[type=submit]'),out=m.overlay.querySelector('#mx-sub-status-msg');btn.disabled=true;out.textContent='جارٍ حفظ بيانات الاشتراك…';
  try{
   const subInput={id:m.overlay.querySelector('#mx-sub-id').value.trim()||undefined,tier_code:m.overlay.querySelector('#mx-sub-tier').value.trim().toUpperCase(),billing_cycle:m.overlay.querySelector('#mx-sub-cycle').value,status:m.overlay.querySelector('#mx-sub-status').value,starts_at:m.overlay.querySelector('#mx-sub-start').value,ends_at:m.overlay.querySelector('#mx-sub-end').value||null};
   const reason=m.overlay.querySelector('#mx-sub-reason').value.trim();if(subInput.tier_code.length<2||reason.length<3)throw new Error('رمز الباقة وسبب التغيير مطلوبان');
   await api('UPSERT_BUSINESS_SUBSCRIPTION',{tenantId:b.tenantId,businessId:b.id,subscription:subInput,reason});
   notify('تم حفظ الاشتراك. لم يتم تسجيل أي دفعة.','success');m.close();await refreshBusinesses();
  }catch(e){out.textContent='تعذر حفظ الاشتراك: '+(e?.message||'خطأ غير معروف');btn.disabled=false}
 });
}
function openRule(rule=null){
 const selectedTenant=rule?.tenant_id||state.rulesTenant||state.tenants[0]?.id||'';
 const body='<form id="mx-rule-form" class="form-grid"><div class="grid2">'+
 field('mx-rule-id','المعرّف (اتركه فارغًا لإنشاء قاعدة جديدة)',rule?.id||'')+
 selectField('mx-rule-tenant','نطاق الإنتاج',state.tenants.map(t=>({value:t.id,label:t.name+' ('+t.code+')'})),selectedTenant)+
 field('mx-rule-business','معرّف النشاط (اختياري = قاعدة عامة)',rule?.business_id||'','text','UUID الخاص بالنشاط')+
 field('mx-rule-module','معرّف الموديول (اختياري = كل الموديولات)',rule?.module_id||'','text','مثل MOD-MEDICAL')+
 field('mx-rule-percent','نسبة العمولة (%)',rule?.percentage??5,'number')+
 selectField('mx-rule-active','الحالة',[{value:'true',label:'نشطة'},{value:'false',label:'متوقفة'}],String(rule?.active??true))+
 '</div><label class="field"><span>سبب التعديل *</span><input id="mx-rule-reason" maxlength="500" required placeholder="سبب إنشاء أو تغيير القاعدة"></label><div class="action-bar"><button class="btn btn-primary" type="submit" style="width:auto">حفظ قاعدة العمولة</button></div><p id="mx-rule-output" class="muted" aria-live="polite"></p></form>';
 const m=modal(rule?'تعديل قاعدة العمولة':'إنشاء قاعدة عمولة',body);
 m.overlay.querySelector('#mx-rule-form').addEventListener('submit',async e=>{
  e.preventDefault();const btn=m.overlay.querySelector('[type=submit]'),out=m.overlay.querySelector('#mx-rule-output');btn.disabled=true;out.textContent='جارٍ التحقق والحفظ…';
  try{
   const rid=m.overlay.querySelector('#mx-rule-id').value.trim(),tenantId=m.overlay.querySelector('#mx-rule-tenant').value;
   const businessId=m.overlay.querySelector('#mx-rule-business').value.trim(),moduleId=m.overlay.querySelector('#mx-rule-module').value.trim();
   const percentage=Number(m.overlay.querySelector('#mx-rule-percent').value),reason=m.overlay.querySelector('#mx-rule-reason').value.trim();
   if(!tenantId||!Number.isFinite(percentage)||percentage<0||percentage>100||reason.length<3)throw new Error('راجع النطاق والنسبة وسبب التعديل');
   await api('UPSERT_COMMISSION_RULE',{tenantId,rule:{id:rid||undefined,business_id:businessId||null,module_id:moduleId||null,rule_type:'PERCENTAGE',percentage,active:m.overlay.querySelector('#mx-rule-active').value==='true'},reason});
   notify('تم حفظ قاعدة العمولة.','success');m.close();state.rulesTenant=tenantId;await refreshRules();
  }catch(e){out.textContent='تعذر الحفظ: '+(e?.message||'خطأ غير معروف');btn.disabled=false}
 });
}
function bind(){
 document.getElementById('mx-pba-back')?.addEventListener('click',back);
 document.getElementById('mx-pba-create')?.addEventListener('click',openCreate);
 document.getElementById('mx-pba-refresh')?.addEventListener('click',()=>refreshBusinesses());
 document.getElementById('mx-pba-run-search')?.addEventListener('click',()=>{
  state.search=document.getElementById('mx-pba-search')?.value.trim()||'';
  state.filterStatus=document.getElementById('mx-pba-status')?.value||'';
  state.offset=0;refreshBusinesses();
 });
 document.getElementById('mx-pba-search')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('mx-pba-run-search')?.click()}});
 document.getElementById('mx-pba-prev')?.addEventListener('click',()=>{state.offset=Math.max(0,state.offset-state.limit);refreshBusinesses()});
 document.getElementById('mx-pba-next')?.addEventListener('click',()=>{if(state.offset+state.limit<state.total){state.offset+=state.limit;refreshBusinesses()}});
 document.querySelectorAll('[data-pba-edit]').forEach(btn=>btn.addEventListener('click',()=>{
  const b=state.businesses.find(x=>String(x.id)===btn.dataset.pbaEdit);if(b)openEdit(b);
 }));
 document.querySelectorAll('[data-pba-owner]').forEach(btn=>btn.addEventListener('click',()=>{
  const b=state.businesses.find(x=>String(x.id)===btn.dataset.pbaOwner);if(b)assignOwner(b);
 }));
 document.querySelectorAll('[data-pba-status]').forEach(btn=>btn.addEventListener('click',()=>{
  const b=state.businesses.find(x=>String(x.id)===btn.dataset.pbaStatus);if(b)changeBusinessStatus(b);
 }));
 document.querySelectorAll('[data-pba-archive]').forEach(btn=>btn.addEventListener('click',()=>{
  const b=state.businesses.find(x=>String(x.id)===btn.dataset.pbaArchive);if(b)archiveBusiness(b);
 }));
 document.querySelectorAll('[data-pba-restore]').forEach(btn=>btn.addEventListener('click',()=>{
  const b=state.businesses.find(x=>String(x.id)===btn.dataset.pbaRestore);if(b)restoreBusiness(b);
 }));
 document.querySelectorAll('[data-pba-sub]').forEach(btn=>btn.addEventListener('click',()=>{
  const b=state.businesses.find(x=>String(x.id)===btn.dataset.pbaSub);if(b)openSubscription(b);
 }));
 document.getElementById('mx-pbr-back')?.addEventListener('click',back);
 document.getElementById('mx-pbr-create')?.addEventListener('click',()=>openRule());
 document.getElementById('mx-pbr-tenant')?.addEventListener('change',async e=>{state.rulesTenant=e.target.value;await refreshRules()});
 document.querySelectorAll('[data-pbr-edit]').forEach(btn=>btn.addEventListener('click',()=>{const r=state.rules.find(x=>String(x.id)===btn.dataset.pbrEdit);if(r)openRule(r)}));
}
async function open(){
 if(!roleOK()){notify('هذه الشاشة لمالك المنصة المخول فقط.','error');return}
 current='إدارة الأنشطة التجارية';
 try{localStorage.setItem('MNTYWorkspaceMode','ADMIN');localStorage.setItem('MNTYWorkspaceCurrent',current)}catch(_){}
 await loadTenants();render();await refreshBusinesses();
}
async function openRules(){
 if(!roleOK()){notify('هذه الشاشة لمالك المنصة المخول فقط.','error');return}
 current='إدارة العمولات';
 try{localStorage.setItem('MNTYWorkspaceMode','ADMIN');localStorage.setItem('MNTYWorkspaceCurrent',current)}catch(_){}
 await loadTenants();state.tab='rules';render();await refreshRules();
}
function back(){current='التحكم الكامل';state.tab='businesses';try{localStorage.setItem('MNTYWorkspaceCurrent',current)}catch(_){};renderApp({forceWorkspace:true})}
window.MNTYPlatformBusinesses={open,openRules,refreshBusinesses,refreshRules};
const previousEnhanced=window.enhancedPageContent;
if(typeof previousEnhanced==='function'){
 window.enhancedPageContent=function(){
  if(current==='إدارة الأنشطة التجارية'){state.tab='businesses';return pageBusinesses()}
  if(current==='إدارة العمولات'){state.tab='rules';return pageRules()}
  const html=previousEnhanced();
  if(current==='التحكم الكامل'&&roleOK()){
   return html+
    '<section class="card" style="margin-top:16px;padding:18px"><span class="eyebrow">BUSINESS ADMIN</span><h2>إدارة الأنشطة التجارية</h2><p class="muted">إدارة سجل الأنشطة، تعيين المالك، تعديل البيانات، الحالات والأرشفة، والاشتراكات من بيانات حقيقية.</p><button class="btn btn-primary" type="button" onclick="window.MNTYPlatformBusinesses.open()">فتح إدارة الأنشطة</button></section>'+
    '<section class="card" style="margin-top:16px;padding:18px"><span class="eyebrow">COMMISSION RULES</span><h2>إدارة العمولات</h2><p class="muted">قواعد نسبة مئوية فقط بما يتوافق مع محرك التحصيل الحالي، مع حماية القواعد التي لها معاملات مالية سابقة.</p><button class="btn btn-outline" type="button" onclick="window.MNTYPlatformBusinesses.openRules()">فتح إدارة العمولات</button></section>';
  }
  return html;
 };
}
})();
