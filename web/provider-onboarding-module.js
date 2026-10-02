/* MNTY Provider Activity Onboarding — production workflow helper.
   Uses only authenticated Supabase Edge Functions. No direct sensitive writes and no demo data. */
(function(){
  'use strict';
  const cfg=window.MANTIQATIX_CONFIG;
  if(!cfg || !window.supabase?.createClient)return;
  const sb=window.MNTY_SB || window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey); window.MNTY_SB=sb;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const call=async(name,body)=>{
    const {data:{session},error}=await sb.auth.getSession();
    if(error)throw error;
    if(!session?.access_token)throw new Error('AUTH_REQUIRED');
    const r=await fetch(cfg.supabaseUrl+'/functions/v1/'+name,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify(body||{})});
    const p=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(p?.error||p?.message||'FUNCTION_FAILED');
    return p;
  };
  async function state(){
    const {data:{user}}=await sb.auth.getUser();
    if(!user || user.is_anonymous)throw new Error('AUTH_REQUIRED');
    const {data:memberships,error}=await sb.from('user_memberships').select('id,tenant_id,organization_id,business_id,branch_id,role,status').eq('user_id',user.id).eq('status','ACTIVE');
    if(error)throw error;
    const active=memberships?.find(x=>x.id===(window.MNTYActiveMembershipId||localStorage.getItem('MNTYActiveMembershipId'))) || memberships?.[0] || null;
    const tenantId=active?.tenant_id||null;
    let businesses=[];
    if(tenantId){
      const r=await sb.from('businesses').select('id,name,code,status,tenant_id,organization_id,settings,updated_at').eq('tenant_id',tenantId).order('updated_at',{ascending:false}).limit(20);
      if(r.error)throw r.error;
      businesses=r.data||[];
    }
    return {user,memberships:memberships||[],active,businesses};
  }
  function page(html){const p=document.getElementById('page');if(p)p.innerHTML=html;}
  async function render(){
    try{
      const s=await state();
      const role=String(s.active?.role||'CUSTOMER').toUpperCase();
      if(!s.active || !['SERVICE_PROVIDER','BUSINESS_OWNER','OWNER','ADMIN'].includes(role)){
        page('<section class="workspace-section"><div class="notice">تكوين النشاط متاح للحسابات التي لديها عضوية تشغيلية مناسبة. حساب العميل لا يحتاج إنشاء نشاط.</div></section>');
        return;
      }
      const cards=s.businesses.map(b=>{
        const set=b.settings||{};
        return '<article class="card"><div class="card-title">🏢 '+esc(b.name)+'</div><div class="muted">الحالة: '+esc(b.status)+' · الكود: '+esc(b.code)+'</div><div class="muted">القطاع: '+esc(set.sector||'غير محدد')+'</div><div class="muted">المدينة: '+esc(set.city||'غير محددة')+'</div>'+(String(b.status).toUpperCase()==='ACTIVE'?'<form class="card" data-branch-form="'+esc(b.id)+'" style="margin-top:12px"><div class="field"><label>اسم الفرع</label><input data-branch-name required maxlength="200" placeholder="مثال: فرع الدقي"></div><div class="field"><label>العنوان</label><input data-branch-address maxlength="500"></div><div class="field"><label>الهاتف</label><input data-branch-phone maxlength="64" inputmode="tel"></div><button class="btn" type="submit">إضافة فرع</button><div data-branch-result class="muted" style="margin-top:8px"></div></form>':'')+'<button class="btn" data-onboard-status="'+esc(b.id)+'" style="margin-top:10px">تحديث حالة التسجيل</button><div id="onboard-status-'+esc(b.id)+'" class="muted" style="margin-top:8px"></div>'+(String(b.status).toUpperCase()==='ACTIVE'?'<form class="card" data-catalog-form="'+esc(b.id)+'" style="margin-top:12px"><div class="field"><label>اسم الخدمة</label><input data-service-name required maxlength="200" placeholder="مثال: صيانة غسالة"></div><div class="field"><label>السعر (جنيه)</label><input data-service-price required type="number" min="0" step="0.01" inputmode="decimal"></div><button class="btn btn-primary" type="submit">إضافة الخدمة والسعر</button><div data-catalog-result class="muted" style="margin-top:8px"></div></form>':'')+'</article>';
      }).join('');
      page('<div class="workspace-head"><div><div class="eyebrow">PROVIDER ONBOARDING</div><h1>تكوين نشاط مقدم الخدمة</h1><p class="muted">إنشاء النشاط يمر بمسار الموافقة الرسمي. بعد التفعيل يمكن إعداد الكتالوج والأسعار من المسارات الخلفية الموثوقة.</p></div></div>'+
        '<section class="workspace-section"><h2>1. إنشاء نشاط</h2><form id="mnty-business-form" class="card"><div class="field"><label>اسم النشاط</label><input id="mnty-business-name" required maxlength="200" placeholder="اسم النشاط الحقيقي"></div><div class="field"><label>القطاع</label><input id="mnty-business-sector" maxlength="80" placeholder="مثال: MAINTENANCE"></div><div class="field"><label>المدينة</label><input id="mnty-business-city" maxlength="120"></div><div class="field"><label>المنطقة</label><input id="mnty-business-district" maxlength="120"></div><div class="field"><label>العنوان</label><input id="mnty-business-address" maxlength="500"></div><div class="field"><label>الهاتف</label><input id="mnty-business-phone" maxlength="64" inputmode="tel"></div><button class="btn btn-primary" type="submit">إرسال طلب إنشاء النشاط</button><div id="mnty-business-result" class="muted" style="margin-top:10px"></div></form></section>'+
        '<section class="workspace-section"><h2>2. أنشطتي</h2><div class="cards">'+(cards||'<div class="notice">لا يوجد نشاط بعد.</div>')+'</div></section>');
      document.getElementById('mnty-business-form')?.addEventListener('submit',async e=>{
        e.preventDefault(); const out=document.getElementById('mnty-business-result'); out.textContent='جارٍ إرسال الطلب…';
        try{
          const p=await call('business-register',{tenantId:s.active.tenant_id,organizationId:s.active.organization_id||null,name:document.getElementById('mnty-business-name').value.trim(),sector:document.getElementById('mnty-business-sector').value.trim()||'GENERAL',city:document.getElementById('mnty-business-city').value.trim(),district:document.getElementById('mnty-business-district').value.trim(),address:document.getElementById('mnty-business-address').value.trim(),phone:document.getElementById('mnty-business-phone').value.trim()});
          out.textContent='تم إنشاء طلب النشاط: '+(p.approvalRequestId||'PENDING')+' — النشاط في انتظار الموافقة.';
          setTimeout(render,500);
        }catch(err){out.textContent='تعذر إرسال الطلب: '+esc(err.message);}
      });
      document.querySelectorAll('[data-branch-form]').forEach(form=>form.addEventListener('submit',async e=>{
        e.preventDefault(); const out=form.querySelector('[data-branch-result]'); out.textContent='جارٍ إنشاء الفرع…';
        try{
          const branch=await call('business-branch-admin',{tenantId:s.active.tenant_id,businessId:form.dataset.branchForm,organizationId:s.active.organization_id||null,name:form.querySelector('[data-branch-name]').value.trim(),address:form.querySelector('[data-branch-address]').value.trim(),phone:form.querySelector('[data-branch-phone]').value.trim()});
          out.textContent='تم إنشاء الفرع: '+esc(branch?.branch?.name||'تم بنجاح');
        }catch(err){out.textContent='تعذر إنشاء الفرع: '+esc(err.message);}
      }));
      document.querySelectorAll('[data-catalog-form]').forEach(form=>form.addEventListener('submit',async e=>{
        e.preventDefault(); const out=form.querySelector('[data-catalog-result]'); out.textContent='جارٍ حفظ الخدمة والسعر…';
        try{
          const businessId=form.dataset.catalogForm; const name=form.querySelector('[data-service-name]').value.trim(); const price=Number(form.querySelector('[data-service-price]').value);
          if(!name||!Number.isFinite(price)||price<0)throw new Error('INVALID_SERVICE_OR_PRICE');
          const item=await call('catalog-admin',{action:'ITEM_UPSERT',tenantId:s.active.tenant_id,businessId,nameAr:name,itemType:'SERVICE',taxRate:0,metadata:{source:'provider_onboarding'}});
          const itemId=item?.id||item?.catalog_item_id||item?.data?.id;
          if(!itemId)throw new Error('CATALOG_ITEM_ID_MISSING');
          await call('catalog-admin',{action:'PRICE_UPSERT',tenantId:s.active.tenant_id,businessId,catalogItemId:itemId,currency:'EGP',unitPrice:price});
          out.textContent='تمت إضافة الخدمة والسعر عبر المسار الخلفي الموثوق.';
        }catch(err){out.textContent='تعذر حفظ الخدمة: '+esc(err.message);}
      }));
      document.querySelectorAll('[data-onboard-status]').forEach(btn=>btn.addEventListener('click',async()=>{
        const id=btn.dataset.onboardStatus; const out=document.getElementById('onboard-status-'+id); out.textContent='جارٍ التحقق…';
        try{const p=await call('business-onboarding-status',{businessId:id});out.textContent=(p.requests||[]).map(x=>'طلب '+x.id+': '+x.status).join(' · ')||'لا توجد حالة طلب.';}
        catch(err){out.textContent='تعذر قراءة الحالة: '+err.message;}
      }));
    }catch(err){page('<section class="workspace-section"><div class="notice">تعذر تحميل تكوين النشاط: '+esc(err.message)+'</div></section>');}
  }

  const onboardingView=async()=>{
    const page=html=>{const p=document.getElementById('page');if(p)p.innerHTML=html;};
    const draft=(()=>{try{return JSON.parse(localStorage.getItem('MNTYPendingActivityDraft')||'{}')||{};}catch(_){return {};}})();
    try{
      const {data:{user},error:ue}=await sb.auth.getUser(); if(ue)throw ue;
      if(!user||user.is_anonymous)throw new Error('AUTH_REQUIRED');
      const [rr,or,geo]=await Promise.all([
        sb.from('account_registration_requests').select('id,requested_role,status,created_at,reviewed_at').eq('user_id',user.id).eq('requested_role','SERVICE_PROVIDER').order('created_at',{ascending:false}).limit(10),
        sb.from('provider_onboarding_requests').select('id,registration_request_id,business_name,provider_kind,name_en,description,specialties,service_areas,status,rejection_reason,created_at,reviewed_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(10),
        sb.from('platform_geo_areas').select('id,code,name_ar,name_en,parent_id,level').eq('country_code','EG').eq('status','ACTIVE').in('level',['GOVERNORATE','CENTER']).order('level').order('name_ar')
      ]);
      if(rr.error)throw rr.error;if(or.error)throw or.error;if(geo.error)throw geo.error;
      const registrations=rr.data||[], onboardings=or.data||[], areas=geo.data||[], latest=onboardings[0]||null;
      const govs=areas.filter(x=>x.level==='GOVERNORATE'), centers=areas.filter(x=>x.level==='CENTER');
      const area=Array.isArray(draft.service_areas)?draft.service_areas[0]:null;
      const status=s=>({PENDING:'قيد المراجعة',APPROVED:'تم الاعتماد',REJECTED:'مرفوض — يمكن إعادة التقديم',CANCELLED:'ملغى'}[String(s||'').toUpperCase()]||String(s||''));
      const kinds=[['FOOD','مطاعم وكافيهات'],['HEALTH','أطباء وعيادات'],['PHARMACY','صيدليات'],['LABS','معامل تحاليل'],['RADIOLOGY','مراكز الأشعة'],['DENTAL','أطباء الأسنان'],['HOSPITAL','المستشفيات'],['REAL_ESTATE','العقارات'],['AUTO','السيارات والنقل'],['MAINTENANCE','الصيانة والخدمات المنزلية'],['ACCOUNTING','المحاسبة'],['LEGAL','الخدمات القانونية'],['COMPANIES','الشركات والموردون'],['EDU','التعليم والتدريب'],['DIGITAL','التسويق والإعلان'],['TECH','البرمجيات والخدمات الرقمية'],['FITNESS','الرياضة واللياقة'],['TRAVEL','السفر والرحلات'],['JOBS','الوظائف والتوظيف'],['MATRIMONY','الزواج والخدمات المرتبطة'],['USED_ITEMS','المستعمل'],['FASHION','الأزياء والخياطة'],['GROCERY','البقالة والسوبر ماركت'],['VETERINARY','الخدمات البيطرية'],['FREELANCER','المستقلون ومقدمو الخدمات']];
      const govOptions=govs.map(g=>'<option value="'+esc(g.id)+'" '+(String(g.id)===String(area?.governorate_id||'')?'selected':'')+'>'+esc(g.name_ar||g.name_en||g.code)+'</option>').join('');
      const locked=latest?.status==='PENDING'||latest?.status==='APPROVED';
      page('<section class="workspace-section" dir="rtl"><div class="workspace-head"><div><div class="eyebrow">PROVIDER ONBOARDING</div><h1>إضافة نشاط</h1><p class="muted">يتم إرسال الطلب للمراجعة؛ لا يتم إنشاء نشاط منشور أو عضوية تشغيلية من المتصفح.</p></div></div>'+
        (latest?'<article class="card"><div class="card-title">آخر طلب: '+esc(latest.business_name)+'</div><div class="muted">'+esc(status(latest.status))+' · '+esc(new Date(latest.created_at).toLocaleString('ar-EG'))+'</div>'+(latest.rejection_reason?'<div class="notice" style="margin-top:8px">سبب الرفض: '+esc(latest.rejection_reason)+'</div>':'')+'</article>':'')+
        '<section class="card" style="margin-top:14px"><h2>بيانات النشاط</h2><form id="mnty-po-form" class="form-grid">'+
        '<label class="field"><span>اسم النشاط *</span><input id="po-name" required maxlength="180" value="'+esc(draft.business_name||latest?.business_name||'')+'"></label>'+
        '<label class="field"><span>نوع النشاط *</span><select id="po-kind" required>'+kinds.map(x=>'<option value="'+x[0]+'" '+(String(draft.provider_kind||latest?.provider_kind||'FOOD')===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></label>'+
        '<label class="field"><span>الاسم بالإنجليزية</span><input id="po-name-en" maxlength="180" value="'+esc(draft.name_en||latest?.name_en||'')+'"></label>'+
        '<label class="field"><span>المحافظة *</span><select id="po-gov" required><option value="">اختر المحافظة</option>'+govOptions+'</select></label>'+
        '<label class="field"><span>المركز / المدينة *</span><select id="po-center" required><option value="">اختر المركز</option></select></label>'+
        '<label class="field" style="grid-column:1/-1"><span>وصف النشاط</span><textarea id="po-desc" rows="4" maxlength="3000">'+esc(draft.description||latest?.description||'')+'</textarea></label>'+
        '<label class="field" style="grid-column:1/-1"><span>الخدمات والتخصصات</span><input id="po-specialties" maxlength="1000" value="'+esc(Array.isArray(draft.specialties)?draft.specialties.join('، '):(draft.specialties||''))+'" placeholder="افصل العناصر بفواصل"></label>'+
        '<label class="field" style="grid-column:1/-1;display:flex;gap:8px;align-items:flex-start"><input id="po-consent" type="checkbox" required style="width:auto;margin-top:4px"><span>أقر بأن البيانات صحيحة وأوافق على مراجعتها وفق شروط المنصة.</span></label>'+
        '<div class="action-bar" style="grid-column:1/-1"><button class="btn btn-primary" id="po-submit" type="submit" '+(locked?'disabled':'')+'>'+(locked?'الطلب قيد المعالجة':'إرسال طلب الاعتماد')+'</button><button class="btn btn-outline" id="po-back" type="button">العودة</button></div><div id="po-result" class="muted" style="grid-column:1/-1"></div></form></section>'+
        '<section class="card" style="margin-top:14px"><h2>سجل الطلبات</h2>'+(registrations.length?registrations.map(r=>'<div class="muted" style="padding:8px 0;border-bottom:1px solid #eee">طلب '+esc(r.id)+' · '+esc(status(r.status))+' · '+esc(new Date(r.created_at).toLocaleString('ar-EG'))+'</div>').join(''):'<div class="muted">لا توجد طلبات مقدم خدمة بعد.</div>')+'</section></section>');
      const gov=document.getElementById('po-gov'), center=document.getElementById('po-center');
      const fill=()=>{const rows=centers.filter(x=>!gov.value||String(x.parent_id)===String(gov.value));center.innerHTML='<option value="">اختر المركز</option>'+rows.map(x=>'<option value="'+esc(x.id)+'" '+(String(x.id)===String(area?.center_id||'')?'selected':'')+'>'+esc(x.name_ar||x.name_en||x.code)+'</option>').join('');};
      gov?.addEventListener('change',()=>{center.value='';fill();}); fill();
      document.getElementById('po-back')?.addEventListener('click',()=>window.accountView?.());
      document.getElementById('mnty-po-form')?.addEventListener('submit',async e=>{
        e.preventDefault();const out=document.getElementById('po-result'),btn=document.getElementById('po-submit');btn.disabled=true;out.textContent='جارٍ إرسال طلب الاعتماد…';
        try{
          const g=gov.value,c=center.value,gr=govs.find(x=>String(x.id)===String(g)),cr=centers.find(x=>String(x.id)===String(c));
          if(!gr||!cr||String(cr.parent_id)!==String(gr.id))throw new Error('INVALID_GOVERNORATE_OR_CENTER');
          const specialties=String(document.getElementById('po-specialties').value||'').split(/[،,]/).map(x=>x.trim()).filter(Boolean).slice(0,30);
          const payload={business_name:document.getElementById('po-name').value.trim(),provider_kind:document.getElementById('po-kind').value,name_en:document.getElementById('po-name-en').value.trim(),description:document.getElementById('po-desc').value.trim(),specialties,service_areas:[{governorate_id:gr.id,governorate_code:gr.code,governorate_name_ar:gr.name_ar,center_id:cr.id,center_code:cr.code,center_name_ar:cr.name_ar}]};
          if(payload.business_name.length<2)throw new Error('BUSINESS_NAME_REQUIRED');
          try{localStorage.setItem('MNTYPendingActivityDraft',JSON.stringify(payload));}catch(_){}
          let reg=registrations.find(x=>x.status==='PENDING');
          if(!reg){
            if(typeof submitRegistrationRequest!=='function')throw new Error('REGISTRATION_PATH_UNAVAILABLE');
            try{await submitRegistrationRequest('SERVICE_PROVIDER');}catch(_){}
            const q=await sb.from('account_registration_requests').select('id,status').eq('user_id',user.id).eq('requested_role','SERVICE_PROVIDER').eq('status','PENDING').order('created_at',{ascending:false}).limit(1).maybeSingle();
            if(q.error)throw q.error;reg=q.data||null;
          }
          if(!reg)throw new Error('REGISTRATION_REQUEST_REQUIRED');
          const p=await call('mnty-provider-onboarding-submit',{registration_request_id:reg.id,tenant_id:'MNTY-PLATFORM',organization_id:'MNTY-MAIN',business_name:payload.business_name,provider_kind:payload.provider_kind,name_en:payload.name_en||null,description:payload.description||null,specialties:payload.specialties,service_areas:payload.service_areas});
          try{localStorage.removeItem('MNTYPendingActivityDraft');}catch(_){}
          out.textContent='تم إرسال طلب النشاط بنجاح. رقم الطلب: '+(p.onboarding_request_id||'PENDING');
          setTimeout(render,600);
        }catch(err){btn.disabled=false;out.textContent='تعذر إرسال الطلب: '+esc(err.message);}
      });
    }catch(err){page('<section class="workspace-section" dir="rtl"><div class="notice">تعذر تحميل طلب إضافة النشاط: '+esc(err.message)+'</div></section>');}
  };
  window.providerOnboardingView=onboardingView;

  function install(){
    const nav=document.querySelector('.nav');
    if(!nav || nav.querySelector('[data-mnty-provider-onboarding]'))return;
    const b=document.createElement('button');b.type='button';b.dataset.mntyProviderOnboarding='1';b.innerHTML='<span>🏢</span><span>تكوين النشاط</span>';
    b.onclick=()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');render();};
    nav.appendChild(b);
  }
  const obs=new MutationObserver(install);obs.observe(document.body,{childList:true,subtree:true});install();
  window.MNTYProviderOnboarding={render};
})();