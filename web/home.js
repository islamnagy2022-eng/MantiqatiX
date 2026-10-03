(function(){
  const TAXONOMY = [
    ['🍔','مطاعم وكافيهات','مطاعم، كافيهات، حلويات','FOOD'],
    ['🩺','أطباء وعيادات','تخصصات وحجوزات','HEALTH'],
    ['💊','صيدليات','منتجات وخدمات','PHARMACY'],
    ['🧪','معامل تحاليل','تحاليل وتشخيص','LABS'],
    ['🩻','مراكز الأشعة','أشعة وتشخيص','RADIOLOGY'],
    ['🦷','أطباء الأسنان','أسنان وعيادات تخصصية','DENTAL'],
    ['🏥','المستشفيات','أقسام ورعاية وحجوزات','HOSPITAL'],
    ['🩻','مراكز طبية','تشخيص ورعاية','MEDICAL'],
    ['🏠','عقارات','بيع وإيجار وخدمات','REAL_ESTATE'],
    ['🚗','سيارات ونقل','سيارات وخدمات نقل','AUTO'],
    ['🔧','الصيانة والخدمات المنزلية','صيانة وإصلاح وخدمات منزلية','MAINTENANCE'],
    ['🧾','المحاسبة ومكاتب المحاسبة','محاسبون ومكاتب وخدمات مالية','ACCOUNTING'],
    ['⚖️','المحاماة والخدمات القانونية','محامون ومكاتب واستشارات قانونية','LEGAL'],
    ['🏢','الشركات والموردون','شركات، مصانع، موردون وخدمات أعمال','COMPANIES'],
    ['🎓','تعليم وتدريب','دورات ومدارس ومدرسون','EDU'],
    ['📣','تسويق وإعلان','حملات ونمو وشركات تسويق','DIGITAL'],
    ['💻','البرمجيات والخدمات الرقمية','برمجيات، مواقع وخدمات تقنية','TECH'],
    ['💪','رياضة ولياقة','أندية ومدربون','FITNESS'],
    ['✈️','سياحة وسفر','رحلات وحجوزات','TRAVEL'],
    ['🚕','MantiGO والنقل عند الطلب','رحلات، سائقون ومقدمو عروض','MANTIGO'],
    ['💼','الوظائف والتوظيف','وظائف، أصحاب أعمال ومتقدمون','JOBS'],
    ['💍','الزواج والخدمات المرتبطة','خدمات وملفات وترشيحات','MATRIMONY'],
    ['♻️','المستعمل','إعلانات وعروض وتفاوض','USED_ITEMS'],
    ['👗','الأزياء والخياطة','متاجر، منتجات وخدمات تفصيل','FASHION'],
    ['🛒','البقالة والسوبر ماركت','منتجات، مخزون وطلبات','GROCERY'],
    ['🐾','العيادات والخدمات البيطرية','أطباء وخدمات للحيوانات','VETERINARY'],
    ['🤝','المستقلون ومقدمو الخدمات','خدمات احترافية ومشروعات مستقلة','FREELANCER']
  ];
  const SERVICE_ICONS = {DIGITAL:'📣',CONTENT:'✍️',CREATIVE:'🎨',BRANDING:'✨',TECH:'💻',PR:'📢'};
  const ACTIVITY_IMAGES = {FOOD:'food.svg',HEALTH:'health.svg',PHARMACY:'pharmacy.svg',LABS:'labs.svg',RADIOLOGY:'medical.svg',DENTAL:'medical.svg',HOSPITAL:'medical.svg',MEDICAL:'medical.svg',REAL_ESTATE:'real-estate.svg',AUTO:'auto.svg',HOME:'home.svg',MAINTENANCE:'home.svg',ACCOUNTING:'digital.svg',LEGAL:'digital.svg',COMPANIES:'home.svg',EDU:'education.svg',DIGITAL:'digital.svg',TECH:'digital.svg',FITNESS:'fitness.svg',TRAVEL:'travel.svg',MANTIGO:'auto.svg',JOBS:'home.svg',MATRIMONY:'home.svg',USED_ITEMS:'home.svg',FASHION:'home.svg',GROCERY:'home.svg',VETERINARY:'medical.svg',FREELANCER:'digital.svg'};
  const activityImage = code => 'assets/activity/'+(ACTIVITY_IMAGES[String(code||'').toUpperCase()]||'home.svg');
  const publicProfileImage = provider => {
    const path=provider?.profile_image_path;
    if(!path) return '';
    try { const sb=getClient(); const url=sb?.storage?.from('mantiqatix-profile-media').getPublicUrl(path)?.data?.publicUrl || ''; return url ? url+'?v='+encodeURIComponent(String(provider?.updated_at||'1').replace(/[^A-Za-z0-9._:-]/g,'')) : ''; } catch(_) { return ''; }
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const logo = () => '<span class="mark" aria-hidden="true"></span>';
  const normCode = value => String(value||'').trim().toUpperCase().replace(/[^A-Z0-9_:-]+/g,'_');
  let HOME_RUNTIME_FLAGS = null;
  const loadHomeRuntimeFlags = async sb => {
    try {
      const sessionRes = await sb.auth.getSession();
      if (sessionRes.error || !sessionRes.data?.session?.user) {
        HOME_RUNTIME_FLAGS={};
        return HOME_RUNTIME_FLAGS;
      }
      const r=await sb.from('platform_feature_flags').select('module_code,feature_code,enabled,configuration').limit(500);
      if(r.error) throw r.error;
      const map={};
      (r.data||[]).forEach(x=>{
        const moduleCode=normCode(x.module_code), featureCode=normCode(x.feature_code);
        if(moduleCode) map[moduleCode+':'+featureCode]=x;
      });
      HOME_RUNTIME_FLAGS=map;
    } catch(_) {
      HOME_RUNTIME_FLAGS={};
    }
    return HOME_RUNTIME_FLAGS;
  };
  const homeFeatureEnabled = code => {
    const map=HOME_RUNTIME_FLAGS||{};
    const m=normCode(code);
    const candidates=['MODULE_ENABLED','ENABLED','VISIBILITY'];
    for(const f of candidates){
      const row=map[m+':'+f];
      if(row) return row.enabled!==false;
    }
    return true;
  };
  const homeSectionEnabled = code => homeFeatureEnabled(code);
  const dynamicTaxonomy = (services,providers) => {
    const known=new Map(TAXONOMY.map(x=>[x[3],x]));
    [...(services||[]).map(x=>x.category_code),...(providers||[]).map(x=>x.provider_kind)]
      .filter(Boolean).forEach(code=>{
        const key=normCode(code);
        if(!known.has(key) && homeFeatureEnabled(key)){
          const label=String(code).replace(/[_-]+/g,' ').trim();
          known.set(key,['◉',label,'خدمات وأنشطة منشورة على المنصة',key]);
        }
      });
    return [...known.values()].filter(x=>homeFeatureEnabled(x[3]));
  };
  const getClient = () => {
    try{
      const cfg=window.MNTY_CONFIG;
      if(!window.supabase?.createClient || !cfg?.supabaseUrl || !cfg?.supabaseKey) return null;
      if(window.MNTY_SB) return window.MNTY_SB; const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey); window.MNTY_SB=sb; return sb;
    }catch(_){return null}
  };
  const readArea = value => {
    if(!value) return '';
    if(Array.isArray(value)) return value.map(x => typeof x === 'string' ? x : (x?.name_ar || x?.name || x?.city || '')).filter(Boolean).slice(0,2).join('، ');
    if(typeof value === 'object') return value.name_ar || value.name || value.city || value.area || '';
    return String(value);
  };
  const providerMedia = provider => {
    const image=publicProfileImage(provider);
    const fallback=activityImage(provider?.provider_kind);
    const text = escapeHtml((provider?.name_ar || provider?.name_en || 'مقدم خدمة').slice(0,1));
    return '<div class="mx-photo mx-photo--provider">'+(image?'<img src="'+escapeHtml(image)+'" alt="'+escapeHtml(provider?.name_ar||provider?.name_en||'صورة النشاط')+'" loading="lazy">':'<img src="'+fallback+'" alt="صورة النشاط" loading="lazy"><span class="mx-photo-fallback">'+text+'</span>')+'</div>';
  };
  const serviceMedia = service => '<div class="mx-photo mx-photo--service"><img src="'+activityImage(service?.category_code)+'" alt="'+escapeHtml(service?.name_ar||service?.name_en||'صورة الخدمة')+'" loading="lazy"></div>';

  window.MXHomeLanding = function(){
    const app=document.getElementById('app');
    if(!app) return;

    const syncHomeAuthState = async () => {
      try{
        const sb=getClient();
        if(!sb?.auth?.getSession) return;
        const {data,error}=await sb.auth.getSession();
        if(error || !data?.session?.user) return;
        const authUser=data.session.user;
        const current=window.MNTYAuthState||{};
        const meta=authUser.user_metadata||{};
        window.MNTYAuthState={...current,authenticated:true,email:authUser.email||current.email||'',name:meta.full_name||meta.name||current.name||'',avatarUrl:meta.avatar_url||meta.picture||current.avatarUrl||''};
        const loginButton=document.getElementById('mx-login');
        if(loginButton){
          const name=meta.full_name||meta.name||authUser.email?.split('@')[0]||'حسابي';
          const avatar=meta.avatar_url||meta.picture||'';
          let activityName='';
          try{
            const pr=await sb.from('marketing_provider_profiles').select('name_ar,name_en').eq('owner_user_id',authUser.id).eq('status','ACTIVE').maybeSingle();
            activityName=pr?.data?.name_ar||pr?.data?.name_en||'';
          }catch(_){}
          loginButton.innerHTML=(avatar?'<img class="mx-account-avatar" src="'+escapeHtml(avatar)+'" alt="">':'<span class="mx-account-icon" aria-hidden="true">♙</span>')+'<span class="mx-account-copy"><b>'+escapeHtml((activityName||name).slice(0,24))+'</b><small><i></i> '+escapeHtml(activityName?'نشاط نشط':'مسجل الدخول')+'</small></span>';
          loginButton.setAttribute('aria-label','فتح الملف الشخصي والحساب');
          loginButton.onclick=()=>typeof window.accountView==='function'?window.accountView():typeof window.openPlatform==='function'?window.openPlatform():typeof window.authView==='function'?window.authView():null;
        }
        const addButton=document.getElementById('mx-add');
        if(addButton) addButton.onclick=()=>openActivityRequestModal();
      }catch(_){}
    };

    const adminReturnMembershipId=window.MNTYAdminReturnMembershipId||localStorage.getItem('MNTYAdminReturnMembershipId')||'';
    if(adminReturnMembershipId) window.MNTYAdminReturnMembershipId=adminReturnMembershipId;
    app.innerHTML=`<main class="mx-home" dir="rtl"><a class="mx-skip-link" href="#mx-home">تخطي إلى المحتوى الرئيسي</a>
      <header class="mx-header">
        <div class="mx-header__inner">
          <a class="mx-brand" href="#mx-home" aria-label="MantiqatiX">${logo()}<div><div class="mx-brand__name">MantiqatiX</div><span class="mx-brand__ar">منصة خدمات وتسويق متكاملة</span></div></a>
          <div class="mx-search-wrap">
            <label class="mx-search" aria-label="البحث في الخدمات ومقدميها">
              <span class="mx-search__location">⌖ <span id="mx-location-label">الموقع عند الحاجة</span></span>
              <input id="mx-home-search" autocomplete="off" inputmode="search" enterkeyhint="search" aria-controls="mx-search-suggestions" aria-expanded="false" placeholder="ابحث عن خدمة، مقدم خدمة، نشاط...">
              <button id="mx-search-clear" class="mx-search__clear" type="button" aria-label="مسح البحث" hidden>×</button>
              <button id="mx-search-btn" type="button" aria-label="بحث">⌕</button>
            </label>
            <div class="mx-search-suggestions" id="mx-search-suggestions" role="listbox" hidden></div>
          </div>
          <button class="mx-header__login" id="mx-login" type="button" aria-label="تسجيل الدخول / فتح الحساب"><span class="mx-account-icon" aria-hidden="true">♙</span><span class="mx-account-copy"><b>تسجيل الدخول</b><small><i></i> غير مسجل</small></span></button>
          <button class="mx-header-tool" id="mx-wallet" type="button" aria-label="المحفظة"><span>▣</span><small>المحفظة</small></button>
          <button class="mx-header-tool" id="mx-cart" type="button" aria-label="السلة"><span>🛒</span><small>السلة <b id="mx-cart-count">0</b></small></button>
          ${window.MNTYAuthState?.authenticated&&adminReturnMembershipId?'<button class="mx-header__login mx-admin-return" id="mx-admin-return" type="button">لوحة الإدارة</button>':''}
          <button class="mx-mobile-menu" id="mx-mobile-menu" type="button" aria-label="فتح قائمة التنقل" aria-expanded="false" aria-controls="mx-mobile-drawer">☰</button>
          <nav class="mx-nav">
            <a href="#mx-home">الرئيسية</a>
            <a href="#mx-about">عن المنصة</a><a href="#mx-categories">التصنيفات</a>
            <a href="#mx-services">الخدمات</a>
            <a href="#mx-offers">العروض</a>
            <a href="#mx-marketing">التسويق والإعلانات</a>
            <a href="#mx-contact">تواصل معنا</a>
            <button class="mx-add" id="mx-add" type="button">＋ إضافة نشاط</button>
          </nav>
        </div>
      </header>
      <div class="mx-mobile-drawer-backdrop" id="mx-mobile-drawer-backdrop" hidden></div>
      <aside class="mx-mobile-drawer" id="mx-mobile-drawer" aria-hidden="true">
        <div class="mx-mobile-drawer__head"><strong>التنقل</strong><button id="mx-mobile-menu-close" type="button" aria-label="إغلاق القائمة">×</button></div>
        <nav>
          <a href="#mx-home" data-mobile-nav>الرئيسية</a>
          <a href="#mx-about" data-mobile-nav>عن المنصة</a>
          <a href="#mx-categories" data-mobile-nav>التصنيفات</a>
          <a href="#mx-services" data-mobile-nav>الخدمات</a>
          <a href="#mx-offers" data-mobile-nav>العروض</a>
          <a href="#mx-marketing" data-mobile-nav>التسويق والإعلانات</a>
          <a href="#mx-contact" data-mobile-nav>تواصل معنا</a>
          <button type="button" id="mx-mobile-add">＋ إضافة نشاط</button>
        </nav>
      </aside>

      <aside class="mx-side-banner mx-side-banner--right" aria-label="مساحة إعلانية جانبية يمين">
        <div class="mx-side-banner__cloud mx-side-banner__cloud--one"></div><div class="mx-side-banner__cloud mx-side-banner__cloud--two"></div>
        <div class="mx-side-banner__screen"><b>MantiqatiX</b><span>مساحة إعلانية</span></div>
        <div class="mx-side-banner__copy"><strong>أعلن نشاطك</strong><span>ظهور مميز داخل المنصة</span><button type="button" data-side-ad-book="1">احجز الآن</button></div>
      </aside>
      <div class="mx-main" id="mx-home">
        <section class="mx-home-hero" aria-label="اكتشاف الخدمات ومقدمي الخدمات">
          <div class="mx-home-hero__copy">
            <span class="mx-home-hero__eyebrow">منطقتك تبدأ من هنا</span>
            <h1>كل الخدمات في مكان واحد</h1>
            <p>اكتشف ... احجز ... تواصل ... بسهولة وأمان مع مقدمي الخدمات والأنشطة المسجلة على MantiqatiX.</p>
            <div class="mx-home-hero__actions">
              <button class="mx-btn mx-btn--primary" id="mx-hero-search" type="button">ابدأ البحث الآن ←</button>
              <button class="mx-btn mx-btn--light" id="mx-ad-book" type="button">أعلن عن نشاطك</button>
            </div>
            <div class="mx-home-hero__trust">
              <span>✓ مقدمو خدمات مسجلون</span>
              <span>✓ بيانات منشورة عند توفرها</span>
              <span>✓ الموقع عند الحاجة فقط</span>
              <span>✓ تجربة رقمية موحدة</span>
            </div>
          </div>
          <div class="mx-home-hero__visual" aria-label="كيف تعمل MantiqatiX">
            <div class="mx-home-hero__glow"></div>
            <div class="mx-home-hero__brand-card"><b>MantiqatiX</b><span>خدمات · مقدمو خدمات · طلبات</span></div>
            <div class="mx-home-hero__steps">
              <article><i>01</i><b>اكتشف</b><span>ابحث عن الخدمة أو النشاط</span></article>
              <article><i>02</i><b>طابق</b><span>استعرض مقدم الخدمة المناسب</span></article>
              <article><i>03</i><b>اطلب</b><span>أنشئ الطلب وتابع حالته</span></article>
            </div>
            <div class="mx-home-hero__provider">
              <div><strong>لأصحاب الأنشطة</strong><span>اعرض نشاطك داخل المنصة</span></div>
              <button id="mx-ad-plans" type="button">باقات الإعلان ←</button>
            </div>
            <div class="mx-home-hero__plans" id="mx-ad-plans-grid" aria-label="باقات الإعلان">
              <button type="button" class="mx-ad-plan" data-ad-plan="QUARTERLY"><span>01</span><b>ربع سنوي</b><small>3 أشهر</small></button>
              <button type="button" class="mx-ad-plan mx-ad-plan--featured" data-ad-plan="SEMIANNUAL"><span>02</span><b>نصف سنوي</b><small>6 أشهر</small></button>
              <button type="button" class="mx-ad-plan" data-ad-plan="ANNUAL"><span>03</span><b>سنوي</b><small>12 شهرًا</small></button>
            </div>
          </div>
        </section>

        <section class="mx-platform-notices" aria-label="إشعارات المنصة">
          <div class="mx-platform-notices__label">تنبيهات MantiqatiX</div>
          <div class="mx-platform-notices__viewport">
            <div id="mx-platform-notice" class="mx-platform-notice" aria-live="polite"></div>
          </div>
          <span class="mx-platform-notices__timer">تتبدل تلقائيًا</span>
        </section>

        <section class="mx-section mx-about-section" id="mx-about">
          <div class="mx-section__head">
            <div><span class="mx-hero__eyebrow">عن MantiqatiX</span><h2>منصة رقمية لاكتشاف الخدمات وربط العملاء بمقدميها</h2><p>تجمع MantiqatiX بين اكتشاف الخدمة، الوصول إلى مقدم الخدمة، الطلب والمتابعة داخل تجربة رقمية موحدة.</p></div>
          </div>
          <div class="mx-about-grid">
            <article class="mx-about-card"><span>01</span><h3>اكتشاف ومطابقة</h3><p>ابحث عن الخدمة أو النشاط المناسب، ثم استعرض البيانات المنشورة من الكتالوج العام عند توفرها.</p></article>
            <article class="mx-about-card"><span>02</span><h3>طلب ومتابعة</h3><p>يمكن للعميل إنشاء الطلب ومتابعة حالته من حسابه، بينما يظل تنفيذ الخدمة مسؤولية مقدم الخدمة.</p></article>
            <article class="mx-about-card"><span>03</span><h3>موقع عند الحاجة</h3><p>يُستخدم الموقع كعامل مساعد عند الحاجة التشغيلية وبإذن المستخدم، وليس كتتبع مستمر لمجرد تسجيل الدخول.</p></article>
            <article class="mx-about-card"><span>04</span><h3>منظومة موحدة</h3><p>الموقع والتطبيق والإدارة تعتمد منطقًا وبيانات مشتركة، مع تجربة واجهة مناسبة لكل منصة.</p></article>
          </div>
          <div class="mx-about-note"><strong>دور المنصة</strong><span>MantiqatiX توفر البنية الرقمية للاكتشاف والمطابقة والتواصل وإدارة الطلبات والمتابعة، ولا تحل محل مقدم الخدمة في تنفيذ الخدمة ماديًا.</span></div>
        </section>

        <section class="mx-section mx-audience-section" id="mx-audiences">
          <div class="mx-section__head">
            <div><span class="mx-hero__eyebrow">ابدأ بالطريقة المناسبة لك</span><h2>مساران واضحان داخل MANTIQATIX</h2><p>المنصة تربط الطرفين رقميًا، مع بقاء تقديم الخدمة وتنفيذها مسؤولية مقدم الخدمة.</p></div>
          </div>
          <div class="mx-audience-grid">
            <article class="mx-audience-card">
              <div class="mx-audience-card__icon">👤</div>
              <div><span>للعملاء</span><h3>ابحث عن الخدمة واطلبها</h3><p>اكتشف الخدمات ومقدميها، قارن الخيارات المتاحة، ثم أنشئ طلبك وتابع حالته من حسابك.</p><button type="button" class="mx-btn mx-btn--primary" data-register-role="CUSTOMER">إنشاء حساب عميل ←</button></div>
            </article>
            <article class="mx-audience-card mx-audience-card--provider">
              <div class="mx-audience-card__icon">🏢</div>
              <div><span>لمقدمي الخدمات</span><h3>اعرض خدمتك وأدر نشاطك</h3><p>سجّل نشاطك، اعرض خدماتك وفق قواعد المنصة، واستقبل الطلبات وتابع تشغيلها من مساحة العمل المخصصة لك بعد الاعتماد.</p><button type="button" class="mx-btn mx-btn--light" data-register-role="SERVICE_PROVIDER">التسجيل كمقدم خدمة ←</button></div>
            </article>
          </div>
        </section>

        <section class="mx-section" id="mx-categories">
          <div class="mx-section__head"><div><h2>استكشف القطاعات</h2><p>تنقل سريع إلى نوع النشاط أو الخدمة التي تبحث عنها.</p></div><button class="mx-link" id="mx-all" type="button">عرض الكل ←</button></div>
          <div class="mx-categories" id="mx-category-grid"></div>
        </section>

        <section class="mx-section" id="mx-services" hidden>
          <div class="mx-section__head"><div><h2>نتائج البحث والخدمات</h2><p id="mx-search-context">بيانات منشورة من كتالوج المنصة، وليست بيانات وهمية.</p></div><div class="mx-search-result-tools"><span class="mx-live" id="mx-live-status">جارٍ التحميل...</span><button class="mx-link" id="mx-search-clear-results" type="button" hidden>مسح البحث</button></div></div>
          <div class="mx-service-grid" id="mx-service-grid"><div class="mx-loading">جارٍ تحميل الخدمات...</div></div>
        </section>

        <section class="mx-section" id="mx-offers" hidden>
          <div class="mx-section__head"><div><h2>إعلانات ممولة</h2><p>تظهر هنا الأنشطة المميزة المنشورة والفعالة فقط.</p></div><button class="mx-link" id="mx-ad-cta" type="button">أعلن عن نشاطك ←</button></div>
          <div class="mx-sponsored" id="mx-sponsored"><div class="mx-empty">جارٍ التحقق من الإعلانات المنشورة...</div></div>
        </section>

        <section class="mx-section" id="mx-nearby">
          <div class="mx-section__head"><div><h2>أنشطة ومقدمو خدمات</h2><p id="mx-location-help">نتائج موثقة من الكتالوج العام، وتُرتب حسب موقعك عند توفره.</p></div><button class="mx-link" id="mx-location-btn" type="button">تحديد موقعي 📍</button></div>
          <div id="mx-location-controls" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px">
            <span id="mx-location-status" class="mx-live">الموقع عند الحاجة</span>
            <span style="font-size:12px;color:#667085">نطاق البحث:</span>
            <div id="mx-location-ranges" style="display:flex;gap:6px;flex-wrap:wrap"></div>
          </div>
          <div class="mx-provider-grid" id="mx-provider-grid"><div class="mx-empty">جارٍ تحميل مقدمي الخدمات...</div></div>
        </section>

        <section class="mx-section mx-module-strip" id="mx-marketing" hidden>
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
          <div><div class="mx-footer__brand">MantiqatiX</div><div class="mx-footer__sub">MantiqatiX · منصة رقمية متكاملة للخدمات ومقدميها</div><div class="mx-footer__sub">MANTIQATIX ليست وسيطًا ماديًا بين العميل ومقدم الخدمة، ولا تتولى تقديم الخدمة أو تنفيذها ماديًا نيابةً عن مقدم الخدمة؛ دورها منصة رقمية للاكتشاف والمطابقة والتواصل وإدارة الطلبات والمتابعة.</div><div class="mx-footer__sub">اكتشاف · مطابقة · طلب · تواصل · متابعة تنفيذ</div></div>
          <div><h3>روابط سريعة</h3><a href="#mx-home">الرئيسية</a><a href="#mx-categories">التصنيفات</a><a href="#mx-services">الخدمات</a><a href="#mx-offers">الإعلانات</a></div>
          <div><h3>عن MantiqatiX</h3><button type="button" class="mx-footer__link" data-footer-info="about">من نحن</button><button type="button" class="mx-footer__link" data-footer-info="legal">الشروط والأحكام</button><button type="button" class="mx-footer__link" data-footer-info="privacy">سياسة الخصوصية</button></div>
          <div><h3>خدمة العملاء</h3><a class="mx-footer__support" href="tel:+201010171770" aria-label="الاتصال بخدمة العملاء 01010171770">01010171770</a><div class="mx-footer__sub">منصتك في كل مكان</div></div>
        </div>
        <div class="mx-footer__bar"><span>© MantiqatiX</span><span>بيانات حية عند توفرها · بدون بيانات وهمية</span></div>
      </footer>
      <a class="mx-whatsapp-float" href="https://wa.me/${window.MNTY_SUPPORT?.whatsapp||'201010171770'}?text=%D9%85%D8%B1%D8%AD%D8%A8%D9%8B%D8%A7%D8%8C%20%D8%A3%D8%AD%D8%AA%D8%A7%D8%AC%20%D8%A5%D9%84%D9%89%20%D8%A7%D9%84%D8%AA%D9%88%D8%A7%D8%B5%D9%84%20%D9%85%D8%B9%20%D8%AE%D8%AF%D9%85%D8%A9%20%D8%B9%D9%85%D9%84%D8%A7%D8%A1%20Mantiqati%20X." target="_blank" rel="noopener noreferrer" aria-label="تواصل مع خدمة العملاء عبر واتساب" title="خدمة العملاء عبر واتساب">
        <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19.11 17.41c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.13-.42-2.15-1.33-.8-.71-1.34-1.58-1.5-1.85-.16-.27-.02-.42.12-.56.12-.12.27-.32.41-.47.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47h-.52c-.18 0-.47.07-.72.34-.25.27-.95.93-.95 2.27s.97 2.63 1.11 2.81c.14.18 1.91 2.92 4.63 4.09.65.28 1.16.44 1.56.56.65.21 1.24.18 1.7.11.52-.08 1.6-.66 1.82-1.3.23-.64.23-1.19.16-1.3-.07-.11-.25-.18-.52-.32zM16.02 5.33c-5.89 0-10.68 4.79-10.68 10.68 0 1.88.49 3.71 1.43 5.32L5.26 26.67l5.46-1.43a10.65 10.65 0 0 0 5.3 1.41h.01c5.89 0 10.67-4.79 10.67-10.67S21.91 5.33 16.02 5.33zm0 19.49h-.01a8.8 8.8 0 0 1-4.48-1.23l-.32-.19-3.24.85.87-3.16-.21-.32a8.82 8.82 0 1 1 7.39 4.05z"/></svg>
        <span>خدمة العملاء</span>
      </a>
      <nav class="mx-bottom-nav">
        <button class="active" type="button" data-scroll="mx-home">⌂<span>الرئيسية</span></button>
        <button type="button" id="mx-bottom-search">⌕<span>بحث</span></button>
        <button class="plus" id="mx-bottom-add" type="button">＋</button>
        <button type="button" data-scroll="mx-offers">☆<span>العروض</span></button>
        <button type="button" id="mx-bottom-account">♙<span>حسابي</span></button>
      </nav>
    </main>`;

    document.querySelectorAll('[data-side-ad-book]').forEach(btn=>btn.addEventListener('click',()=>{try{localStorage.setItem('MNTYOpenAdBooking','1')}catch(_){};if(window.MNTYAuthState?.authenticated&&typeof window.selectModule==='function'){window.selectModule('التسويق والإعلان')}else if(typeof window.authView==='function'){window.authView('',false,'','login')}}));

    const categoryGrid=document.getElementById('mx-category-grid');
    const reduceMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const scrollOptions=(block='start')=>({behavior:reduceMotion()?'auto':'smooth',block});
    const renderDynamicCategories=(services=[],providers=[])=>{
      const items=dynamicTaxonomy(services,providers);
      categoryGrid.innerHTML=items.map(c=>'<button class="mx-category" type="button" data-category="'+escapeHtml(c[3])+'"><span class="mx-category__media"><img src="'+activityImage(c[3])+'" alt="'+escapeHtml(c[1])+'" loading="lazy"></span><strong>'+escapeHtml(c[1])+'</strong><small>'+escapeHtml(c[2])+'</small></button>').join('');
      categoryGrid.querySelectorAll('.mx-category').forEach(btn=>btn.onclick=()=>{ const code=btn.dataset.category||''; openCategoryPage(code); });
    };

    const platformNotices=[
      'استكشف الخدمات ومقدميها من مكان واحد.',
      'احجز إعلان نشاطك مسبقًا بباقة ربع سنوية أو نصف سنوية أو سنوية.',
      'أضف نشاطك إلى المنصة وابدأ في بناء حضورك الرقمي.',
      'تابع الخدمات والطلبات من خلال تجربة MantiqatiX الموحدة.',
      'MantiqatiX تربط العميل بمقدم الخدمة رقميًا دون الحلول محل مقدم الخدمة.'
    ];
    let platformNoticeIndex=0;
    let platformNoticeTimer=null;
    const renderPlatformNotice=()=>{
      const el=document.getElementById('mx-platform-notice');
      if(!el)return;
      el.classList.remove('is-visible');
      window.setTimeout(()=>{
        el.textContent=platformNotices[platformNoticeIndex];
        el.classList.add('is-visible');
      },120);
    };
    renderPlatformNotice();
    platformNoticeTimer=window.setInterval(()=>{
      platformNoticeIndex=(platformNoticeIndex+1)%platformNotices.length;
      renderPlatformNotice();
    },3000);
    window.addEventListener('pagehide',()=>{if(platformNoticeTimer)window.clearInterval(platformNoticeTimer)},{once:true});

    const openActivityRequestModal=async()=>{
      const overlay=document.createElement('div');
      overlay.className='mx-modal mx-home-request-modal';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','إضافة نشاط');
      overlay.innerHTML='<div class="mx-modal-card"><div class="section-head"><div><span class="eyebrow">MantiqatiX</span><h2>إضافة نشاط</h2><p>أرسل بيانات النشاط، وسيتم استكمال المراجعة والاعتماد وفق إجراءات المنصة.</p></div><button type="button" class="text-btn mx-close-modal" aria-label="إغلاق">إغلاق</button></div><form id="mx-activity-request-form" class="form-grid"><label class="field"><span>اسم النشاط *</span><input id="mx-req-business" required maxlength="120" placeholder="مثال: مطعم أو شركة"></label><label class="field"><span>نوع النشاط *</span><select id="mx-req-kind" required>__TAX_OPTIONS__</select></label><label class="field"><span>رقم الهاتف</span><input id="mx-req-phone" inputmode="tel" maxlength="30" placeholder="رقم التواصل"></label><label class="field"><span>المدينة / المنطقة</span><input id="mx-req-area" maxlength="120" placeholder="المدينة والمنطقة"></label><label class="field" style="grid-column:1/-1"><span>وصف النشاط</span><textarea id="mx-req-description" rows="3" maxlength="1000" placeholder="وصف مختصر للنشاط والخدمات"></textarea></label><label class="field" style="grid-column:1/-1"><span>الخدمات أو التخصصات</span><input id="mx-req-services" maxlength="500" placeholder="افصل الخدمات بفواصل"></label><div class="action-bar" style="grid-column:1/-1"><button type="submit" class="btn btn-primary" id="mx-activity-request-submit">إرسال الطلب</button><button type="button" class="btn btn-outline mx-close-modal">إلغاء</button></div></form></div>';
      overlay.innerHTML=overlay.innerHTML.replace('__TAX_OPTIONS__',TAXONOMY.map(x=>'<option value="'+escapeHtml(x[3])+'">'+escapeHtml(x[1])+'</option>').join(''));
      document.body.appendChild(overlay);
      const close=()=>{document.removeEventListener('keydown',onKey);overlay.remove()};
      const onKey=e=>{if(e.key==='Escape')close()};
      document.addEventListener('keydown',onKey);
      overlay.querySelectorAll('.mx-close-modal').forEach(b=>b.addEventListener('click',close));
      overlay.querySelector('#mx-activity-request-form')?.addEventListener('submit',async e=>{
        e.preventDefault();
        const draft={business_name:document.getElementById('mx-req-business')?.value?.trim()||'',provider_kind:document.getElementById('mx-req-kind')?.value||'FOOD',phone:document.getElementById('mx-req-phone')?.value?.trim()||'',area:document.getElementById('mx-req-area')?.value?.trim()||'',description:document.getElementById('mx-req-description')?.value?.trim()||'',specialties:document.getElementById('mx-req-services')?.value?.trim()||''};
        try{localStorage.setItem('MNTYPendingActivityDraft',JSON.stringify(draft));}catch(_){}
        close();
        if(await hydrateAuthenticatedSession()){
          if(typeof submitRegistrationRequest==='function'){try{await submitRegistrationRequest('SERVICE_PROVIDER');}catch(_){}}
          if(typeof window.providerOnboardingView==='function') return window.providerOnboardingView();
          return typeof window.accountView==='function'?window.accountView():callPlatform();
        }
        return callAuth();
      });
      window.setTimeout(()=>overlay.querySelector('#mx-req-business')?.focus(),0);
    };

    const openCategoryPage=async(code)=>{
      const item=TAXONOMY.find(x=>String(x[3])===String(code))||['◉',String(code||'نشاط'),'خدمات وأنشطة منشورة',String(code||'')];
      const label=item[1], desc=item[2], key=normCode(code);
      const app=document.getElementById('app'); if(!app)return;
      try{if(location.hash!=='#category/'+encodeURIComponent(key))history.pushState({category:key},'', '#category/'+encodeURIComponent(key));}catch(_){}
      app.innerHTML='<main class="mx-category-page" dir="rtl"><header class="mx-category-page__head"><button type="button" class="mx-category-back" id="mx-category-back">← الرئيسية</button><div><span class="eyebrow">MantiqatiX</span><h1>'+escapeHtml(label)+'</h1><p>'+escapeHtml(desc)+'</p></div><button type="button" class="mx-category-account" id="mx-category-account">حسابي</button></header><section class="mx-category-page__hero"><img src="'+activityImage(key)+'" alt="'+escapeHtml(label)+'"><div><span class="mx-chip">'+escapeHtml(key)+'</span><h2>اكتشف '+escapeHtml(label)+'</h2><p>الأنشطة والخدمات المنشورة فعليًا ضمن هذا القطاع.</p></div></section><section class="mx-category-page__section"><div class="section-head"><div><h2>الخدمات</h2><p class="muted">خدمات منشورة في '+escapeHtml(label)+'</p></div></div><div class="mx-category-results" id="mx-category-services"><div class="empty-state">جاري التحميل…</div></div></section><section class="mx-category-page__section"><div class="section-head"><div><h2>الأنشطة ومقدمو الخدمات</h2><p class="muted">بيانات الأنشطة المنشورة والمعتمدة فقط.</p></div></div><div class="mx-category-results" id="mx-category-providers"><div class="empty-state">جاري التحميل…</div></div></section></main>';
      document.getElementById('mx-category-back').onclick=()=>{try{history.pushState({},'', '#mx-home');}catch(_){};window.MXHomeLanding?.();};
      document.getElementById('mx-category-account').onclick=async()=>{if(typeof window.accountView==='function'&&window.MNTYAuthState?.authenticated)return window.accountView();if(typeof window.authView==='function')return window.authView();};
      try{
        const sb=getClient(); if(!sb)throw new Error('تعذر الاتصال بالمنصة');
        const [sr,pr]=await Promise.all([
          sb.from('marketing_services').select('id,code,name_ar,name_en,category_code,description').eq('status','ACTIVE').eq('category_code',key).order('created_at',{ascending:false}).limit(50),
          sb.from('marketing_provider_profiles').select('id,business_id,name_ar,name_en,provider_kind,description,service_areas,status,is_verified,is_featured,ranking_weight,profile_image_path,updated_at').eq('status','ACTIVE').eq('provider_kind',key).order('is_featured',{ascending:false}).order('ranking_weight',{ascending:false}).limit(50)
        ]);
        if(sr.error)throw sr.error; if(pr.error)throw pr.error;
        const services=sr.data||[], providers=pr.data||[];
        const se=document.getElementById('mx-category-services'), pe=document.getElementById('mx-category-providers');
        se.innerHTML=services.length?services.map(s=>'<article class="mx-category-result-card"><img src="'+activityImage(key)+'" alt=""><div><span class="mx-chip">'+escapeHtml(key)+'</span><h3>'+escapeHtml(s.name_ar||s.name_en||'خدمة')+'</h3><p>'+escapeHtml(s.description||'خدمة منشورة على MantiqatiX.')+'</p><button type="button" class="mx-card-link" data-cat-service="'+escapeHtml(s.id)+'">استكشف الخدمة ←</button></div></article>').join(''):'<div class="empty-state">لا توجد خدمات منشورة حاليًا في هذا القطاع.</div>';
        pe.innerHTML=providers.length?providers.map(p=>'<article class="mx-category-result-card"><div class="mx-category-result-card__media">'+providerMedia(p)+'</div><div><span class="mx-verified">'+(p.is_verified?'✓ موثق':'منشور')+'</span><h3>'+escapeHtml(p.name_ar||p.name_en||'مقدم خدمة')+'</h3><p>'+escapeHtml(p.description||'نشاط مسجل على MantiqatiX.')+'</p><span class="mx-location">⌖ '+escapeHtml(readArea(p.service_areas)||'نطاق خدمة معلن')+'</span><div class="mx-provider-actions"><button type="button" class="mx-card-link" data-cat-provider="'+escapeHtml(p.id)+'">عرض الملف ←</button>'+(p.business_id?'<button type="button" class="mx-card-book" data-cat-book="'+escapeHtml(p.business_id)+'" data-cat-provider-name="'+escapeHtml(p.name_ar||p.name_en||'مقدم الخدمة')+'">احجز / اطلب</button>':'')+'</div></div></article>').join(''):'<div class="empty-state">لا توجد أنشطة منشورة حاليًا في هذا القطاع.</div>';
        se.querySelectorAll('[data-cat-service]').forEach(b=>b.onclick=()=>{const s=services.find(x=>String(x.id)===String(b.dataset.catService));if(s){document.getElementById('mx-category-services')?.scrollIntoView({behavior:'smooth'});}});
        pe.querySelectorAll('[data-cat-provider]').forEach(b=>{b.onclick=()=>{const p=providers.find(x=>String(x.id)===String(b.dataset.catProvider));if(p)openProviderProfilePage(p,label);}});
        pe.querySelectorAll('[data-cat-book]').forEach(b=>b.onclick=()=>{const id=b.dataset.catBook,n=b.dataset.catProviderName||'مقدم الخدمة';if(window.MNTYAuthState?.authenticated&&typeof openProviderCatalog==='function')return openProviderCatalog(id,n);try{localStorage.setItem('MNTYPendingProvider',JSON.stringify({businessId:id,providerName:n}));}catch(_){};goLogin();});
      }catch(e){document.getElementById('mx-category-services').innerHTML='<div class="empty-state">تعذر تحميل الخدمات حاليًا.</div>';document.getElementById('mx-category-providers').innerHTML='<div class="empty-state">تعذر تحميل الأنشطة حاليًا.</div>';}
    };

    window.__MNTYOpenCategoryPage=openCategoryPage;
    const openProviderProfilePage=(provider,categoryLabel='')=>{
      const app=document.getElementById('app'); if(!app)return;
      const providerKey=String(provider?.id||'');
      try{if(providerKey&&location.hash!=='#provider/'+encodeURIComponent(providerKey))history.pushState({provider:providerKey},'', '#provider/'+encodeURIComponent(providerKey));}catch(_){}
      const name=provider?.name_ar||provider?.name_en||'مقدم خدمة';
      app.innerHTML='<main class="mx-profile-page" dir="rtl"><header class="mx-profile-page__head"><button type="button" class="mx-category-back" id="mx-profile-back">← العودة</button><span class="eyebrow">ملف النشاط</span></header><section class="mx-profile-page__hero"><div class="mx-profile-page__cover"><img src="'+escapeHtml(publicProfileImage(provider)||activityImage(provider?.provider_kind))+'" alt="'+escapeHtml(name)+'"></div><div class="mx-profile-page__identity"><div class="mx-profile-page__avatar">'+escapeHtml(name.slice(0,1))+'</div><div><span class="mx-verified">'+(provider?.is_verified?'✓ موثق':'منشور')+'</span><h1>'+escapeHtml(name)+'</h1><p>'+escapeHtml(categoryLabel||provider?.provider_kind||'نشاط')+'</p></div></div><p class="mx-profile-page__description">'+escapeHtml(provider?.description||'لا يوجد وصف منشور حاليًا.')+'</p><div class="mx-profile-page__meta"><span>⌖ '+escapeHtml(readArea(provider?.service_areas)||'نطاق خدمة معلن')+'</span><span>✓ نشاط منشور على MantiqatiX</span></div>'+(provider?.business_id?'<div class="mx-profile-page__actions"><button type="button" class="btn btn-primary" id="mx-profile-book">احجز / اطلب خدمة</button><button type="button" class="btn btn-outline" id="mx-profile-back2">العودة للقطاع</button></div>':'')+'</section><section class="mx-profile-page__section"><h2>الخدمات والتخصصات</h2><p class="muted">تفاصيل الخدمات تظهر من الكتالوج التشغيلي عند توفرها.</p></section></main>';
      const back=()=>openCategoryPage(provider?.provider_kind||'');
      document.getElementById('mx-profile-back').onclick=back;document.getElementById('mx-profile-back2')?.addEventListener('click',back);
      document.getElementById('mx-profile-book')?.addEventListener('click',()=>{const id=provider.business_id,n=name;if(window.MNTYAuthState?.authenticated&&typeof openProviderCatalog==='function')return openProviderCatalog(id,n);try{localStorage.setItem('MNTYPendingProvider',JSON.stringify({businessId:id,providerName:n}));}catch(_){};goLogin();});
    };

    window.__MNTYOpenProviderProfilePage=openProviderProfilePage;
    const openDigitalPage=async(slug)=>{
      const key=String(slug||'').trim().replace(/[^A-Za-z0-9._-]/g,'').slice(0,180);
      const app=document.getElementById('app'); if(!app||!key)return;
      try{if(location.hash!=='#page/'+encodeURIComponent(key))history.pushState({page:key},'', '#page/'+encodeURIComponent(key));}catch(_){}
      app.innerHTML='<main class="mx-digital-page" dir="rtl"><header class="mx-digital-page__head"><button type="button" class="mx-category-back" id="mx-digital-back">← الرئيسية</button><span class="eyebrow">MantiqaTix DIGITAL PAGE</span></header><section class="mx-digital-page__hero"><div class="mx-digital-page__cover" id="mx-digital-cover"></div><div><span class="mx-chip" id="mx-digital-type">PAGE</span><h1 id="mx-digital-title">جاري التحميل…</h1><p id="mx-digital-subtitle" class="muted"></p></div></section><section class="mx-digital-page__section"><div id="mx-digital-sections"><div class="empty-state">جاري تحميل الصفحة…</div></div></section></main>';
      document.getElementById('mx-digital-back').onclick=()=>{try{history.pushState({},'', '#mx-home');}catch(_){};window.MXHomeLanding?.();};
      try{
        const sb=getClient(); if(!sb)throw new Error('NO_CLIENT');
        const {data:page,error}=await sb.from('digital_pages').select('id,page_type,business_id,provider_profile_id,slug,title,subtitle,description,seo_title,seo_description,theme,status,version,published_at').eq('slug',key).eq('status','PUBLISHED').maybeSingle();
        if(error||!page)throw new Error('PAGE_NOT_FOUND');
        const {data:sections,error:se}=await sb.from('digital_page_sections').select('id,section_type,sort_order,title,content,data,active').eq('page_id',page.id).eq('active',true).order('sort_order',{ascending:true});
        if(se)throw se;
        document.title=page.seo_title||page.title||'MantiqaTix';
        const meta=document.querySelector('meta[name="description"]');if(meta&&page.seo_description)meta.setAttribute('content',page.seo_description);
        document.getElementById('mx-digital-title').textContent=page.title||'صفحة MantiqaTix';
        document.getElementById('mx-digital-subtitle').textContent=page.subtitle||page.description||'';
        document.getElementById('mx-digital-type').textContent=page.page_type==='MENU'?'MENU':'PORTFOLIO';
        const theme=page.theme&&typeof page.theme==='object'?page.theme:{};
        const cover=theme.cover_url||theme.coverUrl||'';
        document.getElementById('mx-digital-cover').innerHTML=cover?'<img src="'+escapeHtml(cover)+'" alt="'+escapeHtml(page.title||'')+'">':'<div class="mx-digital-page__cover-fallback">'+(page.page_type==='MENU'?'🍽️':'✦')+'</div>';
        const list=Array.isArray(sections)?sections:[];
        document.getElementById('mx-digital-sections').innerHTML=list.length?list.map(s=>{
          const data=s.data&&typeof s.data==='object'?s.data:{};
          const type=String(s.section_type||'CONTENT').toUpperCase();
          const title=s.title||data.title||'';
          const content=s.content||data.content||'';
          const image=data.image_url||data.imageUrl||'';
          const links=Array.isArray(data.links)?data.links:[];
          return '<article class="mx-digital-section mx-digital-section--'+escapeHtml(type.toLowerCase())+'">'+(image?'<img class="mx-digital-section__image" src="'+escapeHtml(image)+'" alt="'+escapeHtml(title)+'" loading="lazy">':'')+(title?'<h2>'+escapeHtml(title)+'</h2>':'')+(content?'<p>'+escapeHtml(content).replace(/\n/g,'<br>')+'</p>':'')+(links.length?'<div class="mx-digital-links">'+links.slice(0,12).map(x=>'<a href="'+escapeHtml(x.url||'#')+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(x.label||x.name||'رابط')+'</a>').join('')+'</div>':'')+'</article>';
        }).join(''):'<div class="empty-state">لم يتم نشر محتوى الصفحة بعد.</div>';
      }catch(e){
        document.getElementById('mx-digital-title').textContent='الصفحة غير متاحة';
        document.getElementById('mx-digital-subtitle').textContent='قد تكون الصفحة غير منشورة أو انتهت صلاحيتها.';
        document.getElementById('mx-digital-sections').innerHTML='<div class="empty-state">تعذر عرض الصفحة الرقمية حاليًا.</div>';
      }
    };
    window.__MNTYOpenDigitalPage=openDigitalPage;
    if(!window.__MNTYHomeRouteBound){
      window.__MNTYHomeRouteBound=true;
      window.addEventListener('popstate',()=>window.__MNTYHandlePublicRoute?.());
      window.addEventListener('hashchange',()=>window.__MNTYHandlePublicRoute?.());
    }
    window.__MNTYHandlePublicRoute=async()=>{
      const h=String(location.hash||'');
      if(h.startsWith('#category/')) return window.__MNTYOpenCategoryPage?.(decodeURIComponent(h.slice(10)));
      if(h.startsWith('#page/')) return window.__MNTYOpenDigitalPage?.(decodeURIComponent(h.slice(6)));
      if(h.startsWith('#provider/')){
        const id=decodeURIComponent(h.slice(10));
        try{
          const sb=getClient(); if(!sb)return;
          const {data,error}=await sb.from('marketing_provider_profiles').select('id,business_id,name_ar,name_en,provider_kind,description,service_areas,status,is_verified,is_featured,ranking_weight,profile_image_path,updated_at').eq('id',id).eq('status','ACTIVE').maybeSingle();
          if(error||!data)return;
          return window.__MNTYOpenProviderProfilePage?.(data);
        }catch(_){return}
      }
      if(h==='#mx-home'||h===''||h==='#') return window.MXHomeLanding?.();
    };
    const callAuth=()=>typeof window.authView==='function'?window.authView():typeof authView==='function'?authView():null;
    const publicHomeToPlatform=()=>typeof openPlatform==='function'?openPlatform():goLogin();
    const callPlatform=()=>typeof window.openPlatform==='function'?window.openPlatform():typeof window.authView==='function'?window.authView():publicHomeToPlatform();
    const hydrateAuthenticatedSession=async()=>{
      if(window.MNTYAuthState?.authenticated)return true;
      try{
        if(typeof sb==='undefined'||!sb?.auth?.getSession)return false;
        const {data,error}=await sb.auth.getSession();
        if(error||!data?.session?.user)return false;
        if(typeof enterAuthenticatedApp==='function'){
          await enterAuthenticatedApp(data.session.user,{force:true});
          return !!window.MNTYAuthState?.authenticated;
        }
      }catch(_){}
      return false;
    };
    const goLogin=async()=>{
      if(await hydrateAuthenticatedSession())return callPlatform();
      return callAuth();
    };
    const goAdvertise=async()=>{
      try{localStorage.removeItem('MNTYWorkspaceMode');localStorage.removeItem('MNTYWorkspaceCurrent');}catch(_){}
      if(await hydrateAuthenticatedSession()){
        const role=String(window.MNTYAuthState?.role||'').toUpperCase();
        if(role==='CUSTOMER'){
          try{localStorage.setItem('MNTYPendingRegistration',JSON.stringify({role:'SERVICE_PROVIDER',email:window.MNTYAuthState?.email||''}));}catch(_){}
          return typeof window.providerOnboardingView==='function'?window.providerOnboardingView():(typeof window.accountView==='function'?window.accountView():callAuth());
        }
        return callPlatform();
      }
      try{localStorage.setItem('MNTYPendingRegistration',JSON.stringify({role:'SERVICE_PROVIDER',email:''}));}catch(_){}
      return callAuth();
    };
    // "حسابي" must open the account page itself, not the workspace.
    const openAccount=async()=>{
      if(await hydrateAuthenticatedSession()){
        return typeof window.accountView==='function'?window.accountView():typeof accountView==='function'?accountView():callPlatform();
      }
      return callAuth();
    };
    const scrollTo=id=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
    const navigateHomeSection=(id)=>{
      const section=document.getElementById(id);
      if(!section)return;
      const featureMap={services:'SERVICE_CATALOG',offers:'ADVERTISEMENTS',marketing:'MARKETING'};
      const code=featureMap[id];
      if(code&&!homeSectionEnabled(code)){scrollTo('mx-categories');return}
      if(section.hidden) section.hidden=false;
      scrollTo(id);
      if(id==='mx-services'&&!document.getElementById('mx-live-status')?.textContent?.includes('نتيجة')) loadData(document.getElementById('mx-home-search')?.value||'');
    };
    document.querySelectorAll('.mx-nav a[href^="#mx-"], .mx-mobile-drawer a[href^="#mx-"]').forEach(a=>{
      a.addEventListener('click',e=>{
        const id=String(a.getAttribute('href')||'').slice(1);
        if(!id)return;
        e.preventDefault();
        navigateHomeSection(id);
        closeMobileMenu();
        try{history.replaceState({},'', '#'+id);}catch(_){}
      });
    });
    document.getElementById('mx-login').onclick=openAccount;
    syncHomeAuthState();
    if(String(location.hash||'').startsWith('#category/')) setTimeout(()=>window.__MNTYOpenCategoryPage?.(decodeURIComponent(String(location.hash).slice(10))),0);
    else if(String(location.hash||'').startsWith('#provider/')) setTimeout(()=>window.__MNTYHandlePublicRoute?.(),0);
    else if(String(location.hash||'').startsWith('#page/')) setTimeout(()=>window.__MNTYHandlePublicRoute?.(),0);
    document.getElementById('mx-admin-return')?.addEventListener('click',async()=>{
      const btn=document.getElementById('mx-admin-return');
      if(btn)btn.disabled=true;
      try{
        if(typeof openPrivilegedWorkspace==='function'){
          await openPrivilegedWorkspace('OWNER');
          return;
        }
        const id=window.MNTYAdminReturnMembershipId||localStorage.getItem('MNTYAdminReturnMembershipId');
        if(id&&typeof switchMembership==='function'){
          await switchMembership(id);
          localStorage.removeItem('MNTYAdminReturnMembershipId');
          window.MNTYAdminReturnMembershipId=null;
        }else{
          if(btn)btn.disabled=false;
        }
      }catch(e){
        if(btn)btn.disabled=false;
      }
    });
    document.getElementById('mx-add').onclick=openActivityRequestModal;
    document.getElementById('mx-ad-book')?.addEventListener('click',openActivityRequestModal);
    document.getElementById('mx-bottom-add')?.addEventListener('click',openActivityRequestModal);
    const selectAdPlan=(plan)=>{
      try{localStorage.setItem('MNTYPendingAdPlan',String(plan||'QUARTERLY'));}catch(_){}
      document.querySelectorAll('[data-ad-plan]').forEach(x=>x.classList.toggle('is-selected',x.dataset.adPlan===plan));
    };
    document.querySelectorAll('[data-ad-plan]').forEach(btn=>btn.onclick=()=>{
      selectAdPlan(btn.dataset.adPlan||'QUARTERLY');
      goLogin();
    });
    document.getElementById('mx-hero-search').onclick=()=>{
      const input=document.getElementById('mx-home-search');
      if(input){input.focus();input.scrollIntoView(scrollOptions('center'));}
    };
    document.getElementById('mx-ad-book').onclick=()=>{selectAdPlan('QUARTERLY');goAdvertise();};
    document.getElementById('mx-ad-plans').onclick=()=>document.getElementById('mx-ad-plans-grid')?.scrollIntoView(scrollOptions('center'));
    document.getElementById('mx-bottom-account').onclick=openAccount;
    document.getElementById('mx-bottom-add').onclick=goAdvertise;
    document.getElementById('mx-all').onclick=()=>scrollTo('mx-services');
    document.getElementById('mx-ad-cta').onclick=goAdvertise;

    document.querySelectorAll('[data-scroll]').forEach(btn=>btn.onclick=()=>scrollTo(btn.dataset.scroll));
    document.querySelectorAll('[data-auth-link]').forEach(a=>a.onclick=e=>{e.preventDefault();goLogin()});
    document.querySelectorAll('[data-module]').forEach(btn=>btn.onclick=()=>{
  const moduleName=btn.dataset.module||'';
  if(window.MNTYAuthState?.authenticated&&typeof window.selectModule==='function'){
    window.selectModule(moduleName);
    return;
  }
  goLogin();
});
    document.querySelectorAll('[data-register-role]').forEach(btn=>btn.onclick=()=>{
      if(typeof authView!=='function') return;
      const role=btn.getAttribute('data-register-role')||'CUSTOMER';
      authView('',false,'','register');
      const select=document.getElementById('registration-type');
      if(select) select.value=role;
      if(typeof authRegistrationType!=='undefined') authRegistrationType=role;
    });

    const renderServices=(services,term='')=>{
      const el=document.getElementById('mx-service-grid');
      if(!services.length){el.innerHTML=term?'<div class="mx-empty"><b>لا توجد نتائج مطابقة لبحثك</b><span>جرّب اسم خدمة أو مقدم خدمة آخر.</span></div>':'<div class="mx-empty"><b>لا توجد خدمات منشورة حاليًا</b><span>سيظهر كتالوج الخدمات هنا تلقائيًا عند نشر الخدمات واعتمادها.</span></div>';return}
      el.innerHTML=services.map(s=>'<article class="mx-service-card">'+serviceMedia(s)+'<div class="mx-service-card__body"><span class="mx-chip">'+escapeHtml(s.category_code||'SERVICE')+'</span><h3>'+escapeHtml(s.name_ar||s.name_en||'خدمة')+'</h3><p>'+escapeHtml(s.description||'خدمة متاحة ضمن كتالوج MantiqatiX.')+'</p><button type="button" class="mx-card-link" data-service="'+escapeHtml(s.id)+'">استكشف الخدمة ←</button></div></article>').join('');
      el.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>{
        const id=b.dataset.service;
        const item=(services||[]).find(x=>String(x.id)===String(id));
        const input=document.getElementById('mx-home-search');
        if(input){input.value=item?.name_ar||item?.name_en||'';}
        loadData(item?.name_ar||item?.name_en||'');
        document.getElementById('mx-services')?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    };
    const renderProviders=(providers,term='')=>{
      const el=document.getElementById('mx-provider-grid');
      if(!providers.length){el.innerHTML=term?'<div class="mx-empty"><b>لا توجد نتائج مطابقة لبحثك</b><span>جرّب اسم خدمة أو مقدم خدمة آخر.</span></div>':'<div class="mx-empty"><b>لا يوجد مقدمو خدمات منشورون حاليًا</b><span>لن يتم إنشاء أو عرض أسماء تجريبية. ستظهر الجهات بعد نشرها واعتمادها.</span></div>';return}
      el.innerHTML=providers.map(p=>'<article class="mx-provider-card">'+providerMedia(p)+'<div class="mx-provider-card__body"><div class="mx-provider-card__top"><span class="mx-verified">'+(p.is_verified?'✓ موثق':'منشور')+'</span></div><h3>'+escapeHtml(p.name_ar||p.name_en||'مقدم خدمة')+'</h3><p>'+escapeHtml(p.description||'مقدم خدمة مسجل على MantiqatiX.')+'</p><span class="mx-location">⌖ '+escapeHtml((readArea(p.service_areas)||'نطاق خدمة معلن')+(p._distanceKm!=null?' · '+p._distanceKm.toFixed(1)+' كم':''))+(p._nearestFallback?' · الأقرب المتاح':'')+'</span><div class="mx-provider-actions"><button type="button" class="mx-card-link" data-provider="'+escapeHtml(p.id)+'">عرض الملف ←</button>'+(p.business_id?'<button type="button" class="mx-card-book" data-book-business="'+escapeHtml(p.business_id)+'" data-book-provider="'+escapeHtml(p.name_ar||p.name_en||'مقدم الخدمة')+'">احجز / اطلب خدمة</button>':'')+'</div></div></article>').join('');
      el.querySelectorAll('[data-provider]').forEach(b=>b.onclick=()=>{
        const id=b.dataset.provider;
        const item=(providers||[]).find(x=>String(x.id)===String(id));
        if(!item)return;
        openProviderProfilePage(item);
      });
      el.querySelectorAll('[data-book-business]').forEach(b=>b.onclick=()=>{
        const businessId=b.dataset.bookBusiness, providerName=b.dataset.bookProvider||'مقدم الخدمة';
        if(window.MNTYAuthState?.authenticated && typeof openProviderCatalog==='function') return openProviderCatalog(businessId,providerName);
        try{localStorage.setItem('MNTYPendingProvider',JSON.stringify({businessId,providerName}));}catch(_){}
        goLogin();
      });
    };
    const safeAdUrl=value=>{try{const u=new URL(String(value||''),window.location.origin);return ['http:','https:'].includes(u.protocol)?u.href:''}catch(_){return ''}};
    const renderTargetedAds=ads=>{
      const el=document.getElementById('mx-sponsored');
      if(!el)return;
      const list=Array.isArray(ads)?ads:[];
      if(!list.length){renderSponsored([]);return}
      el.innerHTML='<div class="mx-feature-ad"><span class="mx-feature-ad__badge">إعلان ممول</span><div><h3>إعلانات موجهة حسب موقعك</h3><p>يتم اختيار الإعلان على مستوى المركز أو المحافظة أو الدولة، ومع عدم وجود إعلان مطابق يتم عرض الأقرب.</p></div></div><div class="mx-listing-grid">'+list.map(a=>{
        const href=safeAdUrl(a.target_url);
        const action=href?'<a class="mx-listing__cta" href="'+escapeHtml(href)+'" target="_blank" rel="noopener noreferrer">عرض الإعلان</a>':'';
        const creative=safeAdUrl(a.creative_url)||'assets/mnty-ad-space-booking-banner.svg'; return '<article class="mx-listing"><div class="mx-listing__media"><img src="'+escapeHtml(creative)+'" alt="'+escapeHtml(a.title||'إعلان ممول')+'" loading="lazy"></div><div class="mx-listing__body"><span class="mx-sponsored-badge">ممول · '+escapeHtml(a.match_level||'TARGETED')+'</span><h3>'+escapeHtml(a.title||'إعلان ممول')+'</h3>'+(a.distance_km!=null?'<small>الأقرب · '+Number(a.distance_km).toFixed(1)+' كم</small>':'')+action+'</div></article>';
      }).join('')+'</div>';
    };

    const renderSponsored=(providers)=>{
      const el=document.getElementById('mx-sponsored');
      const featured=providers.filter(p=>p.is_featured).slice(0,4);
      if(!featured.length){el.innerHTML='<div class="mx-feature-ad"><span class="mx-feature-ad__badge">إعلان ممول</span><div><h3>كبّر ظهور نشاطك</h3><p>المساحة الإعلانية تُملأ تلقائيًا عند وجود نشاط منشور ومميز وفق قواعد المنصة.</p><button class="mx-btn mx-btn--primary" id="mx-feature-cta" type="button">ابدأ الإعلان الآن</button></div></div><div class="mx-empty mx-empty--dark">لا توجد إعلانات ممولة منشورة حاليًا.</div>';document.getElementById('mx-feature-cta').onclick=goLogin;return}
      el.innerHTML='<div class="mx-feature-ad"><span class="mx-feature-ad__badge">إعلان ممول</span><div><h3>ظهور مميز أمام جمهورك</h3><p>نتائج مدفوعة موسومة بوضوح ضمن تجربة البحث.</p></div></div><div class="mx-listing-grid">'+featured.map(p=>'<article class="mx-listing">'+providerMedia(p)+'<div class="mx-listing__body"><span class="mx-sponsored-badge">ممول</span><span class="mx-verified">'+(p.is_verified?'✓ موثق':'منشور')+'</span><h3>'+escapeHtml(p.name_ar||p.name_en||'مقدم خدمة')+'</h3><p>'+escapeHtml(p.description||'نشاط مميز على MantiqatiX.')+'</p><button class="mx-listing__cta" type="button" data-provider="'+escapeHtml(p.id)+'">عرض النشاط</button></div></article>').join('')+'</div>';
      el.querySelectorAll('[data-provider]').forEach(b=>b.onclick=()=>{
        const id=b.dataset.provider;
        const item=featured.find(p=>String(p.id)===String(id));
        if(item){
          const card=document.querySelector('#mx-provider-grid [data-provider="'+escapeHtml(item.id)+'"]');
          card?.click();
        }
      });
    };

    const loadLocationUi=()=>{
      const api=window.MNTYLocationAdapter;
      const status=document.getElementById('mx-location-status');
      const ranges=document.getElementById('mx-location-ranges');
      if(!api||!status||!ranges)return;
      status.textContent=api.statusText();
       const label=document.getElementById('mx-location-label');
       if(label) label.textContent=api.state.status==='ready'?'الموقع محدد':api.state.status==='requesting'?'جارٍ تحديد الموقع…':'الموقع عند الحاجة';
      ranges.innerHTML=api.ranges.map(x=>'<button type="button" class="mx-link" data-radius="'+x.km+'" style="border:1px solid #d0d5dd;border-radius:999px;padding:6px 10px;background:'+(api.state.radiusKm===x.km?'#101828':'#fff')+';color:'+(api.state.radiusKm===x.km?'#fff':'#344054')+'">'+x.label+'</button>').join('');
      ranges.querySelectorAll('[data-radius]').forEach(b=>b.onclick=async()=>{api.setRadius(Number(b.dataset.radius));loadLocationUi();await loadData(document.getElementById('mx-home-search')?.value||'')});
    };

    let homeLoadSequence=0;
    const loadData=async(searchText='',categoryCode='')=>{
      const requestSequence=++homeLoadSequence;
      const sb=getClient();
      const status=document.getElementById('mx-live-status');
      if(!sb){status.textContent='وضع العرض';renderServices([]);renderProviders([]);renderSponsored([]);return}
      const term=String(searchText||'').trim();
        const safeTerm=term.replace(/[^\p{L}\p{N}\s-]/gu,' ').trim().slice(0,60);
      try{
        await loadHomeRuntimeFlags(sb);
        loadLocationUi();
        document.querySelectorAll('[data-module]').forEach(btn=>{ btn.hidden=!homeFeatureEnabled(btn.dataset.module); });
        const moduleStrip=document.getElementById('mx-marketing');
        if(moduleStrip && !['CRM','MARKETING','ANALYTICS','OPERATIONS'].some(homeFeatureEnabled)) moduleStrip.hidden=true;
        ['mx-services','mx-offers','mx-marketing'].forEach(id=>{
          const el=document.getElementById(id);
          if(el) el.hidden = id==='mx-services' ? !homeSectionEnabled('SERVICE_CATALOG') : id==='mx-offers' ? !homeSectionEnabled('ADVERTISEMENTS') : !homeSectionEnabled('MARKETING');
        });
        let serviceQuery=sb.from('marketing_services').select('id,code,name_ar,name_en,category_code,description').eq('status','ACTIVE').order('created_at',{ascending:false}).limit(12);
        let providerQuery=sb.from('marketing_provider_profiles').select('id,business_id,name_ar,name_en,provider_kind,description,service_areas,status,is_verified,is_featured,ranking_weight,profile_image_path,updated_at').eq('status','ACTIVE').order('is_featured',{ascending:false}).order('ranking_weight',{ascending:false}).limit(12);
        if(categoryCode){ const code=normCode(categoryCode); serviceQuery=serviceQuery.eq('category_code',code); providerQuery=providerQuery.eq('provider_kind',code); } else if(safeTerm){ serviceQuery=serviceQuery.or('name_ar.ilike.%'+safeTerm+'%,name_en.ilike.%'+safeTerm+'%,description.ilike.%'+safeTerm+'%'); providerQuery=providerQuery.or('name_ar.ilike.%'+safeTerm+'%,name_en.ilike.%'+safeTerm+'%,description.ilike.%'+safeTerm+'%')}
        const adCoords=window.MNTYLocationAdapter?.state?.coords||null;
        const adsPromise=sb.rpc('get_mnty_targeted_advertisements',{
          p_country_code:'EG',
          p_governorate_code:null,
          p_center_code:null,
          p_lat:adCoords?.latitude??null,
          p_lon:adCoords?.longitude??null,
          p_ad_space_id:'HOME_SPONSORED',
          p_limit:4
        });
        const [servicesRes,providersRes,adsRes]=await Promise.allSettled([serviceQuery,providerQuery,adsPromise]);
        if(servicesRes.status!=='fulfilled' || servicesRes.value?.error) throw (servicesRes.status==='fulfilled'?servicesRes.value.error:new Error('تعذر تحميل الخدمات'));
        if(providersRes.status!=='fulfilled' || providersRes.value?.error) throw (providersRes.status==='fulfilled'?providersRes.value.error:new Error('تعذر تحميل مقدمي الخدمات'));
        if(requestSequence!==homeLoadSequence)return;
        const services=servicesRes.value?.data||[];
        const providers=window.MNTYLocationAdapter?await window.MNTYLocationAdapter.applyProviderRange(sb,providersRes.value?.data||[]):providersRes.value?.data||[];
        if(requestSequence!==homeLoadSequence)return;
        renderDynamicCategories(services,providers);
        renderServices(services,term);renderProviders(providers,term);
        const adsData=adsRes.status==='fulfilled' && !adsRes.value?.error ? (adsRes.value.data||[]) : [];
        if(adsData.length) renderTargetedAds(adsData);
        else renderSponsored(providers);
        if(adsRes.status!=='fulfilled' || adsRes.value?.error) console.warn('[MantiqatiX home] ads load failed; catalog results kept visible',adsRes.value?.error||adsRes.reason);
        status.textContent='مباشر · '+(services.length+providers.length)+' نتيجة';
        const activeTerm=String(term||'').trim();
        if(searchContext) searchContext.textContent=activeTerm?'نتائج البحث عن «'+activeTerm.slice(0,60)+'» من الكتالوج المنشور.':'استكشف الخدمات ومقدمي الخدمات المنشورين على المنصة.';
        if(searchClear) searchClear.hidden=!activeTerm;
        if(searchClearResults) searchClearResults.hidden=!activeTerm;
      }catch(error){
        if(requestSequence!==homeLoadSequence)return;
        console.warn('[MantiqatiX home] public catalog load failed',error);
        status.textContent='تعذر تحميل البيانات الحية';
        renderServices([]);renderProviders([]);renderSponsored([]);
      }
    };

    const searchInput=document.getElementById('mx-home-search');
    const searchButton=document.getElementById('mx-search-btn');
    const searchClear=document.getElementById('mx-search-clear');
    const searchSuggestions=document.getElementById('mx-search-suggestions');
    const searchContext=document.getElementById('mx-search-context');
    const searchClearResults=document.getElementById('mx-search-clear-results');
    const mobileMenu=document.getElementById('mx-mobile-menu');
    const mobileDrawer=document.getElementById('mx-mobile-drawer');
    const mobileBackdrop=document.getElementById('mx-mobile-drawer-backdrop');
    const mobileMenuClose=document.getElementById('mx-mobile-menu-close');
    const mobileAdd=document.getElementById('mx-mobile-add');

    const closeSearchSuggestions=()=>{
      if(!searchSuggestions)return;
      searchSuggestions.hidden=true;
      searchInput?.setAttribute('aria-expanded','false');
    };
    const closeMobileMenu=()=>{
      if(!mobileDrawer)return;
      mobileDrawer.classList.remove('is-open');
      mobileDrawer.setAttribute('aria-hidden','true');
      if(mobileBackdrop)mobileBackdrop.hidden=true;
      mobileMenu?.setAttribute('aria-expanded','false');
    };
    const openMobileMenu=()=>{
      if(!mobileDrawer)return;
      mobileDrawer.classList.add('is-open');
      mobileDrawer.setAttribute('aria-hidden','false');
      if(mobileBackdrop)mobileBackdrop.hidden=false;
      mobileMenu?.setAttribute('aria-expanded','true');
      mobileDrawer.querySelector('a,button')?.focus();
    };
    mobileMenu?.addEventListener('click',()=>mobileDrawer?.classList.contains('is-open')?closeMobileMenu():openMobileMenu());
    mobileMenuClose?.addEventListener('click',closeMobileMenu);
    mobileBackdrop?.addEventListener('click',closeMobileMenu);
    mobileAdd?.addEventListener('click',()=>{closeMobileMenu();openActivityRequestModal();});
    document.querySelectorAll('[data-mobile-nav]').forEach(a=>a.addEventListener('click',closeMobileMenu));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMobileMenu();closeSearchSuggestions();}});

    const runSearch=()=>{
      const term=String(searchInput?.value||'').trim();
      closeSearchSuggestions();
      if(searchClear)searchClear.hidden=!term;
      if(searchClearResults)searchClearResults.hidden=!term;
      if(searchContext)searchContext.textContent=term?'نتائج البحث عن «'+term.slice(0,60)+'» من الكتالوج المنشور.':'استكشف الخدمات ومقدمي الخدمات المنشورين على المنصة.';
      loadData(term);
      scrollTo('mx-services');
    };
    const clearSearch=()=>{
      if(searchInput)searchInput.value='';
      if(searchClear)searchClear.hidden=true;
      if(searchClearResults)searchClearResults.hidden=true;
      if(searchContext)searchContext.textContent='استكشف الخدمات ومقدمي الخدمات المنشورين على المنصة.';
      closeSearchSuggestions();
      loadData('');
    };
    const showSearchSuggestions=()=>{
      if(!searchSuggestions||!searchInput)return;
      const term=String(searchInput.value||'').trim().toLowerCase();
      const suggestions=TAXONOMY.filter(x=>!term||String(x[1]).toLowerCase().includes(term)||String(x[2]).toLowerCase().includes(term)).slice(0,6);
      if(!term||!suggestions.length){closeSearchSuggestions();return;}
      searchSuggestions.innerHTML=suggestions.map(x=>'<button type="button" role="option" data-suggest="'+escapeHtml(x[1])+'"><span>'+escapeHtml(x[0])+'</span><b>'+escapeHtml(x[1])+'</b><small>'+escapeHtml(x[2])+'</small></button>').join('');
      searchSuggestions.hidden=false;
      searchInput.setAttribute('aria-expanded','true');
      searchSuggestions.querySelectorAll('[data-suggest]').forEach(btn=>btn.addEventListener('click',()=>{searchInput.value=btn.dataset.suggest||'';runSearch();}));
    };
    searchButton?.addEventListener('click',runSearch);
    searchInput?.addEventListener('input',()=>{if(searchClear)searchClear.hidden=!String(searchInput.value||'').trim();showSearchSuggestions();});
    searchInput?.addEventListener('focus',showSearchSuggestions);
    searchInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runSearch();}if(e.key==='Escape')closeSearchSuggestions();});
    searchClear?.addEventListener('click',clearSearch);
    searchClearResults?.addEventListener('click',clearSearch);
    document.getElementById('mx-bottom-search').onclick=()=>{searchInput?.focus();searchInput?.scrollIntoView({behavior:'smooth',block:'center'});};

    document.getElementById('mx-location-btn').onclick=async()=>{const api=window.MNTYLocationAdapter;if(api){await api.requestLocation();loadLocationUi();await loadData(document.getElementById('mx-home-search')?.value||'');}else goLogin();};
    document.getElementById('mx-wallet')?.addEventListener('click',()=>typeof window.walletView==='function'?window.walletView():goLogin());
    document.getElementById('mx-cart')?.addEventListener('click',()=>typeof window.cartView==='function'?window.cartView():goLogin());
    if(typeof window.refreshMntiCartCount==='function')window.refreshMntiCartCount();
    window.MNTY_HOME_READY=true;
    const routeHash=location.hash||'';
    const initialCategory=routeHash.match(/^#category\/(.+)$/);
    const initialProvider=routeHash.match(/^#provider\/(.+)$/);
    const openInitialProvider=async id=>{
      try{
        const sb=getClient(); if(!sb) throw new Error('NO_CLIENT');
        const r=await sb.from('marketing_provider_profiles').select('id,business_id,name_ar,name_en,provider_kind,description,service_areas,status,is_verified,is_featured,ranking_weight,profile_image_path,updated_at').eq('id',decodeURIComponent(id)).eq('status','ACTIVE').maybeSingle();
        if(r.error||!r.data) throw (r.error||new Error('NOT_FOUND'));
        openProviderProfilePage(r.data,'');
      }catch(_){ loadData(); }
    };
    if(!window.__MNTY_HOME_ROUTER_BOUND){
      window.__MNTY_HOME_ROUTER_BOUND=true;
      window.addEventListener('popstate',()=>{
        const h=location.hash||'';
        const cat=h.match(/^#category\/(.+)$/), prov=h.match(/^#provider\/(.+)$/);
        if(cat){try{openCategoryPage(decodeURIComponent(cat[1]));}catch(_){}}
        else if(prov){openInitialProvider(prov[1]);}
        else {try{window.MXHomeLanding?.();}catch(_){}}
      });
    }
    if(initialCategory){try{openCategoryPage(decodeURIComponent(initialCategory[1]));}catch(_){loadData();}}
    else if(initialProvider){openInitialProvider(initialProvider[1]);}
    else loadData();
  };
})();

