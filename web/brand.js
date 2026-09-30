/* MantiqatiX Brand Layer */
(function(){
  const logoSvg = '<svg viewBox="0 0 100 100" aria-label="MantiqatiX" role="img"><defs><linearGradient id="mxg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563EB"/><stop offset=".52" stop-color="#00C896"/><stop offset="1" stop-color="#7C3AED"/></linearGradient></defs><path d="M18 70V27c0-5 6-7 10-3l22 22 17-17c4-4 10-1 10 4v8l-17 17 17 17c3 3 1 8-4 8H58L40 65 28 77c-4 4-10 1-10-4V70z" fill="url(#mxg)"/><path d="M57 74l15-15 12 12-15 15c-3 3-8 3-11 0l-1-1c-3-3-3-8 0-11z" fill="#7C3AED"/><path d="M77 25l8-8 9 9-8 8z" fill="#00C896"/></svg>';
  function apply(){
    document.querySelectorAll('.mark').forEach(el=>{if(!el.querySelector('svg'))el.innerHTML=logoSvg;});
    document.querySelectorAll('.landing .brand').forEach(el=>el.setAttribute('aria-label','MantiqatiX'));
    const title=document.querySelector('.content h1');
    if(title && title.textContent.trim()==='التسويق والإعلان' && !document.querySelector('.sponsored-zone')){
      const page=document.getElementById('page'); if(!page)return;
      const zone=document.createElement('section'); zone.className='sponsored-zone';
      zone.innerHTML='<div class="sponsored-zone__head"><div class="sponsored-zone__title">الإعلانات الممولة</div><span class="sponsored-badge">إعلان ممول</span></div><div class="sponsored-grid"><article class="sponsored-card"><strong>حملة توعوية</strong><p>ظهور مدفوع داخل المنصة مع تتبع التفاعل ومصدر العميل.</p><button>إدارة الحملة</button></article><article class="sponsored-card"><strong>إعلان نشاط</strong><p>إبراز مشروع أو مقدم خدمة داخل المجال المناسب مع CTA واضح.</p><button>إدارة الإعلان</button></article><article class="sponsored-card"><strong>إعادة الاستهداف</strong><p>مسار مخصص للجمهور المتفاعل وفق بيانات الحملات المتاحة.</p><button>فتح التقارير</button></article></div>';
      page.prepend(zone);
    }
  }
  new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();
