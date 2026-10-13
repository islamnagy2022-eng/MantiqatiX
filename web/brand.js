/* MantiqatiX Brand Layer — immutable originals + runtime brand overrides */
(function(){
  const ORIGINAL={PRIMARY_LOGO:'assets/mantiqatix-logo.svg',PRIMARY_MARK:'assets/mantiqatix-mark.svg'};
  const BUCKET='mantiqatix-profile-media';
  const client=()=>window.MNTY_SB||null;
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const publicUrl=path=>{
    const p=String(path||''); if(!p)return '';
    if(p.startsWith('assets/'))return p;
    try{return client()?.storage?.from(BUCKET).getPublicUrl(p)?.data?.publicUrl||'';}catch(_){return ''}
  };
  async function load(){
    const sb=client(); if(!sb)return;
    try{
      const r=await sb.from('platform_brand_assets').select('asset_key,asset_path,original_asset_path,version,updated_at').in('asset_key',['PRIMARY_LOGO','PRIMARY_MARK']);
      const map={}; (r.data||[]).forEach(x=>map[x.asset_key]=x); window.MNTYBrandAssets=map;
      document.querySelectorAll('.mark').forEach(el=>{
        let img=el.querySelector('img.mnty-brand-mark'); if(!img){el.innerHTML='<img class="mnty-brand-mark" src="'+ORIGINAL.PRIMARY_MARK+'" alt="MantiqatiX" decoding="async">';img=el.querySelector('img.mnty-brand-mark');}
        const src=publicUrl(map.PRIMARY_MARK?.asset_path)||ORIGINAL.PRIMARY_MARK; img.src=src+(src.includes('?')?'&':'?')+'v='+(map.PRIMARY_MARK?.version||'1');
      });
      window.MNTYBrandLogoUrl=publicUrl(map.PRIMARY_LOGO?.asset_path)||ORIGINAL.PRIMARY_LOGO;
    }catch(e){
      window.MNTYBrandAssets={}; window.MNTYBrandLogoUrl=ORIGINAL.PRIMARY_LOGO;
    }
  }
  function mountAdmin(){
    if(String(window.MNTYAuthState?.role||'').toUpperCase()!=='SUPER_ADMIN')return;
    const title=document.querySelector('.content h1'); const page=document.getElementById('page');
    if(!title||!page||String(title.textContent||'').trim()!=='التحكم الكامل')return;
    if(document.getElementById('mnty-brand-admin'))return;
    const section=document.createElement('section'); section.id='mnty-brand-admin'; section.className='mnty-brand-admin';
    section.innerHTML='<div class="mnty-brand-admin__head"><div><span class="eyebrow">BRAND CONTROL</span><h2>هوية المنصة</h2><p>غيّر اللوجو دون المساس بالملف الأصلي. كل نسخة جديدة تحفظ كأصل مستقل ويمكن الرجوع للهوية الأصلية.</p></div><span class="mx-verified">✓ Super Admin</span></div><div class="mnty-brand-admin__body"><div class="mnty-brand-admin__preview"><img id="mnty-brand-preview" src="" alt="معاينة لوجو المنصة"></div><div class="mnty-brand-admin__controls"><label class="field"><span>لوجو جديد</span><input id="mnty-brand-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label><div class="mnty-brand-admin__actions"><button type="button" class="btn btn-primary" id="mnty-brand-save">حفظ كلوجو جديد</button><button type="button" class="btn btn-outline" id="mnty-brand-reset">الرجوع للأصل</button></div><small id="mnty-brand-status" class="muted">الأصل محفوظ ولا يتم استبداله.</small></div></div>';
    page.prepend(section);
    const preview=section.querySelector('#mnty-brand-preview'), file=section.querySelector('#mnty-brand-file'), status=section.querySelector('#mnty-brand-status');
    const refresh=()=>{preview.src=window.MNTYBrandLogoUrl||ORIGINAL.PRIMARY_LOGO;}; refresh();
    file.onchange=()=>{const f=file.files?.[0];if(!f)return;if(!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(f.type)||f.size>5*1024*1024){status.textContent='الصورة يجب أن تكون PNG/JPG/WebP/SVG وبحد أقصى 5MB.';file.value='';return;}const u=URL.createObjectURL(f);preview.src=u;preview.onload=()=>URL.revokeObjectURL(u);status.textContent='جاهز للحفظ — الأصل لن يتغير.';};
    section.querySelector('#mnty-brand-save').onclick=async()=>{const f=file.files?.[0],sb=client();if(!f||!sb){status.textContent='اختر صورة وتأكد من الاتصال بالمنصة.';return;}const ext=f.type==='image/svg+xml'?'svg':f.type==='image/webp'?'webp':f.type==='image/png'?'png':'jpg';const path='platform/branding/logo-'+Date.now()+'.'+ext;status.textContent='جاري رفع النسخة الجديدة…';
      const up=await sb.storage.from(BUCKET).upload(path,f,{contentType:f.type,upsert:false,cacheControl:'31536000'});if(up.error){status.textContent='تعذر رفع اللوجو: '+up.error.message;return;}
      const current=window.MNTYBrandAssets?.PRIMARY_LOGO;const nextVersion=Number(current?.version||1)+1;const ur=await sb.from('platform_brand_assets').update({asset_path:path,mime_type:f.type,version:nextVersion,updated_by:window.MNTYAuthState?.userId||null,updated_at:new Date().toISOString()}).eq('asset_key','PRIMARY_LOGO');if(ur.error){status.textContent='تم رفع الملف لكن لم يتم تفعيله: '+ur.error.message;return;}
      await load(); refresh(); file.value=''; status.textContent='تم تفعيل اللوجو الجديد مع بقاء الأصل محفوظًا.';
    };
    section.querySelector('#mnty-brand-reset').onclick=async()=>{const sb=client();if(!sb)return;const current=window.MNTYBrandAssets?.PRIMARY_LOGO;const ur=await sb.from('platform_brand_assets').update({asset_path:ORIGINAL.PRIMARY_LOGO,version:Number(current?.version||1)+1,updated_by:window.MNTYAuthState?.userId||null,updated_at:new Date().toISOString()}).eq('asset_key','PRIMARY_LOGO');if(ur.error){status.textContent='تعذر الرجوع للأصل: '+ur.error.message;return;}await load();refresh();status.textContent='تم الرجوع للوجو الأصلي دون حذف النسخ السابقة.';};
  }
  function apply(){
    document.querySelectorAll('.landing .brand,.mx-brand').forEach(el=>el.setAttribute('aria-label','MantiqatiX'));
    const title=document.querySelector('.content h1');
    if(title && title.textContent.trim()==='التسويق والإعلان' && !document.querySelector('.sponsored-zone')){
      const page=document.getElementById('page'); if(!page)return;
      const zone=document.createElement('section'); zone.className='sponsored-zone';
      zone.innerHTML='<div class="sponsored-zone__head"><div class="sponsored-zone__title">الإعلانات الممولة</div><span class="sponsored-badge">إعلان ممول</span></div><div class="sponsored-grid"><article class="sponsored-card"><strong>حملة توعوية</strong><p>ظهور مدفوع داخل المنصة مع تتبع التفاعل ومصدر العميل.</p><button>إدارة الحملة</button></article><article class="sponsored-card"><strong>إعلان نشاط</strong><p>إبراز مشروع أو مقدم خدمة داخل المجال المناسب مع CTA واضح.</p><button>إدارة الإعلان</button></article><article class="sponsored-card"><strong>إعادة الاستهداف</strong><p>مسار مخصص للجمهور المتفاعل وفق بيانات الحملات المتاحة.</p><button>فتح التقارير</button></article></div>';
      page.prepend(zone);
    }
    mountAdmin();
  }
  new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();setTimeout(load,0)});else{apply();setTimeout(load,0)}
})();