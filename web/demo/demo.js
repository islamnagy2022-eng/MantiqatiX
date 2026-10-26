(function () {
  'use strict';

  // This file intentionally uses browser-local storage only.
  // It must not import production config, create a Supabase client, or make network requests.
  const DB_KEY = 'MANTIQATIX_DEMO_DB_V1';
  const SESSION_KEY = 'MANTIQATIX_DEMO_SESSION_V1';
  const SECTORS = {
    FOOD: { label: 'مطاعم وكافيهات', singular: 'صنف من القائمة', plural: 'قائمة الطعام', action: 'طلب وجبة', icon: '🍽️' },
    PHARMACY: { label: 'صيدليات', singular: 'منتج صيدلي تجريبي', plural: 'المنتجات', action: 'طلب منتج تجريبي', icon: '⚕️' },
    DOCTOR: { label: 'أطباء وعيادات', singular: 'خدمة أو موعد', plural: 'الخدمات والمواعيد', action: 'حجز موعد تجريبي', icon: '🩺' },
    STORE: { label: 'متاجر', singular: 'منتج', plural: 'المنتجات', action: 'طلب منتج', icon: '🛍️' }
  };
  const ROLES = {
    OWNER: 'مالك النشاط',
    MANAGER: 'مدير',
    STAFF: 'موظف',
    CUSTOMER: 'عميل'
  };
  const STATUS = {
    PENDING: 'جديد',
    CONFIRMED: 'تم التأكيد',
    PREPARING: 'قيد التجهيز',
    READY: 'جاهز',
    COMPLETED: 'مكتمل',
    CANCELLED: 'ملغي'
  };
  const ALLOWED_TRANSITIONS = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY', 'CANCELLED'],
    READY: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: []
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const money = value => Number(value || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';
  const makeId = prefix => prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  const now = () => new Date().toISOString();
  const datePlus = days => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  function seedDatabase() {
    const users = [
      { id: 'demo_owner', name: 'مالك تجريبي', email: 'owner@demo.mantiqatix', password: 'Demo123!', createdAt: now() },
      { id: 'demo_manager', name: 'مدير تجريبي', email: 'manager@demo.mantiqatix', password: 'Demo123!', createdAt: now() },
      { id: 'demo_staff', name: 'موظف تجريبي', email: 'staff@demo.mantiqatix', password: 'Demo123!', createdAt: now() },
      { id: 'demo_customer', name: 'عميل تجريبي', email: 'customer@demo.mantiqatix', password: 'Demo123!', createdAt: now() }
    ];
    const businesses = [
      { id: 'biz_food', name: 'مطعم التجربة', sector: 'FOOD', phone: '01000000001', city: 'القاهرة', description: 'نشاط افتراضي لاختبار القائمة والطلبات.', createdAt: now() },
      { id: 'biz_pharmacy', name: 'صيدلية التجربة', sector: 'PHARMACY', phone: '01000000002', city: 'القاهرة', description: 'كتالوج تجريبي فقط؛ ليس وصفة أو توصية طبية.', createdAt: now() },
      { id: 'biz_doctor', name: 'عيادة التجربة', sector: 'DOCTOR', phone: '01000000003', city: 'القاهرة', description: 'خدمات ومواعيد افتراضية للاختبار فقط.', createdAt: now() },
      { id: 'biz_store', name: 'متجر التجربة', sector: 'STORE', phone: '01000000004', city: 'القاهرة', description: 'كتالوج منتجات تجريبي.', createdAt: now() }
    ];
    const memberships = [];
    businesses.forEach(b => memberships.push({ id: makeId('mem'), userId: 'demo_owner', businessId: b.id, role: 'OWNER', active: true, createdAt: now() }));
    memberships.push({ id: makeId('mem'), userId: 'demo_manager', businessId: 'biz_food', role: 'MANAGER', active: true, createdAt: now() });
    memberships.push({ id: makeId('mem'), userId: 'demo_staff', businessId: 'biz_food', role: 'STAFF', active: true, createdAt: now() });
    memberships.push({ id: makeId('mem'), userId: 'demo_manager', businessId: 'biz_store', role: 'MANAGER', active: true, createdAt: now() });
    const products = [
      { id: 'prod_food_1', businessId: 'biz_food', name: 'وجبة تجريبية', description: 'صنف افتراضي لاختبار دورة الطلب.', price: 95, stock: 30, active: true, createdAt: now() },
      { id: 'prod_food_2', businessId: 'biz_food', name: 'مشروب تجريبي', description: 'مشروب افتراضي.', price: 35, stock: 50, active: true, createdAt: now() },
      { id: 'prod_pharmacy_1', businessId: 'biz_pharmacy', name: 'شاش طبي تجريبي', description: 'مثال توضيحي للكتالوج وليس توصية طبية.', price: 25, stock: 100, active: true, createdAt: now() },
      { id: 'prod_pharmacy_2', businessId: 'biz_pharmacy', name: 'كمامة طبية تجريبية', description: 'منتج افتراضي للاختبار.', price: 10, stock: 200, active: true, createdAt: now() },
      { id: 'prod_doctor_1', businessId: 'biz_doctor', name: 'كشف تجريبي', description: 'موعد افتراضي، لا يمثل استشارة طبية فعلية.', price: 200, stock: 20, active: true, createdAt: now() },
      { id: 'prod_doctor_2', businessId: 'biz_doctor', name: 'متابعة تجريبية', description: 'خدمة افتراضية لاختبار حجز المواعيد.', price: 100, stock: 20, active: true, createdAt: now() },
      { id: 'prod_store_1', businessId: 'biz_store', name: 'حافظة هاتف تجريبية', description: 'منتج افتراضي.', price: 120, stock: 25, active: true, createdAt: now() },
      { id: 'prod_store_2', businessId: 'biz_store', name: 'سماعة تجريبية', description: 'منتج افتراضي.', price: 450, stock: 12, active: true, createdAt: now() }
    ];
    const orders = [
      { id: 'ord_food_sample', businessId: 'biz_food', customerId: 'demo_customer', customerName: 'عميل تجريبي', productId: 'prod_food_1', productName: 'وجبة تجريبية', quantity: 2, unitPrice: 95, total: 190, status: 'PENDING', paymentMode: 'DEMO_ONLY', appointmentDate: '', appointmentTime: '', note: 'طلب تجريبي مبدئي', createdAt: now(), updatedAt: now() },
      { id: 'ord_pharmacy_sample', businessId: 'biz_pharmacy', customerId: 'demo_customer', customerName: 'عميل تجريبي', productId: 'prod_pharmacy_1', productName: 'شاش طبي تجريبي', quantity: 1, unitPrice: 25, total: 25, status: 'CONFIRMED', paymentMode: 'DEMO_ONLY', appointmentDate: '', appointmentTime: '', note: '', createdAt: now(), updatedAt: now() },
      { id: 'ord_doctor_sample', businessId: 'biz_doctor', customerId: 'demo_customer', customerName: 'عميل تجريبي', productId: 'prod_doctor_1', productName: 'كشف تجريبي', quantity: 1, unitPrice: 200, total: 200, status: 'PENDING', paymentMode: 'DEMO_ONLY', appointmentDate: datePlus(2), appointmentTime: '18:00', note: 'موعد تجريبي', createdAt: now(), updatedAt: now() },
      { id: 'ord_store_sample', businessId: 'biz_store', customerId: 'demo_customer', customerName: 'عميل تجريبي', productId: 'prod_store_1', productName: 'حافظة هاتف تجريبية', quantity: 1, unitPrice: 120, total: 120, status: 'PREPARING', paymentMode: 'DEMO_ONLY', appointmentDate: '', appointmentTime: '', note: '', createdAt: now(), updatedAt: now() }
    ];
    return { version: 1, users, businesses, memberships, products, orders, createdAt: now() };
  }

  function readDb() {
    try {
      const saved = localStorage.getItem(DB_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.version === 1 && Array.isArray(parsed.users) && Array.isArray(parsed.businesses)) {
          return parsed;
        }
      }
    } catch (err) { /* malformed local demo data is reset below */ }
    const fresh = seedDatabase();
    localStorage.setItem(DB_KEY, JSON.stringify(fresh));
    return fresh;
  }

  let db = readDb();
  let activeTab = 'dashboard';
  let catalogSector = 'ALL';
  let catalogBusinessId = 'ALL';
  let toastTimer = null;

  function saveDb() {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }
  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (err) { return null; }
  }
  function setSession(userId, businessId) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, businessId: businessId || null }));
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }
  function currentUser() {
    const s = readSession();
    return s ? db.users.find(u => u.id === s.userId) || null : null;
  }
  function membershipsFor(userId) {
    return db.memberships.filter(m => m.userId === userId && m.active && db.businesses.some(b => b.id === m.businessId));
  }
  function roleFor(userId, businessId) {
    const m = db.memberships.find(x => x.userId === userId && x.businessId === businessId && x.active);
    return m ? m.role : 'CUSTOMER';
  }
  function isBusinessRole(role) {
    return ['OWNER', 'MANAGER', 'STAFF'].includes(role);
  }
  function activeBusinessId() {
    const s = readSession();
    if (!s) return null;
    const allowed = membershipsFor(s.userId).map(m => m.businessId);
    if (s.businessId && allowed.includes(s.businessId)) return s.businessId;
    if (allowed.length) return allowed[0];
    return null;
  }
  function activeBusiness() {
    const id = activeBusinessId();
    return db.businesses.find(b => b.id === id) || null;
  }
  function isOwner(userId, businessId) {
    return roleFor(userId, businessId) === 'OWNER';
  }
  function canManageCatalog(userId, businessId) {
    return ['OWNER', 'MANAGER'].includes(roleFor(userId, businessId));
  }
  function canManageTeam(userId, businessId) {
    return isOwner(userId, businessId);
  }
  function canViewOrders(userId, businessId) {
    return isBusinessRole(roleFor(userId, businessId));
  }
  function canUpdateOrders(userId, businessId) {
    return ['OWNER', 'MANAGER', 'STAFF'].includes(roleFor(userId, businessId));
  }
  function canCreateBusiness() {
    return Boolean(currentUser());
  }
  function currentRoleLabel() {
    const user = currentUser();
    const business = activeBusiness();
    return business ? (ROLES[roleFor(user.id, business.id)] || 'مستخدم') : 'عميل';
  }
  function selectedCatalogBusiness() {
    const businesses = db.businesses.filter(b => (!catalogSector || catalogSector === 'ALL' || b.sector === catalogSector) && (catalogBusinessId === 'ALL' || b.id === catalogBusinessId));
    return businesses;
  }

  function flash(message, type) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast' + (type ? ' ' + type : '');
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3400);
  }

  function navButton(id, label, icon) {
    return '<button class="btn nav-btn' + (activeTab === id ? ' active' : '') + '" type="button" data-action="tab" data-tab="' + id + '">' + icon + ' ' + label + '</button>';
  }
  function pageHeader(title, desc, extra) {
    return '<div class="section-head"><div><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(desc) + '</p></div>' + (extra || '') + '</div>';
  }
  function stat(title, value, foot) {
    return '<article class="card stat-card"><div class="stat-label">' + escapeHtml(title) + '</div><div class="stat-number">' + escapeHtml(value) + '</div><div class="stat-foot">' + escapeHtml(foot) + '</div></article>';
  }
  function businessOptions(list, selected) {
    return list.map(b => '<option value="' + escapeHtml(b.id) + '"' + (b.id === selected ? ' selected' : '') + '>' + escapeHtml(b.name) + ' · ' + escapeHtml(SECTORS[b.sector].label) + '</option>').join('');
  }
  function sectorOptions(selected) {
    return Object.keys(SECTORS).map(k => '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + SECTORS[k].label + '</option>').join('');
  }
  function statusBadge(status) {
    const cls = status === 'COMPLETED' ? 'good' : (status === 'CANCELLED' ? 'bad' : (status === 'PENDING' ? 'warn' : ''));
    return '<span class="badge ' + cls + '">' + escapeHtml(STATUS[status] || status) + '</span>';
  }

  function renderLogin() {
    const app = $('#app');
    app.innerHTML =
      '<div class="auth-layout">' +
        '<section class="hero-panel">' +
          '<div><span class="hero-label">MANTIQATIX · SANDBOX</span><h1>اختبر دورة النشاط كاملة قبل أي إطلاق</h1><p>أنشئ نشاطًا، أضف المنتجات والأسعار، جرّب الطلبات أو حجز المواعيد، وبدّل بين حسابات المالك والمدير والموظف والعميل. كل البيانات داخل هذا المتصفح فقط.</p></div>' +
          '<div><div class="sector-list">' +
            '<div class="sector-chip">' + SECTORS.FOOD.icon + ' ' + SECTORS.FOOD.label + '</div>' +
            '<div class="sector-chip">' + SECTORS.PHARMACY.icon + ' ' + SECTORS.PHARMACY.label + '</div>' +
            '<div class="sector-chip">' + SECTORS.DOCTOR.icon + ' ' + SECTORS.DOCTOR.label + '</div>' +
            '<div class="sector-chip">' + SECTORS.STORE.icon + ' ' + SECTORS.STORE.label + '</div>' +
          '</div><p class="tiny">هذه المحاكاة لا تختبر مصادقة Supabase أو RLS أو التكامل المالي الحقيقي.</p></div>' +
        '</section>' +
        '<section class="panel">' +
          '<h2 class="screen-title">الدخول إلى DEMO</h2><p class="sub-title">استخدم حسابًا تجريبيًا جاهزًا أو أنشئ حسابًا محليًا جديدًا.</p>' +
          '<form id="login-form" class="form-stack">' +
            '<div class="field"><label for="login-email">البريد التجريبي</label><input id="login-email" name="email" type="email" required autocomplete="username" placeholder="owner@demo.mantiqatix"></div>' +
            '<div class="field"><label for="login-password">كلمة المرور التجريبية</label><input id="login-password" name="password" type="password" required autocomplete="current-password" value="Demo123!"></div>' +
            '<div class="form-actions"><button class="btn btn-primary" type="submit">دخول إلى التجربة</button><button class="btn btn-secondary" type="button" data-action="show-register">إنشاء حساب تجريبي</button></div>' +
          '</form>' +
          '<div class="separator"></div><h3 class="sub-title" style="font-size:13px;color:#24364c">حسابات جاهزة للتبديل بين الصلاحيات</h3>' +
          '<div class="demo-accounts">' +
            demoAccount('demo_owner', 'مالك النشاط', 'owner@demo.mantiqatix', 'كامل إدارة الأنشطة والمنتجات والفريق والطلبات') +
            demoAccount('demo_manager', 'مدير', 'manager@demo.mantiqatix', 'إدارة الكتالوج والطلبات ضمن النشاط المعيّن') +
            demoAccount('demo_staff', 'موظف', 'staff@demo.mantiqatix', 'متابعة الطلبات وتغيير حالتها دون إدارة الفريق') +
            demoAccount('demo_customer', 'عميل', 'customer@demo.mantiqatix', 'استعراض الكتالوج وإنشاء الطلبات والحجوزات') +
          '</div><p class="subtle">كلمة المرور المشتركة للحسابات الجاهزة: <strong>Demo123!</strong></p>' +
        '</section>' +
      '</div>';
  }

  function demoAccount(id, role, email, desc) {
    return '<div class="demo-account"><span><strong>' + escapeHtml(role) + '</strong><small>' + escapeHtml(email) + '</small><small>' + escapeHtml(desc) + '</small></span><button class="btn btn-secondary btn-small" type="button" data-action="demo-login" data-user-id="' + id + '">دخول سريع</button></div>';
  }

  function renderRegister() {
    $('#app').innerHTML =
      '<div class="auth-layout">' +
        '<section class="hero-panel"><div><span class="hero-label">حساب محلي تجريبي</span><h1>ابدأ تجربة نشاطك</h1><p>الحساب الجديد يبدأ بدور عميل. يمكنك إنشاء نشاط جديد، وسيصبح لك دور مالك لهذا النشاط داخل المحاكاة فقط.</p></div><p class="tiny">لا تستخدم بريدًا أو كلمة مرور تستخدمهما في أي خدمة حقيقية.</p></section>' +
        '<section class="panel"><h2 class="screen-title">إنشاء حساب تجريبي</h2><p class="sub-title">كل الحقول للتجربة المحلية ولا يتم إرسالها إلى خادم.</p>' +
          '<form id="register-form" class="form-stack">' +
            '<div class="field"><label for="register-name">الاسم</label><input id="register-name" name="name" required maxlength="80" autocomplete="name"></div>' +
            '<div class="field"><label for="register-email">البريد التجريبي</label><input id="register-email" name="email" type="email" required maxlength="180" autocomplete="email"></div>' +
            '<div class="field"><label for="register-password">كلمة المرور التجريبية (6 أحرف على الأقل)</label><input id="register-password" name="password" type="password" minlength="6" required autocomplete="new-password"></div>' +
            '<div class="form-actions"><button class="btn btn-primary" type="submit">إنشاء الحساب</button><button class="btn btn-ghost" type="button" data-action="show-login">العودة للدخول</button></div>' +
          '</form></section></div>';
  }

  function renderWorkspace() {
    const user = currentUser();
    const ownMemberships = membershipsFor(user.id);
    const biz = activeBusiness();
    const role = biz ? roleFor(user.id, biz.id) : 'CUSTOMER';
    const ordersCount = biz && canViewOrders(user.id, biz.id) ? db.orders.filter(o => o.businessId === biz.id).length : db.orders.filter(o => o.customerId === user.id).length;
    const productsCount = biz && canManageCatalog(user.id, biz.id) ? db.products.filter(p => p.businessId === biz.id).length : 0;
    const activeBusinessMenu = ownMemberships.length ? '<div class="nav-divider"></div><div class="field" style="padding:0 6px 7px"><label for="active-business">النشاط المحدد</label><select id="active-business" class="toolbar-select">' + businessOptions(ownMemberships.map(m => db.businesses.find(b => b.id === m.businessId)).filter(Boolean), biz ? biz.id : '') + '</select></div>' : '';
    $('#app').innerHTML =
      '<div class="workspace-header"><div><h1 class="screen-title">مساحة العمل التجريبية</h1><p class="sub-title">أنت داخل بيئة محلية معزولة؛ أي تعديل هنا لا يغيّر بيانات الإنتاج.</p></div>' +
        '<div class="user-box"><div class="user-avatar">' + escapeHtml((user.name || 'م').slice(0, 1)) + '</div><div><strong>' + escapeHtml(user.name) + '</strong><small>' + escapeHtml(user.email) + ' · ' + escapeHtml(biz ? (ROLES[role] || 'مستخدم') : 'عميل') + '</small></div><button class="btn btn-ghost btn-small" data-action="logout" type="button">خروج</button></div></div>' +
      '<div class="workspace-grid"><aside class="panel sidebar">' +
        navButton('dashboard', 'نظرة عامة', '⌂') +
        navButton('catalog', 'الكتالوج والشراء', '▦') +
        navButton('activities', 'الأنشطة', '◈') +
        (biz && canManageCatalog(user.id, biz.id) ? navButton('products', 'المنتجات والأسعار', '＋') : '') +
        navButton('orders', 'الطلبات والمواعيد', '≋') +
        (biz && canManageTeam(user.id, biz.id) ? navButton('team', 'المستخدمون والصلاحيات', '♙') : '') +
        activeBusinessMenu +
        '<div class="nav-divider"></div><div class="notice warning">وضع DEMO محلي فقط<br>لا دفع حقيقي · لا رسائل حقيقية · لا قاعدة إنتاج</div>' +
      '</aside><section class="content-area">' + renderActiveTab(user, biz, role, ordersCount, productsCount) + '</section></div>';
  }

  function renderActiveTab(user, biz, role, ordersCount, productsCount) {
    if (activeTab === 'catalog') return renderCatalog(user);
    if (activeTab === 'activities') return renderActivities(user);
    if (activeTab === 'products') return renderProducts(user, biz, role);
    if (activeTab === 'orders') return renderOrders(user, biz, role);
    if (activeTab === 'team') return renderTeam(user, biz, role);
    return renderDashboard(user, biz, role, ordersCount, productsCount);
  }

  function renderDashboard(user, biz, role, ordersCount, productsCount) {
    const myBusinesses = membershipsFor(user.id).map(m => db.businesses.find(b => b.id === m.businessId)).filter(Boolean);
    const myOrders = biz && canViewOrders(user.id, biz.id) ? db.orders.filter(o => o.businessId === biz.id) : db.orders.filter(o => o.customerId === user.id);
    const products = biz ? db.products.filter(p => p.businessId === biz.id) : [];
    return pageHeader('لوحة التجربة', 'جرّب رحلة النشاط من الإنشاء إلى الطلب أو الموعد وتحديث الحالة.', '<button class="btn btn-primary" data-action="tab" data-tab="activities" type="button">＋ إنشاء نشاط</button>') +
      '<div class="stats-grid">' +
        stat('الأنشطة التي تديرها', myBusinesses.length, 'داخل هذا المتصفح فقط') +
        stat('المنتجات/الخدمات', productsCount, biz ? 'في ' + biz.name : 'أنشئ نشاطًا لتبدأ الإدارة') +
        stat('الطلبات/المواعيد', ordersCount, 'لا يتم تحصيل أموال') +
        stat('دورك الحالي', ROLES[role] || 'عميل', biz ? biz.name : 'استعراض وشراء تجريبي') +
      '</div>' +
      '<section class="panel">' + pageHeader('ابدأ من هنا', 'اختار سيناريو واحدًا ثم راجع النتائج في الطلبات والمواعيد.') +
        '<div class="card-grid">' +
          infoCard('1', 'أنشئ نشاطًا', 'اختر المطاعم أو الصيدليات أو الأطباء أو المتاجر، ثم أضف اسم النشاط وبياناته.', 'activities', 'فتح الأنشطة') +
          infoCard('2', 'أضف منتجًا أو خدمة', 'حدد السعر والكمية والتوفر، أو أضف خدمة ووقتًا مناسبًا للعيادة.', 'products', 'فتح الكتالوج الخاص') +
          infoCard('3', 'أنشئ طلبًا أو موعدًا', 'افتح الكتالوج العام وأنشئ طلبًا تجريبيًا، أو حجزًا لعيادة.', 'catalog', 'استعراض الكتالوج') +
          infoCard('4', 'اختبر الصلاحيات', 'بدّل بين المالك والمدير والموظف والعميل باستخدام الحسابات الجاهزة.', 'orders', 'إدارة الطلبات') +
        '</div></section>' +
      '<section class="panel">' + pageHeader('الأنشطة التجريبية المتاحة', 'هذه أنشطة افتراضية يمكنك تعديلها أو إنشاء أنشطة أخرى.') +
        '<div class="card-grid">' + db.businesses.map(b => businessCard(b, user.id, true)).join('') + '</div></section>' +
      '<div class="notice warning">النتائج تثبت منطق الواجهة ودورة العمل المحلية فقط. هذا لا يغني عن اختبارات Supabase Auth وRLS وتكامل قاعدة البيانات على بيئة DEMO مستقلة.</div>';
  }

  function infoCard(number, title, desc, tab, actionLabel) {
    return '<article class="entity-card"><div class="badge">' + number + '</div><h3 style="margin-top:12px">' + escapeHtml(title) + '</h3><p>' + escapeHtml(desc) + '</p><div class="card-actions"><button class="btn btn-secondary btn-small" data-action="tab" data-tab="' + tab + '" type="button">' + escapeHtml(actionLabel) + '</button></div></article>';
  }

  function businessCard(business, userId, allowCatalog) {
    const s = SECTORS[business.sector] || SECTORS.STORE;
    const role = roleFor(userId, business.id);
    const products = db.products.filter(p => p.businessId === business.id && p.active);
    return '<article class="entity-card"><div class="entity-top"><h3>' + escapeHtml(s.icon + ' ' + business.name) + '</h3><span class="badge">' + escapeHtml(s.label) + '</span></div><p>' + escapeHtml(business.city || '—') + ' · ' + escapeHtml(business.phone || '—') + '</p><p>' + escapeHtml(business.description || '') + '</p><div class="tag-row"><span class="badge">' + products.length + ' منتج/خدمة</span><span class="badge">' + escapeHtml(ROLES[role] || 'عميل') + '</span></div><div class="card-actions">' +
      (membershipsFor(userId).some(m => m.businessId === business.id) ? '<button class="btn btn-primary btn-small" data-action="select-business" data-business-id="' + business.id + '" type="button">إدارة النشاط</button>' : '') +
      (allowCatalog ? '<button class="btn btn-secondary btn-small" data-action="catalog-business" data-business-id="' + business.id + '" type="button">عرض الكتالوج</button>' : '') +
      '</div></article>';
  }

  function renderCatalog(user) {
    const businesses = selectedCatalogBusiness();
    const sectorFilter = '<div class="toolbar"><div class="field"><label for="catalog-sector">القطاع</label><select id="catalog-sector" class="toolbar-select"><option value="ALL">كل القطاعات الأربعة</option>' + sectorOptions(catalogSector).replace('<option value="' + catalogSector + '" selected>', '<option value="' + catalogSector + '" selected>') + '</select></div>' +
      '<div class="field"><label for="catalog-business">النشاط</label><select id="catalog-business" class="toolbar-select"><option value="ALL"' + (catalogBusinessId === 'ALL' ? ' selected' : '') + '>كل الأنشطة</option>' + businessOptions(businesses, catalogBusinessId).replace(/ selected/g, '') + '</select></div></div>';
    const cards = [];
    businesses.forEach(b => {
      const sector = SECTORS[b.sector] || SECTORS.STORE;
      db.products.filter(p => p.businessId === b.id && p.active).forEach(p => {
        cards.push('<article class="entity-card catalog-card"><div class="entity-top"><span class="badge">' + escapeHtml(sector.label) + '</span><span class="catalog-tag">' + escapeHtml(b.name) + '</span></div><h3>' + escapeHtml(p.name) + '</h3><p>' + escapeHtml(p.description || '') + '</p><div class="price">' + money(p.price) + '</div><p>المتاح تجريبيًا: ' + escapeHtml(p.stock) + '</p>' +
          (b.sector === 'DOCTOR' ? '<div class="field"><label for="date-' + p.id + '">تاريخ الموعد</label><input id="date-' + p.id + '" type="date" min="' + datePlus(0) + '" value="' + datePlus(2) + '"></div><div class="field"><label for="time-' + p.id + '">وقت الموعد</label><select id="time-' + p.id + '"><option>10:00</option><option>12:00</option><option selected>18:00</option><option>19:00</option></select></div>' : '') +
          '<div class="field"><label for="qty-' + p.id + '">الكمية</label><input id="qty-' + p.id + '" type="number" min="1" max="20" step="1" value="1"></div><div class="card-actions"><button class="btn btn-primary" data-action="place-order" data-business-id="' + b.id + '" data-product-id="' + p.id + '" type="button">' + (b.sector === 'DOCTOR' ? 'حجز موعد تجريبي' : 'إنشاء طلب تجريبي') + '</button></div><p class="tiny">وضع المحاكاة فقط — لن يتم إرسال طلب لخادم أو تحصيل أموال.</p></article>');
      });
    });
    return pageHeader('الكتالوج والشراء', 'استعرض منتجات الأنشطة الأربعة وجرّب إنشاء الطلب أو حجز الموعد.') +
      '<section class="panel">' + sectorFilter + '</section>' +
      (cards.length ? '<div class="card-grid">' + cards.join('') + '</div>' : '<div class="empty-state">لا توجد منتجات في التصفية الحالية. أضف منتجًا أو خدمة من مساحة إدارة النشاط.</div>');
  }

  function renderActivities(user) {
    const list = membershipsFor(user.id).map(m => db.businesses.find(b => b.id === m.businessId)).filter(Boolean);
    return pageHeader('الأنشطة', 'أنشئ نشاطًا جديدًا أو افتح نشاطًا تديره. المالك يُمنح لنشاطه فقط.') +
      '<section class="panel"><h3 style="margin-top:0">إنشاء نشاط</h3><p class="subtle">القطاعات المتاحة في نطاق DEMO الحالي محددة بأربعة قطاعات فقط.</p>' +
        '<form id="business-form" class="form-stack"><div class="form-grid">' +
          '<div class="field"><label for="business-name">اسم النشاط</label><input id="business-name" name="name" required maxlength="100" placeholder="مثال: مطعم الحي"></div>' +
          '<div class="field"><label for="business-sector">القطاع</label><select id="business-sector" name="sector">' + sectorOptions('FOOD') + '</select></div>' +
          '<div class="field"><label for="business-phone">رقم التواصل التجريبي</label><input id="business-phone" name="phone" inputmode="tel" maxlength="30" placeholder="01000000000"></div>' +
          '<div class="field"><label for="business-city">المدينة</label><input id="business-city" name="city" maxlength="70" value="القاهرة"></div>' +
          '<div class="field span-2"><label for="business-description">وصف النشاط</label><textarea id="business-description" name="description" maxlength="400" placeholder="وصف مختصر يظهر في الكتالوج"></textarea></div>' +
        '</div><div class="form-actions"><button class="btn btn-primary" type="submit">حفظ النشاط التجريبي</button></div></form></section>' +
      '<section class="panel">' + pageHeader('أنشطتي', 'تستطيع إدارة الأنشطة التي تملك فيها عضوية فقط.') +
        (list.length ? '<div class="card-grid">' + list.map(b => businessCard(b, user.id, false)).join('') + '</div>' : '<div class="empty-state">لم تنشئ نشاطًا بعد. أنشئ نشاطًا لتفعيل أدوات إدارة المنتجات والفريق والطلبات.</div>') +
      '</section>';
  }

  function renderProducts(user, business, role) {
    if (!business || !canManageCatalog(user.id, business.id)) {
      return '<section class="panel"><div class="empty-state">لا تملك صلاحية إدارة المنتجات في نشاط محدد. أنشئ نشاطًا أو اختر نشاطًا تديره.</div><button class="btn btn-primary" data-action="tab" data-tab="activities" type="button">فتح الأنشطة</button></section>';
    }
    const sector = SECTORS[business.sector] || SECTORS.STORE;
    const items = db.products.filter(p => p.businessId === business.id);
    const rows = items.map(p => '<tr><td><strong>' + escapeHtml(p.name) + '</strong><br><span class="muted">' + escapeHtml(p.description || '') + '</span></td><td><form class="inline-form" data-form="update-product" data-product-id="' + p.id + '"><input name="price" type="number" min="0" step="0.01" required value="' + escapeHtml(p.price) + '" aria-label="السعر"><input name="stock" type="number" min="0" step="1" required value="' + escapeHtml(p.stock) + '" aria-label="الكمية"><button class="btn btn-secondary btn-small" type="submit">حفظ</button></form></td><td>' + (p.active ? '<span class="badge good">متاح</span>' : '<span class="badge bad">موقوف</span>') + '</td><td><button class="btn btn-ghost btn-small" data-action="toggle-product" data-product-id="' + p.id + '" type="button">' + (p.active ? 'إيقاف' : 'تفعيل') + '</button></td></tr>').join('');
    return pageHeader('المنتجات والأسعار', 'إضافة وتعديل أسعار وتوفر ' + sector.plural + ' للنشاط المحدد: ' + business.name + '.') +
      '<section class="panel"><h3 style="margin-top:0">إضافة ' + escapeHtml(sector.singular) + '</h3>' +
        '<form id="product-form" class="form-stack"><div class="form-grid">' +
          '<div class="field"><label for="product-name">اسم ' + escapeHtml(sector.singular) + '</label><input id="product-name" name="name" required maxlength="100"></div>' +
          '<div class="field"><label for="product-price">السعر بالجنيه المصري</label><input id="product-price" name="price" type="number" min="0" step="0.01" required></div>' +
          '<div class="field"><label for="product-stock">الكمية التجريبية</label><input id="product-stock" name="stock" type="number" min="0" step="1" value="20" required></div>' +
          '<div class="field"><label for="product-available">حالة العرض</label><select id="product-available" name="active"><option value="true">متاح</option><option value="false">غير متاح</option></select></div>' +
          '<div class="field span-2"><label for="product-description">وصف مختصر</label><textarea id="product-description" name="description" maxlength="400"></textarea></div>' +
        '</div><div class="form-actions"><button class="btn btn-primary" type="submit">إضافة إلى الكتالوج</button><button class="btn btn-secondary" type="button" data-action="tab" data-tab="catalog">عرض الكتالوج</button></div></form></section>' +
      '<section class="panel">' + pageHeader('الكتالوج الحالي', items.length + ' عنصرًا تجريبيًا') +
        (items.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>المنتج/الخدمة</th><th>السعر والكمية</th><th>التوفر</th><th>إجراء</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty-state">لا توجد منتجات حتى الآن.</div>') +
      '</section><div class="notice warning">كل الأسعار والكميات تجريبية؛ لا توجد عملية بيع أو مخزون حقيقي.</div>';
  }

  function renderOrders(user, business, role) {
    const businessUser = business && canViewOrders(user.id, business.id);
    const orders = businessUser ? db.orders.filter(o => o.businessId === business.id) : db.orders.filter(o => o.customerId === user.id);
    const rows = orders.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(o => {
      const orderBusiness = db.businesses.find(b => b.id === o.businessId);
      const customer = db.users.find(u => u.id === o.customerId);
      const allowed = business && o.businessId === business.id && canUpdateOrders(user.id, business.id);
      const transitions = allowed ? (ALLOWED_TRANSITIONS[o.status] || []) : [];
      const action = transitions.length ? '<form class="inline-form" data-form="update-order" data-order-id="' + o.id + '"><select name="status" aria-label="الحالة">' + transitions.map(s => '<option value="' + s + '">' + STATUS[s] + '</option>').join('') + '</select><button class="btn btn-secondary btn-small" type="submit">تحديث</button></form>' : '<span class="tiny">لا يوجد انتقال مسموح</span>';
      const date = orderBusiness && orderBusiness.sector === 'DOCTOR' ? escapeHtml(o.appointmentDate || '—') + ' · ' + escapeHtml(o.appointmentTime || '—') : '—';
      return '<tr><td><strong>' + escapeHtml(o.id) + '</strong><br><span class="tiny">' + escapeHtml(new Date(o.createdAt).toLocaleString('ar-EG')) + '</span></td><td>' + escapeHtml(orderBusiness ? orderBusiness.name : '—') + '<br>' + escapeHtml(orderBusiness ? SECTORS[orderBusiness.sector].label : '') + '</td><td>' + escapeHtml(o.productName) + ' × ' + escapeHtml(o.quantity) + (businessUser ? '<br><span class="tiny">' + escapeHtml(customer ? customer.name : o.customerName || 'عميل') + '</span>' : '') + '</td><td>' + money(o.total) + '</td><td>' + statusBadge(o.status) + '</td><td>' + date + '</td><td><span class="badge warn">محاكاة فقط</span><br><span class="tiny">لا يوجد دفع حقيقي</span></td><td>' + action + '</td></tr>';
    }).join('');
    const title = businessUser ? 'طلبات النشاط والمواعيد' : 'طلباتي وحجوزاتي';
    const desc = businessUser ? 'عرض بيانات النشاط المحدد فقط وتحديثات حالة مسموحة حسب دور المستخدم.' : 'يعرض حساب العميل طلباته وحجوزاته الخاصة فقط في هذه المحاكاة المحلية.';
    return pageHeader(title, desc, '<button class="btn btn-secondary" data-action="tab" data-tab="catalog" type="button">＋ إنشاء طلب</button>') +
      '<section class="panel">' +
        (orders.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>رقم الطلب / التاريخ</th><th>النشاط</th><th>العنصر والعميل</th><th>الإجمالي</th><th>الحالة</th><th>الموعد</th><th>الدفع</th><th>الإجراءات</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty-state">لا توجد طلبات حتى الآن. افتح الكتالوج وأنشئ طلبًا أو موعدًا تجريبيًا.</div>') +
      '</section><div class="notice">دورة الحالات: جديد ← تم التأكيد ← قيد التجهيز ← جاهز ← مكتمل. الإلغاء متاح قبل الجاهزية فقط. الحالة والتكلفة هنا للتجربة ولا تُرسل إلى أنظمة خارجية.</div>';
  }

  function renderTeam(user, business, role) {
    if (!business || !canManageTeam(user.id, business.id)) {
      return '<section class="panel"><div class="empty-state">إدارة الصلاحيات متاحة لمالك النشاط فقط. اختر نشاطًا تملكه.</div></section>';
    }
    const members = db.memberships.filter(m => m.businessId === business.id).map(m => ({ member: m, user: db.users.find(u => u.id === m.userId) })).filter(x => x.user);
    const rows = members.map(x => '<tr><td>' + escapeHtml(x.user.name) + '<br><span class="tiny">' + escapeHtml(x.user.email) + '</span></td><td><span class="badge">' + escapeHtml(ROLES[x.member.role] || x.member.role) + '</span></td><td>' + (x.member.userId === user.id ? '<span class="tiny">حسابك الحالي</span>' : '<form class="inline-form" data-form="change-role" data-membership-id="' + x.member.id + '"><select name="role" aria-label="الصلاحية"><option value="MANAGER"' + (x.member.role === 'MANAGER' ? ' selected' : '') + '>مدير</option><option value="STAFF"' + (x.member.role === 'STAFF' ? ' selected' : '') + '>موظف</option><option value="CUSTOMER"' + (x.member.role === 'CUSTOMER' ? ' selected' : '') + '>إزالة صلاحية الإدارة</option></select><button class="btn btn-secondary btn-small" type="submit">حفظ الصلاحية</button></form>') + '</td></tr>').join('');
    return pageHeader('المستخدمون والصلاحيات', 'أضف حسابًا مسجلًا وامنحه دورًا داخل النشاط المحدد. لا يمكن منح دور مالك إضافي من هذه الشاشة.') +
      '<section class="panel"><h3 style="margin-top:0">إضافة مستخدم موجود</h3><form id="team-form" class="form-stack"><div class="form-grid"><div class="field"><label for="team-email">البريد التجريبي للحساب</label><input id="team-email" name="email" type="email" required placeholder="manager@demo.mantiqatix"></div><div class="field"><label for="team-role">الدور</label><select id="team-role" name="role"><option value="MANAGER">مدير</option><option value="STAFF">موظف</option></select></div></div><button class="btn btn-primary" type="submit">منح الصلاحية</button></form><p class="subtle">يمكنك تجربة الحسابات الجاهزة أو إنشاء حساب تجريبي آخر أولًا. صلاحيات هذه الشاشة محاكاة وليست بديلًا عن RLS.</p></section>' +
      '<section class="panel">' + pageHeader('أعضاء النشاط', members.length + ' عضوية') +
      (members.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>المستخدم</th><th>الدور</th><th>التغيير</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty-state">لا يوجد أعضاء.</div>') +
      '</section><div class="notice warning">هذه مصفوفة صلاحيات واجهة تجريبية. التحقق الأمني الحقيقي يجب أن يتم في خادم وقاعدة البيانات، وليس عبر JavaScript المتصفح.</div>';
  }

  function logout() {
    clearSession();
    activeTab = 'dashboard';
    render();
    flash('تم تسجيل الخروج من بيئة DEMO.', 'success');
  }

  function resetDemo() {
    db = seedDatabase();
    saveDb();
    clearSession();
    activeTab = 'dashboard';
    catalogSector = 'ALL';
    catalogBusinessId = 'ALL';
    render();
    flash('تمت إعادة بيانات التجربة الافتراضية. لم تُمس بيانات الإنتاج.', 'success');
  }

  function login(email, password) {
    const user = db.users.find(u => u.email.toLowerCase() === String(email || '').trim().toLowerCase() && u.password === String(password || ''));
    if (!user) {
      flash('بيانات الدخول غير صحيحة في قاعدة DEMO المحلية.', 'error');
      return;
    }
    const membership = membershipsFor(user.id)[0];
    setSession(user.id, membership ? membership.businessId : null);
    activeTab = 'dashboard';
    render();
    flash('تم الدخول إلى المحاكاة المحلية بنجاح.', 'success');
  }

  function register(form) {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');
    if (name.length < 2 || !email.includes('@') || password.length < 6) {
      flash('راجع الاسم والبريد وكلمة المرور التجريبية.', 'error');
      return;
    }
    if (db.users.some(u => u.email.toLowerCase() === email)) {
      flash('هذا البريد مسجل بالفعل في بيانات DEMO المحلية.', 'error');
      return;
    }
    const user = { id: makeId('user'), name, email, password, createdAt: now() };
    db.users.push(user);
    saveDb();
    setSession(user.id, null);
    activeTab = 'activities';
    render();
    flash('تم إنشاء حساب DEMO محلي. لا يوجد تحقق بريد حقيقي.', 'success');
  }

  function createBusiness(form) {
    const user = currentUser();
    if (!canCreateBusiness() || !user) return flash('سجّل الدخول أولًا.', 'error');
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const sector = String(data.get('sector') || '');
    if (name.length < 2 || !SECTORS[sector]) return flash('اسم النشاط أو القطاع غير صالح.', 'error');
    const business = {
      id: makeId('biz'),
      name,
      sector,
      phone: String(data.get('phone') || '').trim(),
      city: String(data.get('city') || '').trim(),
      description: String(data.get('description') || '').trim(),
      createdAt: now()
    };
    db.businesses.push(business);
    db.memberships.push({ id: makeId('mem'), userId: user.id, businessId: business.id, role: 'OWNER', active: true, createdAt: now() });
    saveDb();
    setSession(user.id, business.id);
    activeTab = 'products';
    render();
    flash('تم إنشاء النشاط، وأصبحت مالكه داخل بيئة DEMO.', 'success');
  }

  function createProduct(form) {
    const user = currentUser();
    const business = activeBusiness();
    if (!user || !business || !canManageCatalog(user.id, business.id)) return flash('ليست لديك صلاحية إدارة كتالوج هذا النشاط.', 'error');
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const price = Number(data.get('price'));
    const stock = Number(data.get('stock'));
    if (!name || !Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
      return flash('أدخل اسمًا وسعرًا وكمية صحيحة.', 'error');
    }
    db.products.push({ id: makeId('prod'), businessId: business.id, name, description: String(data.get('description') || '').trim(), price, stock, active: data.get('active') === 'true', createdAt: now() });
    saveDb();
    render();
    flash('تمت إضافة العنصر إلى الكتالوج المحلي.', 'success');
  }

  function updateProduct(form) {
    const user = currentUser();
    const business = activeBusiness();
    if (!user || !business || !canManageCatalog(user.id, business.id)) return flash('ليست لديك صلاحية تعديل الأسعار.', 'error');
    const id = form.dataset.productId;
    const product = db.products.find(p => p.id === id && p.businessId === business.id);
    if (!product) return flash('المنتج غير موجود في النشاط المحدد.', 'error');
    const data = new FormData(form);
    const price = Number(data.get('price'));
    const stock = Number(data.get('stock'));
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) return flash('السعر أو الكمية غير صالحين.', 'error');
    product.price = price;
    product.stock = stock;
    saveDb();
    render();
    flash('تم تحديث السعر والكمية التجريبية.', 'success');
  }

  function placeOrder(businessId, productId) {
    const user = currentUser();
    const business = db.businesses.find(b => b.id === businessId);
    const product = db.products.find(p => p.id === productId && p.businessId === businessId && p.active);
    if (!user || !business || !product) return flash('النشاط أو المنتج غير متاح.', 'error');
    const quantityEl = $('#qty-' + productId);
    const quantity = quantityEl ? Number(quantityEl.value) : 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20 || quantity > Number(product.stock)) {
      return flash('الكمية غير صحيحة أو أكبر من المتاح تجريبيًا.', 'error');
    }
    let appointmentDate = '';
    let appointmentTime = '';
    if (business.sector === 'DOCTOR') {
      appointmentDate = String($('#date-' + productId)?.value || '');
      appointmentTime = String($('#time-' + productId)?.value || '');
      if (!appointmentDate || appointmentDate < datePlus(0) || !appointmentTime) return flash('حدد تاريخًا ووقتًا صالحين للموعد التجريبي.', 'error');
    }
    const order = {
      id: makeId('order'),
      businessId,
      customerId: user.id,
      customerName: user.name,
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: Number(product.price),
      total: Number(product.price) * quantity,
      status: 'PENDING',
      paymentMode: 'DEMO_ONLY',
      appointmentDate,
      appointmentTime,
      note: '',
      createdAt: now(),
      updatedAt: now()
    };
    db.orders.push(order);
    if (business.sector !== 'DOCTOR') product.stock = Math.max(0, Number(product.stock) - quantity);
    saveDb();
    activeTab = 'orders';
    const membership = membershipsFor(user.id).find(m => m.businessId === businessId);
    setSession(user.id, membership ? businessId : activeBusinessId());
    render();
    flash(business.sector === 'DOCTOR' ? 'تم تسجيل موعد تجريبي بدون إرسال إشعار أو تحصيل مبلغ.' : 'تم تسجيل الطلب التجريبي بدون دفع حقيقي.', 'success');
  }

  function updateOrder(form) {
    const user = currentUser();
    const business = activeBusiness();
    const order = db.orders.find(o => o.id === form.dataset.orderId);
    if (!user || !business || !order || order.businessId !== business.id || !canUpdateOrders(user.id, business.id)) return flash('لا توجد صلاحية لتعديل هذا الطلب.', 'error');
    const data = new FormData(form);
    const next = String(data.get('status') || '');
    if (!(ALLOWED_TRANSITIONS[order.status] || []).includes(next)) return flash('انتقال الحالة غير مسموح.', 'error');
    order.status = next;
    order.updatedAt = now();
    saveDb();
    render();
    flash('تم تحديث حالة الطلب في بيانات DEMO فقط.', 'success');
  }

  function addTeamMember(form) {
    const user = currentUser();
    const business = activeBusiness();
    if (!user || !business || !canManageTeam(user.id, business.id)) return flash('إدارة الصلاحيات متاحة لمالك النشاط فقط.', 'error');
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const role = String(data.get('role') || 'STAFF');
    const target = db.users.find(u => u.email.toLowerCase() === email);
    if (!target) return flash('الحساب غير موجود. أنشئ حساب DEMO له أولًا أو استخدم حسابًا جاهزًا.', 'error');
    if (target.id === user.id || !['MANAGER', 'STAFF'].includes(role)) return flash('الدور غير مسموح.', 'error');
    const existing = db.memberships.find(m => m.userId === target.id && m.businessId === business.id);
    if (existing) {
      if (existing.role === 'OWNER') return flash('لا يمكن تغيير دور مالك النشاط من هذه الشاشة.', 'error');
      existing.role = role;
      existing.active = true;
    } else {
      db.memberships.push({ id: makeId('mem'), userId: target.id, businessId: business.id, role, active: true, createdAt: now() });
    }
    saveDb();
    render();
    flash('تم حفظ صلاحية المستخدم ضمن النشاط المحدد محليًا.', 'success');
  }

  function changeRole(form) {
    const user = currentUser();
    const business = activeBusiness();
    const membership = db.memberships.find(m => m.id === form.dataset.membershipId);
    if (!user || !business || !membership || membership.businessId !== business.id || !canManageTeam(user.id, business.id) || membership.userId === user.id) return flash('لا توجد صلاحية لتعديل هذه العضوية.', 'error');
    const role = String(new FormData(form).get('role') || '');
    if (!['MANAGER', 'STAFF', 'CUSTOMER'].includes(role)) return flash('الدور غير مسموح.', 'error');
    if (membership.role === 'OWNER') return flash('لا يمكن إزالة مالك النشاط.', 'error');
    if (role === 'CUSTOMER') {
      membership.active = false;
    } else {
      membership.role = role;
      membership.active = true;
    }
    saveDb();
    render();
    flash(role === 'CUSTOMER' ? 'تم تعطيل صلاحيات الإدارة لهذا المستخدم.' : 'تم تعديل الصلاحية بنجاح.', 'success');
  }

  function toggleProduct(productId) {
    const user = currentUser();
    const business = activeBusiness();
    const p = db.products.find(x => x.id === productId && business && x.businessId === business.id);
    if (!user || !business || !p || !canManageCatalog(user.id, business.id)) return flash('لا توجد صلاحية لتغيير حالة المنتج.', 'error');
    p.active = !p.active;
    saveDb();
    render();
    flash(p.active ? 'تم تفعيل المنتج في DEMO.' : 'تم إيقاف المنتج في DEMO.', 'success');
  }

  function setTab(tab) {
    const allowed = ['dashboard', 'catalog', 'activities', 'products', 'orders', 'team'];
    if (!allowed.includes(tab)) return;
    const user = currentUser();
    const business = activeBusiness();
    if (tab === 'products' && (!business || !canManageCatalog(user.id, business.id))) {
      flash('تحتاج إلى نشاط تملكه أو تديره لفتح المنتجات.', 'error');
      activeTab = 'activities';
    } else if (tab === 'team' && (!business || !canManageTeam(user.id, business.id))) {
      flash('إدارة الفريق متاحة لمالك النشاط فقط.', 'error');
      activeTab = 'activities';
    } else {
      activeTab = tab;
    }
    render();
  }

  function handleAction(button) {
    const action = button.dataset.action;
    if (action === 'tab') return setTab(button.dataset.tab);
    if (action === 'logout') return logout();
    if (action === 'show-register') { renderRegister(); return; }
    if (action === 'show-login') { renderLogin(); return; }
    if (action === 'demo-login') {
      const user = db.users.find(u => u.id === button.dataset.userId);
      if (!user) return flash('الحساب التجريبي غير موجود.', 'error');
      const membership = membershipsFor(user.id)[0];
      setSession(user.id, membership ? membership.businessId : null);
      activeTab = 'dashboard';
      render();
      return flash('تم الدخول السريع إلى حساب DEMO.', 'success');
    }
    if (action === 'reset-demo') {
      if (!window.confirm('سيتم حذف تغييرات DEMO المحلية وإرجاع البيانات التجريبية الافتراضية. لن تتأثر بيانات الإنتاج. متابعة؟')) return;
      resetDemo();
      return;
    }
    if (action === 'select-business') {
      const user = currentUser();
      if (!user || !membershipsFor(user.id).some(m => m.businessId === button.dataset.businessId)) return flash('هذا النشاط ليس ضمن عضوياتك.', 'error');
      setSession(user.id, button.dataset.businessId);
      activeTab = 'dashboard';
      render();
      return;
    }
    if (action === 'catalog-business') {
      catalogSector = 'ALL';
      catalogBusinessId = button.dataset.businessId;
      activeTab = 'catalog';
      render();
      return;
    }
    if (action === 'place-order') return placeOrder(button.dataset.businessId, button.dataset.productId);
    if (action === 'toggle-product') return toggleProduct(button.dataset.productId);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) handleAction(button);
  });

  document.addEventListener('change', event => {
    const target = event.target;
    if (!target) return;
    if (target.id === 'active-business') {
      const user = currentUser();
      if (!user || !membershipsFor(user.id).some(m => m.businessId === target.value)) return flash('النشاط غير متاح لحسابك.', 'error');
      setSession(user.id, target.value);
      render();
    }
    if (target.id === 'catalog-sector') {
      catalogSector = target.value;
      catalogBusinessId = 'ALL';
      render();
    }
    if (target.id === 'catalog-business') {
      catalogBusinessId = target.value;
      render();
    }
  });

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === 'login-form') {
      event.preventDefault();
      const data = new FormData(form);
      login(data.get('email'), data.get('password'));
    } else if (form.id === 'register-form') {
      event.preventDefault();
      register(form);
    } else if (form.id === 'business-form') {
      event.preventDefault();
      createBusiness(form);
    } else if (form.id === 'product-form') {
      event.preventDefault();
      createProduct(form);
    } else if (form.id === 'team-form') {
      event.preventDefault();
      addTeamMember(form);
    } else if (form.dataset.form === 'update-product') {
      event.preventDefault();
      updateProduct(form);
    } else if (form.dataset.form === 'update-order') {
      event.preventDefault();
      updateOrder(form);
    } else if (form.dataset.form === 'change-role') {
      event.preventDefault();
      changeRole(form);
    }
  });

  function render() {
    if (currentUser()) renderWorkspace();
    else renderLogin();
  }

  // Seed only the local demo namespace. No production config is imported.
  render();
})();