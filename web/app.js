const {createClient}=window.supabase;
const cfg=window.MANTIQATIX_CONFIG;
const sb=window.MNTY_SB || createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
window.MNTY_SB=sb;

async function invokeMntyFunction(name,body){
 const {data:{session},error:sessionError}=await sb.auth.getSession();
 if(sessionError)throw sessionError;
 if(!session?.access_token)throw new Error('AUTH_REQUIRED');
 const res=await fetch(cfg.supabaseUrl+'/functions/v1/'+encodeURIComponent(name),{
  method:'POST',
  cache:'no-store',
  headers:{'Content-Type':'application/json','Accept':'application/json','apikey':cfg.supabaseKey,'Authorization':'Bearer '+session.access_token},
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
['🛡️','التحكم الكامل','إنشاء وإدارة الأنشطة والفروع والخدمات والأسعار واعتماد مقدمي الخدمة'],
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
const SECTOR_PRESENTATION={
 FOOD:['🍽️','مطاعم وكافيهات','الطلبات والعروض وإدارة النشاط'],
 HEALTH:['🩺','الأطباء والعيادات','ملفات الأطباء، التخصصات، الباقات، الترشيحات والعمولات'],
 PHARMACY:['💊','الصيدليات','الخدمات والمنتجات، الباقات، الطلبات والعمولات'],
 LABS:['🧪','معامل التحاليل','المعامل، الخدمات، الترشيحات والعمولات'],
 RADIOLOGY:['🩻','مراكز الأشعة','مراكز الأشعة، الخدمات، الترشيحات والعمولات'],
 DENTAL:['🦷','الأسنان والعيادات التخصصية','أطباء الأسنان والخدمات والحجوزات'],
 HOSPITAL:['🏥','المستشفيات الخاصة','الأقسام والخدمات والباقات والترشيحات'],
 MEDICAL:['🏥','مراكز طبية','التشخيص والرعاية والخدمات الطبية المتكاملة'],
 REAL_ESTATE:['🏠','العقارات','البيع والإيجار والخدمات العقارية'],
 AUTO:['🚗','السيارات والنقل','السيارات والصيانة وخدمات النقل'],
 MAINTENANCE:['🔧','الصيانة والخدمات المنزلية','مقدمو الخدمة والطلبات والترشيحات'],
 ACCOUNTING:['🧾','المحاسبة ومكاتب المحاسبة','المحاسبون والمكاتب والخدمات المالية'],
 LEGAL:['⚖️','المحاماة والخدمات القانونية','المحامون والمكاتب والوثائق والاستشارات'],
 COMPANIES:['🏢','الشركات والموردون','الشركات والمصانع والموردون وخدمات الأعمال'],
 EDU:['🎓','التعليم والتدريب','المدارس والمدرسون ومراكز التدريب'],
 DIGITAL:['📣','التسويق والإعلان','الشركة وشركات التسويق والعملاء والحملات'],
 TECH:['💻','البرمجيات والخدمات الرقمية','البرمجيات والمواقع والخدمات التقنية'],
 FITNESS:['💪','الرياضة واللياقة','الأندية والمدربون'],
 TRAVEL:['✈️','السفر والرحلات','الوكلاء والرحلات والحجوزات'],
 MANTIGO:['🚕','MantiGO والنقل عند الطلب','الرحلات والعروض والسائقون'],
 JOBS:['💼','الوظائف والتوظيف','أصحاب الأعمال والوظائف والمتقدمون'],
 MATRIMONY:['💍','الزواج والخدمات المرتبطة','الملفات والخدمات والترشيحات'],
 USED_ITEMS:['♻️','المستعمل','الإعلانات والعروض والتفاوض'],
 FASHION:['👗','الأزياء والخياطة','المتاجر والمنتجات والخدمات'],
 GROCERY:['🛒','السوبر ماركت والبقالة','المنتجات والطلبات والمخزون'],
 VETERINARY:['🐾','الخدمات البيطرية','العيادات والأطباء والخدمات البيطرية'],
 FREELANCER:['🤝','المستقلون ومقدمو الخدمات','الخدمات الاحترافية والمشروعات المستقلة']
};
const sectors=Object.freeze((window.MX_SECTOR_REGISTRY?.CANONICAL_SECTORS||[]).map(s=>{
 const p=SECTOR_PRESENTATION[s.code]||['◉',s.label,'الخدمات والأنشطة ضمن هذا القطاع'];
 return [p[0],p[1],p[2],s.code,s.backend];
}));
let current='الرئيسية', query='', user=null, deferredInstallPrompt=null, authBooted=false, authRenderLock=false, authIntent='login', authRegistrationType='CUSTOMER', authSendInFlight=false, authVerificationInFlight=false;
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
 // Resolve human-readable activity names for the signed-in user's own memberships.
 // This is best-effort only; authorization remains enforced by RLS/server paths.
 const businessIds=[...new Set(live.memberships.map(x=>x.business_id).filter(Boolean))];
 if(businessIds.length){
   try{
     const [br,pr]=await Promise.all([
       sb.from('businesses').select('id,name,code,settings,status').in('id',businessIds),
       sb.from('marketing_provider_profiles').select('id,business_id,name_ar,name_en,provider_kind,status,is_verified,profile_image_path,updated_at').in('business_id',businessIds).order('updated_at',{ascending:false})
     ]);
     if(!br.error){
       const businessMap=new Map((br.data||[]).map(b=>[String(b.id),b]));
       const providerMap=new Map();
       (pr.error?[]:(pr.data||[])).forEach(p=>{const key=String(p.business_id||'');if(key&&!providerMap.has(key))providerMap.set(key,p);});
       const sectionName=(code,business,provider)=>{
         const normalized=String(code||business?.settings?.activity_code||business?.settings?.category_code||provider?.provider_kind||'').toUpperCase();
         const canonical=window.MX_SECTOR_REGISTRY?.BACKEND_TO_PUBLIC_SECTOR?.[normalized]||normalized;
         const presentation=SECTOR_PRESENTATION[canonical]||SECTOR_PRESENTATION[normalized];
         return presentation?.[1]||normalized||'غير محدد';
       };
       live.memberships=live.memberships.map(m=>{
         const b=businessMap.get(String(m.business_id));
         const p=providerMap.get(String(m.business_id));
         const activityCode=String(b?.settings?.activity_code||b?.settings?.category_code||p?.provider_kind||'').toUpperCase();
         return {...m,
           business_name:b?.name||p?.name_ar||p?.name_en||'نشاط مرتبط',
           business_code:b?.code||null,
           business_section:sectionName(activityCode,b,p),
           business_section_code:activityCode||null,
           business_icon:b?.settings?.icon||'🏢',
           business_image_path:p?.profile_image_path||null,
           business_verified:Boolean(p?.is_verified)
         };
       });
     }
   }catch(_){}
 }
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
 const myProviderRes=await sb.from('marketing_provider_profiles').select('id,business_id,name_ar,name_en,provider_kind,description,service_areas,profile_image_path,settings,updated_at,status,is_verified,is_featured').eq('owner_user_id',uid).order('updated_at',{ascending:false}).limit(1).maybeSingle();
 if(myProviderRes.error)throw myProviderRes.error;
 live.myProviderProfile=myProviderRes.data||null;
 if(live.myProviderProfile){const ps=await sb.from('marketing_provider_services').select('id,provider_id,service_id,service_description,pricing_from,pricing_to,currency,status,created_at').eq('provider_id',live.myProviderProfile.id).order('created_at',{ascending:false}).limit(50);if(ps.error)throw ps.error;live.records.providerServices=ps.data||[];}
 const financeRoles=['OWNER','BUSINESS_OWNER','ADMIN','MANAGER','ACCOUNTANT','FINANCE','FINANCE_MANAGER','SUPER_ADMIN'];
 live.finance=financeRoles.includes(String(live.role||'').toUpperCase())?{}:null;
 if(live.finance){const financeSpecs=[['journal_entries','tenant_id',live.tenantId,'journals'],['commission_transactions','tenant_id',live.tenantId,'commissions'],['payment_intents','tenant_id',live.tenantId,'paymentIntents'],['payment_financial_reconciliations','tenant_id',live.tenantId,'reconciliations'],['settlement_transactions','tenant_id',live.tenantId,'settlements'],['wallet_accounts','tenant_id',live.tenantId,'wallets']];const financeResults=await Promise.all(financeSpecs.map(x=>safeCount(x[0],x[1],x[2])));financeSpecs.forEach((x,i)=>{live.finance[x[3]]=financeResults[i]});}
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
 const labels={CUSTOMER:'عميل',SERVICE_PROVIDER:'صاحب نشاط / مقدم خدمة',OWNER:'مالك',ADMIN:'مدير إداري',SUPER_ADMIN:'مدير النظام',MANAGER:'مدير تشغيل',BUSINESS_OWNER:'مالك نشاط',SUPPORT:'دعم',SUPPORT_MANAGER:'مدير الدعم',EMPLOYEE:'موظف',STAFF:'طاقم تشغيل'};
 return labels[String(role||'').toUpperCase()]||String(role||'دور');
}
function roleContextLabel(m){
 if(!m)return 'دور';
 const role=roleLabel(m.role);
 const parts=[role];
 if(m.business_id)parts.push('النشاط: '+(m.business_name||'نشاط مرتبط'));
 if(m.branch_id)parts.push('الفرع مرتبط');
 if(m.tenant_id&&!m.business_id&&!m.branch_id)parts.push('النطاق: '+m.tenant_id);
 return parts.join(' · ');
}
function membershipOptionLabel(m){
 const role=String(m?.role||'').toUpperCase();
 const icons={OWNER:'👑',SUPER_ADMIN:'🛡️',ADMIN:'⚙️',MANAGER:'📊',BUSINESS_OWNER:'🏢',EMPLOYEE:'👤',STAFF:'👤',SUPPORT_MANAGER:'🎧',SUPPORT:'🎫',SERVICE_PROVIDER:'🧰',CUSTOMER:'👤'};
 const icon=icons[role]||'•';
 const activity=m?.business_name||'نطاق المنصة';
 const section=m?.business_section||'إدارة المنصة';
 return icon+' '+roleLabel(role)+' — '+activity+' — '+section;
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
async function openPrivilegedWorkspace(preferredRole='OWNER'){
 const privilegedRoles=['SUPER_ADMIN','OWNER','ADMIN','MANAGER'];
 const wanted=String(preferredRole||'OWNER').toUpperCase();
 const target=live.memberships.find(m=>m?.status==='ACTIVE'&&String(m.role||'').toUpperCase()===wanted)
   ||live.memberships.find(m=>m?.status==='ACTIVE'&&privilegedRoles.includes(String(m.role||'').toUpperCase()));
 if(!target)return showToast('لا توجد عضوية إدارية نشطة لهذا الحساب.','error');
 window.MNTYAdminReturnMembershipId=target.id;
 localStorage.setItem('MNTYAdminReturnMembershipId',target.id);
 localStorage.setItem('MNTYWorkspaceMode','ADMIN');
 localStorage.setItem('MNTYWorkspaceCurrent','الرئيسية');
 if(target.id!==live.activeMembershipId){
   await switchMembership(target.id);
   return;
 }
 live.role=String(target.role||'').toUpperCase();
 live.businessId=target.business_id||null;
 live.tenantId=target.tenant_id||null;
 live.organizationId=target.organization_id||null;
 live.branchId=target.branch_id||null;
 live.permissions=target.permissions||{};
 current='الرئيسية';
 query='';
 await renderApp({forceWorkspace:true});
 showToast('تم فتح لوحة الإدارة بصلاحية '+roleLabel(live.role),'success');
}
window.openPrivilegedWorkspace=openPrivilegedWorkspace;

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
const MNTY_BACKEND_ONLY_TABLES=new Set(['erp_purchase_orders','erp_purchase_receipts','erp_stock_transfers','smm_admins','smm_provider_credentials','smm_providers']); function syncModuleRuntime(name){const m=domainModules.find(x=>x.name===name);if(!m)return;const d=live.moduleData?.[m.key];window.MNTYModuleRuntime=window.MNTYModuleRuntime||{};window.MNTYModuleRuntime[m.key]={ready:Boolean(d?.ready),tables:{...(d?.tables||{})},sourceCount:m.tables.length,readableCount:Object.values(d?.tables||{}).filter(v=>typeof v==='number').length};} async function loadDomainModule(name){const m=domainModules.find(x=>x.name===name);if(!m)return;live.moduleData[m.key]={tables:{},ready:false};syncModuleRuntime(name);if(!m.tables.length){live.moduleData[m.key].ready=true;syncModuleRuntime(name);return}const out=await Promise.all(m.tables.map(async t=>{if(MNTY_BACKEND_ONLY_TABLES.has(t))return [t,null];const count=await safeCount(t,null,null);return [t,count]}));out.forEach(([t,c])=>{live.moduleData[m.key].tables[t]=c});live.moduleData[m.key].ready=true;syncModuleRuntime(name);}
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
  const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:oauthRedirectUrl(),queryParams:{access_type:'online',prompt:'select_account'}}});
  if(error)throw error;
 }catch(e){
  try{localStorage.removeItem('MNTYPendingRegistration')}catch(_){}
  authView('تعذر بدء تسجيل الدخول بحساب Google: '+(e?.message||'خطأ غير معروف'),'','',intent);
 }finally{authSendInFlight=false}
}
function authView(msg='',emailValue='',mode=authIntent){
 authIntent=mode||'login';
 document.getElementById('app').innerHTML=`<main class="auth"><section class="auth-card"><div class="brand">${mark()}<span>MantiqatiX</span></div><div class="gradient-line"></div><h1>${authIntent==='register'?'تسجيل مستخدم جديد':'تسجيل الدخول'}</h1><p>${authIntent==='register'?'استخدم حساب Google للتحقق من هويتك وإنشاء حساب MantiqatiX. لا تُمنح الصلاحيات التشغيلية إلا وفق العضوية المعتمدة.':'استخدم حساب Google فقط للدخول بأمان إلى MantiqatiX. سيجري التحقق عبر Google ثم تعود مباشرة إلى المنصة.'}</p>${authIntent==='register'?'<div class="field"><label>نوع التسجيل</label><select id="registration-type"><option value="CUSTOMER">عميل — يُفعّل تلقائيًا لكل حساب</option><option value="SERVICE_PROVIDER">عميل + طلب مقدم خدمة</option></select></div>':''}<button class="btn btn-primary" id="google-auth" type="button">🔐 ${authIntent==='register'?'التسجيل بحساب Google':'الدخول بحساب Google'}</button><button class="auth-switch-btn" id="switch-auth" type="button">${authIntent==='register'?'لدي حساب بالفعل؟ تسجيل الدخول':'مستخدم جديد؟ إنشاء حساب'}</button>${msg?`<div class="msg">${esc(msg)}</div>`:''}</section></main>`;
 bindEnterpriseCommandCenter();
 document.getElementById('google-auth').onclick=()=>{
  if(authIntent==='register')authRegistrationType=document.getElementById('registration-type')?.value||'CUSTOMER';
  signInWithGoogle(authIntent);
 };
 document.getElementById('switch-auth').onclick=()=>authView('', '',authIntent==='register'?'login':'register');
}
async function logout(){await disableCurrentPushSubscription();const {error}=await sb.auth.signOut();if(error)return showToast('تعذر تسجيل الخروج: '+error.message,'error');user=null;window.MNTYAuthState={authenticated:false,email:'',membership:false};window.MNTYActiveMembershipId=null;localStorage.removeItem('MNTYActiveMembershipId');live.memberships=[];live.activeMembershipId=null;live.role='CUSTOMER';live.businessId=null;live.tenantId=null;live.organizationId=null;live.branchId=null;live.permissions={};live.counts={};live.flags={};live.moduleData={};live.records={leads:[],providers:[],orders:[],notifications:[],orderHistory:[],supportTickets:[],ads:[],projects:[],services:[],registrationRequests:[]};window.MXHomeLanding?MXHomeLanding():landingView()}
function setupInstallPrompt(){
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;const b=document.getElementById('install-app');if(b)b.hidden=false});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;const b=document.getElementById('install-app');if(b)b.hidden=true});
}
async function installApp(){if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;const b=document.getElementById('install-app');if(b)b.hidden=true}
function openLandingSector(button){const name=button?.dataset?.sector||'';return selectModule(sectorMapForLanding(name))}
function sectorMapForLanding(name){
 const map={
  'الأطباء والعيادات':'المنظومة الطبية','الصيدليات':'المنظومة الطبية','معامل التحاليل':'المنظومة الطبية','مراكز الأشعة':'المنظومة الطبية','المستشفيات الخاصة':'المنظومة الطبية','الأسنان والعيادات التخصصية':'المنظومة الطبية','مراكز طبية':'المنظومة الطبية','الخدمات البيطرية':'المنظومة الطبية',
  'المطاعم والكافيهات':'المطاعم والمطابخ','السوبر ماركت والبقالة':'البقالة والسوبر ماركت','الأزياء والخياطة':'التجارة والأزياء','الصيانة والخدمات المنزلية':'الصيانة',
  'المحاسبة ومكاتب المحاسبة':'المزايدات — المحاسبة','المحاماة والخدمات القانونية':'المزايدات — الخدمات القانونية','الشركات والموردون':'المزايدات — الشركات',
  'التعليم والتدريب':'التعليم','التسويق والإعلان':'التسويق والإعلان','السفر والرحلات':'المزايدات — الرحلات','MantiGO والنقل عند الطلب':'MantiGO والمزايدات','الوظائف والتوظيف':'الوظائف','الزواج والخدمات المرتبطة':'الزواج','المستعمل':'المستعمل'
 };
 return map[name]||'المجالات والخدمات';
}
async function loadMantiqatiShowcase(){
 const grid=document.getElementById('mantiqati-showcase-grid'); if(!grid)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const safeAsset=s=>/^assets\/activities\/[a-z0-9_-]+\.svg$/i.test(String(s||''))?String(s):'assets/activities/health.svg';
 try{
  const {data,error}=await sb.from('marketing_provider_profiles').select('id,name_ar,name_en,slug,description,specialties,profile_image_path,status,is_verified,is_featured,business_id').eq('status','ACTIVE').eq('is_featured',true).order('name_ar',{ascending:true}).limit(50);
  if(error)throw error;
  const rows=data||[]; if(!rows.length){grid.innerHTML='<div class="mnty-showcase-empty">سيتم عرض الأنشطة الرسمية هنا قريبًا.</div>';return}
  const ids=[...new Set(rows.map(x=>x.business_id).filter(Boolean))];
  const br=ids.length?await sb.from('businesses').select('id,name,code,settings').in('id',ids):{data:[],error:null};
  if(br.error)throw br.error;
  const bm=new Map((br.data||[]).map(x=>[String(x.id),x]));
  grid.innerHTML=rows.map(p=>{const b=bm.get(String(p.business_id));const st=b?.settings||{};const icon=esc(st.icon||'📍');const asset=safeAsset(p.profile_image_path||st.icon_asset_ref);const specs=(Array.isArray(p.specialties)?p.specialties:[]).slice(0,3).map(esc);return '<article class="mnty-showcase-card"><div class="mnty-showcase-card__media"><img src="'+asset+'" alt="'+esc(p.name_ar)+'" loading="lazy"><span class="mnty-showcase-card__emoji">'+icon+'</span></div><div class="mnty-showcase-card__body"><div class="mnty-showcase-card__eyebrow">نشاط رسمي في منطقتي</div><h3>'+esc(p.name_ar)+'</h3><p>'+esc(p.description||'خدمات متخصصة داخل منظومة MantiqatiX.')+'</p><div class="mnty-showcase-tags">'+specs.map(x=>'<span>'+x+'</span>').join('')+'</div><div class="mnty-showcase-card__actions"><span class="mnty-verified">✓ موثق</span><button type="button" class="btn btn-primary" data-showcase-start="'+esc(p.id)+'" data-showcase-name="'+esc(p.name_ar)+'">عرض الملف</button></div></div></article>'}).join('');
  grid.querySelectorAll('[data-showcase-start]').forEach(btn=>btn.addEventListener('click',()=>openMantiqatiShowcaseProfile(btn.dataset.showcaseStart)));
 }catch(error){console.warn('[MNTY showcase] unavailable',error);grid.innerHTML='<div class="mnty-showcase-empty">تعذر تحميل الأنشطة الرسمية الآن.</div>';}
}

function landingView(){
document.getElementById('app').innerHTML=`<main class="landing">
<header class="landing-nav"><div class="brand">${mark()}<span>MantiqatiX</span></div><nav><a href="smm.html">خدمات SMM</a><a href="#services">الخدمات</a><a href="#sectors">المجالات</a><a href="#audiences">لمن؟</a><a href="#plans">الباقات</a><a href="#how">كيف تعمل</a><a href="#faq">الأسئلة</a></nav><div style="display:flex;gap:8px;align-items:center"><button class="btn btn-outline" id="install-app" hidden>📲 تثبيت الموقع</button><button class="btn btn-outline" id="open-register">تسجيل مستخدم جديد</button><button class="btn btn-primary login-open" id="open-login">تسجيل الدخول</button></div></header>
<aside class="mx-cover-ad mx-cover-ad--right" data-cover-ad-slot="0" aria-label="إعلان ممول عائم يمين"></aside>
<section class="landing-hero landing-hero--compact"><div class="hero-copy"><span class="eyebrow">MantiqatiX</span><h1>منصة واحدة تربطك <span>بالخدمات والفرص المناسبة</span></h1><p>منصة تسويق وربط تجمع العملاء بمقدمي الخدمات، وتمنح كل مجال نظامًا مستقلًا للباقات والطلبات والترشيحات والعمولات.</p><div class="hero-actions"><button class="btn btn-primary" id="start">استكشف المجالات</button><button class="btn btn-outline" id="provider">انضم كمقدم خدمة</button></div><div class="trust-row"><span>✓ مجالات متعددة</span><span>✓ باقات مرنة</span><span>✓ ترشيحات حسب المجال</span></div></div></section>
<section class="mx-cover-stage" aria-label="الإعلانات الممولة">
<aside class="mx-cover-ad mx-cover-ad--wide" data-cover-ad-slot="1" aria-label="إعلان ممول بعرض الصفحة"></aside>
</section>
<section class="landing-section" id="services"><div class="section-head"><div><h2>ماذا تقدم MantiqatiX؟</h2><p>منظومة تسويقية وربط للخدمات قابلة للتوسع حسب طبيعة كل نشاط.</p></div></div><div class="feature-grid"><article><span class="feature-icon">🔗</span><b>ربط مباشر</b><p>نساعد العميل على اكتشاف مقدم الخدمة المناسب، بينما تتم المعاملة المالية مباشرة بين الطرفين.</p></article><article><span class="feature-icon">💳</span><b>نماذج ربح مرنة</b><p>نظام مجاني، عمولة على العمليات المؤهلة، وباقات احترافية تختلف حسب قوة وطبيعة كل مجال.</p></article><article><span class="feature-icon">📣</span><b>تسويق وإعلان</b><p>نظام تسويق للشركة نفسها، مع إمكانية الاستفادة من شركات التسويق والشركاء ومصادر العملاء.</p></article><article><span class="feature-icon">🎯</span><b>ترشيحات مناسبة</b><p>عرض مقدمي الخدمات وفق المجال والتخصص وطريقة الاستفادة من الخدمة.</p></article><article><span class="feature-icon">📊</span><b>تقارير ومؤشرات</b><p>متابعة الطلبات، النشاط، العمولات، الباقات، ومصادر العملاء من لوحة موحدة.</p></article><article><span class="feature-icon">🧩</span><b>موديولات مستقلة</b><p>يمكن تشغيل الموديولات وإتاحتها حسب المجال والاشتراك والصلاحيات دون التأثير على باقي النظام.</p></article></div></section>
<section class="landing-section soft" id="sectors"><div class="section-head"><div><h2>مجالات المنصة</h2><p>كل مجال له خدمات ومسارات عمل وباقات مناسبة لطبيعته.</p></div><button class="section-link" id="all-sectors">عرض كل المجالات</button></div><div class="sector-grid">${sectors.map(s=>`<article class="sector-card"><div class="sector-icon">${s[0]}</div><h3>${s[1]}</h3><p>${s[2]}</p><button type="button" data-sector="${s[1]}" onclick="openLandingSector(this)">استكشف المجال ←</button></article>`).join('')}</div></section>
<style id="mnty-showcase-style">.mnty-showcase-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.mnty-showcase-card{background:var(--surface,#fff);border:1px solid rgba(24,100,171,.12);border-radius:22px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.06);display:flex;flex-direction:column}.mnty-showcase-card__media{height:150px;background:linear-gradient(135deg,#e7f5f8,#edf4ff);position:relative;display:grid;place-items:center}.mnty-showcase-card__media img{width:112px;height:112px;object-fit:contain}.mnty-showcase-card__emoji{position:absolute;top:10px;right:10px;background:#fff;border-radius:999px;padding:7px;box-shadow:0 4px 14px rgba(0,0,0,.08)}.mnty-showcase-card__body{padding:15px}.mnty-showcase-card__eyebrow{font-size:11px;color:#0b7285;font-weight:800}.mnty-showcase-card h3{margin:5px 0 7px;font-size:18px}.mnty-showcase-card p{margin:0 0 10px;color:#64748b;font-size:13px;line-height:1.7}.mnty-showcase-tags{display:flex;flex-wrap:wrap;gap:6px}.mnty-showcase-tags span{background:#f1f5f9;border-radius:999px;padding:5px 8px;font-size:11px}.mnty-showcase-card__actions{display:flex;align-items:center;justify-content:space-between;margin-top:14px}.mnty-verified{font-size:12px;color:#087f5b;font-weight:800}.mnty-showcase-empty{grid-column:1/-1;padding:30px;text-align:center;border:1px dashed #cbd5e1;border-radius:18px;color:#64748b}.mnty-module-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.mnty-module-card{display:flex;gap:10px;align-items:flex-start;padding:14px;border:1px solid rgba(24,100,171,.12);border-radius:16px;background:#fff}.mnty-module-card>span{font-size:20px}.mnty-module-card b{display:block;font-size:13px}.mnty-module-card small{display:block;margin-top:4px;color:#64748b;line-height:1.5}@media(max-width:1100px){.mnty-showcase-grid,.mnty-module-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.mnty-showcase-grid,.mnty-module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.mnty-showcase-grid,.mnty-module-grid{grid-template-columns:1fr}}</style><section class="landing-section soft" id="mantiqati-showcase"><div class="section-head"><div><span class="eyebrow">MANTIQATIX OFFICIAL</span><h2>أنشطة منطقتي</h2><p>ملفات أنشطة رسمية مُدارة من السوبر أدمن، مرتبطة بالموديولات والخدمات والصلاحيات داخل المنصة.</p></div></div><div id="mantiqati-showcase-grid" class="mnty-showcase-grid"><div class="mnty-showcase-empty">جاري تحميل الأنشطة الرسمية…</div></div></section><section class="landing-section" id="mantiqati-modules"><div class="section-head"><div><span class="eyebrow">MODULES</span><h2>الموديولات الأساسية</h2><p>كل نشاط رسمي مجهز ليستفيد من منظومة المنصة حسب صلاحياته.</p></div></div><div class="mnty-module-grid"><article class="mnty-module-card"><span>C</span><div><b>التحكم الكامل</b><small>إدارة الأنشطة والفروع والخدمات والاعتمادات</small></div></article><article class="mnty-module-card"><span>H</span><div><b>الرئيسية</b><small>لوحة التحكم الموحدة</small></div></article><article class="mnty-module-card"><span>M</span><div><b>الموديولات</b><small>تشغيل وإدارة وحدات المنصة</small></div></article><article class="mnty-module-card"><span>D</span><div><b>المجالات والخدمات</b><small>القطاعات ومقدمو الخدمات</small></div></article><article class="mnty-module-card"><span>F</span><div><b>التجارة والأزياء</b><small>المنتجات والمقاسات والسلة والطلبات</small></div></article><article class="mnty-module-card"><span>G</span><div><b>البقالة والسوبر ماركت</b><small>المنتجات والمخزون والطلبات</small></div></article><article class="mnty-module-card"><span>R</span><div><b>المطاعم والمطابخ</b><small>القوائم والإضافات والمطبخ والتوصيل</small></div></article><article class="mnty-module-card"><span>M</span><div><b>المنظومة الطبية</b><small>الأطباء والعيادات والصيدليات والمعامل والأشعة والمستشفيات</small></div></article><article class="mnty-module-card"><span>M</span><div><b>الصيانة</b><small>طلبات الصيانة ومقدمو الخدمة</small></div></article><article class="mnty-module-card"><span>P</span><div><b>الخدمات المهنية</b><small>المحاسبة والقانون والشركات والبرمجيات والتسويق</small></div></article><article class="mnty-module-card"><span>M</span><div><b>MantiGO والنقل</b><small>الطلبات والعروض والرحلات والتنفيذ</small></div></article><article class="mnty-module-card"><span>M</span><div><b>الزواج</b><small>الملفات والترشيحات والتواصل</small></div></article><article class="mnty-module-card"><span>J</span><div><b>الوظائف</b><small>الوظائف والمتقدمون والمقابلات</small></div></article><article class="mnty-module-card"><span>E</span><div><b>التعليم</b><small>المدارس والمدرسون والحجوزات</small></div></article><article class="mnty-module-card"><span>U</span><div><b>المستعمل</b><small>الإعلانات والعروض والتفاوض</small></div></article><article class="mnty-module-card"><span>M</span><div><b>التسويق والإعلان</b><small>التسويق الداخلي وشركات التسويق والعملاء المحتملون</small></div></article><article class="mnty-module-card"><span>S</span><div><b>خدمات التسويق الرقمي SMM</b><small>الخدمات والموردون والطلبات والتتبع</small></div></article><article class="mnty-module-card"><span>C</span><div><b>المستخدمون وCRM</b><small>العملاء ومقدمو الخدمة والمتابعة والاحتفاظ</small></div></article><article class="mnty-module-card"><span>O</span><div><b>الطلبات والعمليات</b><small>الطلبات والحجوزات وسير التنفيذ</small></div></article><article class="mnty-module-card"><span>F</span><div><b>العمولات والباقات</b><small>العمولات والاشتراكات والباقات</small></div></article><article class="mnty-module-card"><span>A</span><div><b>التقارير والتحليلات</b><small>الأداء والتحويلات والإيرادات والمخاطر</small></div></article><article class="mnty-module-card"><span>G</span><div><b>الدعم والحوكمة</b><small>التذاكر والتدقيق والصلاحيات والمراقبة</small></div></article><article class="mnty-module-card"><span>R</span><div><b>طلبات التسجيل</b><small>اعتماد طلبات العملاء ومقدمي الخدمة</small></div></article><article class="mnty-module-card"><span>S</span><div><b>الإعدادات</b><small>الحساب والمنصة والتفضيلات</small></div></article></div></section><section class="landing-section" id="audiences"><div class="section-head"><div><h2>مصمم لكل طرف</h2><p>تجربة مختلفة حسب دور المستخدم داخل المنصة.</p></div></div><div class="audience-grid"><article><span>👤</span><h3>العميل</h3><p>اكتشاف الخدمات، مقارنة الخيارات، إرسال الطلبات والوصول لمقدم الخدمة المناسب.</p></article><article><span>🏢</span><h3>مقدم الخدمة</h3><p>ملف مهني، باقات، خدمات، استقبال العملاء والطلبات، وفرص تسويقية.</p></article><article><span>📣</span><h3>شركة التسويق</h3><p>مصادر عملاء وحملات وشراكات وتسويق للخدمات وفق نظام المنصة.</p></article><article><span>🤝</span><h3>الشريك</h3><p>مسارات شراكة وإحالة واستفادة من شبكة الخدمات والفرص المتاحة.</p></article></div></section>
<section class="landing-section soft" id="plans"><div class="section-head"><div><h2>نظام الباقات والعمولات</h2><p>النموذج الأساسي للمنصة قابل للتخصيص لكل قطاع.</p></div></div><div class="plans-grid"><article class="plan"><span>الأساسي</span><h3>مجاني</h3><p>وجود أساسي داخل المنصة والوصول إلى الخدمات المتاحة في المجال.</p><ul><li>ملف أساسي</li><li>ظهور داخل المجال</li><li>إدارة بيانات النشاط</li></ul><button class="btn btn-outline">اعرف المزيد</button></article><article class="plan featured"><span>العمولة</span><h3>حسب الاستخدام</h3><p>رسوم أو عمولة على العمليات أو الإضافات المؤهلة وفق طبيعة النشاط.</p><ul><li>مرونة في التكلفة</li><li>قياس العمليات</li><li>مناسب للنمو</li></ul><button class="btn btn-primary" id="commission-login">ابدأ الآن</button></article><article class="plan"><span>احترافي</span><h3>3 مستويات</h3><p>ثلاث باقات احترافية يمكن تخصيص مزاياها حسب قوة كل مجال وطريقة الاستفادة.</p><ul><li>مزايا إضافية</li><li>تسويق وظهور أكبر</li><li>تقارير متقدمة</li></ul><button class="btn btn-outline">اطلب التفاصيل</button></article></div></section>
<section class="landing-section" id="how"><div class="section-head"><div><h2>كيف تعمل المنصة؟</h2><p>مسار واضح من البحث إلى التواصل والمتابعة.</p></div></div><div class="steps"><div><b>01</b><h3>اكتشف</h3><p>اختر المجال والخدمة المناسبة.</p></div><div><b>02</b><h3>قارن</h3><p>راجع مقدمي الخدمة والباقات المتاحة.</p></div><div><b>03</b><h3>اطلب</h3><p>أرسل طلبك أو تواصل مع مقدم الخدمة.</p></div><div><b>04</b><h3>تابع</h3><p>تابع الطلب والنتائج من حسابك.</p></div></div></section>
<section class="landing-section soft" id="faq"><div class="section-head"><div><h2>أسئلة شائعة</h2><p>إجابات مختصرة عن طريقة عمل MantiqatiX.</p></div></div><div class="faq-grid"><details><summary>هل MantiqatiX تنفذ الخدمة بنفسها؟</summary><p>المنصة وسيط تسويقي وربط؛ التنفيذ والمعاملة المالية تكون مباشرة بين العميل ومقدم الخدمة.</p></details><details><summary>هل كل المجالات لها نفس الباقة؟</summary><p>لا. يمكن تخصيص الخدمات والباقات وطريقة الاستفادة حسب طبيعة وقوة كل مجال.</p></details><details><summary>هل يمكن لمقدم الخدمة البدء مجانًا؟</summary><p>يوجد نموذج مجاني أساسي، مع إمكانية الانتقال إلى العمولة أو الباقات الاحترافية حسب المجال.</p></details><details><summary>هل يمكن للشركات التسويقية الانضمام؟</summary><p>نعم، المنصة تتضمن مسارًا للتسويق والإعلان والشراكات ومصادر العملاء.</p></details></div></section>
<section class="landing-cta"><span class="eyebrow">MANTIQATIX</span><h2>ابدأ من احتياجك</h2><p>عميل يبحث عن خدمة، أو مقدم خدمة يريد عملاء، أو شركة تريد شراكة وتسويقًا أقوى.</p><div class="cta-actions"><button class="btn btn-light" id="cta-login">الدخول إلى المنصة</button><button class="btn btn-ghost" id="cta-provider">الانضمام كمقدم خدمة</button></div></section>
<footer id="contact"><div><div class="brand">${mark()}<span>MantiqatiX</span></div><p>منصة تسويق وربط الخدمات والفرص.</p></div><div class="footer-links"><a href="#services">الخدمات</a><a href="#sectors">المجالات</a><a href="#plans">الباقات</a><a href="#faq">الأسئلة</a></div><div><b>خدمة العملاء</b><p>01010171770</p></div></footer>
</main>`;
document.getElementById('open-login').onclick=()=>authView();document.getElementById('open-register').onclick=()=>authView('',false,'','register');document.getElementById('install-app').onclick=installApp;setupInstallPrompt();document.getElementById('cta-login').onclick=()=>authView();document.getElementById('commission-login').onclick=()=>authView();document.getElementById('provider').onclick=()=>authView('',false,'','register');document.getElementById('cta-provider').onclick=()=>authView('',false,'','register');
const mountLandingCoverAds=async()=>{
 const slots=[...document.querySelectorAll('[data-cover-ad-slot]')]; if(!slots.length)return;
 const safeUrl=u=>{try{const x=new URL(String(u||''),location.href);return ['http:','https:'].includes(x.protocol)?x.href:''}catch(_){return ''}};
 const escAttr=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const wide=slots.find(x=>x.classList.contains('mx-cover-ad--wide'));
 const right=slots.find(x=>x.classList.contains('mx-cover-ad--right'));
 if(wide){
   wide.hidden=false;
   wide.innerHTML='<div class="mx-cover-ad__wide-frame mx-cover-ad__booking-frame"><img src="assets/mnty-ad-space-booking-banner.svg?v=mnty35" alt="احجز مساحة إعلانية الآن" loading="eager"><span class="mx-cover-ad__badge">مساحة إعلانية</span><button type="button" class="mx-cover-ad__booking-cta" aria-label="احجز مساحة إعلانية الآن"></button></div>';
   wide.querySelector('.mx-cover-ad__booking-cta')?.addEventListener('click',()=>requestAdBooking('QUARTERLY'));
 }
 let rightClosed=false;
 try{rightClosed=sessionStorage.getItem('MNTYRightCoverClosed')==='1'}catch(_){}
 if(!right)return;
 const renderRight=ad=>{
   if(!ad||rightClosed){right.hidden=true;return}
   const href=safeUrl(ad.target_url),img=safeUrl(ad.creative_url),title=String(ad.title||'إعلان ممول').replace(/[<>]/g,'');
   right.hidden=false;
   right.innerHTML='<div class="mx-cover-ad__cloud">'+(img?'<img class="mx-cover-ad__float-media" src="'+escAttr(img)+'" alt="'+escAttr(title)+'" loading="eager">':'<span class="mx-cover-ad__float-fallback">MNTY</span>')+'<div class="mx-cover-ad__float-body"><span class="mx-cover-ad__badge">ممول</span><strong>'+title+'</strong></div></div>'+(href?'<a class="mx-cover-ad__link" href="'+escAttr(href)+'" target="_blank" rel="noopener noreferrer" aria-label="فتح الإعلان"></a>':'')+'<button type="button" class="mx-cover-ad__close" aria-label="إغلاق الإعلان">×</button>';
   right.querySelector('.mx-cover-ad__close')?.addEventListener('click',event=>{
     event.preventDefault();event.stopPropagation();rightClosed=true;right.hidden=true;
     try{sessionStorage.setItem('MNTYRightCoverClosed','1')}catch(_){}
   },{once:true});
 };
 try{
   const coords=window.MNTYLocationAdapter?.state?.coords||null;
   const {data,error}=await sb.rpc('get_mnty_targeted_advertisements',{p_country_code:'EG',p_governorate_code:null,p_center_code:null,p_lat:coords?.latitude??null,p_lon:coords?.longitude??null,p_ad_space_id:'HOME_SPONSORED',p_limit:3});
   if(error)throw error;
   const ads=(data||[]).filter(x=>x&&x.advertisement_id);
   if(!ads.length){right.hidden=true;return}
   let tick=0;
   const paint=()=>{renderRight(ads[tick%ads.length]);tick=(tick+1)%ads.length};
   paint();
   if(ads.length>1)window.setInterval(paint,6000);
 }catch(error){console.warn('[MNTY cover ads] unavailable',error);right.hidden=true}
};
document.getElementById('start').onclick=()=>document.getElementById('sectors').scrollIntoView({behavior:'smooth'});
mountLandingCoverAds();
loadMantiqatiShowcase();
document.querySelectorAll('[data-side-ad-book]').forEach(btn=>btn.onclick=()=>{try{localStorage.setItem('MNTYOpenAdBooking','1');localStorage.setItem('MNTYAdBookingDuration','QUARTERLY')}catch(_){};authView('',false,'','login')});
document.getElementById('all-sectors').onclick=()=>{authView()};
}

