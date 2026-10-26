(function () {
  'use strict';

  const cfg = window.MANTIQATIX_DEMO_CONFIG;
  const sdk = window.supabase;
  const app = document.getElementById('app');
  const routeParams = new URLSearchParams(window.location.search);
  const requestedBusinessId = routeParams.get('businessId') || routeParams.get('business') || '';
  const requestedTab = routeParams.get('tab') || '';
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
  const data = { user: null, session: null, businesses: [], branches: [], memberships: [], items: [], prices: [], orders: [], providers: [], appointments: [], selectedBusinessId: null, catalogFilterSector: 'ALL', catalogFilterBusinessId: 'ALL', tab: 'dashboard', workspaceMode: null, loading: false };
  let sb;
  let toastTimer = null;
  let authMode = 'login';

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
    const workspaceRoles = ['OWNER', 'BUSINESS_OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'EMPLOYEE', 'SERVICE_PROVIDER'];
    return data.memberships.filter(m =>
      m.status === 'ACTIVE' &&
      m.tenant_id === cfg.tenantId &&
      m.business_id &&
      workspaceRoles.includes(String(m.role || '').toUpperCase())
    );
  }
  function platformOwnerMembership() {
    return data.memberships.find(m =>
      m.status === 'ACTIVE' &&
      m.tenant_id === cfg.tenantId &&
      !m.business_id && !m.branch_id &&
      String(m.role || '').toUpperCase() === 'SUPER_ADMIN' &&
      m.permissions?.scope === 'PLATFORM' &&
      String(m.permissions?.full_control) === 'true'
    ) || null;
  }
  function hasPlatformOwnerAccess() {
    return !!platformOwnerMembership();
  }
  function hasCustomerAccess() {
    return data.memberships.some(m =>
      m.status === 'ACTIVE' &&
      m.tenant_id === cfg.tenantId &&
      !m.business_id && !m.branch_id &&
      String(m.role || '').toUpperCase() === 'CUSTOMER'
    );
  }
  function workspaceModeStorageKey() {
    return 'MANTIQATIX_DEMO_WORKSPACE_MODE_V1:' + String(data.user?.id || 'anonymous');
  }
  function resolveWorkspaceMode() {
    let saved = data.workspaceMode;
    if (!saved && data.user) {
      try { saved = window.localStorage.getItem(workspaceModeStorageKey()); } catch (_) {}
    }
    if (saved === 'PLATFORM' && hasPlatformOwnerAccess()) return 'PLATFORM';
    if (saved === 'OWNER' && (activeMemberships().length || hasPlatformOwnerAccess())) return 'OWNER';
    if (saved === 'CUSTOMER' && hasCustomerAccess()) return 'CUSTOMER';
    if (hasPlatformOwnerAccess()) return 'PLATFORM';
    if (activeMemberships().length) return 'OWNER';
    return 'CUSTOMER';
  }
  function switchWorkspaceMode(mode, initialTab) {
    const next = String(mode || '').toUpperCase();
    if (!['PLATFORM', 'OWNER', 'CUSTOMER'].includes(next)) return;
    if (next === 'PLATFORM' && !hasPlatformOwnerAccess()) {
      return toast('لوحة مالك المنصة تتطلب عضوية منصة مؤكدة من الخادم.', 'error');
    }
    if (next === 'OWNER' && !activeMemberships().length && !hasPlatformOwnerAccess()) {
      return toast('مساحة صاحب النشاط تتطلب عضوية نشاط معتمدة. حساب العميل وحده لا يفتح لوحة الإدارة.', 'error');
    }
    if (next === 'CUSTOMER' && !hasCustomerAccess()) {
      return toast('لم يتم تجهيز سياق العميل لهذا الحساب بعد. حدّث البيانات ثم حاول مرة أخرى.', 'error');
    }
    data.workspaceMode = next;
    try { window.localStorage.setItem(workspaceModeStorageKey(), next); } catch (_) {}
    data.tab = initialTab || 'dashboard';
    render();
  }
  function renderWorkspaceModeSwitcher(mode) {
    const modes = [];
    if (hasPlatformOwnerAccess()) modes.push(['PLATFORM', 'مالك المنصة', 'إدارة عامة للمنصة التجريبية']);
    if (activeMemberships().length || hasPlatformOwnerAccess()) modes.push(['OWNER', 'صاحب النشاط', 'إدارة نشاطك وفروعك وطلباتك']);
    if (hasCustomerAccess()) modes.push(['CUSTOMER', 'العميل', 'الصفحة الرئيسية وتصفح الكتالوج']);
    if (modes.length < 2) return '';
    return '<section class="workspace-mode-panel"><div class="workspace-mode-copy"><strong>تبديل مساحة العمل</strong><small>تغيير طريقة العرض لا يغيّر هويتك أو صلاحيات قاعدة البيانات.</small></div><div class="workspace-mode-switcher" role="group" aria-label="تبديل مساحة العمل">' +
      modes.map(item => '<button type="button" class="mode-switch-btn' + (mode === item[0] ? ' active' : '') + '" data-action="workspace-mode" data-mode="' + item[0] + '" aria-pressed="' + String(mode === item[0]) + '"><strong>' + item[1] + '</strong><small>' + item[2] + '</small></button>').join('') +
      '</div></section>';
  }
  function renderPlatformDashboard() {
    const ownedIds = new Set(activeMemberships().map(m => m.business_id));
    return header('لوحة مالك المنصة', 'نظرة عامة على بيئة DEMO المعزولة فقط. صلاحيات الإنتاج وبياناته غير متاحة من هذه الشاشة.') +
      '<div class="stats-grid">' +
      stat('الأنشطة', data.businesses.length, 'داخل قاعدة DEMO') +
      stat('الفروع', data.branches.length, 'نطاقات تجريبية') +
      stat('المنتجات والخدمات', data.items.length, 'سجلات كتالوج متاحة لهذه الجلسة') +
      stat('الطلبات', data.orders.length, 'بيانات DEMO فقط بلا تحصيل') +
      '</div>' +
      '<section class="panel">' + header('اختر سياق العمل', 'يمكنك الانتقال لإدارة نشاط تملكه أو استخدام المنصة كعميل.') +
      '<div class="card-grid">' +
      '<article class="entity-card"><h3>صاحب النشاط</h3><p>إنشاء نشاط جديد أو إدارة الأنشطة التي تملك عضوية تشغيلية بها فقط.</p><button class="btn btn-primary" data-action="workspace-mode" data-mode="OWNER">دخول مساحة صاحب النشاط</button></article>' +
      '<article class="entity-card"><h3>العميل</h3><p>تصفح كتالوج القطاعات الأربعة، وإنشاء طلب أو حجز من حسابك الشخصي.</p><button class="btn btn-secondary" data-action="workspace-mode" data-mode="CUSTOMER">دخول واجهة العميل</button></article>' +
      '</div></section>' +
      '<section class="panel">' + header('الأنشطة المسجلة', 'عرض معلومات النشاط فقط؛ الإدارة التشغيلية تتم من سياق صاحب النشاط وبحسب عضويته.') +
      (data.businesses.length ? '<div class="card-grid">' + data.businesses.map(b => {
        const sector = sectorForBusiness(b);
        const itemCount = catalogItemsFor(b.id).length;
        const own = ownedIds.has(b.id);
        return '<article class="entity-card"><div class="entity-top"><h3>' + esc(sector.icon + ' ' + b.name) + '</h3><span class="badge">' + esc(sector.label) + '</span></div>' +
          '<p>' + esc(b.settings?.city || '—') + '</p><div class="tag-row"><span class="badge">' + itemCount + ' منتج/خدمة</span>' +
          '<span class="data-chip">' + (own ? 'لديك عضوية نشاط' : 'نطاق منصة') + '</span></div></article>';
      }).join('') + '</div>' : '<div class="empty-state">لا توجد أنشطة مسجلة بعد. انتقل إلى سياق صاحب النشاط لإنشاء أول نشاط.</div>') +
      '</section><div class="notice">صلاحية مالك المنصة معتمدة من عضوية خادم داخل DEMO، ولا تُمنح لأي حساب لمجرد تغيير وضع العرض.</div>';
  }
  function renderCustomerDashboard(orders) {
    const customerOrders = orders.filter(o => o.customer_id === data.user?.id);
    const businesses = data.businesses.filter(b => b.status === 'ACTIVE');
    return header('واجهة العميل', 'تصفح الأنشطة والكتالوج، تابع طلباتك، واحجز موعدًا طبيًا عند الحاجة.',
      '<button class="btn btn-primary" data-action="tab" data-tab="catalog">تصفح الكتالوج</button>') +
      '<div class="stats-grid">' +
      stat('الأنشطة المتاحة', businesses.length, 'في القطاعات الأربعة') +
      stat('طلباتي', customerOrders.length, 'مرتبطة بحسابك فقط') +
      stat('مواعيدي', data.appointments.length, 'مواعيدك الطبية فقط') +
      '</div>' +
      '<section class="panel">' + header('استكشف الأنشطة', 'افتح كتالوج النشاط ثم اختر المنتج أو الخدمة المناسبة.') +
      (businesses.length ? '<div class="card-grid">' + businesses.map(b => activityCard(b, true)).join('') + '</div>' : '<div class="empty-state">لا توجد أنشطة متاحة حتى الآن. عند نشر أنشطة تجريبية ستظهر هنا.</div>') +
      '</section>' +
      '<section class="panel">' + header('متابعة طلباتك', 'تفاصيل الطلبات تظهر لحساب العميل المسجل فقط.') +
      (customerOrders.length ? '<div class="card-grid">' + customerOrders.slice(0, 5).map(o => '<article class="entity-card"><div class="entity-top"><h3>' + esc(businessName(o.business_id)) + '</h3><span class="badge">' + esc(statusLabels[o.status] || o.status) + '</span></div><p>' + esc(o.id) + '</p><div class="price">' + money(o.total_amount) + '</div></article>').join('') + '</div>' : '<div class="empty-state">لا توجد طلبات حتى الآن. يمكنك البدء من الكتالوج.</div>') +
      '</section>';
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
    return ({ SUPER_ADMIN: 'مالك المنصة', OWNER: 'مالك النشاط', BUSINESS_OWNER: 'مالك النشاط', ADMIN: 'مدير نظام النشاط', MANAGER: 'مدير', STAFF: 'موظف', EMPLOYEE: 'موظف', SERVICE_PROVIDER: 'مقدم خدمة', CUSTOMER: 'عميل' })[String(role || '').toUpperCase()] || role || 'مستخدم';
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
      data.workspaceMode = resolveWorkspaceMode();
      const saved = window.localStorage.getItem('MANTIQATIX_DEMO_ACTIVE_BUSINESS') || '';
      const own = activeMemberships();
      const ownsRequestedBusiness = requestedBusinessId && own.some(m => m.business_id === requestedBusinessId);
      data.selectedBusinessId = ownsRequestedBusiness
        ? requestedBusinessId
        : ((saved && own.some(m => m.business_id === saved)) ? saved : (own[0]?.business_id || null));
      if (requestedTab === 'catalog' && requestedBusinessId && data.businesses.some(b => b.id === requestedBusinessId)) {
        data.catalogFilterBusinessId = requestedBusinessId;
        data.catalogFilterSector = 'ALL';
        data.workspaceMode = 'CUSTOMER';
        data.tab = 'catalog';
      } else if (ownsRequestedBusiness) {
        data.workspaceMode = 'OWNER';
        data.tab = requestedTab === 'products' ? 'products' : 'dashboard';
      } else if (requestedTab === 'products') {
        data.tab = 'dashboard';
      }
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
      (membership && data.workspaceMode === 'OWNER' ? '<button class="btn btn-primary btn-small" data-action="select-business" data-business-id="' + business.id + '" type="button">إدارة النشاط</button>' : '') +
      '<button class="btn btn-secondary btn-small" data-action="open-activity" data-business-id="' + business.id + '" type="button">فتح صفحة النشاط</button>' +
      (showCustomerLink ? '<button class="btn btn-secondary btn-small" data-action="catalog-business" data-business-id="' + business.id + '" type="button">تصفح داخل التطبيق</button>' : '') +
      '</div></article>';
  }

  function renderAuth(message = '', messageType = 'error') {
    const isSignup = authMode === 'signup';
    app.innerHTML =
      '<div class="auth-layout"><section class="hero-panel">' +
      '<div><span class="hero-label">MANTIQATIX · DATABASE DEMO</span><h1>كتالوج نشاطك في رابط واحد</h1>' +
      '<p>أنشئ حسابًا تجريبيًا بالبريد وكلمة مرور، وأنشئ نشاطك وأضف المنتجات والأسعار. كل البيانات هنا في قاعدة DEMO منفصلة عن الإنتاج.</p></div>' +
      '<div class="sector-list"><div class="sector-chip">🍽️ مطاعم وكافيهات</div><div class="sector-chip">⚕️ صيدليات</div><div class="sector-chip">🩺 أطباء وعيادات</div><div class="sector-chip">🛍️ متاجر</div></div>' +
      '<p class="tiny">استخدم بريدًا تملكه وكلمة مرور تجريبية. لا تستخدم كلمة مرور Gmail، ولا توجد مدفوعات حقيقية أو بيانات إنتاج في هذه البيئة.</p></section>' +
      '<section class="panel"><h2 class="screen-title">' + (isSignup ? 'إنشاء حساب DEMO' : 'الدخول إلى نسخة DEMO') + '</h2>' +
      '<p class="sub-title">اسم الدخول هو بريدك الإلكتروني. نظام تسجيل الدخول بـ Google في الإنتاج لم يتغير.</p>' +
      '<div class="auth-switch"><button type="button" class="btn ' + (!isSignup ? 'active' : 'btn-secondary') + '" data-action="auth-mode" data-mode="login">تسجيل الدخول</button>' +
      '<button type="button" class="btn ' + (isSignup ? 'active' : 'btn-secondary') + '" data-action="auth-mode" data-mode="signup">إنشاء حساب</button></div>' +
      '<form id="auth-form" data-mode="' + (isSignup ? 'signup' : 'login') + '" class="form-stack">' +
      (isSignup ? '<div class="field"><label for="auth-name">الاسم</label><input id="auth-name" name="fullName" required maxlength="100" autocomplete="name" placeholder="اسمك أو اسم المسؤول"></div>' : '') +
      '<div class="field"><label for="auth-email">البريد الإلكتروني (اسم الدخول)</label><input id="auth-email" name="email" type="email" required maxlength="180" autocomplete="username" placeholder="you@example.com"></div>' +
      '<div class="field"><label for="auth-password">كلمة المرور</label><input id="auth-password" name="password" type="password" required minlength="8" maxlength="128" autocomplete="' + (isSignup ? 'new-password' : 'current-password') + '" placeholder="8 أحرف على الأقل"></div>' +
      '<div class="form-actions"><button class="btn btn-primary" type="submit">' + (isSignup ? 'إنشاء حساب تجريبي' : 'دخول') + '</button></div></form>' +
      (message ? '<div id="auth-message" class="auth-confirm-card ' + (messageType === 'error' ? 'connected-error' : 'connected-success') + '" role="status">' + esc(message) + '</div>' : '') +
      '<p class="connected-note">قد يطلب Supabase تأكيد البريد الإلكتروني قبل أول دخول حسب إعدادات المشروع. لا يلزم تفعيل Google OAuth لاختبار DEMO.</p></section></div>';
  }

  async function submitAuth(form) {
    const mode = form.dataset.mode;
    const values = new FormData(form);
    const email = String(values.get('email') || '').trim().toLowerCase();
    const password = String(values.get('password') || '');
    const fullName = String(values.get('fullName') || '').trim();
    if (!email || password.length < 8) return renderAuth('أدخل بريدًا صحيحًا وكلمة مرور من 8 أحرف على الأقل.', 'error');
    if (mode === 'signup' && !fullName) return renderAuth('أدخل الاسم لإنشاء الحساب.', 'error');
    const button = $('button[type="submit"]', form);
    if (button) button.disabled = true;
    try {
      if (mode === 'signup') {
        const { data: result, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        });
        if (error) throw error;
        if (result?.session) {
          await bootstrap(result.session);
          return;
        }
        authMode = 'login';
        renderAuth('تم إنشاء الحساب. إذا طلب Supabase تأكيد البريد، افتح رسالة التأكيد ثم ارجع وسجّل الدخول بالبريد وكلمة المرور.', 'success');
        return;
      }
      const { data: result, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!result?.session) throw new Error('لم يتم إنشاء جلسة دخول. تحقق من تأكيد البريد ثم أعد المحاولة.');
      await bootstrap(result.session);
    } catch (error) {
      renderAuth((mode === 'signup' ? 'تعذر إنشاء الحساب: ' : 'تعذر تسجيل الدخول: ') + errorText(error), 'error');
    } finally {
      if (button && button.isConnected) button.disabled = false;
    }
  }

  function renderWorkspace() {
    const user = data.user;
    const mode = resolveWorkspaceMode();
    data.workspaceMode = mode;
    const ownerContexts = activeMemberships();
    const business = mode === 'OWNER' ? selectedBusiness() : null;
    const membership = business ? membershipForBusiness(business.id) : null;
    const ownBusinessIds = new Set(ownerContexts.map(m => m.business_id));
    const visibleOrders = mode === 'CUSTOMER'
      ? data.orders.filter(o => o.customer_id === user.id)
      : mode === 'OWNER'
        ? data.orders.filter(o => ownBusinessIds.has(o.business_id))
        : [];
    const userHeader =
      '<div class="workspace-header"><div><h1 class="screen-title">MantiqatiX</h1><p class="sub-title">قاعدة DEMO: ' + esc(cfg.tenantId) + ' · لا معاملات مالية حقيقية.</p><div class="connection-state">اتصال قاعدة البيانات جاهز</div></div>' +
      '<div class="user-box"><div class="user-avatar">' + esc((user.user_metadata?.full_name || user.email || 'م').slice(0, 1)) + '</div><div><strong>' + esc(user.user_metadata?.full_name || user.email) + '</strong><small>' + esc(user.email || '') + ' · ' + (hasPlatformOwnerAccess() ? 'مالك المنصة' : 'حساب DEMO') + '</small></div></div></div>';
    const modeSwitcher = renderWorkspaceModeSwitcher(mode);
    // Ordinary customers receive the public home/catalog only: no workspace switcher,
    // dashboard, sidebar, order history, or owner controls.
    if (mode === 'CUSTOMER' && !hasPlatformOwnerAccess() && activeMemberships().length === 0) {
      $('#app').innerHTML = data.dataError
        ? '<div class="connected-error">' + esc(data.dataError) + '</div><button class="btn btn-secondary" data-action="refresh">إعادة المحاولة</button>'
        : '<section class="customer-home-only"><div class="customer-home-brand"><span class="brand-mark">M</span><div><h1>MantiqatiX</h1><p>اكتشف الأنشطة والمنتجات والخدمات المتاحة</p></div></div>' + renderCatalog() + '</section>';
      return;
    }
    if (mode === 'PLATFORM') {
      $('#app').innerHTML = userHeader + modeSwitcher +
        (data.dataError ? '<div class="connected-error">' + esc(data.dataError) + '</div><button class="btn btn-secondary" data-action="refresh">إعادة المحاولة</button>' : renderPlatformDashboard());
      return;
    }
    let sidebar;
    if (mode === 'CUSTOMER') {
      sidebar =
        navButton('dashboard', 'الرئيسية', '⌂') +
        navButton('catalog', 'تصفح الكتالوج', '▦') +
        navButton('orders', 'طلباتي ومواعيدي', '≋') +
        '<div class="nav-divider"></div><div class="notice warning">وضع العميل<br>طلباتك ومواعيدك مرتبطة بحسابك فقط.</div>';
    } else {
      sidebar =
        navButton('dashboard', 'لوحة النشاط', '⌂') +
        navButton('activities', 'أنشطتي / إنشاء نشاط', '◈') +
        (business && canManage(business.id) ? navButton('products', 'المنتجات والأسعار', '＋') : '') +
        navButton('orders', 'طلبات النشاط', '≋') +
        (business && String(membership?.role).toUpperCase() === 'OWNER' ? navButton('team', 'المستخدمون والصلاحيات', '♙') : '') +
        (ownerContexts.length ? '<div class="nav-divider"></div><div class="field" style="padding:0 6px 7px"><label for="active-business">النشاط المحدد</label><select id="active-business" class="toolbar-select">' +
          ownerContexts.map(m => { const b=data.businesses.find(x=>x.id===m.business_id); return b ? '<option value="' + esc(b.id) + '"' + (b.id===data.selectedBusinessId?' selected':'') + '>' + esc(b.name) + ' · ' + esc(roleLabel(m.role)) + '</option>' : ''; }).join('') +
        '</select></div>' : '') +
        '<div class="nav-divider"></div><div class="notice warning">وضع صاحب النشاط<br>لا يمكنك إدارة نشاط بلا عضوية مخولة.</div>';
    }
    $('#app').innerHTML = userHeader + modeSwitcher +
      '<div class="workspace-grid"><aside class="panel sidebar">' + sidebar + '</aside>' +
      '<section class="content-area">' + (data.dataError ? '<div class="connected-error">' + esc(data.dataError) + '</div><button class="btn btn-secondary" data-action="refresh">إعادة المحاولة</button>' : renderActiveTab(business, membership, visibleOrders)) + '</section></div>';
  }

  function renderActiveTab(business, membership, ownOrders) {
    const mode = resolveWorkspaceMode();
    if (mode === 'PLATFORM') return renderPlatformDashboard();
    if (mode === 'CUSTOMER') {
      if (data.tab === 'catalog') return renderCatalog();
      if (data.tab === 'orders') return renderOrders(null, null, ownOrders, false);
      return renderCustomerDashboard(ownOrders);
    }
    if (data.tab === 'activities') return renderActivities();
    if (data.tab === 'products') return renderProducts(business);
    if (data.tab === 'orders') return renderOrders(business, membership, ownOrders, true);
    if (data.tab === 'team') return renderTeam(business, membership);
    return renderDashboard(business, membership, ownOrders);
  }

  function renderDashboard(business, membership, orders) {
    const own = activeMemberships();
    const ownIds = new Set(own.map(m => m.business_id));
    const ownBusinesses = data.businesses.filter(b => ownIds.has(b.id));
    const ownItems = data.items.filter(item => ownIds.has(item.business_id));
    return header('لوحة صاحب النشاط', 'إدارة الأنشطة التي لديك عضوية تشغيلية بها فقط.',
      '<button class="btn btn-primary" data-action="tab" data-tab="activities">＋ إنشاء نشاط</button>') +
      '<div class="stats-grid">' +
      stat('أنشطتي', ownBusinesses.length, 'الأنشطة المرتبطة بعضويتك') +
      stat('فروعي', data.branches.filter(b => ownIds.has(b.business_id)).length, 'الفروع داخل أنشطتك') +
      stat('منتجات وخدمات', ownItems.length, 'كتالوج أنشطتك') +
      stat('طلبات النشاط', orders.length, 'طلبات تخص الأنشطة التي تديرها') +
      '</div>' +
      '<section class="panel">' + header('أنشطتي', 'اختر نشاطًا لإدارته أو أنشئ نشاطًا جديدًا.') +
      (ownBusinesses.length ? '<div class="card-grid">' + ownBusinesses.map(b => activityCard(b, false)).join('') + '</div>' : '<div class="empty-state">لا توجد عضوية صاحب نشاط لهذا الحساب حتى الآن. أنشئ نشاطًا جديدًا ليُربط بك دور OWNER تلقائيًا.</div>') +
      '</section>' +
      '<div class="notice">تبديل مساحة العمل لا يضيف صلاحيات. كل تغيير يمر من الخادم ويتحقق من عضويتك في النشاط المحدد.</div>';
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
    const isOwner = String(membershipForBusiness(business.id)?.role || '').toUpperCase() === 'OWNER';
    const publicUrl = './activity.html?business=' + encodeURIComponent(business.id);
    const profile = '<section class="panel"><div class="connected-hero"><div><h2 class="screen-title">صفحة النشاط العامة</h2><p class="connected-note">المعلومات الأساسية تظهر أعلى رابط الكتالوج، والمنتجات والأسعار تظهر أسفلها.</p></div><a class="btn btn-secondary" href="' + esc(publicUrl) + '" target="_blank" rel="noopener">معاينة صفحة النشاط ↗</a></div>' +
      (isOwner ? '<form id="business-profile-form" class="form-stack"><div class="form-grid">' +
        '<div class="field"><label for="profile-name">اسم النشاط</label><input id="profile-name" name="name" required maxlength="100" value="' + esc(business.name) + '"></div>' +
        '<div class="field"><label for="profile-phone">رقم التواصل</label><input id="profile-phone" name="phone" maxlength="30" inputmode="tel" value="' + esc(business.settings?.phone || '') + '"></div>' +
        '<div class="field"><label for="profile-city">المدينة</label><input id="profile-city" name="city" maxlength="70" value="' + esc(business.settings?.city || '') + '"></div>' +
        '<div class="field span-2"><label for="profile-description">نبذة عن النشاط</label><textarea id="profile-description" name="description" maxlength="400">' + esc(business.settings?.description || '') + '</textarea></div>' +
        '</div><div class="form-actions"><button class="btn btn-secondary" type="submit">حفظ معلومات النشاط</button></div></form>' :
        '<div class="notice">تعديل بيانات النشاط متاح لمالك النشاط فقط.</div>') + '</section>';
    const createForm = '<section class="panel">' + header('إضافة منتج أو خدمة', 'تُحفظ البيانات والسعر في قاعدة DEMO. يمكنك تعديل المنتج والسعر لاحقًا.') +
      '<form id="product-form" class="form-stack"><div class="form-grid">' +
      '<div class="field"><label for="product-name">اسم المنتج/الخدمة</label><input id="product-name" name="name" required maxlength="180"></div>' +
      '<div class="field"><label for="product-price">السعر (ج.م)</label><input id="product-price" name="price" type="number" min="0" step="0.01" required></div>' +
      '<div class="field"><label for="product-stock">المخزون/السعة التجريبية</label><input id="product-stock" name="stock" type="number" min="0" step="1" value="20" required></div>' +
      '<div class="field"><label for="product-type">النوع</label><select id="product-type" name="itemType"><option value="' + sector.itemType + '">' + (sector.itemType === 'SERVICE' ? 'خدمة/موعد' : 'منتج') + '</option>' +
      (sector.itemType === 'PRODUCT' ? '<option value="SERVICE">خدمة</option>' : '<option value="PRODUCT">منتج</option>') + '</select></div>' +
      '<div class="field span-2"><label for="product-description">الوصف</label><textarea id="product-description" name="description" maxlength="400"></textarea></div>' +
      '</div><div class="form-actions"><button class="btn btn-primary" type="submit">إضافة إلى الكتالوج</button></div></form>' +
      '<p class="connected-note">الدفع الحقيقي معطّل. لا تُدخل بيانات مرضى فعلية أو معلومات حساسة.</p></section>';
    const productCards = items.map(item => {
      const p = priceFor(item);
      const itemBranch = data.branches.find(b => b.id === item.branch_id) || branch;
      const branchId = itemBranch?.id || item.branch_id || '';
      return '<article class="entity-card catalog-owner-card"><div class="entity-top"><h3>' + esc(item.name_ar) + '</h3><span class="badge">' + esc(item.item_type || 'PRODUCT') + '</span></div>' +
        '<div class="tag-row"><span class="data-chip">' + money(p?.unit_price) + '</span><span class="data-chip">المتاح التجريبي: ' + Number(item.metadata?.demo_stock ?? 0) + '</span></div>' +
        '<form class="catalog-edit-form" data-form="item-update" data-item-id="' + esc(item.id) + '" data-business-id="' + esc(business.id) + '" data-branch-id="' + esc(branchId) + '">' +
        '<div class="field"><label>اسم المنتج/الخدمة</label><input name="itemName" required maxlength="180" value="' + esc(item.name_ar) + '"></div>' +
        '<div class="field"><label>الوصف</label><textarea name="description" maxlength="400">' + esc(item.description || '') + '</textarea></div>' +
        '<div class="form-grid"><div class="field"><label>المخزون/السعة</label><input name="stock" type="number" min="0" max="10000000" step="1" required value="' + Number(item.metadata?.demo_stock ?? 0) + '"></div>' +
        '<div class="field"><label>النوع</label><select name="itemType"><option value="PRODUCT"' + (String(item.item_type).toUpperCase() === 'PRODUCT' ? ' selected' : '') + '>منتج</option><option value="SERVICE"' + (String(item.item_type).toUpperCase() === 'SERVICE' ? ' selected' : '') + '>خدمة</option></select></div></div>' +
        '<button class="btn btn-secondary btn-small" type="submit">حفظ بيانات المنتج</button></form>' +
        '<form class="inline-form price-edit-form" data-form="price-update" data-item-id="' + esc(item.id) + '" data-business-id="' + esc(business.id) + '" data-branch-id="' + esc(branchId) + '">' +
        '<label>السعر الجديد (ج.م)</label><input type="number" min="0" max="100000000" step="0.01" required name="price" value="' + esc(p?.unit_price ?? 0) + '" aria-label="السعر الجديد">' +
        '<button class="btn btn-primary btn-small" type="submit">حفظ السعر</button></form></article>';
    }).join('');
    return header('إدارة النشاط والكتالوج', business.name + ' · ' + sector.label,
      '<button class="btn btn-secondary" data-action="customer-catalog">عرض الكتالوج كعميل</button>') +
      profile + createForm + '<section class="panel">' + header('المنتجات والخدمات', items.length + ' عنصرًا في الكتالوج') +
      (productCards ? '<div class="card-grid catalog-owner-grid">' + productCards + '</div>' : '<div class="empty-state">لا توجد منتجات بعد. أضف أول منتج أو خدمة من النموذج أعلاه.</div>') + '</section>';
  }

  function renderOrders(business, membership, orders, allowStatusChanges) {
    return header('الطلبات والمواعيد', 'يظهر فقط ما تسمح به صلاحيات قاعدة البيانات. الطلبات بلا دفع حقيقي.') +
      '<section class="panel">' + header('الطلبات', orders.length + ' سجلًا مرئيًا') +
      (orders.length ? '<div class="card-grid">' + orders.map(o => {
        const staff = allowStatusChanges === true && (canManage(o.business_id) || ['STAFF','EMPLOYEE'].includes(String(membershipForBusiness(o.business_id)?.role || '').toUpperCase()));
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

    // Keep one pending request per user/business/branch/item. If the result is ambiguous,
    // retry with the same quantity/key; do not silently turn it into a second order.
    const retryScope = ['MANTIQATIX_DEMO_ORDER_RETRY_V1', data.user.id, business.id, branchId, item.id].join(':');
    let pendingRetry = null;
    try {
      const raw = window.sessionStorage.getItem(retryScope);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.clientIdempotencyKey === 'string' &&
            parsed.clientIdempotencyKey.length >= 8 && Number.isInteger(parsed.quantity)) {
          pendingRetry = parsed;
        }
      }
    } catch (_) {}
    if (!pendingRetry && button.dataset.idempotencyScope === retryScope &&
        typeof button.dataset.clientIdempotencyKey === 'string' &&
        Number.isInteger(Number(button.dataset.idempotencyQuantity))) {
      pendingRetry = {
        clientIdempotencyKey: button.dataset.clientIdempotencyKey,
        quantity: Number(button.dataset.idempotencyQuantity),
      };
    }
    if (pendingRetry && pendingRetry.quantity !== quantity) {
      return toast('نتيجة محاولة الطلب السابقة غير مؤكدة. أعد المحاولة بنفس الكمية أولًا لتجنب تكرار الطلب.', 'error');
    }

    const clientIdempotencyKey = pendingRetry?.clientIdempotencyKey || makeIdempotencyKey();
    button.dataset.idempotencyScope = retryScope;
    button.dataset.idempotencyQuantity = String(quantity);
    button.dataset.clientIdempotencyKey = clientIdempotencyKey;
    try { window.sessionStorage.setItem(retryScope, JSON.stringify({ clientIdempotencyKey, quantity })); } catch (_) {}

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
    if (error || !result?.ok) {
      const status = Number(error?.context?.status || 0);
      const definitiveHttpFailure = status >= 400 && status < 500 && ![408, 425, 429].includes(status);
      const definitivePayloadFailure = !error && Boolean(result);
      if (definitiveHttpFailure || definitivePayloadFailure) {
        try { window.sessionStorage.removeItem(retryScope); } catch (_) {}
        delete button.dataset.clientIdempotencyKey;
        delete button.dataset.idempotencyScope;
        delete button.dataset.idempotencyQuantity;
      }
      return toast('فشل إنشاء الطلب التجريبي: ' + errorText(error || result?.detail || result?.error), 'error');
    }

    try { window.sessionStorage.removeItem(retryScope); } catch (_) {}
    delete button.dataset.clientIdempotencyKey;
    delete button.dataset.idempotencyScope;
    delete button.dataset.idempotencyQuantity;
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
    if (data.user?.id !== session.user?.id) data.workspaceMode = null;
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
    data.workspaceMode = 'OWNER';
    try { window.localStorage.setItem(workspaceModeStorageKey(), 'OWNER'); } catch (_) {}
    toast('تم إنشاء النشاط والفرع ومنحك دور المالك في DEMO.', 'success');
    data.tab = 'products';
    await loadData();
  }

  async function saveBusinessProfile(form) {
    const business = selectedBusiness();
    const branch = branchForBusiness(business?.id);
    if (!business || !branch || String(membershipForBusiness(business.id)?.role || '').toUpperCase() !== 'OWNER') return toast('تعديل بيانات النشاط متاح لمالك النشاط فقط.', 'error');
    const values = new FormData(form);
    const body = { operation: 'business-profile', businessId: business.id, branchId: branch.id,
      name: String(values.get('name') || '').trim(), phone: String(values.get('phone') || '').trim(),
      city: String(values.get('city') || '').trim(), description: String(values.get('description') || '').trim() };
    const button = $('button[type="submit"]', form);
    if (button) button.disabled = true;
    const { data: result, error } = await sb.functions.invoke('demo-catalog-write', { body });
    if (button && button.isConnected) button.disabled = false;
    if (error || !result?.ok) return toast('تعذر حفظ معلومات النشاط: ' + errorText(error || result?.detail || result?.error), 'error');
    toast('تم حفظ معلومات النشاط في DEMO.', 'success');
    await loadData();
  }

  async function updateCatalogItem(form) {
    const businessId = form.dataset.businessId;
    const branchId = form.dataset.branchId;
    if (!canManage(businessId)) return toast('لا تملك صلاحية تعديل هذا المنتج.', 'error');
    const values = new FormData(form);
    const body = { operation: 'update-item', businessId, branchId, itemId: form.dataset.itemId,
      name: String(values.get('itemName') || '').trim(), description: String(values.get('description') || '').trim(),
      stock: Number(values.get('stock')), itemType: String(values.get('itemType') || 'PRODUCT') };
    if (!body.name || body.name.length > 180 || body.description.length > 400 || !Number.isInteger(body.stock) || body.stock < 0 || body.stock > 10000000) {
      return toast('تحقق من اسم المنتج والوصف والمخزون.', 'error');
    }
    const button = $('button[type="submit"]', form);
    if (button) button.disabled = true;
    const { data: result, error } = await sb.functions.invoke('demo-catalog-write', { body });
    if (button && button.isConnected) button.disabled = false;
    if (error || !result?.ok) return toast('تعذر تعديل المنتج: ' + errorText(error || result?.detail || result?.error), 'error');
    toast('تم تحديث بيانات المنتج/الخدمة.', 'success');
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
    data.workspaceMode = null;
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
      authMode = button.dataset.mode === 'signup' ? 'signup' : 'login';
      return renderAuth();
    } else if (button.dataset.action === 'open-activity') {
      window.location.href = './activity.html?business=' + encodeURIComponent(button.dataset.businessId || '');
    } else if (button.dataset.action === 'workspace-mode') {
      switchWorkspaceMode(button.dataset.mode);
    } else if (button.dataset.action === 'customer-catalog') {
      switchWorkspaceMode('CUSTOMER', 'catalog');
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
      switchWorkspaceMode('CUSTOMER', 'catalog');
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
      return submitAuth(form);
    }
    if (form.id === 'business-profile-form') {
      event.preventDefault();
      return saveBusinessProfile(form);
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
    if (form.dataset.form === 'item-update') {
      event.preventDefault();
      return updateCatalogItem(form);
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