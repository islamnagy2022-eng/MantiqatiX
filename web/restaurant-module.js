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

let state={user:null,membership:null,tab:'dashboard',menu:[],orders:[],tables:[],inventory:[],loading:false,error:null};

async function session(){
 const {data,error}=await sb.auth.getSession();
 if(error||!data?.session?.user)return null;
 return data.session.user;
}
async function membership(user){
 const saved=localStorage.getItem('MNTYActiveMembershipId');
 let q=sb.from('user_memberships').select('id,tenant_id,business_id,branch_id,role,status').eq('user_id',user.id).eq('status','ACTIVE');
 if(saved)q=q.eq('id',saved);
 let r=await q.maybeSingle();
 if(!r.data){r=await sb.from('user_memberships').select('id,tenant_id,business_id,branch_id,role,status').eq('user_id',user.id).eq('status','ACTIVE').limit(1).maybeSingle()}
 return r.data||null;
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
 state.user=await session();
 if(!state.user){state.error='AUTH_REQUIRED';return render();}
 state.membership=await membership(state.user);
 if(!state.membership){state.error='لا توجد عضوية تشغيلية نشطة.';return render();}
 state.error=null; state.loading=true; render();
 const s=scope();
 let menuQ=sb.from('restaurant_menu_items').select('id,owner_user_id,name_ar,description_ar,base_price_egp,original_price_egp,category,is_available,is_popular,created_at,updated_at').order('category').order('name_ar').limit(200);
 let ordersQ=sb.from('orders').select('id,tenant_id,business_id,branch_id,customer_id,status,subtotal,discount,tax,delivery_fee,total_amount,total,currency,customer_name,customer_phone,delivery_address,items_json,notes,created_at,updated_at').order('created_at',{ascending:false}).limit(100);
 let tablesQ=sb.from('restaurant_tables').select('id,owner_user_id,table_number,capacity_persons,status,current_active_order_id,current_bill_egp,reserved_customer_name').order('table_number').limit(100);
 let invQ=sb.from('restaurant_inventory').select('id,owner_user_id,name_ar,unit,current_stock_qty,min_stock_alert_threshold,unit_cost_egp,supplier_name,updated_at').order('name_ar').limit(200);
 if(s&&canOperate('CATALOG','view')){
   menuQ=menuQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id);
 }else{
   menuQ=menuQ.eq('is_available',true);
 }
 if(s&&canOperate('ORDERS','view')){
   ordersQ=ordersQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id);
 }else{
   ordersQ=ordersQ.eq('customer_id',state.user.id);
 }
 if(s&&canOperate('OPERATIONS','view')){
   tablesQ=tablesQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id);
   invQ=invQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id);
 }else{
   tablesQ=tablesQ.eq('owner_user_id',state.user.id);
   invQ=invQ.eq('owner_user_id',state.user.id);
 }
 const [a,b,c,d]=await Promise.all([menuQ,ordersQ,tablesQ,invQ]);
 state.menu=a.data||[];state.orders=b.data||[];state.tables=c.data||[];state.inventory=d.data||[];
 const errs=[a,b,c,d].filter(x=>x.error).map(x=>x.error.message);
 state.error=errs.length?errs.join(' | '):null;state.loading=false;render();
}
function shell(title,body){
 return '<section class="workspace-section"><div class="workspace-head"><div><div class="eyebrow">RESTAURANTS</div><h2>'+title+'</h2><p class="muted">إدارة المطعم والقائمة والطلبات والطاولات والمخزون من بيانات Supabase الفعلية فقط.</p></div></div>'+body+'</section>';
}
function cards(){
 const low=state.inventory.filter(x=>Number(x.current_stock_qty)<=Number(x.min_stock_alert_threshold)).length;
 return '<div class="cards">'+
 '<article class="card"><div class="card-title">🍽️ عناصر القائمة</div><div class="metric">'+state.menu.length+'</div><div class="muted">السجلات المتاحة ضمن نطاق العرض</div></article>'+
 '<article class="card"><div class="card-title">🧾 الطلبات</div><div class="metric">'+state.orders.length+'</div><div class="muted">آخر 100 طلب</div></article>'+
 '<article class="card"><div class="card-title">🪑 الطاولات</div><div class="metric">'+state.tables.length+'</div><div class="muted">حالة الطاولات الحالية</div></article>'+
 '<article class="card"><div class="card-title">📦 المخزون</div><div class="metric">'+state.inventory.length+'</div><div class="muted">'+low+' أصناف عند حد التنبيه</div></article>'+
 '</div>';
}
function tabs(){
 return '<div class="action-bar" style="gap:8px;flex-wrap:wrap">'+['dashboard','menu','orders','tables','inventory'].map(x=>{
 const n={dashboard:'نظرة عامة',menu:'القائمة',orders:'الطلبات',tables:'الطاولات',inventory:'المخزون'}[x];
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
function ordersView(){
 const statuses=['CONFIRMED','PREPARING','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];
 return shell('طلبات المطعم',tabs()+'<div class="table-wrap"><table><thead><tr><th>الطلب</th><th>العميل</th><th>الفرع</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>'+
 (state.orders.length?state.orders.map(x=>'<tr><td><b>'+esc(x.id)+'</b></td><td>'+esc(x.customer_name)+'</td><td>'+esc(x.branch_id||'—')+'</td><td>'+money(x.total_amount)+'</td><td>'+(canOperate('ORDERS','update')?'<select data-order-status="'+esc(x.id)+'">'+statuses.map(s=>'<option '+(s===x.status?'selected':'')+'>'+s+'</option>').join('')+'</select>':esc(x.status))+'</td><td>'+new Date(x.created_at).toLocaleString('ar-EG')+'</td></tr>').join(''):'<tr><td colspan="6">لا توجد طلبات فعلية بعد.</td></tr>')+
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
 (state.inventory.length?state.inventory.map(x=>'<tr><td>'+esc(x.name_ar)+'</td><td>'+esc(x.unit)+'</td><td>'+x.current_stock_qty+'</td><td>'+x.min_stock_alert_threshold+'</td><td>'+money(x.unit_cost_egp)+'</td><td>'+esc(x.supplier_name)+'</td><td>'+(canOperate('OPERATIONS','update')?'<button class="linkbtn" data-inv-edit="'+esc(x.id)+'">تعديل</button>':'—')+'</td></tr>').join(''):'<tr><td colspan="7">لا توجد أصناف مخزون فعلية بعد.</td></tr>')+
 '</tbody></table></div>');
}
function askOrderDetails(items){
 return new Promise(resolve=>{
  const options=items.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name_ar||x.name||x.title||x.id)+'</option>').join('');
  modal('تفاصيل الطلب','<label class="field"><span>الصنف من الكتالوج المركزي</span><select id="rest-item" required>'+options+'</select></label>'+field('rest-qty','الكمية','1','number','min="1" step="1" required')+'<div class="action-bar"><button class="btn btn-primary" data-save>إنشاء الطلب</button></div>',async o=>{
   const itemId=o.querySelector('#rest-item')?.value;
   const quantity=Number(o.querySelector('#rest-qty')?.value);
   const item=items.find(x=>String(x.id)===String(itemId));
   if(!item){notify('اختر صنفًا صالحًا من الكتالوج.','error');return;}
   if(!Number.isInteger(quantity)||quantity<1){notify('أدخل كمية صحيحة.','error');return;}
   o.remove();resolve({item,quantity});
  });
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
   const payload={orderId:crypto.randomUUID(),tenantId:m.tenant_id,businessId:m.business_id,branchId:m.branch_id,clientIdempotencyKey:'MNTY-REST-'+crypto.randomUUID(),currency:'EGP',customerName:state.user.email||'',customerPhone:'',deliveryAddress:'',items:[{catalogItemId:selection.item.id,quantity:selection.quantity,selectedOptionIds:[]}],notes:'',metadata:{source:'RESTAURANTS',catalog_authoritative:true}};
   const r=await invokeMntyFunction('order-create',payload);
   notify('تم إنشاء الطلب '+(r?.id||payload.orderId)+' من الكتالوج المركزي. الإجمالي محسوب خادميًا.');
   await load();
 }catch(e){notify('تعذر إنشاء الطلب: '+(e?.message||'خطأ'),'error')}
}
function dashboard(){
 return shell('لوحة المطعم',tabs()+'<div class="action-bar">'+(canOperate('ORDERS','create')?'<button class="btn btn-primary" id="rest-create-order">+ طلب جديد</button>':'')+'</div>'+cards()+
 '<div class="notice" style="margin-top:16px">البيانات المعروضة حقيقية من قاعدة البيانات. لا يتم إنشاء مطاعم أو طلبات أو مخزون تجريبي تلقائيًا.</div>'+
 '<div class="cards" style="margin-top:16px"><article class="card"><div class="card-title">حدود الأمان</div><div class="muted">كل عمليات الكتابة تمر عبر جلسة المستخدم وRLS ونطاق العضوية. لا يتم تجاوز صلاحيات الخادم.</div></article><article class="card"><div class="card-title">النطاق الحالي</div><div class="muted">'+(scope()?esc(scope().business_id)+' · فرع '+esc(scope().branch_id):'عرض قراءة فقط')+'</div></article></div>');
}
function render(){
 const page=document.getElementById('page');if(!page)return;
 if(state.error){page.innerHTML=shell('تعذر تحميل موديول المطاعم',tabs()+'<div class="empty-state">'+esc(state.error)+'<div class="action-bar"><button class="btn btn-primary" id="rest-retry">إعادة المحاولة</button></div></div>');bind();return;}
 if(state.loading){page.innerHTML=shell('جاري تحميل موديول المطاعم',tabs()+'<p class="muted">جاري تحميل البيانات الفعلية…</p>');return;}
 page.innerHTML=state.tab==='menu'?menuView():state.tab==='orders'?ordersView():state.tab==='tables'?tablesView():state.tab==='inventory'?inventoryView():dashboard();
 bind();
}
function modal(title,html,onSave){
 const o=document.createElement('div');o.className='mx-modal';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label',title);o.tabIndex=-1;o.innerHTML='<div class="mx-modal-card"><div class="workspace-head"><h2>'+title+'</h2><button class="btn btn-outline" id="rest-close">إغلاق</button></div><div class="modal-body">'+html+'</div></div>';
 const previousFocus=document.activeElement;document.body.appendChild(o);let closed=false;const close=()=>{if(closed)return;closed=true;o.remove();document.removeEventListener('keydown',onKey);if(previousFocus&&typeof previousFocus.focus==='function')requestAnimationFrame(()=>previousFocus.focus());};const focusables=()=>[...o.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled&&el.offsetParent!==null);const onKey=e=>{if(e.key==='Escape'){e.preventDefault();close();return;}if(e.key!=='Tab')return;const list=focusables();if(!list.length)return;const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}};o.querySelector('#rest-close').setAttribute('aria-label','إغلاق');o.querySelector('#rest-close').onclick=close;o.addEventListener('click',e=>{if(e.target===o)close()});document.addEventListener('keydown',onKey);requestAnimationFrame(()=>o.querySelector('#rest-close')?.focus());
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
  const r=await q;if(r.error)return notify('تعذر الحفظ: '+r.error.message,'error');if(!r.data)return notify('لم يتم الحفظ: الصنف غير موجود في نطاق الفرع أو لا تملك الصلاحية.','error');o.remove();await load();
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
  const r=await q;if(r.error)return notify('تعذر الحفظ: '+r.error.message,'error');if(!r.data)return notify('لم يتم الحفظ: الطاولة خارج نطاق الفرع أو لا تملك الصلاحية.','error');o.remove();await load();
 });
}
function addInventory(existing){
 if(!canOperate('OPERATIONS',existing?'update':'create'))return;
 const x=existing||{};
 modal(existing?'تعديل صنف مخزون':'إضافة صنف مخزون',
 field('name','اسم الصنف',x.name_ar)+field('unit','الوحدة',x.unit||'KG')+(existing?'<div class="notice">لا يمكن تعديل الرصيد مباشرة من هذه الشاشة. استخدم حركة مخزون موثقة عند توفر مسار الحركات.</div>':field('stock','رصيد افتتاحي',x.current_stock_qty||0,'number','step="0.001" min="0"'))+field('min','حد التنبيه',x.min_stock_alert_threshold||0,'number','step="0.001" min="0"')+field('cost','تكلفة الوحدة بالجنيه',x.unit_cost_egp||0,'number','step="0.01" min="0"')+field('supplier','المورد',x.supplier_name||'')+'<button class="btn btn-primary" data-save>حفظ</button>',
 async o=>{
  const s=scope();if(!s)return notify('لا يوجد نطاق نشاط/فرع نشط.');
  const payload={name_ar:o.querySelector('#name').value.trim(),unit:o.querySelector('#unit').value.trim(),min_stock_alert_threshold:Number(o.querySelector('#min').value),unit_cost_egp:Number(o.querySelector('#cost').value),supplier_name:o.querySelector('#supplier').value.trim()};
  if(!existing)payload.current_stock_qty=Number(o.querySelector('#stock').value);
  if(!payload.name_ar||!payload.unit||[payload.min_stock_alert_threshold,payload.unit_cost_egp,...(!existing?[payload.current_stock_qty]:[])].some(v=>!Number.isFinite(v)||v<0))return notify('تحقق من بيانات المخزون.');
  const q=existing?sb.from('restaurant_inventory').update(payload).eq('id',existing.id).eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id).select('id').maybeSingle():sb.from('restaurant_inventory').insert({...payload,id:uid(),owner_user_id:state.user.id,...s}).select('id').single();
  const r=await q;if(r.error)return notify('تعذر الحفظ: '+r.error.message,'error');if(!r.data)return notify('لم يتم الحفظ: صنف المخزون خارج نطاق الفرع أو لا تملك الصلاحية.','error');o.remove();await load();
 });
}
async function updateOrder(id,status){
 if(!canOperate('ORDERS','update'))return;
 const m=scope(); if(!m)return notify('لا يوجد نطاق نشاط/فرع نشط.');
 try{
  await invokeMntyFunction('order-status-update',{orderId:id,tenantId:m.tenant_id,newStatus:status});
  await load();
 }catch(e){notify('تعذر تحديث حالة الطلب: '+(e?.message||'خطأ'))}
}
function bind(){
 document.querySelectorAll('[data-rest-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.restTab;render()});
 document.getElementById('rest-retry')?.addEventListener('click',load);
 document.getElementById('rest-add-menu')?.addEventListener('click',()=>addMenu());
 document.getElementById('rest-create-order')?.addEventListener('click',createRestaurantOrder);
 document.getElementById('rest-add-table')?.addEventListener('click',()=>addTable());
 document.getElementById('rest-add-inv')?.addEventListener('click',()=>addInventory());
 document.querySelectorAll('[data-menu-edit]').forEach(b=>b.onclick=()=>addMenu(state.menu.find(x=>x.id===b.dataset.menuEdit)));
 document.querySelectorAll('[data-table-edit]').forEach(b=>b.onclick=()=>addTable(state.tables.find(x=>x.id===b.dataset.tableEdit)));
 document.querySelectorAll('[data-inv-edit]').forEach(b=>b.onclick=()=>addInventory(state.inventory.find(x=>x.id===b.dataset.invEdit)));
 document.querySelectorAll('[data-order-status]').forEach(s=>s.onchange=async()=>{await updateOrder(s.dataset.orderStatus,s.value)});
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