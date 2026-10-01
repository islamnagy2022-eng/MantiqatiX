(function(){
'use strict';
const cfg=window.MANTIQATIX_CONFIG;
const sb=window.MNTY_SB || (window.supabase && window.supabase.createClient ? window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey) : null);
if(!cfg || !sb)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2})+' ج.م';
let user=null,tab='requests',requests=[],bids=[],loading=false,error=null;
async function load(){
  const s=await sb.auth.getSession();
  user=s.data?.session?.user||null;
  if(!user){error='AUTH_REQUIRED';return render();}
  loading=true;error=null;render();
  const [r,b]=await Promise.all([
    sb.from('indrive_requests').select('id,owner_user_id,domain_type,category_name,title,details_description,user_proposed_price,target_provider_type,req_location_district,status,accepted_bid_id,created_at').order('created_at',{ascending:false}).limit(100),
    sb.from('indrive_bids').select('id,request_id,provider_user_id,provider_name,provider_type,provider_rating,completed_orders_count,offered_price,note,estimated_delivery_time,created_at,status').order('created_at',{ascending:false}).limit(200)
  ]);
  requests=r.data||[];bids=b.data||[];
  const e=[r.error,b.error].filter(Boolean);error=e.length?e.map(x=>x.message).join(' | '):null;
  loading=false;render();
}
function shell(body){return '<section class="workspace-section"><div class="workspace-head"><div><div class="eyebrow">REVERSE BIDDING</div><h2>🚗 MantiGO والمزايدات</h2><p class="muted">طلبات الخدمات والعروض من البيانات الفعلية، مع احترام RLS ونطاق الطرف صاحب الطلب أو مقدم العرض.</p></div></div>'+body+'</section>';}
function tabs(){return '<div class="action-bar" style="gap:8px;flex-wrap:wrap"><button class="btn '+(tab==='requests'?'btn-primary':'btn-outline')+'" data-btab="requests">الطلبات</button><button class="btn '+(tab==='bids'?'btn-primary':'btn-outline')+'" data-btab="bids">العروض</button><button class="btn btn-primary" id="add-request">+ طلب خدمة</button><button class="btn btn-outline" id="refresh-bids">تحديث</button></div>';}
function requestsView(){return shell(tabs()+'<div class="table-wrap"><table><thead><tr><th>الطلب</th><th>المجال</th><th>العنوان</th><th>السعر المقترح</th><th>النطاق</th><th>الحالة</th><th>العروض المرئية</th></tr></thead><tbody>'+(requests.length?requests.map(r=>{const n=bids.filter(b=>b.request_id===r.id).length;return '<tr><td><b>'+esc(r.id)+'</b></td><td>'+esc(r.domain_type)+'</td><td>'+esc(r.title)+'</td><td>'+money(r.user_proposed_price)+'</td><td>'+esc(r.req_location_district||'—')+'</td><td>'+esc(r.status)+'</td><td>'+n+'</td></tr>';}).join(''):'<tr><td colspan="7">لا توجد طلبات فعلية.</td></tr>')+'</tbody></table></div>');}
function bidsView(){return shell(tabs()+'<div class="table-wrap"><table><thead><tr><th>الطلب</th><th>مقدم الخدمة</th><th>النوع</th><th>العرض</th><th>التقييم</th><th>المدة</th><th>الحالة</th></tr></thead><tbody>'+(bids.length?bids.map(b=>'<tr><td>'+esc(b.request_id)+'</td><td>'+esc(b.provider_name)+'</td><td>'+esc(b.provider_type)+'</td><td>'+money(b.offered_price)+'</td><td>'+esc(b.provider_rating??'—')+'</td><td>'+esc(b.estimated_delivery_time||'—')+'</td><td>'+esc(b.status)+'</td></tr>').join(''):'<tr><td colspan="7">لا توجد عروض مرئية وفق سياسة الوصول الحالية.</td></tr>')+'</tbody></table></div>');}
function form(){return '<div class="card" style="margin-top:16px"><h3>نشر طلب خدمة</h3><div class="grid-2"><input id="rDomain" class="input" placeholder="المجال مثل ACCOUNTING / LEGAL / MAINTENANCE"><input id="rCategory" class="input" placeholder="التصنيف"><input id="rTitle" class="input" placeholder="عنوان الطلب"><input id="rPrice" class="input" type="number" min="0" placeholder="الميزانية المقترحة"><input id="rProvider" class="input" placeholder="نوع مقدم الخدمة"><input id="rDistrict" class="input" placeholder="الحي/النطاق"><textarea id="rDetails" class="input" placeholder="تفاصيل الطلب"></textarea></div><button class="btn btn-primary" id="save-request">نشر الطلب</button></div>';}
async function createRequest(){
  if(!user)return;
  const p={id:crypto.randomUUID(),owner_user_id:user.id,domain_type:document.getElementById('rDomain').value.trim().toUpperCase(),category_name:document.getElementById('rCategory').value.trim(),title:document.getElementById('rTitle').value.trim(),details_description:document.getElementById('rDetails').value.trim(),user_proposed_price:Number(document.getElementById('rPrice').value)||0,target_provider_type:document.getElementById('rProvider').value.trim(),selected_ad_platform:'MNTY',req_location_district:document.getElementById('rDistrict').value.trim(),status:'OPEN_FOR_BIDS'};
  if(!p.domain_type||!p.title||!p.details_description)return alert('أكمل المجال والعنوان والتفاصيل.');
  const r=await sb.from('indrive_requests').insert(p);if(r.error)return alert(r.error.message);await load();
}
function render(){const page=document.getElementById('page');if(!page)return;if(loading){page.innerHTML=shell(tabs()+'<p class="muted">جاري تحميل الطلبات والعروض الفعلية…</p>');return}if(error){page.innerHTML=shell(tabs()+'<div class="empty-state">'+esc(error)+'</div>');bind();return}page.innerHTML=(tab==='bids'?bidsView():requestsView())+(tab==='requests'?form():'');bind();}
function bind(){document.querySelectorAll('[data-btab]').forEach(b=>b.onclick=()=>{tab=b.dataset.btab;render();});document.getElementById('add-request')?.addEventListener('click',()=>{tab='requests';document.getElementById('rDomain')?.focus();});document.getElementById('save-request')?.addEventListener('click',createRequest);document.getElementById('refresh-bids')?.addEventListener('click',load);}
function observe(){const t=document.querySelector('.breadcrumb')?.textContent?.trim()||'';const active=t==='MantiGO والمزايدات'||t==='الخدمات المهنية';if(active&&!window.__mntyReverseActive){window.__mntyReverseActive=true;load();}if(!active)window.__mntyReverseActive=false;}
new MutationObserver(observe).observe(document.body,{childList:true,subtree:true});setInterval(observe,800);
})();