const {createClient}=window.supabase;
const cfg=window.MANTIQATIX_CONFIG;
const sb=createClient(cfg.supabaseUrl,cfg.supabaseKey);

async function invokeMntyFunction(name,body){
 const {data:{session},error:sessionError}=await sb.auth.getSession();
 if(sessionError)throw sessionError;
 if(!session?.access_token)throw new Error('AUTH_REQUIRED');
 const res=await fetch(cfg.supabaseUrl+'/functions/v1/'+encodeURIComponent(name),{
  method:'POST',
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
  body:JSON.stringify(body||{})
 });
 let payload=null;
 try{payload=await res.json();}catch{}
 if(!res.ok)throw new Error(payload?.error||payload?.message||'FUNCTION_REQUEST_FAILED');
 return payload;
}

async function invokeMntyApi(path,options={}){
 const {data:{session},error:sessionError}=await sb.auth.getSession();
 if(sessionError)throw sessionError;
 if(!session?.access_token)throw new Error('AUTH_REQUIRED');
 const res=await fetch(cfg.supabaseUrl+'/functions/v1/api'+path,{
  method:options.method||'GET',
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,...(options.headers||{})},
  body:options.body?JSON.stringify(options.body):undefined
 });
 let payload=null;
 try{payload=await res.json();}catch{}
 if(!res.ok)throw new Error(payload?.error||payload?.message||'API_REQUEST_FAILED');
 return payload;
}
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
{key:'MEDICAL',name:'المنظومة الطبية',icon:'🩺',desc:'اكتشاف مقدمي الخدمة والحجز الطبي ومتابعة المواعيد.',tables:['marketing_provider_profiles','medical_appointments']},
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
const live={memberships:[],activeMembershipId:null,role:'CUSTOMER',businessId:null,tenantId:null,organizationId:null,branchId:null,permissions:{},counts:{},flags:{},records:{leads:[],providers:[],orders:[],notifications:[],orderHistory:[],supportTickets:[],ads:[],projects:[],services:[],providerServices:[],registrationRequests:[]},catalogByBusiness:{},moduleData:{},myProviderProfile:null,loading:false,error:null};
const countOrDash=key=>Object.prototype.hasOwnProperty.call(live.counts,key)?String(live.counts[key]):'—';
async function safeCount(table,column,value){try{let q=sb.from(table).select('*',{count:'exact',head:true});if(column&&value)q=q.eq(column,value);const {count,error}=await q;return error?null:(count??0)}catch(_){return null}}
async function loadLiveData(){
const uid=user?.id;
if(!uid)return;
live.loading=true;live.error=null;live.flags={};live.counts={};live.moduleData={};live.catalogByBusiness={};live.records.registrationRequests=[];live.records.providerServices=[];live.myProviderProfile=null;
try{
 const m=await sb.from('user_memberships').select('id,tenant_id,organization_id,business_id,branch_id,role,permissions,status').eq('user_id',uid).eq('status','ACTIVE');
 if(m.error)throw m.error;
 live.memberships=m.data||[];
 const savedId=window.MNTYActiveMembershipId||localStorage.getItem('MNTYActiveMembershipId');
 const active=live.memberships.find(m=>m.id===savedId)||live.memberships[0];
 if(active){window.MNTYActiveMembershipId=active.id;localStorage.setItem('MNTYActiveMembershipId',active.id);}
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
 if(live.myProviderProfile){const ps=await sb.from('marketing_provider_services').select('id,provider_id,service_id,service_description,pricing_from,pricing_to,currency,status,created_at').eq('provider_id',live.myProviderProfile.id).order('created_at',{ascending:false}).limit(50);if(ps.error)throw ps.error;live.records.providerServices=ps.data||[];}
 const orderRole=String(live.role||'').toUpperCase();
 const orderCountSpec=(orderRole==='SERVICE_PROVIDER'||orderRole==='BUSINESS_OWNER')&&live.businessId
   ? ['orders','business_id',live.businessId,'orders']
   : ['orders','customer_id',uid,'orders'];
 const specs=[['advertisements',null,null,'ads'],['marketing_projects',live.businessId?'client_business_id':null,live.businessId,'projects'],['notifications','user_id',uid,'notifications'],['support_tickets','requester_id',uid,'support'],['marketing_leads','requester_user_id',uid,'leads'],['marketing_provider_profiles','owner_user_id',uid,'providers'],orderCountSpec];
 if(live.businessId)specs.push(['businesses','id',live.businessId,'businesses']);
 const results=await Promise.all(specs.map(x=>safeCount(x[0],x[1],x[2])));
 specs.forEach((x,i)=>{if(results[i]!==null)live.counts[x[3]]=results[i]});
 const fq=sb.from('platform_feature_flags').select('module_code,feature_code,enabled,configuration');
 if(live.businessId)fq.or(`scope_type.eq.PLATFORM,business_id.eq.${live.businessId}`);else fq.eq('scope_type','PLATFORM');
 const fr=await fq;if(fr.error)throw fr.error;
 (fr.data||[]).forEach(x=>{live.flags[`${x.module_code||''}:${x.feature_code||''}`]=x});
 const [leadsRes,providersRes,ordersRes,notificationsRes,ticketsRes,adsRes,projectsRes,servicesRes]=await Promise.all([
  sb.from('marketing_leads').select('id,title,status,source,created_at').order('created_at',{ascending:false}).limit(10),
  sb.from('marketing_provider_profiles').select('id,business_id,name_ar,provider_kind,status,is_verified,created_at').order('created_at',{ascending:false}).limit(10),
  (()=>{const oq=sb.from('orders').select('id,tenant_id,status,total_amount,currency,customer_id,business_id,customer_name,created_at').order('created_at',{ascending:false}).limit(10);if(['SERVICE_PROVIDER','BUSINESS_OWNER'].includes(String(live.role||'').toUpperCase())&&live.businessId)oq.eq('business_id',live.businessId);else oq.eq('customer_id',uid);return oq})(),
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
 const role=roleLabel(m.role);
 const parts=[role];
 if(m.business_id)parts.push('النشاط: '+m.business_id);
 if(m.branch_id)parts.push('الفرع: '+m.branch_id);
 return parts.join(' · ');
}
function membershipOptionLabel(m){
 const role=String(m?.role||'').toUpperCase();
 const icons={OWNER:'👑',SUPER_ADMIN:'🛡️',ADMIN:'⚙️',MANAGER:'📊',BUSINESS_OWNER:'🏢',EMPLOYEE:'👤',STAFF:'👤',SUPPORT_MANAGER:'🎧',SUPPORT:'🎫',SERVICE_PROVIDER:'🧰',CUSTOMER:'👤'};
 const icon=icons[role]||'•';
 return icon+' '+roleLabel(role);
}
async function switchMembership(membershipId){
 const target=live.memberships.find(m=>m.id===membershipId&&m.status==='ACTIVE');
 if(!target)return showToast('الدور المطلوب غير متاح في هذا الحساب.','error');
 if(membershipId===live.activeMembershipId)return;
 const previous=live.memberships.find(m=>m.id===live.activeMembershipId&&m.status==='ACTIVE')||null;
 const selector=document.getElementById('mx-role-switcher');
 if(selector)selector.disabled=true;
 window.MNTYActiveMembershipId=membershipId;
 localStorage.setItem('MNTYActiveMembershipId',membershipId);
 live.activeMembershipId=membershipId;
 live.role=String(target.role||'CUSTOMER').toUpperCase();
 live.businessId=target.business_id||null;
 live.tenantId=target.tenant_id||null;
 live.organizationId=target.organization_id||null;
 live.branchId=target.branch_id||null;
 live.permissions=target.permissions||{};
 current='الرئيسية';
 query='';
 try{
   if(String(target.role||'').toUpperCase()==='CUSTOMER' && previous && ['SUPER_ADMIN','ADMIN','OWNER','MANAGER'].includes(String(previous.role||'').toUpperCase())){
     localStorage.setItem('MNTYAdminReturnMembershipId',previous.id);
     window.MNTYAdminReturnMembershipId=previous.id;
     window.MNTYAuthState={authenticated:true,email:user?.email||'',membership:true,role:'CUSTOMER'};
     if(typeof window.MXHomeLanding==='function'){
       window.MXHomeLanding();
       showToast('تم فتح الصفحة الرئيسية العامة بوضع العميل.','success');
       return;
     }
     if(typeof window.landingView==='function'){
       window.landingView();
       showToast('تم فتح الصفحة الرئيسية بوضع العميل.','success');
       return;
     }
     throw new Error('PUBLIC_HOME_NOT_LOADED');
   }else{
     localStorage.removeItem('MNTYAdminReturnMembershipId');
     window.MNTYAdminReturnMembershipId=null;
   }
   await renderApp();
   showToast('تم التبديل فعليًا إلى: '+roleContextLabel(target),'success');
 }catch(e){
   if(previous){
     window.MNTYActiveMembershipId=previous.id;
     localStorage.setItem('MNTYActiveMembershipId',previous.id);
     live.activeMembershipId=previous.id;
     live.role=String(previous.role||'CUSTOMER').toUpperCase();
     live.businessId=previous.business_id||null;
     live.tenantId=previous.tenant_id||null;
     live.organizationId=previous.organization_id||null;
     live.branchId=previous.branch_id||null;
     live.permissions=previous.permissions||{};
   }
   showToast('تعذر إكمال تبديل الدور وتمت استعادة الدور السابق: '+(e?.message||'خطأ غير معروف'),'error');
   await renderApp();
 }
}
function roleSwitcher(){
 if(!live.memberships.length)return '';
 const active=live.memberships.find(m=>m.id===live.activeMembershipId)||live.memberships[0];
 const seen=new Set();
 const options=live.memberships.filter(m=>m?.id&&m.status==='ACTIVE').filter(m=>{
   const key=[String(m.role||'').toUpperCase(),m.tenant_id||'',m.business_id||'',m.branch_id||''].join('|');
   if(seen.has(key))return false;
   seen.add(key);
   return true;
 }).map(m=>'<option value="'+esc(m.id)+'" '+(m.id===active?.id?'selected':'')+'>'+esc(membershipOptionLabel(m))+'</option>').join('');
 const tenant=active?.tenant_id?'<small class="role-context-tenant">النطاق: '+esc(active.tenant_id)+'</small>':'';
 return '<label class="role-switcher"><span>تبديل الدور</span><select id="mx-role-switcher" aria-label="تبديل الدور بين العضويات الفعلية">'+options+'</select>'+tenant+'</label>';
}
async function loadDomainModule(name){const m=domainModules.find(x=>x.name===name);if(!m)return;live.moduleData[m.key]={tables:{},ready:false};if(!m.tables.length){live.moduleData[m.key].ready=true;return}const out=await Promise.all(m.tables.map(async t=>{const count=await safeCount(t,null,null);return [t,count]}));out.forEach(([t,c])=>{live.moduleData[m.key].tables[t]=c});live.moduleData[m.key].ready=true}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mark=()=>'<span class="mark"></span>';
function authView(msg='',otpMode=false,emailValue='',mode=authIntent){
authIntent=mode||'login';
document.getElementById('app').innerHTML=otpMode
?`<main class="auth"><section class="auth-card"><div class="brand">${mark()}<span>Mantiqati X</span></div><div class="gradient-line"></div><h1>رمز الدخول</h1><p>أرسلنا رمز تحقق لمرة واحدة إلى <b>${esc(emailValue)}</b>. أدخل الرمز لإكمال الدخول.</p><div class="field"><label>رمز OTP</label><input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="أدخل رمز التحقق"></div><button class="btn btn-primary" id="verify">تحقق ودخول</button><div class="auth-secondary-actions"><button class="auth-link-btn" id="resend-otp" type="button">إرسال رمز جديد</button><button class="auth-link-btn" id="back-auth" type="button">تغيير البريد الإلكتروني</button></div>${msg?`<div class="msg">${esc(msg)}</div>`:''}</section></main>`
:`<main class="auth"><section class="auth-card"><div class="brand">${mark()}<span>Mantiqati X</span></div><div class="gradient-line"></div><h1>${authIntent==='register'?'تسجيل مستخدم جديد':'تسجيل الدخول'}</h1><p>${authIntent==='register'?'أنشئ حسابك باستخدام بريدك الإلكتروني. بعد التحقق يتم استكمال تفعيل العضوية وفق الصلاحيات المعتمدة.':'استخدم بريدك الإلكتروني للحصول على رمز تحقق لمرة واحدة. لا نستخدم كلمة مرور في مسار الإنتاج.'}</p>${authIntent==='register'?'<div class="field"><label>نوع الحساب</label><select id="registration-type"><option value="CUSTOMER">عميل</option><option value="SERVICE_PROVIDER">مقدم خدمة</option></select></div>':''}<div class="field"><label>البريد الإلكتروني</label><input id="email" type="email" autocomplete="email" placeholder="name@example.com"></div><button class="btn btn-primary" id="send-otp">${authIntent==='register'?'إرسال رمز التسجيل':'إرسال رمز الدخول'}</button><button class="auth-switch-btn" id="switch-auth" type="button">${authIntent==='register'?'لدي حساب بالفعل؟ تسجيل الدخول':'مستخدم جديد؟ إنشاء حساب'}</button>${msg?`<div class="msg">${esc(msg)}</div>`:''}</section></main>`;
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
if(!/^\S+@\S+\.\S+$/.test(email))return authView('أدخل بريدًا إلكترونيًا صحيحًا.');
const button=document.getElementById('send-otp')||document.getElementById('resend-otp');if(button){button.disabled=true;button.textContent='جارٍ إرسال الرمز...'}
if(authIntent==='register'){
 try{localStorage.setItem('MNTYPendingRegistration',JSON.stringify({email,role:authRegistrationType,createdAt:Date.now()}))}catch(_){}
}
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
user=data.user;
if(authIntent==='register'){
 try{localStorage.removeItem('MNTYPendingRegistration')}catch(_){}
 await submitRegistrationRequest();
 return;
}
await enterAuthenticatedApp(data.user);
}
async function logout(){await disableCurrentPushSubscription();const {error}=await sb.auth.signOut();if(error)return showToast('تعذر تسجيل الخروج: '+error.message,'error');user=null;window.MNTYAuthState={authenticated:false,email:'',membership:false};window.MNTYActiveMembershipId=null;localStorage.removeItem('MNTYActiveMembershipId');live.memberships=[];live.activeMembershipId=null;live.role='CUSTOMER';live.businessId=null;live.tenantId=null;live.organizationId=null;live.branchId=null;live.permissions={};live.counts={};live.flags={};live.moduleData={};live.records={leads:[],providers:[],orders:[],notifications:[],orderHistory:[],supportTickets:[],ads:[],projects:[],services:[],registrationRequests:[]};window.MXHomeLanding?MXHomeLanding():landingView()}
function setupInstallPrompt(){
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;const b=document.getElementById('install-app');if(b)b.hidden=false});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;const b=document.getElementById('install-app');if(b)b.hidden=true});
}
async function installApp(){if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;const b=document.getElementById('install-app');if(b)b.hidden=true}
function landingView(){
document.getElementById('app').innerHTML=`<main class="landing">
<header class="landing-nav"><div class="brand">${mark()}<span>Mantiqati X</span></div><nav><a href="smm.html">خدمات SMM</a><a href="#services">الخدمات</a><a href="#sectors">المجالات</a><a href="#audiences">لمن؟</a><a href="#plans">الباقات</a><a href="#how">كيف تعمل</a><a href="#faq">الأسئلة</a></nav><div style="display:flex;gap:8px;align-items:center"><button class="btn btn-outline" id="install-app" hidden>📲 تثبيت الموقع</button><button class="btn btn-outline" id="open-register">تسجيل مستخدم جديد</button><button class="btn btn-primary login-open" id="open-login">تسجيل الدخول</button></div></header>
<aside class="mx-cover-ad mx-cover-ad--right" data-cover-ad-slot="0" aria-label="إعلان ممول عائم يمين"></aside>
<section class="landing-hero"><div class="hero-copy"><span class="eyebrow">Mantiqati X</span><h1>منصة واحدة تربطك <span>بالخدمات والفرص المناسبة</span></h1><p>منصة تسويق وربط تجمع العملاء بمقدمي الخدمات، وتمنح كل مجال نظامًا مستقلًا للباقات والطلبات والترشيحات والعمولات.</p><div class="hero-actions"><button class="btn btn-primary" id="start">استكشف المجالات</button><button class="btn btn-outline" id="provider">انضم كمقدم خدمة</button></div><div class="trust-row"><span>✓ مجالات متعددة</span><span>✓ باقات مرنة</span><span>✓ ترشيحات حسب المجال</span></div></div><div class="landing-panel"><div class="panel-top"><b>لوحة MantiqatiX</b><span>● جاهزة للتوسع</span></div><div class="panel-stat"><small>مجالات رئيسية</small><strong>${sectors.length}</strong></div><div class="panel-grid"><div>🩺<b>أطباء</b></div><div>💊<b>صيدليات</b></div><div>🧪<b>تحاليل وأشعة</b></div><div>🏥<b>مستشفيات</b></div><div>🍽️<b>مطاعم</b></div><div>💼<b>أعمال</b></div></div></div></section>
<section class="mx-cover-stage" aria-label="الإعلانات الممولة">
<aside class="mx-cover-ad mx-cover-ad--wide" data-cover-ad-slot="1" aria-label="إعلان ممول بعرض الصفحة"></aside>
</section>
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
const mountLandingCoverAds=async()=>{
 const slots=[...document.querySelectorAll('[data-cover-ad-slot]')]; if(!slots.length)return;
 const safeUrl=u=>{try{const x=new URL(String(u||''),location.href);return ['http:','https:'].includes(x.protocol)?x.href:''}catch(_){return ''}};
 const escAttr=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 let rightClosed=false;
 try{rightClosed=sessionStorage.getItem('MNTYRightCoverClosed')==='1'}catch(_){}
 const render=(el,ad)=>{
   if(!ad){el.hidden=true;return}
   if(el.classList.contains('mx-cover-ad--right')&&rightClosed){el.hidden=true;return}
   const href=safeUrl(ad.target_url);
   const img=safeUrl(ad.creative_url);
   const title=String(ad.title||'إعلان ممول').replace(/[<>]/g,'');
   const wide=el.classList.contains('mx-cover-ad--wide');
   el.hidden=false;
   el.innerHTML=wide
     ? '<div class="mx-cover-ad__wide-frame">'+(img?'<img src="'+escAttr(img)+'" alt="'+escAttr(title)+'" loading="eager">':'<span class="mx-cover-ad__fallback">MNTY</span>')+'<span class="mx-cover-ad__badge">ممول</span>'+(href?'<a class="mx-cover-ad__link" href="'+escAttr(href)+'" target="_blank" rel="noopener noreferrer" aria-label="فتح الإعلان"></a>':'')+'</div>'
     : '<div class="mx-cover-ad__cloud">'+(img?'<img class="mx-cover-ad__float-media" src="'+escAttr(img)+'" alt="'+escAttr(title)+'" loading="eager">':'<span class="mx-cover-ad__float-fallback">MNTY</span>')+'<div class="mx-cover-ad__float-body"><span class="mx-cover-ad__badge">ممول</span><strong>'+title+'</strong></div></div>'+(href?'<a class="mx-cover-ad__link" href="'+escAttr(href)+'" target="_blank" rel="noopener noreferrer" aria-label="فتح الإعلان"></a>':'')+'<button type="button" class="mx-cover-ad__close" aria-label="إغلاق الإعلان">×</button>';
   if(!wide){
     const close=el.querySelector('.mx-cover-ad__close');
     close?.addEventListener('click',event=>{
       event.preventDefault();event.stopPropagation();rightClosed=true;el.hidden=true;
       try{sessionStorage.setItem('MNTYRightCoverClosed','1')}catch(_){}
     },{once:true});
   }
 };
 try{
   const coords=window.MNTYLocationAdapter?.state?.coords||null;
   const {data,error}=await sb.rpc('get_mnty_targeted_advertisements',{p_country_code:'EG',p_governorate_code:null,p_center_code:null,p_lat:coords?.latitude??null,p_lon:coords?.longitude??null,p_ad_space_id:'HOME_SPONSORED',p_limit:3});
   if(error)throw error;
   const ads=(data||[]).filter(x=>x&&x.advertisement_id);
   if(!ads.length){slots.forEach(x=>x.hidden=true);return}
   let tick=0;
   const paint=()=>{
     slots.forEach((slot,n)=>render(slot,ads[(tick+n)%ads.length]));
     tick=(tick+1)%ads.length;
   };
   paint();
   if(ads.length>1)window.setInterval(paint,6000);
 }catch(error){console.warn('[MNTY cover ads] unavailable',error);slots.forEach(x=>x.hidden=true)}
};
document.getElementById('start').onclick=()=>document.getElementById('sectors').scrollIntoView({behavior:'smooth'});
mountLandingCoverAds();
document.querySelectorAll('[data-side-ad-book]').forEach(btn=>btn.onclick=()=>{try{localStorage.setItem('MNTYOpenAdBooking','1');localStorage.setItem('MNTYAdBookingDuration','QUARTERLY')}catch(_){};authView('',false,'','login')});
document.getElementById('all-sectors').onclick=()=>{authView()};
}

function filtered(list){const q=query.trim().toLowerCase();return q?list.filter(x=>x.join(' ').toLowerCase().includes(q)):list}
function modulePage(){const list=filtered(domainModules.map(m=>[m.icon,m.name,m.desc]));return `<div class="section-head"><div><h2>مركز الموديولات</h2><p>تحكم في الوحدات التي تظهر للمنصة والمشتركين.</p></div><span class="count">${list.length} وحدات</span></div><div class="modules">${list.map(m=>`<article class="card module" onclick="selectModule('${m[1]}')"><div class="icon">${m[0]}</div><h3>${m[1]}</h3><div class="muted">${m[2]}</div><span class="status">${canManage()?'إدارة متاحة':'متاح للعرض'}</span></article>`).join('')}</div>`}
function sectorsPage(){
 const list=filtered(sectors);
 const sectorMap={'الأطباء والعيادات':'المنظومة الطبية','الصيدليات':'المنظومة الطبية','التحاليل والأشعة':'المنظومة الطبية','المستشفيات الخاصة':'المنظومة الطبية','المطاعم والكافيهات':'المطاعم والمطابخ','السوبر ماركت':'البقالة والسوبر ماركت','الأزياء':'التجارة والأزياء','الصيانة':'الصيانة','الأعمال وERP':'الخدمات المهنية','التعليم':'التعليم','السفر والرحلات':'MantiGO والمزايدات','الشركاء':'المستخدمون وCRM'};
 return '<div class="section-head"><div><h2>المجالات والخدمات</h2><p>اختر مجالًا لاستعراض الوحدة التشغيلية المرتبطة به. التنفيذ الفعلي يظل محكومًا بالبيانات والصلاحيات المتاحة.</p></div></div><div class="modules">'+list.map(s=>'<article class="card module"><div class="icon">'+s[0]+'</div><h3>'+s[1]+'</h3><div class="muted">'+s[2]+'</div><div class="mini-actions"><button type="button" onclick="selectModule(\''+(sectorMap[s[1]]||'الموديولات')+'\')">فتح المجال</button><button type="button" onclick="selectModule(\'العمولات والباقات\')">الباقات</button></div></article>').join('')+'</div>';
}
function genericPage(title,desc,items){return `<div class="section-head"><div><h2>${title}</h2><p>${desc}</p></div></div><div class="grid3">${items.map(x=>`<div class="card"><div class="row"><strong>${x[0]}</strong><span class="dot"></span></div><p class="muted">${x[1]}</p><button class="linkbtn">عرض التفاصيل ←</button></div>`).join('')}</div>`}
async function loadBusinessCatalog(businessId,branchId=null,tenantId=null){
 if(!businessId)throw new Error('CATALOG_CONTEXT_REQUIRED');
 const q=new URLSearchParams({businessId});
 if(tenantId)q.set('tenantId',tenantId);
 if(branchId)q.set('branchId',branchId);
 const data=await invokeMntyApi('/api/v1/catalog?'+q.toString());
 live.catalogByBusiness[businessId]=data;
 return data;
}
function catalogCurrentPrice(catalog,itemId,branchId=null){
 const rows=(catalog?.prices||[]).filter(p=>p.catalog_item_id===itemId);
 const eligible=rows.filter(p=>!branchId||!p.branch_id||p.branch_id===branchId);
 eligible.sort((a,b)=>Number(b.version||0)-Number(a.version||0));
 return eligible[0]||null;
}
function closeMxModal(){document.querySelectorAll('.mx-modal').forEach(x=>x.remove())}
async function openProviderCatalog(businessId,providerName,providerTenantId=null){
 if(!businessId)return showToast('لا يوجد نشاط تشغيلي مرتبط بهذا المقدم.','error');
 try{
  const catalog=live.catalogByBusiness[businessId]||await loadBusinessCatalog(businessId,null,providerTenantId);
  const cards=(catalog.items||[]).map(item=>{
   const price=catalogCurrentPrice(catalog,item.id,catalog.branchId||null);
   const amount=price?String(price.unit_price)+' '+String(price.currency||''):'السعر غير متاح';
   return '<article class="card"><div class="row"><strong>'+esc(item.name_ar||item.name_en||'صنف')+'</strong><span class="dot"></span></div><p class="muted">'+esc(item.description||item.item_type||'خدمة/صنف')+'</p><div class="row"><b>'+esc(amount)+'</b>'+(price?'<button class="text-btn mx-order-trigger" data-business-id="'+esc(businessId)+'" data-item-id="'+esc(item.id)+'">طلب</button>':'')+'</div></article>';
  }).join('')||'<div class="muted">لا توجد أصناف نشطة متاحة حاليًا.</div>';
  const overlay=document.createElement('div');overlay.className='mx-modal';
  overlay.innerHTML='<div class="mx-modal-card"><div class="section-head"><div><span class="eyebrow">LIVE CATALOG</span><h2>كتالوج '+esc(providerName||'مقدم الخدمة')+'</h2><p>الأصناف والأسعار من الكتالوج التشغيلي الفعلي.</p></div><button class="text-btn mx-close-modal">إغلاق</button></div><div class="cards">'+cards+'</div></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('.mx-close-modal')?.addEventListener('click',closeMxModal);
  overlay.querySelectorAll('.mx-order-trigger').forEach(btn=>btn.addEventListener('click',()=>openOrderForm(btn.dataset.businessId,btn.dataset.itemId)));
 }catch(e){showToast('تعذر تحميل الكتالوج: '+(e?.message||'CATALOG_REQUEST_FAILED'),'error')}
}
async function openOrderForm(businessId,itemId){
 const catalog=live.catalogByBusiness[businessId]; const item=(catalog?.items||[]).find(x=>x.id===itemId); const price=catalogCurrentPrice(catalog,itemId,catalog.branchId||null);
 if(!item||!price)return showToast('الصنف أو السعر غير متاح حاليًا.','error');
 const meta=user?.user_metadata||{}; const defaultName=meta.full_name||meta.name||user?.email||'';
 const orderAttemptId=crypto.randomUUID(), clientIdempotencyKey=crypto.randomUUID();
 const overlay=document.createElement('div');overlay.className='mx-modal';
 overlay.innerHTML='<div class="mx-modal-card"><div class="section-head"><div><span class="eyebrow">NEW ORDER</span><h2>'+esc(item.name_ar||item.name_en||'طلب')+'</h2><p>السعر المعروض مرجعي؛ الخادم يعيد احتساب الإجمالي اعتمادًا على الكتالوج.</p></div><button class="text-btn mx-close-modal">إغلاق</button></div><div class="form-grid"><label class="field"><span>الاسم</span><input id="mx-order-name" value="'+esc(defaultName)+'"></label><label class="field"><span>الهاتف</span><input id="mx-order-phone" value="'+esc(user?.phone||meta.phone||'')+'"></label><label class="field"><span>الكمية</span><input id="mx-order-qty" type="number" min="1" step="1" value="1"></label><label class="field"><span>عنوان التنفيذ/التوصيل</span><input id="mx-order-address" placeholder="أدخل العنوان عند الحاجة"></label></div><button class="btn btn-primary" id="mx-submit-order">إرسال الطلب</button></div>';
 document.body.appendChild(overlay);
 overlay.querySelector('.mx-close-modal')?.addEventListener('click',closeMxModal);
 document.getElementById('mx-submit-order').onclick=async()=>{
  const submit=document.getElementById('mx-submit-order');
  if(submit.disabled)return;
  const name=document.getElementById('mx-order-name').value.trim(),phone=document.getElementById('mx-order-phone').value.trim(),address=document.getElementById('mx-order-address').value.trim();
  const qty=Number(document.getElementById('mx-order-qty').value);
  if(!name||!phone||!Number.isInteger(qty)||qty<1)return showToast('أكمل الاسم والهاتف والكمية بشكل صحيح.','error');
  const subtotal=Number(price.unit_price||0)*qty;
  submit.disabled=true; submit.textContent='جارٍ إرسال الطلب…';
  try{
   const result=await invokeMntyFunction('order-create',{orderId:orderAttemptId,tenantId:catalog.tenantId,businessId,branchId:null,clientIdempotencyKey,subtotal,discount:0,tax:0,deliveryFee:0,totalAmount:subtotal,currency:price.currency||'EGP',customerName:name,customerPhone:phone,deliveryAddress:address,items:[{catalogItemId:itemId,quantity:qty,options:[]}],notes:null,metadata:{source:'MNTY_CUSTOMER_CATALOG',pricing_server_authoritative:true}});
   closeMxModal(); current='الطلبات'; await loadLiveData(); await renderApp(); showToast('تم إرسال الطلب بنجاح. يمكنك متابعة الحالة من الطلبات.','success'); return result;
  }catch(e){submit.disabled=false;submit.textContent='إرسال الطلب';showToast('تعذر إنشاء الطلب: '+(e?.message||'ORDER_CREATE_FAILED'),'error')}
 };
}
if(!window.MNTYCatalogClickBound){
 window.MNTYCatalogClickBound=true;
 document.addEventListener('click',event=>{
  const btn=event.target.closest('.mx-provider-catalog');
  if(btn)openProviderCatalog(btn.dataset.businessId,btn.dataset.providerName);
 });
}
function isCustomerMode(){return String(live.role||'').toUpperCase()==='CUSTOMER'}
function customerDashboard(){
 const visible=modules.filter(m=>moduleEnabled(m[1])&&!['الموديولات','المستخدمون وCRM','العمولات والباقات','التقارير والتحليلات','طلبات التسجيل'].includes(m[1]));
 const providers=live.records.providers||[];
 const services=live.records.services||[];
 const providerCards=providers.slice(0,6).map(p=>'<article class="card"><div class="row"><strong>'+esc(p.name_ar||'مقدم خدمة')+'</strong><span class="dot"></span></div><p class="muted">'+esc(p.provider_kind||'خدمة')+' · '+(p.is_verified?'موثق':'مسجل')+'</p><small>الحالة: '+esc(p.status||'—')+'</small>'+(p.business_id?'<button class="text-btn mx-provider-catalog" data-business-id="'+esc(p.business_id)+'" data-provider-name="'+esc(p.name_ar||'مقدم خدمة')+'">عرض الكتالوج</button>':'')+'</article>').join('');
 const serviceCards=services.slice(0,6).map(s=>'<article class="card"><div class="row"><strong>'+esc(s.name_ar||s.name_en||'خدمة')+'</strong><span class="dot"></span></div><p class="muted">'+esc(s.category_code||'خدمة متاحة')+'</p><small>خدمة نشطة على المنصة</small></article>').join('');
 return '<section class="hero"><div><span class="eyebrow">Mantiqati X · عميل</span><h2>اكتشف الخدمة المناسبة وتواصل مع مقدمها</h2><p>استعرض الخدمات ومقدميها من البيانات المتاحة، ثم أرسل طلبك وتابع حالته من حسابك.</p><div class="hero-actions"><button class="btn btn-light" onclick="selectModule(\'المجالات والخدمات\')">استكشف المجالات</button><button class="btn btn-ghost" onclick="selectModule(\'الطلبات والعمليات\')">طلباتي</button></div></div></section><section class="cards"><div class="card"><div class="muted">وضع الحساب</div><div class="kpi">عميل</div><small>العضوية النشطة الحالية</small></div><div class="card"><div class="muted">الطلبات</div><div class="kpi">'+countOrDash('orders')+'</div><small>طلبات مرتبطة بحسابك</small></div><div class="card"><div class="muted">الخدمات النشطة</div><div class="kpi">'+services.length+'</div><small>خدمات مرئية حاليًا</small></div><div class="card"><div class="muted">الدعم</div><div class="kpi">'+countOrDash('support')+'</div><small>تذاكر الدعم</small></div></section><div class="section-head"><div><h2>خدمات متاحة الآن</h2><p>عرض معلومات فعلية فقط؛ لا يتم إنشاء طلب من هذه البطاقة دون مسار الطلب المعتمد.</p></div></div><div class="grid3">'+(serviceCards||'<div class="empty-state">لا توجد خدمات نشطة معروضة حاليًا.</div>')+'</div><div class="section-head"><div><h2>مقدمو الخدمات</h2><p>الملفات الظاهرة وفق صلاحيات القراءة الحالية.</p></div></div><div class="grid3">'+(providerCards||'<div class="empty-state">لا توجد ملفات مقدمي خدمة معروضة حاليًا.</div>')+'</div><div class="section-head"><div><h2>الوصول السريع</h2><p>الخدمات المتاحة لك كعميل.</p></div></div><div class="modules">'+visible.slice(0,8).map(m=>'<article class="card module" onclick="selectModule(\''+m[1]+'\')"><div class="icon">'+m[0]+'</div><h3>'+m[1]+'</h3><div class="muted">'+m[2]+'</div></article>').join('')+'</div>';
}
function isProviderMode(){return ['SERVICE_PROVIDER','OWNER','MANAGER','STAFF','BUSINESS_PARTNER','DELIVERY_PARTNER'].includes(String(live.role||'').toUpperCase())&&!!live.myProviderProfile}
function providerDashboard(){const visible=modules.filter(m=>moduleEnabled(m[1])&&!['الموديولات','المستخدمون وCRM','العمولات والباقات','التقارير والتحليلات','طلبات التسجيل'].includes(m[1]));return '<section class="hero"><div><span class="eyebrow">Mantiqati X · مقدم خدمة</span><h2>أدر نشاطك وخدماتك من مكان واحد</h2><p>اعرض خدماتك المنشورة، استقبل الطلبات المسموح بها، وتابع التشغيل من مساحة العمل. MANTIQATIX توفر البنية الرقمية ولا تتولى تنفيذ الخدمة ماديًا نيابةً عنك.</p><div class="hero-actions"><button class="btn btn-light" onclick="selectModule(\'ملف نشاطي\')">ملف نشاطي</button><button class="btn btn-ghost" onclick="selectModule(\'الطلبات والعمليات\')">الطلبات</button></div></div></section><section class="cards"><div class="card"><div class="muted">حالة النشاط</div><div class="kpi">'+(live.myProviderProfile?.status==='ACTIVE'?'نشط':live.myProviderProfile?.status==='PENDING'?'قيد المراجعة':live.myProviderProfile?.status==='INACTIVE'?'غير نشط':'غير مكتمل')+'</div><small>'+(live.myProviderProfile?.is_verified?'ملف موثق':'حالة الملف وفق البيانات الفعلية')+'</small></div><div class="card"><div class="muted">الطلبات</div><div class="kpi">'+countOrDash('orders')+'</div><small>الطلبات المتاحة وفق الصلاحيات</small></div><div class="card"><div class="muted">الخدمات</div><div class="kpi">'+live.records.services.length+'</div><small>الخدمات المتاحة</small></div><div class="card"><div class="muted">الإشعارات</div><div class="kpi">'+countOrDash('notifications')+'</div><small>آخر تحديثات النشاط</small></div></section><div class="section-head"><div><h2>الوصول السريع</h2><p>الأدوات المتاحة لنطاق مقدم الخدمة.</p></div></div><div class="modules">'+visible.slice(0,8).map(m=>'<article class="card module" onclick="selectModule(\''+m[1]+'\')"><div class="icon">'+m[0]+'</div><h3>'+m[1]+'</h3><div class="muted">'+m[2]+'</div></article>').join('')+'</div>'}
function dashboard(){const visibleModules=modules.filter(m=>moduleEnabled(m[1]));return `<section class="hero"><div><span class="eyebrow">Mantiqati X</span><h2>منصة تسويق وربط الخدمات المحلية</h2><p>بنية رقمية للاكتشاف والمطابقة والتواصل وإدارة الطلبات والمتابعة، دون أن تحل MANTIQATIX محل مقدم الخدمة في تقديم الخدمة أو تنفيذها ماديًا.</p><div class="hero-actions"><button class="btn btn-light" onclick="selectModule('المجالات والخدمات')">استكشف المجالات</button><button class="btn btn-ghost" onclick="selectModule('الموديولات')">إدارة الموديولات</button></div></div></section><section class="cards"><div class="card"><div class="muted">حالة المنصة</div><div class="kpi">نشطة</div><small>Web + Supabase</small></div><div class="card"><div class="muted">المجالات</div><div class="kpi">${sectors.length}</div><small>قطاعات قابلة للتوسع</small></div><div class="card"><div class="muted">الموديولات</div><div class="kpi">${visibleModules.length}</div><small>الموديولات المفعلة</small></div><div class="card"><div class="muted">خدمة العملاء</div><div class="kpi phone">01010171770</div><small>الدعم والتواصل</small></div></section><div class="section-head"><div><h2>الوصول السريع</h2><p>أهم أجزاء المنصة.</p></div></div><div class="modules">${filtered(visibleModules).slice(0,6).map(m=>`<article class="card module" onclick="selectModule('${m[1]}')"><div class="icon">${m[0]}</div><h3>${m[1]}</h3><div class="muted">${m[2]}</div></article>`).join('')}</div>`}
function smmModulePage(){return `<div class="section-head"><div><h2>خدمات التسويق الرقمي SMM</h2><p>موديول MANTIQATIX لإدارة الخدمات الرقمية والطلبات والموردين من نفس الحساب.</p></div><span class="count">Module / SMM</span></div><div class="embedded-module"><iframe src="smm.html" title="MANTIQATIX SMM Module" loading="lazy"></iframe></div>`}
function pageContent(){switch(current){case'الرئيسية':return isCustomerMode()?customerDashboard():isProviderMode()?providerDashboard():dashboard();case'الموديولات':return modulePage();case'خدمات التسويق الرقمي SMM':return smmModulePage();case'المجالات والخدمات':return sectorsPage();case'المستخدمون':return genericPage('المستخدمون','إدارة العملاء ومقدمي الخدمة والموظفين.',[['العملاء','ملفات العملاء وتاريخ الطلبات'],['مقدمو الخدمة','الملفات والاعتماد والباقات'],['الموظفون','الأدوار والصلاحيات']]);case'الطلبات':return genericPage('الطلبات','متابعة الطلبات والحجوزات ومسارات الإحالة.',[['طلبات جديدة','طلبات تحتاج مراجعة'],['قيد المتابعة','طلبات مرتبطة بمقدم خدمة'],['مكتملة','سجل الطلبات المكتملة']]);case'التسويق والإعلان':return genericPage('التسويق والإعلان','نظام التسويق الخاص بالشركة مع إمكانية التعاون مع شركات تسويق أخرى.',[['حملات MantiqatiX','حملات جذب العملاء'],['شركات التسويق','إدارة الشركاء ومصادر العملاء'],['الإعلانات','الحملات والإعلانات الممولة']]);case'العمولات والباقات':return genericPage('العمولات والباقات','نماذج مجانية، عمولة بيع، وباقات احترافية تختلف حسب المجال.',[['الباقة المجانية','وجود أساسي داخل المنصة'],['نظام العمولة','عمولة على العمليات/الإضافات المؤهلة'],['الباقات الاحترافية','3 مستويات قابلة للتخصيص حسب المجال']]);case'التقارير':return genericPage('التقارير','لوحة مؤشرات للإدارة والأداء.',[['الأداء','نشاط المنصة ومقدمي الخدمة'],['الإيرادات','العمولات والباقات'],['التحويلات','مصادر العملاء والطلبات']]);case'الدعم':return genericPage('الدعم','خدمة العملاء والتذاكر والشكاوى.',[['تذاكر مفتوحة','المتابعات الحالية'],['الشكاوى','الملاحظات والحالات'],['مركز المساعدة','الأسئلة والإرشادات']]);default:return genericPage('الإعدادات','إدارة الحساب والمنصة.',[['الحساب','بيانات الحساب وتسجيل الدخول'],['الصلاحيات','الأدوار والوصول'],['إعدادات المنصة','الهوية والإعدادات العامة']])}}
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


async function loadEnterpriseDomainData(m){if(!user||!m.tables?.length)return;const cache=live.moduleData[m.key]||{};if(cache.rowsReady||cache.loading)return;cache.loading=true;live.moduleData[m.key]=cache;const rows={};for(const table of m.tables){let q=sb.from(table).select('*').limit(100).order('created_at',{ascending:false});if(['chart_of_accounts','journal_entries','journal_entry_lines','erp_purchase_orders','erp_purchase_receipts','erp_stock_transfers','warehouses','stock_balances'].includes(table)&&live.tenantId)q=q.eq('tenant_id',live.tenantId);if(table==='mantigo_rides')q=q.eq('customer_id',user.id);if(table==='mantigo_bids')q=q.limit(100);if(table==='matrimony_profiles')q=q.or('is_verified.eq.true,owner_user_id.eq.'+user.id);if(table==='matrimony_requests')q=q.or('from_user_id.eq.'+user.id);const r=await q;rows[table]=r.error?[]:(r.data||[])}cache.rows=rows;cache.rowsReady=true;cache.loading=false;renderApp()}
async function updateMntTripStatus(rideId,targetStatus){
 if(!rideId||!targetStatus)return;
 const reason=window.prompt('سبب تغيير الحالة (اختياري)','')||null;
 return mntRpc('update_mantigo_trip_status_backend',{p_user_id:user.id,p_ride_id:rideId,p_target_status:targetStatus,p_reason:reason});
}
function mntTripActions(ride){
 const s=String(ride?.status||'').toUpperCase(), role=String(live.role||'').toUpperCase(), id=esc(ride?.id||'');
 const a=[];
 if(ride?.customer_id===user?.id){
   if(s==='OPEN')a.push('<button class="linkbtn" onclick="updateMntTripStatus(\''+id+'\',\'OPEN_FOR_BIDS\')">فتح المزايدة</button>');
   if(['OPEN','OPEN_FOR_BIDS','MATCHING'].includes(s))a.push('<button class="linkbtn" onclick="updateMntTripStatus(\''+id+'\',\'CANCELLED\')">إلغاء</button>');
 }
 if(['SERVICE_PROVIDER','DRIVER','CAPTAIN'].includes(role)&&s==='OPEN_FOR_BIDS')a.push('<button class="linkbtn" onclick="createMntBid(\''+id+'\')">تقديم عرض</button>');
 if(['SERVICE_PROVIDER','DRIVER','CAPTAIN'].includes(role)&&s==='ACCEPTED')a.push('<button class="linkbtn" onclick="updateMntTripStatus(\''+id+'\',\'ARRIVED\')">وصلت</button>');
 if(['SERVICE_PROVIDER','DRIVER','CAPTAIN'].includes(role)&&s==='STARTED')a.push('<button class="linkbtn" onclick="updateMntTripStatus(\''+id+'\',\'IN_PROGRESS\')">بدء التنفيذ</button>');
 if(['SERVICE_PROVIDER','DRIVER','CAPTAIN'].includes(role)&&s==='IN_PROGRESS')a.push('<button class="linkbtn" onclick="updateMntTripStatus(\''+id+'\',\'COMPLETED\')">إكمال الرحلة</button>');
 return a.join(' ')||'<span class="muted">—</span>';
}
function mantigoWorkspace(rows){
 const rides=rows.mantigo_rides||[], bids=rows.mantigo_bids||[], role=String(live.role||'').toUpperCase();
 const rideCards=rides.length?rides.map(r=>'<article class="card"><div class="row"><strong>رحلة '+esc(r.id)+'</strong><span>'+esc(r.status||'—')+'</span></div><p><b>من:</b> '+esc(r.pickup_location||'—')+'<br><b>إلى:</b> '+esc(r.destination_location||'—')+'</p><div class="row"><span>السعر المقترح: '+esc(r.proposed_price??'—')+'</span><span>'+esc(r.ride_type||'—')+'</span></div><div class="action-bar">'+mntTripActions(r)+'</div></article>').join(''):'<div class="empty-state">لا توجد رحلات مرئية وفق صلاحيات الحساب.</div>';
 const bidCards=bids.length?bids.map(b=>'<article class="card"><div class="row"><strong>عرض '+esc(b.id)+'</strong><span>'+esc(b.offered_price??'—')+'</span></div><p><b>الرحلة:</b> '+esc(b.ride_id||'—')+'<br><b>الكابتن:</b> '+esc(b.captain_name||'—')+'<br><b>المركبة:</b> '+esc(b.vehicle_model||'—')+' · ETA '+esc(b.eta_minutes??'—')+' دقيقة</p><div class="action-bar">'+(role==='CUSTOMER'?'<button class="linkbtn" onclick="acceptMntBid(\''+esc(b.ride_id||'')+'\',\''+esc(b.id||'')+'\')">قبول العرض</button>':'')+'</div></article>').join(''):'<div class="empty-state">لا توجد عروض مرئية وفق صلاحيات الحساب.</div>';
 return '<div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="createMntRide()">+ إنشاء رحلة</button></div><section class="records"><div class="section-head"><div><h3>الرحلات</h3><p class="muted">'+rides.length+' رحلة مرئية وفق RLS</p></div></div><div class="grid3">'+rideCards+'</div></section><section class="records"><div class="section-head"><div><h3>العروض</h3><p class="muted">'+bids.length+' عرض مرئي وفق RLS</p></div></div><div class="grid3">'+bidCards+'</div></section>';
}
async function createMedicalAppointment(providerId,businessId){
 if(!user?.id||!providerId||!businessId)return authView();
 const dateText=window.prompt('موعد الحجز — أدخل التاريخ والوقت بصيغة 2026-10-01 10:30');
 if(!dateText?.trim())return;
 const dt=new Date(dateText.replace(' ','T'));
 const timestamp=dt.getTime();
 if(!Number.isFinite(timestamp)||timestamp<=Date.now())return showToast('الموعد غير صالح أو في الماضي.','error');
 const reason=window.prompt('سبب/نوع الاستشارة','استشارة')||'استشارة';
 const {error}=await sb.rpc('create_medical_appointment_backend',{p_user_id:user.id,p_appointment_id:'MED-'+crypto.randomUUID(),p_business_id:businessId,p_doctor_id:providerId,p_date_time:timestamp,p_reason:reason.trim()});
 if(error)return showToast('تعذر حجز الموعد: '+error.message,'error');
 showToast('تم إنشاء الموعد بنجاح.','success');live.moduleData={};await loadDomainModule(current);renderApp();
}
async function updateMedicalAppointmentStatus(id,status){
 if(!id||!status)return;
 const {error}=await sb.rpc('update_medical_appointment_status_backend',{p_user_id:user.id,p_appointment_id:id,p_target_status:status});
 if(error)return showToast('تعذر تحديث الموعد: '+error.message,'error');
 showToast('تم تحديث حالة الموعد.','success');live.moduleData={};await loadDomainModule(current);renderApp();
}
function medicalWorkspace(rows){
 const providers=(rows.marketing_provider_profiles||[]).filter(p=>p.status==='ACTIVE');
 const appointments=rows.medical_appointments||[];
 const role=String(live.role||'').toUpperCase();
 const providerCards=providers.map(p=>'<article class="card"><div class="row"><strong>'+esc(p.name_ar||p.name_en||'مقدم طبي')+'</strong><span>'+esc(p.is_verified?'موثق':'متاح')+'</span></div><p class="muted">'+esc(p.provider_kind||'عيادة/طبيب')+'</p><p>'+esc(p.description||'')+'</p>'+(isCustomerMode()&&p.business_id?'<div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="createMedicalAppointment(\''+esc(p.id)+'\',\''+esc(p.business_id)+'\')">حجز موعد</button></div>':'')+'</article>').join('')||'<div class="empty-state">لا يوجد مقدم طبي نشط ظاهر وفق البيانات الحالية.</div>';
 const apptCards=appointments.map(a=>'<article class="card"><div class="row"><strong>'+esc(a.id)+'</strong><span>'+esc(a.status||'—')+'</span></div><p><b>الموعد:</b> '+esc(a.date_time?new Date(Number(a.date_time)).toLocaleString('ar-EG'):'—')+'<br><b>الاستشارة:</b> '+esc(a.reason||'—')+'</p><div class="action-bar">'+(a.status==='BOOKED'&&['SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER'].includes(role)?'<button class="linkbtn" onclick="updateMedicalAppointmentStatus(\''+esc(a.id)+'\',\'CONFIRMED\')">تأكيد</button>':'')+(a.status==='CONFIRMED'&&['SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER'].includes(role)?'<button class="linkbtn" onclick="updateMedicalAppointmentStatus(\''+esc(a.id)+'\',\'COMPLETED\')">إكمال</button>':'')+(['BOOKED','CONFIRMED'].includes(a.status)?'<button class="linkbtn" onclick="updateMedicalAppointmentStatus(\''+esc(a.id)+'\',\'CANCELLED\')">إلغاء</button>':'')+'</div></article>').join('')||'<div class="empty-state">لا توجد مواعيد مرئية وفق صلاحيات الحساب.</div>';
 return workspaceHead('MEDICAL','المنظومة الطبية','اكتشاف مقدمي الخدمة، حجز المواعيد ومتابعة الحالة. السجلات السريرية الحساسة خارج هذا المسار.','LIVE')+'<section class="records"><div class="section-head"><div><h3>الأطباء والعيادات</h3><p class="muted">'+providers.length+' مقدم طبي نشط</p></div></div><div class="grid3">'+providerCards+'</div></section><section class="records"><div class="section-head"><div><h3>المواعيد</h3><p class="muted">'+appointments.length+' موعد مرئي وفق RLS</p></div></div><div class="grid3">'+apptCards+'</div></section>';
}
function enterpriseRowsTable(m,rows){if(m.key==='ACCOUNTING'&&current==='المزايدات — المحاسبة')return recordsTable('دليل الحسابات',rows.chart_of_accounts||[],[['الكود',r=>r.account_code],['الحساب',r=>r.account_name],['النوع',r=>r.account_type],['نشط',r=>r.is_active?'نعم':'لا']])+recordsTable('القيود',rows.journal_entries||[],[['المرجع',r=>r.reference_type],['الوصف',r=>r.description],['التاريخ',r=>r.entry_date],['الحالة',r=>r.status]]);if(m.key==='ERP')return '<div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="createPurchaseOrder()">+ أمر شراء</button><button class="btn btn-outline" style="width:auto" onclick="receivePurchaseStock()">+ استلام مشتريات</button><button class="btn btn-outline" style="width:auto" onclick="createStockTransfer()">+ تحويل مخزني</button></div>'+recordsTable('أوامر الشراء',rows.erp_purchase_orders||[],[['رقم الأمر',r=>r.order_number],['المورد',r=>r.supplier_id],['الإجمالي',r=>r.total_amount],['الحالة',r=>r.status],['إجراء',r=>r.status==='DRAFT'?'<button class="linkbtn" onclick="updatePurchaseOrderStatus(\''+r.id+'\',\'SUBMITTED\')">إرسال للاعتماد</button>':r.status==='PENDING_APPROVAL'?'<button class="linkbtn" onclick="updatePurchaseOrderStatus(\''+r.id+'\',\'APPROVED\')">اعتماد</button>':'—']])+recordsTable('الاستلامات',rows.erp_purchase_receipts||[],[['رقم الاستلام',r=>r.receipt_number],['الأمر',r=>r.purchase_order_id],['المخزن',r=>r.warehouse_id],['الكمية',r=>r.received_quantity],['الحالة',r=>r.status]])+recordsTable('التحويلات',rows.erp_stock_transfers||[],[['التحويل',r=>r.transfer_number],['من',r=>r.from_warehouse_id],['إلى',r=>r.to_warehouse_id],['الكمية',r=>r.quantity],['الحالة',r=>r.status],['إجراء',r=>r.status==='REQUESTED'?'<button class="linkbtn" onclick="updateStockTransferStatus(\''+r.id+'\',\'APPROVED\')">اعتماد</button>':r.status==='APPROVED'?'<button class="linkbtn" onclick="updateStockTransferStatus(\''+r.id+'\',\'IN_TRANSIT\')">إرسال</button>':r.status==='IN_TRANSIT'?'<button class="linkbtn" onclick="receiveStockTransfer(\''+r.id+'\')">استلام</button>':'—']]);if(m.key==='FACTORIES')return recordsTable('المخازن',rows.warehouses||[],[['المخزن',r=>r.name],['الكود',r=>r.code],['الحالة',r=>r.status]])+recordsTable('الأرصدة',rows.stock_balances||[],[['المنتج',r=>r.product_id],['المخزن',r=>r.warehouse_id],['الرصيد',r=>r.quantity_on_hand],['محجوز',r=>r.quantity_reserved]])+recordsTable('طلبات المصانع',rows.indrive_requests||[],[['العنوان',r=>r.title],['المجال',r=>r.category_name],['الميزانية',r=>r.user_proposed_price],['الحالة',r=>r.status]]);if(m.key==='TRIPS')return mantigoWorkspace(rows);if(m.key==='MEDICAL')return medicalWorkspace(rows);if(m.key==='MATRIMONY')return '<div class="notice">بيانات الاتصال المباشر وبيانات الولي محجوبة من قائمة الملفات العامة.</div>'+recordsTable('الملفات المتاحة',rows.matrimony_profiles||[],[['الاسم المستعار',r=>r.pseudonym],['العمر',r=>r.age],['المدينة',r=>r.city],['التعليم',r=>r.education],['المهنة',r=>r.occupation],['الحالة',r=>r.marital_status],['موثق',r=>r.is_verified?'نعم':'لا']])+recordsTable('طلبات التواصل الخاصة بي',rows.matrimony_requests||[],[['الملف',r=>r.to_profile_id],['الحالة',r=>r.status],['التاريخ',r=>r.created_at]]);return ''}
function domainModuleWorkspace(){const m=domainModules.find(x=>x.name===current);if(!m)return modulePage();const d=live.moduleData[m.key]||{tables:{},ready:false};if(['ACCOUNTING','ERP','FACTORIES','TRIPS','MATRIMONY'].includes(m.key)){if(!d.rowsReady){loadEnterpriseDomainData(m);return workspaceHead(m.key,m.name,m.desc,'LOADING')+'<div class="empty-state">جاري تحميل البيانات التشغيلية الفعلية وفق صلاحياتك…</div>'}return workspaceHead(m.key,m.name,m.desc,'MODULE')+workspaceCards(m.tables.map(t=>[t,String((d.rows?.[t]||[]).length),'سجلات مرئية وفق RLS']))+enterpriseRowsTable(m,d.rows||{})+'<div class="action-bar"><button class="btn btn-outline" style="width:auto" onclick="selectModule(\'الموديولات\')">← العودة للموديولات</button></div>'}const cards=m.tables.map(t=>[t,d.tables?.[t]==null?'—':String(d.tables[t]),'عدد السجلات المتاحة وفق RLS']);if(!m.tables.length)cards.push(['حالة المخطط','NOT VERIFIED','لا يوجد جدول طبي متخصص مثبت في المخطط الحالي']);return workspaceHead(m.key,m.name,m.desc,'MODULE')+workspaceCards(cards)+'<div class="action-bar"><button class="btn btn-outline" style="width:auto" onclick="selectModule(\'الموديولات\')">← العودة للموديولات</button></div>'+recordsTable('مصادر البيانات الموصولة',m.tables.map(t=>({table:t,count:d.tables?.[t]})),[['الجدول',r=>r.table],['السجلات',r=>r.count==null?'—':r.count],['الحالة',r=>r.count==null?'NOT VERIFIED':'READABLE']])}
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
async function mntRpc(fn,args){if(!user?.id)return authView();const {data,error}=await sb.rpc(fn,args);if(error)return showToast('تعذر تنفيذ العملية: '+error.message,'error');showToast('تم تنفيذ العملية بنجاح','success');live.moduleData={};await loadDomainModule(current);renderApp();return data}
async function createMntRide(){const pickup=window.prompt('نقطة الانطلاق');const destination=window.prompt('الوجهة');const price=Number(window.prompt('السعر المقترح','0'));if(!pickup?.trim()||!destination?.trim()||!Number.isFinite(price)||price<=0)return showToast('بيانات الرحلة غير صحيحة','error');return mntRpc('create_mantigo_ride_backend',{p_user_id:user.id,p_customer_name:user.email||'Customer',p_customer_phone:'',p_vehicle_category:window.prompt('فئة المركبة','STANDARD')||'STANDARD',p_ride_type:window.prompt('نوع الرحلة','ONE_WAY')||'ONE_WAY',p_pickup_location:pickup.trim(),p_destination_location:destination.trim(),p_proposed_price:price,p_note:window.prompt('ملاحظة','')||null})}
async function createMntBid(rideId){const price=Number(window.prompt('قيمة العرض','0'));if(!rideId||!Number.isFinite(price)||price<=0)return showToast('قيمة العرض غير صحيحة','error');return mntRpc('create_mantigo_bid_backend',{p_user_id:user.id,p_ride_id:rideId,p_captain_name:user.email||'Captain',p_captain_phone:'',p_captain_rating:null,p_vehicle_category:window.prompt('فئة المركبة','STANDARD')||'STANDARD',p_vehicle_model:window.prompt('موديل المركبة','')||null,p_vehicle_plate:window.prompt('رقم اللوحة','')||null,p_offered_price:price,p_eta_minutes:Number(window.prompt('ETA بالدقائق','15'))||15,p_captain_message:window.prompt('رسالة','')||null})}
async function acceptMntBid(rideId,bidId){if(!rideId||!bidId)return;return mntRpc('accept_mantigo_bid_backend',{p_user_id:user.id,p_ride_id:rideId,p_bid_id:bidId})}
async function erpRpc(fn,args){if(!user?.id)return authView();if(!live.tenantId||!live.businessId)return showToast('يجب اختيار مؤسسة فعالة قبل تنفيذ العملية','error');const {data,error}=await sb.rpc(fn,args);if(error){showToast('تعذر تنفيذ العملية: '+error.message,'error');return null}showToast('تم تنفيذ العملية بنجاح','success');live.moduleData={};await loadDomainModule(current);renderApp();return data}
async function createPurchaseOrder(){const orderNumber=window.prompt('رقم أمر الشراء');if(!orderNumber?.trim())return;const supplierId=window.prompt('معرف المورد');if(!supplierId?.trim())return;const total=Number(window.prompt('الإجمالي','0'));if(!Number.isFinite(total)||total<0)return showToast('قيمة إجمالي غير صحيحة','error');const tax=Number(window.prompt('الضريبة','0'));const discount=Number(window.prompt('الخصم','0'));if([tax,discount].some(v=>!Number.isFinite(v)||v<0))return showToast('قيمة ضريبة/خصم غير صحيحة','error');return erpRpc('create_purchase_order_backend',{p_id:'po-'+crypto.randomUUID(),p_tenant_id:live.tenantId,p_business_id:live.businessId,p_branch_id:live.branchId||null,p_order_number:orderNumber.trim(),p_supplier_id:supplierId.trim(),p_total_amount:total,p_tax_amount:tax,p_discount_amount:discount,p_reason:window.prompt('سبب أمر الشراء','')||null})}
async function updatePurchaseOrderStatus(id,status){if(!id)return;return erpRpc('update_purchase_order_status_backend',{p_order_id:id,p_target_status:status})}
async function receivePurchaseStock(){const purchaseOrderId=window.prompt('معرف أمر الشراء');if(!purchaseOrderId?.trim())return;const receiptNumber=window.prompt('رقم الاستلام');if(!receiptNumber?.trim())return;const warehouseId=window.prompt('معرف المخزن');if(!warehouseId?.trim())return;const productId=window.prompt('معرف المنتج');if(!productId?.trim())return;const qty=Number(window.prompt('الكمية المستلمة','1'));const unitCost=Number(window.prompt('تكلفة الوحدة','0'));if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(unitCost)||unitCost<0)return showToast('بيانات الاستلام غير صحيحة','error');return erpRpc('receive_purchase_stock_backend',{p_id:'rcv-'+crypto.randomUUID(),p_tenant_id:live.tenantId,p_business_id:live.businessId,p_purchase_order_id:purchaseOrderId.trim(),p_receipt_number:receiptNumber.trim(),p_warehouse_id:warehouseId.trim(),p_product_id:productId.trim(),p_received_quantity:qty,p_unit_cost:unitCost})}
async function createStockTransfer(){const transferNumber=window.prompt('رقم التحويل');if(!transferNumber?.trim())return;const from=window.prompt('معرف المخزن المصدر');const to=window.prompt('معرف المخزن الهدف');const product=window.prompt('معرف المنتج');const qty=Number(window.prompt('الكمية','1'));if(!from?.trim()||!to?.trim()||!product?.trim()||!Number.isFinite(qty)||qty<=0)return showToast('بيانات التحويل غير صحيحة','error');return erpRpc('create_stock_transfer_backend',{p_id:'tr-'+crypto.randomUUID(),p_tenant_id:live.tenantId,p_business_id:live.businessId,p_transfer_number:transferNumber.trim(),p_from_warehouse_id:from.trim(),p_to_warehouse_id:to.trim(),p_product_id:product.trim(),p_quantity:qty})}
async function updateStockTransferStatus(id,status){if(!id)return;return erpRpc('update_stock_transfer_status_backend',{p_transfer_id:id,p_target_status:status})}
async function receiveStockTransfer(id){if(!id)return;return erpRpc('receive_stock_transfer_backend',{p_transfer_id:id})}
const AD_BOOKING_LABELS={QUARTERLY:'ربع سنوي (3 أشهر)',HALF_YEARLY:'نصف سنوي (6 أشهر)',ANNUAL:'سنوي (12 شهرًا)'};
async function requestAdBooking(duration='QUARTERLY'){
  if(!user?.id)return authView();
  const key=String(duration||'QUARTERLY').toUpperCase();
  const label=AD_BOOKING_LABELS[key]||AD_BOOKING_LABELS.QUARTERLY;
  const title='طلب حجز إعلان نشاط — '+label;
  const description='طلب حجز مبدئي لظهور النشاط على MantiqatiX لمدة '+label+'. يخضع الطلب لمراجعة المنصة وتأكيد التوفر والسعر وإتمام المسار المالي قبل تفعيل الإعلان.';
  try{
    const {data,error}=await sb.from('marketing_leads').insert({
      requester_user_id:user.id,
      requester_business_id:live.businessId||null,
      title,
      description,
      currency:'EGP',
      status:'OPEN',
      source:'PLATFORM',
      required_services:['AD_BOOKING',key]
    }).select('id,title,status,source,created_at').single();
    if(error)throw error;
    try{localStorage.removeItem('MNTYOpenAdBooking');localStorage.removeItem('MNTYAdBookingDuration')}catch(_){}
    showToast('تم إنشاء طلب حجز الإعلان بنجاح. سيظهر في مركز التسويق للمراجعة.','success');
    current='التسويق والإعلان';
    await renderApp();
    return data;
  }catch(e){
    showToast('تعذر إنشاء طلب حجز الإعلان: '+(e?.message||'خطأ غير معروف'),'error');
    return null;
  }
}
async function createMarketingLead(){if(!user?.id)return authView();const title=window.prompt('عنوان احتياج التسويق');if(!title?.trim())return;const description=window.prompt('وصف الاحتياج والخدمة المطلوبة');if(!description?.trim())return;const {data,error}=await sb.from('marketing_leads').insert({requester_user_id:user.id,requester_business_id:live.businessId||null,title:title.trim(),description:description.trim(),currency:'EGP',status:'NEW',source:'WEB'}).select('id').single();if(error)return showToast('تعذر إنشاء طلب التسويق: '+error.message,'error');live.counts.leads=(live.counts.leads||0)+1;showToast('تم إنشاء طلب التسويق'+(data?.id?' #'+data.id:''),'success');renderApp()}
async function createGlobalAdFromAdmin(){
 if(!user?.id)return authView();
 if(!['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase()))return showToast('هذه العملية للإدارة فقط.','error');
 const title=document.getElementById('global-ad-title')?.value?.trim();
 const creative=document.getElementById('global-ad-creative')?.value?.trim();
 const target=document.getElementById('global-ad-target')?.value?.trim()||null;
 if(!title||!creative)return showToast('أدخل عنوان الإعلان ورابط الصورة/التصميم.','error');
 if(!/^https?:\/\//i.test(creative))return showToast('رابط التصميم يجب أن يبدأ بـ https:// أو http://','error');
 const {data,error}=await sb.rpc('admin_create_global_ad',{p_title:title,p_creative_url:creative,p_target_url:target});
 if(error)return showToast('تعذر إضافة الإعلان: '+(error.message||'خطأ غير معروف'),'error');
 showToast('تمت إضافة الإعلان العام مجاناً وتفعيله.','success');
 document.getElementById('global-ad-title').value='';
 document.getElementById('global-ad-creative').value='';
 document.getElementById('global-ad-target').value='';
}
function globalAdAdminPanel(){
 if(!['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase()))return '';
 return '<section class="card" style="margin:16px 0;padding:18px"><div class="section-head"><div><span class="eyebrow">إدارة الإعلانات العامة</span><h2>إضافة إعلان MNTY مجاني</h2><p>يظهر الإعلان لجميع المناطق عند عدم وجود إعلان جغرافي مطابق، ويمكن للإدارة إضافته دون رسوم.</p></div></div><div class="grid3" style="margin-top:12px"><label>عنوان الإعلان<input id="global-ad-title" class="input" placeholder="مثال: سجّل نشاطك على MNTY"></label><label>رابط التصميم<input id="global-ad-creative" class="input" placeholder="https://.../creative.svg"></label><label>رابط الوجهة<input id="global-ad-target" class="input" placeholder="https://..."></label></div><div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="createGlobalAdFromAdmin()">إضافة الإعلان مجاناً</button></div></section>';
}
function marketingWorkspace(){return workspaceHead('MANTIQATIX MARKETING','مركز التسويق والإعلان','إدارة الحملات، شركات التسويق، الإعلانات ومصادر العملاء من البيانات الفعلية.','MARKETING')+workspaceCards([['المشروعات',countOrDash('projects'),'مشروعات التسويق المرئية وفق RLS'],['العملاء المحتملون',countOrDash('leads'),'طلبات التسويق الفعلية'],['الإعلانات',countOrDash('ads'),'إعلانات مرئية وفق RLS'],['شركات التسويق',countOrDash('providers'),'ملفات مقدمي التسويق'],['الخدمات',live.records.services.length,'الخدمات التسويقية النشطة'],['التقارير','—','لا يتم عرض رقم غير محسوب فعلياً']])+ '<section class="card" style="margin:16px 0;padding:18px"><div class="section-head"><div><span class="eyebrow">حجز الظهور الإعلاني</span><h2>اختر مدة الحجز المناسبة لنشاطك</h2><p>طلب الحجز مبدئي؛ يتم تأكيد التوفر والسعر ثم استكمال المسار المالي قبل تفعيل الإعلان.</p></div></div><div class="grid3" style="margin-top:12px"><article class="card" style="padding:16px"><b>ربع سنوي</b><p>ظهور إعلاني لمدة 3 أشهر.</p><button class="btn btn-outline" onclick="requestAdBooking(&quot;QUARTERLY&quot;)">طلب حجز</button></article><article class="card" style="padding:16px;border-color:#2563eb"><b>نصف سنوي</b><p>ظهور إعلاني لمدة 6 أشهر.</p><button class="btn btn-primary" onclick="requestAdBooking(&quot;HALF_YEARLY&quot;)">طلب حجز</button></article><article class="card" style="padding:16px"><b>سنوي</b><p>ظهور إعلاني لمدة 12 شهرًا.</p><button class="btn btn-outline" onclick="requestAdBooking(&quot;ANNUAL&quot;)">طلب حجز</button></article></div></section><div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="createMarketingLead()">+ إنشاء طلب تسويقي</button></div>'+globalAdAdminPanel()+recordsTable('طلبات التسويق',live.records.leads,[['العنوان',r=>r.title||'—'],['الحالة',r=>r.status||'—'],['المصدر',r=>r.source||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—']])+recordsTable('الإعلانات',live.records.ads,[['العنوان',r=>r.title||'—'],['الحالة',r=>r.status||'—'],['الموافقة',r=>r.approval_status||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—']])+recordsTable('المشروعات',live.records.projects,[['النوع',r=>r.project_type||'—'],['الحالة',r=>r.status||'—'],['القيمة',r=>r.gross_value!=null?(r.gross_value+' '+(r.currency||'')):'—'],['العمولة',r=>r.platform_commission!=null?(r.platform_commission+' '+(r.currency||'')):'—']])+recordsTable('الخدمات التسويقية النشطة',live.records.services,[['الخدمة',r=>r.name_ar||r.name_en||'—'],['الكود',r=>r.code||'—'],['الفئة',r=>r.category_code||'—'],['الحالة',r=>r.status||'—']])}
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
const ORDER_STAFF_ROLES=['OWNER','ADMIN','MANAGER','STAFF','CASHIER','DRIVER','BUSINESS_OWNER','SERVICE_PROVIDER'];
function orderAllowedNextStatuses(order){
 const status=String(order?.status||'').toUpperCase();
 const role=String(live.role||'').toUpperCase();
 if(role==='CUSTOMER'&&order?.customer_id===user?.id)return status!=='DELIVERED'&&status!=='CANCELLED'?['CANCELLED']:[];
 if(!ORDER_STAFF_ROLES.includes(role))return [];
 if(['OWNER','ADMIN'].includes(role))return status==='PENDING'||status==='CREATED'?['CONFIRMED','CANCELLED']:status==='CONFIRMED'?['PREPARING','CANCELLED']:status==='PREPARING'?['OUT_FOR_DELIVERY','CANCELLED']:status==='OUT_FOR_DELIVERY'?['DELIVERED']:[];
 if(!order.business_id||order.business_id!==live.businessId)return [];
 return status==='PENDING'||status==='CREATED'?['CONFIRMED','CANCELLED']:status==='CONFIRMED'?['PREPARING','CANCELLED']:status==='PREPARING'?['OUT_FOR_DELIVERY','CANCELLED']:status==='OUT_FOR_DELIVERY'?['DELIVERED']:[];
}
async function updateOrderStatus(orderId,newStatus){
 const order=(live.records.orders||[]).find(x=>x.id===orderId);
 if(!order)return showToast('الطلب غير متاح وفق الصلاحيات الحالية.','error');
 const allowed=orderAllowedNextStatuses(order);
 if(!allowed.includes(newStatus))return showToast('انتقال الحالة غير مسموح من الواجهة الحالية.','error');
 try{
  await invokeMntyFunction('order-status-update',{orderId,tenantId:order.tenant_id||live.tenantId,newStatus});
  showToast('تم تحديث حالة الطلب إلى '+newStatus,'success');
  await loadLiveData();
  await renderApp();
 }catch(e){showToast('تعذر تحديث حالة الطلب: '+(e?.message||'ORDER_STATUS_UPDATE_FAILED'),'error');}
}
const ORDER_ACTION_AR={CONFIRMED:'تأكيد الطلب',PREPARING:'بدء التجهيز',OUT_FOR_DELIVERY:'إرسال للتوصيل',DELIVERED:'تأكيد التسليم',CANCELLED:'إلغاء الطلب'};
function orderActions(order){
 const actions=orderAllowedNextStatuses(order);
 if(!actions.length)return '<span class="muted">لا توجد إجراءات متاحة</span>';
 return actions.map(s=>'<button class="text-btn" onclick="updateOrderStatus(\''+esc(order.id)+'\',\''+s+'\')">'+esc(ORDER_ACTION_AR[s]||s)+'</button>').join(' ');
}
const ORDER_STATUS_AR={PENDING:'قيد الانتظار',CREATED:'تم الإنشاء',CONFIRMED:'تم التأكيد',PREPARING:'جاري التجهيز',OUT_FOR_DELIVERY:'في الطريق',DELIVERED:'تم التسليم',CANCELLED:'ملغي',FAILED:'فشل',EXPIRED:'منتهي'};
function orderStatusLabel(s){const k=String(s||'').toUpperCase();return ORDER_STATUS_AR[k]||k||'غير محدد'}
function orderStatusClass(s){return 'mx-order-status mx-order-status-'+String(s||'').toLowerCase().replace(/[^a-z_]+/g,'-')}
function orderCards(){
 const rows=live.records.orders||[];
 if(!rows.length)return '<div class="empty-state"><b>لا توجد طلبات حتى الآن</b><span>عند إرسال طلب من مقدم خدمة سيظهر هنا ويتابع حالته مباشرة.</span></div>';
 return '<div class="mx-order-grid">'+rows.map(r=>'<article class="mx-order-card"><div class="mx-order-card__head"><span class="'+orderStatusClass(r.status)+'">'+esc(orderStatusLabel(r.status))+'</span><small>'+esc(r.created_at?new Date(r.created_at).toLocaleString('ar-EG'):'—')+'</small></div><h3>طلب '+esc(String(r.id||'').slice(0,8))+'</h3><p>'+esc(r.customer_name||'طلب خدمة')+'</p><div class="mx-order-card__meta"><span>الإجمالي</span><b>'+esc(r.total_amount!=null?(r.total_amount+' '+(r.currency||'')):'—')+'</b></div><div class="mx-order-card__actions">'+orderActions(r)+'</div></article>').join('')+'</div>';
}
function ordersWorkspace(){return workspaceHead('ORDERS','الطلبات والحجوزات','من هنا يتابع العميل طلبه، ويستقبل مقدم الخدمة الطلبات الجديدة ويغير الحالة وفق صلاحيات نشاطه.','ORDERS')+workspaceCards([['الطلبات',countOrDash('orders'),'طلبات فعلية وفق نطاق الحساب'],['الإشعارات',countOrDash('notifications'),'تحديثات الحالة والحجوزات'],['الحالات','تشغيلية','التغيير يمر عبر الخادم'],['المالية','محكومة','الدفع منفصل عن تغيير الحالة']])+orderCards()+recordsTable('سجل حالات الطلبات',live.records.orderHistory,[['الطلب',r=>String(r.order_id||'').slice(0,8)],['من',r=>orderStatusLabel(r.old_status)],['إلى',r=>orderStatusLabel(r.new_status)],['السبب',r=>r.reason||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleString('ar-EG'):'—']])}
function analyticsWorkspace(){return workspaceHead('ANALYTICS','التقارير والتحليلات','مؤشرات موحدة للأداء والتحويلات والإيرادات والمخاطر.','LIVE')+workspaceCards([['نشاط المنصة','—','يُحسب من مؤشرات التشغيل الفعلية عند توفرها'],['التحويلات','—','تُحسب من بيانات التحويل الفعلية عند توفرها'],['الإيرادات','—','يُعرض من البيانات المالية الفعلية عند توفرها'],['مصادر العملاء','—','تُعرض من مصادر الإحالة والتسويق الفعلية عند توفرها'],['الاستثناءات','—','تُعرض من سجل الحالات الفعلي عند توفره'],['التدقيق','سليم','سجل قابل للمراجعة والتتبع']])}
async function postFinancialJournal(){if(!user?.id||!live.tenantId)return authView();if(!['OWNER','BUSINESS_OWNER','ADMIN','MANAGER','ACCOUNTANT','FINANCE','FINANCE_MANAGER'].includes(String(live.role||'').toUpperCase()))return showToast('لا تملك صلاحية ترحيل قيد مالي.','error');const entryNumber=window.prompt('رقم القيد');if(!entryNumber?.trim())return;const debitAccount=window.prompt('معرف حساب المدين');const creditAccount=window.prompt('معرف حساب الدائن');const amount=Number(window.prompt('المبلغ','0'));if(!debitAccount?.trim()||!creditAccount?.trim()||!Number.isFinite(amount)||amount<=0)return showToast('بيانات القيد غير صحيحة.','error');const description=window.prompt('وصف القيد','')||'';const session=await sb.auth.getSession();const token=session?.data?.session?.access_token;if(!token)return showToast('انتهت الجلسة.','error');const entry={entry_number:entryNumber.trim(),business_id:live.businessId||null,branch_id:live.branchId||null,reference_type:'MANUAL',description,total_debit:amount,total_credit:amount};const lines=[{account_id:debitAccount.trim(),line_number:1,debit:amount,credit:0,description},{account_id:creditAccount.trim(),line_number:2,debit:0,credit:amount,description}];const {data,error}=await sb.functions.invoke('post-financial-journal',{body:{tenantId:live.tenantId,entry,lines},headers:{Authorization:'Bearer '+token}});if(error)return showToast('تعذر ترحيل القيد: '+error.message,'error');showToast('تم ترحيل القيد '+(data?.id||''),'success');live.moduleData={};await loadDomainModule(current);renderApp()}
function financeWorkspace(){return workspaceHead('FINANCE','العمولات والباقات','نماذج مجانية وعمولات وباقات احترافية مع قابلية تخصيص حسب المجال.','FINANCE')+workspaceCards([['الباقة المجانية','أساسي','وجود أساسي داخل المنصة'],['نظام العمولة','Usage','عمولة على العمليات المؤهلة'],['احترافي — 1','مخصص','مزايا إضافية وظهور أكبر'],['احترافي — 2','مخصص','تسويق وتقارير متقدمة'],['احترافي — 3','مخصص','إدارة متقدمة للمجالات'],['التسويات','مراجعة','الربط مع النواة المالية الفعلية']])+(['OWNER','BUSINESS_OWNER','ADMIN','MANAGER','ACCOUNTANT','FINANCE','FINANCE_MANAGER'].includes(String(live.role||'').toUpperCase())?'<div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="postFinancialJournal()">+ ترحيل قيد مالي</button></div>':'')}


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
function pushSupported(){return window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&!!window.MNTY_WEB_PUSH_PUBLIC_KEY}
function pushButtonHtml(){return pushSupported()?'<button class="btn btn-outline" id="device-push-toggle" style="width:auto">🔔 تفعيل إشعارات الجهاز</button>':''}
function pushButtonState(){const b=document.getElementById('device-push-toggle');if(!b)return;if(!pushSupported()){b.hidden=true;return}b.hidden=false;const p=Notification.permission;if(p==='granted')b.textContent='🔔 إشعارات الجهاز مفعلة';else if(p==='denied')b.textContent='🔕 إشعارات الجهاز محظورة';else b.textContent='🔔 تفعيل إشعارات الجهاز'}
function base64UrlToUint8Array(value){const pad='='.repeat((4-(value.length%4))%4);const base64=(value+pad).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)))}
function uint8ToBase64Url(value){let s='';for(const b of value)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function pushSubscriptionPayload(subscription){const json=subscription.toJSON();const p256dh=json?.keys?.p256dh||uint8ToBase64Url(new Uint8Array(subscription.getKey('p256dh')||[]));const auth=json?.keys?.auth||uint8ToBase64Url(new Uint8Array(subscription.getKey('auth')||[]));return {endpoint:subscription.endpoint,p256dh,auth,user_agent:navigator.userAgent,platform:navigator.platform||''}}
async function enableDevicePush(){
 if(!user?.id)return authView();
 if(!pushSupported())return showToast('إشعارات الجهاز غير مدعومة في هذا المتصفح أو السياق الحالي.','error');
 if(Notification.permission==='denied'){pushButtonState();return showToast('تم حظر الإشعارات لهذا الموقع من إعدادات المتصفح.','error')}
 try{
  const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
  if(permission!=='granted'){pushButtonState();return showToast('لم يتم منح إذن إشعارات الجهاز.','error')}
  const registration=await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToUint8Array(window.MNTY_WEB_PUSH_PUBLIC_KEY)});
  const payload=pushSubscriptionPayload(subscription);
  const {error}=await sb.rpc('upsert_mnty_push_subscription',{p_endpoint:payload.endpoint,p_p256dh:payload.p256dh,p_auth:payload.auth,p_user_agent:payload.user_agent,p_platform:payload.platform});
  if(error)throw error;
  pushButtonState();
  showToast('تم تفعيل إشعارات الجهاز لهذا الحساب.','success');
 }catch(e){console.error(e);showToast('تعذر تفعيل إشعارات الجهاز: '+(e?.message||'خطأ غير معروف'),'error');pushButtonState()}
}
async function disableCurrentPushSubscription(){
 try{
  if(!pushSupported()||!user?.id)return;
  const registration=await navigator.serviceWorker.ready;
  const subscription=await registration.pushManager.getSubscription();
  if(subscription){
   await sb.rpc('disable_mnty_push_subscription',{p_endpoint:subscription.endpoint});
  }
 }catch(_){}
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
 const memberships=(live.memberships||[]).filter(m=>m.status==='ACTIVE');
 let requests=[];
 if(user?.id){
  const {data,error}=await sb.from('account_registration_requests').select('id,requested_role,status,reason,created_at,reviewed_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20);
  if(error)return showToast('تعذر تحميل طلبات العضوية: '+error.message,'error');
  requests=data||[];
 }
 const activeRoles=new Set(memberships.map(m=>String(m.role||'').toUpperCase()));
 const pendingRoles=new Set(requests.filter(r=>r.status==='PENDING').map(r=>String(r.requested_role||'').toUpperCase()));
 const roleOption=(role,label)=>activeRoles.has(role)||pendingRoles.has(role)?'':('<button class="btn btn-outline" id="request-'+role.toLowerCase()+'">'+label+'</button>');
 const requestRows=requests.length?'<div class="request-list">'+requests.slice(0,8).map(r=>'<div class="request-row"><span>'+esc(roleLabel(r.requested_role))+'</span><b>'+esc(r.status==='PENDING'?'قيد المراجعة':r.status==='APPROVED'?'معتمد':'مرفوض')+'</b></div>').join('')+'</div>':'<p class="muted">لا توجد طلبات عضوية إضافية.</p>';
 const membershipRows=memberships.length?'<div class="request-list">'+memberships.map(m=>'<div class="request-row"><span>'+esc(roleContextLabel(m))+'</span><b>نشطة</b></div>').join('')+'</div>':'<p class="muted">لا توجد عضوية تشغيلية نشطة.</p>';
 const requestButtons=roleOption('CUSTOMER','طلب دور عميل')+roleOption('SERVICE_PROVIDER','طلب دور صاحب نشاط / مقدم خدمة');
 const privilegedNote='<p class="muted">الأدوار الإدارية الحساسة مثل Owner وAdmin وManager لا تُمنح بطلب ذاتي؛ يتم ربطها واعتمادها من الإدارة وفق الصلاحيات والسياسات.</p>';
 document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card"><div class="brand">'+mark()+'<span>Mantiqati X</span></div><div class="gradient-line"></div><h1>حسابي</h1><p>الحساب: <b>'+esc(user?.email||'—')+'</b></p><h3>عضوياتي الحالية</h3>'+membershipRows+'<h3>طلبات العضوية الإضافية</h3>'+requestRows+'<div class="action-bar">'+requestButtons+'</div>'+privilegedNote+'<div class="action-bar"><button class="btn btn-primary" id="account-home">العودة للرئيسية</button><button class="btn btn-outline" id="account-logout">تسجيل الخروج</button></div></section></main>';
 document.getElementById('account-home').onclick=()=>{window.MXHomeLanding?MXHomeLanding():landingView()};
 document.getElementById('account-logout').onclick=logout;
 const submitRole=async role=>{authRegistrationType=role;await submitRegistrationRequest(role);};
 document.getElementById('request-customer')?.addEventListener('click',()=>submitRole('CUSTOMER'));
 document.getElementById('request-service_provider')?.addEventListener('click',()=>submitRole('SERVICE_PROVIDER'));
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
async function submitRegistrationRequest(requestedRole=authRegistrationType){
 if(!user?.id)return;
 const role=String(requestedRole||'').toUpperCase();
 if(!['CUSTOMER','SERVICE_PROVIDER'].includes(role))return showToast('هذا الدور لا يُطلب ذاتيًا من الحساب.','error');
 const active=live.memberships||[];
 if(active.some(m=>m.status==='ACTIVE'&&String(m.role||'').toUpperCase()===role)){
  return showToast('هذا الدور مرتبط بالحساب بالفعل.','error');
 }
 const {data:existing,error:existingError}=await sb.from('account_registration_requests')
  .select('id,requested_role,status')
  .eq('user_id',user.id)
  .eq('requested_role',role)
  .in('status',['PENDING','APPROVED'])
  .order('created_at',{ascending:false})
  .limit(1)
  .maybeSingle();
 if(existingError)return showToast('تعذر التحقق من طلب العضوية: '+existingError.message,'error');
 if(existing?.status==='APPROVED')return showToast('هذا الدور معتمد بالفعل أو تم ربطه بالحساب.','success');
 if(existing?.status==='PENDING')return showToast('يوجد طلب قيد المراجعة لهذا الدور بالفعل.','error');
 const {data,error}=await sb.from('account_registration_requests')
  .insert({user_id:user.id,requested_role:role,status:'PENDING',metadata:{source:'account_membership_request',brand:'Mantiqati X'}})
  .select('requested_role,status')
  .single();
 if(error){
  if(error.code==='23505')return showToast('يوجد طلب قيد المراجعة لهذا الدور بالفعل.','error');
  return showToast('تعذر إنشاء طلب العضوية: '+error.message,'error');
 }
 showToast('تم إرسال طلب العضوية الإضافية للمراجعة.','success');
 await accountView();
}
async function openPlatform(){if(!user?.id){return typeof authView==='function'?authView():null}return renderApp()}
async function enterAuthenticatedApp(authUser){
if(!authUser?.id)return;
if(user?.id===authUser.id&&window.MNTYAuthState?.authenticated)return;
user=authUser;
window.MNTYAuthState={authenticated:true,email:authUser.email||'',membership:false};
if(authRenderLock)return;
authRenderLock=true;
try{
 await renderApp();
 let pending=null;
 try{pending=JSON.parse(localStorage.getItem('MNTYPendingRegistration')||'null')}catch(_){}
 if(pending&&String(pending.email||'').toLowerCase()===String(authUser.email||'').toLowerCase()&&['CUSTOMER','SERVICE_PROVIDER'].includes(String(pending.role||'').toUpperCase())){
   try{localStorage.removeItem('MNTYPendingRegistration')}catch(_){}
   await submitRegistrationRequest(String(pending.role).toUpperCase());
 }
 let pendingProvider=null;
 try{pendingProvider=JSON.parse(localStorage.getItem('MNTYPendingProvider')||'null')}catch(_){}
 if(pendingProvider?.businessId&&String(live.role||'').toUpperCase()==='CUSTOMER'&&typeof openProviderCatalog==='function'){
   try{localStorage.removeItem('MNTYPendingProvider')}catch(_){}
   await openProviderCatalog(String(pendingProvider.businessId),String(pendingProvider.providerName||'مقدم الخدمة'));
 }
 let pendingAdBooking=false;
 try{pendingAdBooking=localStorage.getItem('MNTYOpenAdBooking')==='1'}catch(_){}
 if(pendingAdBooking&&typeof selectModule==='function'){
   try{localStorage.removeItem('MNTYOpenAdBooking');selectModule('التسويق والإعلان')}catch(_){}
 }
}finally{authRenderLock=false}
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
async function renderApp(){if(!user?.id)return;live.loading=true;document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card"><div class="brand">'+mark()+'<span>Mantiqati X</span></div><div class="gradient-line"></div><h1>جاري تحميل المنصة</h1><p>يتم التحقق من الجلسة وتحميل بيانات حسابك وصلاحياتك...</p></section></main>';await loadLiveData();if(live.error){document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card"><div class="brand">'+mark()+'<span>Mantiqati X</span></div><div class="gradient-line"></div><h1>تعذر تحميل البيانات</h1><p>'+esc(live.error)+'</p><button class="btn btn-primary" id="retry-load">إعادة المحاولة</button><button class="text-btn" id="logout-load">خروج</button></section></main>';document.getElementById('retry-load').onclick=renderApp;document.getElementById('logout-load').onclick=logout;return}if(!live.memberships.length){membershipRequiredView();return}window.MNTYAuthState={authenticated:true,email:user?.email||'',membership:true,role:live.role};await loadDomainModule(current);document.getElementById('app').innerHTML=`<div class="shell"><aside class="sidebar"><div class="side-brand"><div class="brand">${mark()}<span>MNTY</span></div><div class="gradient-line"></div></div><div class="side-caption">منصة التسويق والربط</div><nav class="nav">${modules.filter(m=>moduleEnabled(m[1])&&!(isCustomerMode()&&['الموديولات','المستخدمون وCRM','العمولات والباقات','التقارير والتحليلات','طلبات التسجيل'].includes(m[1]))&& (m[1]!=='طلبات التسجيل'||['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase()))).map(m=>`<button class="${m[1]===current?'active':''}" onclick="selectModule('${m[1]}')"><span>${m[0]}</span><span>${m[1]}</span></button>`).join('')}</nav><div class="side-support">خدمة العملاء<br><b>01010171770</b></div></aside><main class="content"><header class="top"><div><div class="breadcrumb">MNTY / ${current}</div><h1>${current}</h1><div class="user" id="user">${esc(user?.email||'')} · ${esc(live.role)}</div></div><div class="top-actions">${roleSwitcher()}${pushButtonHtml()}${live.myProviderProfile?'<button class="btn btn-outline" id="manage-provider-profile" style="width:auto">🖼️ صورة نشاطي</button>':''}<label class="search">⌕ <input id="search" value="${esc(query)}" placeholder="بحث داخل المنصة..."></label><button class="btn btn-outline" id="go-public-home">الرئيسية</button><button class="btn btn-outline" id="account-open">حسابي</button><button class="logout" id="logout">خروج</button></div></header><div id="page">${enhancedPageContent()}</div></main></div>`;document.getElementById('logout').onclick=logout;document.getElementById('go-public-home')?.addEventListener('click',()=>window.MXHomeLanding?window.MXHomeLanding():landingView());document.getElementById('account-open')?.addEventListener('click',accountView);document.getElementById('device-push-toggle')?.addEventListener('click',enableDevicePush);pushButtonState();const roleSwitch=document.getElementById('mx-role-switcher');if(roleSwitch)roleSwitch.onchange=e=>switchMembership(e.target.value);const profileBtn=document.getElementById('manage-provider-profile');if(profileBtn)profileBtn.onclick=()=>selectModule('ملف نشاطي');const providerSave=document.getElementById('provider-image-save');if(providerSave)providerSave.onclick=saveProviderProfileImage;const providerFile=document.getElementById('provider-image-file');const providerPreview=document.getElementById('provider-image-preview');if(providerFile&&providerPreview)providerFile.onchange=()=>{const file=providerFile.files?.[0];if(!file){providerPreview.textContent='اختر صورة لمعاينتها قبل الحفظ.';return}if(!/^image\/(jpeg|png|webp)$/.test(file.type)){providerPreview.textContent='صيغة غير مدعومة. استخدم JPG أو PNG أو WebP.';return}if(file.size>5*1024*1024){providerPreview.textContent='الصورة أكبر من 5MB.';return}const url=URL.createObjectURL(file);providerPreview.innerHTML='<img src="'+esc(url)+'" alt="معاينة صورة النشاط">';providerPreview.querySelector('img')?.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true})};const si=document.getElementById('search');si.oninput=e=>{query=e.target.value;document.getElementById('page').innerHTML=enhancedPageContent()}}
sb.auth.onAuthStateChange((event,session)=>{
if(event==='SIGNED_OUT'){
user=null;window.MNTYAuthState={authenticated:false,email:'',membership:false};window.MNTYActiveMembershipId=null;live.memberships=[];live.activeMembershipId=null;live.role='CUSTOMER';live.businessId=null;live.tenantId=null;live.organizationId=null;live.branchId=null;live.permissions={};current='الرئيسية';query='';
window.MXHomeLanding?MXHomeLanding():landingView();return;
}
if(session?.user&&!authRenderLock)enterAuthenticatedApp(session.user);
});
window.MNTYBootAuth=bootAuth;
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',bootAuth,{once:true});else bootAuth();