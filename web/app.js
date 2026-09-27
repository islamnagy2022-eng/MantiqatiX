const {createClient}=window.supabase;
const cfg=window.MANTIQATIX_CONFIG;
const sb=createClient(cfg.supabaseUrl,cfg.supabaseKey);
const modules=[
['🏠','الرئيسية','لوحة التحكم الموحدة'],['🧩','الموديولات','تشغيل وإدارة وحدات المنصة'],['🏢','المجالات والخدمات','القطاعات ومقدمو الخدمات'],
['🛍️','التجارة والأزياء','المنتجات، المقاسات، السلة والطلبات'],['🛒','البقالة والسوبر ماركت','المنتجات، المخزون، السلة والتوصيل'],['🍽️','المطاعم والمطابخ','القوائم، الإضافات، المطبخ والتوصيل'],
['🩺','المنظومة الطبية','الأطباء، العيادات، الصيدليات، المعامل والأشعة والمستشفيات'],['🔧','الصيانة','طلبات الصيانة ومقدمو الخدمة'],['💼','الخدمات المهنية','المحاسبة، القانون، الشركات، البرمجيات والتسويق'],
['🚗','MantiGO والمزايدات','الطلبات، العروض، الاختيار والتنفيذ'],['💍','الزواج','الملفات الموثقة والترشيحات والتواصل'],['💼','الوظائف','الوظائف، المتقدمون والمقابلات'],
['🎓','التعليم','المدارس والمدرسون والحجوزات'],['♻️','المستعمل','الإعلانات والعروض والتفاوض'],['📣','التسويق والإعلان','التسويق الداخلي وشركات التسويق والعملاء المحتملون'],['🚀','خدمات التسويق الرقمي SMM','الخدمات والموردون والطلبات والتتبع'],
['👥','المستخدمون وCRM','العملاء، مقدمو الخدمة، المتابعة والاحتفاظ'],['📑','الطلبات والعمليات','الطلبات والحجوزات وسير التنفيذ'],['💳','العمولات والباقات','العمولات والاشتراكات والباقات'],['📊','التقارير والتحليلات','الأداء، التحويلات، الإيرادات والمخاطر'],['🎫','الدعم والحوكمة','التذاكر، التدقيق، الصلاحيات والمراقبة'],['🛡️','طلبات التسجيل','اعتماد طلبات العملاء ومقدمي الخدمة'],['⚙️','الإعدادات','الحساب والمنصة والتفضيلات']
];
const domainModules=[
{key:'FASHION',name:'التجارة والأزياء',icon:'🛍️',desc:'المنتجات والطلبات والخياطة والمخزون.',tables:['fashion_products','fashion_orders','fashion_tailor_services']},
{key:'GROCERY',name:'البقالة والسوبر ماركت',icon:'🛒',desc:'كتالوج الأصناف والأسعار والمخزون والطلبات.',tables:['catalog_items','catalog_item_prices','inventory_transactions','orders']},
{key:'ACCOUNTING',name:'المزايدات — المحاسبة',icon:'🧾',desc:'طلبات الخدمات المحاسبية والعروض والتفاوض.',tables:['indrive_requests','indrive_bids','chart_of_accounts','journal_entries']},
{key:'COMPANIES',name:'المزايدات — الشركات',icon:'🏢',desc:'طلبات الشركات ومقدمو الخدمة والعروض.',tables:['indrive_requests','indrive_bids','businesses']},
{key:'MARKETING',name:'المزايدات — التسويق',icon:'📣',desc:'طلبات التسويق ومقدمو الخدمة والمشروعات.',tables:['marketing_leads','marketing_provider_profiles','marketing_services','marketing_projects']},
{key:'FACTORIES',name:'المزايدات — المصانع',icon:'🏭',desc:'طلبات المصانع والعروض والتشغيل المرتبط بالمخزون.',tables:['indrive_requests','indrive_bids','inventory_transactions','warehouses']},
{key:'TRIPS',name:'المزايدات — الرحلات',icon:'✈️',desc:'طلبات الرحلات والعروض والتنفيذ.',tables:['indrive_requests','indrive_bids','mantigo_rides','mantigo_bids']},
{key:'MAINTENANCE',name:'المزايدات — الصيانة',icon:'🔧',desc:'طلبات الصيانة والعروض والمتابعة.',tables:['indrive_requests','indrive_bids','support_tickets']},
{key:'LEGAL',name:'المزايدات — الخدمات القانونية',icon:'⚖️',desc:'الوثائق والمتطلبات والاتفاقيات القانونية.',tables:['legal_documents','legal_requirements','agreements']},
{key:'ERP',name:'المزايدات — البرمجيات ERP',icon:'💻',desc:'المشتريات والاستلام والتحويلات والمخازن.',tables:['erp_purchase_orders','erp_purchase_receipts','erp_stock_transfers','warehouses']},
{key:'MATRIMONY',name:'الزواج',icon:'💍',desc:'الملفات والطلبات وفتح وسائل التواصل وفق النظام.',tables:['matrimony_profiles','matrimony_requests','matrimony_contact_unlocks']},
{key:'JOBS',name:'الوظائف',icon:'💼',desc:'الوظائف والتقديمات ومتابعة المرشحين.',tables:['jobs','job_applications']},
{key:'MEDICAL',name:'المنظومة الطبية',icon:'🩺',desc:'مسار طبي موحد يجب ربطه بجداول طبية فعلية قبل التحقق النهائي.',tables:[]},
{key:'RESTAURANTS',name:'المطاعم والمطابخ',icon:'🍽️',desc:'القائمة والطلبات والطاولات والمخزون.',tables:['restaurant_menu_items','restaurant_orders','restaurant_tables','restaurant_inventory']},
{key:'EDUCATION',name:'المدارس والتدريب',icon:'🎓',desc:'المدارس والمدرسون وطلبات التعليم.',tables:['school_profiles','teacher_profiles','education_requests']},
{key:'USED_ITEMS',name:'المستعمل',icon:'♻️',desc:'إعلانات المستعمل والعروض والتفاوض.',tables:['used_item_ads']}
];
const sectors=[
['🩺','الأطباء والعيادات','ملفات الأطباء، التخصصات، الباقات، الترشيحات والعمولات'],['💊','الصيدليات','الخدمات والمنتجات، الباقات، الطلبات والعمولات'],
['🧪','التحاليل والأشعة','المعامل ومراكز الأشعة، الخدمات، الترشيحات والعمولات'],['🏥','المستشفيات الخاصة','الأقسام والخدمات والباقات والترشيحات'],
['🍽️','المطاعم والكافيهات','الطلبات والعروض وإدارة النشاط'],['🛒','السوبر ماركت','المنتجات والطلبات والعروض'],
['👗','الأزياء','المتاجر والمنتجات والحملات'],['🔧','الصيانة','مقدمو الخدمة والطلبات والترشيحات'],['💼','الأعمال وERP','إدارة الأعمال والمحاسبة والخدمات المهنية'],
['🎓','التعليم','المدارس والمدرسون والخدمات التعليمية'],['✈️','السفر والرحلات','الوكلاء والرحلات والحجوزات'],['🤝','الشركاء','الشركاء الاستراتيجيون ومصادر العملاء']
];
let current='الرئيسية', query='', user=null, deferredInstallPrompt=null, authBooted=false, authRenderLock=false, authIntent='login', authRegistrationType='CUSTOMER';
const live={memberships:[],activeMembershipId:null,role:'CUSTOMER',businessId:null,tenantId:null,organizationId:null,branchId:null,permissions:{},counts:{},flags:{},records:{leads:[],providers:[],orders:[],notifications:[],orderHistory:[],supportTickets:[],ads:[],projects:[],services:[],registrationRequests:[]},moduleData:{},myProviderProfile:null,loading:false,error:null};
const countOrDash=key=>Object.prototype.hasOwnProperty.call(live.counts,key)?String(live.counts[key]):'—';
async function safeCount(table,column,value){try{let q=sb.from(table).select('*',{count:'exact',head:true});if(column&&value)q=q.eq(column,value);const {count,error}=await q;return error?null:(count??0)}catch(_){return null}}
async function loadLiveData(){
const uid=user?.id;
if(!uid)return;
live.loading=true;live.error=null;live.flags={};live.counts={};live.moduleData={};live.records.registrationRequests=[];live.myProviderProfile=null;
try{
 const m=await sb.from('user_memberships').select('id,tenant_id,organization_id,business_id,branch_id,role,permissions,status').eq('user_id',uid).eq('status','ACTIVE');
 if(m.error)throw m.error;
 live.memberships=m.data||[];
 const savedId=window.MNTYActiveMembershipId;
 const active=live.memberships.find(m=>m.id===savedId)||live.memberships[0];
 if(active)window.MNTYActiveMembershipId=active.id;
 live.activeMembershipId=active?.id||null;
 live.role=String(active?.role||'CUSTOMER').toUpperCase();
 live.businessId=active?.business_id||null;
 live.tenantId=active?.tenant_id||null;
 live.organizationId=active?.organization_id||null;
 live.branchId=active?.branch_id||null;
 live.permissions=active?.permissions||{};
 if(!active){
   live.loading=false;
   return;
 }
 const myProviderRes=await sb.from('marketing_provider_profiles').select('id,name_ar,name_en,provider_kind,description,service_areas,profile_image_path,updated_at,status,is_verified,is_featured').eq('owner_user_id',uid).maybeSingle();
 if(myProviderRes.error)throw myProviderRes.error;
 live.myProviderProfile=myProviderRes.data||null;
 const specs=[['advertisements',null,null,'ads'],['marketing_projects',live.businessId?'client_business_id':null,live.businessId,'projects'],['notifications','user_id',uid,'notifications'],['support_tickets','requester_id',uid,'support'],['marketing_leads','requester_user_id',uid,'leads'],['marketing_provider_profiles','owner_user_id',uid,'providers'],['orders','customer_id',uid,'orders']];
 if(live.businessId)specs.push(['businesses','id',live.businessId,'businesses']);
 const results=await Promise.all(specs.map(x=>safeCount(x[0],x[1],x[2])));
 specs.forEach((x,i)=>{if(results[i]!==null)live.counts[x[3]]=results[i]});
 const fq=sb.from('platform_feature_flags').select('module_code,feature_code,enabled,configuration');
 if(live.businessId)fq.or(`scope_type.eq.PLATFORM,business_id.eq.${live.businessId}`);else fq.eq('scope_type','PLATFORM');
 const fr=await fq;if(fr.error)throw fr.error;
 (fr.data||[]).forEach(x=>{live.flags[`${x.module_code||''}:${x.feature_code||''}`]=x});
 const [leadsRes,providersRes,ordersRes,notificationsRes,ticketsRes,adsRes,projectsRes,servicesRes]=await Promise.all([
  sb.from('marketing_leads').select('id,title,status,source,created_at').order('created_at',{ascending:false}).limit(10),
  sb.from('marketing_provider_profiles').select('id,name_ar,provider_kind,status,is_verified,created_at').order('created_at',{ascending:false}).limit(10),
  sb.from('orders').select('id,status,total_amount,currency,customer_name,created_at').order('created_at',{ascending:false}).limit(10),
  sb.from('notifications').select('id,title,body,read_at,created_at').order('created_at',{ascending:false}).limit(10),
  sb.from('support_tickets').select('id,subject,description,category,priority,status,assigned_user_id,created_at,updated_at,closed_at').order('created_at',{ascending:false}).limit(10),
  sb.from('advertisements').select('id,title,status,approval_status,start_at,end_at,created_at').order('created_at',{ascending:false}).limit(10),
  sb.from('marketing_projects').select('id,project_type,management_mode,status,gross_value,platform_commission,currency,created_at').order('created_at',{ascending:false}).limit(10),
  sb.from('marketing_services').select('id,code,name_ar,name_en,category_code,status,created_at').eq('status','ACTIVE').order('created_at',{ascending:false}).limit(20)
 ]);
 live.records.leads=leadsRes.data||[];live.records.providers=providersRes.data||[];live.records.orders=ordersRes.data||[];live.records.notifications=notificationsRes.data||[];live.records.supportTickets=ticketsRes.data||[];live.records.ads=adsRes.data||[];live.records.projects=projectsRes.data||[];live.records.services=servicesRes.data||[];
 if(['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase())){
  const rr=await sb.from('account_registration_requests').select('id,user_id,requested_role,status,reason,created_at,reviewed_at').in('status',['PENDING','APPROVED','REJECTED']).order('created_at',{ascending:false}).limit(50);
  live.records.registrationRequests=rr.data||[];
 }
 const orderIds=(live.records.orders||[]).map(r=>r.id).filter(Boolean);
 const histRes=orderIds.length?await sb.from('order_status_history').select('order_id,old_status,new_status,reason,created_at').in('order_id',orderIds).order('created_at',{ascending:false}).limit(30):{data:[],error:null};
 live.records.orderHistory=histRes.data||[];
 live.counts.leads=leadsRes.error?live.counts.leads:(live.counts.leads??live.records.leads.length);
 live.counts.providers=providersRes.error?live.counts.providers:(live.counts.providers??live.records.providers.length);
 live.counts.orders=ordersRes.error?live.counts.orders:(live.counts.orders??live.records.orders.length);
 live.counts.notifications=notificationsRes.error?live.counts.notifications:(live.counts.notifications??live.records.notifications.length);
 live.counts.support=ticketsRes.error?live.counts.support:(live.counts.support??live.records.supportTickets.length);
}catch(e){live.error=e?.message||'تعذر تحميل بيانات المنصة';}finally{live.loading=false;}
}


function roleLabel(role){
 const labels={CUSTOMER:'عميل',SERVICE_PROVIDER:'صاحب نشاط / مقدم خدمة',OWNER:'Owner',ADMIN:'مدير',SUPER_ADMIN:'مدير النظام',MANAGER:'مدير',BUSINESS_OWNER:'مالك نشاط',SUPPORT:'دعم',SUPPORT_MANAGER:'مدير الدعم',EMPLOYEE:'موظف',STAFF:'موظف'};
 return labels[String(role||'').toUpperCase()]||String(role||'دور');
}
function roleContextLabel(m){
 if(!m)return 'دور';
 const parts=[roleLabel(m.role)];
 if(m.tenant_id)parts.push('Tenant: '+m.tenant_id);
 if(m.business_id)parts.push('نشاط: '+m.business_id);
 if(m.branch_id)parts.push('فرع: '+m.branch_id);
 return parts.join(' · ');
}
async function switchMembership(membershipId){
 if(!membershipId||!live.memberships.some(m=>m.id===membershipId))return;
 if(membershipId===live.activeMembershipId)return;
 window.MNTYActiveMembershipId=membershipId;
 live.activeMembershipId=membershipId;
 current='الرئيسية';
 query='';
 await renderApp();
 showToast('تم التبديل إلى: '+roleContextLabel(live.memberships.find(m=>m.id===membershipId)),'success');
}
function roleSwitcher(){
 if(!live.memberships.length)return '';
 const active=live.memberships.find(m=>m.id===live.activeMembershipId)||live.memberships[0];
 const options=live.memberships.map(m=>'<option value="'+esc(m.id)+'" '+(m.id===active?.id?'selected':'')+'>'+esc(roleContextLabel(m))+'</option>').join('');
 return '<label class="role-switcher"><span>الوضع الحالي</span><select id="mx-role-switcher" aria-label="التبديل بين الأدوار">'+options+'</select></label>';
}
async function loadDomainModule(name){const m=domainModules.find(x=>x.name===name);if(!m)return;live.moduleData[m.key]={tables:{},ready:false};if(!m.tables.length){live.moduleData[m.key].ready=true;return}const out=await Promise.all(m.tables.map(async t=>{const count=await safeCount(t,null,null);return [t,count]}));out.forEach(([t,c])=>{live.moduleData[m.key].tables[t]=c});live.moduleData[m.key].ready=true}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mark=()=>'<span class="mark"></span>';
function authView(msg='',otpMode=false,emailValue='',mode=authIntent){
authIntent=mode||'login';
document.getElementById('app').innerHTML=otpMode
?`<main class="auth"><section class="auth-card"><div class="brand">${mark()}<span>Mantiqati X</span></div><div class="gradient-line"></div><h1>رمز الدخول</h1><p>أرسلنا رمز تحقق لمرة واحدة إلى <b>${esc(emailValue)}</b>. أدخل الرمز لإكمال الدخول.</p><div class="field"><label>رمز OTP</label><input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="أدخل رمز التحقق"></div><button class="btn btn-primary" id="verify">تحقق ودخول</button><button class="text-btn" id="resend-otp">إرسال رمز جديد</button><button class="text-btn" id="back-auth">تغيير البريد الإلكتروني</button>${msg?`<div class="msg">${esc(msg)}</div>`:''}</section></main>`
:`<main class="auth"><section class="auth-card"><div class="brand">${mark()}<span>Mantiqati X</span></div><div class="gradient-line"></div><h1>${authIntent==='register'?'تسجيل مستخدم جديد':'تسجيل الدخول'}</h1><p>${authIntent==='register'?'أنشئ حسابك باستخدام بريدك الإلكتروني. بعد التحقق يتم استكمال تفعيل العضوية وفق الصلاحيات المعتمدة.':'استخدم بريدك الإلكتروني للحصول على رمز تحقق لمرة واحدة. لا نستخدم كلمة مرور في مسار الإنتاج.'}</p>${authIntent==='register'?'<div class="field"><label>نوع الحساب</label><select id="registration-type"><option value="CUSTOMER">عميل</option><option value="SERVICE_PROVIDER">مقدم خدمة</option></select></div>':''}<div class="field"><label>البريد الإلكتروني</label><input id="email" type="email" autocomplete="email" placeholder="name@example.com"></div><button class="btn btn-primary" id="send-otp">${authIntent==='register'?'إرسال رمز التسجيل':'إرسال رمز الدخول'}</button><button class="text-btn" id="switch-auth">${authIntent==='register'?'لدي حساب بالفعل — تسجيل الدخول':'مستخدم جديد؟ — تسجيل حساب'}</button>${msg?`<div class="msg">${esc(msg)}</div>`:''}</section></main>`;
if(otpMode){
const otp=document.getElementById('otp');otp.focus();
document.getElementById('verify').onclick=()=>verifyOtp(emailValue);
document.getElementById('resend-otp').onclick=()=>sendOtp(emailValue);
document.getElementById('back-auth').onclick=()=>authView('',false,emailValue);
otp.addEventListener('keydown',e=>{if(e.key==='Enter')verifyOtp(emailValue)});
}else{
document.getElementById('email').focus();
document.getElementById('send-otp').onclick=()=>{if(authIntent==='register')authRegistrationType=document.getElementById('registration-type')?.value||'CUSTOMER';sendOtp();};document.getElementById('switch-auth').onclick=()=>authView('',false,'',authIntent==='register'?'login':'register');
document.getElementById('email').addEventListener('keydown',e=>{if(e.key==='Enter')sendOtp()});
}
}
async function sendOtp(existingEmail=''){
const email=(existingEmail||document.getElementById('email')?.value||'').trim().toLowerCase();
if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return authView('أدخل بريدًا إلكترونيًا صحيحًا.');
const button=document.getElementById('send-otp')||document.getElementById('resend-otp');if(button){button.disabled=true;button.textContent='جارٍ إرسال الرمز...'}
const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
if(error)return authView('تعذر إرسال رمز الدخول: '+error.message,!!existingEmail,email);
authView('',true,email);
}
async function verifyOtp(email){
const token=(document.getElementById('otp')?.value||'').replace(/\D/g,'').slice(0,10);
if(token.length<6)return authView('أدخل رمز التحقق المكوّن من 6 إلى 10 أرقام.',true,email);
const button=document.getElementById('verify');if(button){button.disabled=true;button.textContent='جارٍ التحقق...'}
const {data,error}=await sb.auth.verifyOtp({email,token,type:'email'});
if(error)return authView('تعذر التحقق من الرمز: '+error.message,true,email);
if(!data?.session||!data?.user)return authView('تم التحقق لكن لم تُنشأ جلسة دخول صالحة. أعد المحاولة.',true,email);
user=data.user;if(authIntent==='register'){await submitRegistrationRequest();return;}await enterAuthenticatedApp(data.user);
}
async function logout(){const {error}=await sb.auth.signOut();if(error)return showToast('تعذر تسجيل الخروج: '+error.message,'error');user=null;window.MNTYAuthState={authenticated:false,email:'',membership:false};window.MNTYActiveMembershipId=null;live.memberships=[];live.activeMembershipId=null;live.role='CUSTOMER';live.businessId=null;live.tenantId=null;live.organizationId=null;live.branchId=null;live.permissions={};live.counts={};live.flags={};live.moduleData={};live.records={leads:[],providers:[],orders:[],notifications:[],orderHistory:[],supportTickets:[],ads:[],projects:[],services:[],registrationRequests:[]};window.MXHomeLanding?MXHomeLanding():landingView()}
function setupInstallPrompt(){
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;const b=document.getElementById('install-app');if(b)b.hidden=false});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;const b=document.getElementById('install-app');if(b)b.hidden=true});
}
async function installApp(){if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;const b=document.getElementById('install-app');if(b)b.hidden=true}
function landingView(){
document.getElementById('app').innerHTML=`<main class="landing">
<header class="landing-nav"><div class="brand">${mark()}<span>Mantiqati X</span></div><nav><a href="smm.html">خدمات SMM</a><a href="#services">الخدمات</a><a href="#sectors">المجالات</a><a href="#audiences">لمن؟</a><a href="#plans">الباقات</a><a href="#how">كيف تعمل</a><a href="#faq">الأسئلة</a></nav><div style="display:flex;gap:8px;align-items:center"><button class="btn btn-outline" id="install-app" hidden>📲 تثبيت الموقع</button><button class="btn btn-outline" id="open-register">تسجيل مستخدم جديد</button><button class="btn btn-primary login-open" id="open-login">تسجيل الدخول</button></div></header>
<section class="landing-hero"><div class="hero-copy"><span class="eyebrow">Mantiqati X</span><h1>منصة واحدة تربطك <span>بالخدمات والفرص المناسبة</span></h1><p>منصة تسويق وربط تجمع العملاء بمقدمي الخدمات، وتمنح كل مجال نظامًا مستقلًا للباقات والطلبات والترشيحات والعمولات.</p><div class="hero-actions"><button class="btn btn-primary" id="start">استكشف المجالات</button><button class="btn btn-outline" id="provider">انضم كمقدم خدمة</button></div><div class="trust-row"><span>✓ مجالات متعددة</span><span>✓ باقات مرنة</span><span>✓ ترشيحات حسب المجال</span></div></div><div class="landing-panel"><div class="panel-top"><b>لوحة MantiqatiX</b><span>● جاهزة للتوسع</span></div><div class="panel-stat"><small>مجالات رئيسية</small><strong>${sectors.length}</strong></div><div class="panel-grid"><div>🩺<b>أطباء</b></div><div>💊<b>صيدليات</b></div><div>🧪<b>تحاليل وأشعة</b></div><div>🏥<b>مستشفيات</b></div><div>🍽️<b>مطاعم</b></div><div>💼<b>أعمال</b></div></div></div></section>
<section class="landing-section" id="services"><div class="section-head"><div><h2>ماذا تقدم MantiqatiX؟</h2><p>منظومة تسويقية وربط للخدمات قابلة للتوسع حسب طبيعة كل نشاط.</p></div></div><div class="feature-grid"><article><span class="feature-icon">🔗</span><b>ربط مباشر</b><p>نساعد العميل على اكتشاف مقدم الخدمة المناسب، بينما تتم المعاملة المالية مباشرة بين الطرفين.</p></article><article><span class="feature-icon">💳</span><b>نماذج ربح مرنة</b><p>نظام مجاني، عمولة على العمليات المؤهلة، وباقات احترافية تختلف حسب قوة وطبيعة كل مجال.</p></article><article><span class="feature-icon">📣</span><b>تسويق وإعلان</b><p>نظام تسويق للشركة نفسها، مع إمكانية الاستفادة من شركات التسويق والشركاء ومصادر العملاء.</p></article><article><span class="feature-icon">🎯</span><b>ترشيحات مناسبة</b><p>عرض مقدمي الخدمات وفق المجال والتخصص وطريقة الاستفادة من الخدمة.</p></article><article><span class="feature-icon">📊</span><b>تقارير ومؤشرات</b><p>متابعة الطلبات، النشاط، العمولات، الباقات، ومصادر العملاء من لوحة موحدة.</p></article><article><span class="feature-icon">🧩</span><b>موديولات مستقلة</b><p>يمكن تشغيل الموديولات وإتاحتها حسب المجال والاشتراك والصلاحيات دون التأثير على باقي النظام.</p></article></div></section>
<section class="landing-section soft" id="sectors"><div class="section-head"><div><h2>مجالات المنصة</h2><p>كل مجال له خدمات ومسارات عمل وباقات مناسبة لطبيعته.</p></div><button class="section-link" id="all-sectors">عرض كل المجالات</button></div><div class="sector-grid">${sectors.map(s=>`<article class="sector-card"><div class="sector-icon">${s[0]}</div><h3>${s[1]}</h3><p>${s[2]}</p><button>استكشف المجال ←</button></article>`).join('')}</div></section>
<section class="landing-section" id="audiences"><div class="section-head"><div><h2>مصمم لكل طرف</h2><p>تجربة مختلفة حسب دور المستخدم داخل المنصة.</p></div></div><div class="audience-grid"><article><span>👤</span><h3>العميل</h3><p>اكتشاف الخدمات، مقارنة الخيارات، إرسال الطلبات والوصول لمقدم الخدمة المناسب.</p></article><article><span>🏢</span><h3>مقدم الخدمة</h3><p>ملف مهني، باقات، خدمات، استقبال العملاء والطلبات، وفرص تسويقية.</p></article><article><span>📣</span><h3>شركة التسويق</h3><p>مصادر عملاء وحملات وشراكات وتسويق للخدمات وفق نظام المنصة.</p></article><article><span>🤝</span><h3>الشريك</h3><p>مسارات شراكة وإحالة واستفادة من شبكة الخدمات والفرص المتاحة.</p></article></div></section>
<section class="landing-section soft" id="plans"><div class="section-head"><div><h2>نظام الباقات والعمولات</h2><p>النموذج الأساسي للمنصة قابل للتخصيص لكل قطاع.</p></div></div><div class="plans-grid"><article class="plan"><span>الأساسي</span><h3>مجاني</h3><p>وجود أساسي داخل المنصة والوصول إلى الخدمات المتاحة في المجال.</p><ul><li>ملف أساسي</li><li>ظهور داخل المجال</li><li>إدارة بيانات النشاط</li></ul><button class="btn btn-outline">اعرف المزيد</button></article><article class="plan featured"><span>العمولة</span><h3>حسب الاستخدام</h3><p>رسوم أو عمولة على العمليات أو الإضافات المؤهلة وفق طبيعة النشاط.</p><ul><li>مرونة في التكلفة</li><li>قياس العمليات</li><li>مناسب للنمو</li></ul><button class="btn btn-primary" id="commission-login">ابدأ الآن</button></article><article class="plan"><span>احترافي</span><h3>3 مستويات</h3><p>ثلاث باقات احترافية يمكن تخصيص مزاياها حسب قوة كل مجال وطريقة الاستفادة.</p><ul><li>مزايا إضافية</li><li>تسويق وظهور أكبر</li><li>تقارير متقدمة</li></ul><button class="btn btn-outline">اطلب التفاصيل</button></article></div></section>
<section class="landing-section" id="how"><div class="section-head"><div><h2>كيف تعمل المنصة؟</h2><p>مسار واضح من البحث إلى التواصل والمتابعة.</p></div></div><div class="steps"><div><b>01</b><h3>اكتشف</h3><p>اختر المجال والخدمة المناسبة.</p></div><div><b>02</b><h3>قارن</h3><p>راجع مقدمي الخدمة والباقات المتاحة.</p></div><div><b>03</b><h3>اطلب</h3><p>أرسل طلبك أو تواصل مع مقدم الخدمة.</p></div><div><b>04</b><h3>تابع</h3><p>تابع الطلب والنتائج من حسابك.</p></div></div></section>
<section class="landing-section soft" id="faq"><div class="section-head"><div><h2>أسئلة شائعة</h2><p>إجابات مختصرة عن طريقة عمل MantiqatiX.</p></div></div><div class="faq-grid"><details><summary>هل MantiqatiX تنفذ الخدمة بنفسها؟</summary><p>المنصة وسيط تسويقي وربط؛ التنفيذ والمعاملة المالية تكون مباشرة بين العميل ومقدم الخدمة.</p></details><details><summary>هل كل المجالات لها نفس الباقة؟</summary><p>لا. يمكن تخصيص الخدمات والباقات وطريقة الاستفادة حسب طبيعة وقوة كل مجال.</p></details><details><summary>هل يمكن لمقدم الخدمة البدء مجانًا؟</summary><p>يوجد نموذج مجاني أساسي، مع إمكانية الانتقال إلى العمولة أو الباقات الاحترافية حسب المجال.</p></details><details><summary>هل يمكن للشركات التسويقية الانضمام؟</summary><p>نعم، المنصة تتضمن مسارًا للتسويق والإعلان والشراكات ومصادر العملاء.</p></details></div></section>
<section class="landing-cta"><span class="eyebrow">MANTIQATIX</span><h2>ابدأ من احتياجك</h2><p>عميل يبحث عن خدمة، أو مقدم خدمة يريد عملاء، أو شركة تريد شراكة وتسويقًا أقوى.</p><div class="cta-actions"><button class="btn btn-light" id="cta-login">الدخول إلى المنصة</button><button class="btn btn-ghost" id="cta-provider">الانضمام كمقدم خدمة</button></div></section>
<footer id="contact"><div><div class="brand">${mark()}<span>Mantiqati X</span></div><p>منصة تسويق وربط الخدمات والفرص.</p></div><div class="footer-links"><a href="#services">الخدمات</a><a href="#sectors">المجالات</a><a href="#plans">الباقات</a><a href="#faq">الأسئلة</a></div><div><b>خدمة العملاء</b><p>01010171770</p></div></footer>
</main>`;
document.getElementById('open-login').onclick=()=>authView();document.getElementById('open-register').onclick=()=>authView('',false,'','register');document.getElementById('install-app').onclick=installApp;setupInstallPrompt();document.getElementById('cta-login').onclick=()=>authView();document.getElementById('commission-login').onclick=()=>authView();document.getElementById('provider').onclick=()=>authView('',false,'','register');document.getElementById('cta-provider').onclick=()=>authView('',false,'','register');
document.getElementById('start').onclick=()=>document.getElementById('sectors').scrollIntoView({behavior:'smooth'});
document.getElementById('all-sectors').onclick=()=>{authView()};
}

