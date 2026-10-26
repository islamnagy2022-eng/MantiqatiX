(function () {
  'use strict';
  const cfg = window.MANTIQATIX_DEMO_CONFIG;
  const sdk = window.supabase;
  const app = document.getElementById('activity-app');
  const params = new URLSearchParams(window.location.search);
  const businessId = params.get('business') || params.get('businessId') || '';
  const branchId = params.get('branch') || params.get('branchId') || '';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const money = value => Number(value || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';
  const sectorLabels = { FOOD: 'مطاعم وكافيهات', PHARMACY: 'صيدليات', DOCTOR: 'أطباء وعيادات', STORE: 'متاجر' };
  function showError(message) { app.innerHTML = '<section class="activity-error">' + esc(message) + '</section>'; }
  function whatsappUrl(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = '20' + digits.slice(1);
    if (digits && digits.length >= 10) return 'https://wa.me/' + digits;
    return '';
  }
  function render(result) {
    const business = result.business, branch = result.branch || {}, items = result.items || [];
    const phone = business.phone || branch.phone || '', wa = whatsappUrl(phone);
    const sector = sectorLabels[business.sectorCode] || business.sectorCode || 'نشاط تجريبي';
    const manageUrl = './connected.html?businessId=' + encodeURIComponent(business.id) + '&tab=products';
    const orderUrl = './connected.html?businessId=' + encodeURIComponent(business.id) + '&tab=catalog';
    const hero = '<section class="activity-hero"><div><div class="activity-brand-line"><span class="activity-sector">' + esc(sector) + '</span><span class="activity-sector">كتالوج DEMO</span></div>' +
      '<h1>' + esc(business.name) + '</h1><p>' + esc(business.description || 'مرحبًا بكم في صفحة النشاط. تصفح المنتجات والخدمات والأسعار المتاحة أدناه.') + '</p>' +
      '<div class="activity-meta">' + (business.city ? '<span>📍 ' + esc(business.city) + '</span>' : '') +
      (phone ? '<span>☎ ' + esc(phone) + '</span>' : '') + (branch.name ? '<span>الفرع: ' + esc(branch.name) + '</span>' : '') +
      (branch.address && branch.address !== business.city ? '<span>العنوان: ' + esc(branch.address) + '</span>' : '') +
      '<span>' + items.length + ' منتج/خدمة</span></div></div><div class="activity-actions">' +
      (wa ? '<a class="btn btn-primary" target="_blank" rel="noopener" href="' + esc(wa) + '">التواصل عبر واتساب</a>' : '') +
      '<button class="btn btn-ghost" type="button" data-action="copy-link">نسخ رابط الكتالوج</button>' +
      '<a class="btn btn-ghost" href="' + esc(manageUrl) + '">إدارة النشاط والمنتجات</a></div></section>';
    const products = items.map(item => '<article class="activity-product"><div class="entity-top"><h3>' + esc(item.name) + '</h3><span class="badge">' + esc(item.itemType === 'SERVICE' ? 'خدمة' : 'منتج') + '</span></div>' +
      '<p class="activity-product-description">' + esc(item.description || 'لا يوجد وصف إضافي.') + '</p><div class="activity-product-price">' +
      (item.price == null ? 'السعر عند التواصل' : money(item.price)) + '</div><div class="activity-product-bottom"><span class="badge">' +
      (Number(item.stock) > 0 ? 'متاح تجريبيًا' : 'يرجى الاستفسار عن التوفر') + '</span><a class="btn btn-secondary btn-small" href="' + esc(orderUrl) + '">طلب/استفسار</a></div></article>').join('');
    app.innerHTML = hero + '<section class="activity-content"><div class="activity-content-head"><div><h2>المنتجات والخدمات</h2><p>المنتجات والأسعار أسفل معلومات النشاط، ويتم تحديثها من لوحة صاحب النشاط.</p></div><span class="db-pill">' + items.length + ' عنصرًا</span></div>' +
      (products ? '<div class="activity-products">' + products + '</div>' : '<div class="activity-empty">لم يضف النشاط منتجات أو خدمات بعد. يمكنك الرجوع لاحقًا للاطلاع على الكتالوج.</div>') +
      '</section><section class="activity-owner-link"><div><strong>صاحب النشاط؟</strong><small>سجّل الدخول بالبريد وكلمة المرور لإضافة المنتجات وتعديل الأسعار وبيانات الكتالوج.</small></div><a class="btn btn-primary" href="' + esc(manageUrl) + '">إدارة الكتالوج</a></section>';
  }
  async function boot() {
    if (!cfg || cfg.environment !== 'DEMO' || cfg.paymentsEnabled !== false || !sdk || typeof sdk.createClient !== 'function') return showError('إعدادات DEMO غير متاحة. لم يتم توجيه هذه الصفحة إلى الإنتاج.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId)) return showError('رابط الكتالوج غير مكتمل. افتح صفحة النشاط من لوحة MantiqatiX أو أضف معرّف النشاط إلى الرابط.');
    const client = sdk.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
    const response = await client.functions.invoke('demo-public-catalog', { body: { businessId, branchId: branchId || null } });
    if (response.error || !response.data || !response.data.ok || !response.data.business) return showError('تعذر تحميل صفحة النشاط. تحقق من الرابط أو حاول مرة أخرى. ' + String(response.error?.message || response.data?.error || ''));
    render(response.data);
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action="copy-link"]');
    if (!button) return;
    try { await navigator.clipboard.writeText(window.location.href); button.textContent = 'تم نسخ الرابط'; }
    catch (_) { button.textContent = 'انسخ الرابط من شريط العنوان'; }
  });
  boot().catch(error => showError('تعذر تحميل الكتالوج: ' + String(error?.message || error)));
})();