(function () {
  'use strict';

  const cfg = window.MANTIQATIX_DEMO_CONFIG;
  const sdk = window.supabase;
  const app = document.getElementById('app');
  const $ = (s, root) => (root || document).querySelector(s);
  const $$ = (s, root) => Array.from((root || document).querySelectorAll(s));
  const sectors = {
    FOOD: { label: 'مطاعم وكافيهات', icon: '🍽️', backend: 'FOOD', itemType: 'PRODUCT' },
    PHARMACY: { label: 'صيدليات', icon: '⚕️', backend: 'PHARMACY', itemType: 'PRODUCT' },
    DOCTOR: { label: 'أطباء وعيادات', icon: '🩺', backend: 'HEALTH', itemType: 'SERVICE' },
    STORE: { label: 'متاجر', icon: '🛍️', backend: 'GROCERY', itemType: 'PRODUCT' }
  };
  const statusLabels = {
    PENDING: 'جديد', NEW: 'جديد', CREATED: 'جديد', CONFIRMED: 'تم التأكيد',
    PREPARING: 'قيد التجهيز', OUT_FOR_DELIVERY: 'خرج للتوصيل',
    DELIVERED: 'تم التسليم', CANCELLED: 'ملغي', COMPLETED: 'مكتمل'
  };
  const allowedNext = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    NEW: ['CONFIRMED', 'CANCELLED'],
    CREATED: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
    OUT_FOR_DELIVERY: ['DELIVERED'],
    DELIVERED: [], COMPLETED: [], CANCELLED: []
  };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const money = value => Number(value || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';
  const makeIdempotencyKey = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  const data = { user: null, session: null, businesses: [], branches: [], memberships: [], items: [], prices: [], orders: [], providers: [], appointments: [], selectedBusinessId: null, catalogFilterSector: 'ALL', catalogFilterBusinessId: 'ALL', tab: 'dashboard', authMode: 'login', loading: false };
  let sb;
  let toastTimer = null;

  function toast(message, type) {
    const el = $('#toast');
    el.textContent = message;
    el.className = 'toast' + (type ? ' ' + type : '');
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }
  function errorText(error) {
    return String(error && (error.message || error.details || error.hint || error.error_description) || error || 'خطأ غير معروف');
  }
  function sectorForBusiness(business) {
    const code = String(business?.settings?.sector_code || '').toUpperCase();
    return sectors[code] || { label: code || 'نشاط تجريبي', icon: '◈', backend: code, itemType: 'PRODUCT' };
  }
  function activeMemberships() {
    return data.memberships.filter(m => m.status === 'ACTIVE' && m.business_id);
  }
  function selectedBusiness() {
    return data.businesses.find(b => b.id === data.selectedBusinessId) || null;
  }
  function membershipForBusiness(businessId) {
    return data.memberships.find(m => m.business_id === businessId && m.status === 'ACTIVE') || null;
  }
  function canManage(businessId) {
    return ['OWNER', 'BUSINESS_OWNER', 'ADMIN', 'MANAGER'].includes(String(membershipForBusiness(businessId)?.role || '').toUpperCase());
  }
  function roleLabel(role) {
    return ({ OWNER: 'مالك النشاط', BUSINESS_OWNER: 'مالك النشاط', ADMIN: 'مدير نظام النشاط', MANAGER: 'مدير', STAFF: 'موظف', CUSTOMER: 'عميل' })[String(role || '').toUpperCase()] || role || 'مستخدم';
  }
  function branchForBusiness(businessId) {
    const own = membershipForBusiness(businessId);
    return data.branches.find(b => b.business_id === businessId && b.status === 'ACTIVE' && (!own || !own.branch_id || b.id === own.branch_id)) || data.branches.find(b => b.business_id === businessId && b.status === 'ACTIVE') || null;
  }
  function priceFor(item) {
    const candidates = data.prices.filter(p => p.catalog_item_id === item.id && p.status === 'ACTIVE' && (!p.effective_to || new Date(p.effective_to).getTime() > Date.now()));
    const branchId = item.branch_id || null;
    candidates.sort((a, b) => Number(b.branch_id === branchId) - Number(a.branch_id === branchId) || Number(b.version || 0) - Number(a.version || 0));
    return candidates[0] || null;
  }
  function businessName(id) {
    return data.businesses.find(b => b.id === id)?.name || 'نشاط تجريبي';
  }
  function catalogItemsFor(businessId) {
    return data.items.filter(i => i.business_id === businessId && i.status === 'ACTIVE');
  }
  async function provisionCustomer() {
    const { data: result, error } = await sb.functions.invoke('demo-register-customer', { body: {} });
    if (error) throw new Error('تعذر تجهيز عضوية العميل التجريبية: ' + errorText(error));
    if (!result?.ok) throw new Error('لم يتم تجهيز عضوية العميل التجريبية.');
  }

  async function loadData() {
    data.loading = true;
    data.dataError = null;
    render();
    const user = data.user;
    if (!user) { data.loading = false; return render(); }

    try {
      const results = await Promise.all([
        sb.from('user_memberships').select('id,user_id,tenant_id,organization_id,business_id,branch_id,role,status,permissions').eq('user_id', user.id).eq('tenant_id', cfg.tenantId).eq('status', 'ACTIVE').limit(100),
        sb.from('businesses').select('id,tenant_id,organization_id,name,code,status,settings,created_at').eq('tenant_id', cfg.tenantId).eq('status', 'ACTIVE').order('created_at', { ascending: false }).limit(100),
        sb.from('branches').select('id,tenant_id,organization_id,business_id,name,code,status,phone,address,settings').eq('tenant_id', cfg.tenantId).eq('status', 'ACTIVE').limit(200),
        sb.from('catalog_items').select('id,tenant_id,business_id,branch_id,item_type,name_ar,name_en,description,sku,status,tax_rate,metadata,created_at').eq('tenant_id', cfg.tenantId).eq('status', 'ACTIVE').order('created_at', { ascending: false }).limit(500),
        sb.from('catalog_item_prices').select('id,tenant_id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to').eq('tenant_id', cfg.tenantId).eq('status', 'ACTIVE').lte('effective_from', new Date().toISOString()).limit(1000),
        sb.from('orders').select('id,tenant_id,business_id,branch_id,customer_id,status,subtotal,total_amount,currency,customer_name,items_json,metadata,created_at,updated_at,notes').eq('tenant_id', cfg.tenantId).order('created_at', { ascending: false }).limit(100),
        sb.from('medical_appointments').select('id,tenant_id,business_id,patient_id,doctor_id,date_time,status,reason,created_at').eq('patient_id', user.id).eq('tenant_id', cfg.tenantId).order('date_time', { ascending: true }).limit(100)
      ]);
      const labels = ['العضويات', 'الأنشطة', 'الفروع', 'المنتجات والخدمات', 'الأسعار', 'الطلبات', 'المواعيد'];
      const failed = results.map((r, i) => r.error ? labels[i] + ': ' + errorText(r.error) : '').filter(Boolean);
      if (failed.length) throw new Error('تعذر تحميل بيانات DEMO:\n' + failed.join('\n'));
      [data.memberships, data.businesses, data.branches, data.items, data.prices, data.orders, data.appointments] = results.map(r => r.data || []);
      const saved = window.localStorage.getItem('MANTIQATIX_DEMO_ACTIVE_BUSINESS') || '';
      const own = activeMemberships();
      data.selectedBusinessId = (saved && own.some(m => m.business_id === saved)) ? saved : (own[0]?.business_id || null);
      data.loading = false;
      render();
    } catch (error) {
      data.loading = false;
      data.dataError = errorText(error);
      render();
    }
  }

  function header(title, description, actions) {
    return '<div class="section-head"><div><h2>' + esc(title) + '</h2><p>' + esc(description) + '</p></div>' + (actions || '') + '</div>';
  }
  function stat(label, value, note) {
    return '<article class="card stat-card"><div class="stat-label">' + esc(label) + '</div><div class="stat-number">' + esc(value) + '</div><div class="stat-foot">' + esc(note) + '</div></article>';
  }
  function navButton(tab, label, icon) {
    return '<button type="button" class="btn nav-btn ' + (data.tab === tab ? 'active' : '') + '" data-action="tab" data-tab="' + tab + '">' + icon + ' ' + label + '</button>';
  }
  function activityCard(business, showCustomerLink) {
    const sector = sectorForBusiness(business);
    const items = catalogItemsFor(business.id);
    const membership = membershipForBusiness(business.id);
    const branch = branchForBusiness(business.id);
    return '<article class="entity-card"><div class="entity-top"><h3>' + esc(sector.icon + ' ' + business.name) + '</h3><span class="badge">' + esc(sector.label) + '</span></div>' +
      '<p>' + esc(business.settings?.city || '—') + ' · ' + esc(business.settings?.phone || '—') + '</p>' +
      '<p>' + esc(business.settings?.description || '') + '</p><div class="tag-row"><span class="badge">' + items.length + ' منتج/خدمة</span>' +
      (membership ? '<span class="badge good">' + esc(roleLabel(membership.role)) + '</span>' : '<span class="badge">كتالوج عام تجريبي</span>') +
      '<span class="data-chip">' + esc(branch?.name || 'فرع تجريبي') + '</span></div><div class="card-actions">' +
      (membership ? '<button class="btn btn-primary btn-small" data-action="select-business" data-business-id="' + business.id + '" type="button">إدارة النشاط</button>' : '') +
      (showCustomerLink ? '<button class="btn btn-secondary btn-small" data-action="catalog-business" data-business-id="' + business.id + '" type="button">فتح الكتالوج</button>' : '') +
      '</div></article>';
  }

  function renderAuth() {
    const signup = data.authMode === 'signup';
    app.innerHTML =
      '<div class="auth-layout"><section class="hero-panel">' +
      '<div><span class="hero-label">MANTIQATIX · DATABASE DEMO</span><h1>جرّب المنظومة على قاعدة منفصلة</h1>' +
      '<p>هذه النسخة تستخدم مصادقة Supabase الحقيقية وقاعدة تجريبية مستقلة. أنشئ نشاطًا، أضف منتجات وأسعارًا، أنشئ طلبات واختبر الصلاحيات.</p></div>' +
      '<div class="sector-list"><div class="sector-chip">🍽️ مطاعم وكافيهات</div><div class="sector-chip">⚕️ صيدليات</div><div class="sector-chip">🩺 أطباء وعيادات</div><div class="sector-chip">🛍️ متاجر</div></div>' +
      '<p class="tiny">لا دفع حقيقي. استخدم بريدًا تختبره وكلمة مرور لا تستخدمها في أي خدمة أخرى. بيانات العيادات هنا تدريبية وليست ملفات مرضى.</p></section>' +
      '<section class="panel"><h2 class="screen-title">' + (signup ? 'إنشاء حساب تجريبي' : 'تسجيل الدخول إلى DEMO') + '</h2>' +
      '<p class="sub-title">الحساب مرتبط بقاعدة DEMO فقط، ولا ينشئ حسابًا في الإنتاج.</p>' +
      '<div class="auth-switch"><button type="button" class="btn ' + (!signup ? 'active' : 'btn-secondary') + '" data-action="auth-mode" data-mode="login">دخول</button>' +
      '<button type="button" class="btn ' + (signup ? 'active' : 'btn-secondary') + '" data-action="auth-mode" data-mode="signup">حساب جديد</button></div>' +
      '<form id="auth-form" class="form-stack">' +
      (signup ? '<div class="field"><label for="auth-name">الاسم</label><input id="auth-name" name="name" required maxlength="80" autocomplete="name"></div>' : '') +
      '<div class="field"><label for="auth-email">البريد الإلكتروني</label><input id="auth-email" name="email" type="email" required maxlength="180" autocomplete="email"></div>' +
      '<div class="field"><label for="auth-password">كلمة المرور</label><input id="auth-password" name="password" type="password" minlength="8" required autocomplete="' + (signup ? 'new-password' : 'current-password') + '"></div>' +
      '<div class="form-actions"><button class="btn btn-primary" type="submit">' + (signup ? 'إنشاء الحساب التجريبي' : 'دخول') + '</button></div></form>' +
      '<div id="auth-message" class="auth-confirm-card hide" role="status"></div>' +
      '<p class="connected-note">قد يتطلب الحساب الجديد تأكيد البريد الإلكتروني وفق إعدادات Auth. بعد التأكيد، ارجع إلى هذه الصفحة وسجّل الدخول.</p></section></div>';
  }

  function renderWorkspace() {
    const user = data.user;
    const business = selectedBusiness();
    const membership = business ? membershipForBusiness(business.id) : null;
    const own = activeMemberships();
    const ownBusinessIds = new Set(own.map(m => m.business_id));
    const ownOrders = data.orders.filter(o => o.customer_id === user.id || ownBusinessIds.has(o.business_id));
    $('#app').innerHTML =
      '<div class="workspace-header"><div><h1 class="screen-title">مساحة العمل المتصلة</h1><p class="sub-title">قاعدة DEMO: ' + esc(cfg.tenantId) + ' · لا معاملات مالية حقيقية.</p><div class="connection-state">اتصال قاعدة البيانات جاهز</div></div>' +
      '<div class="user-box"><div class="user-avatar">' + esc((user.user_metadata?.full_name || user.email || 'م').slice(0, 1)) + '</div><div><strong>' + esc(user.user_metadata?.full_name || user.email) + '</strong><small>' + esc(user.email || '') + ' · حساب DEMO</small></div></div></div>' +
      '<div class="workspace-grid"><aside class="panel sidebar">' +
      navButton('dashboard', 'نظرة عامة', '⌂') + navButton('activities', 'أنشطتي', '◈') +
      navButton('catalog', 'الكتالوج والطلبات', '▦') +
      (business && canManage(business.id) ? navButton('products', 'المنتجات والأسعار', '＋') : '') +
      navButton('orders', 'إدارة الطلبات والمواعيد', '≋') +
      (business && String(membership?.role).toUpperCase() === 'OWNER' ? navButton('team', 'المستخدمون والصلاحيات', '♙') : '') +
      (own.length ? '<div class="nav-divider"></div><div class="field" style="padding:0 6px 7px"><label for="active-business">النشاط المحدد</label><select id="active-business" class="toolbar-select">' +
        own.map(m => { const b=data.businesses.find(x=>x.id===m.business_id); return b ? '<option value="' + esc(b.id) + '"' + (b.id===data.selectedBusinessId?' selected':'') + '>' + esc(b.name) + ' · ' + esc(roleLabel(m.role)) + '</option>' : ''; }).join('') +
      '</select></div>' : '') +
      '<div class="nav-divider"></div><div class="notice warning">DEMO فقط<br>لا دفع حقيقي · بيانات تجريبية · لا اتصال بالإنتاج</div></aside>' +
      '<section class="content-area">' + (data.dataError ? '<div class="connected-error">' + esc(data.dataError) + '</div><button class="btn btn-secondary" data-action="refresh">إعادة المحاولة</button>' : renderActiveTab(business, membership, ownOrders)) + '</section></div>';
  }

  function renderActiveTab(business, membership, ownOrders) {
    if (data.tab === 'activities') return renderActivities();
    if (data.tab === 'catalog') return renderCatalog();
    if (data.tab === 'products') return renderProducts(business);
    if (data.tab === 'orders') return renderOrders(business, membership, ownOrders);
    if (data.tab === 'team') return renderTeam(business, membership);
    return renderDashboard(business, membership, ownOrders);
  }

  function renderDashboard(business, membership, orders) {
    const own = activeMemberships();
    return header('لوحة DEMO', 'قاعدة مستقلة مع مصادقة وكتالوج وطلبات تجريبية.',
      '<button class="btn btn-primary" data-action="tab" data-tab="activities">＋ إنشاء نشاط</button>') +
      '<div class="stats-grid">' +
      stat('أنشطتي', own.length, 'عضويات نشطة في قاعدة DEMO') +
      stat('أنشطة متاحة', data.businesses.length, 'داخل مساحة التجربة فقط') +
      stat('منتجات وخدمات', data.items.length, 'كتالوج حقيقي داخل قاعدة DEMO') +
      stat('طلبات أستطيع رؤيتها', orders.length, 'حسب الصلاحية وعزل النشاط/الفرع') +
      '</div>' +
      '<section class="panel">' + header('الأنشطة التجريبية', 'افتح نشاطًا تديره أو استعرض كتالوجه.') +
      (data.businesses.length ? '<div class="card-grid">' + data.businesses.map(b => activityCard(b, true)).join('') + '</div>' : '<div class="empty-state">لا توجد أنشطة حتى الآن. ابدأ بإنشاء نشاط.</div>') +
      '</section>' +
      '<div class="notice">المشروع التجريبي منفصل، وكل الطلبات هنا بدون تحصيل. لم تُنسخ أي حسابات أو بيانات عملاء من الإنتاج.</div>';
  }

  function renderActivities() {
    return header('إنشاء نشاط', 'اختر قطاعًا من القطاعات الأربعة المحددة. سيُنشأ فرع رئيسي وعضوية مالك تلقائيًا.') +
      '<section class="panel"><form id="business-form" class="form-stack"><div class="form-grid">' +
      '<div class="field"><label for="business-name">اسم النشاط</label><input id="business-name" name="name" required maxlength="100" placeholder="مثال: مطعم التجربة"></div>' +
      '<div class="field"><label for="business-sector">القطاع</label><select id="business-sector" name="sector">' + Object.keys(sectors).map(k => '<option value="' + k + '">' + sectors[k].icon + ' ' + sectors[k].label + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="business-phone">هاتف تجريبي</label><input id="business-phone" name="phone" maxlength="30" inputmode="tel" placeholder="رقم غير حقيقي"></div>' +
      '<div class="field"><label for="business-city">المدينة</label><input id="business-city" name="city" maxlength="70" value="القاهرة"></div>' +
      '<div class="field span-2"><label for="business-description">الوصف</label><textarea id="business-description" name="description" maxlength="400"></textarea></div>' +
      '</div><div class="form-actions"><button class="btn btn-primary" type="submit">إنشاء النشاط في قاعدة DEMO</button></div></form></section>' +
      '<section class="panel">' + header('الأنشطة التي أملكها', 'لا يمكن لهذا الحساب تعديل نشاط لا يملك صلاحية عليه.') +
      (activeMemberships().length ? '<div class="card-grid">' + activeMemberships().map(m => data.businesses.find(b => b.id === m.business_id)).filter(Boolean).map(b => activityCard(b, false)).join('') + '</div>' : '<div class="empty-state">لم تنشئ نشاطًا بعد.</div>') +
      '</section>';
  }

  function renderCatalog() {
    const fSector = data.catalogFilterSector || 'ALL';
    const fBusiness = data.catalogFilterBusinessId || 'ALL';
    const sectorFilter = '<div class="catalog-filter"><div class="field"><label for="filter-sector">القطاع</label><select id="filter-sector"><option value="ALL"' + (fSector === 'ALL' ? ' selected' : '') + '>كل القطاعات</option>' +
      Object.keys(sectors).map(k => '<option value="' + k + '"' + (fSector === k ? ' selected' : '') + '>' + esc(sectors[k].label) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="filter-business">النشاط</label><select id="filter-business"><option value="ALL"' + (fBusiness === 'ALL' ? ' selected' : '') + '>كل الأنشطة</option>' +
      data.businesses.map(b => '<option value="' + b.id + '"' + (fBusiness === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>').join('') + '</select></div></div>';
    const items = data.items.filter(item => {
      const business = data.businesses.find(b => b.id === item.business_id);
      const code = String(business?.settings?.sector_code || '');
      return (fSector === 'ALL' || code === fSector) && (fBusiness === 'ALL' || item.business_id === fBusiness);
    });
    const cards = items.map(item => {
      const business = data.businesses.find(b => b.id === item.business_id);
      const sector = sectorForBusiness(business);
      const price = priceFor(item);
      const stock = Number(item.metadata?.demo_stock ?? 0);
      const branch = data.branches.find(b => b.id === item.branch_id);
      const appointmentForm = sector.backend === 'HEALTH'
        ? '<div class="clinic-form-grid"><div class="field"><label for="appointment-date-' + item.id + '">تاريخ الموعد</label><input id="appointment-date-' + item.id + '" type="date" min="' + new Date().toISOString().slice(0,10) + '" value="' + new Date(Date.now()+86400000*2).toISOString().slice(0,10) + '"></div><div class="field"><label for="appointment-time-' + item.id + '">الوقت</label><select id="appointment-time-' + item.id + '"><option>10:00</option><option>12:00</option><option selected>18:00</option><option>19:00</option></select></div></div>'
        : '<div class="field"><label for="quantity-' + item.id + '">الكمية</label><input id="quantity-' + item.id + '" type="number" min="1" max="100" value="1"></div>';
      const action = sector.backend === 'HEALTH'
        ? '<button class="btn btn-primary" data-action="book-appointment" data-business-id="' + item.business_id + '" data-item-id="' + item.id + '">حجز موعد تجريبي</button>'
        : '<button class="btn btn-primary" data-action="place-order" data-business-id="' + item.business_id + '" data-branch-id="' + (branch?.id || item.branch_id || '') + '" data-item-id="' + item.id + '">إنشاء طلب تجريبي</button>';
      return '<article class="entity-card catalog-card"><div class="entity-top"><h3>' + esc(item.name_ar) + '</h3><span class="badge">' + esc(sector.label) + '</span></div><p>' + esc(business?.name || 'نشاط') + ' · ' + esc(branch?.name || 'فرع') + '</p><p>' + esc(item.description || '') + '</p><div class="price">' + money(price?.unit_price) + '</div>' +
        '<div class="order-meta"><span class="data-chip">' + esc(item.item_type) + '</span><span class="data-chip">المتاح التجريبي: ' + stock + '</span><span class="data-chip">بدون دفع</span></div>' +
        appointmentForm + '<div class="card-actions">' + action + '</div><p class="tiny">لا توجد عملية تحصيل أو رسالة خارجية.</p></article>';
    }).join('');
    return header('الكتالوج والشراء', 'استعرض المنتجات في القطاعات الأربعة، أو أنشئ طلبًا/موعدًا بلا دفع.') +
      '<section class="panel">' + sectorFilter + '</section>' +
      (cards ? '<div class="card-grid">' + cards + '</div>' : '<div class="empty-state">لا توجد منتجات في التصفية الحالية. أنشئ نشاطًا ثم أضف منتجًا أو خدمة.</div>');
  }

  function renderProducts(business) {
    if (!business || !canManage(business.id)) return '<section class="panel"><div class="empty-state">اختر نشاطًا تملك صلاحية إدارته.</div></section>';
    const sector = sectorForBusiness(business);
    const branch = branchForBusiness(business.id);
    const items = catalogItemsFor(business.id);
    return header('المنتجات والأسعار', 'النشاط: ' + business.name + ' · ' + sector.label,
      '<button class="btn btn-secondary" data-action="tab" data-tab="catalog">عرض الكتالوج العام</button>') +
      '<section class="panel"><form id="product-form" class="form-stack"><div class="form-grid">' +
      '<div class="field"><label for="product-name">اسم المنتج/الخدمة</label><input id="product-name" name="name" required maxlength="180"></div>' +
      '<div class="field"><label for="product-price">السعر (ج.م)</label><input id="product-price" name="price" type="number" min="0" step="0.01" required></div>' +
      '<div class="field"><label for="product-stock">الكمية التجريبية</label><input id="product-stock" name="stock" type="number" min="0" step="1" value="20" required></div>' +
      '<div class="field"><label for="product-type">النوع</label><select id="product-type" name="itemType"><option value="' + sector.itemType + '">' + (sector.itemType === 'SERVICE' ? 'خدمة/موعد' : 'منتج') + '</option>' +
      (sector.itemType === 'PRODUCT' ? '<option value="SERVICE">خدمة</option>' : '<option value="PRODUCT">منتج</option>') + '</select></div>' +
      '<div class="field span-2"><label for="product-description">الوصف</label><textarea id="product-description" name="description" maxlength="400"></textarea></div>' +
      '</div><div class="form-actions"><button class="btn btn-primary" type="submit">إضافة عنصر + سعر</button></div></form>' +
      '<p class="connected-note">الكتالوج والأسعار محفوظة في قاعدة DEMO. المخزون رقم تجريبي يُحدث داخل معاملة الطلب.</p></section>' +
      '<section class="panel">' + header('الكتالوج الحالي', items.length + ' عنصرًا') +
      (items.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>الاسم</th><th>السعر</th><th>المخزون التجريبي</th><th>الحالة</th><th>تعديل السعر</th></tr></thead><tbody>' +
      items.map(item => { const p=priceFor(item); return '<tr><td><strong>' + esc(item.name_ar) + '</strong><br><span class="tiny">' + esc(item.description || '') + '</span></td><td>' + money(p?.unit_price) + '</td><td>' + Number(item.metadata?.demo_stock ?? 0) + '</td><td><span class="badge good">متاح</span></td><td><form class="inline-form" data-form="price-update" data-item-id="' + item.id + '" data-business-id="' + business.id + '" data-branch-id="' + (branch?.id || item.branch_id || '') + '"><input type="number" min="0" step="0.01" required name="price" value="' + esc(p?.unit_price ?? 0) + '" aria-label="السعر الجديد"><button class="btn btn-secondary btn-small" type="submit">حفظ</button></form></td></tr>'; }).join('') +
      '</tbody></table></div>' : '<div class="empty-state">لا توجد منتجات. أضف أول منتج أو خدمة من النموذج أعلاه.</div>') + '</section>';
  }

  function renderOrders(business, membership, orders) {
    return header('الطلبات والمواعيد', 'يظهر فقط ما تسمح به صلاحيات قاعدة البيانات. الطلبات بلا دفع حقيقي.') +
      '<section class="panel">' + header('الطلبات', orders.length + ' سجلًا مرئيًا') +
      (orders.length ? '<div class="card-grid">' + orders.map(o => {
        const staff = canManage(o.business_id) || ['STAFF','EMPLOYEE'].includes(String(membershipForBusiness(o.business_id)?.role || '').toUpperCase());
        const possible = staff ? (allowedNext[o.status] || []) : [];
        const choices = possible.map(s => '<option value="' + s + '">' + statusLabels[s] + '</option>').join('');
        const stateLabel = statusLabels[o.status] || o.status;
        const lines = Array.isArray(o.items_json) ? o.items_json.map(i => (i.name_ar || 'عنصر') + ' × ' + (i.quantity || 1)).join('، ') : '';
        return '<article class="entity-card order-card"><div class="order-card-top"><h3>' + esc(businessName(o.business_id)) + '</h3><span class="badge ' + (o.status === 'DELIVERED' ? 'good' : o.status === 'CANCELLED' ? 'bad' : 'warn') + '">' + esc(stateLabel) + '</span></div>' +
          '<p>' + esc(o.id) + '</p><p>' + esc(lines) + '</p><div class="price">' + money(o.total_amount) + '</div><div class="order-meta"><span class="data-chip">' + esc(o.customer_name || 'عميل') + '</span><span class="data-chip">DEMO_ONLY</span><span class="data-chip">' + esc(new Date(o.created_at).toLocaleString('ar-EG')) + '</span></div>' +
          (possible.length ? '<form class="inline-form" data-form="order-status" data-order-id="' + o.id + '" data-business-id="' + o.business_id + '"><select name="status" aria-label="الحالة">' + choices + '</select><button class="btn btn-secondary btn-small" type="submit">تحديث الحالة</button></form>' : '<span class="connected-status">لا توجد نقلة حالة متاحة لهذا الدور/الوضع</span>') +
          '</article>';
      }).join('') + '</div>' : '<div class="empty-state">لا توجد طلبات يمكن عرضها لهذا الحساب. أنشئ طلبًا من الكتالوج أو بدّل إلى حساب مالك.</div>') +
      '</section>' +
      '<section class="panel">' + header('مواعيدي الطبية', data.appointments.length + ' موعدًا') +
      (data.appointments.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>رقم الموعد</th><th>العيادة</th><th>التاريخ والوقت</th><th>الحالة</th><th>الخصوصية</th></tr></thead><tbody>' +
        data.appointments.map(a => '<tr><td>' + esc(a.id) + '</td><td>' + esc(businessName(a.business_id)) + '</td><td>' + esc(new Date(Number(a.date_time)).toLocaleString('ar-EG')) + '</td><td>' + esc(a.status) + '</td><td><span class="badge">حسابك فقط</span></td></tr>').join('') +
      '</tbody></table></div>' : '<div class="empty-state">لا توجد مواعيد محفوظة لهذا الحساب.</div>') + '</section>';
  }

  function renderTeam(business, membership) {
    return '<section class="panel">' + header('المستخدمون والصلاحيات', 'إدارة أعضاء النشاط تأتي عبر وظيفة تحقق نطاق المالك؛ لا يمكن منح دور مالك من الواجهة.') +
      '<p class="sub-title">النشاط المحدد: ' + esc(business?.name || '—') + ' · ' + esc(roleLabel(membership?.role)) + '</p>' +
      '<div id="team-list" class="role-panel"><div class="loading-state">جاري تحميل أعضاء النشاط…</div></div>' +
      '<div class="separator"></div><form id="team-form" class="form-stack"><div class="form-grid"><div class="field"><label for="team-email">بريد حساب DEMO موجود</label><input id="team-email" name="email" type="email" required placeholder="user@example.test"></div><div class="field"><label for="team-role">الدور</label><select id="team-role" name="role"><option value="MANAGER">مدير</option><option value="STAFF">موظف</option></select></div></div><button class="btn btn-primary" type="submit">إضافة أو تحديث الصلاحية</button></form>' +
      '<p class="connected-note">الحساب المستهدف يجب أن يكون قد سجل في DEMO. لا تضف بريدًا حقيقيًا لشخص دون موافقته.</p></section>';
  }

  async function loadTeam() {
    const business = selectedBusiness();
    if (!business) return;
    const branch = branchForBusiness(business.id);
    const box = $('#team-list');
    if (!box) return;
    box.innerHTML = '<div class="loading-state">جاري تحميل أعضاء النشاط…</div>';
    const { data: result, error } = await sb.functions.invoke('demo-membership-manage', {
      body: { action: 'list', businessId: business.id, branchId: branch?.id || '' }
    });
    if (error || !result?.ok) {
      box.innerHTML = '<div class="connected-error">' + esc(errorText(error || result?.error)) + '</div>';
      return;
    }
    box.innerHTML = result.members.length ? result.members.map(m =>
      '<div class="role-row"><div><strong>' + esc(m.name || m.email || m.userId) + '</strong><small>' + esc(m.email || '') + ' · ' + esc(m.userId) + '</small></div><div><span class="badge">' + esc(roleLabel(m.role)) + '</span></div></div>'
    ).join('') : '<div class="empty-state">لا يوجد أعضاء آخرون في هذا الفرع.</div>';
  }

  async function placeOrder(button) {
    const item = data.items.find(i => i.id === button.dataset.itemId);
    const business = data.businesses.find(b => b.id === button.dataset.businessId);
    const branchId = button.dataset.branchId;
    if (!item || !business || !branchId) return toast('النشاط أو الفرع أو المنتج غير متاح.', 'error');
    const quantity = Number($('#quantity-' + item.id)?.value || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return toast('الكمية يجب أن تكون عددًا صحيحًا من 1 إلى 100.', 'error');
    if (quantity > Number(item.metadata?.demo_stock ?? 0)) return toast('الكمية أكبر من المخزون التجريبي المتاح.', 'error');
    const retryKey = ['MANTIQATIX_DEMO_ORDER_RETRY_V1', data.user.id, business.id, branchId, item.id].join(':');
    let storedIdempotencyKey = null;
    try { storedIdempotencyKey = window.sessionStorage.getItem(retryKey); } catch (_) {}
    const clientIdempotencyKey = button.dataset.clientIdempotencyKey || storedIdempotencyKey || makeIdempotencyKey();
    button.dataset.clientIdempotencyKey = clientIdempotencyKey;
    try { window.sessionStorage.setItem(retryKey, clientIdempotencyKey); } catch (_) {}
    button.disabled = true;
    const { data: result, error } = await sb.functions.invoke('demo-order-create', {
      body: {
        businessId: business.id, branchId,
        clientIdempotencyKey,
        currency: 'EGP',
        customerName: data.user.user_metadata?.full_name || data.user.email || 'عميل DEMO',
        customerPhone: 'DEMO-NOT-A-REAL-PHONE',
        deliveryAddress: 'عنوان افتراضي للتجربة',
        items: [{ catalogItemId: item.id, quantity, selectedOptionIds: [] }],
        notes: 'طلب تجريبي فقط',
      }
    });
    button.disabled = false;
    if (error || !result?.ok) return toast('فشل إنشاء الطلب التجريبي: ' + errorText(error || result?.detail || result?.error), 'error');
    // Keep the retry key on failures so a lost response cannot accidentally create a second order.
    try { window.sessionStorage.removeItem(retryKey); } catch (_) {}
    delete button.dataset.clientIdempotencyKey;
    toast('تم إنشاء الطلب داخل قاعدة DEMO بدون دفع.', 'success');
    data.tab = 'orders';
    await loadData();
  }

  async function bookAppointment(button) {
    const item = data.items.find(i => i.id === button.dataset.itemId);
    const business = data.businesses.find(b => b.id === button.dataset.businessId);
    const provider = business?.settings?.demo_provider_id ? { id: business.settings.demo_provider_id } : null;
    if (!item || !business || !provider) return toast('تعذر تحديد مقدم الخدمة لهذه العيادة التجريبية.', 'error');
    const date = $('#appointment-date-' + item.id)?.value || '';
    const time = $('#appointment-time-' + item.id)?.value || '';
    const dateTime = new Date(date + 'T' + time + ':00').getTime();
    if (!date || !time || !Number.isSafeInteger(dateTime) || dateTime <= Date.now()) return toast('اختر تاريخًا ووقتًا مستقبليًا صالحًا.', 'error');
    button.disabled = true;
    const { data: result, error } = await sb.functions.invoke('demo-appointment-create', {
      body: { businessId: business.id, doctorId: provider.id, dateTime, reason: 'موعد تجريبي فقط - لا توجد استشارة فعلية' }
    });
    button.disabled = false;
    if (error || !result?.ok) return toast('فشل الحجز التجريبي: ' + errorText(error || result?.detail || result?.error), 'error');
    toast('تم تسجيل الموعد التجريبي بدون إشعارات أو تحصيل.', 'success');
    data.tab = 'orders';
    await loadData();
  }

  function setTab(tab) {
    const allowed = ['dashboard', 'activities', 'catalog', 'products', 'orders', 'team'];
    if (!allowed.includes(tab)) return;
    if (tab === 'products' && (!selectedBusiness() || !canManage(selectedBusiness().id))) return toast('اختر نشاطًا تملك صلاحية إدارته.', 'error');
    if (tab === 'team' && (String(membershipForBusiness(selectedBusiness()?.id)?.role || '').toUpperCase() !== 'OWNER')) return toast('إدارة الصلاحيات متاحة لمالك النشاط فقط.', 'error');
    data.tab = tab;
    render();
    if (tab === 'team') loadTeam();
  }

  function render() {
    const logoutButton = $('[data-action="logout"]');
    logoutButton.hidden = !data.user;
    if (!cfg || !sdk || typeof sdk.createClient !== 'function') {
      app.innerHTML = '<section class="panel"><div class="connected-error">تعذر تحميل مكتبة Supabase من CDN. تحقق من الاتصال ثم أعد تحميل الصفحة.</div></section>';
      return;
    }
    if (!data.user) return renderAuth();
    if (data.loading) {
      app.innerHTML = '<div class="loading-state">جاري مزامنة بيانات DEMO…</div>';
      return;
    }
    return renderWorkspace();
  }

  async function bootstrap(session) {
    data.session = session;
    data.user = session.user;
    data.dataError = null;
    render();
    try {
      await provisionCustomer();
      await loadData();
    } catch (error) {
      data.loading = false;
      data.dataError = errorText(error);
      render();
    }
  }

  async function login(form) {
    const values = new FormData(form);
    const email = String(values.get('email') || '').trim().toLowerCase();
    const password = String(values.get('password') || '');
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    const { data: result, error } = await sb.auth.signInWithPassword({ email, password });
    button.disabled = false;
    if (error || !result.session) {
      const msg = errorText(error || 'لم يتم إنشاء جلسة تسجيل الدخول.');
      $('#auth-message').textContent = msg;
      $('#auth-message').classList.remove('hide');
      $('#auth-message').classList.add('connected-error');
      return;
    }
    await bootstrap(result.session);
    toast('تم تسجيل الدخول إلى قاعدة DEMO.', 'success');
  }

  async function signup(form) {
    const values = new FormData(form);
    const name = String(values.get('name') || '').trim();
    const email = String(values.get('email') || '').trim().toLowerCase();
    const password = String(values.get('password') || '');
    if (name.length < 2 || password.length < 8) return toast('أدخل اسمًا صحيحًا وكلمة مرور من 8 أحرف على الأقل.', 'error');
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    const { data: result, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, demo_account: true } }
    });
    button.disabled = false;
    if (error) {
      $('#auth-message').textContent = 'تعذر إنشاء الحساب التجريبي: ' + errorText(error);
      $('#auth-message').classList.remove('hide');
      return;
    }
    if (result.session) {
      await bootstrap(result.session);
      toast('تم إنشاء الحساب والدخول إلى DEMO.', 'success');
    } else {
      $('#auth-message').innerHTML = '<strong>تم إرسال طلب إنشاء الحساب.</strong><br>قد يحتاج Supabase Auth إلى تأكيد البريد الإلكتروني. افتح رسالة التأكيد إن وصلت، ثم ارجع إلى هذه الصفحة وسجّل الدخول. لم يتم إنشاء أي حساب في الإنتاج.';
      $('#auth-message').classList.remove('hide');
      $('#auth-message').classList.remove('connected-error');
    }
  }

  async function createBusiness(form) {
    const values = new FormData(form);
    const body = {
      name: String(values.get('name') || '').trim(),
      sector: String(values.get('sector') || 'FOOD'),
      phone: String(values.get('phone') || '').trim(),
      city: String(values.get('city') || '').trim(),
      description: String(values.get('description') || '').trim()
    };
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    const { data: result, error } = await sb.functions.invoke('demo-business-create', { body });
    button.disabled = false;
    if (error || !result?.ok) return toast('تعذر إنشاء النشاط: ' + errorText(error || result?.detail || result?.error), 'error');
    data.selectedBusinessId = result.business_id;
    window.localStorage.setItem('MANTIQATIX_DEMO_ACTIVE_BUSINESS', result.business_id);
    toast('تم إنشاء النشاط والفرع ومنحك دور المالك في DEMO.', 'success');
    data.tab = 'products';
    await loadData();
  }

  async function createProduct(form) {
    const business = selectedBusiness();
    const branch = branchForBusiness(business?.id);
    if (!business || !branch || !canManage(business.id)) return toast('لا تملك صلاحية إدارة هذا الكتالوج.', 'error');
    const values = new FormData(form);
    const name = String(values.get('name') || '').trim();
    const price = Number(values.get('price'));
    const stock = Number(values.get('stock'));
    const itemType = String(values.get('itemType') || sectorForBusiness(business).itemType);
    const description = String(values.get('description') || '').trim();
    if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) return toast('تحقق من الاسم والسعر والكمية.', 'error');
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    const { data: result, error } = await sb.functions.invoke('demo-catalog-write', {
      body: { operation: 'item', businessId: business.id, branchId: branch.id, name, price, stock, itemType, description }
    });
    button.disabled = false;
    if (error || !result?.ok) return toast('تعذر حفظ العنصر والسعر: ' + errorText(error || result?.detail || result?.error), 'error');
    toast('تم حفظ المنتج/الخدمة والسعر في قاعدة DEMO.', 'success');
    await loadData();
  }

  async function updatePrice(form) {
    const businessId = form.dataset.businessId;
    const branchId = form.dataset.branchId;
    const itemId = form.dataset.itemId;
    if (!canManage(businessId)) return toast('لا تملك صلاحية تعديل هذا السعر.', 'error');
    const price = Number(new FormData(form).get('price'));
    if (!Number.isFinite(price) || price < 0) return toast('السعر غير صالح.', 'error');
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    const { data: result, error } = await sb.functions.invoke('demo-catalog-write', {
      body: { operation: 'price', businessId, branchId, itemId, price }
    });
    button.disabled = false;
    if (error || !result?.ok) return toast('تعذر تعديل السعر: ' + errorText(error || result?.detail || result?.error), 'error');
    toast('تم حفظ إصدار سعر جديد في قاعدة DEMO.', 'success');
    await loadData();
  }

  async function updateOrder(form) {
    const orderId = form.dataset.orderId;
    const businessId = form.dataset.businessId;
    if (!canManage(businessId)) return toast('لا تملك صلاحية إدارة هذا الطلب.', 'error');
    const status = String(new FormData(form).get('status') || '');
    const { data: result, error } = await sb.functions.invoke('demo-order-status-update', {
      body: { orderId, tenantId: cfg.tenantId, newStatus: status, reason: 'تحديث حالة من واجهة DEMO' }
    });
    if (error || !result?.ok) return toast('تعذر تغيير حالة الطلب: ' + errorText(error || result?.detail || result?.error), 'error');
    toast('تم تحديث حالة الطلب في قاعدة DEMO.', 'success');
    await loadData();
  }

  async function manageTeam(form) {
    const business = selectedBusiness();
    const branch = branchForBusiness(business?.id);
    if (!business || !branch || String(membershipForBusiness(business.id)?.role).toUpperCase() !== 'OWNER') return toast('إدارة الصلاحيات متاحة لمالك النشاط فقط.', 'error');
    const values = new FormData(form);
    const body = {
      action: 'grant',
      businessId: business.id,
      branchId: branch.id,
      email: String(values.get('email') || '').trim().toLowerCase(),
      role: String(values.get('role') || 'STAFF')
    };
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    const { data: result, error } = await sb.functions.invoke('demo-membership-manage', { body });
    button.disabled = false;
    if (error || !result?.ok) return toast('تعذر حفظ الصلاحية: ' + errorText(error || result?.detail || result?.error), 'error');
    toast('تم تحديث الصلاحية في الفرع التجريبي.', 'success');
    await loadData();
    await loadTeam();
  }

  async function logout() {
    await sb.auth.signOut();
    data.user = null;
    data.session = null;
    data.businesses = [];
    data.branches = [];
    data.memberships = [];
    data.items = [];
    data.prices = [];
    data.orders = [];
    data.appointments = [];
    data.tab = 'dashboard';
    render();
    toast('تم تسجيل الخروج من DEMO.');
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'auth-mode') {
      data.authMode = button.dataset.mode === 'signup' ? 'signup' : 'login';
      renderAuth();
    } else if (button.dataset.action === 'logout') {
      await logout();
    } else if (button.dataset.action === 'refresh') {
      if (data.user) await loadData();
      else renderAuth();
    } else if (button.dataset.action === 'tab') {
      setTab(button.dataset.tab);
    } else if (button.dataset.action === 'select-business') {
      data.selectedBusinessId = button.dataset.businessId;
      window.localStorage.setItem('MANTIQATIX_DEMO_ACTIVE_BUSINESS', data.selectedBusinessId);
      data.tab = 'dashboard';
      render();
    } else if (button.dataset.action === 'catalog-business') {
      data.catalogFilterBusinessId = button.dataset.businessId;
      data.catalogFilterSector = 'ALL';
      data.tab = 'catalog';
      render();
    } else if (button.dataset.action === 'place-order') {
      await placeOrder(button);
    } else if (button.dataset.action === 'book-appointment') {
      await bookAppointment(button);
    }
  });

  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === 'auth-form') {
      event.preventDefault();
      return data.authMode === 'signup' ? signup(form) : login(form);
    }
    if (form.id === 'business-form') {
      event.preventDefault();
      return createBusiness(form);
    }
    if (form.id === 'product-form') {
      event.preventDefault();
      return createProduct(form);
    }
    if (form.id === 'team-form') {
      event.preventDefault();
      return manageTeam(form);
    }
    if (form.dataset.form === 'price-update') {
      event.preventDefault();
      return updatePrice(form);
    }
    if (form.dataset.form === 'order-status') {
      event.preventDefault();
      return updateOrder(form);
    }
  });

  document.addEventListener('change', event => {
    const target = event.target;
    if (target.id === 'active-business') {
      data.selectedBusinessId = target.value;
      window.localStorage.setItem('MANTIQATIX_DEMO_ACTIVE_BUSINESS', target.value);
      render();
    }
    if (target.id === 'filter-sector') {
      data.catalogFilterSector = target.value;
      render();
    }
    if (target.id === 'filter-business') {
      data.catalogFilterBusinessId = target.value;
      render();
    }
  });

  async function boot() {
    if (!cfg || cfg.environment !== 'DEMO' || cfg.paymentsEnabled !== false || !sdk || typeof sdk.createClient !== 'function') {
      app.innerHTML = '<section class="panel"><div class="connected-error">إعدادات DEMO أو مكتبة Supabase غير متاحة. لا تستخدم إعدادات الإنتاج داخل صفحة التجربة.</div></section>';
      return;
    }
    if (location.protocol === 'file:') {
      app.innerHTML = '<section class="panel"><div class="connected-error">لا تفتح الملف مباشرة. شغّل خادمًا محليًا: <code>py -m http.server 8080</code> ثم افتح <code>http://localhost:8080/web/demo/connected.html</code>.</div></section>';
      return;
    }
    sb = sdk.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
    const { data: sessionData, error } = await sb.auth.getSession();
    if (error) {
      data.dataError = errorText(error);
      renderAuth();
      return;
    }
    if (sessionData.session) await bootstrap(sessionData.session);
    else renderAuth();
  }

  boot().catch(error => {
    data.dataError = errorText(error);
    renderAuth();
    toast('تعذر بدء بيئة DEMO: ' + errorText(error), 'error');
  });
})();