(() => {
  const cfg = window.MANTIQATIX_CONFIG || {};
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
  const $ = id => document.getElementById(id);
  let user = null, orders = [], products = [], pages = [], businesses = [], businessesUnavailable = false, currentPage = null, menuSection = null, items = [], editIndex = -1, pendingSubscriptionKeys = new Map();

  function message(text, bad = false) {
    $('status').textContent = text || '';
    $('status').className = bad ? 'status error' : 'status';
  }
  function node(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function makeLink(slug) {
    return new URL('digital-page.html?slug=' + encodeURIComponent(slug), location.href).href;
  }
  async function start() {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    user = data.session?.user || null;
    if (!user) {
      $('auth').replaceChildren(node('p', 'سجل الدخول إلى MantiqatiX أولًا حتى نعرض اشتراكك وصفحاتك.'));
      const login = node('a', 'العودة إلى MantiqatiX لتسجيل الدخول'); login.href = 'index.html'; $('auth').append(login);
      return;
    }
    $('auth').textContent = 'تم تسجيل الدخول. يتم تحميل الاشتراكات والصفحات المرتبطة بحسابك.';
    $('app').hidden = false;
    await loadOwnedBusinesses();
    await loadPages();
    await Promise.all([loadOrders(), loadSubscriptionProducts()]);
  }
  async function loadOwnedBusinesses() {
    businessesUnavailable = false;
    const memberships = await sb.from('user_memberships').select('business_id,role,status')
      .eq('user_id', user.id).eq('status', 'ACTIVE')
      .in('role', ['OWNER','BUSINESS_OWNER','ADMIN','MANAGER']).not('business_id', 'is', null);
    if (memberships.error) { businessesUnavailable = true; businesses = []; return; }
    const ids = [...new Set((memberships.data || []).map(m => String(m.business_id)).filter(Boolean))];
    if (!ids.length) { businesses = []; return; }
    const rows = await sb.from('businesses').select('id,name,code').in('id', ids);
    if (rows.error) { businessesUnavailable = true; businesses = []; return; }
    businesses = rows.data || [];
  }
  async function loadOrders() {
    const { data, error } = await sb.from('digital_page_orders')
      .select('id,title,page_type,target_business_id,payment_status,fulfillment_status,created_at')
      .eq('user_id', user.id).eq('payment_status', 'PAID')
      .in('fulfillment_status', ['REQUESTED','IN_REVIEW','IN_PROGRESS','PUBLISHED'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    const paid = data || [];
    const checks = await Promise.all(paid.map(async o => {
      const { data: active, error: entitlementError } = await sb.rpc('digital_page_subscription_active', { p_order_id: o.id, p_user_id: user.id });
      if (entitlementError) throw entitlementError;
      return active === true ? o : null;
    }));
    orders = checks.filter(Boolean).filter(o => !pages.some(p => p.digital_page_order_id === o.id));
    const sel = $('order');
    sel.replaceChildren(new Option('اختر اشتراكًا مدفوعًا', ''));
    for (const o of orders) {
      const business = businesses.find(b => String(b.id) === String(o.target_business_id));
      const typeLabel = o.page_type === 'MENU' ? 'منيو' : 'صفحة شخصية';
      sel.add(new Option(typeLabel + ' · ' + o.title + (business ? ' · ' + business.name : '') + ' · ' + o.fulfillment_status, o.id));
    }
    if (currentPage?.digital_page_order_id && !sel.querySelector('option[value="' + currentPage.digital_page_order_id + '"]')) {
      const { data: currentOrder } = await sb.from('digital_page_orders')
        .select('id,title,page_type,payment_status,fulfillment_status,created_at')
        .eq('id', currentPage.digital_page_order_id).maybeSingle();
      if (currentOrder) sel.add(new Option(currentOrder.title + ' · ' + currentOrder.fulfillment_status, currentOrder.id));
      sel.value = currentPage.digital_page_order_id;
    }
    const canManage = orders.length > 0 || !!currentPage;
    $('page-form').querySelectorAll('input,textarea,select,button').forEach(x => x.disabled = !canManage);
    $('order').disabled = !!currentPage || !orders.length;
    $('new-page').disabled = !orders.some(o => !pages.some(p => p.digital_page_order_id === o.id));
    if (!canManage) {
      $('auth').textContent = 'لا يوجد اشتراك صفحات مدفوع متاح لهذا الحساب حتى الآن. اختر باقة من الأعلى لتفعيل صفحة المنتجات.';
    }
  }
  async function loadSubscriptionProducts() {
    const { data, error } = await sb.from('digital_page_products')
      .select('id,page_type,code,name_ar,description_ar,price,currency,duration_days,features')
      .eq('active', true).order('price', { ascending: true });
    if (error) throw error;
    products = (data || []).filter(p => p.page_type === 'PORTFOLIO' || (p.page_type === 'MENU' && businesses.length > 0));
    renderSubscriptionProducts();
  }
  function renderSubscriptionProducts() {
    const box = $('subscription-products');
    box.replaceChildren();
    if (businessesUnavailable) box.append(node('p', 'تعذر التحقق من الأنشطة المرتبطة بالحساب؛ تم إخفاء باقات المنيو مؤقتًا حفاظًا على عزل الملكية.', 'hint'));
    if (!products.length) {
      box.append(node('p', 'لا توجد باقات متاحة حاليًا. حاول لاحقًا أو تواصل مع الدعم.'));
      return;
    }
    for (const product of products) {
      const card = node('article', undefined, 'subscription-card');
      card.append(node('h3', product.name_ar));
      card.append(node('p', product.description_ar || (product.page_type === 'MENU' ? 'منيو رقمية مرتبطة بنشاطك' : 'صفحة تسويقية مستقلة قابلة للمشاركة')));
      let businessSelect = null;
      if (product.page_type === 'MENU') {
        businessSelect = node('select');
        businessSelect.id = 'digital-menu-business-' + product.id;
        businessSelect.setAttribute('aria-label', 'النشاط الذي ستنشأ له المنيو');
        businessSelect.add(new Option('اختر النشاط', ''));
        businesses.forEach(b => businessSelect.add(new Option(b.name || b.code || b.id, b.id)));
        const businessLabel = node('label', 'النشاط المرتبط بالمنيو');
        businessLabel.htmlFor = businessSelect.id;
        card.append(businessLabel);
        card.append(businessSelect);
      }
      const duration = Number(product.duration_days || 365);
      card.append(node('p', duration.toLocaleString('ar-EG') + ' يوم'));
      card.append(node('strong', Number(product.price).toLocaleString('ar-EG') + ' ' + (product.currency || 'EGP'), 'subscription-price'));
      const buy = node('button', 'اشترك الآن');
      buy.type = 'button';
      buy.addEventListener('click', () => {
        const targetBusinessId = product.page_type === 'MENU' ? (businessSelect?.value || '') : '';
        if (product.page_type === 'MENU' && !targetBusinessId) { message('اختر النشاط المرتبط بالمنيو أولًا.', true); businessSelect?.focus(); return; }
        buy.disabled = true;
        const whatsappWindow = window.open('about:blank', '_blank');
        if (whatsappWindow) whatsappWindow.opener = null;
        subscribeToPackage(product.id, buy, whatsappWindow, targetBusinessId || null);
      });
      card.append(buy);
      box.append(card);
    }
  }
  async function subscribeToPackage(productId, button, whatsappWindow, targetBusinessId = null) {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error('الباقة لم تعد متاحة. حدّث الصفحة وحاول مرة أخرى.');
      const { data: sessionData, error: sessionError } = await sb.auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionData.session?.user;
      if (!user) throw new Error('سجّل الدخول مرة أخرى ثم حاول.');

      if (!whatsappWindow) throw new Error('اسمح بفتح نافذة واتساب من المتصفح ثم حاول مرة أخرى.');

      const subscriptionKey = product.id + ':' + (targetBusinessId || 'personal');
      let idempotencyKey = pendingSubscriptionKeys.get(subscriptionKey);
      if (!idempotencyKey) {
        idempotencyKey = 'digital-page-wa:' + user.id + ':' + product.id + ':' + (targetBusinessId || 'personal') + ':' + window.crypto.randomUUID();
        pendingSubscriptionKeys.set(subscriptionKey, idempotencyKey);
      }
      const { data: orderResult, error: orderError } = await sb.functions.invoke('digital-page-order-create', {
        body: {
          productId: product.id,
          pageType: product.page_type,
          targetBusinessId: targetBusinessId || undefined,
          title: String(product.name_ar || product.name_en || (product.page_type === 'MENU' ? 'اشتراك منيو رقمية' : 'اشتراك صفحة تسويقية')).slice(0, 180),
          idempotencyKey
        }
      });
      if (orderError) throw orderError;
      const order = orderResult?.order;
      if (!order?.id) throw new Error('لم يتم إنشاء طلب الاشتراك. حاول مرة أخرى أو تواصل مع الدعم.');

      const supportPhone = '201010171770';
      const messageText = [
        product.page_type === 'MENU' ? 'طلب اشتراك منيو رقمية على MantiqatiX' : 'طلب اشتراك صفحة تسويقية على MantiqatiX',
        'رقم الطلب: ' + order.id,
        'الباقة: ' + (product.name_ar || product.name_en || 'صفحة تسويقية'),
        'السعر المعروض: ' + Number(product.price).toLocaleString('ar-EG') + ' ' + (product.currency || 'EGP'),
        'المدة: ' + Number(product.duration_days || 365) + ' يوم',
        'البريد: ' + (user.email || 'غير متاح'),
        targetBusinessId ? 'النشاط: ' + (businesses.find(b => String(b.id) === String(targetBusinessId))?.name || targetBusinessId) : '',
        'معرّف الحساب: ' + user.id,
        'حالة الطلب الحالية: ' + String(order.payment_status || 'PENDING'),
        'يرجى مراجعة الطلب وتأكيد طريقة الدفع والتفعيل. لن يتم تفعيل الاشتراك قبل المراجعة الإدارية.'
      ].join('\n');
      const whatsappUrl = 'https://wa.me/' + supportPhone + '?text=' + encodeURIComponent(messageText);
      whatsappWindow.location.replace(whatsappUrl);
      message('تم إنشاء طلب غير مدفوع وتجهيز رسالة واتساب للدعم. لن يتم تحصيل أي دفع إلكتروني من هذه الصفحة حاليًا. لن يتم تفعيل الاشتراك تلقائيًا.');
    } catch (err) {
      if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
      message(err.message || 'تعذر تجهيز طلب الاشتراك عبر واتساب.', true);
    } finally {
      button.disabled = false;
    }
  }
  async function loadPages() {
    const own = await sb.from('digital_pages')
      .select('id,page_type,owner_user_id,business_id,digital_page_order_id,slug,title,description,status,whatsapp_number,updated_at')
      .eq('owner_user_id', user.id).order('updated_at', { ascending: false });
    if (own.error) throw own.error;
    let businessPages = [];
    if (businesses.length) {
      const owned = await sb.from('digital_pages')
        .select('id,page_type,owner_user_id,business_id,digital_page_order_id,slug,title,description,status,whatsapp_number,updated_at')
        .in('business_id', businesses.map(b => b.id)).order('updated_at', { ascending: false });
      if (owned.error) throw owned.error;
      businessPages = owned.data || [];
    }
    pages = [...(own.data || []), ...businessPages].filter((p, i, all) => all.findIndex(x => x.id === p.id) === i);
    renderPages();
  }
  function renderPages() {
    const box = $('pages');
    box.replaceChildren();
    if (!pages.length) {
      box.append(node('p', 'لم تنشئ صفحة بعد. اختر اشتراكك واملأ البيانات.'));
      return;
    }
    for (const p of pages) {
      const row = node('article', undefined, 'page-row');
      const business = businesses.find(b => String(b.id) === String(p.business_id));
      row.append(node('strong', p.title), node('p', (p.page_type === 'MENU' ? 'منيو' : 'صفحة شخصية') + ' · ' + p.slug + ' · ' + p.status + (business ? ' · ' + business.name : '')));
      const open = node('a', 'فتح الرابط');
      open.href = makeLink(p.slug); open.target = '_blank'; open.rel = 'noopener';
      const edit = node('button', 'إدارة الصفحة');
      edit.type = 'button';
      edit.addEventListener('click', () => choosePage(p));
      row.append(open, edit);
      box.append(row);
    }
  }
  async function choosePage(p) {
    currentPage = p;
    configureProductEditor();
    if (p.digital_page_order_id && !$('order').querySelector('option[value="' + p.digital_page_order_id + '"]')) {
      const { data: order } = await sb.from('digital_page_orders').select('id,title,page_type,payment_status,fulfillment_status,created_at').eq('id', p.digital_page_order_id).maybeSingle();
      if (order) $('order').add(new Option(order.title + ' · ' + order.fulfillment_status, order.id));
    }
    $('order').value = p.digital_page_order_id || '';
    $('order').disabled = true;
    $('title').value = p.title || '';
    $('slug').value = p.slug || '';
    $('description').value = p.description || '';
    $('whatsapp').value = p.whatsapp_number || '';
    $('products-panel').hidden = false;
    await loadMenuSection();
    message('تم تحميل الصفحة. عدّل البيانات أو أضف المنتجات ثم احفظ.');
  }
  function configureProductEditor() {
    const menuMode = currentPage?.page_type === 'MENU';
    const notice = $('menu-canonical-notice');
    const form = $('product-form');
    if (notice) notice.hidden = !menuMode;
    if (form) form.hidden = menuMode;
  }
  async function loadMenuSection() {
    const { data, error } = await sb.from('digital_page_sections')
      .select('id,section_type,title,content,data,sort_order,active')
      .eq('page_id', currentPage.id).eq('section_type', 'MENU')
      .order('sort_order', { ascending: true }).limit(1).maybeSingle();
    if (error) throw error;
    menuSection = data || null;
    items = Array.isArray(menuSection?.data?.items) ? menuSection.data.items : [];
    renderItems();
  }
  function renderItems() {
    const box = $('product-list');
    box.replaceChildren();
    if (!items.length) box.append(node('p', 'لا توجد منتجات بعد.'));
    items.forEach((item, i) => {
      const row = node('article', undefined, 'product-row');
      const details = node('div');
      details.append(node('strong', item.name || 'منتج بدون اسم'));
      details.append(node('p', (item.category ? item.category + ' · ' : '') + (item.description || '') + (item.description ? ' · ' : '') + Number(item.price || 0).toLocaleString('ar-EG') + ' ج.م'));
      if (item.image_url) details.append(node('p', 'توجد صورة مرتبطة بالمنتج', 'hint'));
      if (currentPage?.page_type === 'MENU') {
        row.append(details, node('span', 'يتم التحديث من مديول المطاعم', 'hint'));
      } else {
        const edit = node('button', 'تعديل'); edit.type = 'button';
        edit.addEventListener('click', () => {
          editIndex = i;
          $('product-name').value = item.name || '';
          $('product-price').value = item.price ?? '';
          $('product-description').value = item.description || '';
          $('product-image').value = item.image_url || '';
          $('product-form').querySelector('button[type=submit]').textContent = 'حفظ تعديل المنتج';
          $('product-name').focus();
        });
        const del = node('button', 'حذف'); del.type = 'button'; del.className = 'danger';
        del.addEventListener('click', async () => {
          const next = items.filter((_, idx) => idx !== i);
          await saveItems(next);
        });
        row.append(details, edit, del);
      }
      box.append(row);
    });
  }
  async function saveItems(nextItems) {
    const payload = {
      page_id: currentPage.id, section_type: 'MENU', title: 'المنتجات والأسعار',
      content: 'منتجات النشاط وأسعارها', data: { items: nextItems }, sort_order: 0, active: true
    };
    let result;
    if (menuSection) {
      result = await sb.from('digital_page_sections').update({
        title: payload.title, content: payload.content, data: payload.data, active: true
      }).eq('id', menuSection.id);
    } else {
      result = await sb.from('digital_page_sections').insert(payload).select().single();
      if (!result.error) menuSection = result.data;
    }
    if (result.error) throw result.error;
    items = nextItems;
    renderItems();
    message('تم حفظ المنتجات والأسعار.');
  }
  $('page-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const orderId = $('order').value;
      if (!orderId) throw new Error('تواصل مع الدعم عبر واتساب لتفعيل الاشتراك أولًا.');
      const selectedOrder = orders.find(o => o.id === orderId);
      if (!currentPage && !selectedOrder) throw new Error('الاشتراك المحدد غير متاح.');
      const number = $('whatsapp').value.replace(/\D/g, '');
      if (!/^[0-9]{8,15}$/.test(number)) throw new Error('رقم واتساب غير صحيح. اكتب الرقم الدولي أرقامًا فقط.');
      const slug = $('slug').value.trim();
      if (!/^[A-Za-z0-9-]{2,80}$/.test(slug)) throw new Error('الرابط المختصر يجب أن يتكون من حروف إنجليزية وأرقام وشرطة فقط.');
      const values = {
        page_type: currentPage?.page_type || selectedOrder.page_type, title: $('title').value.trim(), slug,
        description: $('description').value.trim() || null, whatsapp_number: number,
        updated_by: user.id, status: currentPage?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
      };
      if (currentPage) {
        const { data, error } = await sb.from('digital_pages').update(values)
          .eq('id', currentPage.id).select('id,page_type,digital_page_order_id,slug,title,description,status,whatsapp_number,updated_at').single();
        if (error) throw error;
        currentPage = data;
      } else {
        const { data, error } = await sb.from('digital_pages').insert({
          ...values,
          owner_user_id: selectedOrder.page_type === 'MENU' ? null : user.id,
          business_id: selectedOrder.page_type === 'MENU' ? selectedOrder.target_business_id : null,
          provider_profile_id: null,
          digital_page_order_id: orderId, created_by: user.id
        }).select('id,page_type,digital_page_order_id,slug,title,description,status,whatsapp_number,updated_at').single();
        if (error) throw error;
        currentPage = data;
        $('products-panel').hidden = false;
        configureProductEditor();
        items = []; menuSection = null;
      }
      await loadPages();
      await loadOrders();
      renderPages();
      message(currentPage.status === 'PUBLISHED' ? 'تم حفظ تعديلات الصفحة المنشورة.' : 'تم حفظ بيانات الصفحة كمسودة. بعد مراجعة الاشتراك واعتماد النشر سيصبح الرابط متاحًا للجميع.');
    } catch (err) { message(err.message || 'تعذر حفظ الصفحة.', true); }
  });
  $('product-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      if (!currentPage) throw new Error('احفظ بيانات الصفحة أولًا.');
      if (currentPage.page_type === 'MENU') throw new Error('منيو المطعم تُدار من مديول المطاعم لتجنب تكرار المنتجات.');
      const name = $('product-name').value.trim();
      const price = Number($('product-price').value);
      if (!name || !Number.isFinite(price) || price < 0) throw new Error('راجع اسم المنتج والسعر.');
      const item = {
        name, price, currency: 'EGP',
        description: $('product-description').value.trim(),
        image_url: $('product-image').value.trim() || null
      };
      const next = [...items];
      if (editIndex >= 0) next[editIndex] = item; else next.push(item);
      await saveItems(next);
      editIndex = -1;
      $('product-form').reset();
      $('product-form').querySelector('button[type=submit]').textContent = 'إضافة المنتج';
    } catch (err) { message(err.message || 'تعذر حفظ المنتج.', true); }
  });
  async function startNewPage() {
    currentPage = null;
    menuSection = null;
    items = [];
    editIndex = -1;
    $('page-form').reset();
    $('order').disabled = false;
    $('products-panel').hidden = true;
    configureProductEditor();
    $('product-form').reset();
    $('product-form').querySelector('button[type=submit]').textContent = 'إضافة المنتج';
    renderItems();
    try {
      await loadOrders();
      message(orders.length ? 'اختر اشتراكًا مفعلًا وغير مستخدم لإنشاء صفحة جديدة.' : 'لا يوجد اشتراك مفعل لإنشاء صفحة جديدة. تواصل مع دعم MantiqatiX عبر واتساب للمراجعة والتفعيل ثم اضغط تحديث الاشتراكات.', !orders.length);
      $('title').focus();
    } catch (e) { message(e.message || 'تعذر تحميل الاشتراكات.', true); }
  }
  $('new-page')?.addEventListener('click', startNewPage);
  $('new-page-secondary')?.addEventListener('click', startNewPage);
  $('refresh-subscriptions')?.addEventListener('click', async () => {
    try {
      await loadPages();
      await loadOrders();
      message('تم تحديث الاشتراكات والصفحات. طلب التفعيل يتم عبر واتساب مؤقتًا.');
    } catch (e) { message(e.message || 'تعذر تحديث الاشتراكات.', true); }
  });
  start().catch(e => message(e.message || 'تعذر تحميل صفحة الإدارة.', true));
})();