const {createClient}=window.supabase;const cfg=window.MANTIQATIX_CONFIG;const sb=createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'pkce'}});const FN=cfg.supabaseUrl+'/functions/v1/smm-gateway';let user=null,services=[],orders=[],wallet=0,isAdmin=false,tab='home',selected=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const money=n=>Number(n||0).toFixed(4);
async function fn(body){const {data:{session}}=await sb.auth.getSession();const r=await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':cfg.supabaseKey},body:JSON.stringify(body)});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.message||d.error||'حدث خطأ');return d}
async function load(){
  const {data:{session}}=await sb.auth.getSession();
  user=session?.user||null;
  if(!user)return renderAuth();
  try{
    // All restricted SMM reads go through the authenticated server gateway.
    // Never read provider costs, orders, wallets, or memberships directly from the browser.
    const [catalog,account]=await Promise.all([
      fn({action:'catalog'}),
      fn({action:'my_data'})
    ]);
    services=Array.isArray(catalog.services)?catalog.services:[];
    orders=Array.isArray(account.orders)?account.orders:[];
    wallet=Number(account.balance||0);
    isAdmin=account.is_admin===true;
    render();
  }catch(e){
    document.getElementById('app').innerHTML='<div class="wrap"><div class="card"><h2>تعذر تحميل خدمات التسويق</h2><p class="muted">'+esc(e.message)+'</p><button class="btn primary" id="retry">إعادة المحاولة</button><a class="btn outline" href="./">العودة للمنصة</a></div></div>';
    document.getElementById('retry').onclick=load;
  }
}
function renderAuth(){document.getElementById('app').innerHTML='<div class="modal"><div><div class="brand"><span class="logo">M</span>MantiqatiX SMM</div><h2 id="at">تسجيل الدخول</h2><p class="muted">استخدم حساب Google للدخول إلى خدمات MantiqatiX SMM. ستعود إلى هذه الصفحة بعد التحقق من هويتك.</p><div id="am"></div><div class="form"><button class="btn primary" id="google-auth" type="button">🔐 الدخول بحساب Google</button><a class="btn outline" href="./">العودة إلى MantiqatiX</a></div></div></div>';document.getElementById('google-auth').onclick=async()=>{const btn=document.getElementById('google-auth');btn.disabled=true;document.getElementById('am').innerHTML='<div class="notice">جاري تحويلك إلى Google للتحقق من الهوية...</div>';const redirectTo=window.location.origin+window.location.pathname;const r=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{access_type:'online',prompt:'select_account'}}});if(r.error){btn.disabled=false;document.getElementById('am').innerHTML='<div class="notice">'+esc(r.error.message)+'</div>';}}}
function render(){
 document.getElementById('app').innerHTML='<div class="app"><header class="top"><div class="brand"><span class="logo">M</span>MantiqaTiX <span class="muted">SMM</span></div><div class="top-actions"><span class="small">'+esc(user.email)+'</span><button class="btn outline" id="logout">خروج</button></div></header><main class="wrap"><section class="hero"><div><span class="badge">مركز نمو الأعمال</span><h1>نمِّ حضورك الرقمي من مكان واحد</h1><p>اكتشف خدمات الترويج المتاحة، راجع طلباتك وتابع حالتها من خلال واجهة واحدة. توفر الخدمات يعتمد على الكتالوج والمزوّد.</p><div class="hero-actions"><button class="btn primary" data-go="services">تصفح الخدمات</button><button class="btn outline" data-go="orders">متابعة طلباتي</button></div></div><div class="stats"><div class="stat"><small>رصيد الحساب</small><strong>$'+money(wallet)+'</strong></div><div class="stat"><small>الخدمات المتاحة</small><strong>'+services.length+'</strong></div><div class="stat"><small>طلباتي</small><strong>'+orders.length+'</strong></div></div></section><nav class="smm-nav" aria-label="التنقل الرئيسي"><button class="tab '+(tab==='home'?'active':'')+'" data-tab="home">الرئيسية</button><button class="tab '+(tab==='services'?'active':'')+'" data-tab="services">الخدمات</button><button class="tab '+(tab==='orders'?'active':'')+'" data-tab="orders">طلباتي</button><button class="tab '+(tab==='help'?'active':'')+'" data-tab="help">مركز المساعدة</button>'+(isAdmin?'<button class="tab '+(tab==='admin'?'active':'')+'" data-tab="admin">الإدارة</button>':'')+'</nav><section id="view"></section><footer class="smm-footer"><span>MantiqaTiX SMM</span><span>استخدم الخدمات بما يتوافق مع شروط المنصات الرقمية.</span><a href="./">العودة إلى المنصة الرئيسية</a></footer></main></div>';
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});
 document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{tab=b.dataset.go;render()});
 document.getElementById('logout').onclick=async()=>{await sb.auth.signOut();user=null;renderAuth()};
 drawView();
}
function drawDashboard(v){
 const recent=orders.slice(0,5);
 v.innerHTML='<div class="section-heading"><div><span class="badge">لوحة العميل</span><h2>نظرة عامة</h2><p class="muted">تابع نشاطك وانتقل مباشرة إلى الخدمة التي تحتاجها.</p></div><button class="btn primary" data-go="services">+ طلب جديد</button></div><div class="dashboard-grid"><button class="feature-card" data-go="services"><span class="feature-icon">↗</span><h3>اكتشف الخدمات</h3><p>تصفح الخدمات المتاحة حسب نوعها والمنصة المستهدفة.</p><strong>'+services.length+' خدمة متاحة</strong></button><button class="feature-card" data-go="orders"><span class="feature-icon">◷</span><h3>متابعة الطلبات</h3><p>راجع حالة طلباتك السابقة واطلب تحديث الحالة.</p><strong>'+orders.length+' طلب في حسابك</strong></button><div class="feature-card static"><span class="feature-icon">$</span><h3>رصيد الحساب</h3><p>رصيدك الحالي المعروض من بوابة الخادم.</p><strong>$'+money(wallet)+'</strong><small>لإضافة رصيد، استخدم وسيلة الشحن المعتمدة داخل المنصة أو تواصل مع الدعم.</small></div></div><div class="card recent-card"><div class="section-heading"><div><h2>أحدث الطلبات</h2><p class="muted">آخر خمسة طلبات مسجلة في حسابك.</p></div><button class="btn outline" data-go="orders">عرض الكل</button></div>'+(recent.length?'<div class="recent-list">'+recent.map(o=>'<div class="recent-row"><div><strong>'+esc(o.service_name||o.service||'طلب خدمة')+'</strong><div class="muted">'+new Date(o.created_at).toLocaleString('ar-EG')+'</div></div><div class="recent-meta"><strong>$'+money(o.selling_price)+'</strong><span class="pill '+esc(String(o.status||'').toUpperCase())+'">'+esc(statusLabel(o.status))+'</span></div></div>').join('')+'</div>':'<div class="empty-state"><h3>لا توجد طلبات حتى الآن</h3><p class="muted">ابدأ بتصفح الكتالوج واختر خدمة مناسبة لنشاطك.</p><button class="btn primary" data-go="services">تصفح الخدمات</button></div>')+'</div>';
 v.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{tab=b.dataset.go;render()});
}
function statusLabel(s){const x=String(s||'').toUpperCase();return ({PENDING:'قيد الانتظار',PROCESSING:'قيد التنفيذ',SUBMITTING:'قيد التحقق من الطلب',COMPLETED:'مكتمل',FAILED:'فشل',CANCELLED:'ملغي',PARTIAL:'مكتمل جزئيًا',IN_PROGRESS:'قيد التنفيذ'})[x]||'قيد المراجعة'}
function drawHelp(v){
 v.innerHTML='<div class="section-heading"><div><span class="badge">مركز المساعدة</span><h2>كيف تستخدم خدمات SMM؟</h2><p class="muted">خطوات واضحة قبل إرسال أي طلب.</p></div></div><div class="notice">إذا انقطع الاتصال بعد إرسال الطلب أو لم تظهر لك نتيجة مؤكدة، افتح «طلباتي» واضغط «تحديث» قبل التفكير في طلب جديد. لا تكرر الطلب مباشرة؛ فقد يكون المزوّد استلمه بالفعل.</div><div class="help-grid"><article class="card help-card"><span class="step">01</span><h3>اختر الخدمة</h3><p>استخدم البحث والتصنيفات للوصول إلى الخدمة المتاحة للمنصة المطلوبة.</p></article><article class="card help-card"><span class="step">02</span><h3>راجع التفاصيل</h3><p>اقرأ وصف الخدمة وحدود الكمية وسعر كل ألف قبل المتابعة.</p></article><article class="card help-card"><span class="step">03</span><h3>أدخل الرابط والكمية</h3><p>تأكد أن الرابط صحيح وأن الحساب أو المحتوى متاح وفق شروط المنصة.</p></article><article class="card help-card"><span class="step">04</span><h3>تابع حالة الطلب</h3><p>ستجد حالة الطلب ضمن «طلباتي». إذا تأخرت النتيجة، حدّث الحالة أو تواصل مع الدعم.</p></article></div><div class="notice">تنبيه: ظهور الخدمة في الكتالوج لا يعني ضمان نتيجة محددة. لا تستخدم خدمات تخالف شروط المنصات أو تعتمد على تفاعل مضلل.</div><div class="card support-card"><h3>تحتاج إلى مساعدة؟</h3><p class="muted">جهّز رقم طلبك ووصف المشكلة عند التواصل مع فريق الدعم.</p><button class="btn primary" data-go="orders">فتح طلباتي</button></div>';
 v.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{tab=b.dataset.go;render()});
}
function serviceType(s){
 const t=(String(s.name||'')+' '+String(s.category||'')+' '+String(s.description||'')).toLowerCase();
 if(/follower|followers|متابع|مشتركين|subscribers/.test(t))return 'followers';
 if(/view|views|مشاهدات|مشاهدة|impression|reach/.test(t))return 'views';
 if(/like|likes|comment|comments|share|shares|engagement|تفاعل|اعجاب|إعجاب|تعليق|مشاركة/.test(t))return 'engagement';
 return 'other';
}
function drawView(){
 const v=document.getElementById('view');
 if(tab==='home')drawDashboard(v);
 else if(tab==='services'){
  v.innerHTML='<div class="section-heading"><div><span class="badge">كتالوج الخدمات</span><h2>اختر ما يناسب حملتك</h2><p class="muted">استخدم التصنيفات والبحث لتضييق النتائج.</p></div></div><div class="card"><div class="form"><input class="input" id="filter" placeholder="ابحث باسم الخدمة أو المنصة..."><div class="tabs service-filters"><button class="tab active" data-kind="all">كل الخدمات</button><button class="tab" data-kind="followers">المتابعون</button><button class="tab" data-kind="views">المشاهدات</button><button class="tab" data-kind="engagement">التفاعلات</button></div></div></div><div class="grid" id="services"></div>';
  window.smmServiceKind='all';
  document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{window.smmServiceKind=b.dataset.kind;document.querySelectorAll('[data-kind]').forEach(x=>x.classList.toggle('active',x===b));drawServices()});
  drawServices();document.getElementById('filter').oninput=drawServices;
 }else if(tab==='orders')drawOrders(v);
 else if(tab==='help')drawHelp(v);
 else if(tab==='admin'&&isAdmin)drawAdmin(v);
 else {tab='home';drawDashboard(v)}
}
function drawServices(){
 const q=(document.getElementById('filter')?.value||'').toLowerCase();
 const kind=window.smmServiceKind||'all';
 const list=services.filter(s=>(String(s.name||'')+' '+String(s.platform||'')+' '+String(s.category||'')+' '+String(s.description||'')).toLowerCase().includes(q)&&(kind==='all'||serviceType(s)===kind));
 const root=document.getElementById('services');if(!root)return;
 root.innerHTML=list.map(s=>'<article class="card service" data-id="'+esc(s.id)+'"><span class="badge">'+esc(s.platform||'')+'</span><h3>'+esc(s.name||'خدمة')+'</h3><div class="muted">'+esc(s.category||'')+'</div><div class="price">$'+money(s.selling_price)+' <span class="small">/ 1000</span></div><div class="muted">الحد: '+Number(s.min_quantity||0)+' — '+Number(s.max_quantity||0)+' | إعادة التعبئة: '+(s.refill?'نعم':'لا')+'</div><button class="btn primary" style="margin-top:12px">اختيار الخدمة</button></article>').join('')||'<div class="card">لا توجد خدمات مطابقة. جرّب كلمة بحث أخرى أو اختر «كل الخدمات».</div>';
 root.querySelectorAll('.service').forEach(x=>x.onclick=()=>openOrder(x.dataset.id));
}
function drawOrders(v){v.innerHTML='<div class="card"><h2>طلباتي</h2><p class="muted">لا يُعاد الرصيد إلا بعد تأكيد المورّد إلغاء الطلب.</p><table class="table"><thead><tr><th>التاريخ</th><th>الكمية</th><th>السعر</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>'+orders.map(o=>'<tr><td>'+new Date(o.created_at).toLocaleString('ar-EG')+'</td><td>'+o.quantity+'</td><td>
async function drawAdmin(v){v.innerHTML='<div class="admin-grid"><div class="card"><h2>الموردون</h2><div id="providers">جارٍ التحميل...</div></div><div class="card"><h2>شحن رصيد مستخدم</h2><div class="form"><input class="input" id="uid" placeholder="User ID"><input class="input" id="amount" type="number" step="0.01" placeholder="المبلغ USD"><input class="input" id="desc" placeholder="الوصف"><button class="btn primary" id="credit">إضافة الرصيد</button><div id="cm"></div></div></div></div><div class="card admin"><h2>آخر الخدمات</h2><div id="adm-services">جارٍ التحميل...</div></div><div class="card admin"><h2>آخر الطلبات</h2><div id="adm-orders">جارٍ التحميل...</div></div>';try{const d=await fn({action:'admin_data'});document.getElementById('providers').innerHTML=d.providers.map(p=>'<div class="provider-row"><div><b>'+esc(p.name)+'</b><div class="muted">'+esc(p.api_url)+'</div></div><div><button class="btn outline" onclick="configProvider(\''+p.id+'\',\''+esc(p.name)+'\')">API Key</button><button class="btn outline" onclick="syncProvider(\''+p.id+'\')">Sync</button></div></div>').join('');document.getElementById('adm-services').innerHTML='<table class="table"><tr><th>الخدمة</th><th>التكلفة</th><th>سعر البيع</th><th>تعديل</th></tr>'+d.services.slice(0,50).map(s=>'<tr><td>'+esc(s.name)+'</td><td>$'+money(s.provider_cost)+'</td><td><input class="input" id="p'+s.id+'" value="'+s.selling_price+'"></td><td><button class="btn outline" onclick="setPrice(\''+s.id+'\')">حفظ</button></td></tr>').join('')+'</table>';document.getElementById('adm-orders').innerHTML='<table class="table"><tr><th>التاريخ</th><th>المستخدم</th><th>المبلغ</th><th>الربح</th><th>الحالة</th></tr>'+d.orders.map(o=>'<tr><td>'+new Date(o.created_at).toLocaleString('ar-EG')+'</td><td>'+esc(o.user_id)+'</td><td>$'+money(o.selling_price)+'</td><td>$'+money(o.profit)+'</td><td>'+esc(o.status)+'</td></tr>').join('')+'</table>';}catch(e){v.innerHTML+='<div class="notice">'+esc(e.message)+'</div>'}document.getElementById('credit').onclick=async()=>{try{await fn({action:'admin_credit',user_id:document.getElementById('uid').value,amount:Number(document.getElementById('amount').value),description:document.getElementById('desc').value});document.getElementById('cm').innerHTML='<div class="notice success">تم إضافة الرصيد.</div>'}catch(e){document.getElementById('cm').innerHTML='<div class="notice">'+esc(e.message)+'</div>'}}}
async function configProvider(id,name){const key=prompt('أدخل API Key للمزود '+name+' — لن يظهر المفتاح في قاعدة البيانات المكشوفة.');if(!key)return;try{await fn({action:'configure_provider',provider_id:id,api_key:key});alert('تم حفظ مفتاح المزود وتفعيله.');}catch(e){alert(e.message)}}
async function syncProvider(id){try{const r=await fn({action:'sync_services',provider_id:id});alert('تمت مزامنة '+r.count+' خدمة.');load()}catch(e){alert(e.message)}}
async function setPrice(id){const val=document.getElementById('p'+id).value;try{await fn({action:'set_price',service_id:id,selling_price:Number(val)});alert('تم حفظ السعر.');}catch(e){alert(e.message)}}
function openOrder(id){
 selected=services.find(x=>String(x.id)===String(id));if(!selected)return;
 const m=document.createElement('div');m.className='modal';
 m.innerHTML='<div><h2>'+esc(selected.name||'الخدمة')+'</h2><p class="muted">سعر كل 1000: $'+money(selected.selling_price)+'</p><div class="form"><label for="target">رابط الحساب أو المحتوى المستهدف</label><input class="input" id="target" type="url" inputmode="url" placeholder="https://..." autocomplete="url" required><label for="qty">الكمية</label><input class="input" id="qty" type="number" inputmode="numeric" step="1" value="'+Number(selected.min_quantity||1)+'" min="'+Number(selected.min_quantity||1)+'" max="'+Number(selected.max_quantity||1)+'" required><div class="card"><div class="muted">التكلفة التقديرية</div><strong id="total">$'+money(Number(selected.selling_price||0)*Number(selected.min_quantity||1)/1000)+'</strong><div class="muted">تُحسب التكلفة النهائية من الخادم قبل تنفيذ الطلب.</div></div><button class="btn primary" id="place">مراجعة وإرسال الطلب</button><button class="btn outline" id="close">إلغاء</button></div><div id="om" aria-live="polite"></div></div>';
 document.body.appendChild(m);
 const targetEl=m.querySelector('#target'),qtyEl=m.querySelector('#qty'),totalEl=m.querySelector('#total'),place=m.querySelector('#place'),message=m.querySelector('#om');
 const min=Number(selected.min_quantity||1),max=Number(selected.max_quantity||min),unit=Number(selected.selling_price||0);
 const updateTotal=()=>{const q=Number(qtyEl.value);totalEl.textContent='$'+money(Number.isFinite(q)&&q>0?unit*q/1000:0);};
 qtyEl.addEventListener('input',updateTotal);
 m.querySelector('#close').onclick=()=>m.remove();
 place.onclick=async()=>{
  const target=targetEl.value.trim(),qty=Number(qtyEl.value);
  let parsed;
  try{parsed=new URL(target)}catch{}
  if(!parsed||parsed.protocol!=='https:'||!parsed.hostname||parsed.username||parsed.password){message.innerHTML='<div class="notice">أدخل رابطًا عامًا صحيحًا وآمنًا يبدأ بـ https://.</div>';targetEl.focus();return}
  if(!Number.isSafeInteger(qty)||qty<min||qty>max){message.innerHTML='<div class="notice">الكمية يجب أن تكون عددًا صحيحًا بين '+min+' و'+max+'.</div>';qtyEl.focus();return}
  if(!Number.isFinite(unit)||unit<0){message.innerHTML='<div class="notice">تعذر التحقق من سعر الخدمة. أعد تحميل الكتالوج.</div>';return}
  if(!window.confirm('تأكيد الطلب؟ الكمية: '+qty+'، التكلفة التقديرية: $'+money(unit*qty/1000)+'. سيتم اعتماد السعر النهائي من الخادم.'))return;
  place.disabled=true;place.textContent='جارٍ إرسال الطلب...';
  let storageKey=null,idempotencyKey=null;
  try{
   const targetFingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(target)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   storageKey='mnty_smm_idem:'+user.id+':'+selected.id+':'+targetFingerprint+':'+qty;
   idempotencyKey=sessionStorage.getItem(storageKey);
   if(!idempotencyKey){idempotencyKey=crypto.randomUUID();sessionStorage.setItem(storageKey,idempotencyKey);}
  }catch{
   place.disabled=false;place.textContent='مراجعة وإرسال الطلب';
   message.innerHTML='<div class="notice">تعذر حفظ معرّف آمن للطلب في جلسة المتصفح؛ لم يتم إرسال الطلب. فعّل تخزين الجلسة أو استخدم متصفحًا آخر ثم أعد المحاولة.</div>';
   return;
  }
  try{
   const r=await fn({action:'place_order',service_id:selected.id,target_url:target,quantity:qty,idempotency_key:idempotencyKey});
   if(r.pending){message.innerHTML='<div class="notice">تم تسجيل الطلب للتحقق من نتيجته. لا تعِد الإرسال الآن؛ استخدم «طلباتي» لتحديث الحالة. رقم الطلب: '+esc(r.order_id||'—')+'.</div>';place.textContent='متابعة الطلبات';place.onclick=()=>{m.remove();tab='orders';render()};return;}
   if(r.replayed){
    try{sessionStorage.removeItem(storageKey)}catch{}
    message.innerHTML='<div class="notice">تم العثور على طلب سابق بنفس معرّف المحاولة. الحالة الحالية: '+esc(statusLabel(r.status))+'، رقم الطلب: '+esc(r.order_id||'—')+'. لم يتم إنشاء طلب جديد. راجع «طلباتي» لمعرفة التفاصيل.</div>';
    place.textContent='إغلاق';place.onclick=()=>m.remove();return;
   }
   try{sessionStorage.removeItem(storageKey)}catch{}
   message.innerHTML='<div class="notice success">تم استلام الطلب من النظام. رقم الطلب: '+esc(r.order_id||'—')+'. يمكنك متابعة حالته من صفحة «طلباتي».</div>';
   setTimeout(()=>{m.remove();load()},1500);
  }catch(e){message.innerHTML='<div class="notice">تعذر تأكيد نتيجة الإرسال. لا تعِد إرسال الطلب مباشرة؛ افتح «طلباتي» للتحقق أولًا أو تواصل مع الدعم إذا لم يظهر الطلب.</div>';place.textContent='التحقق من طلباتي';place.onclick=()=>{m.remove();tab='orders';render()};}
 };
}
sb.auth.onAuthStateChange(()=>load());load();+money(o.selling_price)+'</td><td><span class="pill '+esc(String(o.status||'').toUpperCase())+'">'+esc(statusLabel(o.status))+'</span>'+(o.provider_status==='cancel_requested'||o.provider_status==='cancel_request_started'?'<div class="muted">طلب الإلغاء قيد التأكيد</div>':'')+'</td><td><button class="btn outline" onclick="syncOrder(\''+o.id+'\')">تحديث</button>'+(o.cancel_supported===true&&['PROCESSING','PENDING'].includes(String(o.status||'').toUpperCase())&&!['cancel_requested','cancel_request_started'].includes(String(o.provider_status||''))?' <button class="btn outline" onclick="cancelOrder(\''+o.id+'\')">طلب إلغاء</button>':'')+'</td></tr>').join('')+'</tbody></table></div>'}
async function syncOrder(id){try{const r=await fn({action:'order_status',order_id:id});if(r?.pending&&r?.error)alert('الحالة تحتاج مراجعة: '+r.error);load()}catch(e){alert(e.message)}}
async function cancelOrder(id){if(!confirm('هل تريد إرسال طلب إلغاء للمورّد؟ لن يُعاد الرصيد إلا بعد تأكيد الإلغاء.'))return;try{const r=await fn({action:'cancel_order',order_id:id});alert(r.message||'تم إرسال طلب الإلغاء للتحقق.');load()}catch(e){alert(e.message)}}
async function drawAdmin(v){v.innerHTML='<div class="admin-grid"><div class="card"><h2>الموردون</h2><div id="providers">جارٍ التحميل...</div></div><div class="card"><h2>شحن رصيد مستخدم</h2><div class="form"><input class="input" id="uid" placeholder="User ID"><input class="input" id="amount" type="number" step="0.01" placeholder="المبلغ USD"><input class="input" id="desc" placeholder="الوصف"><button class="btn primary" id="credit">إضافة الرصيد</button><div id="cm"></div></div></div></div><div class="card admin"><h2>آخر الخدمات</h2><div id="adm-services">جارٍ التحميل...</div></div><div class="card admin"><h2>آخر الطلبات</h2><div id="adm-orders">جارٍ التحميل...</div></div>';try{const d=await fn({action:'admin_data'});document.getElementById('providers').innerHTML=d.providers.map(p=>'<div class="provider-row"><div><b>'+esc(p.name)+'</b><div class="muted">'+esc(p.api_url)+'</div></div><div><button class="btn outline" onclick="configProvider(\''+p.id+'\',\''+esc(p.name)+'\')">API Key</button><button class="btn outline" onclick="syncProvider(\''+p.id+'\')">Sync</button></div></div>').join('');document.getElementById('adm-services').innerHTML='<table class="table"><tr><th>الخدمة</th><th>التكلفة</th><th>سعر البيع</th><th>تعديل</th></tr>'+d.services.slice(0,50).map(s=>'<tr><td>'+esc(s.name)+'</td><td>$'+money(s.provider_cost)+'</td><td><input class="input" id="p'+s.id+'" value="'+s.selling_price+'"></td><td><button class="btn outline" onclick="setPrice(\''+s.id+'\')">حفظ</button></td></tr>').join('')+'</table>';document.getElementById('adm-orders').innerHTML='<table class="table"><tr><th>التاريخ</th><th>المستخدم</th><th>المبلغ</th><th>الربح</th><th>الحالة</th></tr>'+d.orders.map(o=>'<tr><td>'+new Date(o.created_at).toLocaleString('ar-EG')+'</td><td>'+esc(o.user_id)+'</td><td>$'+money(o.selling_price)+'</td><td>$'+money(o.profit)+'</td><td>'+esc(o.status)+'</td></tr>').join('')+'</table>';}catch(e){v.innerHTML+='<div class="notice">'+esc(e.message)+'</div>'}document.getElementById('credit').onclick=async()=>{try{await fn({action:'admin_credit',user_id:document.getElementById('uid').value,amount:Number(document.getElementById('amount').value),description:document.getElementById('desc').value});document.getElementById('cm').innerHTML='<div class="notice success">تم إضافة الرصيد.</div>'}catch(e){document.getElementById('cm').innerHTML='<div class="notice">'+esc(e.message)+'</div>'}}}
async function configProvider(id,name){const key=prompt('أدخل API Key للمزود '+name+' — لن يظهر المفتاح في قاعدة البيانات المكشوفة.');if(!key)return;try{await fn({action:'configure_provider',provider_id:id,api_key:key});alert('تم حفظ مفتاح المزود وتفعيله.');}catch(e){alert(e.message)}}
async function syncProvider(id){try{const r=await fn({action:'sync_services',provider_id:id});alert('تمت مزامنة '+r.count+' خدمة.');load()}catch(e){alert(e.message)}}
async function setPrice(id){const val=document.getElementById('p'+id).value;try{await fn({action:'set_price',service_id:id,selling_price:Number(val)});alert('تم حفظ السعر.');}catch(e){alert(e.message)}}
function openOrder(id){
 selected=services.find(x=>String(x.id)===String(id));if(!selected)return;
 const m=document.createElement('div');m.className='modal';
 m.innerHTML='<div><h2>'+esc(selected.name||'الخدمة')+'</h2><p class="muted">سعر كل 1000: $'+money(selected.selling_price)+'</p><div class="form"><label for="target">رابط الحساب أو المحتوى المستهدف</label><input class="input" id="target" type="url" inputmode="url" placeholder="https://..." autocomplete="url" required><label for="qty">الكمية</label><input class="input" id="qty" type="number" inputmode="numeric" step="1" value="'+Number(selected.min_quantity||1)+'" min="'+Number(selected.min_quantity||1)+'" max="'+Number(selected.max_quantity||1)+'" required><div class="card"><div class="muted">التكلفة التقديرية</div><strong id="total">$'+money(Number(selected.selling_price||0)*Number(selected.min_quantity||1)/1000)+'</strong><div class="muted">تُحسب التكلفة النهائية من الخادم قبل تنفيذ الطلب.</div></div><button class="btn primary" id="place">مراجعة وإرسال الطلب</button><button class="btn outline" id="close">إلغاء</button></div><div id="om" aria-live="polite"></div></div>';
 document.body.appendChild(m);
 const targetEl=m.querySelector('#target'),qtyEl=m.querySelector('#qty'),totalEl=m.querySelector('#total'),place=m.querySelector('#place'),message=m.querySelector('#om');
 const min=Number(selected.min_quantity||1),max=Number(selected.max_quantity||min),unit=Number(selected.selling_price||0);
 const updateTotal=()=>{const q=Number(qtyEl.value);totalEl.textContent='$'+money(Number.isFinite(q)&&q>0?unit*q/1000:0);};
 qtyEl.addEventListener('input',updateTotal);
 m.querySelector('#close').onclick=()=>m.remove();
 place.onclick=async()=>{
  const target=targetEl.value.trim(),qty=Number(qtyEl.value);
  let parsed;
  try{parsed=new URL(target)}catch{}
  if(!parsed||parsed.protocol!=='https:'||!parsed.hostname||parsed.username||parsed.password){message.innerHTML='<div class="notice">أدخل رابطًا عامًا صحيحًا وآمنًا يبدأ بـ https://.</div>';targetEl.focus();return}
  if(!Number.isSafeInteger(qty)||qty<min||qty>max){message.innerHTML='<div class="notice">الكمية يجب أن تكون عددًا صحيحًا بين '+min+' و'+max+'.</div>';qtyEl.focus();return}
  if(!Number.isFinite(unit)||unit<0){message.innerHTML='<div class="notice">تعذر التحقق من سعر الخدمة. أعد تحميل الكتالوج.</div>';return}
  if(!window.confirm('تأكيد الطلب؟ الكمية: '+qty+'، التكلفة التقديرية: $'+money(unit*qty/1000)+'. سيتم اعتماد السعر النهائي من الخادم.'))return;
  place.disabled=true;place.textContent='جارٍ إرسال الطلب...';
  let storageKey=null,idempotencyKey=null;
  try{
   const targetFingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(target)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   storageKey='mnty_smm_idem:'+user.id+':'+selected.id+':'+targetFingerprint+':'+qty;
   idempotencyKey=sessionStorage.getItem(storageKey);
   if(!idempotencyKey){idempotencyKey=crypto.randomUUID();sessionStorage.setItem(storageKey,idempotencyKey);}
  }catch{
   place.disabled=false;place.textContent='مراجعة وإرسال الطلب';
   message.innerHTML='<div class="notice">تعذر حفظ معرّف آمن للطلب في جلسة المتصفح؛ لم يتم إرسال الطلب. فعّل تخزين الجلسة أو استخدم متصفحًا آخر ثم أعد المحاولة.</div>';
   return;
  }
  try{
   const r=await fn({action:'place_order',service_id:selected.id,target_url:target,quantity:qty,idempotency_key:idempotencyKey});
   if(r.pending){message.innerHTML='<div class="notice">تم تسجيل الطلب للتحقق من نتيجته. لا تعِد الإرسال الآن؛ استخدم «طلباتي» لتحديث الحالة. رقم الطلب: '+esc(r.order_id||'—')+'.</div>';place.textContent='متابعة الطلبات';place.onclick=()=>{m.remove();tab='orders';render()};return;}
   if(r.replayed){
    try{sessionStorage.removeItem(storageKey)}catch{}
    message.innerHTML='<div class="notice">تم العثور على طلب سابق بنفس معرّف المحاولة. الحالة الحالية: '+esc(statusLabel(r.status))+'، رقم الطلب: '+esc(r.order_id||'—')+'. لم يتم إنشاء طلب جديد. راجع «طلباتي» لمعرفة التفاصيل.</div>';
    place.textContent='إغلاق';place.onclick=()=>m.remove();return;
   }
   try{sessionStorage.removeItem(storageKey)}catch{}
   message.innerHTML='<div class="notice success">تم استلام الطلب من النظام. رقم الطلب: '+esc(r.order_id||'—')+'. يمكنك متابعة حالته من صفحة «طلباتي».</div>';
   setTimeout(()=>{m.remove();load()},1500);
  }catch(e){message.innerHTML='<div class="notice">تعذر تأكيد نتيجة الإرسال. لا تعِد إرسال الطلب مباشرة؛ افتح «طلباتي» للتحقق أولًا أو تواصل مع الدعم إذا لم يظهر الطلب.</div>';place.textContent='التحقق من طلباتي';place.onclick=()=>{m.remove();tab='orders';render()};}
 };
}
sb.auth.onAuthStateChange(()=>load());load();