const PROVIDER_SERVICE_TEMPLATES={
 FOOD:['وجبات ومأكولات','حلويات','مشروبات','توصيل طلبات','تجهيز حفلات'],
 HEALTH:['كشف طبي','استشارة','متابعة','حجز موعد','زيارة منزلية'],
 PHARMACY:['أدوية','مستلزمات طبية','منتجات عناية','قياس ضغط وسكر','توصيل'],
 LABS:['تحاليل دم','تحاليل بول','تحاليل هرمونات','تحاليل أطفال','سحب عينات منزلي'],
 RADIOLOGY:['أشعة عادية','سونار','أشعة مقطعية','رنين مغناطيسي','ماموجرام'],
 HOSPITAL:['كشف واستقبال','طوارئ','عمليات','رعاية مركزة','حجز عيادات'],
 DENTAL:['كشف أسنان','تنظيف','حشو','تركيبات','تقويم'],
 VETERINARY:['كشف بيطري','تطعيمات','علاج','جراحة بيطرية','مستلزمات حيوانات'],
 MEDICAL:['كشف تخصصي','استشارات','فحوصات','علاج طبيعي','حجز ومتابعة'],
 REAL_ESTATE:['بيع عقارات','إيجار','إدارة أملاك','تقييم عقاري','تسويق عقاري'],
 AUTO:['بيع سيارات','شراء سيارات','صيانة','قطع غيار','نقل سيارات'],
 MAINTENANCE:['كهرباء','سباكة','نجارة','تكييف وتبريد','دهانات','أجهزة منزلية','ألوميتال','نظافة'],
 HOME:['تنظيف منازل','نقل أثاث','مكافحة حشرات','صيانة منزلية','رعاية منزلية'],
 ACCOUNTING:['مسك دفاتر','إقرارات ضريبية','مراجعة حسابات','رواتب','استشارات مالية'],
 LEGAL:['استشارات قانونية','صياغة عقود','قضايا مدنية','قضايا تجارية','قضايا أسرية','تأسيس شركات'],
 COMPANIES:['خدمات أعمال','توريد','تشغيل وصيانة','استشارات إدارية','خدمات شركات'],
 FACTORIES:['تصنيع','توريد جملة','تعبئة وتغليف','قطع ومكونات','تصنيع حسب الطلب'],
 EDU:['دروس','كورسات','تدريب مهني','تعليم لغات','مراجعات واختبارات'],
 DIGITAL:['إدارة صفحات','إعلانات ممولة','SEO','محتوى','تصميم وهوية','تصوير ومونتاج'],
 TECH:['برمجة مواقع','تطبيقات','متاجر إلكترونية','استضافة','دعم فني','تكاملات API'],
 FITNESS:['جيم','مدرب شخصي','تغذية رياضية','تمارين جماعية','تأهيل ولياقة'],
 TRAVEL:['حجز رحلات','فنادق','تذاكر','برامج سياحية','نقل سياحي'],
 MANTIGO:['رحلات داخل المدينة','مشاوير','نقل أفراد','نقل أغراض','سائق خاص'],
 JOBS:['نشر وظائف','توظيف','بحث عن مرشحين','استشارات توظيف','تدريب وظيفي'],
 MATRIMONY:['تنظيم مناسبات','تصوير أفراح','قاعات','تجهيز حفلات','خدمات زواج'],
 USED_ITEMS:['بيع مستعمل','شراء مستعمل','تبديل','تقييم منتجات','وساطة بيع'],
 FASHION:['تفصيل','تعديل ملابس','خياطة','تصميم أزياء','تنظيف وكي'],
 GROCERY:['بقالة','خضروات وفاكهة','مخبوزات','منتجات منزلية','توصيل'],
 FREELANCER:['كتابة','ترجمة','تصميم','برمجة','استشارات','إدخال بيانات']
};
const providerKinds=[["FOOD","مطاعم وكافيهات ومطابخ"],["HEALTH","طبيب أو عيادة"],["PHARMACY","صيدلية"],["LABS","معمل تحاليل"],["RADIOLOGY","مركز أشعة"],["HOSPITAL","مستشفى"],["DENTAL","طبيب أو عيادة أسنان"],["VETERINARY","عيادة أو خدمة بيطرية"],["MEDICAL","مركز طبي"],["REAL_ESTATE","شركة أو مكتب عقارات"],["AUTO","سيارات ونقل"],["MAINTENANCE","مقدم خدمات صيانة"],["HOME","خدمات منزلية"],["ACCOUNTING","محاسب أو مكتب محاسبة"],["LEGAL","محامٍ أو مكتب محاماة"],["COMPANIES","شركة أو مقدم خدمات أعمال"],["FACTORIES","مصنع أو مورد"],["EDU","مدرسة أو مدرس أو مركز تدريب"],["DIGITAL","شركة تسويق وإعلان"],["TECH","شركة برمجيات وخدمات تقنية"],["FITNESS","نادي أو مدرب لياقة"],["TRAVEL","شركة سياحة وسفر"],["MANTIGO","مقدم نقل أو سائق MantiGO"],["JOBS","صاحب عمل أو جهة توظيف"],["MATRIMONY","مقدم خدمات زواج ومناسبات"],["USED_ITEMS","بائع أو مقدم خدمة للمستعمل"],["FASHION","متجر أو مقدم خدمات أزياء وخياطة"],["GROCERY","بقالة أو سوبر ماركت"],["FREELANCER","مستقل أو مقدم خدمة احترافية"]];
const GLOBAL_SEARCH_SOURCES=[
 {key:'businesses',label:'الأنشطة والشركات',icon:'🏢',module:'المستخدمون وCRM',table:'businesses',select:'id,name,code,status',fields:['name','code'],route:'المستخدمون وCRM'},
 {key:'providers',label:'مقدمو الخدمة',icon:'👤',module:'المستخدمون وCRM',table:'marketing_provider_profiles',select:'id,name_ar,name_en,provider_kind,status,is_verified',fields:['name_ar','name_en','provider_kind'],route:'المستخدمون وCRM'},
 {key:'orders',label:'الطلبات',icon:'🧾',module:'الطلبات والعمليات',table:'orders',select:'id,status,total_amount,total,currency,customer_name,created_at',fields:['id','status','customer_name'],route:'الطلبات والعمليات'},
 {key:'services',label:'الخدمات',icon:'🛠️',module:'المجالات والخدمات',table:'marketing_services',select:'id,code,name_ar,name_en,category_code,status',fields:['code','name_ar','name_en','category_code'],route:'المجالات والخدمات'},
 {key:'catalog',label:'الخدمات والمنتجات',icon:'📦',module:'الموديولات',table:'catalog_items',select:'id,name_ar,name_en,sku,item_type,status,business_id',fields:['name_ar','name_en','sku','item_type'],route:'الموديولات'},
 {key:'leads',label:'العملاء المحتملون',icon:'🎯',module:'المستخدمون وCRM',table:'marketing_leads',select:'id,title,status,source,service_area,created_at',fields:['title','status','source','service_area'],route:'المستخدمون وCRM'},
 {key:'projects',label:'المشروعات التسويقية',icon:'📣',module:'التسويق والإعلان',table:'marketing_projects',select:'id,project_type,management_mode,status,currency,created_at',fields:['project_type','management_mode','status'],route:'التسويق والإعلان'},
 {key:'tickets',label:'تذاكر الدعم',icon:'🎫',module:'الدعم والحوكمة',table:'support_tickets',select:'id,subject,category,priority,status,created_at',fields:['id','subject','category','priority','status'],route:'الدعم والحوكمة'},
 {key:'ads',label:'الإعلانات',icon:'📢',module:'التسويق والإعلان',table:'advertisements',select:'id,title,status,approval_status,start_at,end_at,created_at',fields:['id','title','status','approval_status'],route:'التسويق والإعلان'},
 {key:'jobs',label:'الوظائف',icon:'💼',module:'الوظائف',table:'jobs',select:'id,title,company_name,category,location,job_type,is_active,created_at',fields:['title','company_name','category','location','job_type'],route:'الوظائف'}
];
function globalSearchCan(source){
 const role=String(live.role||'').toUpperCase();
 if(role==='SUPER_ADMIN')return canSuperAdmin();
 return window.MNTY_RBAC?.can(role,source.module,'view',live.permissions)===true;
}
function globalSearchText(row,fields){return fields.map(k=>row?.[k]).filter(v=>v!==null&&v!==undefined).map(v=>typeof v==='object'?JSON.stringify(v):String(v)).join(' ')}
async function globalSearch(queryText){
 const q=String(queryText||'').trim();
 if(q.length<2)return [];
 const needle='%'+q.replace(/[%_]/g,m=>'\\'+m)+'%';
 const sources=GLOBAL_SEARCH_SOURCES.filter(globalSearchCan);
 const tasks=sources.map(async source=>{
  try{
   let queryBuilder=sb.from(source.table).select(source.select).limit(6);
   if(source.key==='businesses')queryBuilder=queryBuilder.or('name.ilike.'+needle+',code.ilike.'+needle);
   else if(source.key==='providers')queryBuilder=queryBuilder.or('name_ar.ilike.'+needle+',name_en.ilike.'+needle+',provider_kind.ilike.'+needle);
   else if(source.key==='orders')queryBuilder=queryBuilder.or('status.ilike.'+needle+',customer_name.ilike.'+needle);
   else if(source.key==='services')queryBuilder=queryBuilder.or('code.ilike.'+needle+',name_ar.ilike.'+needle+',name_en.ilike.'+needle+',category_code.ilike.'+needle);
   else if(source.key==='catalog')queryBuilder=queryBuilder.or('name_ar.ilike.'+needle+',name_en.ilike.'+needle+',sku.ilike.'+needle+',item_type.ilike.'+needle);
   else if(source.key==='leads')queryBuilder=queryBuilder.or('title.ilike.'+needle+',status.ilike.'+needle+',source.ilike.'+needle+',service_area.ilike.'+needle);
   else if(source.key==='projects')queryBuilder=queryBuilder.or('project_type.ilike.'+needle+',management_mode.ilike.'+needle+',status.ilike.'+needle);
   else if(source.key==='tickets')queryBuilder=queryBuilder.or('id.ilike.'+needle+',subject.ilike.'+needle+',category.ilike.'+needle+',priority.ilike.'+needle+',status.ilike.'+needle);
   else if(source.key==='ads')queryBuilder=queryBuilder.or('id.ilike.'+needle+',title.ilike.'+needle+',status.ilike.'+needle+',approval_status.ilike.'+needle);
   else if(source.key==='jobs')queryBuilder=queryBuilder.or('title.ilike.'+needle+',company_name.ilike.'+needle+',category.ilike.'+needle+',location.ilike.'+needle+',job_type.ilike.'+needle);
   const result=await queryBuilder;
   if(result.error)throw result.error;
   return (result.data||[]).map(row=>({source,row,title:row.name||row.name_ar||row.name_en||row.title||row.subject||row.code||row.id,detail:globalSearchText(row,source.fields)}));
  }catch(error){
   console.warn('[MantiqatiX global search]',source.key,error?.message||error);
   return [];
  }
 });
 const groups=await Promise.all(tasks);
 return groups.flat().slice(0,40);
}
function globalSearchResultHtml(results){
 if(!results.length)return '<div class="mx-global-search-empty">لا توجد نتائج حقيقية متاحة ضمن صلاحيات الحساب.</div>';
 return results.map((hit,i)=>'<button type="button" class="mx-global-search-hit" data-search-index="'+i+'"><span class="mx-global-search-icon">'+hit.source.icon+'</span><span><b>'+esc(hit.title||'بدون اسم')+'</b><small>'+esc(hit.source.label)+' · '+esc(hit.detail||'')+'</small></span><span>›</span></button>').join('');
}
function filtered(list){const q=query.trim().toLowerCase();return q?list.filter(x=>x.join(' ').toLowerCase().includes(q)):list}
function modulePage(){const list=filtered(domainModules.map(m=>[m.icon,m.name,m.desc]));return `<div class="section-head"><div><h2>مركز الموديولات</h2><p>تحكم في الوحدات التي تظهر للمنصة والمشتركين.</p></div><span class="count">${list.length} وحدات</span></div><div class="modules">${list.map(m=>`<article class="card module" onclick="selectModule('${m[1]}')"><div class="icon">${m[0]}</div><h3>${m[1]}</h3><div class="muted">${m[2]}</div><span class="status">${canManage()?'إدارة متاحة':'متاح للعرض'}</span></article>`).join('')}</div>`}
function sectorsPage(){
 const list=filtered(sectors);
 const sectorMap={
  'الأطباء والعيادات':'المنظومة الطبية','الصيدليات':'المنظومة الطبية','معامل التحاليل':'المنظومة الطبية','مراكز الأشعة':'المنظومة الطبية','المستشفيات الخاصة':'المنظومة الطبية','الأسنان والعيادات التخصصية':'المنظومة الطبية','مراكز طبية':'المنظومة الطبية','الخدمات البيطرية':'المنظومة الطبية',
  'المطاعم والكافيهات':'المطاعم والمطابخ','السوبر ماركت والبقالة':'البقالة والسوبر ماركت','الأزياء والخياطة':'التجارة والأزياء','الصيانة والخدمات المنزلية':'الصيانة',
  'المحاسبة ومكاتب المحاسبة':'المزايدات — المحاسبة','المحاماة والخدمات القانونية':'المزايدات — الخدمات القانونية','الشركات والموردون':'المزايدات — الشركات',
  'التعليم والتدريب':'التعليم','التسويق والإعلان':'التسويق والإعلان','السفر والرحلات':'المزايدات — الرحلات','MantiGO والنقل عند الطلب':'MantiGO والمزايدات','الوظائف والتوظيف':'الوظائف','الزواج والخدمات المرتبطة':'الزواج','المستعمل':'المستعمل'
 };
 const cards=list.map(s=>{
  const target=sectorMap[s[1]]||'المجالات والخدمات';
  const operational=Boolean(sectorMap[s[1]]);
  return '<article class="mnty-blueprint-card"><div class="mnty-blueprint-icon">'+esc(s[0])+'</div><div class="mnty-blueprint-main"><div class="row"><h3>'+esc(s[1])+'</h3><span class="mnty-badge mnty-badge--ui">'+(operational?'OPERATIONAL':'DIRECTORY')+'</span></div><p>'+esc(s[2])+'</p><div class="mnty-wire-row"><span></span><span></span><span></span></div><div class="mini-actions"><button type="button" onclick="selectModule(\''+target+'\')">'+(operational?'فتح المجال':'دليل القطاع')+'</button><button type="button" onclick="selectModule(\'العمولات والباقات\')">الباقات</button></div></div></article>';
 }).join('');
 return '<section class="mnty-product-shell"><div class="mnty-product-head"><div><span class="eyebrow">SERVICE DISCOVERY</span><h2>المجالات والخدمات</h2><p>دليل القطاعات الموحد للمنصة. يوضح هذا الدليل القطاعات التشغيلية والقطاعات التي ما زالت في وضع الدليل دون الإيحاء باكتمال وحدة خلفية غير موصولة.</p></div><div class="mnty-product-meta"><span class="mnty-badge mnty-badge--live">'+sectors.length+' مجال</span><small>'+list.length+' نتيجة مطابقة</small></div></div><div class="mnty-stat-strip"><div><b>'+sectors.length+'</b><span>مجالات معرفة</span></div><div><b>'+domainModules.length+'</b><span>وحدات تشغيلية</span></div><div><b>'+live.records.services.length+'</b><span>خدمات فعلية ظاهرة</span></div><div><b>'+countOrDash('providers')+'</b><span>مقدمو خدمة</span></div></div><div class="mnty-screen-note">ابحث من شريط البحث العام بالأعلى، ثم افتح القطاع التشغيلي عند توفر وحدته. القطاعات غير الموصولة تظهر كدليل فقط دون بيانات مصطنعة.</div><div class="mnty-blueprint-grid" style="margin-top:16px">'+(cards||'<div class="empty-state">لا توجد نتائج مطابقة للبحث الحالي.</div>')+'</div></section>';
}
function genericPage(title,desc,items){
 const safe=Array.isArray(items)?items:[];
 const tabs=[['overview','نظرة عامة'],['data','البيانات'],['operations','العمليات'],['reports','التقارير'],['settings','الإعدادات']];
 const sections=safe.map((x,i)=>'<article class="mnty-blueprint-card"><div class="mnty-blueprint-icon">'+['▣','◈','◌','◆','◇','◎'][i%6]+'</div><div class="mnty-blueprint-main"><div class="row"><h3>'+esc(x[0])+'</h3><span class="mnty-badge mnty-badge--ui">الواجهة مكتملة</span></div><p>'+esc(x[1])+'</p><div class="mnty-wire-row"><span></span><span></span><span></span></div></div></article>').join('');
 const tabBody={
  overview:'<div class="mnty-tab-copy"><span class="eyebrow">OVERVIEW</span><h3>مساحة العمل جاهزة</h3><p>الهيكل البصري والعمليات الأساسية لهذه الوحدة محددة. البيانات الحية تُعرض فقط عند توفر مصدرها المصرح به.</p></div>',
  data:'<div class="mnty-tab-copy"><span class="eyebrow">DATA</span><h3>طبقة البيانات</h3><p>سيتم ربط الجداول وواجهات القراءة الفعلية هنا حسب نطاق الحساب والصلاحيات، دون إنشاء سجلات تجريبية.</p></div>',
  operations:'<div class="mnty-tab-copy"><span class="eyebrow">OPERATIONS</span><h3>العمليات</h3><p>أزرار التنفيذ تُضاف فقط للعمليات التي لها مسار خادم معتمد وصلاحية واضحة. لا يتم تشغيل إجراء غير متصل.</p></div>',
  reports:'<div class="mnty-tab-copy"><span class="eyebrow">REPORTS</span><h3>التقارير</h3><p>المؤشرات ستعتمد على بيانات تشغيلية حقيقية؛ لذلك تظل القيم غير المتاحة فارغة بدل عرض أرقام تقديرية.</p></div>',
  settings:'<div class="mnty-tab-copy"><span class="eyebrow">SETTINGS</span><h3>الإعدادات</h3><p>إعدادات الوحدة تظهر عند اكتمال مساراتها الخلفية والصلاحيات المرتبطة بها.</p></div>'
 };
 return '<section class="mnty-product-shell"><div class="mnty-product-head"><div><span class="eyebrow">PRODUCT WORKSPACE</span><h2>'+esc(title)+'</h2><p>'+esc(desc)+'</p></div><div class="mnty-product-meta"><span class="mnty-badge mnty-badge--ui">UI READY</span><small>بيانات فعلية فقط عند توفر المصدر</small></div></div><div class="mnty-module-tabs" role="tablist" aria-label="أقسام مساحة العمل" data-workspace-tabs>'+tabs.map((t,i)=>'<button type="button" role="tab" aria-selected="'+(i===0?'true':'false')+'" class="'+(i===0?'active':'')+'" data-tab="'+t[0]+'">'+t[1]+'</button>').join('')+'</div><div class="mnty-tab-panel" id="mnty-generic-tab-panel" role="tabpanel" tabindex="0">'+tabBody.overview+'</div><div class="mnty-blueprint-grid">'+sections+'</div><div class="mnty-future-panel"><div><span class="eyebrow">CONNECTION LATER</span><h3>الشاشة جاهزة قبل اكتمال الخدمة الخلفية</h3><p>لن نعرض أرقامًا أو سجلات مصطنعة. عند اكتمال المصدر، يتم توصيله بهذه الواجهة مباشرة.</p></div><div class="mnty-future-stats"><div><b>UI</b><span>READY</span></div><div><b>DATA</b><span>PENDING</span></div><div><b>SECURITY</b><span>SERVER</span></div></div></div></section>';
}
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
  const activeBranches=(catalog.branches||[]).filter(b=>String(b.status||'').toUpperCase()==='ACTIVE');
  if(!activeBranches.length)return showToast('لا يوجد فرع نشط متاح لهذا النشاط بعد.','error');
  const defaultBranch=activeBranches[0];
  const cards=(catalog.items||[]).map(item=>{
   const price=catalogCurrentPrice(catalog,item.id,catalog.branchId||null);
   const amount=price?String(price.unit_price)+' '+String(price.currency||''):'السعر غير متاح';
   return '<article class="card"><div class="row"><strong>'+esc(item.name_ar||item.name_en||'صنف')+'</strong><span class="dot"></span></div><p class="muted">'+esc(item.description||item.item_type||'خدمة/صنف')+'</p><div class="row"><b>'+esc(amount)+'</b>'+(price?'<div class="mx-catalog-actions"><button class="text-btn mx-cart-add" data-business-id="'+esc(businessId)+'" data-item-id="'+esc(item.id)+'">أضف للسلة</button><button class="text-btn mx-order-trigger" data-business-id="'+esc(businessId)+'" data-item-id="'+esc(item.id)+'">طلب الآن</button></div>':'')+'</div></article>';
  }).join('')||'<div class="muted">لا توجد أصناف نشطة متاحة حاليًا.</div>';
  const overlay=document.createElement('div');overlay.className='mx-modal';
  overlay.innerHTML='<div class="mx-modal-card"><div class="section-head"><div><span class="eyebrow">LIVE CATALOG</span><h2>كتالوج '+esc(providerName||'مقدم الخدمة')+'</h2><p>الأصناف والأسعار من الكتالوج التشغيلي الفعلي.</p></div><button class="text-btn mx-close-modal">إغلاق</button></div><label class="field" style="margin:12px 0"><span>اختر الفرع</span><select id="mx-catalog-branch">'+activeBranches.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.name||b.code||b.id)+'</option>').join('')+'</select></label><div class="cards">'+cards+'</div></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('.mx-close-modal')?.addEventListener('click',closeMxModal);
  overlay.querySelectorAll('.mx-order-trigger').forEach(btn=>btn.addEventListener('click',()=>openOrderForm(btn.dataset.businessId,btn.dataset.itemId,document.getElementById('mx-catalog-branch')?.value||defaultBranch.id)));
  overlay.querySelectorAll('.mx-cart-add').forEach(btn=>btn.addEventListener('click',()=>{
    const catalogItem=(catalog.items||[]).find(x=>String(x.id)===String(btn.dataset.itemId));
    const price=catalogCurrentPrice(catalog,btn.dataset.itemId,document.getElementById('mx-catalog-branch')?.value||defaultBranch.id);
    addToMntiCart(catalogItem,price,providerName,businessId,document.getElementById('mx-catalog-branch')?.value||defaultBranch.id);
  }));
  document.getElementById('mx-catalog-branch')?.addEventListener('change',async event=>{
    try{
      const branchId=event.target.value;
      const branchCatalog=await loadBusinessCatalog(businessId,branchId,providerTenantId);
      const branchCards=(branchCatalog.items||[]).map(item=>{
        const price=catalogCurrentPrice(branchCatalog,item.id,branchId);
        const amount=price?String(price.unit_price)+' '+String(price.currency||''):'السعر غير متاح';
        return '<article class="card"><div class="row"><strong>'+esc(item.name_ar||item.name_en||'صنف')+'</strong><span class="dot"></span></div><p class="muted">'+esc(item.description||item.item_type||'خدمة/صنف')+'</p><div class="row"><b>'+esc(amount)+'</b>'+(price?'<div class="mx-catalog-actions"><button class="text-btn mx-cart-add" data-business-id="'+esc(businessId)+'" data-item-id="'+esc(item.id)+'">أضف للسلة</button><button class="text-btn mx-order-trigger" data-business-id="'+esc(businessId)+'" data-item-id="'+esc(item.id)+'">طلب الآن</button></div>':'')+'</div></article>';
      }).join('')||'<div class="muted">لا توجد أصناف نشطة متاحة لهذا الفرع حاليًا.</div>';
      const box=overlay.querySelector('.cards'); if(box) box.innerHTML=branchCards;
      box?.querySelectorAll('.mx-order-trigger').forEach(btn=>btn.addEventListener('click',()=>openOrderForm(btn.dataset.businessId,btn.dataset.itemId,branchId)));
      box?.querySelectorAll('.mx-cart-add').forEach(btn=>btn.addEventListener('click',()=>{
        const catalogItem=(branchCatalog.items||[]).find(x=>String(x.id)===String(btn.dataset.itemId));
        const price=catalogCurrentPrice(branchCatalog,btn.dataset.itemId,branchId);
        addToMntiCart(catalogItem,price,providerName,businessId,branchId);
      }));
    }catch(e){showToast('تعذر تحميل كتالوج الفرع: '+(e?.message||'CATALOG_REQUEST_FAILED'),'error')}
  });
 }catch(e){showToast('تعذر تحميل الكتالوج: '+(e?.message||'CATALOG_REQUEST_FAILED'),'error')}
}
async function openOrderForm(businessId,itemId,branchId=null){
 const catalog=live.catalogByBusiness[businessId]; const item=(catalog?.items||[]).find(x=>x.id===itemId); const price=catalogCurrentPrice(catalog,itemId,branchId);
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
   if(!branchId)return showToast('اختر الفرع قبل إرسال الطلب.','error');
   const result=await invokeMntyFunction('order-create',{orderId:orderAttemptId,tenantId:catalog.tenantId,businessId,branchId,clientIdempotencyKey,subtotal,discount:0,tax:0,deliveryFee:0,totalAmount:subtotal,currency:price.currency||'EGP',customerName:name,customerPhone:phone,deliveryAddress:address,items:[{catalogItemId:itemId,quantity:qty,options:[]}],notes:null,metadata:{source:'MNTY_CUSTOMER_CATALOG',pricing_server_authoritative:true,branch_id:branchId}});
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
 const customerNav=['الرئيسية','المجالات والخدمات','التجارة والأزياء','البقالة والسوبر ماركت','المطاعم والمطابخ','المنظومة الطبية','الصيانة','الخدمات المهنية','MantiGO والمزايدات','الزواج','الوظائف','التعليم','المستعمل','الطلبات والعمليات','الدعم والحوكمة']; const visible=modules.filter(m=>moduleEnabled(m[1])&&customerNav.includes(m[1]));
 const providers=live.records.providers||[];
 const services=live.records.services||[];
 const providerCards=providers.slice(0,6).map(p=>'<article class="card"><div class="row"><strong>'+esc(p.name_ar||'مقدم خدمة')+'</strong><span class="dot"></span></div><p class="muted">'+esc(p.provider_kind||'خدمة')+' · '+(p.is_verified?'موثق':'مسجل')+'</p><small>الحالة: '+esc(p.status||'—')+'</small>'+(p.business_id?'<button class="text-btn mx-provider-catalog" data-business-id="'+esc(p.business_id)+'" data-provider-name="'+esc(p.name_ar||'مقدم خدمة')+'">عرض الكتالوج</button>':'')+'</article>').join('');
 const serviceCards=services.slice(0,6).map(s=>'<article class="card"><div class="row"><strong>'+esc(s.name_ar||s.name_en||'خدمة')+'</strong><span class="dot"></span></div><p class="muted">'+esc(s.category_code||'خدمة متاحة')+'</p><small>خدمة نشطة على المنصة</small></article>').join('');
 return '<section class="hero"><div><span class="eyebrow">MantiqatiX · عميل</span><h2>اكتشف الخدمة المناسبة وتواصل مع مقدمها</h2><p>استعرض الخدمات ومقدميها من البيانات المتاحة، ثم أرسل طلبك وتابع حالته من حسابك.</p><div class="hero-actions"><button class="btn btn-light" onclick="selectModule(\'المجالات والخدمات\')">استكشف المجالات</button><button class="btn btn-ghost" onclick="selectModule(\'الطلبات والعمليات\')">طلباتي</button></div></div></section><section class="cards"><div class="card"><div class="muted">وضع الحساب</div><div class="kpi">عميل</div><small>العضوية النشطة الحالية</small></div><div class="card"><div class="muted">الطلبات</div><div class="kpi">'+countOrDash('orders')+'</div><small>طلبات مرتبطة بحسابك</small></div><div class="card"><div class="muted">الخدمات النشطة</div><div class="kpi">'+services.length+'</div><small>خدمات مرئية حاليًا</small></div><div class="card"><div class="muted">الدعم</div><div class="kpi">'+countOrDash('support')+'</div><small>تذاكر الدعم</small></div></section><div class="section-head"><div><h2>خدمات متاحة الآن</h2><p>عرض معلومات فعلية فقط؛ لا يتم إنشاء طلب من هذه البطاقة دون مسار الطلب المعتمد.</p></div></div><div class="grid3">'+(serviceCards||'<div class="empty-state">لا توجد خدمات نشطة معروضة حاليًا.</div>')+'</div><div class="section-head"><div><h2>مقدمو الخدمات</h2><p>الملفات الظاهرة وفق صلاحيات القراءة الحالية.</p></div></div><div class="grid3">'+(providerCards||'<div class="empty-state">لا توجد ملفات مقدمي خدمة معروضة حاليًا.</div>')+'</div><div class="section-head"><div><h2>الوصول السريع</h2><p>الخدمات المتاحة لك كعميل.</p></div></div><div class="modules">'+visible.slice(0,8).map(m=>'<article class="card module" onclick="selectModule(\''+m[1]+'\')"><div class="icon">'+m[0]+'</div><h3>'+m[1]+'</h3><div class="muted">'+m[2]+'</div></article>').join('')+'</div>';
}
function isProviderMode(){return ['SERVICE_PROVIDER','OWNER','MANAGER','STAFF','BUSINESS_PARTNER','DELIVERY_PARTNER'].includes(String(live.role||'').toUpperCase())&&!!live.myProviderProfile}
function providerDashboard(){const visible=modules.filter(m=>moduleEnabled(m[1])&&!['الموديولات','المستخدمون وCRM','العمولات والباقات','التقارير والتحليلات','طلبات التسجيل'].includes(m[1]));return '<section class="hero"><div><span class="eyebrow">MantiqatiX · مقدم خدمة</span><h2>أدر نشاطك وخدماتك من مكان واحد</h2><p>اعرض خدماتك المنشورة، استقبل الطلبات المسموح بها، وتابع التشغيل من مساحة العمل. MANTIQATIX توفر البنية الرقمية ولا تتولى تنفيذ الخدمة ماديًا نيابةً عنك.</p><div class="hero-actions"><button class="btn btn-light" onclick="selectModule(\'ملف نشاطي\')">ملف نشاطي</button><button class="btn btn-ghost" onclick="selectModule(\'الطلبات والعمليات\')">الطلبات</button></div></div></section><section class="cards"><div class="card"><div class="muted">حالة النشاط</div><div class="kpi">'+(live.myProviderProfile?.status==='ACTIVE'?'نشط':live.myProviderProfile?.status==='PENDING'?'قيد المراجعة':live.myProviderProfile?.status==='INACTIVE'?'غير نشط':'غير مكتمل')+'</div><small>'+(live.myProviderProfile?.is_verified?'ملف موثق':'حالة الملف وفق البيانات الفعلية')+'</small></div><div class="card"><div class="muted">الطلبات</div><div class="kpi">'+countOrDash('orders')+'</div><small>الطلبات المتاحة وفق الصلاحيات</small></div><div class="card"><div class="muted">الخدمات</div><div class="kpi">'+live.records.services.length+'</div><small>الخدمات المتاحة</small></div><div class="card"><div class="muted">الإشعارات</div><div class="kpi">'+countOrDash('notifications')+'</div><small>آخر تحديثات النشاط</small></div></section><div class="section-head"><div><h2>الوصول السريع</h2><p>الأدوات المتاحة لنطاق مقدم الخدمة.</p></div></div><div class="modules">'+visible.slice(0,8).map(m=>'<article class="card module" onclick="selectModule(\''+m[1]+'\')"><div class="icon">'+m[0]+'</div><h3>'+m[1]+'</h3><div class="muted">'+m[2]+'</div></article>').join('')+'</div>'}
function roleCommandCenter(){
 const role=String(live.role||'').toUpperCase();
 const scope=window.MNTY_RBAC?.scope(role)||'USER';
 const allowed=name=>window.MNTY_RBAC?.can(role,name,'view',live.permissions)===true;
 const canAct=(name,action)=>window.MNTY_RBAC?.can(role,name,action,live.permissions)===true;
 const cfgs={
  FINANCE:{eyebrow:'FINANCE COMMAND CENTER',title:'مركز القيادة المالية',desc:'المؤشرات المالية والطلبات ذات الصلة ضمن نطاق العضوية الحالية.',modules:[['💳','العمولات والباقات','FINANCE'],['📊','التقارير والتحليلات','ANALYTICS'],['🧾','الطلبات والعمليات','ORDERS']]},
  MARKETING:{eyebrow:'MARKETING COMMAND CENTER',title:'مركز قيادة التسويق',desc:'الحملات والعملاء المحتملون والمشروعات التسويقية ضمن النطاق المصرح.',modules:[['📣','التسويق والإعلان','MARKETING'],['👥','المستخدمون وCRM','CRM'],['📊','التقارير والتحليلات','ANALYTICS']]},
  SALES:{eyebrow:'SALES COMMAND CENTER',title:'مركز قيادة المبيعات',desc:'العملاء والطلبات ومتابعة التحويلات المتاحة لدور المبيعات.',modules:[['👥','المستخدمون وCRM','CRM'],['🧾','الطلبات والعمليات','ORDERS'],['📣','التسويق والإعلان','MARKETING']]},
  SUPPORT:{eyebrow:'SUPPORT COMMAND CENTER',title:'مركز قيادة الدعم',desc:'التذاكر والعملاء والطلبات التي يسمح بها نطاق الدعم.',modules:[['🎫','الدعم والحوكمة','SUPPORT'],['👥','المستخدمون وCRM','CRM'],['🧾','الطلبات والعمليات','ORDERS']]},
  SUPPORT_MANAGER:{eyebrow:'SUPPORT COMMAND CENTER',title:'مركز قيادة الدعم',desc:'إدارة الدعم والتذاكر والتصعيد ضمن نطاق العمل.',modules:[['🎫','الدعم والحوكمة','SUPPORT'],['👥','المستخدمون وCRM','CRM'],['📊','التقارير والتحليلات','ANALYTICS']]},
  PROVIDER_FINANCE:{eyebrow:'PROVIDER FINANCE',title:'لوحة المالية لمقدم الخدمة',desc:'عرض المؤشرات المالية المسموح بها لهذا النشاط.',modules:[['💳','العمولات والباقات','FINANCE'],['📊','التقارير والتحليلات','ANALYTICS']]},
  PROVIDER_MARKETING:{eyebrow:'PROVIDER MARKETING',title:'لوحة تسويق مقدم الخدمة',desc:'الحملات والعملاء المحتملون والتحليلات المتاحة للنشاط.',modules:[['📣','التسويق والإعلان','MARKETING'],['👥','المستخدمون وCRM','CRM'],['📊','التقارير والتحليلات','ANALYTICS']]},
  PROVIDER_OPERATIONS:{eyebrow:'PROVIDER OPERATIONS',title:'لوحة تشغيل مقدم الخدمة',desc:'الطلبات والتنفيذ والدعم ضمن نطاق النشاط أو الفرع.',modules:[['🧾','الطلبات والعمليات','ORDERS'],['⚙️','العمليات','OPERATIONS'],['🎫','الدعم والحوكمة','SUPPORT']]},
  PROVIDER_SUPPORT:{eyebrow:'PROVIDER SUPPORT',title:'لوحة دعم مقدم الخدمة',desc:'التذاكر والعملاء والطلبات التي يسمح بها الدور.',modules:[['🎫','الدعم والحوكمة','SUPPORT'],['👥','المستخدمون وCRM','CRM'],['🧾','الطلبات والعمليات','ORDERS']]},
  MANAGER:{eyebrow:'OPERATIONS COMMAND CENTER',title:'مركز قيادة المدير',desc:'تشغيل الفرع/النطاق ومتابعة الطلبات والعملاء والعمليات.',modules:[['🧾','الطلبات والعمليات','ORDERS'],['⚙️','العمليات','OPERATIONS'],['👥','المستخدمون وCRM','CRM'],['📊','التقارير والتحليلات','ANALYTICS']]},
  BUSINESS_OWNER:{eyebrow:'BUSINESS COMMAND CENTER',title:'مركز قيادة النشاط',desc:'إدارة الأعمال والطلبات والعملاء والتسويق وفق نطاق النشاط.',modules:[['🧾','الطلبات والعمليات','ORDERS'],['👥','المستخدمون وCRM','CRM'],['📣','التسويق والإعلان','MARKETING'],['💳','العمولات والباقات','FINANCE']]},
  PROVIDER_OWNER:{eyebrow:'PROVIDER BUSINESS COMMAND CENTER',title:'مركز قيادة مقدم الخدمة',desc:'إدارة نشاط مقدم الخدمة وعملياته وفريقه وفق الصلاحيات.',modules:[['🧾','الطلبات والعمليات','ORDERS'],['⚙️','العمليات','OPERATIONS'],['👥','المستخدمون وCRM','CRM'],['💳','العمولات والباقات','FINANCE']]},
  ADMIN:{eyebrow:'BUSINESS ADMIN COMMAND CENTER',title:'مركز قيادة الإدارة',desc:'إدارة المستخدمين والعمليات والكتالوج والتسويق ضمن نطاق النشاط.',modules:[['👥','المستخدمون وCRM','CRM'],['🧾','الطلبات والعمليات','ORDERS'],['⚙️','العمليات','OPERATIONS'],['📣','التسويق والإعلان','MARKETING']]},
  OWNER:{eyebrow:'OWNER COMMAND CENTER',title:'مركز قيادة المالك',desc:'نظرة موحدة على النشاط والعملاء والطلبات والمالية.',modules:[['🧾','الطلبات والعمليات','ORDERS'],['👥','المستخدمون وCRM','CRM'],['💳','العمولات والباقات','FINANCE'],['📊','التقارير والتحليلات','ANALYTICS']]},
  EMPLOYEE:{eyebrow:'OPERATIONS WORKSPACE',title:'لوحة العمل',desc:'المهام والطلبات والعمليات التي يسمح بها الدور.',modules:[['🧾','الطلبات والعمليات','ORDERS'],['⚙️','العمليات','OPERATIONS'],['🎫','الدعم والحوكمة','SUPPORT']]},
  STAFF:{eyebrow:'BRANCH WORKSPACE',title:'لوحة الفرع',desc:'تشغيل الطلبات والعمليات والعملاء داخل نطاق الفرع.',modules:[['🧾','الطلبات والعمليات','ORDERS'],['⚙️','العمليات','OPERATIONS'],['👥','المستخدمون وCRM','CRM']]},
  BRANCH_MANAGER:{eyebrow:'BRANCH COMMAND CENTER',title:'مركز قيادة الفرع',desc:'إدارة الطلبات والعمليات والعملاء والتحليلات المسموح بها.',modules:[['🧾','الطلبات والعمليات','ORDERS'],['⚙️','العمليات','OPERATIONS'],['👥','المستخدمون وCRM','CRM'],['📊','التقارير والتحليلات','ANALYTICS']]},
  SERVICE_PROVIDER:{eyebrow:'PROVIDER COMMAND CENTER',title:'مركز قيادة مقدم الخدمة',desc:'إدارة الطلبات والخدمات والتسويق والملف التشغيلي.',modules:[['🧾','الطلبات والعمليات','ORDERS'],['⚙️','العمليات','OPERATIONS'],['📣','التسويق والإعلان','MARKETING'],['👥','المستخدمون وCRM','CRM']]}
 };
 const fallback={eyebrow:'MantiqatiX WORKSPACE',title:'لوحة العمل',desc:'الوحدات والبيانات المتاحة وفق الدور والنطاق الفعلي.',modules:[['🧾','الطلبات والعمليات','ORDERS'],['👥','المستخدمون وCRM','CRM'],['📊','التقارير والتحليلات','ANALYTICS']]};
 const meta=cfgs[role]||fallback;
 const cards=[['الطلبات',countOrDash('orders'),'الطلبات المرئية ضمن النطاق'],['العملاء',countOrDash('leads'),'العملاء/العملاء المحتملون'],['مقدمو الخدمة',countOrDash('providers'),'ملفات مقدمي الخدمة'],['الدعم',countOrDash('support'),'تذاكر الدعم'],['الإعلانات',countOrDash('ads'),'الإعلانات المتاحة'],['المشروعات',countOrDash('projects'),'المشروعات التسويقية']].filter((_,i)=>i<4||['OWNER','BUSINESS_OWNER','PROVIDER_OWNER','ADMIN','MANAGER','FINANCE','MARKETING','SALES','SUPPORT_MANAGER'].includes(role));
 const pending=(live.records.registrationRequests||[]).filter(x=>String(x.status||'').toUpperCase()==='PENDING').length;
 const unread=(live.records.notifications||[]).filter(x=>!x.read_at&&!x.is_read).length;
 const attention=[];
 if(pending&&['OWNER','BUSINESS_OWNER','ADMIN'].includes(role))attention.push(['critical','طلبات تسجيل','هناك '+pending+' طلب تسجيل يحتاج مراجعة.','طلبات التسجيل']);
 if(unread)attention.push(['attention','إشعارات','لديك '+unread+' إشعار غير مقروء.','الإشعارات']);
 if(!attention.length)attention.push(['success','الحالة الحالية','لا توجد عناصر حرجة مثبتة في البيانات المحملة.','الرئيسية']);
 const actions=meta.modules.filter(x=>allowed(x[1])||canAct(x[2],'view'));
 return '<section class="mx-role-hero"><div><span class="eyebrow">'+esc(meta.eyebrow)+'</span><h2>'+esc(meta.title)+'</h2><p>'+esc(meta.desc)+'</p></div><div class="mx-role-scope"><b>'+esc(role)+'</b><span>النطاق: '+esc(scope)+'</span></div></section>'+
 '<section class="mx-role-kpis">'+cards.map(x=>'<button class="card mx-role-kpi" data-role-module="'+esc(x[0])+'"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong><small>'+esc(x[2])+'</small></button>').join('')+'</section>'+
 '<section class="mx-role-grid"><div class="card mx-role-panel"><div class="section-head"><div><span class="eyebrow">ATTENTION</span><h3>يحتاج انتباهك</h3></div></div>'+attention.map(a=>'<button class="mx-role-attention '+a[0]+'" data-role-module="'+esc(a[3])+'"><b>'+esc(a[1])+'</b><small>'+esc(a[2])+'</small><span>›</span></button>').join('')+'</div>'+
 '<div class="card mx-role-panel"><div class="section-head"><div><span class="eyebrow">WORKSPACES</span><h3>مساحات العمل</h3></div><span class="count">'+actions.length+'</span></div><div class="mx-role-actions">'+actions.map(x=>'<button class="mx-role-action" data-role-module="'+esc(x[1])+'"><span>'+x[0]+'</span><b>'+esc(x[1])+'</b><small>'+esc(x[2])+'</small></button>').join('')+'</div></div></section>'+
 '<section class="card mx-role-note"><b>حدود الصلاحية</b><span>الدور: '+esc(role)+' · النطاق: '+esc(scope)+' · العرض لا يمنح صلاحيات إضافية؛ التحقق النهائي يبقى في RLS/RPC/Edge Functions.</span></section><div class="mx-role-bind" data-role-bound="0"></div>';
}
function bindRoleCommandCenter(){
 const root=document.querySelector('.mx-role-bind');if(!root||root.dataset.roleBound==='1')return;root.dataset.roleBound='1';
 document.querySelectorAll('[data-role-module]').forEach(el=>el.addEventListener('click',()=>selectModule(el.dataset.roleModule)));
}
function roleWorkspaceDashboard(){
 const role=String(live.role||'').toUpperCase();
 const owner=window.MNTY_RBAC?.ownerRole(role);
 const provider=window.MNTY_RBAC?.providerRole(role);
 const label=role==='SUPER_ADMIN'?'Super Admin':owner?'Owner / Business':provider?'Provider Workspace':role;
 const scope=window.MNTY_RBAC?.scope(role)||'USER';
 const allowed=(name)=>window.MNTY_RBAC?.can(role,name,'view',live.permissions);
 const cards=[
  ['الطلبات',countOrDash('orders'),'الطلبات المرئية وفق النطاق والصلاحيات'],
  ['العملاء',countOrDash('leads'),'سجلات العملاء/العملاء المحتملين المتاحة'],
  ['مقدمو الخدمة',countOrDash('providers'),'ملفات مقدمي الخدمة المتاحة'],
  ['الدعم',countOrDash('support'),'تذاكر الدعم المرتبطة بالنطاق'],
  ['الإعلانات',countOrDash('ads'),'الإعلانات/الحملات المرتبطة بالنطاق'],
  ['المشروعات',countOrDash('projects'),'المشروعات التسويقية المرتبطة بالنطاق']
 ].filter((_,i)=>owner||provider||role==='SUPER_ADMIN'?true:i<4);
 const quick=modules.filter(m=>moduleEnabled(m[1])&&allowed(m[1])).slice(0,10);
 return '<section class="hero"><div><span class="eyebrow">MantiqatiX · '+esc(label)+'</span><h2>'+esc(owner?'لوحة إدارة النشاط والشركة':provider?'لوحة تشغيل مقدم الخدمة':'مركز تحكم المنصة')+'</h2><p>النطاق الحالي: '+esc(scope)+' · البيانات والعمليات تظهر وفق العضوية والصلاحيات الفعلية، ولا تمنح الواجهة صلاحية تتجاوز الخادم.</p><div class="hero-actions">'+(allowed('ORDERS')?'<button class="btn btn-light" onclick="selectModule(\'الطلبات والعمليات\')">الطلبات والعمليات</button>':'')+(allowed('ANALYTICS')?'<button class="btn btn-ghost" onclick="selectModule(\'التقارير والتحليلات\')">التقارير والتحليلات</button>':'')+'</div></div></section><section class="cards">'+cards.map(x=>'<div class="card"><div class="muted">'+x[0]+'</div><div class="kpi">'+x[1]+'</div><small>'+x[2]+'</small></div>').join('')+'</section><div class="section-head"><div><h2>لوحة العمل</h2><p>الموديولات المتاحة لهذا الدور والنطاق فقط.</p></div><span class="count">'+quick.length+' وحدات</span></div><div class="modules">'+quick.map(m=>'<article class="card module" onclick="selectModule(\''+m[1]+'\')"><div class="icon">'+m[0]+'</div><h3>'+m[1]+'</h3><div class="muted">'+m[2]+'</div><span class="status">صلاحية عرض متاحة</span></article>').join('')+'</div>';
}
function dashboard(){
 const visibleModules=modules.filter(m=>moduleEnabled(m[1]));
 const quick=filtered(visibleModules).slice(0,8);
 return '<section class="hero"><div><span class="eyebrow">MantiqatiX · PLATFORM</span><h2>منصة تسويق وربط الخدمات المحلية</h2><p>واجهة موحدة لاكتشاف الخدمات، إدارة الأنشطة، استقبال الطلبات، التسويق، المتابعة والتقارير. كل رقم تشغيلي يظهر من مصدر فعلي فقط.</p><div class="hero-actions"><button class="btn btn-light" onclick="selectModule(\'المجالات والخدمات\')">استكشف المجالات</button><button class="btn btn-ghost" onclick="selectModule(\'الموديولات\')">إدارة الموديولات</button></div></div></section><section class="mnty-stat-strip"><div><b>'+sectors.length+'</b><span>مجالات</span></div><div><b>'+domainModules.length+'</b><span>وحدات تشغيلية</span></div><div><b>'+countOrDash('providers')+'</b><span>مقدمو خدمة</span></div><div><b>'+countOrDash('orders')+'</b><span>طلبات</span></div></section><div class="section-head"><div><h2>الوصول السريع</h2><p>ابدأ من المجال أو الوحدة المناسبة.</p></div><span class="count">'+quick.length+' مساحات</span></div><div class="modules">'+quick.map(m=>'<article class="card module" onclick="selectModule(\''+m[1]+'\')"><div class="icon">'+m[0]+'</div><h3>'+m[1]+'</h3><div class="muted">'+m[2]+'</div><span class="status">فتح مساحة العمل</span></article>').join('')+'</div><section class="mnty-product-shell" style="margin-top:18px"><div class="mnty-product-head"><div><span class="eyebrow">PRODUCT ROADMAP</span><h2>المنصة تُبنى كمنتج واحد</h2><p>الوحدات غير المكتملة خلفيًا لا تتوقف عن الظهور؛ نستكمل تجربة الاستخدام أولًا ثم نربط الخدمات الحقيقية تدريجيًا.</p></div><div class="mnty-future-stats"><div><b>UI</b><span>EVOLVING</span></div><div><b>DATA</b><span>REAL ONLY</span></div><div><b>API</b><span>SERVER</span></div></div></div></section>';
}
function smmModulePage(){return `<div class="section-head"><div><h2>خدمات التسويق الرقمي SMM</h2><p>موديول MANTIQATIX لإدارة الخدمات الرقمية والطلبات والموردين من نفس الحساب.</p></div><span class="count">Module / SMM</span></div><div class="embedded-module"><iframe src="smm.html" title="MANTIQATIX SMM Module" loading="lazy"></iframe></div>`}
function enterpriseCommandCenter(){
 const role=String(live.role||'').toUpperCase();
 if(!canSuperAdmin()) return roleWorkspaceDashboard();
 const visibleModules=modules.filter(m=>moduleEnabled(m[1]));
 const pendingRegs=(live.records.registrationRequests||[]).filter(x=>String(x.status||'').toUpperCase()==='PENDING');
 const notifications=live.records.notifications||[];
 const unreadNotifications=notifications.filter(x=>!x.read_at&&!x.is_read).length;
 const orderCount=countOrDash('orders');
 const providerCount=countOrDash('providers');
 const leadCount=countOrDash('leads');
 const supportCount=countOrDash('support');
 const cards=[
  ['الطلبات',orderCount,'العمليات والطلبات ضمن النطاق','الطلبات والعمليات'],
  ['مقدمو الخدمة',providerCount,'ملفات مقدمي الخدمة المتاحة','المستخدمون وCRM'],
  ['العملاء / العملاء المحتملون',leadCount,'السجلات المرئية حسب الصلاحيات','المستخدمون وCRM'],
  ['الدعم',supportCount,'تذاكر الدعم المرتبطة بالنطاق','الدعم'],
  ['طلبات التسجيل',String(pendingRegs.length),'طلبات تحتاج مراجعة','طلبات التسجيل'],
  ['الإشعارات غير المقروءة',String(unreadNotifications),'تنبيهات تحتاج انتباهًا','الإشعارات']
 ];
 const attention=[];
 if(pendingRegs.length) attention.push(['critical','طلبات تسجيل معلقة','هناك '+pendingRegs.length+' طلب/طلبات تحتاج مراجعة.','طلبات التسجيل']);
 if(unreadNotifications) attention.push(['attention','إشعارات غير مقروءة','لديك '+unreadNotifications+' إشعارًا غير مقروء.','الإشعارات']);
 if(orderCount!=='—' && Number(orderCount)>0) attention.push(['info','الطلبات','يوجد '+orderCount+' طلبًا ضمن نطاق العرض الحالي.','الطلبات والعمليات']);
 if(!attention.length) attention.push(['success','الحالة التشغيلية','لا توجد عناصر حرجة مثبتة في البيانات المحملة حاليًا.','الرئيسية']);
 const quick=[
  ['➕','إضافة نشاط','بدء مسار إنشاء نشاط','التحكم الكامل'],
  ['🧾','الطلبات','متابعة العمليات','الطلبات والعمليات'],
  ['👥','المستخدمون وCRM','العملاء ومقدمو الخدمة','المستخدمون وCRM'],
  ['📣','التسويق','الحملات والإعلانات','التسويق والإعلان'],
  ['💰','المالية','العمولات والباقات','العمولات والباقات'],
  ['📊','التقارير','التحليلات والتقارير','التقارير والتحليلات'],
  ['🔔','الإشعارات','مركز التنبيهات','الإشعارات'],
  ['⚙️','الموديولات','إدارة وحدات المنصة','الموديولات'],['🛡️','الصحة والأمان','System Health & Security','مركز الصحة والأمان']
 ].filter(x=>x[3]==='التحكم الكامل'||x[3]==='مركز الصحة والأمان'||visibleModules.some(m=>m[1]===x[3])||x[3]==='الرئيسية');
 const qid='mx-ec-search';
 return '<section class="mx-ec-hero"><div><span class="eyebrow">MantiqatiX · ENTERPRISE COMMAND CENTER</span><h2>مركز قيادة المنصة</h2><p>نظرة تشغيلية موحدة على الأعمال والعمليات والتنبيهات والموديولات، مع احترام نطاق العضوية والصلاحيات الفعلية.</p></div><div class="mx-ec-hero-meta"><span class="mx-ec-role">SUPER ADMIN</span><span>النطاق: '+esc(window.MNTY_RBAC?.scope(role)||'PLATFORM')+'</span></div></section>'+
 '<section class="mx-ec-search card"><label for="'+qid+'">البحث السريع داخل وحدات لوحة التحكم</label><div class="mx-ec-search-row"><input id="'+qid+'" type="search" autocomplete="off" placeholder="اكتب اسم الوحدة أو العميلة أو العملية…"><button class="btn btn-primary" id="mx-ec-search-btn">بحث</button></div><div id="mx-ec-search-results" class="mx-ec-search-results" aria-live="polite"></div></section>'+
 '<section class="mx-ec-kpis">'+cards.map(x=>'<button class="mx-ec-kpi card" data-ec-module="'+esc(x[3])+'"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong><small>'+esc(x[2])+'</small></button>').join('')+'</section>'+
 '<section class="mx-ec-grid"><div class="card mx-ec-panel"><div class="section-head"><div><span class="eyebrow">ATTENTION CENTER</span><h2>يحتاج انتباهك</h2></div><span class="count">'+attention.length+'</span></div><div class="mx-ec-attention">'+attention.map(a=>'<button class="mx-ec-attention-item '+a[0]+'" data-ec-module="'+esc(a[3])+'"><span class="mx-ec-attention-dot"></span><span><b>'+esc(a[1])+'</b><small>'+esc(a[2])+'</small></span><span>›</span></button>').join('')+'</div></div>'+
 '<div class="card mx-ec-panel"><div class="section-head"><div><span class="eyebrow">QUICK ACTIONS</span><h2>إجراءات سريعة</h2></div></div><div class="mx-ec-actions">'+quick.map(x=>'<button class="mx-ec-action" data-ec-module="'+esc(x[3])+'"><span>'+x[0]+'</span><b>'+esc(x[1])+'</b><small>'+esc(x[2])+'</small></button>').join('')+'</div></div></section>'+
 '<section class="card mx-ec-modules"><div class="section-head"><div><span class="eyebrow">MODULE MAP</span><h2>مساحات العمل</h2><p>الموديولات الظاهرة هنا مستخرجة من المنصة الحالية، وليست قائمة افتراضية.</p></div><span class="count">'+visibleModules.length+'</span></div><div class="mx-ec-module-grid">'+visibleModules.slice(0,18).map(m=>'<button class="mx-ec-module" data-ec-module="'+esc(m[1])+'"><span>'+m[0]+'</span><b>'+esc(m[1])+'</b><small>'+esc(m[2])+'</small></button>').join('')+'</div></section>'+
 '<div class="mx-ec-bind" data-ec-bound="0"></div>';
}
function bindEnterpriseCommandCenter(){
 const root=document.querySelector('.mx-ec-bind'); if(!root||root.dataset.ecBound==='1')return;
 root.dataset.ecBound='1';
 const go=name=>{if(!name)return;if(name==='التحكم الكامل')return showToast('أنت بالفعل داخل مركز التحكم الكامل.','info');selectModule(name)};
 document.querySelectorAll('[data-ec-module]').forEach(el=>el.addEventListener('click',()=>go(el.dataset.ecModule)));
 const input=document.getElementById('mx-ec-search'),out=document.getElementById('mx-ec-search-results'),btn=document.getElementById('mx-ec-search-btn');
 const run=()=>{const q=String(input?.value||'').trim().toLowerCase();if(!out)return;const hits=modules.filter(m=>String(m[1]||'').toLowerCase().includes(q)||String(m[2]||'').toLowerCase().includes(q)).slice(0,8);out.innerHTML=q?(hits.length?hits.map(m=>'<button class="mx-ec-search-hit" data-ec-module="'+esc(m[1])+'"><span>'+m[0]+'</span><b>'+esc(m[1])+'</b><small>'+esc(m[2])+'</small></button>').join(''):'<span class="muted">لا توجد وحدة مطابقة.</span>'):'<span class="muted">ابدأ بكتابة اسم الوحدة.</span>';out.querySelectorAll('[data-ec-module]').forEach(el=>el.addEventListener('click',()=>go(el.dataset.ecModule)))};
 input?.addEventListener('input',run); btn?.addEventListener('click',run);
}
function pageContent(){switch(current){case'الرئيسية':return canSuperAdmin()?enterpriseCommandCenter():((window.MNTY_RBAC?.roleOf(String(live.role||''))!=='CUSTOMER'&&!isCustomerMode())?roleCommandCenter():(isCustomerMode()?customerDashboard():isProviderMode()?providerDashboard():dashboard()));case'الموديولات':return modulePage();case'خدمات التسويق الرقمي SMM':return smmModulePage();case'المجالات والخدمات':return sectorsPage();case'المستخدمون':return genericPage('المستخدمون','إدارة العملاء ومقدمي الخدمة والموظفين.',[['العملاء','ملفات العملاء وتاريخ الطلبات'],['مقدمو الخدمة','الملفات والاعتماد والباقات'],['الموظفون','الأدوار والصلاحيات']]);case'الطلبات':return genericPage('الطلبات','متابعة الطلبات والحجوزات ومسارات الإحالة.',[['طلبات جديدة','طلبات تحتاج مراجعة'],['قيد المتابعة','طلبات مرتبطة بمقدم خدمة'],['مكتملة','سجل الطلبات المكتملة']]);case'التسويق والإعلان':return genericPage('التسويق والإعلان','نظام التسويق الخاص بالشركة مع إمكانية التعاون مع شركات تسويق أخرى.',[['حملات MantiqatiX','حملات جذب العملاء'],['شركات التسويق','إدارة الشركاء ومصادر العملاء'],['الإعلانات','الحملات والإعلانات الممولة']]);case'العمولات والباقات':return genericPage('العمولات والباقات','نماذج مجانية، عمولة بيع، وباقات احترافية تختلف حسب المجال.',[['الباقة المجانية','وجود أساسي داخل المنصة'],['نظام العمولة','عمولة على العمليات/الإضافات المؤهلة'],['الباقات الاحترافية','3 مستويات قابلة للتخصيص حسب المجال']]);case'التقارير':return genericPage('التقارير','لوحة مؤشرات للإدارة والأداء.',[['الأداء','نشاط المنصة ومقدمي الخدمة'],['الإيرادات','العمولات والباقات'],['التحويلات','مصادر العملاء والطلبات']]);case'الدعم':return customerSupportWorkspace();case'الإشعارات':return notificationsWorkspace();default:return genericPage('الإعدادات','إدارة الحساب والمنصة.',[['الحساب','بيانات الحساب وتسجيل الدخول'],['الصلاحيات','الأدوار والوصول'],['إعدادات المنصة','الهوية والإعدادات العامة']])}}
const moduleAliases={'التحكم الكامل':['SUPER_ADMIN','PLATFORM_CONTROL'],'الرئيسية':['HOME','DASHBOARD'],'الموديولات':['MODULES'],'المجالات والخدمات':['SECTORS','SERVICES'],'التجارة والأزياء':['FASHION','RETAIL'],'البقالة والسوبر ماركت':['GROCERY'],'المطاعم والمطابخ':['RESTAURANTS'],'المنظومة الطبية':['MEDICAL','HEALTH'],'الصيانة':['MAINTENANCE'],'الخدمات المهنية':['PROFESSIONAL','ERP'],'MantiGO والمزايدات':['MANTIGO','REVERSE_BIDDING'],'الزواج':['MATRIMONY'],'الوظائف':['JOBS'],'التعليم':['EDUCATION'],'المستعمل':['USED_ITEMS'],'التسويق والإعلان':['MARKETING','ADVERTISING'],'خدمات التسويق الرقمي SMM':['SMM'],'المستخدمون وCRM':['CRM','USERS'],'الطلبات والعمليات':['ORDERS','OPERATIONS'],'العمولات والباقات':['FINANCE','COMMISSIONS'],'التقارير والتحليلات':['ANALYTICS','REPORTS'],'الدعم والحوكمة':['GOVERNANCE','SUPPORT'],'الإعدادات':['SETTINGS']};
function normCode(v){return String(v||'').trim().toUpperCase().replace(/[\\s-]+/g,'_')}
function moduleFlagKeys(name){return [normCode(name)].concat((moduleAliases[name]||[]).map(normCode))}
function moduleEnabled(name){for(const key of moduleFlagKeys(name)){for(const feature of ['MODULE_ENABLED','ENABLED','VISIBILITY']){const flag=live.flags[key+':'+feature];if(flag)return flag.enabled!==false}}return true}
function featureEnabled(moduleCode,featureCode){const a=live.flags[normCode(moduleCode)+':'+normCode(featureCode)];const b=live.flags[':'+normCode(featureCode)];return a?.enabled===true||b?.enabled===true}
function canManage(){const r=String(live.role||'').toUpperCase();return window.MNTY_RBAC?.can(r,'ORDERS','update',live.permissions)===true||['SUPER_ADMIN','ADMIN','OWNER','MANAGER'].includes(r)}
function canSuperAdmin(){return window.MNTY_RBAC?.can('SUPER_ADMIN','PLATFORM_CONTROL','view',live.permissions)===true}
async function selectModule(name){
 const role=String(live.role||'').toUpperCase();
 const privileged=window.MNTY_RBAC?.isPrivileged(role)===true||['SUPER_ADMIN','OWNER','ADMIN','MANAGER'].includes(role);
 const rbacKnown=!!window.MNTY_RBAC?.ROLE_DEFAULTS?.[role];
 if(rbacKnown && name!=='ملف نشاطي' && !window.MNTY_RBAC.can(role,name,'view',live.permissions)){
   showToast('هذه الوحدة غير متاحة لهذا الدور أو النطاق.','error');return;
 }
 if(name!=='ملف نشاطي'&&!moduleEnabled(name)&&!(privileged&&name==='المستخدمون وCRM')){
   showToast('هذه الوحدة غير مفعلة لهذا النطاق.','error');return;
 }
 current=name;query='';
 try{localStorage.setItem('MNTYWorkspaceMode','ADMIN');localStorage.setItem('MNTYWorkspaceCurrent',name)}catch(_){}
 try{await renderApp({forceWorkspace:true})}catch(e){showToast('تعذر فتح الوحدة: '+(e?.message||'خطأ غير معروف'),'error')}
}
window.openCrmWorkspace=()=>selectModule('المستخدمون وCRM');
function openContextualHome(){
 const role=String(live.role||'').toUpperCase();
 const privileged=['SUPER_ADMIN','OWNER','ADMIN','MANAGER'].includes(role);
 const adminWorkspace=localStorage.getItem('MNTYWorkspaceMode')==='ADMIN';
 if(privileged&&adminWorkspace){
   return selectModule('الرئيسية');
 }
 try{
   localStorage.removeItem('MNTYWorkspaceMode');
   localStorage.removeItem('MNTYWorkspaceCurrent');
 }catch(_){}
 return window.MXHomeLanding?window.MXHomeLanding():landingView();
}
function providerImageUrl(path,version='1'){if(!path)return '';try{const url=sb.storage.from('mantiqatix-profile-media').getPublicUrl(path)?.data?.publicUrl||'';return url?(url+'?v='+encodeURIComponent(version)) : ''}catch(_){return ''}}
async function prepareProviderImage(file){if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('اختر صورة JPG أو PNG أو WebP.');if(file.size>5*1024*1024)throw new Error('حجم الصورة يجب ألا يتجاوز 5MB.');return new Promise((resolve,reject)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{try{const max=1600,scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{URL.revokeObjectURL(url);if(!blob)return reject(new Error('تعذر تجهيز الصورة.'));resolve(blob)},'image/webp',.86)}catch(e){URL.revokeObjectURL(url);reject(e)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('تعذر قراءة الصورة.'))};img.src=url})}
async function saveProviderProfileImage(){if(!user?.id||!live.myProviderProfile)return authView();const input=document.getElementById('provider-image-file');const file=input?.files?.[0];if(!file)return showToast('اختر صورة النشاط أولًا.','error');const btn=document.getElementById('provider-image-save');if(btn){btn.disabled=true;btn.textContent='جارٍ رفع الصورة...'}try{const blob=await prepareProviderImage(file);const path='users/'+user.id+'/providers/'+live.myProviderProfile.id+'/cover.webp';const upload=await sb.storage.from('mantiqatix-profile-media').upload(path,blob,{contentType:'image/webp',upsert:true,cacheControl:'31536000'});if(upload.error)throw upload.error;const {data,error}=await sb.from('marketing_provider_profiles').update({profile_image_path:path,updated_at:new Date().toISOString()}).eq('id',live.myProviderProfile.id).eq('owner_user_id',user.id).select('id,profile_image_path').single();if(error)throw error;live.myProviderProfile.profile_image_path=data.profile_image_path;showToast('تم تحديث صورة النشاط بنجاح.','success');renderApp()}catch(e){if(btn){btn.disabled=false;btn.textContent='حفظ صورة النشاط'}showToast('تعذر تحديث صورة النشاط: '+(e?.message||'خطأ غير معروف'),'error')}}
async function saveProviderLogo(){if(!user?.id||!live.myProviderProfile)return authView();const input=document.getElementById('provider-logo-file');const file=input?.files?.[0];if(!file)return showToast('اختر لوجو النشاط أولًا.','error');const btn=document.getElementById('provider-logo-save');if(btn){btn.disabled=true;btn.textContent='جارٍ حفظ اللوجو...'}try{const blob=await prepareProviderImage(file);const path='users/'+user.id+'/providers/'+live.myProviderProfile.id+'/logo.webp';const upload=await sb.storage.from('mantiqatix-profile-media').upload(path,blob,{contentType:'image/webp',upsert:true,cacheControl:'31536000'});if(upload.error)throw upload.error;const settings=live.myProviderProfile.settings&&typeof live.myProviderProfile.settings==='object'?live.myProviderProfile.settings:{};const branding=settings.branding&&typeof settings.branding==='object'?settings.branding:{};const nextSettings={...settings,branding:{...branding,logo_path:path}};const {data,error}=await sb.from('marketing_provider_profiles').update({settings:nextSettings,updated_at:new Date().toISOString()}).eq('id',live.myProviderProfile.id).eq('owner_user_id',user.id).select('id,settings').single();if(error)throw error;live.myProviderProfile.settings=data.settings;showToast('تم تحديث لوجو النشاط دون تغيير الصورة الأصلية.','success');renderApp()}catch(e){if(btn){btn.disabled=false;btn.textContent='حفظ لوجو النشاط'}showToast('تعذر تحديث لوجو النشاط: '+(e?.message||'خطأ غير معروف'),'error')}}
async function resetProviderLogo(){if(!user?.id||!live.myProviderProfile)return authView();const btn=document.getElementById('provider-logo-reset');if(btn)btn.disabled=true;try{const settings=live.myProviderProfile.settings&&typeof live.myProviderProfile.settings==='object'?live.myProviderProfile.settings:{};const branding=settings.branding&&typeof settings.branding==='object'?settings.branding:{};const nextBranding={...branding};delete nextBranding.logo_path;const nextSettings={...settings,branding:nextBranding};const {data,error}=await sb.from('marketing_provider_profiles').update({settings:nextSettings,updated_at:new Date().toISOString()}).eq('id',live.myProviderProfile.id).eq('owner_user_id',user.id).select('id,settings').single();if(error)throw error;live.myProviderProfile.settings=data.settings;showToast('تم الرجوع للهوية الأصلية للنشاط.','success');renderApp()}catch(e){if(btn)btn.disabled=false;showToast('تعذر الرجوع للوجو الأصلي: '+(e?.message||'خطأ غير معروف'),'error')}}
function accountStatusPanel(){
 const memberships=(live.memberships||[]).filter(m=>m.status==='ACTIVE');
 const roles=[...new Set(memberships.map(m=>roleContextLabel(m)))];
 const pending=(live.records.registrationRequests||[]).filter(r=>r.status==='PENDING');
 const verified=Boolean(user?.email_confirmed_at||user?.confirmed_at);
 return '<section class="mnty-product-shell mnty-account-hero" style="margin-bottom:18px"><div class="mnty-product-head"><div><span class="eyebrow">ACCOUNT CENTER</span><h2>مركز الحساب والصلاحيات</h2><p>ملخص الهوية والعضويات والحالة التشغيلية للحساب الحالي.</p></div><span class="mnty-badge mnty-badge--ui">'+esc(live.role||'USER')+'</span></div><div class="mnty-account-identity"><div class="mnty-avatar" aria-hidden="true">'+esc(String(user?.email||'U').trim().charAt(0).toUpperCase()||'U')+'</div><div><b>'+esc(user?.email||'—')+'</b><span>'+esc(verified?'البريد مؤكد':'حالة البريد حسب جلسة الحساب')+'</span></div></div><div class="mnty-stat-strip"><div><b>'+memberships.length+'</b><span>عضويات نشطة</span></div><div><b>'+roles.length+'</b><span>أدوار مختلفة</span></div><div><b>'+pending.length+'</b><span>طلبات معلقة</span></div><div><b>'+esc(verified?'مؤكد':'—')+'</b><span>حالة البريد</span></div></div><div class="mnty-screen-note">'+(roles.length?'الأدوار الحالية: '+roles.map(esc).join(' · '):'لا توجد عضوية تشغيلية نشطة حاليًا.')+'</div></section>';
}
function providerProfileWorkspace(){const p=live.myProviderProfile;if(!p)return workspaceHead('PROFILE','ملف نشاطي','لا يوجد ملف نشاط مرتبط بالحساب الحالي.','NOT FOUND')+'<div class="empty-state">سجل نشاطك كمقدم خدمة أولًا ليظهر هنا.</div>';const image=providerImageUrl(p.profile_image_path,p.updated_at);const activityLogoPath=p?.settings?.branding?.logo_path||'';const activityLogo=activityLogoPath?providerImageUrl(activityLogoPath,p.updated_at):'';const services=live.records.providerServices||[];let areas=[];try{areas=Array.isArray(p.service_areas)?p.service_areas:typeof p.service_areas==='string'?JSON.parse(p.service_areas||'[]'):[]}catch(_){areas=[]}const areaNames=areas.map(a=>a.center_name_ar||a.governorate_name_ar||a.name_ar).filter(Boolean);const activeServices=services.filter(s=>String(s.status||'ACTIVE').toUpperCase()==='ACTIVE');const serviceCards=services.length?services.slice(0,12).map(s=>'<article class="card mnty-provider-service-card"><div class="row"><strong>'+esc(s.service_description||'خدمة مقدمة')+'</strong><span class="mnty-badge">'+esc(String(s.status||'ACTIVE'))+'</span></div><p class="muted">'+(s.pricing_from!=null?'من '+esc(s.pricing_from)+' '+esc(s.currency||'EGP'):'السعر حسب الاتفاق')+(s.pricing_to!=null?' · حتى '+esc(s.pricing_to)+' '+esc(s.currency||'EGP'):'')+'</p></article>').join(''):'<div class="empty-state">لا توجد خدمات مسجلة في ملف النشاط حتى الآن.</div>';return workspaceHead('MY ACTIVITY','ملف نشاطي','لوحة إدارة واجهة النشاط والبيانات الظاهرة في الكتالوج العام. البيانات هنا من ملف النشاط الفعلي فقط.','OWNER')+'<section class="mnty-product-shell"><div class="mnty-product-head"><div><span class="eyebrow">ACTIVITY PROFILE</span><h2>'+esc(p.name_ar||p.name_en||'نشاطي')+'</h2><p>'+esc(p.provider_kind||'مقدم خدمة')+' · '+esc(p.status||'—')+'</p></div><span class="mnty-badge '+(p.is_verified?'mnty-badge--live':'')+'">'+esc(p.is_verified?'موثق':'قيد التحقق')+'</span></div><div class="mnty-stat-strip"><div><b>'+services.length+'</b><span>خدمات مسجلة</span></div><div><b>'+activeServices.length+'</b><span>خدمات نشطة</span></div><div><b>'+areaNames.length+'</b><span>مناطق خدمة</span></div><div><b>'+esc(p.is_featured?'نعم':'—')+'</b><span>ظهور مميز</span></div></div><div class="mnty-screen-note">'+esc(p.description||'لا يوجد وصف نشاط مسجل حاليًا.')+'</div></section><section class="card provider-profile-editor"><div class="row"><div><h3>الصورة العامة</h3><p class="muted">تظهر في الكتالوج العام بعد تحديث الملف.</p></div>'+(image?'<img class="provider-profile-preview" src="'+esc(image)+'" alt="صورة النشاط">':'<div class="provider-profile-preview provider-profile-preview--empty">صورة افتراضية</div>')+'</div><div class="field"><label>صورة النشاط</label><input id="provider-image-file" type="file" accept="image/jpeg,image/png,image/webp"><small class="muted">JPG / PNG / WebP · حتى 5MB · يتم تجهيزها كـWebP قبل الحفظ.</small><div id="provider-image-preview" class="provider-image-preview-note" aria-live="polite">اختر صورة لمعاينتها قبل الحفظ.</div></div><div class="action-bar"><button class="btn btn-primary" id="provider-image-save" style="width:auto">حفظ صورة النشاط</button></div></section><section class="card provider-profile-editor mnty-provider-logo-editor"><div class="row"><div><h3>لوجو النشاط</h3><p class="muted">اللوجو مستقل عن صورة النشاط والأيقونة الأصلية. تغييره لا يستبدل الأصل ويمكن الرجوع إليه في أي وقت.</p></div>'+(activityLogo?'<img class="provider-profile-preview" src="'+esc(activityLogo)+'" alt="لوجو النشاط الحالي">':'<div class="provider-profile-preview provider-profile-preview--empty">الهوية الأصلية</div>')+'</div><div class="field"><label>لوجو جديد للنشاط</label><input id="provider-logo-file" type="file" accept="image/jpeg,image/png,image/webp"><small class="muted">JPG / PNG / WebP · حتى 5MB.</small></div><div class="action-bar"><button class="btn btn-primary" id="provider-logo-save" style="width:auto">حفظ لوجو النشاط</button><button class="btn btn-outline" id="provider-logo-reset" style="width:auto">الرجوع للأصل</button></div></section><section class="records"><div class="section-head"><div><span class="eyebrow">SERVICES</span><h3>الخدمات الفعلية</h3><p class="muted">يتم عرض الخدمات الموجودة في قاعدة البيانات فقط.</p></div></div><div class="grid3">'+serviceCards+'</div></section><section class="records"><div class="section-head"><div><span class="eyebrow">SERVICE AREAS</span><h3>مناطق تقديم الخدمة</h3></div></div><div class="request-list">'+(areaNames.length?areaNames.map(a=>'<div class="request-row"><span>'+esc(a)+'</span><b>محددة</b></div>').join(''):'<div class="empty-state">لا توجد مناطق خدمة مسجلة حاليًا.</div>')+'</div></section>'}


