(function(){
'use strict';
const cfg=window.MANTIQATIX_CONFIG;
if(!cfg||!window.supabase)return;
const sb=window.MNTY_SB || window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey); window.MNTY_SB=sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2})+' ج.م';
const uid=()=>crypto.randomUUID();
function notify(message,type='info'){
 const old=document.querySelector('.mnty-inline-toast'); if(old)old.remove();
 const el=document.createElement('div'); el.className='mnty-inline-toast '+(type==='error'?'is-error':'is-success');
 el.setAttribute('role','status'); el.setAttribute('aria-live','polite'); el.textContent=String(message||'');
 document.body.appendChild(el);
 requestAnimationFrame(()=>el.classList.add('is-visible'));
 setTimeout(()=>{el.classList.remove('is-visible');setTimeout(()=>el.remove(),220)},4200);
}

let state={user:null,membership:null,membershipOptions:[],selectionRequired:false,tab:'dashboard',menu:[],orders:[],tables:[],inventory:[],reservations:[],loading:false,refreshing:false,lastLoadedAt:null,menuSearch:'',menuCategoryFilter:'ALL',menuAvailabilityFilter:'ALL',orderSearch:'',orderStatusFilter:'ALL',orderFromDate:'',orderToDate:'',reservationSearch:'',reservationStatusFilter:'ALL',reservationFromDate:'',reservationToDate:'',error:null,staleMembershipSelection:false};

