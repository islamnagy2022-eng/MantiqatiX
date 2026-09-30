const {createClient}=window.supabase;
const cfg=window.MANTIQATIX_CONFIG;
const sb=createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'pkce'}});

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
let current='الرئيسية', query='', user=null, deferredInstallPrompt=null, authBooted=false, authRenderLock=false, authIntent='login', authRegistrationType='CUSTOMER', authSendInFlight=false;
const live={memberships:[],activeMembershipId:null,role:'CUSTOMER',businessId:null,tenantId:null,organizationId:null,branchId:null,permissions:{},counts:{},flags:{},records:{leads:[],providers:[],orders:[],notifications:[],orderHistory:[],supportTickets:[],ads:[],projects:[],services:[],providerServices:[],registrationRequests:[]},catalogByBusiness:{},moduleData:{},myProviderProfile:null,loading:false,error:null};
const countOrDash=key=>{const value=live.counts?.[key];return value===null||value===undefined||value===''?'—':String(value)};
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
 const preferredIds=[live.activeMembershipId,savedId].filter(Boolean);
 const active=preferredIds.map(id=>live.memberships.find(m=>m.id===id)).find(Boolean)||live.memberships[0];
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
 const supportManager=['SUPER_ADMIN','ADMIN','OWNER','BUSINESS_OWNER','SUPPORT','SUPPORT_MANAGER'].includes(orderRole);
 const crmManager=['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'].includes(orderRole);
 const leadSpec=crmManager?['marketing_leads',null,null,'leads']:['marketing_leads','requester_user_id',uid,'leads'];
 const providerSpec=crmManager?['marketing_provider_profiles',null,null,'providers']:['marketing_provider_profiles','owner_user_id',uid,'providers'];
 const supportSpec=supportManager?['support_tickets',null,null,'support']:['support_tickets','requester_id',uid,'support'];
 const orderSpec=(['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER','SERVICE_PROVIDER'].includes(orderRole)&&live.businessId)
   ? ['orders','business_id',live.businessId,'orders']
   : (orderRole==='SUPER_ADMIN'&&!live.businessId?['orders',null,null,'orders']:orderCountSpec);
 const specs=[['advertisements',null,null,'ads'],['marketing_projects',crmManager?null:(live.businessId?'client_business_id':null),crmManager?null:live.businessId,'projects'],['notifications','user_id',uid,'notifications'],supportSpec,leadSpec,providerSpec,orderSpec];
 if(live.businessId)specs.push(['businesses','id',live.businessId,'businesses']);
 const results=await Promise.all(specs.map(x=>safeCount(x[0],x[1],x[2])));
 specs.forEach((x,i)=>{if(results[i]!==null)live.counts[x[3]]=results[i]});
 const fq=sb.from('platform_feature_flags').select('module_code,feature_code,enabled,configuration');
 if(live.businessId)fq.or(`scope_type.eq.PLATFORM,business_id.eq.${live.businessId}`);else fq.eq('scope_type','PLATFORM');
 const fr=await fq;if(fr.error)throw fr.error;
 (fr.data||[]).forEach(x=>{live.flags[`${x.module_code||''}:${x.feature_code||''}`]=x});
 const [leadsRes,providersRes,ordersRes,notificationsRes,ticketsRes,adsRes,projectsRes,servicesRes]=await Promise.all([
  (()=>{const q=sb.from('marketing_leads').select('id,title,status,source,created_at').order('created_at',{ascending:false}).limit(10);if(!crmManager)q.eq('requester_user_id',uid);return q})(),
  (()=>{const q=sb.from('marketing_provider_profiles').select('id,business_id,name_ar,provider_kind,status,is_verified,created_at').order('created_at',{ascending:false}).limit(10);if(!crmManager)q.eq('owner_user_id',uid);return q})(),
  (()=>{const oq=sb.from('orders').select('id,tenant_id,status,total_amount,currency,customer_id,business_id,customer_name,created_at').order('created_at',{ascending:false}).limit(10);if(orderRole==='SUPER_ADMIN'&&!live.businessId){}else if(['ADMIN','OWNER','MANAGER','BUSINESS_OWNER','SERVICE_PROVIDER'].includes(orderRole)&&live.businessId)oq.eq('business_id',live.businessId);else oq.eq('customer_id',uid);return oq})(),
  sb.from('notifications').select('id,title,body,read_at,created_at').order('created_at',{ascending:false}).limit(10),
  (()=>{const q=sb.from('support_tickets').select('id,subject,description,category,priority,status,assigned_user_id,created_at,updated_at,closed_at').order('created_at',{ascending:false}).limit(10);if(!supportManager)q.eq('requester_id',uid);return q})(),
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
async function openPrivilegedWorkspace(preferredRole='OWNER'){
 if(!user?.id)return authView();
 try{
  const {data:rows,error}=await sb.from('user_memberships')
   .select('id,tenant_id,organization_id,business_id,branch_id,role,permissions,status')
   .eq('user_id',user.id).eq('status','ACTIVE');
  if(error)throw error;
  const memberships=rows||[];
  live.memberships=memberships;
  const preferred=String(preferredRole||'OWNER').toUpperCase();
  const target=memberships.find(m=>String(m.role||'').toUpperCase()===preferred)
    ||memberships.find(m=>['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER','SERVICE_PROVIDER'].includes(String(m.role||'').toUpperCase()));
  if(!target)return showToast('لا توجد عضوية تشغيلية فعالة لهذا الحساب.','error');
  window.MNTYActiveMembershipId=target.id;
  localStorage.setItem('MNTYActiveMembershipId',target.id);
  window.MNTYAdminReturnMembershipId=null;
  localStorage.removeItem('MNTYAdminReturnMembershipId');
  live.activeMembershipId=target.id;
  live.role=String(target.role||'CUSTOMER').toUpperCase();
  live.businessId=target.business_id||null;
  live.tenantId=target.tenant_id||null;
  live.organizationId=target.organization_id||null;
  live.branchId=target.branch_id||null;
  live.permissions=target.permissions||{};
  current='الرئيسية'; query='';
  await renderApp({forceWorkspace:true});
  showToast('تم فتح مساحة التشغيل بدور: '+roleLabel(target.role),'success');
 }catch(e){
  showToast('تعذر فتح مساحة التشغيل: '+(e?.message||'خطأ غير معروف'),'error');
 }
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
function cleanAuthUrl(){
 try{
  const url=new URL(window.location.href);
  const hasAuthParams=url.hash.includes('access_token=')||url.hash.includes('refresh_token=')||url.hash.includes('code=')||url.searchParams.has('code')||url.searchParams.has('error')||url.searchParams.has('token_hash');
  if(hasAuthParams)history.replaceState({},document.title,url.pathname);
 }catch(_){}
}
function oauthRedirectUrl(){return window.location.origin+window.location.pathname+window.location.search.split('#')[0].replace(/\\?$/,'');}
async function signInWithGoogle(intent='login'){
 if(authSendInFlight)return;
 authSendInFlight=true;
 const role=String(intent==='register'?authRegistrationType:'').toUpperCase();
 if(intent==='register')try{localStorage.setItem('MNTYPendingRegistration',JSON.stringify({role:role||'CUSTOMER',source:'google',createdAt:Date.now()}))}catch(_){}
 try{
  const {data,error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:oauthRedirectUrl(),queryParams:{access_type:'online',prompt:'select_account'}}});
  if(error)throw error;
  if(!data?.url)throw new Error('GOOGLE_OAUTH_URL_MISSING');
  window.location.assign(data.url);
 }catch(e){
  try{localStorage.removeItem('MNTYPendingRegistration')}catch(_){}
  console.error('[MantiqatiX][GoogleAuth]',e);
  authView('تعذر بدء تسجيل الدخول بحساب Google: '+(e?.message||'خطأ غير معروف'),'',intent);
 }finally{authSendInFlight=false}
}
function authView(msg='',emailValue='',mode=authIntent){
 authIntent=mode||'login';
 document.getElementById('app').innerHTML=`<main class="auth"><section class="auth-card"><div class="brand">${mark()}<span>MantiqatiX</span></div><div class="gradient-line"></div><h1>${authIntent==='register'?'تسجيل مستخدم جديد':'تسجيل الدخول'}</h1><p>${authIntent==='register'?'استخدم حساب Google للتحقق من هويتك وإنشاء حساب MantiqatiX. لا تُمنح الصلاحيات التشغيلية إلا وفق العضوية المعتمدة.':'استخدم حساب Google فقط للدخول بأمان إلى MantiqatiX. سيجري التحقق عبر Google ثم تعود مباشرة إلى المنصة.'}</p>${authIntent==='register'?'<div class="field"><label>نوع التسجيل</label><select id="registration-type"><option value="CUSTOMER">عميل — يُفعّل تلقائيًا لكل حساب</option><option value="SERVICE_PROVIDER">عميل + طلب مقدم خدمة</option></select></div>':''}<button class="btn btn-primary" id="google-auth" type="button">🔐 ${authIntent==='register'?'التسجيل بحساب Google':'الدخول بحساب Google'}</button><button class="auth-switch-btn" id="switch-auth" type="button">${authIntent==='register'?'لدي حساب بالفعل؟ تسجيل الدخول':'مستخدم جديد؟ إنشاء حساب'}</button>${msg?`<div class="msg">${esc(msg)}</div>`:''}</section></main>`;
 document.getElementById('google-auth').onclick=()=>{
  if(authIntent==='register')authRegistrationType=document.getElementById('registration-type')?.value||'CUSTOMER';
  signInWithGoogle(authIntent);
 };
 document.getElementById('switch-auth').onclick=()=>authView('', '',authIntent==='register'?'login':'register');
}
async function enterAuthenticatedApp(authUser,options={}){
if(!authUser?.id)return;
const force=options?.force===true;
if(!force&&user?.id===authUser.id&&window.MNTYAuthState?.authenticated)return;
user=authUser;
window.MNTYAuthState={authenticated:true,email:authUser.email||'',membership:false};
if(authRenderLock)return;
authRenderLock=true;
try{
 let pending=null;
 try{pending=JSON.parse(localStorage.getItem('MNTYPendingRegistration')||'null')}catch(_){}
 if(!pending){
   const {data:membershipRows,error:membershipError}=await sb.from('user_memberships').select('id').eq('user_id',authUser.id).eq('status','ACTIVE').limit(1);
   if(membershipError)throw membershipError;
   if(!(membershipRows||[]).length){
     const {data:activation,error:activationError}=await sb.functions.invoke('mnty-customer-registration',{body:{tenant_id:'MNTY-PLATFORM'}});
     if(activationError)throw activationError;
     if(activation?.error)throw new Error(activation.error);
   }
 }
 await renderApp({forceWorkspace:true});
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
cleanAuthUrl();
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
async function renderApp(options={}){if(!user?.id)return;live.loading=true;document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card"><div class="brand">'+mark()+'<span>MantiqatiX</span></div><div class="gradient-line"></div><h1>جاري تحميل المنصة</h1><p>يتم التحقق من الجلسة وتحميل بيانات حسابك وصلاحياتك...</p></section></main>';await loadLiveData();if(live.error){document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card"><div class="brand">'+mark()+'<span>MantiqatiX</span></div><div class="gradient-line"></div><h1>تعذر تحميل البيانات</h1><p>'+esc(live.error)+'</p><button class="btn btn-primary" id="retry-load">إعادة المحاولة</button><button class="text-btn" id="logout-load">خروج</button></section></main>';document.getElementById('retry-load').onclick=renderApp;document.getElementById('logout-load').onclick=logout;return}if(!live.memberships.length){membershipRequiredView();return}window.MNTYAuthState={authenticated:true,email:user?.email||'',membership:true,role:live.role};if(isCustomerMode()){window.MNTYAdminReturnMembershipId=live.memberships.find(m=>['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER','SERVICE_PROVIDER'].includes(String(m.role||'').toUpperCase())&&m.status==='ACTIVE')?.id||null;if(window.MNTYAdminReturnMembershipId)localStorage.setItem('MNTYAdminReturnMembershipId',window.MNTYAdminReturnMembershipId);else localStorage.removeItem('MNTYAdminReturnMembershipId');if(typeof window.MXHomeLanding==='function'){window.MXHomeLanding();return}if(typeof window.landingView==='function'){window.landingView();return}return}if(!options.forceWorkspace){const privileged=live.memberships.find(m=>['SUPER_ADMIN','ADMIN','OWNER','MANAGER'].includes(String(m.role||'').toUpperCase())&&m.status==='ACTIVE');if(privileged){window.MNTYAdminReturnMembershipId=privileged.id;localStorage.setItem('MNTYAdminReturnMembershipId',privileged.id);}else{window.MNTYAdminReturnMembershipId=null;localStorage.removeItem('MNTYAdminReturnMembershipId');}if(typeof window.MXHomeLanding==='function'){window.MXHomeLanding();return}if(typeof window.landingView==='function'){window.landingView();return}}await loadDomainModule(current);document.getElementById('app').innerHTML=`<div class="shell"><aside class="sidebar"><div class="side-brand"><div class="brand">${mark()}<span>MantiqatiX</span></div><div class="gradient-line"></div></div><div class="side-caption">منصة التسويق والربط</div><nav class="nav">${modules.filter(m=>moduleEnabled(m[1])&&(!isCustomerMode()||['الرئيسية','المجالات والخدمات','التجارة والأزياء','البقالة والسوبر ماركت','المطاعم والمطابخ','المنظومة الطبية','الصيانة','الخدمات المهنية','MantiGO والمزايدات','الزواج','الوظائف','التعليم','المستعمل','الطلبات والعمليات','الدعم والحوكمة'].includes(m[1]))&&(m[1]!=='طلبات التسجيل'||['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase()))).map(m=>`<button class="${m[1]===current?'active':''}" onclick="selectModule('${m[1]}')"><span>${m[0]}</span><span>${isCustomerMode()&&m[1]==='الدعم والحوكمة'?'الدعم':m[1]}</span></button>`).join('')}</nav><div class="side-support">خدمة العملاء<br><b>01010171770</b></div></aside><main class="content"><header class="top"><div><div class="breadcrumb">MantiqatiX / ${current}</div><h1>${current}</h1><div class="user" id="user">${esc(user?.email||'')} · ${esc(live.role)}</div></div><div class="top-actions">${roleSwitcher()}${pushButtonHtml()}${live.myProviderProfile?'<button class="btn btn-outline" id="manage-provider-profile" style="width:auto">🖼️ صورة نشاطي</button>':''}<label class="search">⌕ <input id="search" value="${esc(query)}" placeholder="بحث داخل المنصة..."></label><button class="btn btn-outline" id="go-public-home">الرئيسية</button><button class="btn btn-outline" id="account-open">حسابي</button><button class="logout" id="logout">خروج</button></div></header><div id="page">${enhancedPageContent()}</div></main></div>`;document.getElementById('logout').onclick=logout;document.getElementById('go-public-home')?.addEventListener('click',()=>selectModule('الرئيسية'));document.getElementById('account-open')?.addEventListener('click',accountView);document.getElementById('device-push-toggle')?.addEventListener('click',enableDevicePush);pushButtonState();const roleSwitch=document.getElementById('mx-role-switcher');if(roleSwitch)roleSwitch.onchange=e=>switchMembership(e.target.value);const profileBtn=document.getElementById('manage-provider-profile');if(profileBtn)profileBtn.onclick=()=>selectModule('ملف نشاطي');const providerSave=document.getElementById('provider-image-save');if(providerSave)providerSave.onclick=saveProviderProfileImage;const providerFile=document.getElementById('provider-image-file');const providerPreview=document.getElementById('provider-image-preview');if(providerFile&&providerPreview)providerFile.onchange=()=>{const file=providerFile.files?.[0];if(!file){providerPreview.textContent='اختر صورة لمعاينتها قبل الحفظ.';return}if(!/^image\/(jpeg|png|webp)$/.test(file.type)){providerPreview.textContent='صيغة غير مدعومة. استخدم JPG أو PNG أو WebP.';return}if(file.size>5*1024*1024){providerPreview.textContent='الصورة أكبر من 5MB.';return}const url=URL.createObjectURL(file);providerPreview.innerHTML='<img src="'+esc(url)+'" alt="معاينة صورة النشاط">';providerPreview.querySelector('img')?.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true})};const si=document.getElementById('search');si.oninput=e=>{query=e.target.value;document.getElementById('page').innerHTML=enhancedPageContent()}}
sb.auth.onAuthStateChange((event,session)=>{
if(event==='SIGNED_OUT'){
user=null;window.MNTYAuthState={authenticated:false,email:'',membership:false};window.MNTYActiveMembershipId=null;live.memberships=[];live.activeMembershipId=null;live.role='CUSTOMER';live.businessId=null;live.tenantId=null;live.organizationId=null;live.branchId=null;live.permissions={};current='الرئيسية';query='';
window.MXHomeLanding?MXHomeLanding():landingView();return;
}
if(session?.user&&!authRenderLock)enterAuthenticatedApp(session.user);
});
// Explicit browser globals used by the public landing page buttons.
window.openPlatform=openPlatform;
window.selectModule=selectModule;
window.authView=authView;
window.accountView=accountView;
window.renderApp=renderApp;
window.MNTYBootAuth=bootAuth;
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',bootAuth,{once:true});else bootAuth();