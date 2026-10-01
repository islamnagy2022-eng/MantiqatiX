/* MantiqatiX Brand Layer — Red & Gold visual identity */
(function(){
  const logoSrc='./assets/mantiqatix-mark.svg';
  function apply(){
    document.querySelectorAll('.mark').forEach(el=>{
      if(!el.querySelector('img.mnty-brand-mark')){
        el.innerHTML='<img class="mnty-brand-mark" src="'+logoSrc+'" alt="MantiqatiX" decoding="async">';
      }
    });
    document.querySelectorAll('.landing .brand,.mx-brand').forEach(el=>el.setAttribute('aria-label','MantiqatiX'));
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