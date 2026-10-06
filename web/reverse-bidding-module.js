(function(){
'use strict';
const cfg=window.MANTIQATIX_CONFIG;
const sb=window.MNTY_SB || (window.supabase && window.supabase.createClient ? window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey) : null);
if(sb) window.MNTY_SB=sb;
if(!cfg || !sb)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2})+' ج.م';
let user=null,tab='requests',requests=[],bids=[],loading=false,error=null;

const RC40_DOMAINS=[
 ['HOME_MAINTENANCE','خدمات المنزل والصيانة','سباكة، كهرباء، تكييف، نجارة، دهانات أو صيانة منزلية','فني / شركة صيانة','اكتب نوع العطل ومكانه وما تم تجربته بالفعل.'],
 ['DIGITAL_MARKETING','التسويق الرقمي','إدارة صفحات، إعلانات ممولة، محتوى، تصميم، SEO أو استراتيجية','وكالة / مستقل','اذكر المنصات، الجمهور المستهدف، الميزانية والنتيجة المطلوبة.'],
 ['SOFTWARE_ERP','البرمجيات وERP','نظام ERP، موقع، تطبيق، تكامل API أو تطوير مخصص','شركة برمجيات / مستقل','اذكر الوظائف الأساسية، المستخدمين، التكاملات والموعد المطلوب.'],
 ['ACCOUNTING_SERVICES','الخدمات المحاسبية','محاسبة، ضرائب، مراجعة، رواتب أو إعداد تقارير مالية','محاسب / مكتب محاسبة','اذكر نوع النشاط والفترة والخدمة المطلوبة.'],
 ['LEGAL_SERVICES','الخدمات القانونية','استشارات، عقود، تأسيس شركات أو مراجعة مستندات','محامٍ / مكتب محاماة','اذكر نوع المعاملة والوثائق المتاحة دون إدخال بيانات حساسة.'],
 ['FLIGHTS_TRIPS','السفر والرحلات','رحلات، فنادق، برامج سياحية أو تنقلات','شركة سياحة / وكيل سفر','اذكر الوجهة والتاريخ وعدد المسافرين وأي تفضيلات مهمة.'],
 ['FACTORIES','المصانع والخدمات الصناعية','توريد، تصنيع، صيانة خطوط أو خدمات صناعية','مصنع / مورد / مقاول','اذكر المواصفات والكميات والطاقة أو المقاس والموعد المطلوب.'],
 ['COMPANIES','خدمات الشركات','توريد، تشغيل، استشارات، موارد بشرية أو خدمات أعمال','شركة / مزود متخصص','اذكر نطاق العمل، عدد الفروع/الموظفين والنتيجة المطلوبة.']
];

function domainInfo(key){return RC40_DOMAINS.find(x=>x[0]===key)||RC40_DOMAINS[0];}

async function load(){
 const s=await sb.auth.getSession();
 user=s.data?.session?.user||null;
 if(!user){error='AUTH_REQUIRED';return render();}
 loading=true;error=null;render();
 const [r,b]=await Promise.all([
  sb.from('indrive_requests').select('id,owner_user_id,domain_type,category_name,title,details_description,user_proposed_price,target_provider_type,req_location_district,status,accepted_bid_id,created_at,idempotency_key').order('created_at',{ascending:false}).limit(100),
  sb.from('indrive_bids').select('id,request_id,provider_user_id,provider_name,provider_type,provider_rating,completed_orders_count,offered_price,note,estimated_delivery_time,created_at,status').order('created_at',{ascending:false}).limit(200)
 ]);
 requests=r.data||[];bids=b.data||[];
 const e=[r.error,b.error].filter(Boolean);error=e.length?e.map(x=>x.message).join(' | '):null;
 loading=false;render();
}

