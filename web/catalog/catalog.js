(() => {
  "use strict";
  const cfg = window.MANTIQATIX_CONFIG || window.MNTY_CONFIG;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const businessId = (params.get("businessId") || params.get("business") || "").trim();
  const state = $("catalog-state");
  const itemsRoot = $("catalog-items");
  const emptyState = $("catalog-empty");
  const branchSelect = $("branch-select");
  const searchInput = $("catalog-search");
  let currentCatalog = null;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);

  const money = (value, currency) => {
    const amount = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(Number(value));
    const code = String(currency || "EGP").toUpperCase();
    return amount + " " + (code === "EGP" ? "ج.م" : code);
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

  const phoneToWhatsapp = (value) => {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = "20" + digits.slice(1);
    return digits.length >= 10 && digits.length <= 15 ? digits : "";
  };

  const setState = (message, isError = false) => {
    state.textContent = message;
    state.classList.toggle("error", isError);
    state.hidden = false;
    itemsRoot.hidden = true;
    emptyState.hidden = true;
  };

  function renderBusiness(catalog) {
    $("business-name").textContent = catalog.provider?.name || catalog.business?.name || "كتالوج النشاط";
    $("business-description").textContent = catalog.provider?.description || "المنتجات والخدمات والأسعار المعلنة للنشاط.";
    const meta = [
      catalog.provider?.kind ? "القطاع: " + catalog.provider.kind : "",
      catalog.provider?.verified ? "نشاط موثق" : "",
      catalog.provider?.featured ? "نشاط مميز" : "",
      catalog.business?.code ? "كود النشاط: " + catalog.business.code : ""
    ].filter(Boolean);
    $("business-meta").innerHTML = meta.map((text) => "<span>" + escapeHtml(text) + "</span>").join("");

    const selectedBranch = (catalog.branches || []).find((branch) => String(branch.id) === String(catalog.selectedBranchId));
    const wa = phoneToWhatsapp(selectedBranch?.phone);
    for (const id of ["whatsapp-link", "footer-whatsapp"]) {
      const link = $(id);
      if (wa) {
        link.href = "https://wa.me/" + wa;
        link.hidden = false;
      } else {
        link.hidden = true;
        link.removeAttribute("href");
      }
    }

    branchSelect.innerHTML = (catalog.branches || []).map((branch) =>
      '<option value="' + escapeHtml(branch.id) + '">' +
      escapeHtml(branch.name || branch.code || branch.id) +
      (branch.address ? " — " + escapeHtml(branch.address) : "") +
      "</option>"
    ).join("");
    branchSelect.value = String(catalog.selectedBranchId || "");
    branchSelect.disabled = (catalog.branches || []).length < 2;
    searchInput.disabled = false;
    renderItems();
  }

  function renderItems() {
    if (!currentCatalog) return;
    const selectedBranch = branchSelect.value || currentCatalog.selectedBranchId;
    const query = (searchInput.value || "").trim().toLocaleLowerCase("ar");
    const items = (currentCatalog.items || []).filter((item) => {
      const text = [item.name_ar, item.name_en, item.description, item.item_type].join(" ").toLocaleLowerCase("ar");
      return !query || text.includes(query);
    });
    const cards = items.map((item) => {
      const price = activePriceFor(item.id, selectedBranch);
      const options = (currentCatalog.options || []).filter((option) => String(option.catalog_item_id) === String(item.id));
      const kind = String(item.item_type || "").toUpperCase() === "SERVICE" ? "خدمة" : "منتج";
      return '<article class="catalog-item-card"><div class="catalog-item-accent"></div><div class="catalog-item-body">' +
        '<span class="catalog-item-type">' + kind + '</span>' +
        '<h3>' + escapeHtml(item.name_ar || item.name_en || "عنصر في الكتالوج") + '</h3>' +
        '<p>' + escapeHtml(item.description || "لا يوجد وصف إضافي.") + '</p>' +
        '<div class="catalog-item-price">' + (price ? money(price.unit_price, price.currency) : "السعر عند الاستفسار") + '</div>' +
        (options.length ? '<div class="catalog-item-options">اختيارات إضافية: ' + options.map((o) => escapeHtml(o.name_ar || o.name_en || "") + (Number(o.price_delta) ? " (" + money(o.price_delta, price?.currency || "EGP") + ")" : "")).join(" · ") + '</div>' : '') +
        '</div></article>';
    }).join("");

    state.hidden = true;
    emptyState.hidden = items.length !== 0;
    itemsRoot.hidden = items.length === 0;
    itemsRoot.innerHTML = cards;
  }

  async function loadCatalog(branchId = "") {
    if (!cfg?.supabaseUrl || !cfg?.supabaseKey) {
      setState("إعدادات الاتصال بالكتالوج غير متاحة. أعد تحميل الصفحة لاحقًا.", true);
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
    } catch (error) {
      const messages = {
        INVALID_BUSINESS_ID: "رابط النشاط غير صحيح.",
        BUSINESS_NOT_PUBLIC: "هذا النشاط غير متاح للعرض العام حاليًا.",
        CATALOG_NOT_PUBLIC: "لم يتم تفعيل كتالوج عام لهذا النشاط بعد.",
        NO_ACTIVE_BRANCH: "لا يوجد فرع نشط متاح لهذا النشاط حاليًا.",
        BRANCH_NOT_PUBLIC: "الفرع المطلوب غير متاح للعرض العام."
      };
      setState(messages[error?.message] || "تعذر تحميل الكتالوج الآن. حاول تحديث الصفحة.", true);
    }
  }

  branchSelect.addEventListener("change", () => loadCatalog(branchSelect.value));
  searchInput.addEventListener("input", renderItems);
  $("share-catalog").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      $("share-catalog").textContent = "تم نسخ الرابط";
      setTimeout(() => { $("share-catalog").textContent = "مشاركة رابط الكتالوج"; }, 1800);
    } catch (_) {
      window.prompt("انسخ رابط الكتالوج:", window.location.href);
    }
  });

  loadCatalog(params.get("branchId") || "");
})();