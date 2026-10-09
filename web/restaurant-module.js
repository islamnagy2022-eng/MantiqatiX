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
 // Persisted membership ID is a selector only; the authenticated DB query is authoritative.
 const saved=window.MNTYActiveMembershipId||localStorage.getItem('MNTYActiveMembershipId');
 const {data,error}=await sb.from('user_memberships')
  .select('id,tenant_id,business_id,branch_id,role,permissions,status')
  .eq('user_id',user.id).eq('status','ACTIVE').limit(100);
 if(error)throw error;
 const active=Array.isArray(data)?data:[];
 if(saved){
  const selected=active.find(m=>m.id===saved);
  if(!selected)throw new Error('ACTIVE_MEMBERSHIP_SELECTION_INVALID');
  return selected;
 }
 if(active.length===1)return active[0];
 if(active.length>1)throw new Error('ACTIVE_MEMBERSHIP_SELECTION_REQUIRED');
 return null;
}
function canOperate(module='CATALOG',action='view'){
 const m=state.membership;
 if(!m||!window.MNTY_RBAC||typeof window.MNTY_RBAC.can!=='function')return false;
 return window.MNTY_RBAC.can(m.role,module,action,m.permissions)===true;
}
function scope(){
 const m=state.membership;
 return m?.tenant_id&&m?.business_id&&m?.branch_id?{tenant_id:m.tenant_id,business_id:m.business_id,branch_id:m.branch_id}:null;
}
async function load(){
 state.user=await session();
 if(!state.user){state.error='AUTH_REQUIRED';return render();}
 try{
  state.membership=await membership(state.user);
 }catch(e){
  state.membership=null;state.loading=false;
  state.error=e?.message==='ACTIVE_MEMBERSHIP_SELECTION_REQUIRED'
   ?'لديك أكثر من عضوية نشطة. اختر العضوية المطلوبة من محدد العضويات ثم أعد المحاولة.'
   :e?.message==='ACTIVE_MEMBERSHIP_SELECTION_INVALID'
    ?'العضوية المحددة لم تعد نشطة أو لا تخص هذا المستخدم. حدّث اختيار العضوية ثم أعد المحاولة.'
    :'تعذر التحقق من العضوية التشغيلية. أعد المحاولة.';
  return render();
 }
 if(!state.membership){state.error='لا توجد عضوية تشغيلية نشطة.';return render();}
 state.error=null; state.loading=true; render();
 const s=scope();
 let ordersQ=sb.from('orders').select('id,tenant_id,business_id,branch_id,customer_id,status,subtotal,discount,tax,delivery_fee,total_amount,total,currency,customer_name,customer_phone,delivery_address,items_json,notes,created_at,updated_at').order('created_at',{ascending:false}).limit(100);
 let tablesQ=sb.from('restaurant_tables').select('id,owner_user_id,tenant_id,business_id,branch_id,table_number,capacity_persons,status,current_active_order_id,current_bill_egp,reserved_customer_name').order('table_number').limit(100);
 let invQ=sb.from('restaurant_inventory').select('id,owner_user_id,tenant_id,business_id,branch_id,name_ar,unit,current_stock_qty,min_stock_alert_threshold,unit_cost_egp,supplier_name,updated_at').order('name_ar').limit(200);
 if(s){
  ordersQ=ordersQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id);
  tablesQ=tablesQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id);
  invQ=invQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id);
 }else{
  ordersQ=ordersQ.eq('customer_id',state.user.id);
  tablesQ=tablesQ.eq('owner_user_id',state.user.id);
  invQ=invQ.eq('owner_user_id',state.user.id);
 }
 const menuPromise=s&&canOperate('CATALOG','view')
  ?invokeMntyApi('/api/v1/catalog?'+new URLSearchParams({tenantId:s.tenant_id,businessId:s.business_id,branchId:s.branch_id,limit:'100'}).toString())
  :Promise.resolve({items:[],prices:[],options:[]});
 const [menuResult,ordersResult,tablesResult,invResult]=await Promise.allSettled([menuPromise,ordersQ,tablesQ,invQ]);
 const catalog=menuResult.status==='fulfilled'?menuResult.value:null;
 const priceRows=(catalog?.prices||[]).filter(p=>String(p.currency||'').toUpperCase()==='EGP');
 state.menu=(catalog?.items||[]).map(item=>{
  const metadata=item.metadata&&typeof item.metadata==='object'?item.metadata:{};
  const candidates=priceRows.filter(p=>String(p.catalog_item_id)===String(item.id)&&(!p.branch_id||String(p.branch_id)===String(s?.branch_id)));
  candidates.sort((a,b)=>{
   const score=x=>((String(x.branch_id||'')===String(s?.branch_id||''))?1000000:0)+Number(x.version||0);
   return score(b)-score(a);
  });
  const price=candidates[0];
  return {id:item.id,owner_user_id:state.user.id,tenant_id:item.tenant_id,business_id:item.business_id,branch_id:item.branch_id,name_ar:item.name_ar,description_ar:item.description||'',category:metadata.category||item.item_type||'عام',base_price_egp:price?Number(price.unit_price):null,is_available:metadata.is_available!==false,is_popular:Boolean(metadata.is_popular),tax_rate:Number(item.tax_rate||0),metadata};
 });
 state.orders=ordersResult.status==='fulfilled'?(ordersResult.value.data||[]):[];
 state.tables=tablesResult.status==='fulfilled'?(tablesResult.value.data||[]):[];
 state.inventory=invResult.status==='fulfilled'?(invResult.value.data||[]):[];
 const errs=[];
 if(menuResult.status==='rejected')errs.push('الكتالوج المركزي غير متاح: '+(menuResult.reason?.message||'خطأ في التحميل'));
 for(const [name,result] of [['orders',ordersResult],['tables',tablesResult],['inventory',invResult]]){
  if(result.status==='rejected')errs.push(name+': '+(result.reason?.message||'تعذر التحميل'));
  else if(result.value.error)errs.push(name+': '+result.value.error.message);
 }
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
 const notice='<div class="notice" role="status">هذه القائمة تُقرأ من الكتالوج المركزي وأسعاره الفعالة. إدارة الأصناف والأسعار متوقفة مؤقتًا داخل هذا المديول إلى أن يُعتمد مسار كتابة خادمي يثبت صلاحية المستخدم ونطاق المنشأة والفرع؛ لن نكتب إلى جدول قديم لا يتحكم في سعر الطلب.</div>';
 return shell('قائمة الطعام — الكتالوج المركزي',tabs()+notice+
 '<div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الفئة</th><th>السعر الفعال</th><th>التوفر</th><th>الأكثر طلباً</th><th>المصدر</th></tr></thead><tbody>'+
 (state.menu.length?state.menu.map(x=>'<tr><td><b>'+esc(x.name_ar)+'</b><div class="muted">'+esc(x.description_ar)+'</div></td><td>'+esc(x.category)+'</td><td>'+(x.base_price_egp==null?'غير مسعّر':money(x.base_price_egp))+'</td><td>'+(x.is_available?'متاح':'غير متاح')+'</td><td>'+(x.is_popular?'نعم':'—')+'</td><td>Catalog v1</td></tr>').join(''):'<tr><td colspan="6">لا توجد أصناف نشطة في الكتالوج المركزي ضمن هذا النطاق.</td></tr>')+
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
 const add=canOperate('CATALOG','create')?'<button class="btn btn-primary" id="rest-add-inv">+ إضافة صنف مخزون</button>':'';
 return shell('مخزون المطعم',tabs()+'<div class="action-bar">'+add+'</div><div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الوحدة</th><th>الرصيد</th><th>حد التنبيه</th><th>تكلفة الوحدة</th><th>المورد</th><th>إجراء</th></tr></thead><tbody>'+
 (state.inventory.length?state.inventory.map(x=>'<tr><td>'+esc(x.name_ar)+'</td><td>'+esc(x.unit)+'</td><td>'+x.current_stock_qty+'</td><td>'+x.min_stock_alert_threshold+'</td><td>'+money(x.unit_cost_egp)+'</td><td>'+esc(x.supplier_name)+'</td><td>'+(canOperate('CATALOG','update')?'<button class="linkbtn" data-inv-edit="'+esc(x.id)+'">تعديل</button>':'—')+'</td></tr>').join(''):'<tr><td colspan="7">لا توجد أصناف مخزون فعلية بعد.</td></tr>')+
 '</tbody></table></div>');
}
function askCart(items,options){
 return new Promise(resolve=>{
  const rows=items.map(item=>{
   const opts=(options||[]).filter(o=>String(o.catalog_item_id)===String(item.id));
   const optionHtml=opts.length?'<label class="field"><span>إضافات '+esc(item.name_ar)+'</span><select multiple data-cart-options="'+esc(item.id)+'">'+opts.map(o=>'<option value="'+esc(o.id)+'">'+esc(o.name_ar||o.name_en||'خيار')+' (+'+money(o.price_delta||0)+')</option>').join('')+'</select></label>':'';
   return '<div class="card" style="margin:10px 0;padding:12px"><label><input type="checkbox" data-cart-select="'+esc(item.id)+'"> <b>'+esc(item.name_ar)+'</b></label><div class="muted">'+(item.base_price_egp==null?'السعر حسب الكتالوج':money(item.base_price_egp))+'</div><label class="field"><span>الكمية</span><input data-cart-qty="'+esc(item.id)+'" type="number" min="1" max="1000" step="1" value="1" required></label>'+optionHtml+'</div>';
  }).join('');
  const html='<div class="notice">اختر صنفًا واحدًا أو أكثر. سيُعاد احتساب الأسعار والضرائب خادميًا من الكتالوج المركزي.</div>'+
   '<div class="field"><label for="cart-customer-name">اسم العميل</label><input id="cart-customer-name" required></div>'+
   '<div class="field"><label for="cart-customer-phone">هاتف العميل</label><input id="cart-customer-phone" type="tel" required></div>'+
   '<div class="field"><label for="cart-order-type">نوع الطلب</label><select id="cart-order-type"><option value="TAKEAWAY">استلام من المطعم</option><option value="DELIVERY">توصيل</option></select></div>'+
   '<div class="field"><label for="cart-address">عنوان التوصيل</label><input id="cart-address"></div>'+
   '<div class="notice">ربط الطلب بالطاولة وتغيير حالتها تلقائيًا غير متاحين قبل اعتماد مسار خادمي ذري.</div>'+rows+
   '<button class="btn btn-primary" data-save>إنشاء الطلب</button>';
  modal('سلة طلب المطعم',html,async o=>{
   const customerName=o.querySelector('#cart-customer-name').value.trim();
   const customerPhone=o.querySelector('#cart-customer-phone').value.trim();
   const orderType=o.querySelector('#cart-order-type').value;
   const deliveryAddress=o.querySelector('#cart-address').value.trim();
   const digits=customerPhone.replace(/[^0-9]/g,'');
   if(!customerName)return notify('أدخل اسم العميل.','error');
   if(digits.length<7||digits.length>15)return notify('أدخل رقم هاتف صحيحًا.','error');
   if(orderType==='DELIVERY'&&!deliveryAddress)return notify('أدخل عنوان التوصيل.','error');
   const selected=[...o.querySelectorAll('[data-cart-select]:checked')];
   if(!selected.length)return notify('اختر صنفًا واحدًا على الأقل.','error');
   const orderItems=[];
   for(const checkbox of selected){
    const id=checkbox.dataset.cartSelect;
    const quantity=Number(o.querySelector('[data-cart-qty="'+id+'"]').value);
    if(!Number.isInteger(quantity)||quantity<1||quantity>1000)return notify('تحقق من كميات الأصناف المختارة.','error');
    const select=o.querySelector('[data-cart-options="'+id+'"]');
    orderItems.push({catalogItemId:id,quantity,selectedOptionIds:select?[...select.selectedOptions].map(x=>x.value):[]});
   }
   o.remove();resolve({items:orderItems,customerName,customerPhone,deliveryAddress,orderType});
  },()=>resolve(null));
 });
}
let creatingOrder=false,pendingOrderAttempt=null;
async function createRestaurantOrder(){
 if(creatingOrder)return;
 if(!state.user||!scope()||!canOperate('ORDERS','create'))return notify('لا تملك صلاحية إنشاء طلب ضمن نطاق المطعم الحالي.','error');
 creatingOrder=true;const createButton=document.getElementById('rest-create-order');if(createButton)createButton.disabled=true;
 const m=scope();
 try{
   const q=new URLSearchParams({tenantId:m.tenant_id,businessId:m.business_id,branchId:m.branch_id,limit:'100'});
   const catalog=await invokeMntyApi('/api/v1/catalog?'+q.toString());
   const available=(catalog?.items||[]).filter(x=>String(x.status).toUpperCase()==='ACTIVE'&&x.metadata?.is_available!==false)
    .map(x=>({...x,base_price_egp:state.menu.find(m=>String(m.id)===String(x.id))?.base_price_egp}));
   if(!available.length)return notify('لا توجد أصناف متاحة في الكتالوج المركزي.');
   const cart=await askCart(available,catalog?.options||[]);
   if(!cart)return;
   const intent={tenantId:m.tenant_id,businessId:m.business_id,branchId:m.branch_id,currency:'EGP',customerName:cart.customerName,customerPhone:cart.customerPhone,deliveryAddress:cart.deliveryAddress,items:cart.items,notes:'',metadata:{source:'RESTAURANTS',catalog_authoritative:true,order_type:cart.orderType}};
   const fingerprint=JSON.stringify(intent);
   if(!pendingOrderAttempt||pendingOrderAttempt.fingerprint!==fingerprint)pendingOrderAttempt={fingerprint,orderId:crypto.randomUUID(),key:'MNTY-REST-'+crypto.randomUUID()};
   const payload={...intent,orderId:pendingOrderAttempt.orderId,clientIdempotencyKey:pendingOrderAttempt.key};
   const result=await invokeMntyFunction('order-create',payload);
   notify('تم تأكيد إنشاء الطلب '+(result?.id||payload.orderId)+'. الأسعار والضرائب محسوبة خادميًا.');
   pendingOrderAttempt=null;
   await load();
 }catch(e){notify('تعذر إنشاء الطلب: '+(e?.message||'خطأ'),'error')}finally{creatingOrder=false;if(createButton&&createButton.isConnected)createButton.disabled=false}
}
function dashboard(){
 return shell('لوحة المطعم',tabs()+(canOperate('ORDERS','create')?'<div class="action-bar"><button class="btn btn-primary" id="rest-create-order">+ طلب جديد</button></div>':'')+cards()+
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
function modal(title,html,onSave,onCancel){
 const o=document.createElement('div');o.className='mx-modal';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label',title);o.tabIndex=-1;o.innerHTML='<div class="mx-modal-card"><div class="workspace-head"><h2>'+title+'</h2><button class="btn btn-outline" id="rest-close">إغلاق</button></div><div class="modal-body">'+html+'</div></div>';
 const previousFocus=document.activeElement;document.body.appendChild(o);let closed=false;const close=()=>{if(closed)return;closed=true;o.remove();document.removeEventListener('keydown',onKey);if(previousFocus&&typeof previousFocus.focus==='function')requestAnimationFrame(()=>previousFocus.focus());if(typeof onCancel==='function')onCancel();};const focusables=()=>[...o.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled&&el.offsetParent!==null);const onKey=e=>{if(e.key==='Escape'){e.preventDefault();close();return;}if(e.key!=='Tab')return;const list=focusables();if(!list.length)return;const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}};o.querySelector('#rest-close').setAttribute('aria-label','إغلاق');o.querySelector('#rest-close').onclick=close;o.addEventListener('click',e=>{if(e.target===o)close()});document.addEventListener('keydown',onKey);requestAnimationFrame(()=>o.querySelector('#rest-close')?.focus());
 let saving=false;const save=o.querySelector('[data-save]');save?.addEventListener('click',async()=>{if(saving)return;saving=true;if(save)save.disabled=true;try{await onSave(o)}catch(e){notify('تعذر إتمام العملية: '+(e?.message||'خطأ غير متوقع'),'error')}finally{if(o.isConnected){saving=false;if(save)save.disabled=false}}});
}
function field(id,label,value='',type='text',extra=''){return '<label class="field"><span>'+label+'</span><input id="'+id+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>'}
const TABLE_TRANSITIONS={EMPTY:['OCCUPIED','RESERVED','CLEANING','OUT_OF_SERVICE'],OCCUPIED:['EMPTY','CLEANING','OUT_OF_SERVICE'],RESERVED:['EMPTY','OCCUPIED','CLEANING','OUT_OF_SERVICE'],CLEANING:['EMPTY','OUT_OF_SERVICE'],OUT_OF_SERVICE:['EMPTY','CLEANING']};
function addTable(existing){
 if(!canOperate('OPERATIONS',existing?'update':'create'))return notify('لا تملك صلاحية إدارة الطاولات.','error');
 const x=existing||{};
 modal(existing?'تعديل طاولة':'إضافة طاولة',
 field('num','رقم الطاولة',x.table_number,'number','min="1" step="1" required')+field('cap','السعة',x.capacity_persons||2,'number','min="1" step="1" required')+
 '<label class="field"><span>الحالة</span><select id="status"><option '+((x.status||'EMPTY')==='EMPTY'?'selected':'')+'>EMPTY</option><option '+(x.status==='OCCUPIED'?'selected':'')+'>OCCUPIED</option><option '+(x.status==='RESERVED'?'selected':'')+'>RESERVED</option><option '+(x.status==='CLEANING'?'selected':'')+'>CLEANING</option><option '+(x.status==='OUT_OF_SERVICE'?'selected':'')+'>OUT_OF_SERVICE</option></select></label>'+
 field('reserved','اسم الحجز',x.reserved_customer_name||'')+'<button class="btn btn-primary" data-save>حفظ</button>',
 async o=>{
  const s=scope();if(!s)return notify('لا يوجد نطاق نشاط/فرع نشط.');
  const payload={table_number:Number(o.querySelector('#num').value),capacity_persons:Number(o.querySelector('#cap').value),status:o.querySelector('#status').value,reserved_customer_name:o.querySelector('#reserved').value.trim()||null};
  if(!Number.isInteger(payload.table_number)||payload.table_number<1||!Number.isInteger(payload.capacity_persons)||payload.capacity_persons<1)return notify('أدخل رقم وسعة صحيحين.');
   if(existing&&payload.status!==existing.status&&!(TABLE_TRANSITIONS[existing.status]||[]).includes(payload.status))return notify('انتقال حالة الطاولة غير مسموح.','error');
   if(existing?.current_active_order_id&&payload.status==='EMPTY')return notify('لا يمكن تحرير الطاولة قبل إغلاق الطلب النشط المرتبط بها.','error');
  if(!existing&&state.tables.some(t=>Number(t.table_number)===payload.table_number))return notify('رقم الطاولة مستخدم بالفعل ضمن الطاولات المعروضة.','error');
  let q=existing?sb.from('restaurant_tables').update(payload).eq('id',existing.id).eq('owner_user_id',state.user.id).eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id):sb.from('restaurant_tables').insert({...payload,id:uid(),owner_user_id:state.user.id,current_active_order_id:null,current_bill_egp:0,...s});
  const r=await q;if(r.error)return notify('تعذر الحفظ: '+r.error.message,'error');o.remove();await load();
 });
}
function addInventory(existing){
 if(!canOperate('CATALOG',existing?'update':'create'))return notify('لا تملك صلاحية إدارة المخزون.','error');
 const x=existing||{};
 modal(existing?'تعديل صنف مخزون':'إضافة صنف مخزون',
 field('name','اسم الصنف',x.name_ar)+field('unit','الوحدة',x.unit||'KG')+field('stock','الرصيد الحالي',x.current_stock_qty||0,'number','step="0.001" min="0"')+field('min','حد التنبيه',x.min_stock_alert_threshold||0,'number','step="0.001" min="0"')+field('cost','تكلفة الوحدة بالجنيه',x.unit_cost_egp||0,'number','step="0.01" min="0"')+field('supplier','المورد',x.supplier_name||'')+'<button class="btn btn-primary" data-save>حفظ</button>',
 async o=>{
  const s=scope();if(!s)return notify('لا يوجد نطاق نشاط/فرع نشط.');
  const payload={name_ar:o.querySelector('#name').value.trim(),unit:o.querySelector('#unit').value.trim(),current_stock_qty:Number(o.querySelector('#stock').value),min_stock_alert_threshold:Number(o.querySelector('#min').value),unit_cost_egp:Number(o.querySelector('#cost').value),supplier_name:o.querySelector('#supplier').value.trim()};
  if(!payload.name_ar||!payload.unit||[payload.current_stock_qty,payload.min_stock_alert_threshold,payload.unit_cost_egp].some(v=>!Number.isFinite(v)||v<0))return notify('تحقق من بيانات المخزون.');
  const q=existing?sb.from('restaurant_inventory').update(payload).eq('id',existing.id).eq('owner_user_id',state.user.id).eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id):sb.from('restaurant_inventory').insert({...payload,id:uid(),owner_user_id:state.user.id,...s});
  const r=await q;if(r.error)return notify('تعذر الحفظ: '+r.error.message,'error');o.remove();await load();
 });
}
async function updateOrder(id,status){
 if(!canOperate('ORDERS','update'))return notify('لا تملك صلاحية تحديث الطلبات.','error');
 const m=scope(); if(!m)return notify('لا يوجد نطاق نشاط/فرع نشط.');
 try{
  await invokeMntyFunction('order-status-update',{orderId:id,tenantId:m.tenant_id,newStatus:status});
  await load();
 }catch(e){notify('تعذر تحديث حالة الطلب: '+(e?.message||'خطأ'))}
}
function bind(){
 document.querySelectorAll('[data-rest-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.restTab;render()});
 document.getElementById('rest-retry')?.addEventListener('click',load);
  document.getElementById('rest-create-order')?.addEventListener('click',createRestaurantOrder);
 document.getElementById('rest-add-table')?.addEventListener('click',()=>addTable());
 document.getElementById('rest-add-inv')?.addEventListener('click',()=>addInventory());
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