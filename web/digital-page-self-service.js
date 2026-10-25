(() => {
  const cfg = window.MANTIQATIX_CONFIG || {};
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
  const $ = id => document.getElementById(id);
  let user = null, orders = [], products = [], pages = [], currentPage = null, menuSection = null, items = [], editIndex = -1;
  const pendingCheckoutKeys = new Map();

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
    await loadPages();
    await Promise.all([loadOrders(), loadSubscriptionProducts()]);
  }
  async function loadOrders() {
    const { data, error } = await sb.from('digital_page_orders')
      .select('id,title,page_type,payment_status,fulfillment_status,created_at')
      .eq('user_id', user.id).eq('page_type', 'PORTFOLIO').eq('payment_status', 'PAID')
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
    for (const o of orders) sel.add(new Option(o.title + ' · ' + o.fulfillment_status, o.id));
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
    $('new-page').disabled = !orders.length;
    if (!canManage) {
      $('auth').textContent = 'لا يوجد اشتراك صفحات مدفوع متاح لهذا الحساب حتى الآن. اختر باقة من الأعلى لتفعيل صفحة المنتجات.';
    }
  }
  async function loadSubscriptionProducts() {
    const { data, error } = await sb.from('digital_page_products')
      .select('id,page_type,code,name_ar,description_ar,price,currency,duration_days,features')
      .eq('page_type', 'PORTFOLIO').eq('active', true)
      .order('price', { ascending: true });
    if (error) throw error;
    products = data || [];
    renderSubscriptionProducts();
  }
  function renderSubscriptionProducts() {
    const box = $('subscription-products');
    box.replaceChildren();
    if (!products.length) {
      box.append(node('p', 'لا توجد باقات متاحة حاليًا. حاول لاحقًا أو تواصل مع الدعم.'));
      return;
    }
    for (const product of products) {
      const card = node('article', undefined, 'subscription-card');
      card.append(node('h3', product.name_ar));
      card.append(node('p', product.description_ar || 'صفحة تسويقية مستقلة قابلة للمشاركة'));
      const duration = Number(product.duration_days || 365);
      card.append(node('p', duration.toLocaleString('ar-EG') + ' يوم'));
      card.append(node('strong', Number(product.price).toLocaleString('ar-EG') + ' ' + (product.currency || 'EGP'), 'subscription-price'));
      const buy = node('button', 'اشترك الآن');
      buy.type = 'button';
      buy.addEventListener('click', () => subscribeToPackage(product.id, buy));
      card.append(buy);
      box.append(card);
    }
  }
  async function subscribeToPackage(productId, button) {
    let checkoutWindow = null;
    try {
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error('الباقة لم تعد متاحة. حدّث الصفحة وحاول مرة أخرى.');
      const { data: sessionData, error: sessionError } = await sb.auth.getSession();
      if (sessionError) throw sessionError;
      const session = sessionData.session;
      if (!session?.access_token) throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.');
      if (!session.user?.email || !session.user?.phone) {
        throw new Error('للدفع الإلكتروني يلزم أن يكون البريد الإلكتروني ورقم الهاتف موجودين في حسابك.');
      }
      checkoutWindow = window.open('about:blank', '_blank');
      if (!checkoutWindow) throw new Error('اسمح بفتح نافذة الدفع من المتصفح ثم اضغط اشتراك مرة أخرى.');
      button.disabled = true;
      message('جارٍ إنشاء طلب الاشتراك وتجهيز الدفع الآمن…');
      const key = pendingCheckoutKeys.get(productId) || ('pagall-' + user.id + '-' + productId + '-' + crypto.randomUUID());
      pendingCheckoutKeys.set(productId, key);
      const { data: orderResult, error: orderError } = await sb.functions.invoke('digital-page-order-create', {
        body: {
          productId: product.id,
          pageType: 'PORTFOLIO',
          title: 'صفحة تسويقية - ' + product.name_ar,
          idempotencyKey: key
        }
      });
      if (orderError) throw new Error('تعذر إنشاء طلب الاشتراك. ' + (orderResult?.error || orderError.message || 'حاول مرة أخرى.'));
      const order = orderResult?.order;
      if (!order?.id) throw new Error('لم يتم استلام رقم طلب الاشتراك.');
      const { data: payment, error: paymentError } = await sb.functions.invoke('digital-page-payment-intent', {
        body: { orderId: order.id, idempotencyKey: key }
      });
      if (paymentError) throw new Error('تم إنشاء طلب الاشتراك لكن تعذر تجهيز الدفع. ' + (payment?.error || paymentError.message || 'تواصل مع الدعم قبل تكرار الدفع.'));
      if (payment?.checkoutUrl) {
        message('تم تجهيز الدفع الآمن. أكمل الدفع في النافذة الجديدة ثم ارجع إلى هنا لتحديث حالة الاشتراك.');
        checkoutWindow.location.replace(payment.checkoutUrl);
        pendingCheckoutKeys.delete(productId);
        return;
      }
      checkoutWindow.close();
      if (payment?.status === 'PAID') {
        pendingCheckoutKeys.delete(productId);
        await loadOrders();
        message('الاشتراك مدفوع بالفعل. حدّث القائمة وابدأ إنشاء صفحتك.');
        return;
      }
      throw new Error('لم يرجع مزود الدفع رابطًا صالحًا. لا تعاود الدفع قبل تحديث حالة الطلب أو التواصل مع الدعم.');
    } catch (err) {
      if (checkoutWindow && !checkoutWindow.closed) checkoutWindow.close();
      message(err.message || 'تعذر بدء الاشتراك.', true);
    } finally {
      button.disabled = false;
    }
  }
  async function loadPages() {
    const { data, error } = await sb.from('digital_pages')
      .select('id,page_type,digital_page_order_id,slug,title,description,status,whatsapp_number,updated_at')
      .eq('owner_user_id', user.id).order('updated_at', { ascending: false });
    if (error) throw error;
    pages = data || [];
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
      row.append(node('strong', p.title), node('p', p.slug + ' · ' + p.status));
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
      details.append(node('p', (item.description || '') + (item.description ? ' · ' : '') + Number(item.price || 0).toLocaleString('ar-EG') + ' ج.م'));
      if (item.image_url) details.append(node('p', 'توجد صورة مرتبطة بالمنتج', 'hint'));
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
      row.append(details, edit, del); box.append(row);
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
      if (!orderId) throw new Error('اختر اشتراكًا مدفوعًا أولًا.');
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
          ...values, owner_user_id: user.id, business_id: null, provider_profile_id: null,
          digital_page_order_id: orderId, created_by: user.id
        }).select('id,page_type,digital_page_order_id,slug,title,description,status,whatsapp_number,updated_at').single();
        if (error) throw error;
        currentPage = data;
        $('products-panel').hidden = false;
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
  $('new-page')?.addEventListener('click', async () => {
    currentPage = null;
    menuSection = null;
    items = [];
    editIndex = -1;
    $('page-form').reset();
    $('order').disabled = false;
    $('products-panel').hidden = true;
    $('product-form').reset();
    $('product-form').querySelector('button[type=submit]').textContent = 'إضافة المنتج';
    renderItems();
    try {
      await loadOrders();
      message(orders.length ? 'اختر اشتراكًا غير مستخدم لإنشاء صفحة جديدة.' : 'لا يوجد اشتراك متاح لإنشاء صفحة جديدة. اشترك في باقة أخرى أولًا.');
    } catch (e) { message(e.message || 'تعذر تحميل الاشتراكات.', true); }
  });
  $('refresh-subscriptions')?.addEventListener('click', async () => {
    try { await loadPages(); await loadOrders(); message('تم تحديث حالة الاشتراك والصفحات.'); }
    catch (e) { message(e.message || 'تعذر تحديث الاشتراك.', true); }
  });
  start().catch(e => message(e.message || 'تعذر تحميل صفحة الإدارة.', true));
})();