async function loadEnterpriseDomainData(m){if(!user||!m.tables?.length)return;const cache=live.moduleData[m.key]||{};if(cache.rowsReady||cache.loading)return;cache.loading=true;live.moduleData[m.key]=cache;const rows={};for(const table of m.tables){let q=sb.from(table).select('*').limit(100).order('created_at',{ascending:false});if(['chart_of_accounts','journal_entries','journal_entry_lines','erp_purchase_orders','erp_purchase_receipts','erp_stock_transfers','warehouses','stock_balances'].includes(table)&&live.tenantId)q=q.eq('tenant_id',live.tenantId);if(table==='mantigo_rides')q=q.eq('customer_id',user.id);if(table==='mantigo_bids')q=q.limit(100);if(table==='matrimony_profiles')q=q.or('is_verified.eq.true,owner_user_id.eq.'+user.id);if(table==='matrimony_requests')q=q.or('from_user_id.eq.'+user.id);const r=await q;rows[table]=r.error?[]:(r.data||[])}cache.rows=rows;cache.rowsReady=true;cache.loading=false;renderApp()}
async function loadRestaurantWorkspace(){
 if(!user?.id)return;const cache=live.moduleData.RESTAURANTS||{};if(cache.rowsReady||cache.loading)return;cache.loading=true;live.moduleData.RESTAURANTS=cache;
 const scope={tenant_id:live.tenantId,business_id:live.businessId,branch_id:live.branchId};
 const read=async(table)=>{let q=sb.from(table).select('*').limit(100);if(scope.tenant_id)q=q.eq('tenant_id',scope.tenant_id);if(scope.business_id)q=q.eq('business_id',scope.business_id);if(scope.branch_id)q=q.eq('branch_id',scope.branch_id);if(['restaurant_menu_items','restaurant_orders'].includes(table))q=q.order('created_at',{ascending:false});return q};
 const [menu,orders,tables,inventory]=await Promise.all(['restaurant_menu_items','restaurant_orders','restaurant_tables','restaurant_inventory'].map(read));
 cache.rows={restaurant_menu_items:menu.error?[]:(menu.data||[]),restaurant_orders:orders.error?[]:(orders.data||[]),restaurant_tables:tables.error?[]:(tables.data||[]),restaurant_inventory:inventory.error?[]:(inventory.data||[])};
 cache.errors={restaurant_menu_items:menu.error?.message||null,restaurant_orders:orders.error?.message||null,restaurant_tables:tables.error?.message||null,restaurant_inventory:inventory.error?.message||null};
 cache.rows.__errors=cache.errors;
 cache.rowsReady=true;cache.loading=false;renderApp()}
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
function restaurantWorkspace(rows){
 const menu=rows.restaurant_menu_items||[],orders=rows.restaurant_orders||[],tables=rows.restaurant_tables||[],inventory=rows.restaurant_inventory||[];
 const errors=rows.__errors||{};
 const available=menu.filter(x=>x.is_available).length,activeOrders=orders.filter(x=>!['DELIVERED','CANCELLED','COMPLETED'].includes(String(x.status||'').toUpperCase())).length,lowStock=inventory.filter(x=>Number(x.current_stock_qty)<=Number(x.min_stock_alert_threshold)).length,occupiedTables=tables.filter(x=>String(x.status||'').toUpperCase()!=='AVAILABLE').length;
 const fmt=v=>v==null?'—':Number(v).toLocaleString('ar-EG',{maximumFractionDigits:2});
 const sourceState=(key,label,count)=>errors[key]?'<div class="mx-source-status mx-source-status--error"><b>'+esc(label)+'</b><span>NOT AVAILABLE — '+esc(errors[key])+'</span></div>':'<div class="mx-source-status mx-source-status--ok"><b>'+esc(label)+'</b><span>'+esc(String(count))+' سجل مرئي وفق RLS</span></div>';
 window.openRestaurantRecord=(kind,id)=>{
  const map={menu:menu.find(x=>x.id===id),order:orders.find(x=>x.id===id),table:tables.find(x=>x.id===id),inventory:inventory.find(x=>x.id===id)},r=map[kind];if(!r)return;
  let sections=[];
  if(kind==='menu')sections=[{title:'بيانات الصنف',html:'<div class="mx-record-kv-grid"><div><span>الفئة</span><b>'+esc(r.category)+'</b></div><div><span>السعر</span><b>'+esc(fmt(r.base_price_egp))+' EGP</b></div><div><span>متاح</span><b>'+esc(r.is_available?'نعم':'لا')+'</b></div><div><span>الأكثر طلبًا</span><b>'+esc(r.is_popular?'نعم':'لا')+'</b></div></div>'},{title:'الوصف',html:'<div class="mx-record-prose">'+esc(r.description_ar||'—')+'</div>'}];
  if(kind==='order')sections=[{title:'بيانات الطلب',html:'<div class="mx-record-kv-grid"><div><span>العميل</span><b>'+esc(r.customer_name)+'</b></div><div><span>الهاتف</span><b>'+esc(r.customer_phone)+'</b></div><div><span>الحالة</span><b>'+esc(r.status)+'</b></div><div><span>نوع التنفيذ</span><b>'+esc(r.fulfillment_type)+'</b></div><div><span>الإجمالي</span><b>'+esc(fmt(r.total_egp))+' EGP</b></div><div><span>الطاولة</span><b>'+esc(r.table_number??'—')+'</b></div></div>'},{title:'ملاحظات العميل',html:'<div class="mx-record-prose">'+esc(r.notes_from_customer||'—')+'</div>'},{title:'العنوان',html:'<div class="mx-record-prose">'+esc(r.delivery_address||'—')+'</div>'}];
  if(kind==='table')sections=[{title:'بيانات الطاولة',html:'<div class="mx-record-kv-grid"><div><span>رقم الطاولة</span><b>'+esc(r.table_number)+'</b></div><div><span>السعة</span><b>'+esc(r.capacity_persons)+' أفراد</b></div><div><span>الحالة</span><b>'+esc(r.status)+'</b></div><div><span>الفاتورة الحالية</span><b>'+esc(fmt(r.current_bill_egp))+' EGP</b></div><div><span>الطلب النشط</span><b>'+esc(r.current_active_order_id||'—')+'</b></div><div><span>الحجز</span><b>'+esc(r.reserved_customer_name||'—')+'</b></div></div>'}];
  if(kind==='inventory')sections=[{title:'بيانات المخزون',html:'<div class="mx-record-kv-grid"><div><span>الوحدة</span><b>'+esc(r.unit)+'</b></div><div><span>الرصيد</span><b>'+esc(fmt(r.current_stock_qty))+'</b></div><div><span>حد التنبيه</span><b>'+esc(fmt(r.min_stock_alert_threshold))+'</b></div><div><span>التكلفة</span><b>'+esc(fmt(r.unit_cost_egp))+' EGP</b></div><div><span>المورد</span><b>'+esc(r.supplier_name)+'</b></div></div>'}];
  openUnifiedRecordDetails({kicker:'RESTAURANT',title:kind==='menu'?r.name_ar:kind==='order'?'طلب '+r.id:kind==='table'?'طاولة '+r.table_number:r.name_ar,desc:'السجل معروض من نطاق النشاط والفرع الحالي وفق RLS.',sections});
 };
 const action=(kind,r,label)=>'<button class="text-btn" type="button" data-restaurant-kind="'+esc(kind)+'" data-restaurant-id="'+esc(r.id)+'">'+esc(label)+'</button>';
 const menuTable=recordsTable('قائمة الطعام',menu,[['الصنف',r=>action('menu',r,r.name_ar)],['الفئة',r=>r.category],['السعر',r=>fmt(r.base_price_egp)+' EGP'],['متاح',r=>r.is_available?'نعم':'لا'],['شائع',r=>r.is_popular?'نعم':'لا']]);
 const orderTable=recordsTable('الطلبات',orders,[['الطلب',r=>action('order',r,r.id)],['العميل',r=>r.customer_name],['الحالة',r=>r.status],['الإجمالي',r=>fmt(r.total_egp)+' EGP'],['التنفيذ',r=>r.fulfillment_type],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleString('ar-EG'):'—']]);
 const tableTable=recordsTable('الطاولات',tables,[['الطاولة',r=>action('table',r,'#'+r.table_number)],['السعة',r=>r.capacity_persons],['الحالة',r=>r.status],['الفاتورة',r=>fmt(r.current_bill_egp)+' EGP'],['الحجز',r=>r.reserved_customer_name||'—']]);
 const inventoryTable=recordsTable('المخزون',inventory,[['الصنف',r=>action('inventory',r,r.name_ar)],['الرصيد',r=>fmt(r.current_stock_qty)+' '+r.unit],['حد التنبيه',r=>fmt(r.min_stock_alert_threshold)],['التكلفة',r=>fmt(r.unit_cost_egp)+' EGP'],['المورد',r=>r.supplier_name]]);
 setTimeout(()=>document.querySelectorAll('[data-restaurant-kind]').forEach(btn=>btn.addEventListener('click',()=>window.openRestaurantRecord(btn.dataset.restaurantKind,btn.dataset.restaurantId))),0);
 const failed=Object.keys(errors).filter(k=>errors[k]);
 return workspaceHead('RESTAURANT','المطاعم والمطابخ','Workspace موحد للقائمة والطلبات والطاولات والمخزون ضمن النشاط والفرع الحالي.','LIVE')
 +'<section class="mx-restaurant-source-grid" aria-label="حالة مصادر المطعم">'+sourceState('restaurant_menu_items','قائمة الطعام',menu.length)+sourceState('restaurant_orders','الطلبات',orders.length)+sourceState('restaurant_tables','الطاولات',tables.length)+sourceState('restaurant_inventory','المخزون',inventory.length)+'</section>'
 +(failed.length?'<div class="notice">بعض مصادر المطعم غير متاحة حاليًا. تم إبقاء الحالة <b>NOT AVAILABLE</b> بدل عرض قائمة فارغة على أنها سليمة.</div>':'')
 +workspaceCards([['أصناف متاحة',available+' / '+menu.length,'من قائمة الطعام الفعلية'],['طلبات نشطة',activeOrders,'تحتاج متابعة تشغيلية'],['طاولات مشغولة',occupiedTables+' / '+tables.length,'حالة الطاولات الحالية'],['تنبيهات المخزون',lowStock,'أصناف تحت حد التنبيه']])+menuTable+orderTable+tableTable+inventoryTable;
}

