(function(){
  'use strict';
  const phone=String(window.MNTY_SUPPORT?.whatsapp||'201010171770').replace(/\D/g,'');
  const waUrl=text=>'https://wa.me/'+phone+'?text='+encodeURIComponent(text);
  const safeOpen=url=>{const w=window.open(url,'_blank','noopener,noreferrer');if(w)w.opener=null;};
  const general=document.querySelector('[data-wa-general]');
  if(general)general.href=waUrl('مرحبًا MantiqatiX، أريد الاستفسار عن خدمات التسويق الرقمي للشركة.');
  document.querySelectorAll('[data-service]').forEach(button=>button.addEventListener('click',()=>{
    const service=String(button.getAttribute('data-service')||'').slice(0,160);
    safeOpen(waUrl('مرحبًا MantiqatiX، أريد طلب خدمة: '+service+'. برجاء توضيح الخطوات والتكلفة قبل بدء التنفيذ.'));
  }));
  const form=document.getElementById('request-form');
  form?.addEventListener('submit',event=>{
    event.preventDefault();
    if(!form.reportValidity())return;
    const business=String(document.getElementById('business-name')?.value||'').trim().slice(0,120);
    const service=String(document.getElementById('service-choice')?.value||'').trim().slice(0,160);
    const details=String(document.getElementById('request-details')?.value||'').trim().slice(0,1200);
    if(!business||!service){document.getElementById('form-status').textContent='أكمل اسم النشاط والخدمة المطلوبة أولًا.';return;}
    const message=['طلب خدمة تسويق من موقع MantiqatiX','اسم النشاط: '+business,'الخدمة المطلوبة: '+service,details?'تفاصيل الطلب: '+details:''].filter(Boolean).join('\n');
    document.getElementById('form-status').textContent='تم تجهيز رسالة واتساب. راجعها وأرسلها من واتساب لإتمام الطلب.';
    safeOpen(waUrl(message));
  });
})();