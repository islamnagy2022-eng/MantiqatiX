(function(){
  const TAXONOMY = [
    ['🍔','مطاعم وكافيهات','مطاعم، كافيهات، حلويات','FOOD'],
    ['🩺','أطباء وعيادات','تخصصات وحجوزات','HEALTH'],
    ['💊','صيدليات','منتجات وخدمات','PHARMACY'],
    ['🧪','معامل تحاليل','تحاليل وتشخيص','LABS'],
    ['🩻','مراكز طبية','تشخيص ورعاية','MEDICAL'],
    ['🏠','عقارات','بيع وإيجار وخدمات','REAL_ESTATE'],
    ['🚗','سيارات ونقل','سيارات وخدمات نقل','AUTO'],
    ['🔧','خدمات منزلية','صيانة وإصلاح','HOME'],
    ['🎓','تعليم وتدريب','دورات ومهارات','EDU'],
    ['📣','تسويق وإعلان','حملات ونمو','DIGITAL'],
    ['💪','رياضة ولياقة','أندية ومدربون','FITNESS'],
    ['✈️','سياحة وسفر','رحلات وحجوزات','TRAVEL']
  ];
  const SERVICE_ICONS = {DIGITAL:'📣',CONTENT:'✍️',CREATIVE:'🎨',BRANDING:'✨',TECH:'💻',PR:'📢'};
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const logo = () => '<span class="mark" aria-hidden="true"></span>';
  const getClient = () => {
    try{
      const cfg=window.MANTIQATIX_CONFIG;
      if(!window.supabase?.createClient || !cfg?.supabaseUrl || !cfg?.supabaseKey) return null;
      return window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);
    }catch(_){return null}
  };
  const readArea = value => {
    if(!value) return '';
    if(Array.isArray(value)) return value.map(x => typeof x === 'string' ? x : (x?.name_ar || x?.name || x?.city || '')).filter(Boolean).slice(0,2).join('، ');
    if(typeof value === 'object') return value.name_ar || value.name || value.city || value.area || '';
    return String(value);
  };
  const providerMedia = provider => {
    const text = escapeHtml((provider?.name_ar || provider?.name_en || 'مقدم خدمة').slice(0,1));
    return '<div class="mx-photo mx-photo--provider"><span>'+text+'</span></div>';
  };
  const serviceMedia = service => '<div class="mx-photo mx-photo--service"><span>'+escapeHtml(SERVICE_ICONS[service?.category_code] || '◈')+'</span></div>';

  window.MXHomeLanding = function(){
    const app=document.getElementById('app');
    if(!app) return;

    app.innerHTML=`<main class="mx-home" dir="rtl">
      <header class="mx-header">
        <div class="mx-header__inner">
          <a class="mx-brand" href="#mx-home" aria-label="MNTY">'+logo()+'<div><div class="mx-brand__name">MANTIQATIX</div><span class="mx-brand__ar">MNTY · منصة متكاملة</span></div></a>
          <label class="mx-search" aria-label="البحث">
            <span class="mx-search__location">⌖ <span id="mx-location-label">الموقع عند الحاجة</span></span>
            <input id="mx-home-search" autocomplete="off" placeholder="ابحث عن خدمة، مقدم خدمة، نشاط...">
            <button id="mx-search-btn" type="button" aria-label="بحث">⌕</button>
          </label>
          <nav class="mx-nav">
            <a href="#mx-home">الرئيسية</a>
            <a href="#mx-categories">التصنيفات</a>
            <a href="#mx-services">الخدمات</a>
            <a href="#mx-offers">العروض</a>
            <a href="#mx-marketing">التسويق والإعلانات</a>
            <a href="#mx-contact">تواصل معنا</a>
            <button class="mx-nav__icon" id="mx-login" type="button" aria-label="تسجيل الدخول">♙</button>
            <button class="mx-add" id="mx-add" type="button">＋ إضافة نشاط</button>
          </nav>
        </div>
      </header>

      <div class="mx-main" id="mx-home">
        <section class="mx-hero" aria-label="الواجهة الرئيسية">
          <div class="mx-hero__copy">
            <span class="mx-hero__eyebrow">MNTY · الهوية الحديثة لمنصة MantiqatiX</span>
            <h1>كل الخدمات في مكان واحد</h1>
            <p>اكتشف الخدمات ومقدميها، ابحث وقارن وابدأ طلبك بسهولة. نستخدم الموقع فقط عندما تكون هناك حاجة تشغيلية وبحسب الإذن.</p>
            <div class="mx-trust-row"><span>✓ مقدمو خدمات مسجلون</span><span>⚡ تجربة سريعة</span><span>⌖ موقع عند الحاجة</span></div>
            <div class="mx-hero__actions">
              <button class="mx-btn mx-btn--primary" id="mx-start" type="button">ابدأ الآن ←</button>
              <button class="mx-btn mx-btn--light" id="mx-explore" type="button">استكشف الخدمات</button>
            </div>
          </div>
          <div class="mx-hero__visual">
            <div class="mx-hero__visual-card"><b>منطقتك، خدمتك تبدأ هنا</b><span>اكتشاف · مطابقة · تواصل · تنفيذ</span></div>
            <div class="mx-hero__city" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
            <div class="mx-hero__phone" aria-hidden="true"><span>MX</span></div>
          </div>
        </section>

        <section class="mx-section" id="mx-categories">
          <div class="mx-section__head"><div><h2>استكشف القطاعات</h2><p>تنقل سريع إلى نوع النشاط أو الخدمة التي تبحث عنها.</p></div><button class="mx-link" id="mx-all" type="button">عرض الكل ←</button></div>
          <div class="mx-categories" id="mx-category-grid"></div>
        </section>

        <section class="mx-section" id="mx-services">
          <div class="mx-section__head"><div><h2>الخدمات المتاحة الآن</h2><p>بيانات منشورة من كتالوج المنصة، وليست بيانات وهمية.</p></div><span class="mx-live" id="mx-live-status">جارٍ التحميل...</span></div>
          <div class="mx-service-grid" id="mx-service-grid"><div class="mx-loading">جارٍ تحميل الخدمات...</div></div>
        </section>

        <section class="mx-section" id="mx-offers">
          <div class="mx-section__head"><div><h2>إعلانات ممولة</h2><p>تظهر هنا الأنشطة المميزة المنشورة والفعالة فقط.</p></div><button class="mx-link" id="mx-ad-cta" type="button">أعلن عن نشاطك ←</button></div>
          <div class="mx-sponsored" id="mx-sponsored"><div class="mx-empty">جارٍ التحقق من الإعلانات المنشورة...</div></div>
        </section>

        <section class="mx-section" id="mx-nearby">
          <div class="mx-section__head"><div><h2>أنشطة ومقدمو خدمات</h2><p>نتائج موثقة من الكتالوج العام. لا يتم ادعاء القرب الجغرافي دون بيانات موقع مناسبة.</p></div><button class="mx-link" id="mx-location-btn" type="button">استخدام الموقع عند الحاجة</button></div>
          <div class="mx-provider-grid" id="mx-provider-grid"><div class="mx-empty">جارٍ تحميل مقدمي الخدمات...</div></div>
        </section>

        <section class="mx-section mx-module-strip" id="mx-marketing">
          <div><span class="mx-hero__eyebrow">وحدات المنصة</span><h2>من الاكتشاف إلى التشغيل</h2><p>واجهة واحدة تربط البحث والخدمات والتسويق وطلبات الخدمة مع الوحدات التشغيلية المخصصة للمستخدمين المسجلين.</p></div>
          <div class="mx-module-grid">
            <button data-module="CRM">👥<b>CRM</b><small>إدارة العملاء والعلاقات</small></button>
            <button data-module="MARKETING">📣<b>التسويق والإعلانات</b><small>الحملات والظهور المدفوع</small></button>
            <button data-module="ANALYTICS">📊<b>التحليلات والتقارير</b><small>مؤشرات وقرارات تشغيلية</small></button>
            <button data-module="OPERATIONS">⚙️<b>العمليات والمهام</b><small>متابعة التنفيذ والخدمة</small></button>
          </div>
        </section>
      </div>

      <footer class="mx-footer" id="mx-contact">
        <div class="mx-footer__inner">
          <div><div class="mx-footer__brand">MANTIQATIX</div><div class="mx-footer__sub">MNTY · منصة ربط الخدمات ومقدميها</div><div class="mx-footer__sub">منصة تسويق وتشغيل متكاملة، وليست منصة خرائط فقط.</div></div>
          <div><h3>روابط سريعة</h3><a href="#mx-home">الرئيسية</a><a href="#mx-categories">التصنيفات</a><a href="#mx-services">الخدمات</a><a href="#mx-offers">الإعلانات</a></div>
          <div><h3>عن MNTY</h3><a href="#" data-auth-link="about">من نحن</a><a href="#" data-auth-link="legal">الشروط والأحكام</a><a href="#" data-auth-link="privacy">سياسة الخصوصية</a></div>
          <div><h3>خدمة العملاء</h3><div class="mx-footer__support">01010171770</div><div class="mx-footer__sub">منصتك في كل مكان</div></div>
        </div>
        <div class="mx-footer__bar"><span>© MNTY</span><span>بيانات حية عند توفرها · بدون بيانات وهمية</span></div>
      </footer>
      <nav class="mx-bottom-nav">
        <button class="active" type="button" data-scroll="mx-home">⌂<span>الرئيسية</span></button>
        <button type="button" id="mx-bottom-search">⌕<span>بحث</span></button>
        <button class="plus" id="mx-bottom-add" type="button">＋</button>
        <button type="button" data-scroll="mx-offers">☆<span>العروض</span></button>
        <button type="button" id="mx-bottom-account">♙<span>حسابي</span></button>
      </nav>
    </main>`;

    const categoryGrid=document.getElementById('mx-category-grid');
    categoryGrid.innerHTML=TAXONOMY.map(c=>'<button class="mx-category" type="button" data-category="'+escapeHtml(c[3])+'"><span class="mx-category__media">'+c[0]+'</span><strong>'+escapeHtml(c[1])+'</strong><small>'+escapeHtml(c[2])+'</small></button>').join('');

    const goLogin=()=>typeof authView==='function'&&authView();
    const scrollTo=id=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
    document.getElementById('mx-login').onclick=goLogin;
    document.getElementById('mx-add').onclick=goLogin;
    document.getElementById('mx-bottom-account').onclick=goLogin;
    document.getElementById('mx-bottom-add').onclick=goLogin;
    document.getElementById('mx-start').onclick=()=>scrollTo('mx-categories');
    document.getElementById('mx-explore').onclick=()=>scrollTo('mx-services');
    document.getElementById('mx-all').onclick=goLogin;
    document.getElementById('mx-ad-cta').onclick=goLogin;
    document.querySelectorAll('.mx-category').forEach(btn=>btn.onclick=()=>{ document.getElementById('mx-home-search').value=btn.querySelector('strong').textContent; loadData(btn.querySelector('strong').textContent); scrollTo('mx-services'); });
    document.querySelectorAll('[data-scroll]').forEach(btn=>btn.onclick=()=>scrollTo(btn.dataset.scroll));
    document.querySelectorAll('[data-auth-link]').forEach(a=>a.onclick=e=>{e.preventDefault();goLogin()});
    document.querySelectorAll('[data-module]').forEach(btn=>btn.onclick=goLogin);

    const renderServices=(services)=>{
      const el=document.getElementById('mx-service-grid');
      if(!services.length){el.innerHTML='<div class="mx-empty"><b>لا توجد خدمات منشورة حاليًا</b><span>سيظهر كتالوج الخدمات هنا تلقائيًا عند نشر الخدمات واعتمادها.</span></div>';return}
      el.innerHTML=services.map(s=>'<article class="mx-service-card">'+serviceMedia(s)+'<div class="mx-service-card__body"><span class="mx-chip">'+escapeHtml(s.category_code||'SERVICE')+'</span><h3>'+escapeHtml(s.name_ar||s.name_en||'خدمة')+'</h3><p>'+escapeHtml(s.description||'خدمة متاحة ضمن كتالوج MNTY.')+'</p><button type="button" class="mx-card-link" data-service="'+escapeHtml(s.id)+'">استكشف الخدمة ←</button></div></article>').join('');
      el.querySelectorAll('[data-service]').forEach(b=>b.onclick=goLogin);
    };
    const renderProviders=(providers)=>{
      const el=document.getElementById('mx-provider-grid');
      if(!providers.length){el.innerHTML='<div class="mx-empty"><b>لا يوجد مقدمو خدمات منشورون حاليًا</b><span>لن يتم إنشاء أو عرض أسماء تجريبية. ستظهر الجهات بعد نشرها واعتمادها.</span></div>';return}
      el.innerHTML=providers.map(p=>'<article class="mx-provider-card">'+providerMedia(p)+'<div class="mx-provider-card__body"><div class="mx-provider-card__top"><span class="mx-verified">'+(p.is_verified?'✓ موثق':'منشور')+'</span></div><h3>'+escapeHtml(p.name_ar||p.name_en||'مقدم خدمة')+'</h3><p>'+escapeHtml(p.description||'مقدم خدمة مسجل على MNTY.')+'</p><span class="mx-location">⌖ '+escapeHtml(readArea(p.service_areas)||'نطاق خدمة معلن')+'</span><button type="button" class="mx-card-link" data-provider="'+escapeHtml(p.id)+'">عرض الملف ←</button></div></article>').join('');
      el.querySelectorAll('[data-provider]').forEach(b=>b.onclick=goLogin);
    };
    const renderSponsored=(providers)=>{
      const el=document.getElementById('mx-sponsored');
      const featured=providers.filter(p=>p.is_featured).slice(0,4);
      if(!featured.length){el.innerHTML='<div class="mx-feature-ad"><span class="mx-feature-ad__badge">إعلان ممول</span><div><h3>كبّر ظهور نشاطك</h3><p>المساحة الإعلانية تُملأ تلقائيًا عند وجود نشاط منشور ومميز وفق قواعد المنصة.</p><button class="mx-btn mx-btn--primary" id="mx-feature-cta" type="button">ابدأ الإعلان الآن</button></div></div><div class="mx-empty mx-empty--dark">لا توجد إعلانات ممولة منشورة حاليًا.</div>';document.getElementById('mx-feature-cta').onclick=goLogin;return}
      el.innerHTML='<div class="mx-feature-ad"><span class="mx-feature-ad__badge">إعلان ممول</span><div><h3>ظهور مميز أمام جمهورك</h3><p>نتائج مدفوعة موسومة بوضوح ضمن تجربة البحث.</p></div></div><div class="mx-listing-grid">'+featured.map(p=>'<article class="mx-listing">'+providerMedia(p)+'<div class="mx-listing__body"><span class="mx-sponsored-badge">ممول</span><span class="mx-verified">'+(p.is_verified?'✓ موثق':'منشور')+'</span><h3>'+escapeHtml(p.name_ar||p.name_en||'مقدم خدمة')+'</h3><p>'+escapeHtml(p.description||'نشاط مميز على MNTY.')+'</p><button class="mx-listing__cta" type="button" data-provider="'+escapeHtml(p.id)+'">عرض النشاط</button></div></article>').join('')+'</div>';
      el.querySelectorAll('[data-provider]').forEach(b=>b.onclick=goLogin);
    };

    const loadData=async(searchText='')=>{
      const sb=getClient();
      const status=document.getElementById('mx-live-status');
      if(!sb){status.textContent='وضع العرض';renderServices([]);renderProviders([]);renderSponsored([]);return}
      const term=String(searchText||'').trim();
        const safeTerm=term.replace(/[^p{L}p{N}s_-]/gu,' ').trim().slice(0,60);
      try{
        let serviceQuery=sb.from('marketing_services').select('id,code,name_ar,name_en,category_code,description').eq('status','ACTIVE').order('created_at',{ascending:false}).limit(12);
        let providerQuery=sb.from('marketing_provider_profiles').select('id,name_ar,name_en,description,service_areas,status,is_verified,is_featured,ranking_weight').eq('status','ACTIVE').order('is_featured',{ascending:false}).order('ranking_weight',{ascending:false}).limit(12);
        if(safeTerm){serviceQuery=serviceQuery.or('name_ar.ilike.%'+safeTerm+'%,name_en.ilike.%'+safeTerm+'%,description.ilike.%'+safeTerm+'%');providerQuery=providerQuery.or('name_ar.ilike.%'+safeTerm+'%,name_en.ilike.%'+safeTerm+'%,description.ilike.%'+safeTerm+'%')}
        const [servicesRes,providersRes]=await Promise.all([serviceQuery,providerQuery]);
        if(servicesRes.error) throw servicesRes.error;
        if(providersRes.error) throw providersRes.error;
        const services=servicesRes.data||[], providers=providersRes.data||[];
        renderServices(services);renderProviders(providers);renderSponsored(providers);
        status.textContent='مباشر · '+(services.length+providers.length)+' نتيجة';
      }catch(error){
        console.warn('[MNTY home] public catalog load failed',error);
        status.textContent='تعذر تحميل البيانات الحية';
        renderServices([]);renderProviders([]);renderSponsored([]);
      }
    };

    const search=()=>{const input=document.getElementById('mx-home-search');loadData(input.value);scrollTo('mx-services')};
    document.getElementById('mx-search-btn').onclick=search;
    document.getElementById('mx-home-search').onkeydown=e=>{if(e.key==='Enter')search()};
    document.getElementById('mx-bottom-search').onclick=()=>document.getElementById('mx-home-search').focus();
    document.getElementById('mx-location-btn').onclick=()=>goLogin();
    loadData();
  };
})();