function enterpriseRowsTable(m,rows){if(m.key==='ACCOUNTING'&&current==='المزايدات — المحاسبة')return recordsTable('دليل الحسابات',rows.chart_of_accounts||[],[['الكود',r=>r.account_code],['الحساب',r=>r.account_name],['النوع',r=>r.account_type],['نشط',r=>r.is_active?'نعم':'لا']])+recordsTable('القيود',rows.journal_entries||[],[['المرجع',r=>r.reference_type],['الوصف',r=>r.description],['التاريخ',r=>r.entry_date],['الحالة',r=>r.status]]);if(m.key==='ERP')return '<div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="createPurchaseOrder()">+ أمر شراء</button><button class="btn btn-outline" style="width:auto" onclick="receivePurchaseStock()">+ استلام مشتريات</button><button class="btn btn-outline" style="width:auto" onclick="setPurchaseOrderLines()">+ بنود أمر الشراء</button><button class="btn btn-outline" style="width:auto" onclick="createStockTransfer()">+ تحويل مخزني</button></div>'+recordsTable('أوامر الشراء',rows.erp_purchase_orders||[],[['رقم الأمر',r=>r.order_number],['المورد',r=>r.supplier_id],['الإجمالي',r=>r.total_amount],['الحالة',r=>r.status],['إجراء',r=>r.status==='DRAFT'?'<button class="linkbtn" onclick="updatePurchaseOrderStatus(\''+r.id+'\',\'SUBMITTED\')">إرسال للاعتماد</button>':r.status==='PENDING_APPROVAL'?'<button class="linkbtn" onclick="updatePurchaseOrderStatus(\''+r.id+'\',\'APPROVED\')">اعتماد</button>':'—']])+recordsTable('الاستلامات',rows.erp_purchase_receipts||[],[['رقم الاستلام',r=>r.receipt_number],['الأمر',r=>r.purchase_order_id],['المخزن',r=>r.warehouse_id],['الكمية',r=>r.received_quantity],['الحالة',r=>r.status]])+recordsTable('التحويلات',rows.erp_stock_transfers||[],[['التحويل',r=>r.transfer_number],['من',r=>r.from_warehouse_id],['إلى',r=>r.to_warehouse_id],['الكمية',r=>r.quantity],['الحالة',r=>r.status],['إجراء',r=>r.status==='REQUESTED'?'<button class="linkbtn" onclick="updateStockTransferStatus(\''+r.id+'\',\'APPROVED\')">اعتماد</button>':r.status==='APPROVED'?'<button class="linkbtn" onclick="updateStockTransferStatus(\''+r.id+'\',\'IN_TRANSIT\')">إرسال</button>':r.status==='IN_TRANSIT'?'<button class="linkbtn" onclick="receiveStockTransfer(\''+r.id+'\')">استلام</button>':'—']]);if(m.key==='FACTORIES')return recordsTable('المخازن',rows.warehouses||[],[['المخزن',r=>r.name],['الكود',r=>r.code],['الحالة',r=>r.status]])+recordsTable('الأرصدة',rows.stock_balances||[],[['المنتج',r=>r.product_id],['المخزن',r=>r.warehouse_id],['الرصيد',r=>r.quantity_on_hand],['محجوز',r=>r.quantity_reserved]])+recordsTable('طلبات المصانع',rows.indrive_requests||[],[['العنوان',r=>r.title],['المجال',r=>r.category_name],['الميزانية',r=>r.user_proposed_price],['الحالة',r=>r.status]]);if(m.key==='TRIPS')return mantigoWorkspace(rows);if(m.key==='MEDICAL')return medicalWorkspace(rows);if(m.key==='MATRIMONY')return '<div class="notice">بيانات الاتصال المباشر وبيانات الولي محجوبة من قائمة الملفات العامة.</div>'+recordsTable('الملفات المتاحة',rows.matrimony_profiles||[],[['الاسم المستعار',r=>r.pseudonym],['العمر',r=>r.age],['المدينة',r=>r.city],['التعليم',r=>r.education],['المهنة',r=>r.occupation],['الحالة',r=>r.marital_status],['موثق',r=>r.is_verified?'نعم':'لا']])+recordsTable('طلبات التواصل الخاصة بي',rows.matrimony_requests||[],[['الملف',r=>r.to_profile_id],['الحالة',r=>r.status],['التاريخ',r=>r.created_at]]);return ''}
function domainModuleWorkspace(){
 const m=domainModules.find(x=>x.name===current);if(!m)return modulePage();
 const d=live.moduleData[m.key]||{tables:{},ready:false};
 if(m.key==='RESTAURANTS'){
  if(!d.rowsReady){loadRestaurantWorkspace();return workspaceHead(m.key,m.name,m.desc,'LOADING')+'<div class="empty-state">جاري تحميل بيانات المطعم الفعلية وفق نطاق النشاط والفرع والصلاحيات…</div>'}
  return restaurantWorkspace(d.rows)+'<div class="action-bar"><button class="btn btn-outline" style="width:auto" data-module="الموديولات" onclick="selectModule(this.dataset.module)">← العودة للموديولات</button></div>';
}
if(['ACCOUNTING','ERP','FACTORIES','TRIPS','MATRIMONY'].includes(m.key)){
  if(!d.rowsReady){loadEnterpriseDomainData(m);return workspaceHead(m.key,m.name,m.desc,'LOADING')+'<div class="empty-state">جاري تحميل البيانات التشغيلية الفعلية وفق صلاحياتك…</div>'}
  return workspaceHead(m.key,m.name,m.desc,'MODULE')
   +workspaceCards(m.tables.map(t=>[t,String((d.rows?.[t]||[]).length),'سجلات مرئية وفق RLS']))
   +enterpriseRowsTable(m,d.rows||{})
   +'<div class="action-bar"><button class="btn btn-outline" style="width:auto" onclick="selectModule(\'الموديولات\')">← العودة للموديولات</button></div>'
   +((window.MNTYModuleBlueprint&&window.MNTYModuleBlueprint(m.name,m))||'');
 }
 const cards=m.tables.map(t=>[t,d.tables?.[t]==null?'—':String(d.tables[t]),'عدد السجلات المتاحة وفق RLS']);
 if(!m.tables.length)cards.push(['حالة المخطط','NOT VERIFIED','لا يوجد جدول متخصص مثبت في المخطط الحالي']);
 return workspaceHead(m.key,m.name,m.desc,'MODULE')
  +workspaceCards(cards)
  +'<div class="action-bar"><button class="btn btn-outline" style="width:auto" onclick="selectModule(\'الموديولات\')">← العودة للموديولات</button></div>'
  +recordsTable('مصادر البيانات الموصولة',m.tables.map(t=>({table:t,count:d.tables?.[t]})),[['الجدول',r=>r.table],['السجلات',r=>r.count==null?'—':r.count],['الحالة',r=>r.count==null?'NOT VERIFIED':'READABLE']])
  +((window.MNTYModuleBlueprint&&window.MNTYModuleBlueprint(m.name,m))||'');
}

