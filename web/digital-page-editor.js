const cfg=window.MANTIQATIX_CONFIG;const sb=supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});let session=null,currentPage=null,owners=[],paidOrders=[],menuSourceItems=[],menuSourceBusinessId=null;const $=id=>document.getElementById(id);const status=m=>{$('status').textContent=m||''};async function requireSession(){const r=await sb.auth.getSession();if(r.error)throw r.error;session=r.data.session;if(!session){$('auth').textContent='يجب تسجيل الدخول أولًا.';return false}$('auth').textContent='تم التحقق من الجلسة: '+(session.user.email||session.user.id);$('editor').hidden=false;return true}async function loadOwners(){const uid=session.user.id;const [m,p]=await Promise.all([sb.from('user_memberships').select('business_id,role,status').eq('user_id',uid).eq('status','ACTIVE'),sb.from('marketing_provider_profiles').select('id,name_ar,name_en,slug').eq('owner_user_id',uid)]);if(m.error)throw m.error;if(p.error)throw p.error;owners=[];(m.data||[]).filter(x=>x.business_id).forEach(x=>owners.push({kind:'BUSINESS',id:x.business_id,label:'Business '+x.business_id}));(p.data||[]).forEach(x=>owners.push({kind:'PROVIDER',id:x.id,label:x.name_ar||x.name_en||x.slug||x.id}));$('owner').replaceChildren(...owners.map(o=>{const e=document.createElement('option');e.value=o.kind+':'+o.id;e.textContent=o.label;return e}));}async function loadOrders(){const r=await sb.from('digital_page_orders').select('id,page_type,title,amount,currency,payment_status,fulfillment_status').eq('user_id',session.user.id).eq('payment_status','PAID').in('fulfillment_status',['REQUESTED','IN_REVIEW','IN_PROGRESS']).order('created_at',{ascending:false});if(r.error)throw r.error;paidOrders=r.data||[];$('orderId').replaceChildren(new Option('اختر طلبًا مدفوعًا عند النشر',''),...paidOrders.map(o=>new Option(o.title+' · '+o.page_type+' · '+Number(o.amount).toLocaleString('ar-EG')+' '+o.currency,o.id)));}async function loadPages(){const r=await sb.from('digital_pages').select('id,page_type,business_id,provider_profile_id,slug,title,status,version,updated_at').order('updated_at',{ascending:false});if(r.error)throw r.error;$('pages').replaceChildren(...(r.data||[]).map(p=>{const e=document.createElement('div');e.className='page-row';e.innerHTML='<strong></strong><div class="muted"></div><button type="button">فتح</button>';e.querySelector('strong').textContent=p.title+' · '+p.page_type;e.querySelector('.muted').textContent=p.slug+' · '+p.status+' · v'+p.version;e.querySelector('button').onclick=()=>selectPage(p);return e}));}function fill(p){currentPage=p;$('pageType').value=p.page_type;$('orderId').value=p.digital_page_order_id||'';$('title').value=p.title;$('slug').value=p.slug;$('description').value=p.description||'';$('seoTitle').value=p.seo_title||'';$('seoDescription').value=p.seo_description||'';const kind=p.business_id?'BUSINESS':'PROVIDER';$('owner').value=kind+':'+(p.business_id||p.provider_profile_id);loadSections()}async function selectPage(p){fill(p)}async function savePage(publish=false){const raw=$('owner').value;if(!raw)throw new Error('OWNER_REQUIRED');const [kind,id]=raw.split(':');const payload={page_type:$('pageType').value,title:$('title').value.trim(),slug:$('slug').value.trim(),description:$('description').value.trim()||null,seo_title:$('seoTitle').value.trim()||null,seo_description:$('seoDescription').value.trim()||null,status:'DRAFT',updated_by:session.user.id,...(kind==='BUSINESS'?{business_id:id,provider_profile_id:null}:{provider_profile_id:id,business_id:null})};if(publish){const orderId=$('orderId').value;if(!orderId)throw new Error('PAID_ORDER_REQUIRED');if(!currentPage)throw new Error('SAVE_DRAFT_BEFORE_PUBLISH');const pr=await sb.rpc('fulfill_digital_page_publish',{p_actor_user_id:session.user.id,p_order_id:orderId,p_page_id:currentPage.id});if(pr.error)throw pr.error;status('تم نشر الصفحة بعد اعتماد الـFulfillment والدفع.');await loadPages();await loadSections();return}let r;if(currentPage)r=await sb.from('digital_pages').update(payload).eq('id',currentPage.id).select().single();else r=await sb.from('digital_pages').insert({...payload,created_by:session.user.id}).select().single();if(r.error)throw r.error;currentPage=r.data;status(publish?'تم نشر الصفحة.':'تم حفظ المسودة.');await loadPages();await loadSections()}async function loadMenuSyncSources(){
 const controls=$('menuSyncControls'),branchSelect=$('menuSourceBranch'),button=$('syncMenuItems'),help=$('menuSyncHelp');
 if(!controls||!branchSelect||!button||!help)return;
 const isMenu=$('pageType').value==='MENU';
 controls.hidden=!isMenu;button.disabled=true;menuSourceItems=[];menuSourceBusinessId=null;
 if(!isMenu)return;
 if(!currentPage){branchSelect.replaceChildren(new Option('احفظ الصفحة أولًا',''));help.textContent='احفظ مسودة من نوع MENU أولًا، ثم اختر فرع القائمة الفعلي.';return;}
 if(currentPage.page_type!=='MENU'){branchSelect.replaceChildren(new Option('احفظ تغييرات النوع أولًا',''));help.textContent='نوع الصفحة المحفوظ ليس MENU. احفظ تغييرات الصفحة أولًا قبل المزامنة.';return;}
 try{
  let businessId=currentPage.business_id||null;
  if(!businessId&&currentPage.provider_profile_id){
   const profile=await sb.from('marketing_provider_profiles').select('business_id').eq('id',currentPage.provider_profile_id).eq('owner_user_id',session.user.id).maybeSingle();
   if(profile.error)throw profile.error;
   businessId=profile.data?.business_id||null;
  }
  if(!businessId){branchSelect.replaceChildren(new Option('لا يوجد نشاط مرتبط',''));help.textContent='لا يمكن مزامنة قائمة مطعم دون نشاط business_id مرتبط ومصرح به.';return;}
  menuSourceBusinessId=businessId;
  const result=await sb.from('restaurant_menu_items').select('id,tenant_id,business_id,branch_id,name_ar,description_ar,base_price_egp,category,is_available,is_popular,updated_at').eq('business_id',businessId).eq('is_available',true).order('category').order('name_ar').limit(500);
  if(result.error)throw result.error;
  menuSourceItems=result.data||[];
  const branchKeys=[...new Set(menuSourceItems.map(item=>item.branch_id?String(item.branch_id):'__NULL__'))];
  branchSelect.replaceChildren(new Option('اختر الفرع',''));
  branchKeys.forEach(key=>branchSelect.add(new Option(key==='__NULL__'?'أصناف دون فرع محدد':'الفرع '+key,key)));
  if(branchKeys.length===1)branchSelect.value=branchKeys[0];
  button.disabled=menuSourceItems.length===0||branchKeys.length===0;
  help.textContent=menuSourceItems.length
   ? 'تم تحميل '+menuSourceItems.length+' صنفًا متاحًا من قاعدة البيانات ضمن النشاط. اختر فرعًا محددًا؛ المزامنة تحفظ الأسعار المسجلة ولا تنشر الصفحة تلقائيًا.'
   : 'لا توجد أصناف متاحة فعلية لهذا النشاط. لم يتم إنشاء أي بيانات تجريبية.';
 }catch(error){
  menuSourceItems=[];branchSelect.replaceChildren(new Option('تعذر تحميل الفروع',''));help.textContent='تعذر تحميل القائمة ضمن الصلاحيات الحالية: '+(error?.message||'MENU_SOURCE_LOAD_FAILED');button.disabled=true;
 }
}
async function loadSections(){if(!currentPage){$('sections').textContent='احفظ الصفحة أولًا.';return}const r=await sb.from('digital_page_sections').select('id,section_type,sort_order,title,content,data,active').eq('page_id',currentPage.id).order('sort_order').order('id');if(r.error)throw r.error;$('sections').replaceChildren(...(r.data||[]).map(s=>{const e=document.createElement('div');e.className='section-row';const text=document.createElement('span');text.textContent=s.sort_order+' · '+s.section_type+' · '+(s.title||'بدون عنوان');const del=document.createElement('button');del.textContent='حذف';del.type='button';del.onclick=async()=>{const x=await sb.from('digital_page_sections').delete().eq('id',s.id);if(x.error)return status(x.error.message);await loadSections()};e.append(text,del);return e}));await loadMenuSyncSources()}$('syncMenuItems').onclick=async()=>{
 try{
  if(!currentPage||currentPage.page_type!=='MENU'||$('pageType').value!=='MENU')throw new Error('SAVE_MENU_DRAFT_FIRST');
  if(!menuSourceBusinessId)throw new Error('MENU_BUSINESS_REQUIRED');
  const branchId=$('menuSourceBranch').value;
  if(!branchId)throw new Error('MENU_BRANCH_REQUIRED');
  const items=menuSourceItems.filter(item=>(branchId==='__NULL__'?!item.branch_id:String(item.branch_id)===branchId));
  if(!items.length)throw new Error('NO_MENU_ITEMS_FOR_BRANCH');
  if(items.some(item=>!item.name_ar||!Number.isFinite(Number(item.base_price_egp))||Number(item.base_price_egp)<0))throw new Error('INVALID_MENU_SOURCE_DATA');
  const existing=await sb.from('digital_page_sections').select('id,sort_order').eq('page_id',currentPage.id).eq('section_type','MENU').order('sort_order').limit(3);
  if(existing.error)throw existing.error;
  if((existing.data||[]).length>1)throw new Error('DUPLICATE_MENU_SECTIONS_REQUIRE_MANUAL_REVIEW');
  const data={source:'restaurant_menu_items',business_id:menuSourceBusinessId,branch_id:branchId==='__NULL__'?null:branchId,synced_at:new Date().toISOString(),items:items.map(item=>({source_item_id:item.id,name:item.name_ar,description:item.description_ar||'',price:Number(item.base_price_egp),currency:'EGP',category:item.category||'',popular:Boolean(item.is_popular)}))};
  let result;
  if(existing.data?.length){
   result=await sb.from('digital_page_sections').update({title:'قائمة الطعام',content:'مزامنة من أصناف المطعم المتاحة',data,active:true}).eq('id',existing.data[0].id).eq('page_id',currentPage.id).select('id').single();
  }else{
   const count=await sb.from('digital_page_sections').select('id',{count:'exact',head:true}).eq('page_id',currentPage.id);
   if(count.error)throw count.error;
   result=await sb.from('digital_page_sections').insert({page_id:currentPage.id,section_type:'MENU',title:'قائمة الطعام',content:'مزامنة من أصناف المطعم المتاحة',data,sort_order:count.count||0,active:true}).select('id').single();
  }
  if(result.error)throw result.error;
  status('تمت مزامنة '+items.length+' صنفًا من الفرع المحدد. الصفحة لم تُنشر تلقائيًا.');
  await loadSections();
 }catch(error){status('لم تتم المزامنة: '+(error?.message||'MENU_SYNC_FAILED'))}
};
$('pageType').onchange=()=>{loadMenuSyncSources()};
$('pageForm').onsubmit=async e=>{e.preventDefault();try{await savePage(false)}catch(x){status(x.message||'تعذر الحفظ')}};$('publish').onclick=async()=>{try{await savePage(true)}catch(x){status(x.message||'تعذر النشر')}};$('unpublish').onclick=async()=>{if(!currentPage)return;const r=await sb.from('digital_pages').update({status:'DRAFT',updated_by:session.user.id}).eq('id',currentPage.id);status(r.error?r.error.message:'تم إلغاء النشر.');await loadPages();await loadSections()}};$('sectionForm').onsubmit=async e=>{e.preventDefault();try{if(!currentPage)throw new Error('احفظ الصفحة أولًا');const data=JSON.parse($('sectionData').value||'{}');const count=await sb.from('digital_page_sections').select('id',{count:'exact',head:true}).eq('page_id',currentPage.id);const r=await sb.from('digital_page_sections').insert({page_id:currentPage.id,section_type:$('sectionType').value,title:$('sectionTitle').value.trim()||null,content:$('sectionContent').value.trim()||null,data,sort_order:count.count||0,active:true});if(r.error)throw r.error;status('تمت إضافة القسم.');$('sectionContent').value='';$('sectionTitle').value='';$('sectionData').value='{}';await loadSections()}catch(x){status(x.message||'تعذر إضافة القسم')}};(async()=>{try{if(await requireSession()){await loadOwners();await loadOrders();await loadPages()}}catch(e){status(e.message||'INIT_FAILED')}})();