function filtered(list){const q=query.trim().toLowerCase();return q?list.filter(x=>x.join(' ').toLowerCase().includes(q)):list}
function modulePage(){const list=filtered(domainModules.map(m=>[m.icon,m.name,m.desc]));return `<div class="section-head"><div><h2>مركز الموديولات</h2><p>تحكم في الوحدات التي تظهر للمنصة والمشتركين.</p></div><span class="count">${list.length} وحدات</span></div><div class="modules">${list.map(m=>`<article class="card module" onclick="selectModule('${m[1]}')"><div class="icon">${m[0]}</div><h3>${m[1]}</h3><div class="muted">${m[2]}</div><span class="status">${canManage()?'إدارة متاحة':'متاح للعرض'}</span></article>`).join('')}</div>`}
function sectorsPage(){const list=filtered(sectors);return `<div class="section-head"><div><h2>المجالات والخدمات</h2><p>كل مجال له دورة عمل وباقات وعمولة وترشيحات مناسبة لطبيعته.</p></div></div><div class="modules">${list.map(s=>`<article class="card module"><div class="icon">${s[0]}</div><h3>${s[1]}</h3><div class="muted">${s[2]}</div><div class="mini-actions"><button>فتح المجال</button><button>الباقات</button></div></article>`).join('')}</div>`}
function genericPage(title,desc,items){return `<div class="section-head"><div><h2>${title}</h2><p>${desc}</p></div></div><div class="grid3">${items.map(x=>`<div class="card"><div class="row"><strong>${x[0]}</strong><span class="dot"></span></div><p class="muted">${x[1]}</p><button class="linkbtn">عرض التفاصيل ←</button></div>`).join('')}</div>`}
function dashboard(){const visibleModules=modules.filter(m=>moduleEnabled(m[1]));return `<section class="hero"><div><span class="eyebrow">Mantiqati X</span><h2>منصة تسويق وربط الخدمات المحلية</h2><p>وسيط تسويقي يربط العميل بمقدم الخدمة، مع باقات وعمولات ومسارات مستقلة لكل مجال.</p><div class="hero-actions"><button class="btn btn-light" onclick="selectModule('المجالات والخدمات')">استكشف المجالات</button><button class="btn btn-ghost" onclick="selectModule('الموديولات')">إدارة الموديولات</button></div></div></section><section class="cards"><div class="card"><div class="muted">حالة المنصة</div><div class="kpi">نشطة</div><small>Web + Supabase</small></div><div class="card"><div class="muted">المجالات</div><div class="kpi">${sectors.length}</div><small>قطاعات قابلة للتوسع</small></div><div class="card"><div class="muted">الموديولات</div><div class="kpi">${visibleModules.length}</div><small>الموديولات المفعلة</small></div><div class="card"><div class="muted">خدمة العملاء</div><div class="kpi phone">01010171770</div><small>الدعم والتواصل</small></div></section><div class="section-head"><div><h2>الوصول السريع</h2><p>أهم أجزاء المنصة.</p></div></div><div class="modules">${filtered(visibleModules).slice(0,6).map(m=>`<article class="card module" onclick="selectModule('${m[1]}')"><div class="icon">${m[0]}</div><h3>${m[1]}</h3><div class="muted">${m[2]}</div></article>`).join('')}</div>`}
function smmModulePage(){return `<div class="section-head"><div><h2>خدمات التسويق الرقمي SMM</h2><p>موديول MANTIQATIX لإدارة الخدمات الرقمية والطلبات والموردين من نفس الحساب.</p></div><span class="count">Module / SMM</span></div><div class="embedded-module"><iframe src="smm.html" title="MANTIQATIX SMM Module" loading="lazy"></iframe></div>`}
function pageContent(){switch(current){case'الرئيسية':return dashboard();case'الموديولات':return modulePage();case'خدمات التسويق الرقمي SMM':return smmModulePage();case'المجالات والخدمات':return sectorsPage();case'المستخدمون':return genericPage('المستخدمون','إدارة العملاء ومقدمي الخدمة والموظفين.',[['العملاء','ملفات العملاء وتاريخ الطلبات'],['مقدمو الخدمة','الملفات والاعتماد والباقات'],['الموظفون','الأدوار والصلاحيات']]);case'الطلبات':return genericPage('الطلبات','متابعة الطلبات والحجوزات ومسارات الإحالة.',[['طلبات جديدة','طلبات تحتاج مراجعة'],['قيد المتابعة','طلبات مرتبطة بمقدم خدمة'],['مكتملة','سجل الطلبات المكتملة']]);case'التسويق والإعلان':return genericPage('التسويق والإعلان','نظام التسويق الخاص بالشركة مع إمكانية التعاون مع شركات تسويق أخرى.',[['حملات MantiqatiX','حملات جذب العملاء'],['شركات التسويق','إدارة الشركاء ومصادر العملاء'],['الإعلانات','الحملات والإعلانات الممولة']]);case'العمولات والباقات':return genericPage('العمولات والباقات','نماذج مجانية، عمولة بيع، وباقات احترافية تختلف حسب المجال.',[['الباقة المجانية','وجود أساسي داخل المنصة'],['نظام العمولة','عمولة على العمليات/الإضافات المؤهلة'],['الباقات الاحترافية','3 مستويات قابلة للتخصيص حسب المجال']]);case'التقارير':return genericPage('التقارير','لوحة مؤشرات للإدارة والأداء.',[['الأداء','نشاط المنصة ومقدمي الخدمة'],['الإيرادات','العمولات والباقات'],['التحويلات','مصادر العملاء والطلبات']]);case'الدعم':return genericPage('الدعم','خدمة العملاء والتذاكر والشكاوى.',[['تذاكر مفتوحة','المتابعات الحالية'],['الشكاوى','الملاحظات والحالات'],['مركز المساعدة','الأسئلة والإرشادات']]);default:return genericPage('الإعدادات','إدارة الحساب والمنصة.',[['الحساب','بيانات الحساب وتسجيل الدخول'],['الصلاحيات','الأدوار والوصول'],['إعدادات المنصة','الهوية والإعدادات العامة']])}}
const moduleAliases={'الرئيسية':['HOME','DASHBOARD'],'الموديولات':['MODULES'],'المجالات والخدمات':['SECTORS','SERVICES'],'التجارة والأزياء':['FASHION','RETAIL'],'البقالة والسوبر ماركت':['GROCERY'],'المطاعم والمطابخ':['RESTAURANTS'],'المنظومة الطبية':['MEDICAL','HEALTH'],'الصيانة':['MAINTENANCE'],'الخدمات المهنية':['PROFESSIONAL','ERP'],'MantiGO والمزايدات':['MANTIGO','REVERSE_BIDDING'],'الزواج':['MATRIMONY'],'الوظائف':['JOBS'],'التعليم':['EDUCATION'],'المستعمل':['USED_ITEMS'],'التسويق والإعلان':['MARKETING','ADVERTISING'],'خدمات التسويق الرقمي SMM':['SMM'],'المستخدمون وCRM':['CRM','USERS'],'الطلبات والعمليات':['ORDERS','OPERATIONS'],'العمولات والباقات':['FINANCE','COMMISSIONS'],'التقارير والتحليلات':['ANALYTICS','REPORTS'],'الدعم والحوكمة':['GOVERNANCE','SUPPORT'],'الإعدادات':['SETTINGS']};
function normCode(v){return String(v||'').trim().toUpperCase().replace(/[\\s-]+/g,'_')}
function moduleFlagKeys(name){return [normCode(name)].concat((moduleAliases[name]||[]).map(normCode))}
function moduleEnabled(name){for(const key of moduleFlagKeys(name)){for(const feature of ['MODULE_ENABLED','ENABLED','VISIBILITY']){const flag=live.flags[key+':'+feature];if(flag)return flag.enabled!==false}}return true}
function featureEnabled(moduleCode,featureCode){const a=live.flags[normCode(moduleCode)+':'+normCode(featureCode)];const b=live.flags[':'+normCode(featureCode)];return a?.enabled===true||b?.enabled===true}
function canManage(){return ['ADMIN','OWNER','MANAGER'].includes(live.role)}
function selectModule(name){if(name!=='ملف نشاطي'&&!moduleEnabled(name)){showToast('هذه الوحدة غير مفعلة لهذا النطاق.','error');return}current=name;query='';renderApp()}
function providerImageUrl(path,version='1'){if(!path)return '';try{const url=sb.storage.from('mantiqatix-profile-media').getPublicUrl(path)?.data?.publicUrl||'';return url?(url+'?v='+encodeURIComponent(version)) : ''}catch(_){return ''}}
async function prepareProviderImage(file){if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('اختر صورة JPG أو PNG أو WebP.');if(file.size>5*1024*1024)throw new Error('حجم الصورة يجب ألا يتجاوز 5MB.');return new Promise((resolve,reject)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{try{const max=1600,scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{URL.revokeObjectURL(url);if(!blob)return reject(new Error('تعذر تجهيز الصورة.'));resolve(blob)},'image/webp',.86)}catch(e){URL.revokeObjectURL(url);reject(e)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('تعذر قراءة الصورة.'))};img.src=url})}
async function saveProviderProfileImage(){if(!user?.id||!live.myProviderProfile)return authView();const input=document.getElementById('provider-image-file');const file=input?.files?.[0];if(!file)return showToast('اختر صورة النشاط أولًا.','error');const btn=document.getElementById('provider-image-save');if(btn){btn.disabled=true;btn.textContent='جارٍ رفع الصورة...'}try{const blob=await prepareProviderImage(file);const path='users/'+user.id+'/providers/'+live.myProviderProfile.id+'/cover.webp';const upload=await sb.storage.from('mantiqatix-profile-media').upload(path,blob,{contentType:'image/webp',upsert:true,cacheControl:'31536000'});if(upload.error)throw upload.error;const {data,error}=await sb.from('marketing_provider_profiles').update({profile_image_path:path,updated_at:new Date().toISOString()}).eq('id',live.myProviderProfile.id).eq('owner_user_id',user.id).select('id,profile_image_path').single();if(error)throw error;live.myProviderProfile.profile_image_path=data.profile_image_path;showToast('تم تحديث صورة النشاط بنجاح.','success');renderApp()}catch(e){if(btn){btn.disabled=false;btn.textContent='حفظ صورة النشاط'}showToast('تعذر تحديث صورة النشاط: '+(e?.message||'خطأ غير معروف'),'error')}}
function providerProfileWorkspace(){const p=live.myProviderProfile;if(!p)return workspaceHead('PROFILE','ملف نشاطي','لا يوجد ملف نشاط مرتبط بالحساب الحالي.','NOT FOUND')+'<div class="empty-state">سجل نشاطك كمقدم خدمة أولًا ليظهر هنا.</div>';const image=providerImageUrl(p.profile_image_path,p.updated_at);return workspaceHead('MY ACTIVITY','ملف نشاطي','إدارة الصورة العامة للنشاط. الصورة التي ترفعها هنا تظهر في الكتالوج العام بعد تحديث الملف.','OWNER')+'<section class="card provider-profile-editor"><div class="row"><div><h3>'+esc(p.name_ar||p.name_en||'نشاطي')+'</h3><p class="muted">'+esc(p.provider_kind||'مقدم خدمة')+' · '+(p.is_verified?'موثق':'قيد التحقق')+'</p></div>'+(image?'<img class="provider-profile-preview" src="'+esc(image)+'" alt="صورة النشاط">':'<div class="provider-profile-preview provider-profile-preview--empty">صورة افتراضية</div>')+'</div><div class="field"><label>صورة النشاط</label><input id="provider-image-file" type="file" accept="image/jpeg,image/png,image/webp"><small class="muted">JPG / PNG / WebP · حتى 5MB · يتم تجهيزها كـWebP قبل الحفظ.</small><div id="provider-image-preview" class="provider-image-preview-note" aria-live="polite">اختر صورة لمعاينتها قبل الحفظ.</div></div><div class="action-bar"><button class="btn btn-primary" id="provider-image-save" style="width:auto">حفظ صورة النشاط</button></div></section>'}