async function superAdminFunction(name,body){
 if(!canSuperAdmin())throw new Error('SUPER_ADMIN_REQUIRED');
 return invokeMntyFunction(name,body);
}
async function loadOfficialShowcaseAdmin(){
 const root=document.getElementById('sa-showcase-list'); if(!root)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 try{
  const bq=await sb.from('businesses').select('id,name,code,status,settings,updated_at').eq('status','ACTIVE').eq('settings->>showcase','true').order('name',{ascending:true}).limit(100);
  if(bq.error)throw bq.error;
  const rows=bq.data||[];
  if(!rows.length){root.innerHTML='<div class="empty-state">لا توجد أنشطة رسمية مسجلة.</div>';return}
  const ids=rows.map(x=>x.id);
  const [pq,mq,svq]=await Promise.all([
   sb.from('marketing_provider_profiles').select('business_id,name_ar,status,is_verified,is_featured,slug').in('business_id',ids),
   sb.from('business_modules').select('business_id,module_id,enabled').in('business_id',ids),
   sb.from('marketing_provider_services').select('provider_id,status').limit(500)
  ]);
  if(pq.error)throw pq.error; if(mq.error)throw mq.error;
  const pm=new Map((pq.data||[]).map(x=>[String(x.business_id),x]));
  const counts=new Map(); (mq.data||[]).forEach(x=>{const k=String(x.business_id);const v=counts.get(k)||0;if(x.enabled)counts.set(k,v+1)});
  const activeServices=new Map(); (svq.data||[]).forEach(x=>{if(x.status==='ACTIVE')activeServices.set(String(x.provider_id),(activeServices.get(String(x.provider_id))||0)+1)});
  root.innerHTML='<div class="mnty-stat-strip"><div><b>'+rows.length+'</b><span>نشاط رسمي</span></div><div><b>'+rows.filter(x=>x.status==='ACTIVE').length+'</b><span>نشط</span></div><div><b>'+rows.reduce((n,x)=>n+(counts.get(String(x.id))||0),0)+'</b><span>تفعيل موديولات</span></div><div><b>'+rows.filter(x=>pm.get(String(x.id))?.is_verified).length+'</b><span>ملف موثق</span></div></div><div class="mnty-showcase-admin-grid">'+rows.map(b=>{const p=pm.get(String(b.id));const icon=esc(b.settings?.icon||'📍');return '<article class="mnty-showcase-admin-card"><div class="row"><strong>'+icon+' '+esc(b.name)+'</strong><span class="mnty-verified">'+(p?.is_verified?'✓ موثق':'غير موثق')+'</span></div><small>'+esc(b.code)+' · '+esc(p?.slug||'—')+'</small><div class="mnty-admin-mini"><span>المالك: OWNER</span><span>الموديولات: '+(counts.get(String(b.id))||0)+'</span><span>الخدمات: '+(p?activeServices.get(String(p.id))||0:0)+'</span></div><div class="mnty-admin-source">إدارة Super Admin · '+esc(b.settings?.source||'OFFICIAL_PLATFORM_SHOWCASE')+'</div></article>'}) .join('')+'</div>';
 }catch(error){console.warn('[MNTY admin showcase] unavailable',error);root.innerHTML='<div class="empty-state">تعذر تحميل بيانات الأنشطة الرسمية: '+esc(error?.message||'خطأ غير معروف')+'</div>'}
}

function superAdminControlWorkspace(){
 if(!canSuperAdmin())return workspaceHead('PLATFORM CONTROL','التحكم الكامل','هذه المساحة مخصصة لـ SUPER_ADMIN فقط.','RESTRICTED')+'<div class="empty-state">لا تملك صلاحية التحكم الكامل.</div>';
 const tenants=[...new Map((live.memberships||[]).filter(m=>String(m.role||'').toUpperCase()==='SUPER_ADMIN'&&m.status==='ACTIVE').map(m=>[m.tenant_id,m])).values()];
 const tenantOptions=tenants.map(m=>'<option value="'+esc(m.tenant_id)+'" '+(m.tenant_id===live.tenantId?'selected':'')+'>'+esc(m.tenant_id)+'</option>').join('');
 return MNTY_ADMIN_SHOWCASE_STYLE+workspaceHead('SUPER ADMIN','التحكم الكامل','مسار تشغيلي موحد لإنشاء النشاط ثم اعتماده وإنشاء الفرع والخدمات والأسعار، مع بقاء كل الكتابات الحساسة عبر الخادم.','PLATFORM')
 +workspaceCards([['النطاقات النشطة',String(tenants.length),'Tenant contexts المرتبطة بدور SUPER_ADMIN'],['صلاحية الحساب','Full Control','نطاق المنصة فقط'],['الاعتماد','Server-side','الاعتماد يمر عبر مسار الخادم'],['مقدمو الخدمة','هوية حقيقية','لا يتم إنشاء هوية وهمية من الواجهة']])
 +'<section class="card"><div class="section-head"><div><span class="eyebrow">CREATE ACTIVITY</span><h3>إنشاء نشاط كامل</h3><p class="muted">سيتم إنشاء طلب نشاط، ثم اعتماده، ثم إنشاء الفرع والخدمات والأسعار عند نجاح كل خطوة.</p></div></div>'
 +'<form id="mx-super-admin-create-form"><div class="grid2">'
 +'<label class="field"><span>Tenant *</span><select id="sa-tenant" required>'+tenantOptions+'</select></label>'
 +'<label class="field"><span>نوع النشاط *</span><select id="sa-kind" required><option value="">اختر النوع</option>'+providerKinds.map(x=>'<option value="'+esc(x[0])+'">'+esc(x[1])+'</option>').join('')+'</select></label>'
 +'<label class="field"><span>اسم النشاط *</span><input id="sa-name" maxlength="200" required placeholder="مثال: صيدلية أو مطعم أو مكتب محاسبة"></label>'
 +'<label class="field"><span>اسم الفرع الرئيسي *</span><input id="sa-branch" maxlength="200" required value="الفرع الرئيسي"></label>'
 +'<label class="field"><span>الهاتف</span><input id="sa-phone" maxlength="64"></label>'
 +'<label class="field"><span>المحافظة / المدينة</span><input id="sa-city" maxlength="120"></label>'
 +'<label class="field"><span>الحي / المنطقة</span><input id="sa-district" maxlength="120"></label>'
 +'<label class="field"><span>العنوان</span><input id="sa-address" maxlength="500"></label>'
 +'<label class="field"><span>الخدمات *</span><input id="sa-services" maxlength="2000" placeholder="خدمة 1، خدمة 2، خدمة 3" required></label>'
 +'<label class="field"><span>السعر الافتراضي لكل خدمة</span><input id="sa-price" type="number" min="0" step="0.01" value="0"></label>'
 +'</div><div class="action-bar"><button class="btn btn-primary" id="sa-submit" type="submit" style="width:auto">إنشاء النشاط وتشغيل المسار</button></div><p id="sa-progress" class="muted" aria-live="polite"></p></form></section>'
 +'<section class="card" style="margin-top:18px"><div class="section-head"><div><span class="eyebrow">OFFICIAL SHOWCASE</span><h3>أنشطة منطقتي — إدارة السوبر أدمن</h3><p class="muted">السجلات الرسمية الفعلية التي أنشأها النظام، مع المالك والموديولات والخدمات وحالة الظهور.</p></div><button class="btn btn-outline" type="button" id="sa-showcase-refresh">تحديث</button></div><div id="sa-showcase-list"><div class="empty-state">جاري تحميل الأنشطة الرسمية…</div></div></section>'
 +'<section class="card" style="margin-top:18px"><div class="section-head"><div><span class="eyebrow">PROVIDER APPROVAL</span><h3>اعتماد مقدمي الخدمة</h3><p class="muted">يعتمد فقط طلبًا حقيقيًا مقدمًا من حساب موثق؛ لا يتم إنشاء مستخدم أو هوية بديلة.</p></div></div><div id="sa-provider-review-list"><div class="empty-state">جاري تحميل الطلبات…</div></div></section>';
}