// RC314 — footer information is an in-app surface, not a dead anchor.
const MNTY_FOOTER_INFO={about:{title:'من نحن',body:'MantiqatiX منصة رقمية للاكتشاف والمطابقة والتواصل وإدارة الطلبات والمتابعة بين العملاء ومقدمي الخدمات. المنصة لا تقدم الخدمة ماديًا نيابة عن مقدم الخدمة.'},legal:{title:'الشروط والأحكام',body:'استخدام المنصة يخضع للشروط والسياسات المعتمدة عند إطلاق الخدمات ذات الصلة. أي خدمة أو معاملة تشغيلية تظهر للمستخدم يجب أن تمر عبر المسار المخصص لها داخل المنصة.'},privacy:{title:'سياسة الخصوصية',body:'نحافظ على استخدام البيانات في حدود الغرض التشغيلي المعلن. لا تُعرض البيانات الخاصة أو وسائل الاتصال الحساسة في الواجهات العامة، وتخضع الصلاحيات للوصول المصرح به.'}};
function openMntyFooterInfo(key){const item=MNTY_FOOTER_INFO[key];if(!item)return;const existing=document.getElementById('mx-footer-info-modal');if(existing)existing.remove();const wrap=document.createElement('div');wrap.id='mx-footer-info-modal';wrap.className='mx-footer-info-modal';wrap.innerHTML='<div class="mx-footer-info-modal__backdrop" data-footer-close></div><section class="mx-footer-info-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="mx-footer-info-title" tabindex="-1"><button type="button" class="mx-footer-info-modal__close" aria-label="إغلاق" data-footer-close>×</button><span class="eyebrow">MantiqatiX</span><h2 id="mx-footer-info-title"></h2><p></p></section>';wrap.querySelector('h2').textContent=item.title;wrap.querySelector('p').textContent=item.body;const close=()=>{wrap.remove();document.removeEventListener('keydown',onKey);};const onKey=e=>{if(e.key==='Escape')close();};wrap.querySelectorAll('[data-footer-close]').forEach(el=>el.addEventListener('click',close));document.addEventListener('keydown',onKey);document.body.appendChild(wrap);wrap.querySelector('.mx-footer-info-modal__dialog').focus();}
document.addEventListener('click',e=>{const el=e.target.closest?.('[data-footer-info]');if(!el)return;e.preventDefault();openMntyFooterInfo(el.dataset.footerInfo);});
