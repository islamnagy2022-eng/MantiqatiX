(() => {
  "use strict";

  const cfg = window.MANTIQATIX_CONFIG || window.MNTY_CONFIG;
  const params = new URLSearchParams(window.location.search);
  const businessId = (params.get("businessId") || params.get("business") || "").trim();
  const $ = (id) => document.getElementById(id);
  const state = $("catalog-state");
  const itemsRoot = $("catalog-items");
  const emptyState = $("catalog-empty");
  const branchSelect = $("branch-select");
  const searchInput = $("catalog-search");
  const cartBar = $("catalog-cart-bar");
  const orderDialog = $("catalog-order-dialog");
  const currencyFmt = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 });
  let currentCatalog = null;
  let activeTypeFilter = "ALL";
  let activeCategory = "ALL";
  let cart = new Map();
  let currentWhatsapp = "";

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);

  const amountNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const formatMoney = (value, currency = "EGP") => {
    const amount = currencyFmt.format(Number(value));
    const code = String(currency || "EGP").toUpperCase();
    return amount + " " + (code === "EGP" ? "ج.م" : code);
  };
  const typeLabel = (type) => String(type).toUpperCase() === "SERVICE" ? "خدمة" : "منتج";
  const sectorLabel = (code) => ({
    FOOD: "مطاعم وكافيهات", RESTAURANT: "مطاعم وكافيهات", PHARMACY: "صيدليات",
    HEALTH: "أطباء وعيادات", DOCTOR: "أطباء وعيادات", MEDICAL: "مراكز طبية",
    GROCERY: "بقالة وسوبر ماركت", STORE: "متاجر", FASHION: "متاجر وأزياء",
  }[String(code || "").toUpperCase()] || String(code || "نشاط تجاري"));

  const phoneToWhatsapp = (value) => {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = "20" + digits.slice(1);
    else if (digits.startsWith("1") && digits.length === 10) digits = "20" + digits;
    return digits.length >= 10 && digits.length <= 15 ? digits : "";
  };

  const normalizeDialPhone = (value) => {
    const raw = String(value || "").trim();
    const dial = raw.replace(/[^\d+]/g, "");
    const digits = dial.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15 ? dial : "";
  };

  const normalizeSocialUrl = (value, platform) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const candidate = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
    const hosts = {
      facebook: new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com", "fb.me", "fb.watch"]),
      instagram: new Set(["instagram.com", "www.instagram.com", "instagr.am", "www.instagr.am"]),
      tiktok: new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]),
    };
    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" || !hosts[platform]?.has(url.hostname.toLowerCase()) || url.username || url.password) return "";
      return url.toString();
    } catch {
      return "";
    }
  };

  const renderSocialLinks = (profile) => {
    const root = $("business-social-links");
    if (!root) return;
    root.replaceChildren();
    const options = [
      { field: "facebookUrl", platform: "facebook", label: "فيسبوك", glyph: "f" },
      { field: "tiktokUrl", platform: "tiktok", label: "تيك توك", glyph: "♪" },
      { field: "instagramUrl", platform: "instagram", label: "إنستجرام", glyph: "◎" },
    ];
    for (const option of options) {
      const url = normalizeSocialUrl(profile?.[option.field], option.platform);
      if (!url) continue;
      const link = document.createElement("a");
      link.className = "catalog-btn catalog-social-button catalog-social-" + option.platform;
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", "فتح حساب " + option.label + " في نافذة جديدة");
      const icon = document.createElement("span");
      icon.className = "catalog-social-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = option.glyph;
      const label = document.createElement("span");
      label.textContent = option.label;
      link.append(icon, label);
      root.append(link);
    }
    root.hidden = root.childElementCount === 0;
  };

  const setState = (message, isError = false) => {
    state.textContent = message;
    state.classList.toggle("error", isError);
    state.hidden = false;
    itemsRoot.hidden = true;
    emptyState.hidden = true;
  };

  const activePriceFor = (itemId, branchId) => {
    const candidates = (currentCatalog?.prices || []).filter((price) =>
      String(price.catalog_item_id) === String(itemId) &&
      (!price.branch_id || String(price.branch_id) === String(branchId))
    );
    candidates.sort((a, b) => {
      const aExact = String(a.branch_id || "") === String(branchId || "") ? 1 : 0;
      const bExact = String(b.branch_id || "") === String(branchId || "") ? 1 : 0;
      return bExact - aExact || Number(b.version || 0) - Number(a.version || 0);
    });
    return candidates[0] || null;
  };

  const getVisibleItems = () => {
    if (!currentCatalog) return [];
    const branchId = branchSelect.value || currentCatalog.selectedBranchId;
    const query = (searchInput.value || "").trim().toLocaleLowerCase("ar");
    return (currentCatalog.items || []).filter((item) => {
      const text = [item.nameAr, item.nameEn, item.description, item.category, item.unit]
        .join(" ").toLocaleLowerCase("ar");
      return (!query || text.includes(query)) &&
        (activeTypeFilter === "ALL" || String(item.type).toUpperCase() === activeTypeFilter) &&
        (activeCategory === "ALL" || String(item.category || "عام") === activeCategory) &&
        (!item.branchId || String(item.branchId) === String(branchId));
    });
  };

  const currentBranch = () =>
    (currentCatalog?.branches || []).find((branch) =>
      String(branch.id) === String(branchSelect.value || currentCatalog?.selectedBranchId)
    ) || null;

  const updateWhatsappLinks = () => {
    const branch = currentBranch();
    currentWhatsapp = phoneToWhatsapp(branch?.phone || currentCatalog?.contactPhone || "");
    for (const id of ["whatsapp-link", "footer-whatsapp"]) {
      const link = $(id);
      if (currentWhatsapp) {
        link.href = "https://wa.me/" + currentWhatsapp;
        link.hidden = false;
      } else {
        link.hidden = true;
        link.removeAttribute("href");
      }
    }
    const phoneLink = $("phone-link");
    const dialPhone = normalizeDialPhone(branch?.phone || currentCatalog?.contactPhone || "");
    if (phoneLink) {
      if (dialPhone) {
        phoneLink.href = "tel:" + dialPhone;
        phoneLink.hidden = false;
      } else {
        phoneLink.hidden = true;
        phoneLink.removeAttribute("href");
      }
    }
    renderSocialLinks(currentCatalog?.profile || {});
  };

  function renderBusiness(catalog) {
    const name = catalog.provider?.name || catalog.business?.name || "كتالوج النشاط";
    const profile = catalog.profile || {};
    $("business-name").textContent = name;
    $("business-description").textContent =
      profile.bio || catalog.provider?.description || "استعرض المنتجات والخدمات والأسعار المعلنة للنشاط.";
    document.title = name + " | كتالوج MantiqatiX";
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) descriptionMeta.content = String(profile.bio || catalog.provider?.description || ("كتالوج " + name)).slice(0, 250);

    const cover = $("business-cover");
    if (cover) {
      const image = profile.coverUrl || "";
      cover.style.backgroundImage = image
        ? 'linear-gradient(0deg,#081b37a8,#081b3710 75%),url("' + image.replace(/["\\\n\r]/g, "") + '")'
        : "";
      cover.classList.toggle("has-image", Boolean(image));
    }
    const logo = $("business-logo");
    const fallback = $("business-logo-fallback");
    if (profile.logoUrl) {
      logo.src = profile.logoUrl;
      logo.hidden = false;
      fallback.hidden = true;
      logo.onerror = () => { logo.hidden = true; fallback.hidden = false; };
    } else {
      logo.removeAttribute("src");
      logo.hidden = true;
      fallback.hidden = false;
    }
    fallback.textContent = String(name).trim().slice(0, 1) || "م";

    const badges = [
      sectorLabel(profile.category || catalog.provider?.kind),
      catalog.provider?.verified ? "نشاط موثق" : "",
      catalog.provider?.featured ? "نشاط مميز" : "",
    ].filter(Boolean);
    $("business-badges").innerHTML = badges.map((text) =>
      '<span class="' + (text === "نشاط موثق" ? "is-verified" : text === "نشاط مميز" ? "is-featured" : "") + '">' +
      escapeHtml(text) + "</span>"
    ).join("");

    branchSelect.innerHTML = (catalog.branches || []).map((branch) =>
      '<option value="' + escapeHtml(branch.id) + '">' +
      escapeHtml(branch.name || branch.code || "الفرع") +
      (branch.address ? " — " + escapeHtml(branch.address) : "") +
      "</option>"
    ).join("");
    branchSelect.value = String(catalog.selectedBranchId || "");
    branchSelect.disabled = (catalog.branches || []).length < 2;

    const selectedBranch = currentBranch();
    const meta = [];
    if (profile.governorate) meta.push("محافظة " + profile.governorate);
    if (profile.markaz) meta.push("مركز " + profile.markaz);
    if (profile.village) meta.push("منطقة " + profile.village);
    if (profile.workingHours) meta.push("مواعيد العمل: " + profile.workingHours);
    $("business-meta").innerHTML = meta.map((text) => "<span>" + escapeHtml(text) + "</span>").join("");
    $("branch-contact").textContent = [
      selectedBranch?.name ? "الفرع: " + selectedBranch.name : "",
      selectedBranch?.address || "",
      selectedBranch?.phone ? "الهاتف: " + selectedBranch.phone : "",
    ].filter(Boolean).join(" · ") || "بيانات التواصل غير متاحة حاليًا.";

    updateWhatsappLinks();
    searchInput.disabled = false;
    renderCategoryFilters();
    renderItems();
  }

  function renderCategoryFilters() {
    const root = $("catalog-category-filters");
    if (!root || !currentCatalog) return;
    const categories = [...new Set((currentCatalog.items || [])
      .map((item) => String(item.category || "عام").trim() || "عام"))]
      .sort((a, b) => a.localeCompare(b, "ar"));
    if (activeCategory !== "ALL" && !categories.includes(activeCategory)) activeCategory = "ALL";
    root.innerHTML = [
      '<button type="button" data-category-filter="ALL" class="' + (activeCategory === "ALL" ? "active" : "") + '">جميع الأقسام</button>',
      ...categories.map((category) =>
        '<button type="button" data-category-filter="' + escapeHtml(category) + '" class="' +
        (activeCategory === category ? "active" : "") + '">' + escapeHtml(category) + "</button>"
      ),
    ].join("");
  }

  function cartQuantity(itemId) {
    return cart.get(String(itemId))?.quantity || 0;
  }

  function renderCart() {
    const rows = [...cart.values()];
    const count = rows.reduce((sum, row) => sum + row.quantity, 0);
    let total = 0;
    let unknown = false;
    rows.forEach((row) => {
      if (row.price == null) unknown = true;
      else total += row.price * row.quantity;
    });
    cartBar.hidden = count === 0;
    $("catalog-cart-count").textContent = count + (count === 1 ? " عنصر" : " عناصر");
    $("catalog-cart-total").textContent =
      "الإجمالي التقديري: " + formatMoney(total) + (unknown ? " + أسعار عند الاستفسار" : "");
  }

  function renderItems() {
    if (!currentCatalog) return;
    const visible = getVisibleItems();
    itemsRoot.innerHTML = visible.map((item) => {
      const price = activePriceFor(item.id, branchSelect.value || currentCatalog.selectedBranchId);
      const amount = price ? amountNumber(price.unit_price) : null;
      const compare = amountNumber(item.comparePrice);
      const hasDiscount = amount != null && compare != null && compare > amount;
      const discountPercent = hasDiscount ? Math.round(((compare - amount) / compare) * 100) : 0;
      const qty = cartQuantity(item.id);
      const available = item.available !== false;
      const type = String(item.type).toUpperCase();
      const image = item.imageUrl ? '<img loading="lazy" decoding="async" src="' + escapeHtml(item.imageUrl) + '" alt="' + escapeHtml(item.nameAr || item.nameEn || "") + '">' : '<span class="catalog-item-media-fallback" aria-hidden="true">◇</span>';
      const addButton = !available
        ? '<span class="catalog-item-unavailable">غير متاح حاليًا</span>'
        : qty > 0
          ? '<div class="catalog-qty-control" aria-label="الكمية"><button type="button" data-cart-decrease="' + escapeHtml(item.id) + '" aria-label="تقليل الكمية">−</button><span>' + qty + '</span><button type="button" data-cart-increase="' + escapeHtml(item.id) + '" aria-label="زيادة الكمية">+</button></div>'
          : '<button type="button" class="catalog-add-btn" data-cart-increase="' + escapeHtml(item.id) + '">＋ أضف للطلب</button>';
      return '<article class="catalog-item-card" data-item-id="' + escapeHtml(item.id) + '">' +
        '<div class="catalog-item-media">' + image +
        '<div class="catalog-item-badges"><span class="' + (type === "SERVICE" ? "catalog-item-service" : "") + '">' + typeLabel(type) + '</span>' +
        (hasDiscount ? '<span class="catalog-item-discount">خصم ' + discountPercent + '%</span>' : "") + '</div></div>' +
        '<div class="catalog-item-body"><div class="catalog-item-category">' + escapeHtml(item.category || "عام") + '</div>' +
        '<h3>' + escapeHtml(item.nameAr || item.nameEn || "عنصر في الكتالوج") + '</h3>' +
        '<p>' + escapeHtml(item.description || "لا يوجد وصف إضافي.") + '</p>' +
        '<div class="catalog-item-price-row"><span class="catalog-item-price">' + (amount != null ? formatMoney(amount, price.currency) : "السعر عند الاستفسار") + '</span>' +
        (hasDiscount ? '<span class="catalog-item-compare">' + formatMoney(compare, price.currency) + '</span>' : "") + '</div>' +
        (item.unit ? '<div class="catalog-item-unit">الوحدة: ' + escapeHtml(item.unit) + '</div>' : "") +
        '<div class="catalog-item-actions">' + addButton + '</div></div></article>';
    }).join("");
    state.hidden = true;
    emptyState.hidden = visible.length !== 0;
    itemsRoot.hidden = visible.length === 0;
    itemsRoot.querySelectorAll("[data-cart-increase]").forEach((button) =>
      button.addEventListener("click", () => changeCart(button.dataset.cartIncrease, 1))
    );
    itemsRoot.querySelectorAll("[data-cart-decrease]").forEach((button) =>
      button.addEventListener("click", () => changeCart(button.dataset.cartDecrease, -1))
    );
  }

  function changeCart(itemId, delta) {
    const item = (currentCatalog?.items || []).find((candidate) => String(candidate.id) === String(itemId));
    if (!item || item.available === false) return;
    const key = String(item.id);
    const old = cart.get(key);
    const quantity = (old?.quantity || 0) + delta;
    if (quantity <= 0) cart.delete(key);
    else {
      const price = activePriceFor(item.id, branchSelect.value || currentCatalog.selectedBranchId);
      cart.set(key, {
        item,
        quantity: Math.min(quantity, 99),
        price: price ? amountNumber(price.unit_price) : null,
        currency: price?.currency || "EGP",
      });
    }
    renderItems();
    renderCart();
  }

  const setCatalogLoaded = () => {
    const count = (currentCatalog?.items || []).length;
    setState("");
    state.hidden = true;
    searchInput.disabled = false;
    setTimeout(() => {
      if (currentCatalog && count === 0) {
        itemsRoot.hidden = true;
        emptyState.hidden = false;
      }
    }, 0);
  };

  async function loadCatalog(branchId = "") {
    if (!cfg?.supabaseUrl || !cfg?.supabaseKey) {
      setState("إعدادات الاتصال بكتالوج MantiqatiX غير متاحة. أعد تحميل الصفحة لاحقًا.", true);
      return;
    }
    if (!businessId) {
      setState("الرابط غير مكتمل. استخدم رابط الكتالوج الذي يحتوي على businessId الخاص بالنشاط.", true);
      return;
    }
    setState("جاري تحميل الكتالوج...");
    try {
      const query = new URLSearchParams({ businessId });
      if (branchId) query.set("branchId", branchId);
      const response = await fetch(cfg.supabaseUrl + "/functions/v1/public-catalog?" + query.toString(), {
        method: "GET",
        cache: "no-store",
        headers: { "Accept": "application/json", "apikey": cfg.supabaseKey }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "PUBLIC_CATALOG_UNAVAILABLE");
      currentCatalog = data;
      renderBusiness(data);
      setCatalogLoaded();
    } catch (error) {
      const messages = {
        INVALID_BUSINESS_ID: "رابط النشاط غير صحيح.",
        BUSINESS_NOT_PUBLIC: "هذا النشاط غير متاح للعرض العام حاليًا.",
        CATALOG_NOT_PUBLISHED: "لم ينشر صاحب النشاط الكتالوج بعد.",
        CATALOG_NOT_PUBLIC: "لا يوجد ملف نشاط عام معتمد لهذا النشاط حتى الآن.",
        NO_ACTIVE_BRANCH: "لا يوجد فرع نشط متاح لهذا النشاط حاليًا.",
        BRANCH_NOT_PUBLIC: "الفرع المطلوب غير متاح للعرض العام."
      };
      currentCatalog = null;
      setState(messages[error?.message] || "تعذر تحميل الكتالوج الآن. حاول تحديث الصفحة لاحقًا.", true);
    }
  }

  function openOrderDialog() {
    if (!cart.size) return;
    if (!currentWhatsapp) {
      setState("رقم واتساب النشاط غير متاح في بيانات الفرع، لذلك لم يتم فتح الطلب. تواصل مع إدارة النشاط لتحديث بيانات الاتصال.", true);
      return;
    }
    const review = $("catalog-order-review");
    const rows = [...cart.values()];
    let total = 0;
    let hasUnknown = false;
    const content = rows.map((row) => {
      const lineTotal = row.price == null ? null : row.price * row.quantity;
      if (lineTotal == null) hasUnknown = true;
      else total += lineTotal;
      return '<div class="catalog-order-review-row"><span>' + row.quantity + ' × ' +
        escapeHtml(row.item.nameAr || row.item.nameEn) + '</span><strong>' +
        (lineTotal == null ? "السعر عند الاستفسار" : formatMoney(lineTotal, row.currency)) + '</strong></div>';
    }).join("");
    review.innerHTML = content +
      '<div class="catalog-order-review-total">الإجمالي التقديري: ' + formatMoney(total) +
      (hasUnknown ? " + عناصر بسعر عند الاستفسار" : "") + '</div>';
    if (typeof orderDialog.showModal === "function") orderDialog.showModal();
    else orderDialog.setAttribute("open", "open");
  }

  function submitWhatsappOrder(event) {
    event.preventDefault();
    if (!currentWhatsapp || !cart.size) return;
    const businessName = $("business-name").textContent.trim();
    const branch = currentBranch();
    const name = $("catalog-customer-name").value.trim();
    const phone = $("catalog-customer-phone").value.trim();
    const address = $("catalog-customer-address").value.trim();
    const rows = [...cart.values()];
    let total = 0;
    let hasUnknown = false;
    const itemText = rows.map((row) => {
      const lineTotal = row.price == null ? null : row.price * row.quantity;
      if (lineTotal == null) hasUnknown = true;
      else total += lineTotal;
      return "• " + row.quantity + " × " + (row.item.nameAr || row.item.nameEn || "عنصر") +
        " — " + (lineTotal == null ? "السعر عند الاستفسار" : formatMoney(lineTotal, row.currency));
    }).join("\n");
    const message = [
      "مرحبًا، أريد إرسال طلب من كتالوج MantiqatiX.",
      "النشاط: " + businessName,
      branch?.name ? "الفرع: " + branch.name : "",
      name ? "الاسم: " + name : "",
      phone ? "رقم التواصل: " + phone : "",
      address ? "العنوان/ملاحظات: " + address : "",
      "العناصر المطلوبة:",
      itemText,
      "الإجمالي التقديري: " + formatMoney(total) + (hasUnknown ? " (توجد عناصر تحتاج تأكيد السعر)" : ""),
      "يرجى تأكيد التوافر والإجمالي النهائي قبل التنفيذ. لا يوجد دفع إلكتروني من صفحة الكتالوج."
    ].filter(Boolean).join("\n");
    const url = "https://wa.me/" + currentWhatsapp + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
    orderDialog.close?.();
  }

  branchSelect.addEventListener("change", () => {
    cart.clear();
    renderCart();
    loadCatalog(branchSelect.value);
  });
  searchInput.addEventListener("input", renderItems);
  $("catalog-type-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-type-filter]");
    if (!button) return;
    activeTypeFilter = button.dataset.typeFilter || "ALL";
    $("catalog-type-filters").querySelectorAll("[data-type-filter]").forEach((node) =>
      node.classList.toggle("active", node === button)
    );
    renderItems();
  });
  $("catalog-category-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category-filter]");
    if (!button) return;
    activeCategory = button.dataset.categoryFilter || "ALL";
    renderCategoryFilters();
    renderItems();
  });
  $("share-catalog").addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        $("share-catalog").textContent = "✓";
        setTimeout(() => { $("share-catalog").textContent = "↗"; }, 1800);
      }
    } catch (error) {
      if (error?.name !== "AbortError") window.prompt("انسخ رابط الكتالوج:", window.location.href);
    }
  });
  $("catalog-cart-checkout").addEventListener("click", openOrderDialog);
  $("catalog-cart-clear").addEventListener("click", () => {
    cart.clear();
    renderCart();
    renderItems();
  });
  $("catalog-order-close").addEventListener("click", () => orderDialog.close?.());
  $("catalog-order-cancel").addEventListener("click", () => orderDialog.close?.());
  $("catalog-order-form").addEventListener("submit", submitWhatsappOrder);
  orderDialog.addEventListener("click", (event) => {
    if (event.target === orderDialog) orderDialog.close?.();
  });

  loadCatalog(params.get("branchId") || "");
})();