const MNTY_ADMIN_SHOWCASE_STYLE = '<style id="mnty-admin-showcase-style">.mnty-showcase-admin-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:14px}.mnty-showcase-admin-card{border:1px solid rgba(24,100,171,.12);border-radius:16px;padding:14px;background:#fff}.mnty-showcase-admin-card small{display:block;color:#64748b;margin-top:5px}.mnty-admin-mini{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.mnty-admin-mini span{font-size:11px;background:#f1f5f9;border-radius:999px;padding:5px 8px}.mnty-admin-source{margin-top:10px;font-size:11px;color:#0b7285;font-weight:700}@media(max-width:900px){.mnty-showcase-admin-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.mnty-showcase-admin-grid{grid-template-columns:1fr}}</style>';
function systemHealthSecurityCenter(){
 if(!canSuperAdmin())return workspaceHead('SYSTEM HEALTH','الصحة والأمان','هذه المساحة مخصصة لـ SUPER_ADMIN فقط.','RESTRICTED')+'<div class="empty-state">لا تملك صلاحية الوصول.</div>';
 const verified=[
  ['Supabase Database','VERIFIED','الاتصال بقاعدة الإنتاج ومصدر البيانات الحالي'],
  ['RLS Coverage','VERIFIED','الفحص الحالي أظهر RLS على الجداول العامة المستخدمة'],
  ['Anonymous Users','VERIFIED','0 حسابات anonymous في آخر فحص'],
  ['Security Advisor','OPEN','توجد findings أمنية موثقة ولم يتم إخفاؤها'],
  ['Edge Functions','PARTIAL','المسارات موجودة لكن E2E الإنتاجي ليس مكتملًا'],
  ['Public Pages Runtime','NOT VERIFIED','لم يتم إثبات المتصفح الإنتاجي بشكل مستقل'],
  ['Payment E2E','WAITING','لا توجد معاملة مالية حقيقية أثناء الاختبار'],
  ['Tenant Isolation E2E','NOT VERIFIED','يتطلب جلسات متعددة حقيقية'],
  ['Release / Device','WAITING','اختبار الإصدار والجهاز لم يُغلق بعد']
 ];
 const securityFindings=[
  ['RLS Enabled No Policy','INFO','digital_page_payment_events','متعمد/Backend-only بحسب المراجعة الحالية'],
  ['Anonymous SECURITY DEFINER','WARN','get_mnty_targeted_advertisements','مسار إعلان عام مقصود ويحتاج مراجعة مستمرة'],
  ['Authenticated SECURITY DEFINER','WARN','40 functions','مراجعة فردية مطلوبة؛ لا يتم تعطيلها جماعيًا']
 ];
 return workspaceHead('SYSTEM HEALTH','مركز صحة النظام والأمان','لوحة رقابية للبوابات المثبتة فعليًا. لا تعرض هذه الشاشة حالة PASS لمجرد وجود كود أو إعداد.','SECURITY')
 +workspaceCards([['Production Database','VERIFIED','مصدر Supabase الحالي'],['RLS','VERIFIED','التغطية الحالية مثبتة'],['Anonymous Users','0','آخر فحص إنتاجي'],['Security Findings','42','1 INFO + 1 anonymous WARN + 40 authenticated WARN'],['Production Runtime','NOT VERIFIED','متصفح الإنتاج يحتاج إثباتًا'],['E2E Release','WAITING','اختبارات الإصدار النهائية']])
 +'<section class="card" style="margin:16px 0;padding:18px"><div class="section-head"><div><span class="eyebrow">RELEASE GATES</span><h2>بوابات النظام</h2><p>الحالة هنا محافظة: ما لم يوجد دليل إنتاجي مباشر يبقى NOT VERIFIED أو WAITING.</p></div></div>'+recordsTable('حالة البوابات',verified,[['البوابة',r=>r[0]],['الحالة',r=>'<span class="status">'+esc(r[1])+'</span>'],['الدليل / الملاحظة',r=>r[2]]])+'</section>'
 +'<section class="card" style="padding:18px"><div class="section-head"><div><span class="eyebrow">SECURITY ADVISOR</span><h2>الملاحظات الأمنية الحالية</h2><p>لا يتم إخفاء التحذيرات أو اعتبارها مغلقة دون معالجة موثقة.</p></div></div>'+recordsTable('Security Findings',securityFindings,[['الفئة',r=>r[0]],['المستوى',r=>r[1]],['المورد',r=>r[2]],['الملاحظة',r=>r[3]]])+'</section>'
 +'<section class="card" style="margin-top:16px;padding:18px"><span class="eyebrow">OBSERVABILITY</span><h2>المراقبة</h2><p>السجلات متاحة في Supabase، لكن هذه اللوحة لا تحوّل وجود logs إلى صحة تلقائية. يجب إثبات معدلات الأخطاء والزمن والاستقرار من بيانات الرصد الفعلية قبل إعلان PASS.</p></section>';
}
function enhancedPageContent(){
 if(current==='التحكم الكامل')return superAdminControlWorkspace();
 if(current==='مركز الصحة والأمان')return systemHealthSecurityCenter();
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

async function initSuperAdminControlWorkspace(){
 const form=document.getElementById('mx-super-admin-create-form');
 if(form){
  form.onsubmit=async event=>{
   event.preventDefault();
   const btn=document.getElementById('sa-submit'),progress=document.getElementById('sa-progress');
   if(btn?.disabled)return;
   const tenantId=document.getElementById('sa-tenant')?.value?.trim(),kind=document.getElementById('sa-kind')?.value?.trim(),name=document.getElementById('sa-name')?.value?.trim(),branchName=document.getElementById('sa-branch')?.value?.trim();
   const phone=document.getElementById('sa-phone')?.value?.trim()||'',city=document.getElementById('sa-city')?.value?.trim()||'',district=document.getElementById('sa-district')?.value?.trim()||'',address=document.getElementById('sa-address')?.value?.trim()||'';
   const services=String(document.getElementById('sa-services')?.value||'').split(/[،,\n]/).map(x=>x.trim()).filter(Boolean).slice(0,20);
   const price=Number(document.getElementById('sa-price')?.value||0);
   if(!tenantId||!kind||!name||!branchName||!services.length||!Number.isFinite(price)||price<0)return showToast('أكمل بيانات النشاط والخدمات والسعر بشكل صحيح.','error');
   btn.disabled=true;progress.textContent='1/5 إنشاء النشاط...';
   try{
    const created=await superAdminFunction('business-register',{tenantId,name,sector:kind,address,phone,city,district});
    const businessId=created?.business?.id,approvalRequestId=created?.approvalRequestId;
    if(!businessId||!approvalRequestId)throw new Error('BUSINESS_CREATE_RESPONSE_INVALID');
    progress.textContent='2/5 اعتماد النشاط...';
    const approved=await superAdminFunction('business-approval',{approvalRequestId,action:'APPROVE'});
    if(approved?.success===false)throw new Error(approved?.error||'BUSINESS_APPROVAL_FAILED');
    progress.textContent='3/5 إنشاء الفرع الرئيسي...';
    const branch=await superAdminFunction('business-branch-admin',{tenantId,businessId,name:branchName,phone,address});
    const branchId=branch?.branch?.id;
    if(!branchId)throw new Error('BRANCH_CREATE_RESPONSE_INVALID');
    progress.textContent='4/5 حفظ إعدادات الكتالوج...';
    await superAdminFunction('catalog-admin',{action:'SETTINGS_UPSERT',tenantId,businessId,currency:'EGP',deliveryFee:0,taxInclusive:false,allowDiscounts:true});
    progress.textContent='5/5 إنشاء الخدمات والأسعار...';
    for(const service of services){
      const item=await superAdminFunction('catalog-admin',{action:'ITEM_UPSERT',tenantId,businessId,branchId,itemType:'SERVICE',nameAr:service,nameEn:null,description:'خدمة تم إنشاؤها من التحكم الكامل',sku:null,taxRate:0,metadata:{provider_kind:kind,source:'SUPER_ADMIN_WORKSPACE'}});
      const itemId=item?.id;
      if(!itemId)throw new Error('CATALOG_ITEM_CREATE_RESPONSE_INVALID');
      await superAdminFunction('catalog-admin',{action:'PRICE_UPSERT',tenantId,businessId,catalogItemId:itemId,branchId,currency:'EGP',unitPrice:price});
    }
    progress.textContent='تم إنشاء النشاط والفرع والخدمات والأسعار بنجاح.';
    showToast('تم إنشاء النشاط وتشغيل المسار الكامل بنجاح.','success');
    await renderApp({forceWorkspace:true});
   }catch(e){
    progress.textContent='توقف المسار: '+(e?.message||'UNKNOWN_ERROR');
    showToast('تعذر إكمال المسار: '+(e?.message||'خطأ غير معروف'),'error');
    btn.disabled=false;
   }
  };
 }
 loadProviderOnboardingReview();
 loadOfficialShowcaseAdmin();
 document.getElementById('sa-showcase-refresh')?.addEventListener('click',loadOfficialShowcaseAdmin);
}
let recordsTableSeq=0;
const RECORDS_PAGE_SIZE=12;
const recordsTableState=new Map();
function recordsTableStateFor(id){if(!recordsTableState.has(id))recordsTableState.set(id,{page:1,query:'',sort:-1,dir:1});return recordsTableState.get(id)}
function applyRecordsTable(tableId){
 const table=document.getElementById(tableId), st=recordsTableStateFor(tableId);if(!table)return;
 const rows=[...table.querySelectorAll('tbody tr')];
 const q=String(st.query||'').trim().toLocaleLowerCase('ar');
 const matches=rows.filter(row=>!q||row.textContent.toLocaleLowerCase('ar').includes(q));
 if(st.sort>=0){matches.sort((x,y)=>{const av=x.children[st.sort]?.textContent?.trim()||'',bv=y.children[st.sort]?.textContent?.trim()||'';const an=Number(av.replace(/[^0-9.-]+/g,'')),bn=Number(bv.replace(/[^0-9.-]+/g,''));const cmp=Number.isFinite(an)&&Number.isFinite(bn)&&av!==''&&bv!==''?an-bn:av.localeCompare(bv,'ar',{numeric:true,sensitivity:'base'});return cmp*st.dir})}
 rows.forEach(r=>{r.hidden=true});
 const pages=Math.max(1,Math.ceil(matches.length/RECORDS_PAGE_SIZE));st.page=Math.min(Math.max(1,st.page),pages);
 matches.slice((st.page-1)*RECORDS_PAGE_SIZE,st.page*RECORDS_PAGE_SIZE).forEach(r=>r.hidden=false);
 const meta=document.getElementById(tableId+'-meta'),prev=document.getElementById(tableId+'-prev'),next=document.getElementById(tableId+'-next');
 if(meta)meta.textContent=(matches.length?(((st.page-1)*RECORDS_PAGE_SIZE)+1)+'–'+Math.min(st.page*RECORDS_PAGE_SIZE,matches.length):'0')+' من '+matches.length;
 if(prev)prev.disabled=st.page<=1;if(next)next.disabled=st.page>=pages;
 table.querySelectorAll('th[data-sort-col]').forEach(th=>{const i=Number(th.dataset.sortCol);th.setAttribute('aria-sort',st.sort===i?(st.dir===1?'ascending':'descending'):'none')});
}
function filterRecordsTable(inputId,tableId){const input=document.getElementById(inputId);const st=recordsTableStateFor(tableId);st.query=String(input?.value||'');st.page=1;applyRecordsTable(tableId)}
function sortRecordsTable(tableId,index){const st=recordsTableStateFor(tableId);if(st.sort===index)st.dir*=-1;else{st.sort=index;st.dir=1}st.page=1;applyRecordsTable(tableId)}
function paginateRecordsTable(tableId,delta){const st=recordsTableStateFor(tableId);st.page=Math.max(1,st.page+delta);applyRecordsTable(tableId)}
function renderRecordCell(value){const s=String(value??'—');return /<(button|a|div|span|select|input)\\b/i.test(s)?s:esc(s)}
function recordsTable(title,rows,columns){
 const data=Array.isArray(rows)?rows:[],cols=Array.isArray(columns)?columns:[];
 if(!data.length)return '<section class="records"><div class="section-head"><div><h3>'+esc(title)+'</h3><p class="muted">لا توجد بيانات فعلية متاحة حاليًا وفق الصلاحيات.</p></div></div><div class="empty-state">لا توجد سجلات للعرض</div></section>';
 const seq=++recordsTableSeq,id='mx-records-'+seq,search='mx-search-'+seq;
 recordsTableState.set(id,{page:1,query:'',sort:-1,dir:1});
 const heads=cols.map((c,i)=>'<th scope="col" data-sort-col="'+i+'" aria-sort="none" tabindex="0" onclick="sortRecordsTable(\''+id+'\','+i+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();sortRecordsTable(\''+id+'\','+i+')}" title="فرز">'+esc(c[0])+' ↕</th>').join('');
 const body=data.map(r=>'<tr>'+cols.map(c=>'<td>'+renderRecordCell(c[1](r))+'</td>').join('')+'</tr>').join('');
 return '<section class="records" aria-labelledby="'+id+'-title"><div class="section-head"><div><span class="eyebrow">RECORDS</span><h3 id="'+id+'-title">'+esc(title)+'</h3><p class="muted">سجلات فعلية ضمن الصلاحيات الحالية · عرض '+RECORDS_PAGE_SIZE+' لكل صفحة</p></div><label class="search-field"><span>بحث داخل السجلات</span><input id="'+search+'" type="search" aria-controls="'+id+'" placeholder="ابحث داخل السجلات…" oninput="filterRecordsTable(\''+search+'\',\''+id+'\')"></label></div><div class="table-wrap" tabindex="0" role="region" aria-label="جدول '+esc(title)+'"><table id="'+id+'"><thead><tr>'+heads+'</tr></thead><tbody>'+body+'</tbody></table></div><div class="mx-table-pager" aria-label="تنقل الجدول"><button type="button" class="btn btn-outline" id="'+id+'-prev" onclick="paginateRecordsTable(\''+id+'\',-1)">السابق</button><span id="'+id+'-meta">—</span><button type="button" class="btn btn-outline" id="'+id+'-next" onclick="paginateRecordsTable(\''+id+'\',1)">التالي</button></div></section>';
}
function workspaceHead(kicker,title,desc,badge){return '<div class="section-head"><div><span class="eyebrow">'+kicker+'</span><h2>'+title+'</h2><p>'+desc+'</p></div>'+(badge?'<span class="count">'+badge+'</span>':'')+'</div>'}
function workspaceCards(items){return '<div class="grid3">'+items.map(x=>{const pending=String(x[1])==='—';return '<article class="card mnty-kpi-card"><div class="row"><strong>'+x[0]+'</strong><span class="dot"></span></div><div class="kpi" style="font-size:24px">'+esc(x[1])+'</div><p class="muted">'+esc(x[2])+'</p><div class="mnty-card-state '+(pending?'mnty-card-state--pending':'')+'"><span class="mnty-status-dot"></span><span>'+(pending?'بانتظار مصدر بيانات فعلي':'بيانات فعلية ضمن مساحة العمل الحالية')+'</span></div></article>'}).join('')+'</div>'}
async function mntRpc(fn,args){if(!user?.id)return authView();const {data,error}=await sb.rpc(fn,args);if(error)return showToast('تعذر تنفيذ العملية: '+error.message,'error');showToast('تم تنفيذ العملية بنجاح','success');live.moduleData={};await loadDomainModule(current);renderApp();return data}
async function createMntRide(){const pickup=window.prompt('نقطة الانطلاق');const destination=window.prompt('الوجهة');const price=Number(window.prompt('السعر المقترح','0'));if(!pickup?.trim()||!destination?.trim()||!Number.isFinite(price)||price<=0)return showToast('بيانات الرحلة غير صحيحة','error');return mntRpc('create_mantigo_ride_backend',{p_user_id:user.id,p_customer_name:user.email||'Customer',p_customer_phone:'',p_vehicle_category:window.prompt('فئة المركبة','STANDARD')||'STANDARD',p_ride_type:window.prompt('نوع الرحلة','ONE_WAY')||'ONE_WAY',p_pickup_location:pickup.trim(),p_destination_location:destination.trim(),p_proposed_price:price,p_note:window.prompt('ملاحظة','')||null})}
async function createMntBid(rideId){const price=Number(window.prompt('قيمة العرض','0'));if(!rideId||!Number.isFinite(price)||price<=0)return showToast('قيمة العرض غير صحيحة','error');return mntRpc('create_mantigo_bid_backend',{p_user_id:user.id,p_ride_id:rideId,p_captain_name:user.email||'Captain',p_captain_phone:'',p_captain_rating:null,p_vehicle_category:window.prompt('فئة المركبة','STANDARD')||'STANDARD',p_vehicle_model:window.prompt('موديل المركبة','')||null,p_vehicle_plate:window.prompt('رقم اللوحة','')||null,p_offered_price:price,p_eta_minutes:Number(window.prompt('ETA بالدقائق','15'))||15,p_captain_message:window.prompt('رسالة','')||null})}
async function acceptMntBid(rideId,bidId){if(!rideId||!bidId)return;return mntRpc('accept_mantigo_bid_backend',{p_user_id:user.id,p_ride_id:rideId,p_bid_id:bidId})}
async function erpRpc(fn,args){if(!user?.id)return authView();if(!live.tenantId||!live.businessId)return showToast('يجب اختيار مؤسسة فعالة قبل تنفيذ العملية','error');const {data,error}=await sb.rpc(fn,args);if(error){showToast('تعذر تنفيذ العملية: '+error.message,'error');return null}showToast('تم تنفيذ العملية بنجاح','success');live.moduleData={};await loadDomainModule(current);renderApp();return data}
async function createPurchaseOrder(){
 const orderNumber=window.prompt('رقم أمر الشراء');if(!orderNumber?.trim())return;
 const supplierId=window.prompt('معرف المورد');if(!supplierId?.trim())return;
 const lines=[];const seen=new Set();
 for(let n=1;n<=100;n++){
  const productId=window.prompt(n===1?'معرف المنتج الأول (UUID)':'معرف المنتج التالي (اتركه فارغًا لإنهاء البنود)');if(!productId?.trim()){if(n===1)return;break}
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId.trim()))return showToast('معرف المنتج غير صحيح','error');
  if(seen.has(productId.trim()))return showToast('لا تكرر المنتج نفسه في بنود الأمر','error');seen.add(productId.trim());
  const quantity=Number(window.prompt('الكمية المطلوبة للمنتج '+productId.trim(),'1'));
  const unit_cost=Number(window.prompt('تكلفة الوحدة للمنتج '+productId.trim(),'0'));
  if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unit_cost)||unit_cost<=0)return showToast('الكمية وتكلفة الوحدة يجب أن تكونا صحيحتين وأكبر من صفر','error');
  lines.push({product_id:productId.trim(),quantity,unit_cost});
 }
 if(!lines.length)return showToast('أضف بند شراء واحدًا على الأقل','error');
 const tax=Number(window.prompt('الضريبة','0'));const discount=Number(window.prompt('الخصم','0'));
 if([tax,discount].some(v=>!Number.isFinite(v)||v<0))return showToast('قيمة ضريبة/خصم غير صحيحة','error');
 const reason=window.prompt('سبب أمر الشراء','')||null;
 const fingerprint=JSON.stringify([live.tenantId,live.businessId,live.branchId||null,orderNumber.trim(),supplierId.trim(),tax,discount,reason,lines]);
 let attempt=null;try{attempt=JSON.parse(sessionStorage.getItem('mantiqatix_po_attempt')||'null')}catch{}
 if(!attempt||attempt.fingerprint!==fingerprint){attempt={fingerprint,id:'po-'+crypto.randomUUID()};try{sessionStorage.setItem('mantiqatix_po_attempt',JSON.stringify(attempt))}catch{}}
 const result=await erpRpc('create_purchase_order_with_lines_backend',{p_id:attempt.id,p_tenant_id:live.tenantId,p_business_id:live.businessId,p_branch_id:live.branchId||null,p_order_number:orderNumber.trim(),p_supplier_id:supplierId.trim(),p_tax_amount:tax,p_discount_amount:discount,p_reason:reason,p_lines:lines});
 if(result?.success){try{sessionStorage.removeItem('mantiqatix_po_attempt')}catch{}}
 return result;
}
async function updatePurchaseOrderStatus(id,status){if(!id)return;return erpRpc('update_purchase_order_status_backend',{p_order_id:id,p_target_status:status})}
async function setPurchaseOrderLines(){if(!user?.id)return authView();if(!live.tenantId||!live.businessId)return showToast('يجب اختيار مؤسسة فعالة','error');const orderId=window.prompt('معرف أمر الشراء (يجب أن يكون في حالة مسودة)');if(!orderId?.trim())return;const count=Number(window.prompt('عدد البنود (1-50)','1'));if(!Number.isInteger(count)||count<1||count>50)return showToast('عدد البنود غير صحيح','error');const lines=[];for(let i=0;i<count;i++){const productId=window.prompt('معرف المنتج UUID للبند '+(i+1));if(!productId?.trim())return;const orderedQuantity=Number(window.prompt('الكمية المطلوبة للبند '+(i+1),'1'));const unitCost=Number(window.prompt('تكلفة الوحدة للبند '+(i+1),'0'));const description=window.prompt('وصف البند '+(i+1),'')||'';if(!Number.isFinite(orderedQuantity)||orderedQuantity<=0||!Number.isFinite(unitCost)||unitCost<0)return showToast('بيانات البند غير صحيحة','error');lines.push({product_id:productId.trim(),ordered_quantity:orderedQuantity,unit_cost:unitCost,description});}const {data,error}=await sb.functions.invoke('erp-purchase-order-lines',{body:{order_id:orderId.trim(),tenant_id:live.tenantId,business_id:live.businessId,lines}});if(error||data?.success===false){showToast('تعذر حفظ بنود أمر الشراء: '+(data?.error||error?.message||'خطأ غير معروف'),'error');return null;}showToast('تم حفظ '+(data?.line_count||lines.length)+' بندًا لأمر الشراء','success');live.moduleData={};await loadDomainModule(current);renderApp();return data}
async function receivePurchaseStock(){if(!user?.id)return authView();if(!live.tenantId||!live.businessId)return showToast('يجب اختيار مؤسسة فعالة','error');const purchaseOrderId=window.prompt('معرف أمر الشراء');if(!purchaseOrderId?.trim())return;const receiptNumber=window.prompt('رقم الاستلام');if(!receiptNumber?.trim())return;const warehouseId=window.prompt('معرف المخزن');if(!warehouseId?.trim())return;const productId=window.prompt('معرف المنتج UUID');if(!productId?.trim())return;const qty=Number(window.prompt('الكمية المستلمة','1'));const unitCost=Number(window.prompt('تكلفة الوحدة (يجب أن تطابق أمر الشراء)','0'));if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(unitCost)||unitCost<0)return showToast('بيانات الاستلام غير صحيحة','error');const {data,error}=await sb.functions.invoke('erp-purchase-receive',{body:{id:'rcv-'+crypto.randomUUID(),tenant_id:live.tenantId,business_id:live.businessId,purchase_order_id:purchaseOrderId.trim(),receipt_number:receiptNumber.trim(),warehouse_id:warehouseId.trim(),product_id:productId.trim(),received_quantity:qty,unit_cost:unitCost}});if(error||data?.success===false){showToast('تعذر الاستلام: '+(data?.error||error?.message||'خطأ غير معروف'),'error');return null;}showToast(data?.idempotent?'تم التحقق من الاستلام السابق دون تكرار':'تم الاستلام وتحديث المخزون','success');live.moduleData={};await loadDomainModule(current);renderApp();return data}
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
    const {data,error}=await sb.functions.invoke('marketing-lead-create',{body:{
      title,
      description,
      required_services:['AD_BOOKING',key],
      service_area:'',
      budget_min:0,
      budget_max:0,
      business_id:live.businessId||null
    }});
    if(error)throw error;
    if(data?.error)throw new Error(data.error);
    try{localStorage.removeItem('MNTYOpenAdBooking');localStorage.removeItem('MNTYAdBookingDuration')}catch(_){}
    showToast('تم إنشاء طلب حجز الإعلان بنجاح. سيظهر في مركز التسويق للمراجعة.','success');
    current='التسويق والإعلان';
    await renderApp();
    return data?.lead||data;
  }catch(e){
    showToast('تعذر إنشاء طلب حجز الإعلان: '+(e?.message||'خطأ غير معروف'),'error');
    return null;
  }
}
async function createMarketingLead(){
  if(!user?.id)return authView();
  if(window.MNTY_RBAC?.can(String(live.role||''),'CRM','create',live.permissions)!==true)return showToast('لا تملك صلاحية إنشاء طلب تسويق في هذا النطاق.','error');
  const title=window.prompt('عنوان احتياج التسويق');
  if(!title?.trim())return;
  const description=window.prompt('وصف الاحتياج والخدمة المطلوبة');
  if(!description?.trim())return;
  const {data,error}=await sb.functions.invoke('marketing-lead-create',{body:{
    title:title.trim(),
    description:description.trim(),
    required_services:[],
    service_area:'',
    budget_min:0,
    budget_max:0,
    business_id:live.businessId||null
  }});
  if(error||data?.error)return showToast('تعذر إنشاء طلب التسويق: '+(error?.message||data?.error||'خطأ غير معروف'),'error');
  live.counts.leads=(live.counts.leads||0)+1;
  showToast('تم إنشاء طلب التسويق'+(data?.lead?.id?' #'+data.lead.id:''),'success');
  renderApp();
}
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
function openMarketingRecordDetails(kind,id){
 const maps={lead:live.records.leads||[],project:live.records.projects||[],ad:live.records.ads||[],provider:live.records.providers||[],service:live.records.services||[]};
 const row=maps[kind]?.find(x=>String(x.id)===String(id));
 if(!row)return showToast('السجل غير متاح وفق الصلاحيات الحالية.','error');
 const labels={lead:'CRM LEAD',project:'MARKETING PROJECT',ad:'ADVERTISEMENT',provider:'MARKETING PROVIDER',service:'MARKETING SERVICE'};
 const title=row.title||row.name_ar||row.name_en||row.name||row.project_type||row.code||'سجل تسويقي';
 const entries=Object.entries(row).filter(([k,v])=>v!==null&&v!==undefined&&typeof v!=='object').slice(0,14);
 const html='<div class="mx-record-kv-grid">'+entries.map(([k,v])=>'<div><span>'+esc(k)+'</span><b>'+esc(String(v))+'</b></div>').join('')+'</div>';
 return openUnifiedRecordDetails({kicker:labels[kind]||'MARKETING RECORD',title,desc:'بيانات السجل الحالية كما تسمح بها الصلاحيات وRLS.',sections:[{title:'بيانات السجل',html}]});
}
function marketingWorkspace(){
 const leads=live.records.leads||[],projects=live.records.projects||[],ads=live.records.ads||[],providers=live.records.providers||[],services=live.records.services||[];
 const activeAds=ads.filter(x=>String(x.status||'').toUpperCase()==='ACTIVE').length;
 const pendingAds=ads.filter(x=>['PENDING','PENDING_APPROVAL'].includes(String(x.status||x.approval_status||'').toUpperCase())).length;
 const verifiedProviders=providers.filter(x=>x.is_verified===true).length;
 const projectValue=projects.reduce((n,x)=>n+(Number(x.gross_value)||0),0);
 const projectCurrency=projects.find(x=>x.currency)?.currency||'';
 const detail=(kind,id)=>"<button type=\"button\" class=\"linkbtn\" onclick=\"openMarketingRecordDetails('"+kind+"','"+esc(id)+"')\">التفاصيل</button>";
 return workspaceHead('MANTIQATIX MARKETING','مركز التسويق والإعلان','Workspace تشغيلي موحد لإدارة العملاء المحتملين والمشروعات والإعلانات ومقدمي التسويق والخدمات من البيانات الفعلية.','MARKETING')
 +workspaceCards([['العملاء المحتملون',String(leads.length),'طلبات تسويق مرئية وفق RLS'],['المشروعات',String(projects.length),'مشروعات تسويق فعلية'],['الإعلانات النشطة',String(activeAds),'حالة فعلية فقط'],['إعلانات تحتاج متابعة',String(pendingAds),'تحتاج مراجعة أو اعتماد'],['مقدمو التسويق الموثقون',String(verifiedProviders),'ملفات موثقة فقط'],['قيمة المشروعات',projects.length?(projectValue+' '+projectCurrency):'—','مجموع gross_value المتاح فعلياً']])
 +'<section class="card" style="margin:16px 0;padding:18px"><div class="section-head"><div><span class="eyebrow">MARKETING CONTROL</span><h2>مسار التشغيل</h2><p>البيانات المعروضة من الجداول الحالية؛ لا يتم توليد أرقام أو أداء إعلاني غير موجود في المصدر.</p></div></div><div class="grid3" style="margin-top:12px"><article class="card" style="padding:16px"><b>استقطاب العميل</b><p>طلبات التسويق والعملاء المحتملون.</p><button class="btn btn-outline" onclick="createMarketingLead()">إنشاء طلب</button></article><article class="card" style="padding:16px"><b>الظهور الإعلاني</b><p>حجز مبدئي ثم تحقق التوفر والمسار المالي.</p><button class="btn btn-primary" onclick="requestAdBooking(&quot;HALF_YEARLY&quot;)">طلب حجز</button></article><article class="card" style="padding:16px"><b>مقدمو التسويق</b><p>عرض الملفات والخدمات الفعلية المتاحة.</p><span class="muted">الموثقون: '+verifiedProviders+'</span></article></div></section>'
 +'<div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="createMarketingLead()">+ إنشاء طلب تسويقي</button></div>'
 +globalAdAdminPanel()
 +recordsTable('طلبات التسويق',leads,[['العنوان',r=>r.title||'—'],['الحالة',r=>r.status||'—'],['المصدر',r=>r.source||'—'],['منطقة الخدمة',r=>r.service_area||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—'],['إجراء',r=>detail('lead',r.id)]])
 +recordsTable('المشروعات التسويقية',projects,[['النوع',r=>r.project_type||'—'],['الحالة',r=>r.status||'—'],['القيمة',r=>r.gross_value!=null?(r.gross_value+' '+(r.currency||'')):'—'],['العمولة',r=>r.platform_commission!=null?(r.platform_commission+' '+(r.currency||'')):'—'],['إجراء',r=>detail('project',r.id)]])
 +recordsTable('الإعلانات',ads,[['العنوان',r=>r.title||'—'],['الحالة',r=>r.status||'—'],['الموافقة',r=>r.approval_status||'—'],['البداية',r=>r.start_at?r.start_at:'—'],['النهاية',r=>r.end_at?r.end_at:'—'],['إجراء',r=>detail('ad',r.id)]])
 +recordsTable('مقدمو خدمات التسويق',providers,[['الاسم',r=>r.name_ar||'—'],['النوع',r=>r.provider_kind||'—'],['الحالة',r=>r.status||'—'],['موثق',r=>r.is_verified?'نعم':'لا'],['إجراء',r=>detail('provider',r.id)]])
 +recordsTable('الخدمات التسويقية النشطة',services,[['الخدمة',r=>r.name_ar||r.name_en||'—'],['الكود',r=>r.code||'—'],['الفئة',r=>r.category_code||'—'],['الحالة',r=>r.status||'—'],['إجراء',r=>detail('service',r.id)]])
}
async function openUnifiedRecordDetails(options={}){
 if(!user?.id)return authView();
 const o=options||{}, title=String(o.title||'تفاصيل السجل'), kicker=String(o.kicker||'RECORD DETAILS'), desc=String(o.desc||'التفاصيل المتاحة ضمن الصلاحيات الحالية.'), sections=Array.isArray(o.sections)?o.sections:[], actions=String(o.actions||'');
 const overlay=document.createElement('div');overlay.className='mx-record-drawer-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 overlay.innerHTML='<aside class="mx-record-drawer" dir="rtl"><header class="mx-record-drawer__head"><div><span class="eyebrow">'+esc(kicker)+'</span><h2>'+esc(title)+'</h2><p>'+esc(desc)+'</p></div><button type="button" class="text-btn mx-record-drawer__close" aria-label="إغلاق التفاصيل">إغلاق</button></header><div class="mx-record-drawer__body">'+sections.map(s=>'<section class="mx-record-detail-section">'+(s.title?'<div class="section-head"><div><span class="eyebrow">'+esc(s.kicker||'DETAIL')+'</span><h3>'+esc(s.title)+'</h3></div>'+(s.badge?'<span class="count">'+esc(s.badge)+'</span>':'')+'</div>':'')+String(s.html||'')+'</section>').join('')+'</div>'+(actions?'<footer class="mx-record-drawer__foot">'+actions+'</footer>':'')+'</aside>';
 document.body.appendChild(overlay);const close=()=>{overlay.remove();document.removeEventListener('keydown',onKey)};const onKey=e=>{if(e.key==='Escape')close()};
 overlay.querySelector('.mx-record-drawer__close')?.addEventListener('click',close);overlay.addEventListener('click',e=>{if(e.target===overlay)close()});document.addEventListener('keydown',onKey);return {overlay,close};
}
async function openLeadDetails(leadId){
 if(!user?.id||!leadId)return authView();const lead=live.records.leads.find(x=>x.id===leadId);if(!lead)return showToast('الطلب غير متاح وفق الصلاحيات الحالية.','error');
 const {data,error}=await sb.from('marketing_leads').select('id,title,description,budget_min,budget_max,currency,required_services,service_area,status,source,assigned_provider_id,created_at,updated_at').eq('id',leadId).eq('requester_user_id',user.id).maybeSingle();
 if(error)return showToast('تعذر تحميل تفاصيل الطلب: '+error.message,'error');if(!data)return showToast('الطلب غير متاح وفق الصلاحيات الحالية.','error');
 const services=Array.isArray(data.required_services)?data.required_services.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('، '):(data.required_services?JSON.stringify(data.required_services):'—');
 const budget=data.budget_min!=null||data.budget_max!=null?((data.budget_min??'—')+' — '+(data.budget_max??'—')+' '+(data.currency||'')):'—';
 openUnifiedRecordDetails({kicker:'CRM LEAD',title:data.title||'طلب تسويق',desc:data.description||'التفاصيل المتاحة من سجل العميل المحتمل الحالي فقط.',sections:[
 {title:'ملخص الطلب',html:'<div class="mx-record-kv-grid"><div><span>الحالة</span><b>'+esc(data.status||'—')+'</b></div><div><span>المصدر</span><b>'+esc(data.source||'—')+'</b></div><div><span>الميزانية</span><b>'+esc(budget)+'</b></div><div><span>منطقة الخدمة</span><b>'+esc(data.service_area||'—')+'</b></div><div><span>المقدم المعين</span><b>'+esc(data.assigned_provider_id||'—')+'</b></div><div><span>آخر تحديث</span><b>'+esc(data.updated_at?new Date(data.updated_at).toLocaleString('ar-EG'):'—')+'</b></div></div>'},
 {title:'الخدمات المطلوبة',html:'<div class="mx-record-prose">'+esc(services)+'</div>'}]});
}

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
 const destructive=['CANCELLED','DELIVERED'].includes(String(newStatus).toUpperCase());
 if(destructive){
  const promptText=newStatus==='CANCELLED'?'هل تريد إلغاء هذا الطلب؟ لا تنفذ الإلغاء إلا إذا كنت متأكدًا.':'هل تؤكد تسجيل الطلب كمُسلَّم؟';
  if(!window.confirm(promptText))return;
 }
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
function openOrderDetails(orderId){
 if(!user?.id||!orderId)return authView();const r=(live.records.orders||[]).find(x=>String(x.id)===String(orderId));if(!r)return showToast('الطلب غير متاح وفق الصلاحيات الحالية.','error');
 const items=Array.isArray(r.items)?r.items:[],history=(live.records.orderHistory||[]).filter(x=>String(x.order_id)===String(r.id)).sort((a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0));
 const itemText=items.length?items.map(x=>'<li><span>'+esc(x.name_ar||x.name||x.title||x.item_id||'صنف')+'</span><b>× '+esc(x.quantity??1)+'</b></li>').join(''):'<li><span>لا توجد تفاصيل أصناف محملة</span><b>—</b></li>';
 const timeline=history.length?history.map(x=>'<div class="mx-order-timeline__item"><span class="mx-order-timeline__dot"></span><div><b>'+esc(orderStatusLabel(x.new_status))+'</b><p>'+esc(x.reason||'تحديث حالة الطلب')+'</p><small>'+esc(x.created_at?new Date(x.created_at).toLocaleString('ar-EG'):'—')+'</small></div></div>').join(''):'<div class="mnty-screen-note">لا يوجد سجل انتقالات محمل لهذا الطلب.</div>';
 const total=r.total_amount!=null?(r.total_amount+' '+(r.currency||'')):'—';
 openUnifiedRecordDetails({kicker:'ORDER DETAILS',title:'طلب '+String(r.id).slice(0,8),desc:'التفاصيل المتاحة من سجل الطلب الحالي فقط.',sections:[
 {title:'البيانات الأساسية',html:'<div class="mx-record-kv-grid"><div><span>الحالة الحالية</span><b><span class="'+orderStatusClass(r.status)+'">'+esc(orderStatusLabel(r.status))+'</span></b></div><div><span>الإجمالي</span><b>'+esc(total)+'</b></div><div><span>العميل</span><b>'+esc(r.customer_name||'—')+'</b></div><div><span>تاريخ الإنشاء</span><b>'+esc(r.created_at?new Date(r.created_at).toLocaleString('ar-EG'):'—')+'</b></div><div><span>الهاتف</span><b>'+esc(r.customer_phone||r.phone||'غير متاح')+'</b></div><div><span>العنوان</span><b>'+esc(r.delivery_address||r.address||'غير متاح')+'</b></div></div>'},
 {kicker:'ITEMS',title:'محتويات الطلب',badge:String(items.length||0),html:'<ul class="mx-order-items">'+itemText+'</ul>'},
 {kicker:'TIMELINE',title:'تسلسل الحالة',html:'<div class="mx-order-timeline">'+timeline+'</div>'}],actions:orderActions(r)});
}

function orderCards(){
 const rows=live.records.orders||[];
 if(!rows.length)return '<section class="mnty-empty-workspace"><div class="mnty-empty-icon">⌁</div><div><h3>لا توجد طلبات حاليًا</h3><p>ستظهر هنا الطلبات الفعلية المرتبطة بحسابك عندما يتم إنشاء طلب عبر المسار المعتمد.</p></div><div class="mnty-empty-actions"><button class="btn btn-outline" style="width:auto" onclick="selectModule(\'المجالات والخدمات\')">استكشف الخدمات</button></div></section>';
 return '<div class="mx-order-grid">'+rows.map(r=>'<article class="mx-order-card"><div class="mx-order-card__head"><span class="'+orderStatusClass(r.status)+'">'+esc(orderStatusLabel(r.status))+'</span><small>'+esc(r.created_at?new Date(r.created_at).toLocaleString('ar-EG'):'—')+'</small></div><h3>طلب '+esc(String(r.id||'').slice(0,8))+'</h3><p>'+esc(r.customer_name||'طلب خدمة')+'</p><div class="mx-order-card__meta"><span>الإجمالي</span><b>'+esc(r.total_amount!=null?(r.total_amount+' '+(r.currency||'')):'—')+'</b></div><div class="mx-order-card__actions"><button class="text-btn" onclick="openOrderDetails(\''+esc(r.id)+'\')">التفاصيل</button>'+orderActions(r)+'</div></article>').join('')+'</div>';
}
function operationsWorkspace(){
 const rows=Array.isArray(live.records.orders)?live.records.orders:[];
 const history=Array.isArray(live.records.orderHistory)?live.records.orderHistory:[];
 const notifications=Array.isArray(live.records.notifications)?live.records.notifications:[];
 const activeStatuses=['PENDING','CREATED','CONFIRMED','PREPARING','OUT_FOR_DELIVERY'];
 const active=rows.filter(r=>activeStatuses.includes(String(r.status||'').toUpperCase())).length;
 const delivered=rows.filter(r=>String(r.status||'').toUpperCase()==='DELIVERED').length;
 const cancelled=rows.filter(r=>['CANCELLED','FAILED','EXPIRED'].includes(String(r.status||'').toUpperCase())).length;
 const visibleValue=rows.reduce((n,r)=>n+(Number(r.total_amount)||0),0);
 const currency=rows.find(r=>r.currency)?.currency||'';
 const unread=notifications.filter(n=>!n.read_at).length;
 const byStatus={};rows.forEach(r=>{const s=String(r.status||'UNKNOWN').toUpperCase();byStatus[s]=(byStatus[s]||0)+1});
 const statusRows=Object.entries(byStatus).map(([status,count])=>({status,count}));
 return workspaceHead('OPERATIONS','مركز العمليات','متابعة دورة الطلبات والحالات والتنبيهات وسجل الانتقالات ضمن نطاق العضوية الحالي، مع إبقاء التغييرات الحساسة خلف المسار المعتمد.','OPERATIONS')
 +workspaceCards([
  ['إجمالي الطلبات',countOrDash('orders'),'إجمالي مرئي وفق نطاق الحساب'],
  ['نشطة الآن',String(active),'من آخر السجلات المحملة'],
  ['تم التسليم',String(delivered),'من آخر السجلات المحملة'],
  ['ملغاة / فاشلة',String(cancelled),'من آخر السجلات المحملة'],
  ['قيمة السجلات المحملة',rows.length?(visibleValue+' '+currency):'—','لا تمثل إجمالي الإيرادات'],
  ['تنبيهات غير مقروءة',String(unread),'إشعارات الحساب الحالية']
 ])
 +'<section class="card" style="margin:16px 0;padding:18px"><div class="section-head"><div><span class="eyebrow">OPERATIONS CONTROL</span><h2>لوحة الحالة</h2><p>كل تغيير حالة يمر عبر الوظيفة الحالية وصلاحيات الحساب؛ لا يوجد تغيير مباشر لصلاحيات العميل من الواجهة.</p></div></div><div class="grid3" style="margin-top:12px">'+Object.entries(byStatus).map(([s,n])=>'<article class="card" style="padding:14px"><span class="'+orderStatusClass(s)+'">'+esc(orderStatusLabel(s))+'</span><strong style="display:block;font-size:24px;margin-top:8px">'+esc(n)+'</strong><small class="muted">من السجلات المحملة</small></article>').join('')+'</div></section>'
 +'<div class="action-bar"><button class="btn btn-outline" style="width:auto" onclick="selectModule(\'الطلبات والعمليات\')">فتح شاشة الطلبات</button><button class="btn btn-outline" style="width:auto" onclick="selectModule(\'الدعم والحوكمة\')">فتح الدعم</button></div>'
 +orderCards()
 +recordsTable('آخر انتقالات الحالة',history,[['الطلب',r=>String(r.order_id||'').slice(0,8)],['من',r=>orderStatusLabel(r.old_status)],['إلى',r=>orderStatusLabel(r.new_status)],['السبب',r=>r.reason||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleString('ar-EG'):'—']])
 +recordsTable('ملخص حالات الطلبات',statusRows,[['الحالة',r=>orderStatusLabel(r.status)],['العدد',r=>String(r.count)]]);
}
function ordersWorkspace(){return operationsWorkspace()}
function analyticsWorkspace(){
 const orders=Array.isArray(live.records.orders)?live.records.orders:[];
 const leads=Array.isArray(live.records.leads)?live.records.leads:[];
 const providers=Array.isArray(live.records.providers)?live.records.providers:[];
 const projects=Array.isArray(live.records.projects)?live.records.projects:[];
 const ads=Array.isArray(live.records.ads)?live.records.ads:[];
 const notifications=Array.isArray(live.records.notifications)?live.records.notifications:[];
 const delivered=orders.filter(o=>String(o.status||'').toUpperCase()==='DELIVERED').length;
 const cancelled=orders.filter(o=>['CANCELLED','FAILED','EXPIRED'].includes(String(o.status||'').toUpperCase())).length;
 const openLeads=leads.filter(l=>!['CLOSED','CONVERTED','REJECTED'].includes(String(l.status||'').toUpperCase())).length;
 const activeProjects=projects.filter(p=>!['CLOSED','COMPLETED','CANCELLED'].includes(String(p.status||'').toUpperCase())).length;
 const activeAds=ads.filter(a=>String(a.status||'').toUpperCase()==='ACTIVE'||String(a.approval_status||'').toUpperCase()==='APPROVED').length;
 const unread=notifications.filter(n=>!n.read_at).length;
 const orderValue=orders.reduce((n,o)=>n+(Number(o.total_amount)||0),0);
 const currency=orders.find(o=>o.currency)?.currency||'';
 const note='المؤشرات التالية محسوبة من السجلات التي تم تحميلها فعليًا لهذا الحساب، وليست إجماليًا تاريخيًا إلا إذا كان مصدر التحميل شاملًا.';
 return workspaceHead('ANALYTICS','التقارير والتحليلات','لوحة تحليلية مبنية على بيانات التشغيل الفعلية المتاحة، مع منع الخلط بين العينة المحملة والإجمالي التاريخي.','LIVE')
 +'<div class="notice">'+esc(note)+'</div>'
 +workspaceCards([
  ['الطلبات المحملة',String(orders.length),'مصدر orders الحالي'],
  ['تم التسليم',String(delivered),'من الطلبات المحملة'],
  ['ملغاة / فاشلة',String(cancelled),'من الطلبات المحملة'],
  ['قيمة الطلبات المحملة',orders.length?(orderValue+' '+currency):'—','ليست إجمالي الإيرادات'],
  ['Leads المفتوحة',String(openLeads),'من CRM المتاح'],
  ['مشروعات نشطة',String(activeProjects),'من التسويق المتاح']
 ])
 +'<section class="card" style="margin:16px 0;padding:18px"><div class="section-head"><div><span class="eyebrow">OPERATING SIGNALS</span><h2>إشارات الأداء</h2><p>قراءة تشغيلية فقط من البيانات الحالية؛ لا توجد نسب تحويل أو نمو مصطنعة بدون بيانات فترة مقارنة.</p></div></div><div class="grid3" style="margin-top:12px">'
 +'<article class="card" style="padding:14px"><b>معدل التسليم</b><strong style="display:block;font-size:24px;margin-top:8px">'+(orders.length?((delivered/orders.length)*100).toFixed(1)+'%':'—')+'</strong><small class="muted">من الطلبات المحملة</small></article>'
 +'<article class="card" style="padding:14px"><b>معدل الإلغاء/الفشل</b><strong style="display:block;font-size:24px;margin-top:8px">'+(orders.length?((cancelled/orders.length)*100).toFixed(1)+'%':'—')+'</strong><small class="muted">من الطلبات المحملة</small></article>'
 +'<article class="card" style="padding:14px"><b>إعلانات فعالة</b><strong style="display:block;font-size:24px;margin-top:8px">'+String(activeAds)+'</strong><small class="muted">حسب الحالة المتاحة</small></article>'
 +'</div></section>'
 +'<section class="card" style="margin:16px 0;padding:18px"><div class="section-head"><div><span class="eyebrow">DATA SOURCES</span><h2>مصادر التقرير</h2><p>كل رقم قابل للتتبع إلى مصدره؛ عند عدم توفر مصدر لا يتم اختراع قيمة بديلة.</p></div></div>'
 +recordsTable('مصادر البيانات الحالية',[
  {source:'orders',count:orders.length,note:'طلبات محملة'},
  {source:'marketing_leads',count:leads.length,note:'Leads محملة'},
  {source:'marketing_provider_profiles',count:providers.length,note:'مقدمو خدمة محملون'},
  {source:'marketing_projects',count:projects.length,note:'مشروعات محملة'},
  {source:'advertisements',count:ads.length,note:'إعلانات محملة'},
  {source:'notifications',count:notifications.length,note:'إشعارات محملة'}
 ],[['المصدر',r=>r.source],['السجلات',r=>String(r.count)],['الوصف',r=>r.note]])+'</section>'
 +'<section class="card" style="padding:18px"><span class="eyebrow">FINANCE BOUNDARY</span><p>الإيرادات والتسويات والعمولات تُقرأ من النواة المالية المتخصصة عند توفر الصلاحية. لا يتم اشتقاق Revenue من قيمة الطلبات المحملة.</p></section>';
}
async function postFinancialJournal(){if(!user?.id||!live.tenantId)return authView();if(!['OWNER','BUSINESS_OWNER','ADMIN','MANAGER','ACCOUNTANT','FINANCE','FINANCE_MANAGER'].includes(String(live.role||'').toUpperCase()))return showToast('لا تملك صلاحية ترحيل قيد مالي.','error');const entryNumber=window.prompt('رقم القيد');if(!entryNumber?.trim())return;const debitAccount=window.prompt('معرف حساب المدين');const creditAccount=window.prompt('معرف حساب الدائن');const amount=Number(window.prompt('المبلغ','0'));if(!debitAccount?.trim()||!creditAccount?.trim()||!Number.isFinite(amount)||amount<=0)return showToast('بيانات القيد غير صحيحة.','error');const description=window.prompt('وصف القيد','')||'';const session=await sb.auth.getSession();const token=session?.data?.session?.access_token;if(!token)return showToast('انتهت الجلسة.','error');const fingerprint=JSON.stringify([live.tenantId,entryNumber.trim(),live.businessId||null,live.branchId||null,debitAccount.trim(),creditAccount.trim(),amount,description]);let attempt=null;try{attempt=JSON.parse(sessionStorage.getItem('mantiqatix_financial_journal_attempt')||'null')}catch{}if(!attempt||attempt.fingerprint!==fingerprint){attempt={fingerprint,id:crypto.randomUUID()};try{sessionStorage.setItem('mantiqatix_financial_journal_attempt',JSON.stringify(attempt))}catch{}}const entry={id:attempt.id,entry_number:entryNumber.trim(),business_id:live.businessId||null,branch_id:live.branchId||null,reference_type:'MANUAL',description,total_debit:amount,total_credit:amount,status:'POSTED'};const lines=[{account_id:debitAccount.trim(),line_number:1,debit:amount,credit:0,description},{account_id:creditAccount.trim(),line_number:2,debit:0,credit:amount,description}];const {data,error}=await sb.functions.invoke('post-financial-journal',{body:{tenantId:live.tenantId,entry,lines},headers:{Authorization:'Bearer '+token}});if(error)return showToast('تعذر ترحيل القيد: '+error.message+' — أعد المحاولة بنفس البيانات إن كانت النتيجة غير مؤكدة.','error');try{sessionStorage.removeItem('mantiqatix_financial_journal_attempt')}catch{}showToast('تم ترحيل القيد '+(data?.id||''),'success');live.moduleData={};await loadDomainModule(current);renderApp()}
function financeWorkspace(){
 const f=live.finance||{};const allowed=Boolean(live.finance);const fmt=v=>v==null?'—':String(v);const note=allowed?'بيانات رقابية من النواة المالية الحالية وضمن Tenant العضوية.':'هذه المساحة تتطلب دورًا ماليًا معتمدًا.';
 return workspaceHead('FINANCE','المركز المالي والرقابة','متابعة القيود والعمولات والدفع والتسويات والمحافظ من السجلات الحالية، دون تنفيذ حركة مالية مباشرة من واجهة المتصفح.','FINANCE')+'<div class="notice">'+esc(note)+'</div>'+workspaceCards([['القيود المحاسبية',fmt(f.journals),'journal_entries المرئية'],['عمليات العمولات',fmt(f.commissions),'commission_transactions'],['نوايا الدفع',fmt(f.paymentIntents),'payment_intents'],['المطابقات المالية',fmt(f.reconciliations),'financial reconciliations'],['التسويات',fmt(f.settlements),'settlement transactions'],['المحافظ',fmt(f.wallets),'wallet accounts']])+'<section class="card" style="margin:16px 0;padding:18px"><div class="section-head"><div><span class="eyebrow">FINANCIAL CONTROL</span><h2>بوابات الرقابة</h2><p>لا توجد أرقام إيرادات أو أرصدة مصطنعة. الحركة المالية تمر عبر المسارات المعتمدة فقط.</p></div></div><div class="grid3" style="margin-top:12px"><article class="card" style="padding:16px"><b>الترحيل</b><p>يمر عبر Edge Function الحالي ولا يوجد إدخال مباشر للقيد من الواجهة.</p></article><article class="card" style="padding:16px"><b>الدفع</b><p>عرض رقابي فقط؛ لا يتم تنفيذ دفعة حقيقية من هذه اللوحة.</p></article><article class="card" style="padding:16px"><b>التسوية</b><p>عرض رقابي فقط إلى حين اكتمال E2E المالي الإنتاجي.</p></article></div></section>'+(allowed?'<div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="postFinancialJournal()">+ ترحيل قيد عبر المسار المعتمد</button><button class="btn btn-outline" style="width:auto" onclick="walletView()">عرض المحفظة</button></div>':'')+'<section class="card" style="margin-top:16px;padding:18px"><span class="eyebrow">SCOPE</span><p class="muted">Tenant: '+esc(live.tenantId||'—')+' · Business: '+esc(live.businessId||'—')+' · Role: '+esc(live.role||'—')+'</p></section>';}

function crmWorkspace(){
 const leads=Array.isArray(live.records.leads)?live.records.leads:[];
 const tickets=Array.isArray(live.records.supportTickets)?live.records.supportTickets:[];
 const notifications=Array.isArray(live.records.notifications)?live.records.notifications:[];
 const role=String(live.role||'').toUpperCase();
 const manager=['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER','SUPPORT','SUPPORT_MANAGER'].includes(role);
 const openLeads=leads.filter(x=>!['CLOSED','CONVERTED','REJECTED'].includes(String(x.status||'').toUpperCase())).length;
 const openTickets=tickets.filter(x=>!['CLOSED','RESOLVED'].includes(String(x.status||'').toUpperCase())).length;
 const unread=notifications.filter(x=>!x.read_at).length;
 const leadRows=leads.map(r=>Object.assign({},r,{_action:'<button type="button" class="linkbtn mx-crm-detail" data-crm-kind="lead" data-crm-id="'+esc(r.id)+'">التفاصيل</button>'}));
 const ticketRows=tickets.map(r=>Object.assign({},r,{_action:'<button type="button" class="linkbtn mx-crm-detail" data-crm-kind="ticket" data-crm-id="'+esc(r.id)+'">التفاصيل</button>'}));
 const canCreateLead=window.MNTY_RBAC?.can(role,'CRM','create',live.permissions)===true;
 const canCreateTicket=window.MNTY_RBAC?.can(role,'SUPPORT','create',live.permissions)===true;
 const actions='<div class="action-bar">'+(canCreateLead?'<button class="btn btn-primary" style="width:auto" onclick="createMarketingLead()">+ طلب تسويق</button>':'')+(canCreateTicket?'<button class="btn btn-outline" style="width:auto" onclick="openSupportTicket()">+ تذكرة دعم</button>':'')+'</div>';
 const note=manager?'عرض تشغيلي موسع حسب العضوية والصلاحيات الحالية؛ البيانات تأتي من RLS مباشرة.':'عرض سجلات حسابك فقط وفق سياسات الوصول الحالية.';
 return workspaceHead('CRM','العملاء والعلاقات','مركز موحد لطلبات العملاء المحتملين وتذاكر الدعم والمراسلات والتنبيهات، بدون بيانات تجريبية.','CRM')
  +'<div class="notice">'+esc(note)+'</div>'
  +workspaceCards([
   ['طلبات التسويق',String(leads.length),'سجلات مرئية وفق RLS'],
   ['طلبات مفتوحة',String(openLeads),'ليست مغلقة أو محولة أو مرفوضة'],
   ['تذاكر الدعم',String(tickets.length),'تذاكر مرئية وفق نطاق الحساب'],
   ['تذاكر تحتاج متابعة',String(openTickets),'حالات مفتوحة أو قيد المعالجة'],
   ['إشعارات غير مقروءة',String(unread),'تنبيهات الحساب الحالية'],
   ['نطاق الحساب',esc(live.tenantId||'—'),'Tenant الحالي فقط']
  ])
  +actions
  +recordsTable('طلبات التسويق',leadRows,[
    ['العنوان',r=>r.title||'—'],['الحالة',r=>r.status||'—'],['المصدر',r=>r.source||'—'],['منطقة الخدمة',r=>r.service_area||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—'],['إجراء',r=>r._action]
  ])
  +recordsTable('تذاكر الدعم',ticketRows,[
    ['الموضوع',r=>r.subject||'—'],['الفئة',r=>r.category||'—'],['الأولوية',r=>r.priority||'—'],['الحالة',r=>r.status||'—'],['آخر تحديث',r=>r.updated_at?new Date(r.updated_at).toLocaleString('ar-EG'):(r.created_at?new Date(r.created_at).toLocaleString('ar-EG'):'—')],['إجراء',r=>r._action]
  ]);
}
function canManageSupport(){return window.MNTY_RBAC?.can(String(live.role||''),'SUPPORT','update',live.permissions)===true}
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
 if(!user?.id||!ticketId)return authView();const ticket=live.records.supportTickets.find(x=>x.id===ticketId);if(!ticket)return showToast('التذكرة غير متاحة وفق الصلاحيات الحالية.','error');
 const {data,error}=await sb.from('ticket_messages').select('id,sender_user_id,sender_role,content,created_at').eq('ticket_id',ticketId).order('created_at',{ascending:true});if(error)return showToast('تعذر تحميل رسائل التذكرة: '+error.message,'error');
 const messages=(data||[]).map(m=>'<article class="card"><div class="row"><b>'+esc(m.sender_role||'USER')+'</b><span>'+esc(m.created_at?new Date(m.created_at).toLocaleString('ar-EG'):'—')+'</span></div><p>'+esc(m.content)+'</p></article>').join('')||'<div class="muted">لا توجد رسائل بعد.</div>';
 const statusOptions=SUPPORT_STATUSES.map(s=>'<option value="'+s+'" '+(ticket.status===s?'selected':'')+'>'+s+'</option>').join('');const statusControl=canManageSupport()?'<label class="field"><span>تحديث الحالة</span><select id="ticket-status">'+statusOptions+'</select></label>':'<span>الحالة: <b>'+esc(ticket.status)+'</b></span>';
 const actions='<button class="btn btn-primary" id="ticket-reply">إضافة رد</button>'+(canManageSupport()?'<button class="btn btn-outline" id="ticket-save-status">حفظ الحالة</button>':'');
 const result=openUnifiedRecordDetails({kicker:'SUPPORT TICKET',title:ticket.subject||'تذكرة دعم',desc:ticket.description||'التفاصيل والمراسلات المتاحة وفق الصلاحيات الحالية.',sections:[
 {title:'الحالة والأولوية',html:'<div class="mx-record-ticket-meta">'+statusControl+'<span>الأولوية: <b>'+esc(ticket.priority||'—')+'</b></span></div>'},
 {kicker:'THREAD',title:'المراسلات',html:'<div class="ticket-thread">'+messages+'</div>'}],actions});
 result.overlay.querySelector('#ticket-reply').onclick=async()=>{result.close();await replyToTicket(ticketId)};
 if(canManageSupport())result.overlay.querySelector('#ticket-save-status').onclick=async()=>{const next=result.overlay.querySelector('#ticket-status').value;const ok=await updateTicketStatus(ticketId,next);if(ok){result.close();await renderApp()}};
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
 const {error}=await sb.rpc('mark_notifications_read_backend',{p_notification_id:notificationId});
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
 if(window.MNTY_RBAC?.can(String(live.role||''),'SUPPORT','create',live.permissions)!==true)return showToast('لا تملك صلاحية إنشاء تذكرة دعم في هذا النطاق.','error');
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
function getMntiCart(){
 try{const x=JSON.parse(localStorage.getItem('MNTY_CART')||'[]');return Array.isArray(x)?x:[]}catch(_){return []}
}
function setMntiCart(items){
 try{localStorage.setItem('MNTY_CART',JSON.stringify(Array.isArray(items)?items:[]))}catch(_){}
 window.refreshMntiCartCount?.();
}
function refreshMntiCartCount(){
 const count=getMntiCart().reduce((n,x)=>n+Math.max(1,Number(x.quantity)||1),0);
 document.querySelectorAll('#mx-cart-count').forEach(el=>el.textContent=String(count));
 return count;
}
window.refreshMntiCartCount=refreshMntiCartCount;
function cartView(){
 const items=getMntiCart();
 const rows=items.length?items.map((x,i)=>'<article class="mx-cart-row"><div><b>'+esc(x.name||'خدمة')+'</b><small>'+esc(x.providerName||'مقدم الخدمة')+'</small></div><div><strong>'+esc(x.priceLabel||'السعر حسب الكتالوج')+'</strong><button class="text-btn" data-cart-remove="'+i+'">حذف</button></div></article>').join(''):'<div class="empty-state">السلة فارغة حاليًا. أضف الخدمات من كتالوج النشاط بعد اختيار مقدم الخدمة.</div>';
 const overlay=document.createElement('div');overlay.className='mx-modal';
 overlay.innerHTML='<div class="mx-modal-card"><div class="section-head"><div><span class="eyebrow">CART</span><h2>سلة الخدمات</h2><p>العناصر محفوظة محليًا حتى تبدأ طلبًا فعليًا.</p></div><button class="text-btn mx-close-modal">إغلاق</button></div><div class="mx-cart-list">'+rows+'</div>'+(items.length?'<div class="action-bar"><button class="btn btn-primary" id="mx-cart-checkout">متابعة الطلب</button><button class="btn btn-outline" id="mx-cart-clear">تفريغ السلة</button></div>':'')+'</div>';
 document.body.appendChild(overlay);
 const close=()=>overlay.remove();
 overlay.querySelector('.mx-close-modal')?.addEventListener('click',close);
 overlay.querySelectorAll('[data-cart-remove]').forEach(b=>b.addEventListener('click',()=>{const next=getMntiCart();next.splice(Number(b.dataset.cartRemove),1);setMntiCart(next);close();cartView()}));
 overlay.querySelector('#mx-cart-clear')?.addEventListener('click',()=>{setMntiCart([]);close();cartView()});
 overlay.querySelector('#mx-cart-checkout')?.addEventListener('click',()=>showToast('اختَر الخدمة من الكتالوج لبدء الطلب والدفع الآمن.','success'));
}
window.cartView=cartView;
function addToMntiCart(item,price,providerName,businessId,branchId){
 const items=getMntiCart();
 const key=[businessId,branchId,item?.id].join('|');
 const found=items.find(x=>x.key===key);
 if(found)found.quantity=Math.max(1,(Number(found.quantity)||1)+1);
 else items.push({key,itemId:item?.id,businessId,branchId,name:item?.name_ar||item?.name_en||'خدمة',providerName:providerName||'مقدم الخدمة',priceLabel:price?String(price.unit_price)+' '+String(price.currency||''):'السعر حسب الكتالوج',quantity:1});
 setMntiCart(items);
 showToast('تمت إضافة الخدمة إلى السلة.','success');
}
window.addToMntiCart=addToMntiCart;

async function walletView(){
 if(!user?.id)return authView();
 let smm=null,general=[];
 try{
   const sr=await sb.from('smm_wallets').select('balance,currency,updated_at').eq('user_id',user.id).maybeSingle();
   if(!sr.error)smm=sr.data||null;
 }catch(_){}
 try{
   const ids=(live.memberships||[]).filter(m=>m.status==='ACTIVE'&&m.tenant_id&&m.business_id).map(m=>m.business_id);
   if(ids.length){
     const wr=await sb.from('wallet_accounts').select('id,tenant_id,owner_type,owner_id,currency,status').in('owner_id',ids).eq('status','ACTIVE').limit(10);
     if(!wr.error)general=wr.data||[];
   }
 }catch(_){}
 const hasWallet=Boolean(smm||general.length);
 const balance=smm?Number(smm.balance||0):null;
 document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card"><div class="brand">'+mark()+'<span>MantiqatiX</span></div><div class="gradient-line"></div><h1>المحفظة</h1><p class="muted">المحافظ المالية لا تُنشأ أو تُشحّن تلقائيًا من الواجهة.</p><section class="mx-profile-card"><div class="mx-profile-card__avatar">▣</div><div><b>'+esc(user.email||'الحساب')+'</b><small>'+ (hasWallet?'محفظة مرتبطة بالحساب':'لا توجد محفظة مالية مفعلة حاليًا')+'</small></div></section>'+(smm?'<div class="mx-wallet-balance"><span>رصيد محفظة الخدمات الرقمية</span><strong>'+balance.toFixed(2)+' '+esc(smm.currency||'EGP')+'</strong><small>آخر تحديث: '+esc(new Date(smm.updated_at).toLocaleString('ar-EG'))+'</small></div>':'<div class="empty-state">سيظهر الرصيد هنا عند تفعيل محفظة مالية للحساب.</div>')+'<div class="action-bar"><button class="btn btn-primary" id="wallet-account">العودة إلى حسابي</button><button class="btn btn-outline" id="wallet-home">الرئيسية</button></div></section></main>';
 document.getElementById('wallet-account').onclick=accountView;
 document.getElementById('wallet-home').onclick=()=>window.MXHomeLanding?MXHomeLanding():landingView();
}
window.walletView=walletView;

async function openDigitalPageOrderModal(pageType,targetBusinessId=null){
 const type=String(pageType||'PORTFOLIO').toUpperCase();
 if(!['PORTFOLIO','MENU'].includes(type))return;
 const {data:products,error}=await sb.from('digital_page_products').select('id,page_type,code,name_ar,description_ar,price,currency,duration_days,features').eq('page_type',type).eq('active',true).order('price',{ascending:true});
 if(error)return showToast('تعذر تحميل باقات الصفحة: '+error.message,'error');
 const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:1000;background:rgba(7,27,56,.58);display:grid;place-items:center;padding:12px;backdrop-filter:blur(8px)';overlay.innerHTML='<div class="mx-modal-card" dir="rtl" style="width:min(760px,100%);max-height:92vh;overflow:auto;background:#fff;border:1px solid #eadfc9;border-radius:22px;padding:20px;box-shadow:0 24px 70px rgba(16,24,40,.24)"><div class="section-head"><div><span class="eyebrow">'+(type==='PORTFOLIO'?'PORTFOLIO PAGE':'MENU PAGE')+'</span><h2>طلب صفحة '+(type==='PORTFOLIO'?'Portfolio شخصية':'Menu للنشاط')+'</h2><p class="muted">اختر الباقة، وسيتم إنشاء طلب مملوك لحسابك بسعر مثبت من الخادم.</p></div><button type="button" class="text-btn" id="dp-close">إغلاق</button></div><div class="grid2" id="dp-products"></div><label class="field"><span>عنوان الصفحة *</span><input id="dp-title" maxlength="180" required placeholder="'+(type==='PORTFOLIO'?'اسمك أو اسم علامتك الشخصية':'اسم النشاط أو القائمة')+'"></label><div class="action-bar"><button type="button" class="btn btn-primary" id="dp-submit">إنشاء طلب مدفوع</button><button type="button" class="btn btn-outline" id="dp-cancel">إلغاء</button></div></div>';
 document.body.appendChild(overlay);
 const box=overlay.querySelector('#dp-products');let selected=products?.[0]?.id||'';
 box.innerHTML=(products||[]).map(p=>'<button type="button" class="card dp-product '+(p.id===selected?'active':'')+'" style="width:100%;text-align:right;cursor:pointer;border:1px solid #e3e8f1;padding:14px;border-radius:15px;background:#fff;font-family:inherit;display:grid;gap:5px" data-product="'+esc(p.id)+'"><b>'+esc(p.name_ar)+'</b><strong>'+esc(Number(p.price).toFixed(2))+' '+esc(p.currency)+'</strong><small>'+esc(p.description_ar||'')+'</small><small>مدة الخدمة: '+esc(p.duration_days||'—')+' يوم</small></button>').join('')||'<div class="empty-state">لا توجد باقات منشورة حاليًا.</div>';
 box.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>{selected=b.dataset.product;box.querySelectorAll('[data-product]').forEach(x=>x.classList.toggle('active',x===b))});
 const close=()=>overlay.remove();overlay.querySelector('#dp-close').onclick=close;overlay.querySelector('#dp-cancel').onclick=close;
 overlay.querySelector('#dp-submit').onclick=async()=>{
   const title=overlay.querySelector('#dp-title')?.value?.trim();if(!title||!selected)return showToast('اختر الباقة واكتب عنوان الصفحة.','error');
   const idem=crypto.randomUUID();const btn=overlay.querySelector('#dp-submit');btn.disabled=true;btn.textContent='جارٍ إنشاء الطلب...';
   try{
     const {data,error}=await sb.functions.invoke('digital-page-order-create',{body:{productId:selected,pageType:type,title,targetBusinessId,idempotencyKey:idem}});
     if(error||data?.error)throw new Error(data?.error||error?.message||'تعذر إنشاء الطلب');
     const orderId=data?.order?.id;
     if(!orderId)throw new Error('تم إنشاء الطلب دون رقم طلب صالح');
     const paymentIdem=crypto.randomUUID();
     const payment=await sb.functions.invoke('digital-page-payment-intent',{body:{orderId,idempotencyKey:paymentIdem}});
     if(payment.error||payment.data?.error)throw new Error(payment.data?.error||payment.error?.message||'تعذر بدء الدفع');
     const checkoutUrl=String(payment.data?.checkoutUrl||'');
     close();
     if(checkoutUrl){
       showToast('تم تجهيز الدفع. سيتم تحويلك الآن إلى بوابة الدفع الآمنة.','success');
       window.setTimeout(()=>{window.location.assign(checkoutUrl)},350);
       return;
     }
     showToast('تم إنشاء الطلب وتجهيز نية الدفع، لكن رابط الدفع غير متاح حاليًا. راجع إعدادات بوابة الدفع قبل الإطلاق.','error');
     await accountView();
   }catch(e){btn.disabled=false;btn.textContent='إنشاء طلب مدفوع';showToast(e?.message||'تعذر إنشاء الطلب','error')}
 };
 overlay.querySelector('#dp-title')?.focus();
}
window.openDigitalPageOrderModal=openDigitalPageOrderModal;

async function accountView(){
 // Refresh membership state before rendering the account center; never grant roles client-side.
 try{ await loadLiveData(); }catch(e){ live.error=e?.message||'تعذر تحديث العضويات'; }
 if(live.error){
  document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card mx-account-card"><div class="brand">'+mark()+'<span>MantiqatiX</span></div><div class="gradient-line"></div><h1>تعذر تحديث بيانات الحساب</h1><p class="muted">لم نتمكن من التحقق من العضويات الحالية، لذلك لن نعرض بيانات قديمة على أنها محدثة. تحقق من الاتصال ثم أعد المحاولة.</p><p class="msg">'+esc(live.error)+'</p><div class="action-bar"><button class="btn btn-primary" id="account-retry-load">إعادة المحاولة</button><button class="btn btn-outline" id="account-logout-safe">تسجيل الخروج</button></div></section></main>';
  document.getElementById('account-retry-load')?.addEventListener('click',()=>accountView());
  document.getElementById('account-logout-safe')?.addEventListener('click',()=>logout());
  return;
 }
 const memberships=(live.memberships||[]).filter(m=>m.status==='ACTIVE');
 let requests=[];
 if(user?.id){
  const {data,error}=await sb.from('account_registration_requests').select('id,requested_role,status,reason,metadata,created_at,reviewed_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20);
  if(error)return accountStatusPanel()+showToast('تعذر تحميل طلبات العضوية: '+error.message,'error');
  requests=data||[];
 }
 const activeRoles=new Set(memberships.map(m=>String(m.role||'').toUpperCase()));
 const pendingRoles=new Set(requests.filter(r=>r.status==='PENDING').map(r=>String(r.requested_role||'').toUpperCase()));
 const roleOption=(role,label)=>activeRoles.has(role)||pendingRoles.has(role)?'':('<button class="btn btn-outline" id="request-'+role.toLowerCase()+'">'+label+'</button>');
 const requestRows=requests.length?'<div class="request-list">'+requests.slice(0,8).map(r=>'<div class="request-row"><span>'+esc(roleLabel(r.requested_role))+'</span><b>'+esc(r.status==='PENDING'?'قيد المراجعة':r.status==='APPROVED'?'معتمد':'مرفوض')+'</b></div>').join('')+'</div>':'<p class="muted">لا توجد طلبات عضوية إضافية.</p>';
 const membershipRows=memberships.length?'<div class="mx-membership-grid">'+memberships.map(m=>{
   const role=String(m.role||'CUSTOMER').toUpperCase();
   const active=m.id===live.activeMembershipId;
   const icon=m.business_icon||'🏢';
   const image=providerImageUrl(m.business_image_path||'');
   const activity=m.business_name||'نشاط مرتبط';
   const section=m.business_section||'غير محدد';
   const branch=m.branch_id?'فرع مرتبط':'كل الفروع';
   const ownerRole=['OWNER','BUSINESS_OWNER'].includes(role)?'مالك النشاط':roleLabel(role);
 return '<article class="mx-membership-card '+(active?'is-active':'')+'">'+(image?'<div class="mx-membership-card__media"><img src="'+esc(image)+'" alt="صورة '+esc(activity)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="mx-membership-card__media-badge">صورة النشاط</span></div>':'<div class="mx-membership-card__media mx-membership-card__media--fallback"><div class="mx-membership-card__icon">'+esc(icon)+'</div><span class="mx-membership-card__media-badge">لا توجد صورة مرفوعة</span></div>')+'<div class="mx-membership-card__top"><div class="mx-membership-card__status">'+(active?'✓ الحالية':'✓ نشطة')+'</div></div><div class="mx-membership-card__role">'+esc(ownerRole)+'</div><h4>'+esc(activity)+'</h4><div class="mx-membership-card__meta"><span><b>القسم</b><strong>'+esc(section)+'</strong></span><span><b>النشاط</b><strong>'+esc(activity)+'</strong></span><span><b>الفرع</b><strong>'+esc(branch)+'</strong></span></div>'+(m.tenant_id?'<div class="mx-membership-card__tenant">النطاق: '+esc(m.tenant_id)+'</div>':'')+(m.business_verified?'<div class="mx-membership-card__verified">✓ النشاط موثق</div>':'')+'<button type="button" class="btn '+(active?'btn-light':'btn-primary')+' mx-membership-card__action" data-membership-open="'+esc(m.id)+'">'+(active?'الدخول للمساحة الحالية':'دخول إلى المساحة')+'</button></article>';
 }).join('')+'</div>':'<p class="muted">لا توجد عضوية تشغيلية نشطة.</p>';
 const pendingProvider=requests.find(r=>String(r.requested_role||'').toUpperCase()==='SERVICE_PROVIDER'&&r.status==='PENDING');
 let onboarding=null;
 let providerGovernorates=[];
 if(pendingProvider){
   const {data:govs}=await sb.from('platform_geo_areas').select('id,code,name_ar,name_en').eq('country_code','EG').eq('level','GOVERNORATE').eq('status','ACTIVE').order('code',{ascending:true});
   providerGovernorates=govs||[];
 }
 if(pendingProvider){
   const {data}=await sb.from('provider_onboarding_requests').select('id,status,business_name,provider_kind,name_en,description,specialties,service_areas,portfolio,created_at,rejection_reason').eq('registration_request_id',pendingProvider.id).maybeSingle();
   onboarding=data||null;
 }
 const onboardingHtml=pendingProvider&&!onboarding?`<section class="card" style="margin-top:18px"><div class="section-head"><div><span class="eyebrow">PROVIDER ONBOARDING</span><h3>استكمال تسجيل النشاط</h3><p class="muted">أدخل بيانات النشاط الأساسية. لن يتم إنشاء نشاط تشغيلي أو منحه صلاحيات مقدم خدمة إلا بعد مراجعة الإدارة.</p></div><span class="count">مراجعة إدارية</span></div><form id="provider-onboarding-form"><div class="grid2"><label class="field"><span>اسم النشاط *</span><input id="po-business-name" maxlength="180" required placeholder="اسم النشاط أو المنشأة"></label><label class="field"><span>القطاع / نوع مقدم الخدمة *</span><select id="po-kind" required><option value="">اختر النشاط أو نوع مقدم الخدمة</option><option value="FOOD">مطاعم وكافيهات ومطابخ</option><option value="HEALTH">طبيب أو عيادة</option><option value="PHARMACY">صيدلية</option><option value="LABS">معمل تحاليل</option><option value="RADIOLOGY">مركز أشعة</option><option value="HOSPITAL">مستشفى</option><option value="DENTAL">طبيب أو عيادة أسنان</option><option value="VETERINARY">عيادة أو خدمة بيطرية</option><option value="MEDICAL">مركز طبي</option><option value="REAL_ESTATE">شركة أو مكتب عقارات</option><option value="AUTO">سيارات ونقل</option><option value="MAINTENANCE">مقدم خدمات صيانة</option><option value="HOME">خدمات منزلية</option><option value="ACCOUNTING">محاسب أو مكتب محاسبة</option><option value="LEGAL">محامٍ أو مكتب محاماة</option><option value="COMPANIES">شركة أو مقدم خدمات أعمال</option><option value="FACTORIES">مصنع أو مورد</option><option value="EDU">مدرسة أو مدرس أو مركز تدريب</option><option value="DIGITAL">شركة تسويق وإعلان</option><option value="TECH">شركة برمجيات وخدمات تقنية</option><option value="FITNESS">نادي أو مدرب لياقة</option><option value="TRAVEL">شركة سياحة وسفر</option><option value="MANTIGO">مقدم نقل أو سائق MantiGO</option><option value="JOBS">صاحب عمل أو جهة توظيف</option><option value="MATRIMONY">مقدم خدمات زواج ومناسبات</option><option value="USED_ITEMS">بائع أو مقدم خدمة للمستعمل</option><option value="FASHION">متجر أو مقدم خدمات أزياء وخياطة</option><option value="GROCERY">بقالة أو سوبر ماركت</option><option value="FREELANCER">مستقل أو مقدم خدمة احترافية</option></select></label></div><div class="grid2"><label class="field"><span>الاسم بالإنجليزية</span><input id="po-name-en" maxlength="180"></label><label class="field"><span>الخدمات والتخصصات</span><input id="po-specialties" maxlength="1000" list="po-service-options" placeholder="اختر أو اكتب الخدمات والتخصصات"></label></div><datalist id="po-service-options"></datalist><div id="po-service-suggestions" class="mx-provider-service-suggestions" aria-live="polite"></div><label class="field"><span>وصف النشاط</span><textarea id="po-description" maxlength="3000" rows="4" placeholder="وصف مختصر وواضح للنشاط والخدمات"></textarea></label><div class="grid2"><label class="field"><span>المحافظة *</span><select id="po-governorate" required><option value="">اختر المحافظة</option>${providerGovernorates.map(g=>'<option value="'+esc(g.id)+'" data-code="'+esc(g.code)+'" data-name-ar="'+esc(g.name_ar)+'" data-name-en="'+esc(g.name_en||'')+'">'+esc(g.name_ar)+'</option>').join('')}</select></label><label class="field"><span>المركز *</span><select id="po-center" required disabled><option value="">اختر المحافظة أولًا</option></select></label></div><p class="muted" style="margin-top:-8px">تحديد منطقة تقديم الخدمة يتم من خلال المحافظة ثم المركز. لا يتم استخدام الموقع الجغرافي التلقائي بدلًا من الاختيار الإداري.</p><label class="field"><span>روابط/نماذج أعمال (اختياري)</span><textarea id="po-portfolio" maxlength="2000" rows="2" placeholder="رابط واحد لكل سطر"></textarea></label><div class="action-bar"><button class="btn btn-primary" id="po-submit" type="submit" style="width:auto">إرسال بيانات النشاط للمراجعة</button></div></form></section>`:pendingProvider&&onboarding?`<section class="card" style="margin-top:18px"><div class="section-head"><div><span class="eyebrow">PROVIDER ONBOARDING</span><h3>بيانات النشاط</h3><p class="muted">${esc(onboarding.business_name||'—')} · ${esc(onboarding.provider_kind||'—')}</p></div><span class="count">${esc(onboarding.status==='PENDING'?'قيد المراجعة':onboarding.status==='APPROVED'?'معتمد':'مرفوض')}</span></div>${onboarding.rejection_reason?'<p class="muted">سبب الرفض: '+esc(onboarding.rejection_reason)+'</p>':'<p class="muted">تم استلام بيانات النشاط. لا توجد صلاحيات تشغيلية قبل اعتماد الإدارة.</p>'}</section>`:'';
 const requestButtons=roleOption('CUSTOMER','طلب دور عميل')+roleOption('SERVICE_PROVIDER','طلب دور صاحب نشاط / مقدم خدمة');
 const privilegedNote='<p class="muted">الأدوار الإدارية الحساسة مثل Owner وAdmin وManager لا تُمنح بطلب ذاتي؛ يتم ربطها واعتمادها من الإدارة وفق الصلاحيات والسياسات.</p>';
 const profileMeta=user?.user_metadata||{};
 const profileName=profileMeta.full_name||profileMeta.name||user?.email?.split('@')[0]||'مستخدم MantiqatiX';
 const providerProfile=live.myProviderProfile;
 let digitalProducts=[];
 let digitalOrders=[];
 try{
   const [pr,or]=await Promise.all([
     sb.from('digital_page_products').select('id,page_type,code,name_ar,description_ar,price,currency,duration_days').eq('active',true).order('price',{ascending:true}),
     sb.from('digital_page_orders').select('id,page_type,title,amount,currency,payment_status,fulfillment_status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)
   ]);
   digitalProducts=pr.data||[]; digitalOrders=or.data||[];
 }catch(_){}
 const profileAvatar=profileMeta.avatar_url||profileMeta.picture||'';
 const portfolioProducts=digitalProducts.filter(x=>x.page_type==='PORTFOLIO');
 const menuProducts=digitalProducts.filter(x=>x.page_type==='MENU');
 const commercialHtml='<section class="card" style="margin-top:18px"><div class="section-head"><div><span class="eyebrow">DIGITAL SERVICES</span><h3>صفحات مدفوعة من حسابي</h3><p class="muted">اطلب Portfolio شخصية أو Menu للنشاط. السعر يثبت من الخادم ولا يتم النشر تلقائيًا بمجرد الدفع.</p></div></div><div class="action-bar">'+(portfolioProducts.length?'<button class="btn btn-primary" id="account-buy-portfolio" style="width:auto">طلب Portfolio مدفوعة</button>':'')+(providerProfile&&providerProfile.business_id&&menuProducts.length?'<button class="btn btn-outline" id="account-buy-menu" style="width:auto">طلب Menu للنشاط</button>':'')+'</div>'+(!providerProfile&&menuProducts.length?'<p class="muted">لطلب Menu، أكمل تسجيل نشاطك أولًا واعتمد النشاط.</p>':'')+(digitalOrders.length?'<div class="request-list" style="margin-top:12px">'+digitalOrders.slice(0,8).map(o=>'<div class="request-row"><span>'+esc(o.title)+' · '+esc(o.page_type==='PORTFOLIO'?'Portfolio':'Menu')+'</span><b>'+esc(o.payment_status==='PAID'?(o.fulfillment_status==='PUBLISHED'?'منشور':'مدفوع'):o.payment_status==='PENDING'?'بانتظار الدفع':o.payment_status==='FAILED'?'فشل الدفع':'غير مكتمل')+'</b></div>').join('')+'</div>':'<p class="muted" style="margin-top:12px">لا توجد طلبات صفحات رقمية حتى الآن.</p>')+'</section>';
 const profileCard='<section class="mx-profile-card mx-profile-card--account">'+(profileAvatar?'<img class="mx-profile-card__avatar-img" src="'+esc(profileAvatar)+'" alt="صورة الملف الشخصي">':'<div class="mx-profile-card__avatar">'+esc(profileName.slice(0,1).toUpperCase())+'</div>')+'<div class="mx-profile-card__body"><span class="eyebrow">PROFILE</span><h2>'+esc(profileName)+'</h2><p>'+esc(user?.email||'—')+'</p><small><i></i> الحساب مسجل الدخول</small></div></section>';
 const activityCard=providerProfile?'<section class="mx-profile-card mx-profile-card--activity"><div class="mx-profile-card__avatar">'+esc((providerProfile.name_ar||providerProfile.name_en||'نشاط').slice(0,1))+'</div><div class="mx-profile-card__body"><span class="eyebrow">ACTIVITY PROFILE</span><h2>'+esc(providerProfile.name_ar||providerProfile.name_en||'النشاط')+'</h2><p>'+esc(roleLabel(providerProfile.provider_kind||'SERVICE_PROVIDER'))+'</p><small>'+(providerProfile.is_verified?'✓ نشاط موثق':'نشاط منشور')+'</small></div></section>':'<section class="mx-profile-card mx-profile-card--activity"><div class="mx-profile-card__avatar">＋</div><div class="mx-profile-card__body"><span class="eyebrow">ACTIVITY PROFILE</span><h2>ملف النشاط</h2><p>أنشئ أو أكمل ملف نشاطك لعرض الخدمات والتخصصات.</p><button class="text-btn" id="profile-provider-start">استكمال ملف النشاط ←</button></div></section>';
 document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card mx-account-card"><div class="brand">'+mark()+'<span>MantiqatiX</span></div><div class="gradient-line"></div><div class="mx-account-heading"><div><span class="eyebrow">ACCOUNT CENTER</span><h1>حسابي ومساحات العمل</h1><p>كل نشاط يظهر في بطاقة مستقلة موضحًا <b>المالك، اسم النشاط، القسم والفرع</b>.</p></div><span class="mx-account-count">'+memberships.length+' عضوية</span></div>'+accountStatusPanel()+profileCard+activityCard+'<h3 class="mx-account-section-title">مساحات العمل والعضويات</h3>'+membershipRows+'<h3>طلبات العضوية الإضافية</h3>'+requestRows+onboardingHtml+'<div class="action-bar">'+requestButtons+'</div>'+privilegedNote+'<div class="action-bar"><button class="btn btn-primary" id="account-home">العودة للرئيسية</button><button class="btn btn-outline" id="account-logout">تسجيل الخروج</button></div>'+commercialHtml+'</section></main>';
 document.getElementById('profile-provider-start')?.addEventListener('click',()=>typeof providerOnboardingView==='function'?providerOnboardingView():showToast('مسار تسجيل النشاط غير متاح حاليًا.','error'));
 document.getElementById('account-buy-portfolio')?.addEventListener('click',()=>openDigitalPageOrderModal('PORTFOLIO'));
 document.getElementById('account-buy-menu')?.addEventListener('click',()=>openDigitalPageOrderModal('MENU',providerProfile?.business_id||null));
 document.getElementById('account-home').onclick=()=>{window.MXHomeLanding?MXHomeLanding():landingView()};
 document.getElementById('account-logout').onclick=logout;
 document.querySelectorAll('[data-membership-open]').forEach(btn=>btn.addEventListener('click',async()=>{
   const id=btn.getAttribute('data-membership-open');
   if(!id)return;
   if(id===live.activeMembershipId){await renderApp();return;}
   await switchMembership(id);
 }));
 const submitRole=async role=>{authRegistrationType=role;await submitRegistrationRequest(role);};
 document.getElementById('request-customer')?.addEventListener('click',()=>submitRole('CUSTOMER'));
 document.getElementById('request-service_provider')?.addEventListener('click',()=>submitRole('SERVICE_PROVIDER'));
 const kindSelect=document.getElementById('po-kind');
 const serviceInput=document.getElementById('po-specialties');
 const serviceList=document.getElementById('po-service-options');
 const serviceSuggestions=document.getElementById('po-service-suggestions');
 const refreshProviderServices=()=>{
   const items=PROVIDER_SERVICE_TEMPLATES[kindSelect?.value]||[];
   if(serviceList)serviceList.innerHTML=items.map(x=>'<option value="'+esc(x)+'"></option>').join('');
   if(serviceSuggestions)serviceSuggestions.innerHTML=items.map(x=>'<button type="button" class="btn btn-outline mx-provider-service-chip" data-service="'+esc(x)+'">'+esc(x)+'</button>').join('');
   serviceSuggestions?.querySelectorAll('[data-service]').forEach(btn=>btn.addEventListener('click',()=>{
     const v=btn.getAttribute('data-service')||'';
     const current=splitServices(serviceInput?.value);
     if(!current.includes(v)&&serviceInput)serviceInput.value=[...current,v].join('، ');
   }));
 };
 const splitServices=(v)=>String(v||'').split(/[،,\n]/).map(x=>x.trim()).filter(Boolean).slice(0,30);
 kindSelect?.addEventListener('change',refreshProviderServices);
 refreshProviderServices();
 try{
   const raw=localStorage.getItem('MNTYPendingActivityDraft');
   if(raw){
     const d=JSON.parse(raw)||{};
     const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null)el.value=String(v)};
     set('po-business-name',d.business_name);set('po-kind',d.provider_kind);set('po-description',d.description);set('po-specialties',d.specialties);
     if(d.provider_kind)kindSelect?.dispatchEvent(new Event('change'));
     window.MNTYPendingActivityDraft=d;
   }
 }catch(_){}
 const govSelect=document.getElementById('po-governorate');
 const centerSelect=document.getElementById('po-center');
 govSelect?.addEventListener('change',async ()=>{
   const governorateId=govSelect.value;
   centerSelect.innerHTML='<option value="">جارٍ تحميل المراكز...</option>';
   centerSelect.disabled=true;
   if(!governorateId){centerSelect.innerHTML='<option value="">اختر المحافظة أولًا</option>';return}
   const {data,error}=await sb.from('platform_geo_areas').select('id,code,name_ar,name_en').eq('country_code','EG').eq('level','CENTER').eq('status','ACTIVE').eq('parent_id',governorateId).order('code',{ascending:true});
   if(error||!(data||[]).length){centerSelect.innerHTML='<option value="">لا توجد مراكز مسجلة حاليًا لهذه المحافظة</option>';return}
   centerSelect.innerHTML='<option value="">اختر المركز</option>'+(data||[]).map(x=>'<option value="'+esc(x.id)+'" data-code="'+esc(x.code)+'" data-name-ar="'+esc(x.name_ar)+'" data-name-en="'+esc(x.name_en||'')+'">'+esc(x.name_ar)+'</option>').join('');
   centerSelect.disabled=false;
 });
 document.getElementById('provider-onboarding-form')?.addEventListener('submit',async e=>{
   e.preventDefault();
   const btn=document.getElementById('po-submit'); if(btn){btn.disabled=true;btn.textContent='جارٍ إرسال الطلب...'}
   try{
     const split=(v,max=30)=>String(v||'').split(/[,،\n]/).map(x=>x.trim()).filter(Boolean).slice(0,max);
     const gov=document.getElementById('po-governorate');
     const center=document.getElementById('po-center');
     const go=gov?.selectedOptions?.[0];
     const ce=center?.selectedOptions?.[0];
     if(!go?.value||!ce?.value)throw new Error('يجب اختيار المحافظة والمركز');
     const serviceArea={governorate_id:go.value,governorate_code:go.dataset.code||'',governorate_name_ar:go.dataset.nameAr||go.textContent.trim(),governorate_name_en:go.dataset.nameEn||'',center_id:ce.value,center_code:ce.dataset.code||'',center_name_ar:ce.dataset.nameAr||ce.textContent.trim(),center_name_en:ce.dataset.nameEn||''};
     const data=await invokeMntyFunction('mnty-provider-onboarding-submit',{
       registration_request_id:pendingProvider.id,tenant_id:'MNTY-PLATFORM',organization_id:'MNTY-MAIN',
       business_name:document.getElementById('po-business-name')?.value||'',
       provider_kind:document.getElementById('po-kind')?.value||'',
       name_en:document.getElementById('po-name-en')?.value||null,
       description:document.getElementById('po-description')?.value||null,
       specialties:split(document.getElementById('po-specialties')?.value),
       service_areas:[serviceArea],
       portfolio:split(document.getElementById('po-portfolio')?.value,20)
     });
     showToast('تم إرسال بيانات النشاط للمراجعة. لن تُمنح صلاحيات تشغيلية قبل الاعتماد.','success');
     try{localStorage.removeItem('MNTYPendingActivityDraft');}catch(_){};
     await accountView();
   }catch(err){
     if(btn){btn.disabled=false;btn.textContent='إرسال بيانات النشاط للمراجعة'}
     showToast('تعذر إرسال بيانات النشاط: '+(err?.message||'خطأ غير معروف'),'error');
   }
 });
}
async function providerOnboardingView(){
  await accountView();
  const form=document.getElementById('provider-onboarding-form');
  if(form){
    form.scrollIntoView({behavior:'smooth',block:'start'});
    window.setTimeout(()=>document.getElementById('po-business-name')?.focus(),250);
  }
}
window.providerOnboardingView=providerOnboardingView;
function membershipRequiredView(){
window.MNTYAuthState={authenticated:true,email:user?.email||'',membership:false};
const app=document.getElementById('app');
if(!app)return;
app.innerHTML='<main class="auth"><section class="auth-card mnty-membership-state"><div class="brand">'+mark()+'<span>MantiqatiX</span></div><div class="gradient-line"></div><span class="eyebrow">ACCOUNT STATUS</span><h1>الحساب تم التحقق منه</h1><p>حسابك مسجل بنجاح، لكن لا توجد عضوية تشغيلية نشطة مرتبطة به حاليًا.</p><div class="mnty-screen-note">يمكنك العودة للواجهة العامة أو تسجيل الخروج. لا يتم منح صلاحيات تشغيلية تلقائيًا قبل ربط العضوية من المسار المعتمد.</div><div class="action-bar"><button class="btn btn-primary" id="membership-home">العودة للواجهة العامة</button><button class="btn btn-outline" id="membership-logout">تسجيل الخروج</button></div></section></main>';
document.getElementById('membership-home')?.addEventListener('click',()=>window.MXHomeLanding?window.MXHomeLanding():landingView());
document.getElementById('membership-logout')?.addEventListener('click',logout);
}
function showToast(message,type='success'){const old=document.getElementById('mx-toast');if(old)old.remove();const d=document.createElement('div');d.id='mx-toast';d.className='mx-toast '+type;d.textContent=message;document.body.appendChild(d);setTimeout(()=>d.remove(),4200)}
function notificationsWorkspace(){
 const rows=live.records.notifications||[];
 const unread=rows.filter(x=>!x.read_at).length;
 const sorted=[...rows].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
 const recent=sorted.slice(0,12);
 const unreadHtml=recent.filter(n=>!n.read_at).map(n=>'<article class="card mnty-notification-card"><div class="row"><div><span class="eyebrow">NEW</span><h3>'+esc(n.title||'إشعار')+'</h3></div><span class="mnty-badge mnty-badge--live">جديد</span></div><p>'+esc(n.body||n.message||'لا توجد تفاصيل إضافية.')+'</p><div class="row"><small>'+esc(n.created_at?new Date(n.created_at).toLocaleString('ar-EG'):'—')+'</small><button class="linkbtn" onclick="markNotificationRead(\''+esc(n.id)+'\')">تعليم كمقروء</button></div></article>').join('');
 const recentHtml=recent.map(n=>'<article class="card mnty-notification-card '+(n.read_at?'mnty-notification-card--read':'')+'"><div class="row"><div><span class="eyebrow">'+(n.read_at?'READ':'NOTIFICATION')+'</span><h3>'+esc(n.title||'إشعار')+'</h3></div><span class="mnty-badge">'+esc(n.read_at?'مقروء':'جديد')+'</span></div><p>'+esc(n.body||n.message||'لا توجد تفاصيل إضافية.')+'</p><small>'+esc(n.created_at?new Date(n.created_at).toLocaleString('ar-EG'):'—')+'</small></article>').join('');
 return workspaceHead('NOTIFICATIONS','مركز الإشعارات','الإشعارات مرتبطة بالحساب الحالي فقط، ولا تظهر أي بيانات غير مصرح بها.','LIVE')
 +workspaceCards([['إجمالي الإشعارات',rows.length,'السجلات المتاحة للحساب'],['غير مقروء',unread,'تحتاج انتباهًا'],['آخر تحديث',recent.length?new Date(recent[0].created_at||Date.now()).toLocaleDateString('ar-EG'):'—','آخر سجل متاح'],['حالة الجهاز',pushSupported()?'متاح':'غير متاح','إشعارات المتصفح حسب الدعم والصلاحية']])
 +'<div class="action-bar"><button class="btn btn-outline" style="width:auto" onclick="enableDevicePush()">🔔 إعداد إشعارات الجهاز</button></div>'
 +(unread?'<section class="mnty-notification-section"><div class="section-head"><div><span class="eyebrow">UNREAD</span><h3>تحتاج انتباهك</h3><p class="muted">الإشعارات غير المقروءة فقط.</p></div></div><div class="grid2">'+(unreadHtml||'<div class="empty-state">لا توجد إشعارات غير مقروءة.</div>')+'</div></section>':'')
 +'<section class="mnty-notification-section"><div class="section-head"><div><span class="eyebrow">RECENT</span><h3>آخر الإشعارات</h3><p class="muted">أحدث السجلات الفعلية المتاحة للحساب.</p></div></div><div class="grid2">'+(recentHtml||'<div class="empty-state">لا توجد إشعارات فعلية حاليًا.</div>')+'</div></section>'
 +recordsTable('سجل الإشعارات',rows,[['العنوان',r=>r.title||'—'],['الحالة',r=>r.read_at?'مقروء':'جديد'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleString('ar-EG'):'—']]);
}
function notificationCenter(){const rows=live.records.notifications||[];const unread=rows.filter(x=>!x.read_at);return '<section class="mnty-product-shell" style="margin-bottom:18px"><div class="mnty-product-head"><div><span class="eyebrow">NOTIFICATION CENTER</span><h2>مركز الإشعارات</h2><p>التحديثات من سجل الإشعارات الفعلي للحساب الحالي.</p></div><span class="mnty-badge mnty-badge--ui">'+unread.length+' جديد</span></div><div class="mnty-blueprint-grid">'+(rows.slice(0,12).map(n=>'<article class="mnty-blueprint-card"><div class="mnty-blueprint-icon">●</div><div class="mnty-blueprint-main"><div class="row"><h3>'+esc(n.title||'إشعار')+'</h3><span class="mnty-badge">'+(n.read_at?'مقروء':'جديد')+'</span></div><p>'+esc(n.body||n.message||'لا يوجد نص إضافي.')+'</p><small>'+esc(n.created_at?new Date(n.created_at).toLocaleString('ar-EG'):'—')+'</small></div></article>').join('')||'<div class="empty-state">لا توجد إشعارات فعلية حاليًا.</div>')+'</div></section>'}
function customerSupportWorkspace(){return workspaceHead('SUPPORT','الدعم','مساعدة العميل والتذاكر والإشعارات المرتبطة بحسابه فقط.','SUPPORT')+workspaceCards([['تذاكر الدعم',countOrDash('support'),'تذاكر حسابك وفق الصلاحيات'],['الإشعارات',countOrDash('notifications'),'إشعارات حسابك الفعلية'],['الدور','عميل','الصلاحيات الحالية للحساب']])+ '<div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="openSupportTicket()">+ فتح تذكرة دعم</button></div>'+recordsTable('تذاكر الدعم',live.records.supportTickets,[['الموضوع',r=>r.subject||'—'],['الحالة',r=>r.status||'—'],['الأولوية',r=>r.priority||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—']])+recordsTable('آخر الإشعارات',live.records.notifications,[['العنوان',r=>r.title||'—'],['الحالة',r=>r.read_at?'مقروء':'جديد'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—']])}
function attentionCenter(){
 const notes=Array.isArray(live.records.notifications)?live.records.notifications:[];
 const orders=Array.isArray(live.records.orders)?live.records.orders:[];
 const tickets=Array.isArray(live.records.supportTickets)?live.records.supportTickets:[];
 const leads=Array.isArray(live.records.leads)?live.records.leads:[];
 const unread=notes.filter(n=>!n.read_at);
 const activeOrders=orders.filter(o=>['PENDING','CREATED','CONFIRMED','PREPARING','OUT_FOR_DELIVERY'].includes(String(o.status||'').toUpperCase()));
 const openTickets=tickets.filter(t=>!['RESOLVED','CLOSED'].includes(String(t.status||'').toUpperCase()));
 const openLeads=leads.filter(l=>!['CLOSED','CONVERTED','REJECTED'].includes(String(l.status||'').toUpperCase()));
 const cards=[];
 unread.slice(0,4).forEach(n=>cards.push({type:'NOTIFICATION',title:n.title||'إشعار',desc:n.body||'تنبيه جديد',date:n.created_at,action:'markNotificationRead',id:n.id}));
 activeOrders.slice(0,3).forEach(o=>cards.push({type:'ORDER',title:'طلب '+String(o.id||'').slice(0,8),desc:'الحالة: '+orderStatusLabel(o.status),date:o.created_at,action:'openOrderDetails',id:o.id}));
 openTickets.slice(0,3).forEach(t=>cards.push({type:'SUPPORT',title:t.subject||'تذكرة دعم',desc:'الحالة: '+(t.status||'—')+' · الأولوية: '+(t.priority||'—'),date:t.updated_at||t.created_at,action:'openTicketDetails',id:t.id}));
 openLeads.slice(0,3).forEach(l=>cards.push({type:'LEAD',title:l.title||'طلب تسويقي',desc:'الحالة: '+(l.status||'—'),date:l.created_at,action:'openLeadDetails',id:l.id}));
 const html=cards.length?cards.map(x=>'<article class="card" style="padding:14px"><div class="row"><span class="eyebrow">'+esc(x.type)+'</span><small>'+esc(x.date?new Date(x.date).toLocaleString('ar-EG'):'—')+'</small></div><h3>'+esc(x.title)+'</h3><p>'+esc(x.desc)+'</p><button type="button" class="linkbtn mx-attention-action" data-action="'+esc(x.action)+'" data-id="'+esc(x.id)+'">فتح</button></article>').join(''):'<div class="empty-state">لا توجد عناصر تحتاج انتباهًا من السجلات الحالية.</div>';
 return '<section class="card" style="margin-top:16px;padding:18px"><div class="section-head"><div><span class="eyebrow">UNIFIED ATTENTION</span><h2>مركز الانتباه</h2><p>يجمع التنبيهات والعناصر التشغيلية من البيانات الفعلية. لا توجد مهام اصطناعية؛ نظام Tasks مستقل غير متاح حاليًا.</p></div><span class="count">'+cards.length+'</span></div><div class="grid2" style="margin-top:12px">'+html+'</div></section>';
}
function bindAttentionCenter(){
 document.querySelectorAll('.mx-governance-ticket').forEach(btn=>btn.addEventListener('click',()=>openTicketDetails(btn.dataset.ticketId)));
 document.querySelectorAll('.mx-governance-notification').forEach(btn=>btn.addEventListener('click',()=>markNotificationRead(btn.dataset.notificationId)));
 document.querySelectorAll('.mx-attention-action').forEach(btn=>btn.addEventListener('click',async()=>{
  const action=btn.dataset.action,id=btn.dataset.id;
  if(action==='markNotificationRead'){await markNotificationRead(id);return}
  if(action==='openOrderDetails'){openOrderDetails(id);return}
  if(action==='openTicketDetails'){openTicketDetails(id);return}
  if(action==='openLeadDetails'){openLeadDetails(id);}
 }));
}
function governanceWorkspace(){return workspaceHead('GOVERNANCE','الدعم والحوكمة','التذاكر، الرسائل، الإشعارات ومركز الانتباه في مساحة تشغيلية موحدة.','CONTROL')+workspaceCards([['تذاكر الدعم',countOrDash('support'),'بيانات فعلية وفق RLS'],['الإشعارات',countOrDash('notifications'),'إشعارات الحساب الفعلية'],['الصلاحيات',live.role,'الدور الفعلي من العضوية'],['مركز الانتباه','موحد','تنبيهات وعناصر تشغيلية فعلية'],['المراقبة','نشطة','مؤشرات الأخطاء والتشغيل'],['المهام','غير متاحة','لا يوجد Tasks مصدره الفعلي حاليًا']])+ '<div class="action-bar"><button class="btn btn-primary" style="width:auto" onclick="openSupportTicket()">+ فتح تذكرة دعم</button></div>'+attentionCenter()+recordsTable('تذاكر الدعم',live.records.supportTickets,[['الموضوع',r=>r.subject||'—'],['الحالة',r=>r.status||'—'],['الأولوية',r=>r.priority||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—'],['إجراء',r=>'<button type="button" class="linkbtn mx-governance-ticket" data-ticket-id="'+esc(r.id)+'">تفاصيل</button>']])+recordsTable('آخر الإشعارات',live.records.notifications,[['العنوان',r=>r.title||'—'],['الحالة',r=>r.read_at?'مقروء':'جديد'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleDateString('ar-EG'):'—'],['إجراء',r=>r.read_at?'—':'<button type="button" class="linkbtn mx-governance-notification" data-notification-id="'+esc(r.id)+'">تعليم كمقروء</button>']])}

async function reviewRegistration(requestId,decision){
 if(!user?.id||!requestId)return;
 const req=(live.records.registrationRequests||[]).find(x=>String(x.id)===String(requestId));
 if(decision==='APPROVED'&&String(req?.requested_role||'').toUpperCase()==='SERVICE_PROVIDER')return showToast('اعتماد مقدم الخدمة يتم من طلب تسجيل النشاط بعد استكمال بيانات النشاط.','error');
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
async function reviewProviderOnboarding(requestId,decision){
 if(!user?.id||!requestId)return;
 if(!['SUPER_ADMIN','ADMIN','OWNER','MANAGER'].includes(String(live.role||'').toUpperCase()))return showToast('لا تملك صلاحية مراجعة نشاطات مقدمي الخدمة.','error');
 const reason=decision==='REJECTED'?(window.prompt('سبب الرفض (اختياري):','')||null):null;
 const {data,error}=await sb.functions.invoke('mnty-provider-onboarding-review',{body:{onboarding_request_id:requestId,decision,rejection_reason:reason}});
 if(error)return showToast('تعذر تنفيذ المراجعة: '+(error.message||'خطأ غير معروف'),'error');
 if(data?.error)return showToast('تعذر تنفيذ المراجعة: '+data.error,'error');
 showToast(decision==='APPROVED'?'تم اعتماد النشاط وإنشاء النشاط التشغيلي والعضوية.':'تم رفض طلب النشاط.','success');
 await renderApp();
}
async function loadProviderOnboardingReview(){
 const host=document.getElementById('provider-onboarding-review-list')||document.getElementById('sa-provider-review-list');
 if(!host)return;
 const {data,error}=await sb.from('provider_onboarding_requests').select('id,user_id,registration_request_id,business_name,provider_kind,name_en,description,specialties,service_areas,portfolio,status,created_at,rejection_reason').order('created_at',{ascending:false}).limit(50);
 if(error){host.innerHTML='<div class="empty-state">تعذر تحميل طلبات تسجيل الأنشطة: '+esc(error.message)+'</div>';return}
 const rows=data||[];
 if(!rows.length){host.innerHTML='<div class="empty-state">لا توجد طلبات تسجيل نشاط فعلية حاليًا.</div>';return}
 host.innerHTML='<section class="records"><div class="section-head"><div><h3>طلبات تسجيل الأنشطة</h3><p class="muted">'+rows.length+' طلب معروض وفق صلاحيات الإدارة.</p></div></div><div class="table-wrap"><table><thead><tr><th>النشاط</th><th>القطاع</th><th>المستخدم</th><th>الحالة</th><th>التاريخ</th><th>إجراء</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><b>'+esc(r.business_name)+'</b>'+(r.name_en?'<br><small>'+esc(r.name_en)+'</small>':'')+'</td><td>'+esc(r.provider_kind)+'</td><td>'+esc(r.user_id)+'</td><td>'+esc(r.status==='PENDING'?'قيد المراجعة':r.status==='APPROVED'?'معتمد':r.status==='REJECTED'?'مرفوض':'ملغى')+'</td><td>'+esc(r.created_at?new Date(r.created_at).toLocaleString('ar-EG'):'—')+'</td><td>'+(r.status==='PENDING'?'<div class="mini-actions"><button data-po-approve="'+esc(r.id)+'">اعتماد</button><button data-po-reject="'+esc(r.id)+'">رفض</button></div>':'—')+'</td></tr>').join('')+'</tbody></table></div></section>';
 host.querySelectorAll('[data-po-approve]').forEach(b=>b.onclick=()=>reviewProviderOnboarding(b.dataset.poApprove,'APPROVED'));
 host.querySelectorAll('[data-po-reject]').forEach(b=>b.onclick=()=>reviewProviderOnboarding(b.dataset.poReject,'REJECTED'));
}
function registrationReviewWorkspace(){
 if(!['SUPER_ADMIN','ADMIN','OWNER','MANAGER'].includes(String(live.role||'').toUpperCase())){
   return workspaceHead('REGISTRATION','طلبات التسجيل','هذه المساحة مخصصة للإدارة المعتمدة.','RESTRICTED')+'<div class="empty-state">لا تملك صلاحية مراجعة طلبات التسجيل.</div>';
 }
 const rows=live.records.registrationRequests||[];
 const html=workspaceHead('REGISTRATION','طلبات التسجيل','اعتماد الحسابات والأنشطة يتم عبر سلطة الخادم مع إنشاء العضوية وتسجيل التدقيق.','ADMIN')
 +workspaceCards([['طلبات معلقة',rows.filter(r=>r.status==='PENDING').length,'طلبات تحتاج قرارًا إداريًا'],['معتمدة',rows.filter(r=>r.status==='APPROVED').length,'طلبات تم ربطها بعضوية'],['مرفوضة',rows.filter(r=>r.status==='REJECTED').length,'طلبات لم يتم اعتمادها']])
 +recordsTable('سجل التسجيلات',rows,[['الدور',r=>r.requested_role==='SERVICE_PROVIDER'?'مقدم خدمة':'عميل'],['الحالة',r=>r.status||'—'],['المستخدم',r=>r.user_id||'—'],['التاريخ',r=>r.created_at?new Date(r.created_at).toLocaleString('ar-EG'):'—'],['إجراء',r=>r.status==='PENDING'?'<div class="mini-actions"><button onclick="reviewRegistration(\''+esc(r.id)+'\',\'APPROVED\')">اعتماد</button><button onclick="reviewRegistration(\''+esc(r.id)+'\',\'REJECTED\')">رفض</button></div>':'—']])
 +'<div id="provider-onboarding-review-list" style="margin-top:18px"><div class="empty-state">جاري تحميل طلبات تسجيل الأنشطة…</div></div>';
 setTimeout(loadProviderOnboardingReview,0);
 return html;
}
function registrationPendingView(role='CUSTOMER',status='PENDING'){
const label=role==='SERVICE_PROVIDER'?'مقدم خدمة':'عميل';
document.getElementById('app').innerHTML='<main class="auth"><section class="auth-card"><div class="brand">'+mark()+'<span>MantiqatiX</span></div><div class="gradient-line"></div><h1>تم إنشاء حسابك</h1><p>تم التحقق من بريدك الإلكتروني بنجاح.</p><p>طلب التسجيل كـ <b>'+esc(label)+'</b> في حالة <b>'+esc(status)+'</b>.</p><p class="muted">لن يتم منح أي صلاحيات تشغيلية تلقائيًا. بعد اعتماد الطلب سيتم ربط العضوية والصلاحيات بالحساب وفق سياسة المنصة.</p><div class="action-bar"><button class="btn btn-outline" id="registration-logout">تسجيل الخروج</button></div></section></main>';
document.getElementById('registration-logout').onclick=logout;
}
async function submitRegistrationRequest(requestedRole=authRegistrationType){
 if(!user?.id)return;
 const role=String(requestedRole||'').toUpperCase();
 if(!['CUSTOMER','SERVICE_PROVIDER'].includes(role))return showToast('هذا الدور لا يُطلب ذاتيًا من الحساب.','error');

 if(role==='CUSTOMER'){
   const {data:{session},error:sessionError}=await sb.auth.getSession();
   if(sessionError||!session?.access_token)return showToast('جلسة الدخول غير صالحة. أعد التحقق من البريد ثم حاول مرة أخرى.','error');
   const {data,error}=await sb.functions.invoke('mnty-customer-registration',{
     body:{tenant_id:'MNTY-PLATFORM'}
   });
   if(error)return showToast('تعذر تفعيل حساب العميل: '+(error.message||'خطأ غير معروف'),'error');
   if(data?.error)return showToast('تعذر تفعيل حساب العميل: '+data.error,'error');
   try{localStorage.removeItem('MNTYPendingRegistration')}catch(_){}
   showToast('تم تفعيل حساب العميل ويمكنك الدخول مباشرة.','success');
   await renderApp();
   return;
 }

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
  .insert({user_id:user.id,requested_role:role,status:'PENDING',metadata:{source:'account_membership_request',brand:'MantiqatiX'}})
  .select('requested_role,status')
  .single();
 if(error){
  if(error.code==='23505')return showToast('يوجد طلب قيد المراجعة لهذا الدور بالفعل.','error');
  return showToast('تعذر إنشاء طلب العضوية: '+error.message,'error');
 }
 showToast('تم إرسال طلب العضوية الإضافية للمراجعة.','success');
 await accountView();
}
async function openPlatform(){if(!user?.id){return typeof authView==='function'?authView():null}return renderApp({forceWorkspace:true})}
async function enterAuthenticatedApp(authUser,options={}){
if(!authUser?.id)return;
const force=options?.force===true;
if(!force&&user?.id===authUser.id&&window.MNTYAuthState?.authenticated)return;
user=authUser;
window.MNTYAuthState={authenticated:true,email:authUser.email||'',membership:false};
if(authRenderLock)return;
authRenderLock=true;
try{
 await renderApp({forceWorkspace:force});
 let pending=null;
 try{pending=JSON.parse(localStorage.getItem('MNTYPendingRegistration')||'null')}catch(_){}
 if(pending&&['CUSTOMER','SERVICE_PROVIDER'].includes(String(pending.role||'').toUpperCase())&&(!pending.email||String(pending.email||'').toLowerCase()===String(authUser.email||'').toLowerCase())){
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
function bindGenericWorkspaceTabs(){
 const panels={overview:'<div class="mnty-tab-copy"><span class="eyebrow">OVERVIEW</span><h3>مساحة العمل جاهزة</h3><p>الهيكل البصري والعمليات الأساسية لهذه الوحدة محددة. البيانات الحية تُعرض فقط عند توفر مصدرها المصرح به.</p></div>',data:'<div class="mnty-tab-copy"><span class="eyebrow">DATA</span><h3>طبقة البيانات</h3><p>سيتم ربط الجداول وواجهات القراءة الفعلية هنا حسب نطاق الحساب والصلاحيات، دون إنشاء سجلات تجريبية.</p></div>',operations:'<div class="mnty-tab-copy"><span class="eyebrow">OPERATIONS</span><h3>العمليات</h3><p>أزرار التنفيذ تُضاف فقط للعمليات التي لها مسار خادم معتمد وصلاحية واضحة. لا يتم تشغيل إجراء غير متصل.</p></div>',reports:'<div class="mnty-tab-copy"><span class="eyebrow">REPORTS</span><h3>التقارير</h3><p>المؤشرات ستعتمد على بيانات تشغيلية حقيقية؛ لذلك تظل القيم غير المتاحة فارغة بدل عرض أرقام تقديرية.</p></div>',settings:'<div class="mnty-tab-copy"><span class="eyebrow">SETTINGS</span><h3>الإعدادات</h3><p>إعدادات الوحدة تظهر عند اكتمال مساراتها الخلفية والصلاحيات المرتبطة بها.</p></div>'};
 document.querySelectorAll('[data-workspace-tabs] button[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('[data-workspace-tabs] button[data-tab]').forEach(x=>{x.classList.toggle('active',x===btn);x.setAttribute('aria-selected',x===btn?'true':'false')});
  const panel=document.getElementById('mnty-generic-tab-panel');if(panel)panel.innerHTML=panels[btn.dataset.tab]||panels.overview;
 }));
}
function platformStateView(kind,title,description,actions=''){
 const icon=kind==='error'?'⚠️':kind==='empty'?'◌':'⏳';
 return '<main class="auth"><section class="auth-card mnty-state-card mnty-state-card--'+esc(kind)+'"><div class="mnty-state-icon" aria-hidden="true">'+icon+'</div><div class="brand">'+mark()+'<span>MantiqatiX</span></div><div class="gradient-line"></div><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p><div class="mnty-state-actions">'+actions+'</div></section></main>';
}
function showAppLoading(){const el=document.getElementById('app');if(el)el.innerHTML=platformStateView('loading','جاري تحميل المنصة','يتم التحقق من الجلسة وتحميل بيانات حسابك وصلاحياتك...');}
function showAppError(message){const el=document.getElementById('app');if(!el)return;el.innerHTML=platformStateView('error','تعذر تحميل البيانات',message,'<button class="btn btn-primary" id="retry-load">إعادة المحاولة</button><button class="text-btn" id="logout-load">خروج</button>');document.getElementById('retry-load')?.addEventListener('click',()=>renderApp());document.getElementById('logout-load')?.addEventListener('click',logout);}
async 
function bindRoleAfterRender(){bindRoleCommandCenter();}
async function renderApp(options={}){if(!user?.id)return;live.loading=true;showAppLoading();await loadLiveData();if(live.error){showAppError(live.error);return}if(!live.memberships.length){membershipRequiredView();return}window.MNTYAuthState={authenticated:true,email:user?.email||'',membership:true,role:live.role};
let restoreAdminWorkspace=options.forceWorkspace===true;
try{
 const savedWorkspace=localStorage.getItem('MNTYWorkspaceMode');
 const savedCurrent=localStorage.getItem('MNTYWorkspaceCurrent');
 const privileged=live.memberships.some(m=>m.status==='ACTIVE'&&['SUPER_ADMIN','OWNER','ADMIN','MANAGER'].includes(String(m.role||'').toUpperCase()));
 if(savedWorkspace==='ADMIN'&&privileged){
   restoreAdminWorkspace=true;
   if(modules.some(m=>m[1]===savedCurrent)&&savedCurrent)current=savedCurrent;
 }else if(savedWorkspace==='ADMIN'&&!privileged){
   localStorage.removeItem('MNTYWorkspaceMode');
   localStorage.removeItem('MNTYWorkspaceCurrent');
 }
}catch(_){}
if(!restoreAdminWorkspace){const privileged=live.memberships.find(m=>m.status==='ACTIVE'&&String(m.role||'').toUpperCase()==='OWNER')||live.memberships.find(m=>m.status==='ACTIVE'&&String(m.role||'').toUpperCase()==='SUPER_ADMIN')||live.memberships.find(m=>m.status==='ACTIVE'&&['ADMIN','MANAGER'].includes(String(m.role||'').toUpperCase()));if(privileged){window.MNTYAdminReturnMembershipId=privileged.id;localStorage.setItem('MNTYAdminReturnMembershipId',privileged.id);}else{window.MNTYAdminReturnMembershipId=null;localStorage.removeItem('MNTYAdminReturnMembershipId');}if(typeof window.MXHomeLanding==='function'){window.MXHomeLanding();return}if(typeof window.landingView==='function'){window.landingView();return}}await loadDomainModule(current);document.getElementById('app').innerHTML=`<div class="shell"><aside class="sidebar" aria-label="التنقل الرئيسي"><div class="side-brand"><div class="brand">${mark()}<span>MantiqatiX</span></div><div class="gradient-line"></div></div><div class="side-caption">منصة التسويق والربط</div><nav class="nav" aria-label="وحدات المنصة">${modules.filter(m=>(m[1]!=='التحكم الكامل'||String(live.role||'').toUpperCase()==='SUPER_ADMIN')&&moduleEnabled(m[1])&&(!isCustomerMode()||['الرئيسية','المجالات والخدمات','التجارة والأزياء','البقالة والسوبر ماركت','المطاعم والمطابخ','المنظومة الطبية','الصيانة','الخدمات المهنية','MantiGO والمزايدات','الزواج','الوظائف','التعليم','المستعمل','الطلبات والعمليات','الدعم والحوكمة'].includes(m[1]))&&(m[1]!=='طلبات التسجيل'||['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase()))).map(m=>`<button class="${m[1]===current?'active':''}" aria-current="${m[1]===current?'page':'false'}" onclick="selectModule('${m[1]}')"><span aria-hidden="true">${m[0]}</span><span>${isCustomerMode()&&m[1]==='الدعم والحوكمة'?'الدعم':m[1]}</span></button>`).join('')}</nav><div class="side-support">خدمة العملاء<br><b>01010171770</b></div></aside><main class="content" id="mnty-main-content"><header class="top" aria-label="رأس مساحة العمل"><div><div class="breadcrumb">MNTY / ${current}</div><h1>${current}</h1><div class="user" id="user">${esc(user?.email||'')} · ${esc(live.role)}</div></div><div class="top-actions">${roleSwitcher()}${pushButtonHtml()}${live.myProviderProfile?'<button class="btn btn-outline" id="manage-provider-profile" style="width:auto">🖼️ صورة نشاطي</button>':''}<div class="mx-global-search-wrap"><label class="search" for="mx-global-search-input">⌕ <input id="mx-global-search-input" value="${esc(query)}" autocomplete="off" placeholder="ابحث عن نشاط، مقدم خدمة، طلب، خدمة، إعلان..."></label><div id="mx-global-search-results" class="mx-global-search-results" role="listbox" aria-label="نتائج البحث"></div></div><button class="btn btn-outline" id="go-public-home">الرئيسية</button><button class="btn btn-outline" id="account-open"><span class="mx-account-icon" aria-hidden="true">♙</span><span>حسابي</span></button><button class="logout" id="logout">خروج</button></div></header><div id="page">${enhancedPageContent()}</div></main></div>`;document.getElementById('logout').onclick=logout;
 if(current==='التحكم الكامل')setTimeout(initSuperAdminControlWorkspace,0);bindRoleCommandCenter();bindAttentionCenter();if(window.MNTYBindModuleBlueprint)setTimeout(window.MNTYBindModuleBlueprint,0);bindGenericWorkspaceTabs();document.getElementById('go-public-home')?.addEventListener('click',openContextualHome);document.getElementById('account-open')?.addEventListener('click',accountView);document.getElementById('device-push-toggle')?.addEventListener('click',enableDevicePush);pushButtonState();const roleSwitch=document.getElementById('mx-role-switcher');if(roleSwitch)roleSwitch.onchange=e=>switchMembership(e.target.value);const profileBtn=document.getElementById('manage-provider-profile');if(profileBtn)profileBtn.onclick=()=>selectModule('ملف نشاطي');const providerSave=document.getElementById('provider-image-save');if(providerSave)providerSave.onclick=saveProviderProfileImage;const providerLogoSave=document.getElementById('provider-logo-save');if(providerLogoSave)providerLogoSave.onclick=saveProviderLogo;const providerLogoReset=document.getElementById('provider-logo-reset');if(providerLogoReset)providerLogoReset.onclick=resetProviderLogo;const providerFile=document.getElementById('provider-image-file');const providerPreview=document.getElementById('provider-image-preview');if(providerFile&&providerPreview)providerFile.onchange=()=>{const file=providerFile.files?.[0];if(!file){providerPreview.textContent='اختر صورة لمعاينتها قبل الحفظ.';return}if(!/^image\/(jpeg|png|webp)$/.test(file.type)){providerPreview.textContent='صيغة غير مدعومة. استخدم JPG أو PNG أو WebP.';return}if(file.size>5*1024*1024){providerPreview.textContent='الصورة أكبر من 5MB.';return}const url=URL.createObjectURL(file);providerPreview.innerHTML='<img src="'+esc(url)+'" alt="معاينة صورة النشاط">';providerPreview.querySelector('img')?.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true})};const si=document.getElementById('search');if(si)si.oninput=e=>{query=e.target.value;document.getElementById('page').innerHTML=enhancedPageContent()};
 const gsi=document.getElementById('mx-global-search-input'),gso=document.getElementById('mx-global-search-results');let globalSearchTimer=null,globalSearchSeq=0;
 const runGlobalSearch=async()=>{const value=String(gsi?.value||'').trim();if(!gso)return;if(value.length<2){gso.innerHTML='';gso.classList.remove('is-open');return}const seq=++globalSearchSeq;gso.innerHTML='<div class="mx-global-search-loading">جاري البحث في البيانات المتاحة…</div>';gso.classList.add('is-open');const results=await globalSearch(value);if(seq!==globalSearchSeq)return;gso.innerHTML=globalSearchResultHtml(results);gso.querySelectorAll('[data-search-index]').forEach(el=>el.addEventListener('click',()=>{const hit=results[Number(el.dataset.searchIndex)];if(hit?.source?.route)selectModule(hit.source.route);gso.classList.remove('is-open')}))};
 gsi?.addEventListener('input',()=>{clearTimeout(globalSearchTimer);globalSearchTimer=setTimeout(runGlobalSearch,280)});
 gsi?.addEventListener('keydown',e=>{if(e.key==='Escape'){gsi.value='';gso.innerHTML='';gso.classList.remove('is-open')}if(e.key==='Enter'){e.preventDefault();runGlobalSearch()}});
 document.addEventListener('click',e=>{if(!e.target.closest('.mx-global-search-wrap'))gso?.classList.remove('is-open')},{once:true});}
sb.auth.onAuthStateChange((event,session)=>{
if(event==='SIGNED_OUT'){
user=null;window.MNTYAuthState={authenticated:false,email:'',membership:false};window.MNTYActiveMembershipId=null;live.memberships=[];live.activeMembershipId=null;live.role='CUSTOMER';live.businessId=null;live.tenantId=null;live.organizationId=null;live.branchId=null;live.permissions={};current='الرئيسية';query='';
window.MXHomeLanding?MXHomeLanding():landingView();return;
}
if(session?.user&&!authRenderLock)enterAuthenticatedApp(session.user);
});
window.MNTYBootAuth=bootAuth;
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',bootAuth,{once:true});else bootAuth();