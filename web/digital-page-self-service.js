(() => {
  const cfg = window.MANTIQATIX_CONFIG || {};
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
  const $ = id => document.getElementById(id);
  let user = null, orders = [], pages = [], currentPage = null, menuSection = null, items = [], editIndex = -1;

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
      $('auth').textContent = 'سجل الدخول إلى MantiqatiX أولًا حتى نعرض اشتراكك وصفحاتك.';
      return;
    }
    $('auth').textContent = 'تم تسجيل الدخول. يتم تحميل الاشتراكات والصفحات المرتبطة بحسابك.';
    $('app').hidden = false;
    await Promise.all([loadOrders(), loadPages()]);
  }
  async function loadOrders() {
    const { data, error } = await sb.from('digital_page_orders')
      .select('id,title,page_type,payment_status,fulfillment_status,created_at')
      .eq('user_id', user.id).eq('page_type', 'MENU').eq('payment_status', 'PAID')
      .in('fulfillment_status', ['REQUESTED','IN_REVIEW','IN_PROGRESS','PUBLISHED'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    orders = data || [];
    const sel = $('order');
    sel.replaceChildren(new Option('اختر اشتراكًا مدفوعًا', ''));
    for (const o of orders) sel.add(new Option(o.title + ' · ' + o.fulfillment_status, o.id));
    if (!orders.length) {
      $('auth').textContent = 'لا يوجد اشتراك Menu مدفوع متاح لهذا الحساب حتى الآن. اشترك أولًا لتفعيل صفحة المنتجات.';
      $('page-form').querySelectorAll('input,textarea,select,button').forEach(x => x.disabled = true);
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
    $('order').value = p.digital_page_order_id || '';
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
      const number = $('whatsapp').value.replace(/\D/g, '');
      if (!/^[0-9]{8,15}$/.test(number)) throw new Error('رقم واتساب غير صحيح. اكتب الرقم الدولي أرقامًا فقط.');
      const slug = $('slug').value.trim();
      if (!/^[A-Za-z0-9-]{2,80}$/.test(slug)) throw new Error('الرابط المختصر يجب أن يتكون من حروف إنجليزية وأرقام وشرطة فقط.');
      const values = {
        page_type: 'MENU', title: $('title').value.trim(), slug,
        description: $('description').value.trim() || null, whatsapp_number: number,
        updated_by: user.id, status: 'DRAFT'
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
      renderPages();
      message('تم حفظ بيانات الصفحة كمسودة. بعد مراجعة الاشتراك واعتماد النشر سيصبح الرابط متاحًا للجميع.');
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
  start().catch(e => message(e.message || 'تعذر تحميل صفحة الإدارة.', true));
})();