async function session(){
 const {data,error}=await sb.auth.getSession();
 if(error||!data?.session?.user)return null;
 return data.session.user;
}
async function membership(user){
 const saved=localStorage.getItem('MNTYActiveMembershipId');
 const base=()=>sb.from('user_memberships').select('id,tenant_id,business_id,branch_id,role,status,permissions').eq('user_id',user.id).eq('status','ACTIVE');
 // An explicit selection must resolve exactly; never silently switch tenant after failure.
 if(saved){
   const selected=await base().eq('id',saved).maybeSingle();
   return {membership:selected.data||null,options:[],stale:!selected.data,error:selected.error||null};
 }
 // When more than one active membership exists, require an explicit user choice.
 const options=[];
 const pageSize=100;
 const maxMemberships=500;
 for(let from=0;from<maxMemberships;from+=pageSize){
   const r=await base().order('id').range(from,from+pageSize-1);
   if(r.error)return {membership:null,options:[],needsSelection:false,stale:false,error:r.error};
   options.push(...(r.data||[]));
   if(!r.data||r.data.length<pageSize)break;
 }
 if(options.length>=maxMemberships)return {membership:null,options:[],needsSelection:false,stale:false,error:new Error('Membership selection exceeds the supported safety limit')};
 return {membership:options.length===1?options[0]:null,options,needsSelection:options.length>1,stale:false,error:null};
}
function canOperate(module='CATALOG',action='update'){
 const role=String(state.membership?.role||'').toUpperCase();
 return window.MNTY_RBAC?.can(role,module,action,state.membership?.permissions)===true;
}
function scope(){
 const m=state.membership;
 return m?.tenant_id&&m?.business_id&&m?.branch_id?{tenant_id:m.tenant_id,business_id:m.business_id,branch_id:m.branch_id}:null;
}
async function load(){
 try{
 state.user=await session();
 if(!state.user){state.error='انتهت الجلسة أو لم يتم تسجيل الدخول. سجل الدخول ثم أعد المحاولة.';return render();}
 const result=await membership(state.user);
 state.membershipOptions=result.options||[];state.selectionRequired=result.needsSelection===true;
 if(result.error){state.error='تعذر التحقق من العضويات النشطة. حاول مرة أخرى.';return render();}
 state.membership=result.membership;
 if(!state.membership){state.staleMembershipSelection=result.stale===true;state.error=state.selectionRequired?null:(state.staleMembershipSelection?'العضوية المحفوظة لم تعد متاحة. امسح الاختيار المحفوظ لإعادة اختيار عضوية نشطة.':'لا توجد عضوية تشغيلية نشطة.');return render();}
 state.staleMembershipSelection=false;state.selectionRequired=false;
 const selectedScope=scope();
 if(!selectedScope){state.membership=null;state.error='بيانات نطاق المؤسسة أو النشاط أو الفرع غير مكتملة. تواصل مع مسؤول النظام لتصحيح العضوية.';state.loading=false;return render();}
 }catch(e){state.error='تعذر التحقق من جلسة المستخدم أو عضوياته. حاول إعادة تحميل الصفحة.';state.loading=false;return render();}
 state.error=null; state.loading=true; render();
 const s=scope();
 let menuQ=sb.from('restaurant_menu_items').select('id,owner_user_id,name_ar,description_ar,base_price_egp,original_price_egp,category,is_available,is_popular,created_at,updated_at').order('category').order('name_ar').limit(200);
 let ordersQ=sb.from('orders').select('id,tenant_id,business_id,branch_id,customer_id,status,subtotal,discount,tax,delivery_fee,total_amount,total,currency,customer_name,customer_phone,delivery_address,items_json,notes,created_at,updated_at').order('created_at',{ascending:false}).limit(100);
 let tablesQ=sb.from('restaurant_tables').select('id,owner_user_id,table_number,capacity_persons,status,current_active_order_id,current_bill_egp,reserved_customer_name').order('table_number').limit(100);
 let invQ=sb.from('restaurant_inventory').select('id,owner_user_id,name_ar,unit,current_stock_qty,min_stock_alert_threshold,unit_cost_egp,supplier_name,updated_at').order('name_ar').limit(200);
  let reservationsQ=sb.from('restaurant_reservations').select('id,table_id,customer_name,customer_phone,guest_count,starts_at,ends_at,status,notes,created_at').order('starts_at',{ascending:false}).limit(100);
 if(s&&canOperate('CATALOG','view')){
   menuQ=menuQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id);
 }else{
   // Limited catalog reads remain pinned to the selected tenant, business and branch.
   menuQ=menuQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id).eq('is_available',true);
 }
 if(s&&canOperate('ORDERS','view')){
   ordersQ=ordersQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id);
 }else{
   ordersQ=ordersQ.eq('customer_id',state.user.id);
 }
 if(s&&canOperate('OPERATIONS','view')){
   tablesQ=tablesQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id);
   invQ=invQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id);
   reservationsQ=reservationsQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id);
 }else{
   // Tables and inventory are operational records, not personal fallback data.
   // If the active role cannot view OPERATIONS, do not query either table.
   tablesQ=Promise.resolve({data:[],error:null});
   invQ=Promise.resolve({data:[],error:null});
   reservationsQ=Promise.resolve({data:[],error:null});
 }
 try{
  const [a,b,c,d,e]=await Promise.all([menuQ,ordersQ,tablesQ,invQ,reservationsQ]);
  state.menu=a.data||[];state.orders=b.data||[];state.tables=c.data||[];state.inventory=d.data||[];state.reservations=e.data||[];
  const errs=[a,b,c,d,e].filter(x=>x.error);
  // Do not expose raw database/provider errors in the user interface.
  state.error=errs.length?'تعذر تحميل بعض بيانات المطعم. تحقق من الاتصال والصلاحيات ثم أعد المحاولة.':null;
  if(!errs.length)state.lastLoadedAt=new Date().toISOString();
 }catch(e){
  state.error='حدث خطأ أثناء تحميل بيانات المطعم. حاول مرة أخرى.';
 }finally{state.loading=false;render();}
}
function shell(title,body){
 return '<section class="workspace-section"><div class="workspace-head"><div><div class="eyebrow">RESTAURANTS</div><h2>'+title+'</h2><p class="muted">إدارة المطعم والقائمة والطلبات والطاولات والمخزون من بيانات Supabase الفعلية فقط.</p></div></div>'+body+'</section>';
}
function cards(){
 const low=state.inventory.filter(x=>Number(x.current_stock_qty)<=Number(x.min_stock_alert_threshold)).length;
 const statuses=['CONFIRMED','PREPARING','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];
 return '<div class="cards">'+
 '<article class="card"><div class="card-title">🍽️ عناصر القائمة</div><div class="metric">'+state.menu.length+'</div><div class="muted">السجلات المتاحة ضمن نطاق العرض</div></article>'+
 '<article class="card"><div class="card-title">🧾 الطلبات</div><div class="metric">'+state.orders.length+'</div><div class="muted">آخر 100 طلب</div></article>'+
 '<article class="card"><div class="card-title">🪑 الطاولات</div><div class="metric">'+state.tables.length+'</div><div class="muted">حالة الطاولات الحالية</div></article>'+
 '<article class="card"><div class="card-title">📦 المخزون</div><div class="metric">'+state.inventory.length+'</div><div class="muted">'+low+' أصناف عند حد التنبيه</div></article>'+
 '</div>';
}
function tabs(){
 return '<div class="action-bar" style="gap:8px;flex-wrap:wrap">'+['dashboard','menu','orders','kitchen','tables','inventory','reservations'].map(x=>{
 const n={dashboard:'نظرة عامة',menu:'القائمة',orders:'الطلبات',kitchen:'شاشة المطبخ',tables:'الطاولات',inventory:'المخزون',reservations:'الحجوزات'}[x];
 return '<button class="btn '+(state.tab===x?'btn-primary':'btn-outline')+'" data-rest-tab="'+x+'">'+n+'</button>';
 }).join('')+'</div>';
}
function menuView(){
 const add=canOperate('CATALOG','create')?'<button class="btn btn-primary" id="rest-add-menu">+ إضافة صنف</button>':'';
 const term=String(state.menuSearch||'').trim().toLocaleLowerCase();
 const categories=[...new Set(state.menu.map(x=>String(x.category||'غير مصنف')))].sort();
 const filtered=state.menu.filter(x=>{
  const text=[x.name_ar,x.description_ar,x.category].map(v=>String(v||'')).join(' ').toLocaleLowerCase();
  const available=x.is_available===true?'AVAILABLE':'UNAVAILABLE';
  return (!term||text.includes(term))&&(state.menuCategoryFilter==='ALL'||String(x.category||'غير مصنف')===state.menuCategoryFilter)&&(state.menuAvailabilityFilter==='ALL'||available===state.menuAvailabilityFilter);
 });
 const controls='<div class="action-bar" style="gap:8px;flex-wrap:wrap"><label class="field"><span>بحث عن صنف أو وصف</span><input id="rest-menu-search" type="search" maxlength="120" value="'+esc(state.menuSearch)+'" placeholder="اسم الصنف أو الوصف"></label><label class="field"><span>الفئة</span><select id="rest-menu-category-filter"><option value="ALL" '+(state.menuCategoryFilter==='ALL'?'selected':'')+'>كل الفئات</option>'+categories.map(cat=>'<option value="'+esc(cat)+'" '+(state.menuCategoryFilter===cat?'selected':'')+'>'+esc(cat)+'</option>').join('')+'</select></label><label class="field"><span>التوافر</span><select id="rest-menu-availability-filter"><option value="ALL" '+(state.menuAvailabilityFilter==='ALL'?'selected':'')+'>الكل</option><option value="AVAILABLE" '+(state.menuAvailabilityFilter==='AVAILABLE'?'selected':'')+'>متاح</option><option value="UNAVAILABLE" '+(state.menuAvailabilityFilter==='UNAVAILABLE'?'selected':'')+'>غير متاح</option></select></label><span class="muted">النتائج: '+filtered.length+' من '+state.menu.length+' صنف محمّل</span></div>';
 return shell('قائمة الطعام',tabs()+'<div class="action-bar">'+add+'</div>'+controls+
 '<div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الفئة</th><th>السعر</th><th>الحالة</th><th>الأكثر طلباً</th><th>إجراء</th></tr></thead><tbody>'+
 (filtered.length?filtered.map(x=>'<tr><td><b>'+esc(x.name_ar)+'</b><div class="muted">'+esc(x.description_ar)+'</div></td><td>'+esc(x.category)+'</td><td>'+money(x.base_price_egp)+'</td><td>'+ (x.is_available?'متاح':'غير متاح')+'</td><td>'+ (x.is_popular?'نعم':'—')+'</td><td>'+(canOperate('CATALOG','update')?'<button class="linkbtn" data-menu-edit="'+esc(x.id)+'">تعديل</button>':'—')+'</td></tr>').join(''):'<tr><td colspan="6">'+(state.menu.length?'لا توجد أصناف مطابقة للفلاتر.':'لا توجد أصناف فعلية بعد.')+'</td></tr>')+
 '</tbody></table></div><p class="muted">البحث والفلاتر محلية داخل آخر 200 صنف محمّل؛ لا تمثل بحثًا شاملاً في كل صفحات الكتالوج.</p>');
}
function viewOrderDetails(order){
 if(!order||!state.orders.some(x=>x.id===order.id))return;
 let items=[];
 try{
  const raw=order.items_json;
  const parsed=typeof raw==='string'?JSON.parse(raw||'[]'):raw;
  items=Array.isArray(parsed)?parsed:(Array.isArray(parsed?.items)?parsed.items:[]);
 }catch(_){items=[];}
 const itemRows=items.length?items.map(item=>{
  const name=item.name_ar||item.name||item.title||item.item_name||'صنف';
  const quantity=Number(item.quantity??item.qty??1);
  const unitPrice=Number(item.unit_price??item.price??item.price_egp);
  const total=Number(item.total??item.line_total);
  return '<tr><td>'+esc(name)+'</td><td>'+esc(Number.isFinite(quantity)?quantity:1)+'</td><td>'+money(Number.isFinite(unitPrice)?unitPrice:0)+'</td><td>'+money(Number.isFinite(total)?total:(Number.isFinite(unitPrice)&&Number.isFinite(quantity)?unitPrice*quantity:0))+'</td></tr>';
 }).join(''):'<tr><td colspan="4">تفاصيل الأصناف غير متاحة في البيانات المحمّلة لهذا الطلب.</td></tr>';
 const value=(v)=>v===null||v===undefined||v===''?'—':esc(v);
 const html='<div class="table-wrap"><table><tbody>'+
  '<tr><th>رقم الطلب</th><td>'+value(order.id)+'</td></tr>'+
  '<tr><th>الحالة الحالية</th><td>'+value(order.status)+'</td></tr>'+
  '<tr><th>اسم العميل</th><td>'+value(order.customer_name)+'</td></tr>'+
  '<tr><th>هاتف العميل</th><td>'+value(order.customer_phone)+'</td></tr>'+
  '<tr><th>عنوان التوصيل</th><td>'+value(order.delivery_address)+'</td></tr>'+
  '<tr><th>تاريخ الإنشاء</th><td>'+value(order.created_at?new Date(order.created_at).toLocaleString('ar-EG'):'')+'</td></tr>'+
  '<tr><th>ملاحظات</th><td>'+value(order.notes)+'</td></tr>'+
  '</tbody></table></div><h3>الأصناف</h3><div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>'+itemRows+'</tbody></table></div>'+
  '<h3>ملخص المبلغ المسجل في الطلب</h3><div class="table-wrap"><table><tbody>'+
  '<tr><th>المجموع الفرعي</th><td>'+money(order.subtotal)+'</td></tr>'+
  '<tr><th>الخصم</th><td>'+money(order.discount)+'</td></tr>'+
  '<tr><th>الضريبة</th><td>'+money(order.tax)+'</td></tr>'+
  '<tr><th>رسوم التوصيل</th><td>'+money(order.delivery_fee)+'</td></tr>'+
  '<tr><th>الإجمالي المسجل</th><td><b>'+money(order.total_amount??order.total)+'</b></td></tr>'+
  '</tbody></table></div><p class="muted">هذه تفاصيل السجل المحمّل فقط وليست إثباتًا على تحصيل المبلغ أو تسويته ماليًا.</p>';
 modal('تفاصيل الطلب',html,async()=>{});
}
function ordersView(){
  // Search and status filtering apply only to the latest 100 records loaded within the active scope.
  const transitions={
   PENDING:['CONFIRMED','CANCELLED'],
   CREATED:['CONFIRMED','CANCELLED'],
   CONFIRMED:['PREPARING','CANCELLED'],
   PREPARING:['OUT_FOR_DELIVERY','CANCELLED'],
   OUT_FOR_DELIVERY:['DELIVERED']
  };
  const term=String(state.orderSearch||'').trim().toLocaleLowerCase();
  const invalidDateRange=Boolean(state.orderFromDate&&state.orderToDate&&state.orderFromDate>state.orderToDate);
  const filtered=state.orders.filter(x=>{
   if(invalidDateRange)return false;
   const status=String(x.status||'UNKNOWN').toUpperCase();
   const haystack=[x.id,x.customer_name,x.customer_phone].map(v=>String(v||'')).join(' ').toLocaleLowerCase();
   const day=Number.isFinite(new Date(x.created_at).getTime())?(()=>{const d=new Date(x.created_at);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})():'';
   return (!term||haystack.includes(term))&&(state.orderStatusFilter==='ALL'||status===state.orderStatusFilter)&&(!state.orderFromDate||(day&&day>=state.orderFromDate))&&(!state.orderToDate||(day&&day<=state.orderToDate));
  });
  const statuses=[...new Set(state.orders.map(x=>String(x.status||'UNKNOWN').toUpperCase()))].sort();
  const controls=(invalidDateRange?'<p class="muted" role="alert">تاريخ البداية لازم يكون قبل تاريخ النهاية أو مساويًا له.</p>':'')+'<div class="action-bar" style="gap:8px;flex-wrap:wrap"><label class="field"><span>بحث برقم الطلب أو اسم العميل أو الهاتف</span><input id="rest-order-search" type="search" maxlength="120" value="'+esc(state.orderSearch)+'" placeholder="اكتب للبحث"></label><label class="field"><span>تصفية بالحالة</span><select id="rest-order-status-filter"><option value="ALL" '+(state.orderStatusFilter==='ALL'?'selected':'')+'>كل الحالات</option>'+statuses.map(s=>'<option value="'+esc(s)+'" '+(state.orderStatusFilter===s?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select></label><label class="field"><span>من تاريخ</span><input id="rest-order-from-date" type="date" value="'+esc(state.orderFromDate)+'"></label><label class="field"><span>إلى تاريخ</span><input id="rest-order-to-date" type="date" value="'+esc(state.orderToDate)+'"></label><button type="button" class="btn btn-outline" id="rest-order-clear-dates">مسح التاريخ</button><span class="muted">النتائج: '+filtered.length+' من '+state.orders.length+' طلب محمّل</span></div>';
  return shell('طلبات المطعم',tabs()+controls+'<div class="table-wrap"><table><thead><tr><th>الطلب</th><th>العميل</th><th>الفرع</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>'+
  (filtered.length?filtered.map(x=>{
   const current=String(x.status||'').toUpperCase();
   const next=transitions[current]||[];
   const statusControl=canOperate('ORDERS','update')
    ?'<select data-order-status="'+esc(x.id)+'" data-current-status="'+esc(current)+'" '+(next.length?'':'disabled')+'><option selected value="'+esc(current)+'">'+esc(current||'غير محدد')+'</option>'+next.map(s=>'<option value="'+s+'">'+s+'</option>').join('')+'</select>'
    :esc(current);
   return '<tr><td><button type="button" class="btn btn-outline" data-order-detail="'+esc(x.id)+'">'+esc(x.id)+'</button></td><td>'+esc(x.customer_name)+'</td><td>'+esc(x.branch_id||'—')+'</td><td>'+money(x.total_amount??x.total)+'</td><td>'+statusControl+'</td><td>'+new Date(x.created_at).toLocaleString('ar-EG')+'</td></tr>';
  }).join(''):'<tr><td colspan="6">'+(state.orders.length?'لا توجد نتائج مطابقة للفلاتر.':'لا توجد طلبات فعلية بعد.')+'</td></tr>')+
  '</tbody></table></div><p class="muted">البحث محلي داخل آخر 100 طلب محمّل فقط؛ استخدم مصدر التقارير المعتمد للبحث التاريخي الكامل.</p>');
}
function kitchenView(){
 const stages=[
  {status:'CONFIRMED',title:'بانتظار بدء التحضير',next:'PREPARING',action:'بدء التحضير'},
  {status:'PREPARING',title:'قيد التحضير',next:'OUT_FOR_DELIVERY',action:'تسليم للمندوب'}
 ];
 const counts=Object.fromEntries(stages.map(x=>[x.status,state.orders.filter(o=>String(o.status||'').toUpperCase()===x.status).length]));
 const cards=stages.map(stage=>{
  // FIFO: oldest valid creation timestamp first; unknown timestamps stay at the end.
  const orders=state.orders.filter(o=>String(o.status||'').toUpperCase()===stage.status).sort((a,b)=>{
   const ta=Date.parse(a.created_at||'');const tb=Date.parse(b.created_at||'');
   const va=Number.isFinite(ta)?ta:Number.POSITIVE_INFINITY;
   const vb=Number.isFinite(tb)?tb:Number.POSITIVE_INFINITY;
   return va-vb;
  });
  const body=orders.length?orders.map(order=>{
   let itemSummary='تفاصيل الأصناف غير متاحة';
   try{
    const raw=order.items_json;
    const parsed=typeof raw==='string'?JSON.parse(raw||'[]'):raw;
    const items=Array.isArray(parsed)?parsed:(Array.isArray(parsed?.items)?parsed.items:[]);
    if(items.length)itemSummary=items.map(i=>String(i.name_ar||i.name||i.title||i.item_name||'صنف')+' × '+String(i.quantity??i.qty??1)).join('، ');
   }catch(_){}
   const canUpdate=canOperate('ORDERS','update');
   const action=canUpdate?'<label class="field"><span>الإجراء التالي</span><select data-order-status="'+esc(order.id)+'" data-current-status="'+esc(stage.status)+'"><option selected value="'+stage.status+'">'+stage.status+'</option><option value="'+stage.next+'">'+stage.action+'</option></select></label>':'<p class="muted">لا توجد صلاحية لتحديث حالة الطلب</p>';
   const created=order.created_at?new Date(order.created_at):null;
   const elapsed=created&&Number.isFinite(created.getTime())?Math.max(0,Math.floor((Date.now()-created.getTime())/60000)):null;
   const waitLabel=elapsed===null?'مدة الانتظار غير متاحة':elapsed<60?elapsed+' دقيقة':Math.floor(elapsed/60)+' ساعة و'+(elapsed%60)+' دقيقة';
   return '<article class="card"><div class="card-title">طلب '+esc(order.id)+'</div><p><b>العميل:</b> '+esc(order.customer_name||'—')+'</p><p><b>الأصناف:</b> '+esc(itemSummary)+'</p><p><b>وقت الطلب:</b> '+esc(created&&Number.isFinite(created.getTime())?created.toLocaleString('ar-EG'):'—')+'</p><p><b>مدة الانتظار وقت عرض الشاشة:</b> '+esc(waitLabel)+'</p>'+action+'<button type="button" class="btn btn-outline" data-order-detail="'+esc(order.id)+'">تفاصيل الطلب</button></article>';
  }).join(''):'<div class="empty-state">لا توجد طلبات في هذه المرحلة ضمن البيانات المحمّلة.</div>';
  return '<section class="card"><div class="workspace-head"><h3>'+stage.title+'</h3><span class="badge">'+counts[stage.status]+'</span></div><div class="cards">'+body+'</div></section>';
 }).join('');
 const refreshed=state.lastLoadedAt?new Date(state.lastLoadedAt).toLocaleString('ar-EG'):'لم يكتمل تحديث ناجح بعد';
 return shell('شاشة المطبخ (KDS)',tabs()+'<div class="action-bar"><button class="btn btn-outline" id="rest-refresh" '+(state.refreshing?'disabled aria-disabled="true"':'')+'>'+(state.refreshing?'جاري التحديث…':'تحديث طلبات المطبخ')+'</button><span class="muted">آخر تحديث ناجح: '+esc(refreshed)+'</span></div><p class="notice">تعرض الشاشة الطلبات المحمّلة ضمن الفرع النشط فقط، بحد أقصى آخر 100 طلب. تحديث الحالة يتم عبر دالة الخادم الحالية؛ لا تُنشأ حالات جديدة من الواجهة.</p><div class="cards">'+cards+'</div><p class="muted">حالة «تسليم للمندوب» تستخدم انتقال OUT_FOR_DELIVERY الموجود حاليًا؛ لم تتم إضافة حالة «جاهز» مستقلة لأن عقد الخادم الحالي لا يثبت دعمها.</p>');
}
function tablesView(){
 const add=canOperate('OPERATIONS','create')?'<button class="btn btn-primary" id="rest-add-table">+ إضافة طاولة</button>':'';
 return shell('إدارة الطاولات',tabs()+'<div class="action-bar">'+add+'</div><div class="table-wrap"><table><thead><tr><th>رقم</th><th>السعة</th><th>الحالة</th><th>الفاتورة الحالية</th><th>حجز</th><th>إجراء</th></tr></thead><tbody>'+
 (state.tables.length?state.tables.map(x=>'<tr><td>'+x.table_number+'</td><td>'+x.capacity_persons+' أفراد</td><td>'+esc(x.status)+'</td><td>'+money(x.current_bill_egp)+'</td><td>'+esc(x.reserved_customer_name||'—')+'</td><td>'+(canOperate('OPERATIONS','update')?'<button class="linkbtn" data-table-edit="'+esc(x.id)+'">تعديل الحالة</button>':'—')+'</td></tr>').join(''):'<tr><td colspan="6">لا توجد طاولات فعلية بعد.</td></tr>')+
 '</tbody></table></div>');
}
function inventoryView(){
 const add=canOperate('OPERATIONS','create')?'<button class="btn btn-primary" id="rest-add-inv">+ إضافة صنف مخزون</button>':'';
 return shell('مخزون المطعم',tabs()+'<div class="action-bar">'+add+'</div><div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الوحدة</th><th>الرصيد</th><th>حد التنبيه</th><th>تكلفة الوحدة</th><th>المورد</th><th>إجراء</th></tr></thead><tbody>'+
 (state.inventory.length?state.inventory.map(x=>'<tr><td>'+esc(x.name_ar)+'</td><td>'+esc(x.unit)+'</td><td>'+x.current_stock_qty+'</td><td>'+x.min_stock_alert_threshold+'</td><td>'+money(x.unit_cost_egp)+'</td><td>'+esc(x.supplier_name)+'</td><td>'+(canOperate('OPERATIONS','update')?'<button class="linkbtn" data-inv-edit="'+esc(x.id)+'">بيانات</button> <button class="linkbtn" data-inv-move="'+esc(x.id)+'">حركة</button>':'—')+' <button class="linkbtn" data-inv-history="'+esc(x.id)+'">السجل</button></td></tr>').join(''):'<tr><td colspan="7">لا توجد أصناف مخزون فعلية بعد.</td></tr>')+
 '</tbody></table></div>');
}
function askOrderDetails(items){
 return new Promise(resolve=>{
  const options=items.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name_ar||x.name||x.title||x.id)+'</option>').join('');
  modal('تفاصيل الطلب','<label class="field"><span>الصنف من الكتالوج المركزي</span><select id="rest-item" required>'+options+'</select></label>'+field('rest-qty','الكمية','1','number','min="1" step="1" required')+field('rest-customer','اسم العميل','', 'text','maxlength="120" required autocomplete="name"')+field('rest-phone','رقم الهاتف','', 'tel','maxlength="20" autocomplete="tel"')+field('rest-address','عنوان التوصيل','')+'<label class="field"><span>ملاحظات الطلب</span><textarea id="rest-notes" rows="3" maxlength="1000"></textarea></label><div class="action-bar"><button class="btn btn-primary" data-save>إنشاء الطلب</button></div>',async o=>{
   const itemId=o.querySelector('#rest-item')?.value;
   const quantity=Number(o.querySelector('#rest-qty')?.value);
   const item=items.find(x=>String(x.id)===String(itemId));
   if(!item){notify('اختر صنفًا صالحًا من الكتالوج.','error');return;}
   if(!Number.isInteger(quantity)||quantity<1){notify('أدخل كمية صحيحة.','error');return;}
   const customerName=o.querySelector('#rest-customer')?.value.trim()||'';
   const customerPhone=o.querySelector('#rest-phone')?.value.trim()||'';
   const deliveryAddress=o.querySelector('#rest-address')?.value.trim()||'';
   const notes=o.querySelector('#rest-notes')?.value.trim()||'';
   if(!customerName||customerName.length>120){notify('أدخل اسم العميل بحد أقصى 120 حرفًا.','error');return;}
   if(customerPhone&&!/^[+0-9()\-\s]{7,20}$/.test(customerPhone)){notify('أدخل رقم هاتف صحيحًا.','error');return;}
   o._close();resolve({item,quantity,customerName,customerPhone,deliveryAddress,notes});
  },()=>resolve(null));
 });
}
async function createRestaurantOrder(){
 if(!state.user||!scope())return notify('يجب اختيار عضوية مطعم/فرع نشطة.');
 if(!canOperate('ORDERS','create'))return notify('ليس لديك صلاحية إنشاء الطلبات.','error');
 const m=scope();
 try{
   const q=new URLSearchParams({tenantId:m.tenant_id,businessId:m.business_id,branchId:m.branch_id,limit:'100'});
   const catalog=await invokeMntyApi('/api/v1/catalog?'+q.toString());
   const items=(catalog?.items||[]).filter(x=>String(x.status).toUpperCase()==='ACTIVE');
   if(!items.length)return notify('لا توجد أصناف من الكتالوج التشغيلي متاحة حالياً.');
   const selection=await askOrderDetails(items);
   if(!selection)return;
   const payload={orderId:crypto.randomUUID(),tenantId:m.tenant_id,businessId:m.business_id,branchId:m.branch_id,clientIdempotencyKey:'MNTY-REST-'+crypto.randomUUID(),currency:'EGP',customerName:selection.customerName,customerPhone:selection.customerPhone,deliveryAddress:selection.deliveryAddress,items:[{catalogItemId:selection.item.id,quantity:selection.quantity,selectedOptionIds:[]}],notes:selection.notes,metadata:{source:'RESTAURANTS',catalog_authoritative:true}};
   const r=await invokeMntyFunction('order-create',payload);
   notify('تم إنشاء الطلب '+(r?.id||payload.orderId)+' من الكتالوج المركزي. الإجمالي محسوب خادميًا.');
   await load();
 }catch(e){notify('تعذر إنشاء الطلب. تحقق من البيانات والصلاحيات والاتصال ثم حاول مرة أخرى.','error')}
}
function dashboard(){
 const statusCounts={};
 state.orders.forEach(order=>{const key=String(order.status||'UNKNOWN').toUpperCase();statusCounts[key]=(statusCounts[key]||0)+1;});
 const statusCards=Object.keys(statusCounts).sort().map(status=>'<article class="card"><div class="card-title">'+esc(status)+'</div><div class="metric">'+statusCounts[status]+'</div><div class="muted">ضمن آخر 100 طلب محمّل</div></article>').join('');
 const refreshed=state.lastLoadedAt?new Date(state.lastLoadedAt).toLocaleString('ar-EG'):'لم يكتمل تحديث البيانات بنجاح بعد';
 return shell('لوحة المطعم',tabs()+'<div class="action-bar">'+(canOperate('ORDERS','create')?'<button class="btn btn-primary" id="rest-create-order">+ طلب جديد</button>':'')+'<button class="btn btn-outline" id="rest-refresh" '+(state.refreshing?'disabled aria-disabled="true"':'')+'>'+ (state.refreshing?'جاري التحديث…':'تحديث البيانات')+'</button><span class="muted">آخر تحديث ناجح: '+esc(refreshed)+'</span></div>'+cards()+
 '<h3>توزيع الطلبات حسب الحالة</h3><div class="cards">'+(statusCards||'<article class="card"><div class="muted">لا توجد طلبات ضمن البيانات المحمّلة</div></article>')+'</div>'+
 '<div class="notice" style="margin-top:16px">مؤشرات الحالات محسوبة من آخر 100 طلب محمّل فقط. لا نعرض إجمالي مبيعات أو متوسط طلب باعتبارهما أرقامًا مالية معتمدة قبل ربطهما بمصدر الدفع والتسوية المركزي.</div>'+
 '<div class="cards" style="margin-top:16px"><article class="card"><div class="card-title">حدود الأمان</div><div class="muted">كل عمليات الكتابة تمر عبر جلسة المستخدم وRLS ونطاق العضوية. لا يتم تجاوز صلاحيات الخادم.</div></article><article class="card"><div class="card-title">النطاق الحالي</div><div class="muted">'+(scope()?esc(scope().business_id)+' · فرع '+esc(scope().branch_id):'عرض قراءة فقط')+'</div></article></div>');
}
async function refreshDashboard(){
 if(state.refreshing||state.loading)return;
 state.refreshing=true;render();
 try{await load();}finally{state.refreshing=false;render();}
}
function render(){
 const page=document.getElementById('page');if(!page)return;
 if(state.error){const recovery=state.staleMembershipSelection?'<button class="btn btn-outline" id="rest-clear-membership">مسح الاختيار المحفوظ وإعادة الاختيار</button>':'';page.innerHTML=shell('تعذر تحميل موديول المطاعم',tabs()+'<div class="empty-state">'+esc(state.error)+'<div class="action-bar">'+recovery+'<button class="btn btn-primary" id="rest-retry">إعادة المحاولة</button></div></div>');bind();return;}
 if(state.selectionRequired){page.innerHTML=shell('اختيار المؤسسة والفرع', '<p class="muted">لديك أكثر من عضوية نشطة. اختر النطاق الذي تريد إدارته قبل تحميل بيانات المطعم.</p><div class="cards">'+state.membershipOptions.map(m=>'<article class="card"><div class="card-title">المؤسسة: '+esc(m.tenant_id)+'</div><p>النشاط: '+esc(m.business_id||'غير محدد')+'</p><p>الفرع: '+esc(m.branch_id||'غير محدد')+'</p><p>الدور: '+esc(m.role||'غير محدد')+'</p><button class="btn btn-primary" data-select-membership="'+esc(m.id)+'">اختيار هذا النطاق</button></article>').join('')+'</div>');bind();return;}
 if(state.loading){page.innerHTML=shell('جاري تحميل موديول المطاعم',tabs()+'<p class="muted">جاري تحميل البيانات الفعلية…</p>');return;}
 page.innerHTML=state.tab==='menu'?menuView():state.tab==='orders'?ordersView():state.tab==='kitchen'?kitchenView():state.tab==='tables'?tablesView():state.tab==='inventory'?inventoryView():state.tab==='reservations'?reservationsView():dashboard();
 bind();
}
function modal(title,html,onSave,onCancel){
 const o=document.createElement('div');o.className='mx-modal';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label',title);o.tabIndex=-1;o.innerHTML='<div class="mx-modal-card"><div class="workspace-head"><h2>'+title+'</h2><button class="btn btn-outline" id="rest-close">إغلاق</button></div><div class="modal-body">'+html+'</div></div>';
 const previousFocus=document.activeElement;document.body.appendChild(o);let closed=false;const close=(cancelled=false)=>{if(closed)return;closed=true;o.remove();document.removeEventListener('keydown',onKey);if(cancelled&&typeof onCancel==='function')onCancel();if(previousFocus&&typeof previousFocus.focus==='function')requestAnimationFrame(()=>previousFocus.focus());};o._close=()=>close(false);const focusables=()=>[...o.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled&&el.offsetParent!==null);const onKey=e=>{if(e.key==='Escape'){e.preventDefault();close(true);return;}if(e.key!=='Tab')return;const list=focusables();if(!list.length)return;const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}};o.querySelector('#rest-close').setAttribute('aria-label','إغلاق');o.querySelector('#rest-close').onclick=()=>close(true);o.addEventListener('click',e=>{if(e.target===o)close(true)});document.addEventListener('keydown',onKey);requestAnimationFrame(()=>o.querySelector('#rest-close')?.focus());
 const saveButton=o.querySelector('[data-save]');saveButton?.addEventListener('click',async()=>{if(saveButton.disabled)return;saveButton.disabled=true;try{await onSave(o)}catch(error){notify('حدث خطأ غير متوقع أثناء الحفظ. حاول مرة أخرى.','error')}finally{if(o.isConnected)saveButton.disabled=false}});
}
function field(id,label,value='',type='text',extra=''){return '<label class="field"><span>'+label+'</span><input id="'+id+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>'}
function addMenu(existing){
 if(!canOperate('CATALOG',existing?'update':'create'))return;
 const x=existing||{};
 modal(existing?'تعديل صنف':'إضافة صنف',
 field('name','اسم الصنف',x.name_ar)+field('desc','الوصف',x.description_ar)+field('cat','الفئة',x.category)+field('price','السعر بالجنيه',x.base_price_egp,'number','step="0.01" min="0" required')+
 '<div class="action-bar"><label><input id="available" type="checkbox" '+(x.is_available!==false?'checked':'')+'> متاح</label><label><input id="popular" type="checkbox" '+(x.is_popular?'checked':'')+'> الأكثر طلباً</label></div><button class="btn btn-primary" data-save>حفظ</button>',
 async o=>{
  const s=scope();if(!s)return notify('لا يوجد نطاق نشاط/فرع نشط.');
  const payload={name_ar:o.querySelector('#name').value.trim(),description_ar:o.querySelector('#desc').value.trim(),category:o.querySelector('#cat').value.trim(),base_price_egp:Number(o.querySelector('#price').value),is_available:o.querySelector('#available').checked,is_popular:o.querySelector('#popular').checked};
  if(!payload.name_ar||!payload.category||!Number.isFinite(payload.base_price_egp)||payload.base_price_egp<0)return notify('أكمل الاسم والفئة والسعر بشكل صحيح.');
  let q;
  if(existing)q=sb.from('restaurant_menu_items').update(payload).eq('id',existing.id).eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id).select('id').maybeSingle();
  else q=sb.from('restaurant_menu_items').insert({...payload,id:uid(),owner_user_id:state.user.id,...s}).select('id').single();
  const r=await q;if(r.error)return notify('تعذر الحفظ. تحقق من البيانات والصلاحيات ثم حاول مرة أخرى.','error');if(!r.data)return notify('لم يتم الحفظ: الصنف غير موجود في نطاق الفرع أو لا تملك الصلاحية.','error');o._close();await load();
 });
}
function addTable(existing){
 if(!canOperate('OPERATIONS',existing?'update':'create'))return;
 const x=existing||{};
 modal(existing?'تعديل طاولة':'إضافة طاولة',
 field('num','رقم الطاولة',x.table_number,'number','min="1" step="1" required')+field('cap','السعة',x.capacity_persons||2,'number','min="1" step="1" required')+
 '<label class="field"><span>الحالة</span><select id="status">'+['EMPTY','OCCUPIED','RESERVED','CLEANING','OUT_OF_SERVICE'].map(status=>'<option '+((x.status||'EMPTY')===status?'selected':'')+'>'+status+'</option>').join('')+'</select></label>'+
 field('reserved','اسم الحجز',x.reserved_customer_name||'')+'<button class="btn btn-primary" data-save>حفظ</button>',
 async o=>{
  const s=scope();if(!s)return notify('لا يوجد نطاق نشاط/فرع نشط.');
  const payload={table_number:Number(o.querySelector('#num').value),capacity_persons:Number(o.querySelector('#cap').value),status:o.querySelector('#status').value,reserved_customer_name:o.querySelector('#reserved').value.trim()||null};
  if(!Number.isInteger(payload.table_number)||payload.table_number<1||!Number.isInteger(payload.capacity_persons)||payload.capacity_persons<1)return notify('أدخل رقم وسعة صحيحين.');
  let q=existing?sb.from('restaurant_tables').update(payload).eq('id',existing.id).eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id).select('id').maybeSingle():sb.from('restaurant_tables').insert({...payload,id:uid(),owner_user_id:state.user.id,current_active_order_id:null,current_bill_egp:0,...s}).select('id').single();
  const r=await q;if(r.error)return notify('تعذر الحفظ. تحقق من البيانات والصلاحيات ثم حاول مرة أخرى.','error');if(!r.data)return notify('لم يتم الحفظ: الطاولة خارج نطاق الفرع أو لا تملك الصلاحية.','error');o._close();await load();
 });
}
function addInventory(existing){
 if(!canOperate('OPERATIONS',existing?'update':'create'))return;
 const x=existing||{};
 modal(existing?'تعديل صنف مخزون':'إضافة صنف مخزون',
 field('name','اسم الصنف',x.name_ar)+field('unit','الوحدة',x.unit||'KG')+'<div class="notice">يبدأ الصنف برصيد صفر. سجل الوارد أو الصرف أو الرصيد الافتتاحي من زر حركة ليتم تحديث الرصيد مع سجل تدقيق.</div>'+field('min','حد التنبيه',x.min_stock_alert_threshold||0,'number','step="0.001" min="0"')+field('supplier','المورد',x.supplier_name||'')+'<button class="btn btn-primary" data-save>حفظ</button>',
 async o=>{
  const s=scope();if(!s)return notify('لا يوجد نطاق نشاط/فرع نشط.');
  const payload={name_ar:o.querySelector('#name').value.trim(),unit:o.querySelector('#unit').value.trim(),min_stock_alert_threshold:Number(o.querySelector('#min').value),supplier_name:o.querySelector('#supplier').value.trim()};
  if(!existing){payload.current_stock_qty=0;payload.unit_cost_egp=0;}
  if(!payload.name_ar||!payload.unit||![payload.min_stock_alert_threshold].every(v=>Number.isFinite(v)&&v>=0))return notify('تحقق من بيانات المخزون.');
  const q=existing?sb.from('restaurant_inventory').update(payload).eq('id',existing.id).eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id).select('id').maybeSingle():sb.from('restaurant_inventory').insert({...payload,id:uid(),owner_user_id:state.user.id,...s}).select('id').single();
  const r=await q;if(r.error)return notify('تعذر الحفظ. تحقق من البيانات والصلاحيات ثم حاول مرة أخرى.','error');if(!r.data)return notify('لم يتم الحفظ: صنف المخزون خارج نطاق الفرع أو لا تملك الصلاحية.','error');o._close();await load();
 });
}
async function addInventoryMovement(existing){
 if(!existing||!canOperate('OPERATIONS','update'))return;
 const role=String(state.membership?.role||'').toUpperCase();
 const openingOption=['OWNER','ADMIN','BUSINESS_OWNER','PROVIDER_OWNER','PROVIDER_ADMIN'].includes(role)?'<option value="OPENING_BALANCE">رصيد افتتاحي</option>':'';
 const idempotencyKey='MNTY-REST-STOCK-'+uid();
 modal('تسجيل حركة مخزون','<div class="notice">تحديث الرصيد يتم ذريًا عبر دالة خادمية ويسجل حركة غير قابلة للتعديل من المتصفح.</div><label class="field"><span>نوع الحركة</span><select id="stock-movement-type"><option value="RECEIPT">وارد / توريد</option><option value="ISSUE">صرف</option>'+openingOption+'</select></label>'+field('stock-movement-qty','الكمية','1','number','min="0.001" max="1000000" step="0.001" required')+field('stock-movement-cost','تكلفة الوحدة بالجنيه',existing.unit_cost_egp||0,'number','min="0" max="100000000" step="0.01" required')+'<label class="field"><span>ملاحظات / مرجع</span><textarea id="stock-movement-notes" rows="3" maxlength="1000"></textarea></label><button class="btn btn-primary" data-save>تسجيل الحركة</button>',async o=>{
  const s=scope();const type=o.querySelector('#stock-movement-type').value;
  const quantity=Number(o.querySelector('#stock-movement-qty').value);
  const unitCost=Number(o.querySelector('#stock-movement-cost').value);
  const notes=o.querySelector('#stock-movement-notes').value.trim();
  if(!s)return notify('لا يوجد نطاق نشاط/فرع نشط.','error');
  if(!Number.isFinite(quantity)||quantity<=0||quantity>1000000||Math.round(quantity*1000)!==quantity*1000)return notify('أدخل كمية موجبة بحد أقصى ثلاث خانات عشرية.','error');
  if(!Number.isFinite(unitCost)||unitCost<0||unitCost>100000000||Math.round(unitCost*100)!==unitCost*100)return notify('أدخل تكلفة صحيحة بحد أقصى خانتين عشريتين.','error');
  const {data,error}=await sb.rpc('restaurant_inventory_move',{p_inventory_id:existing.id,p_movement_type:type,p_quantity:quantity,p_unit_cost_egp:unitCost,p_idempotency_key:idempotencyKey,p_notes:notes});
  if(error){notify('تعذر تسجيل حركة المخزون. تحقق من الصلاحيات والرصيد ثم حاول مرة أخرى.','error');return;}
  o._close();notify('تم تسجيل الحركة بنجاح. الرصيد الجديد: '+Number(data?.current_stock_qty??0).toLocaleString('ar-EG')+' '+existing.unit);await load();
 });
}
async function viewInventoryMovements(existing){
 if(!existing)return;
 const s=scope();if(!s)return notify('لا يوجد نطاق نشاط/فرع نشط.','error');
 const {data,error}=await sb.from('restaurant_inventory_movements').select('id,movement_type,quantity,unit_cost_egp,idempotency_key,notes,created_by,created_at').eq('inventory_id',existing.id).eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id).order('created_at',{ascending:false}).limit(50);
 if(error)return notify('تعذر تحميل سجل الحركات. تحقق من الصلاحيات والاتصال.','error');
 const rows=data||[];
 const body='<p class="muted">آخر 50 حركة للصنف '+esc(existing.name_ar)+'. الرصيد الحالي: '+esc(existing.current_stock_qty)+' '+esc(existing.unit)+'</p><div class="table-wrap"><table><thead><tr><th>النوع</th><th>الكمية</th><th>تكلفة الوحدة</th><th>الملاحظات</th><th>التاريخ</th></tr></thead><tbody>'+(rows.length?rows.map(x=>'<tr><td>'+esc(x.movement_type)+'</td><td>'+esc(x.quantity)+'</td><td>'+money(x.unit_cost_egp)+'</td><td>'+esc(x.notes||'—')+'</td><td>'+esc(new Date(x.created_at).toLocaleString('ar-EG'))+'</td></tr>').join(''):'<tr><td colspan="5">لا توجد حركات مسجلة لهذا الصنف بعد.</td></tr>')+'</tbody></table></div>';
 modal('سجل حركات المخزون',body);
}
function localDateTime(hoursFromNow){
 const d=new Date(Date.now()+hoursFromNow*3600000-localTimezoneOffsetMs());
 return d.toISOString().slice(0,16);
}
function localTimezoneOffsetMs(){return new Date().getTimezoneOffset()*60000;}
function reservationsView(){
 const add=canOperate('OPERATIONS','create')&&state.tables.length
  ?'<button class="btn btn-primary" id="rest-add-reservation">+ حجز جديد</button>':'';
 const term=String(state.reservationSearch||'').trim().toLocaleLowerCase();
 const from=state.reservationFromDate||'',to=state.reservationToDate||'';
 const invalidDateRange=Boolean(from&&to&&from>to);
 const filtered=state.reservations.filter(r=>{
  if(invalidDateRange)return false;
  const hay=[r.customer_name,r.customer_phone,r.id,r.table_id].map(v=>String(v||'')).join(' ').toLocaleLowerCase();
  const time=Date.parse(r.starts_at||'');
  const day=Number.isFinite(time)?(()=>{const d=new Date(time);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})():'';
  return (!term||hay.includes(term))&&(!state.reservationStatusFilter||state.reservationStatusFilter==='ALL'||String(r.status||'').toUpperCase()===state.reservationStatusFilter)&&(!from||(day&&day>=from))&&(!to||(day&&day<=to));
 });
 const rows=filtered.length?filtered.map(r=>{
  const table=state.tables.find(t=>String(t.id)===String(r.table_id));
  const canChange=canOperate('OPERATIONS','update');
  const actions=[];
  if(canChange&&r.status==='PENDING')actions.push('<button class="linkbtn" data-reservation-action="CONFIRM" data-reservation-id="'+esc(r.id)+'">تأكيد</button>');
  if(canChange&&r.status==='CONFIRMED')actions.push('<button class="linkbtn" data-reservation-action="SEAT" data-reservation-id="'+esc(r.id)+'">تم التسكين</button>');
  if(canChange&&['PENDING','CONFIRMED'].includes(r.status))actions.push('<button class="linkbtn" data-reservation-cancel="'+esc(r.id)+'">إلغاء</button><button class="linkbtn" data-reservation-action="NO_SHOW" data-reservation-id="'+esc(r.id)+'">لم يحضر</button>');
  const startMs=Date.parse(r.starts_at||''),endMs=Date.parse(r.ends_at||'');
  const startLabel=Number.isFinite(startMs)?new Date(startMs).toLocaleString('ar-EG'):'تاريخ غير صالح';
  const endLabel=Number.isFinite(endMs)?new Date(endMs).toLocaleString('ar-EG'):'تاريخ غير صالح';
  return '<tr><td>'+esc(table?'طاولة '+table.table_number:r.table_id)+'</td><td>'+esc(r.customer_name)+'<div class="muted">'+esc(r.customer_phone||'—')+'</div></td><td>'+esc(r.guest_count)+'</td><td>'+esc(startLabel)+'</td><td>'+esc(endLabel)+'</td><td>'+esc(r.status)+'</td><td>'+esc(r.notes||'—')+'</td><td>'+ (actions.join(' ')||'—')+'</td></tr>';
 }).join(''):'';
 const statuses=[...new Set(state.reservations.map(r=>String(r.status||'UNKNOWN').toUpperCase()))].sort();
 const controls=(invalidDateRange?'<p role="alert" class="muted">تاريخ البداية لازم يكون قبل تاريخ النهاية أو مساويًا له.</p>':'')+'<div class="action-bar" style="gap:8px;flex-wrap:wrap"><label class="field"><span>بحث بالعميل أو الهاتف أو رقم الحجز أو الطاولة</span><input id="rest-reservation-search" type="search" maxlength="120" value="'+esc(state.reservationSearch||'')+'"></label><label class="field"><span>الحالة</span><select id="rest-reservation-status"><option value="ALL">كل الحالات</option>'+statuses.map(x=>'<option value="'+esc(x)+'" '+(state.reservationStatusFilter===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label><label class="field"><span>من تاريخ البداية</span><input id="rest-reservation-from" type="date" value="'+esc(from)+'"></label><label class="field"><span>إلى تاريخ البداية</span><input id="rest-reservation-to" type="date" value="'+esc(to)+'"></label><button type="button" class="btn btn-outline" id="rest-reservation-clear">مسح الفلاتر</button><span class="muted">النتائج: '+filtered.length+' من '+state.reservations.length+' حجز محمّل</span></div>';
 return shell('حجوزات المطعم',tabs()+'<div class="action-bar">'+add+'</div>'+controls+'<div class="notice">يتم منع تداخل حجوزات الطاولة على مستوى قاعدة البيانات مع التحقق من السعة ونطاق الفرع.</div><div class="table-wrap"><table><thead><tr><th>الطاولة</th><th>العميل</th><th>الأفراد</th><th>من</th><th>إلى</th><th>الحالة</th><th>ملاحظات</th><th>إجراءات</th></tr></thead><tbody>'+(rows||'<tr><td colspan="8">'+(state.reservations.length?'لا توجد حجوزات مطابقة للفلاتر.':'لا توجد حجوزات مسجلة لهذا الفرع بعد.')+'</td></tr>')+'</tbody></table></div><p class="muted">البحث والتصفية محليان ضمن آخر 100 حجز محمّل؛ لا يمثلان سجلًا تاريخيًا كاملًا.</p>');
}
async function addReservation(){
 if(!canOperate('OPERATIONS','create'))return notify('ليس لديك صلاحية إنشاء الحجوزات.','error');
 if(!state.tables.length)return notify('أضف طاولة نشطة قبل إنشاء الحجز.','error');
 const s=scope();if(!s)return notify('لا يوجد نطاق نشاط/فرع نشط.','error');
 const options=state.tables.map(t=>'<option value="'+esc(t.id)+'">طاولة '+esc(t.table_number)+' — سعة '+esc(t.capacity_persons)+'</option>').join('');
 const key='MNTY-REST-RES-'+uid();
 modal('حجز مطعم جديد','<label class="field"><span>الطاولة</span><select id="res-table" required>'+options+'</select></label>'+field('res-name','اسم العميل','','text','maxlength="120" required autocomplete="name"')+field('res-phone','رقم الهاتف','','tel','maxlength="20" autocomplete="tel"')+field('res-guests','عدد الأفراد','2','number','min="1" max="100" step="1" required')+field('res-start','وقت البداية',localDateTime(2),'datetime-local','required')+field('res-end','وقت النهاية',localDateTime(3),'datetime-local','required')+'<label class="field"><span>ملاحظات</span><textarea id="res-notes" rows="3" maxlength="1000"></textarea></label><button class="btn btn-primary" data-save>حفظ الحجز</button>',async o=>{
  const tableId=o.querySelector('#res-table').value;
  const customerName=o.querySelector('#res-name').value.trim();
  const customerPhone=o.querySelector('#res-phone').value.trim();
  const guestCount=Number(o.querySelector('#res-guests').value);
  const startValue=o.querySelector('#res-start').value;
  const endValue=o.querySelector('#res-end').value;
  const notes=o.querySelector('#res-notes').value.trim();
  const table=state.tables.find(t=>String(t.id)===String(tableId));
  const start=new Date(startValue),end=new Date(endValue);
  if(!table||!customerName||customerName.length>120)return notify('تحقق من الطاولة واسم العميل.','error');
  if(customerPhone&&!/^[+0-9()\-\s]{7,20}$/.test(customerPhone))return notify('أدخل رقم هاتف صحيحًا.','error');
  if(!Number.isInteger(guestCount)||guestCount<1||guestCount>Number(table.capacity_persons))return notify('عدد الأفراد يجب ألا يتجاوز سعة الطاولة ('+table.capacity_persons+').','error');
  if(!startValue||!endValue||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)return notify('تحقق من وقت بداية الحجز ونهايته.','error');
  let startsAt,endsAt;try{startsAt=start.toISOString();endsAt=end.toISOString()}catch(e){return notify('وقت الحجز غير صالح.','error');}
  const {data,error}=await sb.rpc('restaurant_reservation_mutate',{p_action:'CREATE',p_payload:{tenant_id:s.tenant_id,business_id:s.business_id,branch_id:s.branch_id,table_id:tableId,customer_name:customerName,customer_phone:customerPhone,guest_count:guestCount,starts_at:startsAt,ends_at:endsAt,notes,idempotency_key:key}});
  if(error){notify('تعذر إنشاء الحجز. قد تكون الطاولة محجوزة في هذا الوقت أو أن بيانات الحجز غير صحيحة.','error');return;}
  o._close();notify('تم حفظ الحجز بنجاح.');await load();
 });
}
async function setReservationAction(id,action){
 if(!canOperate('OPERATIONS','update'))return notify('ليس لديك صلاحية تعديل الحجوزات.','error');
 const s=scope();if(!s)return notify('لا يوجد نطاق نشاط/فرع نشط.','error');
 const reservation=state.reservations.find(r=>String(r.id)===String(id));
 if(!reservation)return notify('الحجز غير موجود ضمن الحجوزات المحمّلة لهذا الفرع. حدّث القائمة ثم حاول مرة أخرى.','error');
 const current=String(reservation.status||'').toUpperCase();
 const allowed={CONFIRM:['PENDING'],SEAT:['CONFIRMED'],NO_SHOW:['PENDING','CONFIRMED']};
 if(!Array.isArray(allowed[action])||!allowed[action].includes(current))return notify('الإجراء لا يناسب حالة الحجز الحالية. حدّث القائمة وتحقق من الحالة.','error');
 const labels={CONFIRM:'تأكيد الحجز',SEAT:'تسجيل حضور العميل',NO_SHOW:'تسجيل عدم الحضور'};
 if(!window.confirm((labels[action]||'تحديث الحجز')+'؟'))return;
 const {error}=await sb.rpc('restaurant_reservation_mutate',{p_action:action,p_payload:{tenant_id:s.tenant_id,business_id:s.business_id,branch_id:s.branch_id,reservation_id:id}});
 if(error)return notify('تعذر تحديث حالة الحجز. تحقق من الحالة والصلاحيات.','error');
 notify('تم تحديث حالة الحجز.');await load();
}
async function cancelReservation(id){
 if(!canOperate('OPERATIONS','update'))return notify('ليس لديك صلاحية إلغاء الحجوزات.','error');
 const s=scope();if(!s)return notify('لا يوجد نطاق نشاط/فرع نشط.','error');
 const reservation=state.reservations.find(r=>String(r.id)===String(id));
 if(!reservation)return notify('الحجز غير موجود ضمن الحجوزات المحمّلة لهذا الفرع. حدّث القائمة ثم حاول مرة أخرى.','error');
 if(!['PENDING','CONFIRMED'].includes(String(reservation.status||'').toUpperCase()))return notify('لا يمكن إلغاء الحجز من حالته الحالية. حدّث القائمة وتحقق من الحالة.','error');
 if(!window.confirm('هل تريد إلغاء هذا الحجز؟'))return;
 const {error}=await sb.rpc('restaurant_reservation_mutate',{p_action:'CANCEL',p_payload:{tenant_id:s.tenant_id,business_id:s.business_id,branch_id:s.branch_id,reservation_id:id}});
 if(error)return notify('تعذر إلغاء الحجز. قد يكون الحجز قد تم تسكينه أو تغيرت حالته.','error');
 notify('تم إلغاء الحجز.');await load();
}
async function updateOrder(id,status){
 if(!canOperate('ORDERS','update'))return false;
 const m=scope(); if(!m){notify('لا يوجد نطاق نشاط/فرع نشط.','error');return false;}
 const order=state.orders.find(x=>String(x.id)===String(id));
 if(!order){notify('الطلب غير موجود ضمن البيانات المحمّلة لهذا الفرع. حدّث القائمة ثم حاول مرة أخرى.','error');return false;}
 const current=String(order.status||'').toUpperCase();
 const allowed={PENDING:['CONFIRMED','CANCELLED'],CREATED:['CONFIRMED','CANCELLED'],CONFIRMED:['PREPARING','CANCELLED'],PREPARING:['OUT_FOR_DELIVERY','CANCELLED'],OUT_FOR_DELIVERY:['DELIVERED']};
 if(!Array.isArray(allowed[current])||!allowed[current].includes(String(status||'').toUpperCase())){
  notify('انتقال الحالة غير مسموح من الحالة الحالية. حدّث الطلب وتحقق من حالته.','error');
  return false;
 }
 try{
  await invokeMntyFunction('order-status-update',{orderId:id,tenantId:m.tenant_id,newStatus:status});
  await load();return true;
 }catch(e){notify('تعذر تحديث حالة الطلب. تحقق من الصلاحيات والاتصال ثم حاول مرة أخرى.','error');return false}
}
function bind(){
 document.querySelectorAll('[data-rest-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.restTab;render()});
 document.getElementById('rest-retry')?.addEventListener('click',load);
 document.getElementById('rest-refresh')?.addEventListener('click',refreshDashboard);
 document.getElementById('rest-clear-membership')?.addEventListener('click',()=>{localStorage.removeItem('MNTYActiveMembershipId');load();});
 document.querySelectorAll('[data-select-membership]').forEach(b=>b.addEventListener('click',()=>{const id=b.getAttribute('data-select-membership');if(!state.membershipOptions.some(m=>m.id===id))return;localStorage.setItem('MNTYActiveMembershipId',id);load();}));
 document.getElementById('rest-add-menu')?.addEventListener('click',()=>addMenu());
 document.getElementById('rest-create-order')?.addEventListener('click',createRestaurantOrder);
 const menuSearch=document.getElementById('rest-menu-search');
 if(menuSearch)menuSearch.addEventListener('input',()=>{const start=menuSearch.selectionStart;state.menuSearch=menuSearch.value;render();const next=document.getElementById('rest-menu-search');if(next){next.focus();next.setSelectionRange(start,start);}});
 document.getElementById('rest-menu-category-filter')?.addEventListener('change',e=>{state.menuCategoryFilter=e.target.value;render();});
 document.getElementById('rest-menu-availability-filter')?.addEventListener('change',e=>{state.menuAvailabilityFilter=e.target.value;render();});

 const orderSearch=document.getElementById('rest-order-search');
 if(orderSearch)orderSearch.addEventListener('input',()=>{const start=orderSearch.selectionStart;state.orderSearch=orderSearch.value;render();const next=document.getElementById('rest-order-search');if(next){next.focus();next.setSelectionRange(start,start);}});
 document.getElementById('rest-order-status-filter')?.addEventListener('change',e=>{state.orderStatusFilter=e.target.value;render();});
 document.getElementById('rest-order-from-date')?.addEventListener('change',e=>{state.orderFromDate=e.target.value;render();});
 document.getElementById('rest-order-to-date')?.addEventListener('change',e=>{state.orderToDate=e.target.value;render();});
 document.getElementById('rest-order-clear-dates')?.addEventListener('click',()=>{state.orderFromDate='';state.orderToDate='';render();});

 document.getElementById('rest-add-table')?.addEventListener('click',()=>addTable());
 document.getElementById('rest-add-inv')?.addEventListener('click',()=>addInventory());
  document.getElementById('rest-add-reservation')?.addEventListener('click',()=>addReservation());
 const reservationSearch=document.getElementById('rest-reservation-search');
 if(reservationSearch)reservationSearch.addEventListener('input',()=>{const pos=reservationSearch.selectionStart;state.reservationSearch=reservationSearch.value;render();const next=document.getElementById('rest-reservation-search');if(next){next.focus();next.setSelectionRange(pos,pos);}});
 document.getElementById('rest-reservation-status')?.addEventListener('change',e=>{state.reservationStatusFilter=e.target.value;render();});
 document.getElementById('rest-reservation-from')?.addEventListener('change',e=>{state.reservationFromDate=e.target.value;render();});
 document.getElementById('rest-reservation-to')?.addEventListener('change',e=>{state.reservationToDate=e.target.value;render();});
 document.getElementById('rest-reservation-clear')?.addEventListener('click',()=>{state.reservationSearch='';state.reservationStatusFilter='ALL';state.reservationFromDate='';state.reservationToDate='';render();});
  document.querySelectorAll('[data-reservation-cancel]').forEach(b=>b.addEventListener('click',()=>cancelReservation(b.dataset.reservationCancel)));
  document.querySelectorAll('[data-reservation-action]').forEach(b=>b.addEventListener('click',()=>setReservationAction(b.dataset.reservationId,b.dataset.reservationAction)));
 document.querySelectorAll('[data-menu-edit]').forEach(b=>b.onclick=()=>addMenu(state.menu.find(x=>x.id===b.dataset.menuEdit)));
 document.querySelectorAll('[data-table-edit]').forEach(b=>b.onclick=()=>addTable(state.tables.find(x=>x.id===b.dataset.tableEdit)));
 document.querySelectorAll('[data-inv-edit]').forEach(b=>b.onclick=()=>addInventory(state.inventory.find(x=>x.id===b.dataset.invEdit)));
 document.querySelectorAll('[data-inv-move]').forEach(b=>b.onclick=()=>addInventoryMovement(state.inventory.find(x=>x.id===b.dataset.invMove)));
 document.querySelectorAll('[data-inv-history]').forEach(b=>b.onclick=()=>viewInventoryMovements(state.inventory.find(x=>x.id===b.dataset.invHistory)));
 document.querySelectorAll('[data-order-detail]').forEach(b=>b.addEventListener('click',()=>viewOrderDetails(state.orders.find(x=>x.id===b.dataset.orderDetail))));
 document.querySelectorAll('[data-order-status]').forEach(s=>s.onchange=async()=>{if(s.dataset.pending==='1')return;const previous=s.dataset.currentStatus||s.value;const selected=s.value;s.dataset.pending='1';s.disabled=true;try{const ok=await updateOrder(s.dataset.orderStatus,selected);if(ok)s.dataset.currentStatus=selected;else s.value=previous}finally{delete s.dataset.pending;if(s.isConnected)s.disabled=false}});
}
function activeModule(){
 const h=document.querySelector('.breadcrumb');
 return h&&h.textContent.includes('المطاعم والمطابخ');
}
let last=false;
function observe(){
 const now=activeModule();
 if(now&&!last){state.tab='dashboard';load();}
 last=now;
}
const mo=new MutationObserver(observe);
mo.observe(document.body,{childList:true,subtree:true});
setInterval(observe,800);
})();