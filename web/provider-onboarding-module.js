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