function domainModuleWorkspace(){const m=domainModules.find(x=>x.name===current);if(!m)return modulePage();const d=live.moduleData[m.key]||{tables:{},ready:false};const cards=m.tables.map(t=>[t,d.tables?.[t]==null?'—':String(d.tables[t]),'عدد السجلات المتاحة وفق RLS']);if(!m.tables.length)cards.push(['حالة المخطط','NOT VERIFIED','لا يوجد جدول طبي متخصص مثبت في المخطط الحالي']);return workspaceHead(m.key,m.name,m.desc,'MODULE')+workspaceCards(cards)+'<div class="action-bar"><button class="btn btn-outline" style="width:auto" onclick="selectModule(\'الموديولات\')">← العودة للموديولات</button></div>'+recordsTable('مصادر البيانات الموصولة',m.tables.map(t=>({table:t,count:d.tables?.[t]})),[['الجدول',r=>r.table],['السجلات',r=>r.count==null?'—':r.count],['الحالة',r=>r.count==null?'NOT VERIFIED':'READABLE']])}
function enhancedPageContent(){
 if(current==='طلبات التسجيل')return registrationReviewWorkspace();
 if(domainModules.some(m=>m.name===current))return domainModuleWorkspace();
 switch(current){
  case 'التسويق والإعلان': return marketingWorkspace();
  case 'المستخدمون وCRM': return crmWorkspace();
  case 'الطلبات والعمليات': return ordersWorkspace();
  case 'ملف نشاطي': return providerProfileWorkspace();
  case 'التقارير والتحليلات': return analyticsWorkspace();
  case 'العمولات والباقات': return financeWorkspace();
  case 'الدعم والحوكمة': return governanceWorkspace();
  default: return pageContent();
 }
}
function recordsTable(title,rows,columns){const data=Array.isArray(rows)?rows:[];const cols=Array.isArray(columns)?columns:[];if(!data.length)return '<section class="records"><div class="section-head"><div><h3>'+esc(title)+'</h3><p class="muted">لا توجد بيانات فعلية متاحة حاليًا وفق الصلاحيات.</p></div></div><div class="empty-state">لا توجد سجلات للعرض</div></section>';return '<section class="records"><div class="section-head"><div><h3>'+esc(title)+'</h3><p class="muted">'+data.length+' سجل معروض</p></div></div><div class="table-wrap"><table><thead><tr>'+cols.map(c=>'<th>'+esc(c[0])+'</th>').join('')+'</tr></thead><tbody>'+data.map(r=>'<tr>'+cols.map(c=>'<td>'+esc(c[1](r)??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>'}
function workspaceHead(kicker,title,desc,badge){return '<div class="section-head"><div><span class="eyebrow">'+kicker+'</span><h2>'+title+'</h2><p>'+desc+'</p></div>'+(badge?'<span class="count">'+badge+'</span>':'')+'</div>'}
function workspaceCards(items){return '<div class="grid3">'+items.map(x=>'<article class="card"><div class="row"><strong>'+x[0]+'</strong><span class="dot"></span></div><div class="kpi" style="font-size:24px">'+x[1]+'</div><p class="muted">'+x[2]+'</p><button class="linkbtn">فتح التفاصيل ←</button></article>').join('')+'</div>'}
async function createMarketingLead(){if(!user?.id)return authView();const title=window.prompt('عنوان احتياج التسويق');if(!title?.trim())return;const description=window.prompt('وصف الاحتياج والخدمة المطلوبة');if(!description?.trim())return;const {data,error}=await sb.from('marketing_leads').insert({requester_user_id:user.id,requester_business_id:live.businessId||null,title:title.trim(),description:description.trim(),currency:'EGP',status:'NEW',source:'WEB'}).select('id').single();if(error)return showToast('تعذر إنشاء طلب التسويق: '+error.message,'error');live.counts.leads=(live.counts.leads||0)+1;showToast('تم إنشاء طلب التسويق'+(data?.id?' #'+data.id:''),'success');renderApp()}
function marketingWorkspace(){return workspaceHead('MANTIQATIX MARKETING','مركز التسويق والإعلان','إدارة الحملات، شركات التسويق، الإعلانات ومصادر العملاء من البيانات الفعلية.','MARKETING')+workspaceCards([['المشروعات',countOrDash('projects'),'مشروعات التسويق المرئية وفق RLS'],['العملاء المحتملون',countOrDash('leads'),'طلبات التسويق الفعلية'],['الإعلانات',countOrDash('ads'),'إعلانات مرئية وفق RLS'],['شركات التسويق',countOrDash('providers'),'ملفات مقدمي التسويق'],['الخدمات',live.records.services.length,'الخدمات التسويقية النشطة'],['التقارير','—','لا يتم عرض رقم غير محسوب فعلياً']])+'<div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="createMarketingLead()">+ إنشاء طلب تسويقي</button></div>'+recordsTable('طلبات التسويق',live.records.leads,[['العنوان',r=>r.title||'—'],['الحالة',r=>r.status||'—'],['المصدر',r=>r.source||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—']])+recordsTable('الإعلانات',live.records.ads,[['العنوان',r=>r.title||'—'],['الحالة',r=>r.status||'—'],['الموافقة',r=>r.approval_status||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—']])+recordsTable('المشروعات',live.records.projects,[['النوع',r=>r.project_type||'—'],['الحالة',r=>r.status||'—'],['القيمة',r=>r.gross_value!=null?(r.gross_value+' '+(r.currency||'')):'—'],['العمولة',r=>r.platform_commission!=null?(r.platform_commission+' '+(r.currency||'')):'—']])+recordsTable('الخدمات التسويقية النشطة',live.records.services,[['الخدمة',r=>r.name_ar||r.name_en||'—'],['الكود',r=>r.code||'—'],['الفئة',r=>r.category_code||'—'],['الحالة',r=>r.status||'—']])}
async function openLeadDetails(leadId){
 if(!user?.id||!leadId)return authView();
 const lead=live.records.leads.find(x=>x.id===leadId);
 if(!lead)return showToast('الطلب غير متاح وفق الصلاحيات الحالية.','error');
 const {data,error}=await sb.from('marketing_leads').select('id,title,description,budget_min,budget_max,currency,required_services,service_area,status,source,assigned_provider_id,created_at,updated_at').eq('id',leadId).eq('requester_user_id',user.id).maybeSingle();
 if(error)return showToast('تعذر تحميل تفاصيل الطلب: '+error.message,'error');
 if(!data)return showToast('الطلب غير متاح وفق الصلاحيات الحالية.','error');
 const overlay=document.createElement('div');overlay.className='mx-modal';
 const services=Array.isArray(data.required_services)?data.required_services.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('، '):(data.required_services?JSON.stringify(data.required_services):'—');
 const budget=data.budget_min!=null||data.budget_max!=null?((data.budget_min??'—')+' — '+(data.budget_max??'—')+' '+(data.currency||'')):'—';
 overlay.innerHTML='<div class="mx-modal-card"><div class="section-head"><div><span class="eyebrow">CRM LEAD</span><h2>'+esc(data.title||'طلب تسويق')+'</h2><p>'+esc(data.description||'—')+'</p></div><button class="text-btn" id="close-lead">إغلاق</button></div><div class="ticket-thread"><article class="card"><div class="row"><b>الحالة</b><span>'+esc(data.status||'—')+'</span></div><div class="row"><b>المصدر</b><span>'+esc(data.source||'—')+'</span></div><div class="row"><b>الميزانية</b><span>'+esc(budget)+'</span></div><div class="row"><b>منطقة الخدمة</b><span>'+esc(data.service_area||'—')+'</span></div><div class="row"><b>الخدمات المطلوبة</b><span>'+esc(services)+'</span></div><div class="row"><b>المقدم المعين</b><span>'+esc(data.assigned_provider_id||'—')+'</span></div><div class="row"><b>آخر تحديث</b><span>'+esc(data.updated_at?new Date(data.updated_at).toLocaleString('ar-EG'):'—')+'</span></div></article></div></div>';
 document.body.appendChild(overlay);document.getElementById('close-lead').onclick=()=>overlay.remove();
}
function crmWorkspace(){return workspaceHead('CRM','المستخدمون وإدارة العلاقات','إدارة العملاء ومقدمي الخدمة والمتابعة والاحتفاظ من مساحة واحدة.','CRM')+workspaceCards([['العملاء',live.role==='CUSTOMER'?'1':'—','هوية الحساب الحالية'],['Leads',countOrDash('leads'),'بيانات العملاء المحتملين المتاحة وفق RLS'],['مقدمو الخدمة',countOrDash('providers'),'ملفات مقدمي الخدمة المتاحة وفق RLS'],['الطلبات',countOrDash('orders'),'الطلبات المتاحة للحساب وفق RLS'],['الإشعارات',countOrDash('notifications'),'آخر الإشعارات المتاحة للحساب'],['معدّل التحويل','—','يُحسب لاحقاً من أحداث CRM الفعلية']])+recordsTable('آخر العملاء المحتملين',live.records.leads,[['العنوان',r=>r.title||'—'],['الحالة',r=>r.status||'—'],['المصدر',r=>r.source||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—']])+recordsTable('مقدمو الخدمة',live.records.providers,[['الاسم',r=>r.name_ar||'—'],['النوع',r=>r.provider_kind||'—'],['الحالة',r=>r.status||'—'],['موثق',r=>r.is_verified?'نعم':'لا']])}
function ordersWorkspace(){return workspaceHead('ORDERS','الطلبات والعمليات','متابعة الطلبات التي يسمح نطاق الحساب برؤيتها، دون تجاوز الصلاحيات المالية.','ORDERS')+workspaceCards([['الطلبات',countOrDash('orders'),'بيانات فعلية وفق RLS'],['الإشعارات',countOrDash('notifications'),'تحديثات تشغيلية مرتبطة بالحساب'],['الحالات','سجل فعلي','يُعرض تاريخ الحالة عند فتح الطلب'],['المالية','محكومة','لا يتم تعديل القيود المالية من هذه الواجهة']])+recordsTable('آخر الطلبات',live.records.orders,[['العميل',r=>r.customer_name||'—'],['الحالة',r=>r.status||'—'],['الإجمالي',r=>r.total_amount!=null?(r.total_amount+' '+(r.currency||'')):'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—']])+recordsTable('سجل حالات الطلبات',live.records.orderHistory,[['الطلب',r=>r.order_id||'—'],['من',r=>r.old_status||'—'],['إلى',r=>r.new_status||'—'],['السبب',r=>r.reason||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—']])}
function analyticsWorkspace(){return workspaceHead('ANALYTICS','التقارير والتحليلات','مؤشرات موحدة للأداء والتحويلات والإيرادات والمخاطر.','LIVE')+workspaceCards([['نشاط المنصة','—','يُحسب من مؤشرات التشغيل الفعلية عند توفرها'],['التحويلات','—','تُحسب من بيانات التحويل الفعلية عند توفرها'],['الإيرادات','—','يُعرض من البيانات المالية الفعلية عند توفرها'],['مصادر العملاء','—','تُعرض من مصادر الإحالة والتسويق الفعلية عند توفرها'],['الاستثناءات','—','تُعرض من سجل الحالات الفعلي عند توفره'],['التدقيق','سليم','سجل قابل للمراجعة والتتبع']])}
function financeWorkspace(){return workspaceHead('FINANCE','العمولات والباقات','نماذج مجانية وعمولات وباقات احترافية مع قابلية تخصيص حسب المجال.','FINANCE')+workspaceCards([['الباقة المجانية','أساسي','وجود أساسي داخل المنصة'],['نظام العمولة','Usage','عمولة على العمليات المؤهلة'],['احترافي — 1','مخصص','مزايا إضافية وظهور أكبر'],['احترافي — 2','مخصص','تسويق وتقارير متقدمة'],['احترافي — 3','مخصص','إدارة متقدمة للمجالات'],['التسويات','مراجعة','الربط مع النواة المالية الفعلية']])}

function canManageSupport(){return ['ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','SUPPORT','SUPPORT_MANAGER'].includes(String(live.role||'').toUpperCase())}
const SUPPORT_STATUSES=['OPEN','IN_PROGRESS','RESOLVED','CLOSED'];
async function updateTicketStatus(ticketId,status){
 if(!user?.id||!ticketId)return authView();
 if(!SUPPORT_STATUSES.includes(status))return showToast('حالة دعم غير معتمدة.','error');
 const ticket=live.records.supportTickets.find(x=>x.id===ticketId);
 if(!ticket)return showToast('التذكرة غير متاحة وفق الصلاحيات الحالية.','error');
 const payload={status,closed_at:status==='CLOSED'?new Date().toISOString():null,updated_at:new Date().toISOString()};
 const {error}=await sb.from('support_tickets').update(payload).eq('id',ticketId);
 if(error)return showToast('تعذر تحديث حالة التذكرة: '+error.message,'error');
 ticket.status=status;ticket.closed_at=payload.closed_at;ticket.updated_at=payload.updated_at;
 showToast('تم تحديث حالة التذكرة إلى '+status,'success');
 return true;
}
async function openTicketDetails(ticketId){
 if(!user?.id||!ticketId)return authView();
 const ticket=live.records.supportTickets.find(x=>x.id===ticketId);
 if(!ticket)return showToast('التذكرة غير متاحة وفق الصلاحيات الحالية.','error');
 const {data,error}=await sb.from('ticket_messages').select('id,sender_user_id,sender_role,content,created_at').eq('ticket_id',ticketId).order('created_at',{ascending:true});
 if(error)return showToast('تعذر تحميل رسائل التذكرة: '+error.message,'error');
 const messages=(data||[]).map(m=>'<article class="card"><div class="row"><b>'+esc(m.sender_role||'USER')+'</b><span>'+esc(m.created_at?new Date(m.created_at).toLocaleString('ar-EG'):'—')+'</span></div><p>'+esc(m.content)+'</p></article>').join('')||'<div class="muted">لا توجد رسائل بعد.</div>';
 const statusOptions=SUPPORT_STATUSES.map(s=>'<option value="'+s+'" '+(ticket.status===s?'selected':'')+'>'+s+'</option>').join('');
 const statusControl=canManageSupport()?'<label class="field"><span>تحديث الحالة</span><select id="ticket-status">'+statusOptions+'</select></label>':'<span>الحالة: <b>'+esc(ticket.status)+'</b></span>';
 const overlay=document.createElement('div'); overlay.className='mx-modal'; overlay.innerHTML='<div class="mx-modal-card"><div class="section-head"><div><span class="eyebrow">SUPPORT TICKET</span><h2>'+esc(ticket.subject)+'</h2><p>'+esc(ticket.description)+'</p></div><button class="text-btn" id="close-ticket">إغلاق</button></div><div class="row">'+statusControl+'<span>الأولوية: <b>'+esc(ticket.priority)+'</b></span></div><div class="ticket-thread">'+messages+'</div><div class="action-bar"><button class="btn btn-primary" id="ticket-reply">إضافة رد</button>'+(canManageSupport()?'<button class="btn btn-outline" id="ticket-save-status">حفظ الحالة</button>':'')+'</div></div>';
 document.body.appendChild(overlay);
 document.getElementById('close-ticket').onclick=()=>overlay.remove();
 document.getElementById('ticket-reply').onclick=async()=>{overlay.remove();await replyToTicket(ticketId)};
 if(canManageSupport())document.getElementById('ticket-save-status').onclick=async()=>{const next=document.getElementById('ticket-status').value;const ok=await updateTicketStatus(ticketId,next);if(ok){overlay.remove();await renderApp()}};
}
async function replyToTicket(ticketId){
 if(!user?.id||!ticketId)return authView();
 const content=window.prompt('اكتب ردك على التذكرة');
 if(!content?.trim())return;
 const id='MSG-'+Date.now().toString(36).toUpperCase();
 const {error}=await sb.from('ticket_messages').insert({id,ticket_id:ticketId,sender_user_id:user.id,sender_role:live.role,content:content.trim()});
 if(error)return showToast('تعذر إرسال الرد: '+error.message,'error');
 showToast('تم إرسال الرد.','success'); renderApp();
}
async function markNotificationRead(notificationId){
 if(!notificationId)return;
 const {error}=await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('id',notificationId).eq('user_id',user.id);
 if(error)return showToast('تعذر تحديث الإشعار.','error');
 const n=live.records.notifications.find(x=>x.id===notificationId); if(n)n.read_at=new Date().toISOString();
 showToast('تم تعليم الإشعار كمقروء.','success'); renderApp();
}
async function openSupportTicket(){
 if(!user?.id)return authView();
 const membership=live.memberships.find(m=>m.status==='ACTIVE'&&m.tenant_id);
 if(!membership){return showToast('لا توجد عضوية نشطة مرتبطة بمستأجر لإنشاء التذكرة.','error')}
 const subject=window.prompt('عنوان التذكرة'); if(!subject?.trim())return;
 const description=window.prompt('وصف المشكلة أو الطلب'); if(!description?.trim())return;
 const id='TKT-'+Date.now().toString(36).toUpperCase();
 const payload={id,tenant_id:membership.tenant_id,requester_id:user.id,business_id:membership.business_id||null,subject:subject.trim(),description:description.trim(),category:'GENERAL',priority:'NORMAL',status:'OPEN'};
 const {error}=await sb.from('support_tickets').insert(payload);
 if(error)return showToast('تعذر إنشاء التذكرة: '+error.message,'error');
 live.counts.support=(live.counts.support||0)+1; showToast('تم فتح التذكرة بنجاح. رقمها '+id,'success'); renderApp();
}
async function accountView(){
const membership=live.memberships.find(m=>m.status==='ACTIVE');
let request=null;
if(user?.id&&!membership){
 const {data}=await sb.from('account_registration_requests').select('id,requested_role,status,reason,created_at,reviewed_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
 request=data||null;
}
const statusText=membership?'نشطة':request?.status==='PENDING'?'قيد المراجعة':request?.status==='REJECTED'?'مرفوض — يمكنك إعادة الطلب':'لم يتم ربط عضوية تشغيلية بعد';
const requestBlock=membership
?'<p class="muted">يمكنك الآن استخدام مساحة المنصة وفق الدور والصلاحيات المرتبطة بعضويتك.</p>'
:request?.status==='PENDING'
?'<p class="muted">طلبك قيد مراجعة الإدارة. لن يتم منح أي صلاحيات تشغيلية قبل الاعتماد.</p>'
:request?.status==='REJECTED'
?'<p class="muted">يمكنك تقديم طلب جديد واختيار نوع العضوية المناسب.</p>'
:'<p class="muted">اختر نوع العضوية التي تناسب استخدامك للمنصة. إنشاء الطلب لا يمنح صلاحيات تشغيلية تلقائيًا.</p>';
const requestButtons=membership||request?.status==='PENDING'?'':('<div class="action-bar"><button class="btn btn-primary" id="request-customer">الانضمام كعميل</button><button class="btn btn-outline" id="request-provider">الانضمام كمقدم خدمة</button></div>');
document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card"><div class="brand">'+mark()+'<span>Mantiqati X</span></div><div class="gradient-line"></div><h1>حسابي</h1><p>الحساب: <b>'+esc(user?.email||'—')+'</b></p><p>حالة البريد: <b>تم التحقق</b></p><p>حالة العضوية: <b>'+statusText+'</b></p>'+requestBlock+requestButtons+'<div class="action-bar"><button class="btn btn-primary" id="account-home">العودة للرئيسية</button><button class="btn btn-outline" id="account-logout">تسجيل الخروج</button></div></section></main>';
document.getElementById('account-home').onclick=()=>{window.MXHomeLanding?MXHomeLanding():landingView()};
document.getElementById('account-logout').onclick=logout;
const submitRole=async role=>{authRegistrationType=role;await submitRegistrationRequest();};
document.getElementById('request-customer')?.addEventListener('click',()=>submitRole('CUSTOMER'));
document.getElementById('request-provider')?.addEventListener('click',()=>submitRole('SERVICE_PROVIDER'));
}
function membershipRequiredView(){
window.MNTYAuthState={authenticated:true,email:user?.email||'',membership:false};
if(typeof window.MXHomeLanding==='function'){window.MXHomeLanding();showToast('تم التحقق من الحساب. العضوية التشغيلية لم تُربط بعد.','success');return}
if(typeof landingView==='function'){landingView();showToast('تم التحقق من الحساب. العضوية التشغيلية لم تُربط بعد.','success');return}
accountView();
}
function showToast(message,type='success'){const old=document.getElementById('mx-toast');if(old)old.remove();const d=document.createElement('div');d.id='mx-toast';d.className='mx-toast '+type;d.textContent=message;document.body.appendChild(d);setTimeout(()=>d.remove(),4200)}
function governanceWorkspace(){return workspaceHead('GOVERNANCE','الدعم والحوكمة','التذاكر، الرسائل، الإشعارات والصلاحيات في مساحة تشغيلية موحدة.','CONTROL')+workspaceCards([['تذاكر الدعم',countOrDash('support'),'بيانات فعلية وفق RLS'],['الإشعارات',countOrDash('notifications'),'إشعارات الحساب الفعلية'],['الصلاحيات',live.role,'الدور الفعلي من العضوية'],['التدقيق','نشط','السجل الإداري عند توفره'],['المراقبة','نشطة','مؤشرات الأخطاء والتشغيل'],['السياسات','منشورة','السياسات المنشورة عند توفرها']])+ '<div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="openSupportTicket()">+ فتح تذكرة دعم</button></div>'+recordsTable('تذاكر الدعم',live.records.supportTickets,[['الموضوع',r=>r.subject||'—'],['الحالة',r=>r.status||'—'],['الأولوية',r=>r.priority||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—'],['إجراء',r=>'<button class="linkbtn" onclick="openTicketDetails(\''+esc(r.id)+'\')">تفاصيل</button>']])+recordsTable('آخر الإشعارات',live.records.notifications,[['العنوان',r=>r.title||'—'],['الحالة',r=>r.read_at?'مقروء':'جديد'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—'],['إجراء',r=>r.read_at?'—':'<button class="linkbtn" onclick="markNotificationRead(\''+esc(r.id)+'\')">تعليم كمقروء</button>']])}
async function reviewRegistration(requestId,decision){
 if(!user?.id||!requestId)return;
 if(!['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase()))return showToast('لا تملك صلاحية اعتماد التسجيلات.','error');
 let tenantId=live.memberships.find(m=>m.status==='ACTIVE'&&m.tenant_id)?.tenant_id||null;
 if(decision==='APPROVED'&&!tenantId)return showToast('لا يوجد نطاق Tenant نشط للاعتماد.','error');
 const options={body:{request_id:requestId,decision,tenant_id:tenantId}};
 const {data,error}=await sb.functions.invoke('mnty-registration-review',options);
 if(error)return showToast('تعذر تنفيذ الاعتماد: '+(error.message||'خطأ غير معروف'),'error');
 if(data?.error)return showToast('تعذر تنفيذ العملية: '+data.error,'error');
 showToast(decision==='APPROVED'?'تم اعتماد التسجيل وإنشاء العضوية.':'تم رفض طلب التسجيل.','success');
 await renderApp();
}
function registrationReviewWorkspace(){
 if(!['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase())){
   return workspaceHead('REGISTRATION','طلبات التسجيل','هذه المساحة مخصصة للإدارة المعتمدة.','RESTRICTED')+'<div class="empty-state">لا تملك صلاحية مراجعة طلبات التسجيل.</div>';
 }
 const rows=live.records.registrationRequests||[];
 return workspaceHead('REGISTRATION','طلبات التسجيل','اعتماد الحسابات يتم عبر سلطة الخادم مع إنشاء العضوية وتسجيل التدقيق.','ADMIN')
 +workspaceCards([['طلبات معلقة',rows.filter(r=>r.status==='PENDING').length,'طلبات تحتاج قرارًا إداريًا'],['معتمدة',rows.filter(r=>r.status==='APPROVED').length,'طلبات تم ربطها بعضوية'],['مرفوضة',rows.filter(r=>r.status==='REJECTED').length,'طلبات لم يتم اعتمادها']])
 +recordsTable('سجل التسجيلات',rows,[['الدور',r=>r.requested_role==='SERVICE_PROVIDER'?'مقدم خدمة':'عميل'],['الحالة',r=>r.status||'—'],['المستخدم',r=>r.user_id||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleString('ar-EG'):'—'],['إجراء',r=>r.status==='PENDING'?'<div class="mini-actions"><button onclick="reviewRegistration(\''+esc(r.id)+'\',\'APPROVED\')">اعتماد</button><button onclick="reviewRegistration(\''+esc(r.id)+'\',\'REJECTED\')">رفض</button></div>':'—']]);
}
function registrationPendingView(role='CUSTOMER',status='PENDING'){
const label=role==='SERVICE_PROVIDER'?'مقدم خدمة':'عميل';
document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card"><div class="brand">'+mark()+'<span>Mantiqati X</span></div><div class="gradient-line"></div><h1>تم إنشاء حسابك</h1><p>تم التحقق من بريدك الإلكتروني بنجاح.</p><p>طلب التسجيل كـ <b>'+esc(label)+'</b> في حالة <b>'+esc(status)+'</b>.</p><p class="muted">لن يتم منح أي صلاحيات تشغيلية تلقائيًا. بعد اعتماد الطلب سيتم ربط العضوية والصلاحيات بالحساب وفق سياسة المنصة.</p><div class="action-bar"><button class="btn btn-outline" id="registration-logout">تسجيل الخروج</button></div></section></main>';
document.getElementById('registration-logout').onclick=logout;
}
async function submitRegistrationRequest(){
if(!user?.id)return;
const {data:existing,error:existingError}=await sb.from('account_registration_requests').select('id,requested_role,status').eq('user_id',user.id).in('status',['PENDING','APPROVED']).order('created_at',{ascending:false}).limit(1).maybeSingle();
if(existingError){showToast('تعذر التحقق من طلب التسجيل: '+existingError.message,'error');return;}
if(existing?.status==='APPROVED'){await renderApp();return;}
if(existing?.status==='PENDING'){registrationPendingView(existing.requested_role,existing.status);return;}
const {data,error}=await sb.from('account_registration_requests').insert({user_id:user.id,requested_role:authRegistrationType,status:'PENDING',metadata:{source:'web',brand:'Mantiqati X'}}).select('requested_role,status').single();
if(error){showToast('تعذر إنشاء طلب التسجيل: '+error.message,'error');return;}
registrationPendingView(data.requested_role,data.status);
}
async function enterAuthenticatedApp(authUser){
if(!authUser?.id)return;
if(user?.id===authUser.id&&window.MNTYAuthState?.authenticated)return;
user=authUser;
window.MNTYAuthState={authenticated:true,email:authUser.email||'',membership:false};
if(authRenderLock)return;
authRenderLock=true;
try{await renderApp()}finally{authRenderLock=false}
}
async function bootAuth(){
if(authBooted)return;authBooted=true;
try{
const {data,error}=await sb.auth.getSession();
if(error)throw error;
if(data?.session){
const vr=await sb.auth.getUser();
if(vr.error)throw vr.error;
if(vr.data?.user){await enterAuthenticatedApp(vr.data.user);return}
}
window.MXHomeLanding?MXHomeLanding():landingView();
}catch(e){
user=null;
window.MXHomeLanding?MXHomeLanding():landingView();
showToast('تعذر تهيئة جلسة الدخول. أعد تحميل الصفحة.','error');
}
}
async function renderApp(){if(!user?.id)return;live.loading=true;document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card"><div class="brand">'+mark()+'<span>Mantiqati X</span></div><div class="gradient-line"></div><h1>جاري تحميل المنصة</h1><p>يتم التحقق من الجلسة وتحميل بيانات حسابك وصلاحياتك...</p></section></main>';await loadLiveData();if(live.error){document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card"><div class="brand">'+mark()+'<span>Mantiqati X</span></div><div class="gradient-line"></div><h1>تعذر تحميل البيانات</h1><p>'+esc(live.error)+'</p><button class="btn btn-primary" id="retry-load">إعادة المحاولة</button><button class="text-btn" id="logout-load">خروج</button></section></main>';document.getElementById('retry-load').onclick=renderApp;document.getElementById('logout-load').onclick=logout;return}if(!live.memberships.length){membershipRequiredView();return}window.MNTYAuthState={authenticated:true,email:user?.email||'',membership:true,role:live.role};await loadDomainModule(current);document.getElementById('app').innerHTML=`<div class="shell"><aside class="sidebar"><div class="side-brand"><div class="brand">${mark()}<span>Mantiqati X</span></div><div class="gradient-line"></div></div><div class="side-caption">منصة التسويق والربط</div><nav class="nav">${modules.filter(m=>moduleEnabled(m[1])&& (m[1]!=='طلبات التسجيل'||['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase()))).map(m=>`<button class="${m[1]===current?'active':''}" onclick="selectModule('${m[1]}')"><span>${m[0]}</span><span>${m[1]}</span></button>`).join('')}</nav><div class="side-support">خدمة العملاء<br><b>01010171770</b></div></aside><main class="content"><header class="top"><div><div class="breadcrumb">Mantiqati X / ${current}</div><h1>${current}</h1><div class="user" id="user">${esc(user?.email||'')} · ${esc(live.role)}</div></div><div class="top-actions">${roleSwitcher()}${live.myProviderProfile?'<button class="btn btn-outline" id="manage-provider-profile" style="width:auto">🖼️ صورة نشاطي</button>':''}<label class="search">⌕ <input id="search" value="${esc(query)}" placeholder="بحث داخل المنصة..."></label><button class="logout" id="logout">خروج</button></div></header><div id="page">${enhancedPageContent()}</div></main></div>`;document.getElementById('logout').onclick=logout;const roleSwitch=document.getElementById('mx-role-switcher');if(roleSwitch)roleSwitch.onchange=e=>switchMembership(e.target.value);const profileBtn=document.getElementById('manage-provider-profile');if(profileBtn)profileBtn.onclick=()=>selectModule('ملف نشاطي');const providerSave=document.getElementById('provider-image-save');if(providerSave)providerSave.onclick=saveProviderProfileImage;const providerFile=document.getElementById('provider-image-file');const providerPreview=document.getElementById('provider-image-preview');if(providerFile&&providerPreview)providerFile.onchange=()=>{const file=providerFile.files?.[0];if(!file){providerPreview.textContent='اختر صورة لمعاينتها قبل الحفظ.';return}if(!/^image\/(jpeg|png|webp)$/.test(file.type)){providerPreview.textContent='صيغة غير مدعومة. استخدم JPG أو PNG أو WebP.';return}if(file.size>5*1024*1024){providerPreview.textContent='الصورة أكبر من 5MB.';return}const url=URL.createObjectURL(file);providerPreview.innerHTML='<img src="'+esc(url)+'" alt="معاينة صورة النشاط">';providerPreview.querySelector('img')?.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true})};const si=document.getElementById('search');si.oninput=e=>{query=e.target.value;document.getElementById('page').innerHTML=enhancedPageContent()}}
sb.auth.onAuthStateChange((event,session)=>{
if(event==='SIGNED_OUT'){
user=null;window.MNTYAuthState={authenticated:false,email:'',membership:false};window.MNTYActiveMembershipId=null;live.memberships=[];live.activeMembershipId=null;live.role='CUSTOMER';live.businessId=null;live.tenantId=null;live.organizationId=null;live.branchId=null;live.permissions={};current='الرئيسية';query='';
window.MXHomeLanding?MXHomeLanding():landingView();return;
}
if(session?.user&&!authRenderLock)enterAuthenticatedApp(session.user);
});
window.addEventListener('DOMContentLoaded',bootAuth,{once:true});