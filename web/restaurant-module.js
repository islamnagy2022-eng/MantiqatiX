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

let state={user:null,membership:null,membershipOptions:[],selectionRequired:false,tab:'dashboard',menu:[],orders:[],tables:[],inventory:[],reservations:[],loading:false,error:null,staleMembershipSelection:false,pendingOrderPayload:null};

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
 }catch(e){
  state.error='حدث خطأ أثناء تحميل بيانات المطعم. حاول مرة أخرى.';
 }finally{state.loading=false;render();}
}
function shell(title,body){
 return '<section class="workspace-section"><div class="workspace-head"><div><div class="eyebrow">RESTAURANTS</div><h2>'+title+'</h2><p class="muted">إدارة المطعم والقائمة والطلبات والطاولات والمخزون من بيانات Supabase الفعلية فقط.</p></div></div>'+body+'</section>';
}
function cards(){
 const low=state.inventory.filter(x=>Number(x.current_stock_qty)<=Number(x.min_stock_alert_threshold)).length;
 const billable=state.orders.filter(x=>String(x.status||'').toUpperCase()!=='CANCELLED');
 const average=billable.length?billable.reduce((sum,x)=>sum+Number((x.total_amount??x.total)||0),0)/billable.length:0;
 const statuses=['CONFIRMED','PREPARING','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];
 return '<div class="cards">'+
 '<article class="card"><div class="card-title">🍽️ عناصر القائمة</div><div class="metric">'+state.menu.length+'</div><div class="muted">السجلات المتاحة ضمن نطاق العرض</div></article>'+
 '<article class="card"><div class="card-title">🧾 الطلبات</div><div class="metric">'+state.orders.length+'</div><div class="muted">آخر 100 طلب</div></article>'+
 '<article class="card"><div class="card-title">🪑 الطاولات</div><div class="metric">'+state.tables.length+'</div><div class="muted">حالة الطاولات الحالية</div></article>'+
 '<article class="card"><div class="card-title">📦 المخزون</div><div class="metric">'+state.inventory.length+'</div><div class="muted">'+low+' أصناف عند حد التنبيه</div></article>'+
 '<article class="card"><div class="card-title">متوسط قيمة الطلب</div><div class="metric">'+money(average)+'</div><div class="muted">للطلبات غير الملغاة ضمن آخر 100 طلب؛ ليس تقرير مبيعات محاسبيًا</div></article>'+
 '</div><div class="card" style="margin-top:16px"><div class="card-title">توزيع الطلبات حسب الحالة</div><div class="action-bar" style="gap:8px;flex-wrap:wrap">'+statuses.map(status=>'<span class="badge">'+status+': '+state.orders.filter(x=>String(x.status||'').toUpperCase()===status).length+'</span>').join('')+'</div></div>';
}
function tabs(){
 return '<div class="action-bar" style="gap:8px;flex-wrap:wrap">'+['dashboard','menu','orders','tables','inventory','reservations'].map(x=>{
 const n={dashboard:'نظرة عامة',menu:'القائمة',orders:'الطلبات',tables:'الطاولات',inventory:'المخزون',reservations:'الحجوزات'}[x];
 return '<button class="btn '+(state.tab===x?'btn-primary':'btn-outline')+'" data-rest-tab="'+x+'">'+n+'</button>';
 }).join('')+'</div>';
}
function menuView(){
 const add=canOperate('CATALOG','create')?'<button class="btn btn-primary" id="rest-add-menu">+ إضافة صنف</button>':'';
 return shell('قائمة الطعام',tabs()+ '<div class="action-bar">'+add+'</div>'+
 '<div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الفئة</th><th>السعر</th><th>الحالة</th><th>الأكثر طلباً</th><th>إجراء</th></tr></thead><tbody>'+
 (state.menu.length?state.menu.map(x=>'<tr><td><b>'+esc(x.name_ar)+'</b><div class="muted">'+esc(x.description_ar)+'</div></td><td>'+esc(x.category)+'</td><td>'+money(x.base_price_egp)+'</td><td>'+ (x.is_available?'متاح':'غير متاح')+'</td><td>'+ (x.is_popular?'نعم':'—')+'</td><td>'+(canOperate('CATALOG','update')?'<button class="linkbtn" data-menu-edit="'+esc(x.id)+'">تعديل</button>':'—')+'</td></tr>').join(''):'<tr><td colspan="6">لا توجد أصناف فعلية بعد.</td></tr>')+
 '</tbody></table></div>');
}
function orderAmount(value,currency){
 const n=Number(value);
 return (Number.isFinite(n)?n:0).toLocaleString('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+esc(currency||'EGP');
}
function orderSnapshotView(order){
 const currency=order.currency||'EGP';
 let items=order.items_json;
 if(typeof items==='string'){
  try{items=JSON.parse(items)}catch(e){items=null}
 }
 if(!Array.isArray(items))return '<p class="muted">تعذر عرض لقطة الأصناف المحفوظة بصيغة منظمة.</p>';
 const rows=items.map(item=>{
  const name=item?.name_ar||item?.name||item?.catalog_item_id||item?.legacy_ref||'صنف';
  const optionDetails=Array.isArray(item?.selected_options)?item.selected_options.map(option=>esc(option?.name||option?.id||'إضافة')+' ('+orderAmount(option?.price_delta,currency)+')').join('، '):'';
  return '<tr><td><b>'+esc(name)+'</b>'+(optionDetails?'<div class="muted">الخيارات: '+optionDetails+'</div>':'')+'</td><td>'+esc(item?.quantity??'—')+'</td><td>'+orderAmount(item?.unit_price,currency)+'</td><td>'+orderAmount(item?.option_total,currency)+'</td><td>'+orderAmount(item?.line_subtotal,currency)+'</td><td>'+orderAmount(item?.line_tax,currency)+'</td></tr>';
 }).join('');
 return '<div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإضافات</th><th>الإجمالي قبل الضريبة</th><th>الضريبة</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">لا توجد أصناف في لقطة الطلب.</td></tr>')+'</tbody></table></div>'+
 '<dl><dt>الإجمالي الفرعي</dt><dd>'+orderAmount(order.subtotal,currency)+'</dd><dt>الخصم</dt><dd>'+orderAmount(order.discount,currency)+'</dd><dt>الضريبة</dt><dd>'+orderAmount(order.tax,currency)+'</dd><dt>التوصيل</dt><dd>'+orderAmount(order.delivery_fee,currency)+'</dd><dt><b>الإجمالي النهائي المحفوظ</b></dt><dd><b>'+orderAmount(order.total_amount??order.total,currency)+'</b></dd></dl>';
}
function ordersView(){
  // Mirror the canonical server transition graph so the UI cannot invite invalid state jumps.
  const transitions={
   PENDING:['CONFIRMED','CANCELLED'],
   CREATED:['CONFIRMED','CANCELLED'],
   CONFIRMED:['PREPARING','CANCELLED'],
   PREPARING:['OUT_FOR_DELIVERY','CANCELLED'],
   OUT_FOR_DELIVERY:['DELIVERED']
  };
  const statusLabels={PENDING:'معلق',CREATED:'جديد',CONFIRMED:'مؤكد',PREPARING:'قيد التجهيز',OUT_FOR_DELIVERY:'خرج للتوصيل',DELIVERED:'تم التسليم',CANCELLED:'ملغي'};
  return shell('طلبات المطعم',tabs()+'<div class="action-bar"><label class="field"><span>بحث في الطلبات المحملة</span><input id="rest-order-search" type="search" maxlength="160" placeholder="رقم الطلب أو العميل أو الهاتف أو الفرع" autocomplete="off"></label><label class="field"><span>تصفية الحالة</span><select id="rest-order-status-filter"><option value="">كل الحالات</option><option value="PENDING">معلق</option><option value="CREATED">جديد</option><option value="CONFIRMED">مؤكد</option><option value="PREPARING">قيد التجهيز</option><option value="OUT_FOR_DELIVERY">خرج للتوصيل</option><option value="DELIVERED">تم التسليم</option><option value="CANCELLED">ملغي</option></select></label><label class="field"><span>من تاريخ</span><input id="rest-order-date-from" type="date"></label><label class="field"><span>إلى تاريخ</span><input id="rest-order-date-to" type="date"></label><span id="rest-order-filter-count" class="muted" aria-live="polite">الطلبات المحملة: '+state.orders.length+'</span><span class="muted">يعرض البحث آخر 100 طلب تم تحميلها لهذا الفرع فقط</span></div><div class="table-wrap"><table><thead><tr><th>الطلب</th><th>العميل</th><th>الفرع</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th><th>تفاصيل</th></tr></thead><tbody>'+
  (state.orders.length?state.orders.map(x=>{
   const current=String(x.status||'').toUpperCase();
   const next=transitions[current]||[];
   const statusControl=canOperate('ORDERS','update')
    ?'<select data-order-status="'+esc(x.id)+'" data-current-status="'+esc(current)+'" '+(next.length?'':'disabled')+'><option selected value="'+esc(current)+'">'+esc(statusLabels[current]||current||'غير محدد')+'</option>'+next.map(s=>'<option value="'+s+'">'+esc(statusLabels[s]||s)+'</option>').join('')+'</select>'
    :esc(current);
   const detailId='rest-order-detail-'+String(x.id).replace(/[^a-zA-Z0-9_-]/g,'');
   const details='<div><b>الهاتف:</b> '+esc(x.customer_phone||'غير مسجل')+'</div><div><b>عنوان التوصيل:</b> '+esc(x.delivery_address||'غير مسجل')+'</div><div><b>ملاحظات:</b> '+esc(x.notes||'لا توجد')+'</div><h4>الأصناف والتسعير المحفوظ</h4>'+orderSnapshotView(x);
   return '<tr data-order-row="1" data-order-status-value="'+esc(current)+'" data-order-search-value="'+esc([x.id,x.customer_name,x.customer_phone,x.branch_id].join(' ').toLocaleLowerCase())+'" data-order-date-value="'+esc(x.created_at||'')+'"><td><b>'+esc(x.id)+'</b></td><td>'+esc(x.customer_name)+'</td><td>'+esc(x.branch_id||'—')+'</td><td>'+money(x.total_amount??x.total)+'</td><td>'+statusControl+'</td><td>'+new Date(x.created_at).toLocaleString('ar-EG')+'</td><td><button class="linkbtn" type="button" data-order-details="'+esc(detailId)+'" aria-expanded="false">التفاصيل</button></td></tr><tr id="'+esc(detailId)+'" hidden><td colspan="7">'+details+'</td></tr>';
  }).join(''):'<tr><td colspan="7">لا توجد طلبات فعلية بعد.</td></tr>')+
  '</tbody></table></div>');
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
   let payload=state.pendingOrderPayload;
   if(!payload){
     const q=new URLSearchParams({tenantId:m.tenant_id,businessId:m.business_id,branchId:m.branch_id,limit:'100'});
     const catalog=await invokeMntyApi('/api/v1/catalog?'+q.toString());
     const items=(catalog?.items||[]).filter(x=>String(x.status).toUpperCase()==='ACTIVE');
     if(!items.length)return notify('لا توجد أصناف من الكتالوج التشغيلي متاحة حالياً.');
     const selection=await askOrderDetails(items);
     if(!selection)return;
     payload={orderId:crypto.randomUUID(),tenantId:m.tenant_id,businessId:m.business_id,branchId:m.branch_id,clientIdempotencyKey:'MNTY-REST-'+crypto.randomUUID(),currency:'EGP',customerName:selection.customerName,customerPhone:selection.customerPhone,deliveryAddress:selection.deliveryAddress,items:[{catalogItemId:selection.item.id,quantity:selection.quantity,selectedOptionIds:[]}],notes:selection.notes,metadata:{source:'RESTAURANTS',catalog_authoritative:true}};
     state.pendingOrderPayload=payload;
   }else if(payload.tenantId!==m.tenant_id||payload.businessId!==m.business_id||payload.branchId!==m.branch_id){
     return notify('يوجد طلب غير مكتمل في نطاق آخر. ارجع إلى المؤسسة والفرع الأصليين لاستكماله.','error');
   }
   const r=await invokeMntyFunction('order-create',payload);
   notify('تم تأكيد الطلب '+(r?.id||payload.orderId)+' من الكتالوج المركزي. الإجمالي محسوب خادميًا.');
   state.pendingOrderPayload=null;
   await load();
 }catch(e){
   notify('تعذر تأكيد الطلب. احتفظنا بنفس مفتاح الطلب لمنع التكرار؛ اضغط «إعادة محاولة الطلب المعلق» قبل إنشاء طلب جديد.','error');
   render();
 }
}
function dashboard(){
 return shell('لوحة المطعم',tabs()+'<div class="action-bar">'+(canOperate('ORDERS','create')?'<button class="btn btn-primary" id="rest-create-order">'+(state.pendingOrderPayload?'إعادة محاولة الطلب المعلق':'+ طلب جديد')+'</button>':'')+'</div>'+(state.pendingOrderPayload?'<div class="notice" role="status">يوجد طلب لم يتأكد رد الخادم بشأنه. إعادة المحاولة ستستخدم نفس رقم الطلب ومفتاح منع التكرار.</div>':'')+cards()+
 '<div class="notice" style="margin-top:16px">البيانات المعروضة حقيقية من قاعدة البيانات. لا يتم إنشاء مطاعم أو طلبات أو مخزون تجريبي تلقائيًا.</div>'+
 '<div class="cards" style="margin-top:16px"><article class="card"><div class="card-title">حدود الأمان</div><div class="muted">كل عمليات الكتابة تمر عبر جلسة المستخدم وRLS ونطاق العضوية. لا يتم تجاوز صلاحيات الخادم.</div></article><article class="card"><div class="card-title">النطاق الحالي</div><div class="muted">'+(scope()?esc(scope().business_id)+' · فرع '+esc(scope().branch_id):'عرض قراءة فقط')+'</div></article></div>');
}
function render(){
 const page=document.getElementById('page');if(!page)return;
 if(state.error){const recovery=state.staleMembershipSelection?'<button class="btn btn-outline" id="rest-clear-membership">مسح الاختيار المحفوظ وإعادة الاختيار</button>':'';page.innerHTML=shell('تعذر تحميل موديول المطاعم',tabs()+'<div class="empty-state">'+esc(state.error)+'<div class="action-bar">'+recovery+'<button class="btn btn-primary" id="rest-retry">إعادة المحاولة</button></div></div>');bind();return;}
 if(state.selectionRequired){page.innerHTML=shell('اختيار المؤسسة والفرع', '<p class="muted">لديك أكثر من عضوية نشطة. اختر النطاق الذي تريد إدارته قبل تحميل بيانات المطعم.</p><div class="cards">'+state.membershipOptions.map(m=>'<article class="card"><div class="card-title">المؤسسة: '+esc(m.tenant_id)+'</div><p>النشاط: '+esc(m.business_id||'غير محدد')+'</p><p>الفرع: '+esc(m.branch_id||'غير محدد')+'</p><p>الدور: '+esc(m.role||'غير محدد')+'</p><button class="btn btn-primary" data-select-membership="'+esc(m.id)+'">اختيار هذا النطاق</button></article>').join('')+'</div>');bind();return;}
 if(state.loading){page.innerHTML=shell('جاري تحميل موديول المطاعم',tabs()+'<p class="muted">جاري تحميل البيانات الفعلية…</p>');return;}
 page.innerHTML=state.tab==='menu'?menuView():state.tab==='orders'?ordersView():state.tab==='tables'?tablesView():state.tab==='inventory'?inventoryView():state.tab==='reservations'?reservationsView():dashboard();
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
 const rows=state.reservations.length?state.reservations.map(r=>{
  const table=state.tables.find(t=>String(t.id)===String(r.table_id));
  const canChange=canOperate('OPERATIONS','update');
  const actions=[];
  if(canChange&&r.status==='PENDING')actions.push('<button class="linkbtn" data-reservation-action="CONFIRM" data-reservation-id="'+esc(r.id)+'">تأكيد</button>');
  if(canChange&&r.status==='CONFIRMED')actions.push('<button class="linkbtn" data-reservation-action="SEAT" data-reservation-id="'+esc(r.id)+'">تم التسكين</button>');
  if(canChange&&['PENDING','CONFIRMED'].includes(r.status))actions.push('<button class="linkbtn" data-reservation-cancel="'+esc(r.id)+'">إلغاء</button><button class="linkbtn" data-reservation-action="NO_SHOW" data-reservation-id="'+esc(r.id)+'">لم يحضر</button>');
  return '<tr><td>'+esc(table?'طاولة '+table.table_number:r.table_id)+'</td><td>'+esc(r.customer_name)+'<div class="muted">'+esc(r.customer_phone||'—')+'</div></td><td>'+esc(r.guest_count)+'</td><td>'+esc(new Date(r.starts_at).toLocaleString('ar-EG'))+'</td><td>'+esc(new Date(r.ends_at).toLocaleString('ar-EG'))+'</td><td>'+esc(r.status)+'</td><td>'+esc(r.notes||'—')+'</td><td>'+ (actions.join(' ')||'—')+'</td></tr>';
 }).join(''):'<tr><td colspan="8">لا توجد حجوزات مسجلة لهذا الفرع بعد.</td></tr>';
 return shell('حجوزات المطعم',tabs()+'<div class="action-bar">'+add+'</div><div class="notice">يتم منع تداخل حجوزات الطاولة على مستوى قاعدة البيانات مع التحقق من السعة ونطاق الفرع.</div><div class="table-wrap"><table><thead><tr><th>الطاولة</th><th>العميل</th><th>الأفراد</th><th>من</th><th>إلى</th><th>الحالة</th><th>ملاحظات</th><th>إجراءات</th></tr></thead><tbody>'+rows+'</tbody></table></div>');
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
 const labels={CONFIRM:'تأكيد الحجز',SEAT:'تسجيل حضور العميل',NO_SHOW:'تسجيل عدم الحضور'};
 if(!window.confirm((labels[action]||'تحديث الحجز')+'؟'))return;
 const {error}=await sb.rpc('restaurant_reservation_mutate',{p_action:action,p_payload:{tenant_id:s.tenant_id,business_id:s.business_id,branch_id:s.branch_id,reservation_id:id}});
 if(error)return notify('تعذر تحديث حالة الحجز. تحقق من الحالة والصلاحيات.','error');
 notify('تم تحديث حالة الحجز.');await load();
}
async function cancelReservation(id){
 if(!canOperate('OPERATIONS','update'))return notify('ليس لديك صلاحية إلغاء الحجوزات.','error');
 const s=scope();if(!s)return notify('لا يوجد نطاق نشاط/فرع نشط.','error');
 if(!window.confirm('هل تريد إلغاء هذا الحجز؟'))return;
 const {error}=await sb.rpc('restaurant_reservation_mutate',{p_action:'CANCEL',p_payload:{tenant_id:s.tenant_id,business_id:s.business_id,branch_id:s.branch_id,reservation_id:id}});
 if(error)return notify('تعذر إلغاء الحجز. قد يكون الحجز قد تم تسكينه أو تغيرت حالته.','error');
 notify('تم إلغاء الحجز.');await load();
}
async function updateOrder(id,status){
 if(!canOperate('ORDERS','update'))return;
 const m=scope(); if(!m)return notify('لا يوجد نطاق نشاط/فرع نشط.');
 try{
  await invokeMntyFunction('order-status-update',{orderId:id,tenantId:m.tenant_id,newStatus:status});
  await load();return true;
 }catch(e){notify('تعذر تحديث حالة الطلب. تحقق من الصلاحيات والاتصال ثم حاول مرة أخرى.','error');return false}
}
function bind(){
 document.querySelectorAll('[data-rest-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.restTab;render()});
 document.getElementById('rest-retry')?.addEventListener('click',load);
 document.getElementById('rest-clear-membership')?.addEventListener('click',()=>{localStorage.removeItem('MNTYActiveMembershipId');load();});
 document.querySelectorAll('[data-select-membership]').forEach(b=>b.addEventListener('click',()=>{const id=b.getAttribute('data-select-membership');if(!state.membershipOptions.some(m=>m.id===id))return;localStorage.setItem('MNTYActiveMembershipId',id);load();}));
 document.getElementById('rest-add-menu')?.addEventListener('click',()=>addMenu());
 document.getElementById('rest-create-order')?.addEventListener('click',createRestaurantOrder);
 document.getElementById('rest-add-table')?.addEventListener('click',()=>addTable());
 document.getElementById('rest-add-inv')?.addEventListener('click',()=>addInventory());
  document.getElementById('rest-add-reservation')?.addEventListener('click',()=>addReservation());
  document.querySelectorAll('[data-reservation-cancel]').forEach(b=>b.addEventListener('click',()=>cancelReservation(b.dataset.reservationCancel)));
  document.querySelectorAll('[data-reservation-action]').forEach(b=>b.addEventListener('click',()=>setReservationAction(b.dataset.reservationId,b.dataset.reservationAction)));
 document.querySelectorAll('[data-menu-edit]').forEach(b=>b.onclick=()=>addMenu(state.menu.find(x=>x.id===b.dataset.menuEdit)));
 document.querySelectorAll('[data-table-edit]').forEach(b=>b.onclick=()=>addTable(state.tables.find(x=>x.id===b.dataset.tableEdit)));
 document.querySelectorAll('[data-inv-edit]').forEach(b=>b.onclick=()=>addInventory(state.inventory.find(x=>x.id===b.dataset.invEdit)));
 document.querySelectorAll('[data-inv-move]').forEach(b=>b.onclick=()=>addInventoryMovement(state.inventory.find(x=>x.id===b.dataset.invMove)));
 document.querySelectorAll('[data-inv-history]').forEach(b=>b.onclick=()=>viewInventoryMovements(state.inventory.find(x=>x.id===b.dataset.invHistory)));
 document.querySelectorAll('[data-order-details]').forEach(b=>b.onclick=()=>{const row=document.getElementById(b.dataset.orderDetails);if(!row)return;const opening=row.hidden;row.hidden=!opening;b.setAttribute('aria-expanded',String(opening));b.textContent=opening?'إخفاء التفاصيل':'التفاصيل';});
  const orderSearch=document.getElementById('rest-order-search');const orderStatusFilter=document.getElementById('rest-order-status-filter');const orderDateFrom=document.getElementById('rest-order-date-from');const orderDateTo=document.getElementById('rest-order-date-to');const orderFilterCount=document.getElementById('rest-order-filter-count');
  const filterOrders=()=>{const term=String(orderSearch?.value||'').trim().toLocaleLowerCase();const status=String(orderStatusFilter?.value||'').toUpperCase();const from=String(orderDateFrom?.value||'');const to=String(orderDateTo?.value||'');if(from&&to&&from>to){orderDateTo.setCustomValidity('تاريخ النهاية يجب ألا يسبق تاريخ البداية');orderDateTo.reportValidity();return;}orderDateTo?.setCustomValidity('');let visibleCount=0;document.querySelectorAll('tr[data-order-row]').forEach(row=>{const matchesText=String(row.dataset.orderSearchValue||'').includes(term);const matchesStatus=!status||row.dataset.orderStatusValue===status;const date=String(row.dataset.orderDateValue||'').slice(0,10);const matchesFrom=!from||!!date&&date>=from;const matchesTo=!to||!!date&&date<=to;const visible=matchesText&&matchesStatus&&matchesFrom&&matchesTo;row.hidden=!visible;if(visible)visibleCount++;const detail=row.nextElementSibling;if(detail&&detail.id?.startsWith('rest-order-detail-')){if(!visible){detail.hidden=true;const button=row.querySelector('[data-order-details]');if(button){button.setAttribute('aria-expanded','false');button.textContent='التفاصيل';}}}});if(orderFilterCount)orderFilterCount.textContent='النتائج: '+visibleCount+' من '+state.orders.length+' طلب محمل';};
  orderSearch?.addEventListener('input',filterOrders);orderStatusFilter?.addEventListener('change',filterOrders);orderDateFrom?.addEventListener('change',filterOrders);orderDateTo?.addEventListener('change',filterOrders);
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