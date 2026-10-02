/* MNTY Marketing Platform — RC214
   Unifies the platform's own marketing operation with external marketing companies.
   Read paths are RLS-scoped. No synthetic KPIs, no client secrets, no direct sensitive writes.
*/
(function(){
  'use strict';

  const cfg = window.MANTIQATIX_CONFIG;
  if(!cfg || !window.supabase?.createClient) return;

  const sb = window.MNTY_SB || window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  window.MNTY_SB = sb;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const roleNames = {
    INTERNAL: 'MantiqaTix Marketing — الجهة التسويقية الداخلية',
    EXTERNAL: 'شركة تسويق خارجية',
    FREELANCER: 'متخصص تسويق'
  };

  let state = {
    user: null,
    membership: null,
    providers: [],
    services: [],
    leads: [],
    projects: [],
    error: null,
    loading: false
  };

  async function auth(){
    const {data:{user}, error} = await sb.auth.getUser();
    if(error) throw error;
    if(!user || user.is_anonymous) throw new Error('AUTH_REQUIRED');
    state.user = user;

    const r = await sb.from('user_memberships')
      .select('id,tenant_id,business_id,branch_id,role,status')
      .eq('user_id', user.id)
      .eq('status','ACTIVE')
      .limit(20);

    if(r.error) throw r.error;

    const wanted = window.MNTYActiveMembershipId || localStorage.getItem('MNTYActiveMembershipId');
    state.membership = (r.data||[]).find(x => x.id === wanted) || r.data?.[0] || null;
  }

  async function read(){
    state.loading = true;
    state.error = null;
    render();

    try{
      await auth();

      const [providers, services, leads, projects] = await Promise.all([
        sb.from('marketing_provider_profiles')
          .select('id,name_ar,name_en,provider_kind,status,is_verified,is_featured,created_at,updated_at')
          .eq('status','ACTIVE')
          .order('is_featured',{ascending:false})
          .order('updated_at',{ascending:false})
          .limit(100),

        sb.from('marketing_services')
          .select('id,name_ar,name_en,code,category_code,status,created_at,updated_at')
          .eq('status','ACTIVE')
          .order('updated_at',{ascending:false})
          .limit(100),

        sb.from('marketing_leads')
          .select('id,title,status,source,service_area,budget_min,budget_max,currency,created_at,updated_at')
          .eq('requester_user_id', state.user.id)
          .order('created_at',{ascending:false})
          .limit(50),

        state.membership?.business_id
          ? sb.from('marketing_projects')
              .select('id,project_type,status,gross_value,platform_commission,management_fee,created_at,updated_at')
              .eq('client_business_id', state.membership.business_id)
              .order('created_at',{ascending:false})
              .limit(50)
          : Promise.resolve({data:[],error:null})
      ]);

      if(providers.error) throw providers.error;
      if(services.error) throw services.error;
      if(leads.error) throw leads.error;
      if(projects.error) throw projects.error;

      state.providers = providers.data || [];
      state.services = services.data || [];
      state.leads = leads.data || [];
      state.projects = projects.data || [];
    }catch(e){
      state.error = e;
    }finally{
      state.loading = false;
      render();
    }
  }

  function table(rows, headers){
    return '<div class="table-wrap"><table><thead><tr>' +
      headers.map(h=>'<th>'+h[0]+'</th>').join('') +
      '</tr></thead><tbody>' +
      (rows.length
        ? rows.map(r=>'<tr>'+headers.map(h=>'<td>'+esc(typeof h[1]==='function'?h[1](r):r[h[1]])+'</td>').join('')+'</tr>').join('')
        : '<tr><td colspan="'+headers.length+'">لا توجد بيانات فعلية مرئية ضمن صلاحيتك الحالية.</td></tr>') +
      '</tbody></table></div>';
  }

  function render(){
    const page = document.getElementById('page');
    if(!page) return;

    if(state.loading){
      page.innerHTML = '<section class="workspace-section"><div class="eyebrow">MARKETING</div><h1>التسويق والإعلان</h1><p class="muted">جاري تحميل بيانات التسويق الفعلية…</p></section>';
      return;
    }

    if(state.error){
      page.innerHTML = '<section class="workspace-section"><div class="eyebrow">MARKETING</div><h1>التسويق والإعلان</h1><div class="notice">تعذر تحميل مساحة التسويق: '+esc(state.error.message)+'</div></section>';
      return;
    }

    const leadCount = state.leads.length;
    const projectCount = state.projects.length;

    page.innerHTML =
      '<section class="workspace-section" dir="rtl">' +
        '<div class="workspace-head"><div>' +
          '<div class="eyebrow">MNTY MARKETING</div>' +
          '<h1>التسويق والإعلان</h1>' +
          '<p class="muted">منظومة واحدة للتسويق الذي تديره MantiqaTix، وللتعامل مع شركات ومتخصصي التسويق الخارجيين، مع فصل واضح بين العميل ومقدم الخدمة.</p>' +
        '</div></div>' +

        '<div class="cards">' +
          '<article class="card"><div class="card-title">الجهة الداخلية</div><h3>'+esc(roleNames.INTERNAL)+'</h3><p class="muted">تشغيل الحملات والخدمات التسويقية الخاصة بالمنصة وفق صلاحيات التشغيل المعتمدة.</p><span class="pill">INTERNAL</span></article>' +
          '<article class="card"><div class="card-title">شركات التسويق الخارجية</div><div class="metric">'+state.providers.length+'</div><div class="muted">ملفات تسويق فعالة ومرئية ضمن نطاق الصلاحية</div></article>' +
          '<article class="card"><div class="card-title">الخدمات التسويقية</div><div class="metric">'+state.services.length+'</div><div class="muted">خدمات فعالة ومرئية من الكتالوج التسويقي</div></article>' +
          '<article class="card"><div class="card-title">طلباتك</div><div class="metric">'+leadCount+'</div><div class="muted">طلبات تسويق مرئية للحساب الحالي</div></article>' +
        '</div>' +

        '<section class="workspace-section">' +
          '<div class="workspace-head"><div><h2>الجهة الداخلية</h2><p class="muted">MantiqaTix تستطيع تشغيل التسويق لنفسها، مع بقاء شركات التسويق الخارجية ضمن منظومة منفصلة عند استخدامها.</p></div></div>' +
          '<div class="card"><h3>تشغيل داخلي + سوق خدمات خارجي</h3><p>النموذج لا يفترض أن كل عميل يجب أن يعمل مع MantiqaTix مباشرة؛ يمكن عرض مقدمي خدمات تسويق خارجيين، استقبال الطلب، ثم إدارة المشروع وفق الصلاحيات وسجل التعاملات.</p></div>' +
        '</section>' +

        '<section class="workspace-section">' +
          '<div class="workspace-head"><div><h2>شركات ومتخصصو التسويق</h2><p class="muted">بيانات حقيقية فقط من الكتالوج التسويقي المتاح للحساب.</p></div></div>' +
          table(state.providers, [
            ['الجهة', r=>r.name_ar||r.name_en||'—'],
            ['النوع', r=>roleNames[String(r.provider_kind||'EXTERNAL').toUpperCase()]||r.provider_kind||'—'],
            ['موثق', r=>r.is_verified?'نعم':'لا'],
            ['مميز', r=>r.is_featured?'نعم':'لا'],
            ['الحالة','status']
          ]) +
        '</section>' +

        '<section class="workspace-section">' +
          '<div class="workspace-head"><div><h2>الخدمات التسويقية</h2><p class="muted">الخدمات الفعالة المنشورة من المصدر المصرح به.</p></div></div>' +
          table(state.services, [
            ['الخدمة', r=>r.name_ar||r.name_en||'—'],
            ['الكود','code'],
            ['التصنيف','category_code'],
            ['الحالة','status']
          ]) +
        '</section>' +

        '<section class="workspace-section">' +
          '<div class="workspace-head"><div><h2>طلباتك ومشروعاتك</h2><p class="muted">هذه الأعداد تخص السجلات المرئية للحساب الحالي، وليست مؤشرات منصة عامة.</p></div></div>' +
          '<div class="cards">' +
            '<article class="card"><div class="card-title">طلبات التسويق</div><div class="metric">'+leadCount+'</div><div class="muted">مرئية ضمن صلاحيتك</div></article>' +
            '<article class="card"><div class="card-title">المشروعات</div><div class="metric">'+projectCount+'</div><div class="muted">مرئية ضمن نشاطك</div></article>' +
          '</div>' +
          table(state.leads, [
            ['الطلب','title'],
            ['الحالة','status'],
            ['المصدر','source'],
            ['النطاق','service_area'],
            ['الميزانية',r=>(r.budget_min||r.budget_max)?((r.budget_min||0)+' — '+(r.budget_max||0)+' '+(r.currency||'')):'—']
          ]) +
        '</section>' +

        '<section class="workspace-section">' +
          '<div class="workspace-head"><div><h2>مسار القياس</h2><p class="muted">سيتم ربط Spend → Reach → Click → Lead → Qualified → Registration → Activation → Conversion → Revenue عندما تتوفر مصادرها الموثوقة؛ لا يتم اختراع أرقام للمراحل غير المسجلة.</p></div></div>' +
          '<div class="card"><strong>قاعدة البيانات الحالية لا تُعامل كل مرحلة على أنها رقم مؤكد.</strong><p class="muted">أي KPI مستقبلي يجب أن يحمل مصدره وحالته: FACT أو CALCULATION أو ANALYSIS أو NOT VERIFIED.</p></div>' +
        '</section>' +
      '</section>';
  }

  function install(){
    const nav = document.querySelector('.nav');
    if(!nav) return;
    const buttons = Array.from(nav.querySelectorAll('button'));
    const b = buttons.find(x => String(x.textContent||'').includes('التسويق والإعلان'));
    if(!b || b.dataset.mntyMarketingBound==='1') return;
    b.dataset.mntyMarketingBound='1';
    b.onclick=()=>{
      document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      read();
    };
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body,{childList:true,subtree:true});
  install();

  window.MNTYMarketingWorkspace = {render, refresh:read};
})();