function shell(body){
 return '<section class="workspace-section"><div class="workspace-head"><div><div class="eyebrow">REVERSE BIDDING</div><h2>🤝 طلب خدمة واستقبال عروض</h2><p class="muted">اختر المجال ثم صف احتياجك مرة واحدة. الطلب يُحفظ في النظام الحالي وتظهر العروض وفق صلاحيات RLS.</p></div></div>'+body+'</section>';
}
function tabs(){
 return '<div class="action-bar" style="gap:8px;flex-wrap:wrap"><button class="btn '+(tab==='requests'?'btn-primary':'btn-outline')+'" data-btab="requests">الطلبات</button><button class="btn '+(tab==='bids'?'btn-primary':'btn-outline')+'" data-btab="bids">العروض</button><button class="btn btn-primary" id="add-request">+ طلب خدمة</button><button class="btn btn-outline" id="refresh-bids">تحديث</button></div>';
}
function requestsView(){
 return shell(tabs()+'<div class="table-wrap"><table><thead><tr><th>الطلب</th><th>المجال</th><th>العنوان</th><th>السعر المقترح</th><th>النطاق</th><th>الحالة</th><th>العروض</th><th>إجراء</th></tr></thead><tbody>'+
 (requests.length?requests.map(r=>{const bs=bids.filter(b=>b.request_id===r.id);const action=r.owner_user_id===user?.id&&r.status!=='COMPLETED'&&r.status!=='CANCELLED'?'<button class="linkbtn" data-view-bids="'+esc(r.id)+'">مقارنة العروض ('+bs.length+')</button>':'—';return '<tr><td><b>'+esc(r.id)+'</b></td><td>'+esc(r.domain_type)+'</td><td>'+esc(r.title)+'</td><td>'+money(r.user_proposed_price)+'</td><td>'+esc(r.req_location_district||'—')+'</td><td>'+esc(r.status)+'</td><td>'+bs.length+'</td><td>'+action+'</td></tr>';}).join(''):'<tr><td colspan="8">لا توجد طلبات فعلية.</td></tr>')+
 '</tbody></table></div><div id="bid-panel"></div>');
}
function bidPanel(requestId){
 const r=requests.find(x=>x.id===requestId); if(!r)return '';
 const bs=bids.filter(x=>x.request_id===requestId);
 return '<div class="card" style="margin-top:16px"><div class="workspace-head"><div><div class="eyebrow">OFFERS</div><h3>عروض: '+esc(r.title)+'</h3><p class="muted">اختر العرض المناسب. القبول النهائي يتم من الخادم مع قفل الطلب لمنع التنافس المتزامن.</p></div></div>'+
 (bs.length?'<div class="cards">'+bs.map(b=>'<article class="card"><b>'+esc(b.provider_name||'مقدم خدمة')+'</b><div class="muted">'+esc(b.provider_type||'')+' · تقييم '+esc(b.provider_rating??'—')+'</div><h3>'+money(b.offered_price)+'</h3><p>'+esc(b.note||'')+'</p><small>'+esc(b.estimated_delivery_time||'')+'</small><div class="action-bar">'+(r.owner_user_id===user?.id&&r.status!=='COMPLETED'&&r.status!=='CANCELLED'?'<button class="btn btn-primary" data-accept-bid="'+esc(b.id)+'" data-request-id="'+esc(r.id)+'">قبول العرض</button><button class="btn btn-outline" data-reject-bid="'+esc(b.id)+'" data-request-id="'+esc(r.id)+'">رفض</button><button class="btn btn-outline" data-counter-bid="'+esc(b.id)+'" data-request-id="'+esc(r.id)+'">مزايدة مضادة</button>':'')+'</div></article>').join('')+'</div>':'<div class="empty-state">لا توجد عروض بعد.</div>')+
 '</div>';
}
function bidsView(){
 return shell(tabs()+'<div class="table-wrap"><table><thead><tr><th>الطلب</th><th>مقدم الخدمة</th><th>النوع</th><th>العرض</th><th>التقييم</th><th>المدة</th><th>الحالة</th></tr></thead><tbody>'+
 (bids.length?bids.map(b=>'<tr><td>'+esc(b.request_id)+'</td><td>'+esc(b.provider_name)+'</td><td>'+esc(b.provider_type)+'</td><td>'+money(b.offered_price)+'</td><td>'+esc(b.provider_rating??'—')+'</td><td>'+esc(b.estimated_delivery_time||'—')+'</td><td>'+esc(b.status)+'</td></tr>').join(''):'<tr><td colspan="7">لا توجد عروض مرئية وفق سياسة الوصول الحالية.</td></tr>')+
 '</tbody></table></div>');
}
function providerForm(){
 return '<div class="card" style="margin-top:16px"><div class="eyebrow">PROVIDER</div><h3>تقديم عرض على طلب</h3><div class="grid-2"><input id="bRequestId" class="input" placeholder="معرّف الطلب"><input id="bName" class="input" placeholder="اسم مقدم الخدمة"><input id="bType" class="input" placeholder="نوع مقدم الخدمة"><input id="bPrice" class="input" type="number" min="0" step="0.01" placeholder="السعر المقترح"><input id="bEta" class="input" placeholder="المدة المتوقعة"><textarea id="bNote" class="input" placeholder="ملاحظات العرض"></textarea></div><button class="btn btn-primary" id="save-bid">إرسال العرض</button><p class="muted" style="margin-top:8px">لا يمكن لصاحب الطلب تقديم عرض على طلبه، ولا يمكن إرسال عرضين من نفس الحساب على نفس الطلب.</p></div>';
}
function form(){
 const d=domainInfo('HOME_MAINTENANCE');
 return '<div class="card" style="margin-top:16px;border:1px solid var(--border-color,#ddd);padding:20px">'+
 '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div class="eyebrow">RC40 SERVICE FLOW</div><h3 style="margin:4px 0">انشر احتياجك واحصل على عروض</h3><p id="rHint" class="muted" style="margin:0">'+esc(d[2])+'</p></div><span class="badge">بيانات فعلية</span></div>'+
 '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0">'+RC40_DOMAINS.map((x,i)=>'<button type="button" class="btn '+(i===0?'btn-primary':'btn-outline')+' mg-domain" data-domain="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'+
 '<div class="grid-2">'+
 '<select id="rDomain" class="input" aria-label="المجال">'+RC40_DOMAINS.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select>'+
 '<input id="rCategory" class="input" placeholder="التصنيف أو نوع الخدمة">'+
 '<input id="rTitle" class="input" placeholder="عنوان مختصر للطلب">'+
 '<input id="rPrice" class="input" type="number" min="0" step="0.01" placeholder="الميزانية المقترحة بالجنيه">'+
 '<input id="rProvider" class="input" placeholder="'+esc(d[3])+'">'+
 '<input id="rDistrict" class="input" placeholder="المدينة / الحي / نطاق التنفيذ">'+
 '<textarea id="rDetails" class="input" rows="5" placeholder="'+esc(d[4])+'"></textarea>'+
 '</div>'+
 '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-top:14px"><small class="muted">لا تضف كلمات مرور أو بيانات مالية/هوية حساسة داخل وصف الطلب.</small><button class="btn btn-primary" id="save-request">نشر الطلب واستقبال العروض</button></div>'+
 '</div>';
}
function syncDomain(key){
 const d=domainInfo(key);
 const hint=document.getElementById('rHint'),provider=document.getElementById('rProvider'),details=document.getElementById('rDetails');
 if(hint)hint.textContent=d[2];
 if(provider)provider.placeholder=d[3];
 if(details)details.placeholder=d[4];
 document.querySelectorAll('.mg-domain').forEach(b=>{const active=b.dataset.domain===key;b.classList.toggle('btn-primary',active);b.classList.toggle('btn-outline',!active);});
}
async function createRequest(){
 if(!user)return;
 const p={p_user_id:user.id,p_domain_type:document.getElementById('rDomain').value.trim().toUpperCase(),p_category_name:document.getElementById('rCategory').value.trim(),p_title:document.getElementById('rTitle').value.trim(),p_details_description:document.getElementById('rDetails').value.trim(),p_user_proposed_price:Number(document.getElementById('rPrice').value)||0,p_target_provider_type:document.getElementById('rProvider').value.trim(),p_req_location_district:document.getElementById('rDistrict').value.trim(),p_idempotency_key:crypto.randomUUID()};
 if(!p.domain_type||!p.title||!p.details_description)return alert('أكمل المجال والعنوان والتفاصيل.');
 const button=document.getElementById('save-request');if(button){button.disabled=true;button.textContent='جارٍ نشر الطلب…';}
 const r=await sb.rpc('create_indrive_request_backend',p);
 if(r.error){if(button){button.disabled=false;button.textContent='نشر الطلب واستقبال العروض';}return alert(r.error.message);}
 await load();
}
async function createBid(){
 const requestId=document.getElementById('bRequestId')?.value.trim(); const price=Number(document.getElementById('bPrice')?.value)||0;
 if(!requestId||price<0)return alert('أدخل معرّف الطلب وسعرًا صحيحًا.');
 const r=await sb.rpc('create_indrive_bid_backend',{p_user_id:user.id,p_request_id:requestId,p_provider_name:document.getElementById('bName').value.trim(),p_provider_type:document.getElementById('bType').value.trim(),p_offered_price:price,p_note:document.getElementById('bNote').value.trim(),p_estimated_delivery_time:document.getElementById('bEta').value.trim()});
 if(r.error)return alert(r.error.message); await load();
}
async function acceptBid(requestId,bidId){const r=await sb.rpc('accept_indrive_bid',{p_request_id:requestId,p_bid_id:bidId});if(r.error)return alert(r.error.message);await load();}
async function rejectBid(requestId,bidId){const r=await sb.rpc('reject_indrive_bid',{p_request_id:requestId,p_bid_id:bidId});if(r.error)return alert(r.error.message);await load();}
async function counterBid(requestId,bidId){const price=Number(prompt('السعر المضاد'));if(!Number.isFinite(price)||price<0)return;const r=await sb.rpc('counter_offer_indrive_bid',{p_request_id:requestId,p_bid_id:bidId,p_new_counter_price:price});if(r.error)return alert(r.error.message);await load();}
function render(){
 const page=document.getElementById('page');if(!page)return;
 if(loading){page.innerHTML=shell(tabs()+'<p class="muted">جاري تحميل الطلبات والعروض الفعلية…</p>');return}
 if(error){page.innerHTML=shell(tabs()+'<div class="empty-state">'+esc(error)+'</div>');bind();return}
 page.innerHTML=(tab==='bids'?bidsView():requestsView())+(tab==='requests'?form():'')+(tab==='bids'?providerForm():'');bind();
}
function bind(){
 document.querySelectorAll('[data-view-bids]').forEach(b=>b.onclick=()=>{const panel=document.getElementById('bid-panel');if(panel)panel.innerHTML=bidPanel(b.dataset.viewBids);document.querySelectorAll('[data-accept-bid]').forEach(x=>x.onclick=()=>acceptBid(x.dataset.requestId,x.dataset.acceptBid));document.querySelectorAll('[data-reject-bid]').forEach(x=>x.onclick=()=>rejectBid(x.dataset.requestId,x.dataset.rejectBid));document.querySelectorAll('[data-counter-bid]').forEach(x=>x.onclick=()=>counterBid(x.dataset.requestId,x.dataset.counterBid));});
 document.querySelectorAll('[data-accept-bid]').forEach(x=>x.onclick=()=>acceptBid(x.dataset.requestId,x.dataset.acceptBid));
 document.querySelectorAll('[data-reject-bid]').forEach(x=>x.onclick=()=>rejectBid(x.dataset.requestId,x.dataset.rejectBid));
 document.querySelectorAll('[data-counter-bid]').forEach(x=>x.onclick=()=>counterBid(x.dataset.requestId,x.dataset.counterBid));
 document.getElementById('save-bid')?.addEventListener('click',createBid);
 document.querySelectorAll('[data-btab]').forEach(b=>b.onclick=()=>{tab=b.dataset.btab;render();});
 document.getElementById('add-request')?.addEventListener('click',()=>{tab='requests';render();setTimeout(()=>document.getElementById('rDomain')?.focus(),0);});
 document.getElementById('save-request')?.addEventListener('click',createRequest);
 document.getElementById('refresh-bids')?.addEventListener('click',load);
 document.getElementById('rDomain')?.addEventListener('change',e=>syncDomain(e.target.value));
 document.querySelectorAll('.mg-domain').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.domain;const select=document.getElementById('rDomain');if(select)select.value=key;syncDomain(key);}));
}
function observe(){
 const t=document.querySelector('.breadcrumb')?.textContent?.trim()||'';
 const active=t==='MantiGO والمزايدات'||t==='الخدمات المهنية';
 if(active&&!window.__mntyReverseActive){window.__mntyReverseActive=true;load();}
 if(!active)window.__mntyReverseActive=false;
}
new MutationObserver(observe).observe(document.body,{childList:true,subtree:true});
setInterval(observe,800);
})();