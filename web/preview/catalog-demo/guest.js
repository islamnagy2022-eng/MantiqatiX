(() => {
  "use strict";

  const samples = [
    {
      id: "food-cafe", sector: "FOOD", sectorLabel: "مطاعم وكافيهات",
      name: "مقهى المثال", initial: "م", city: "طنطا",
      description: "مثال توضيحي لصفحة كافيه تعرض نبذة النشاط والمشروبات والأسعار في مكان واحد.",
      accent: "#9a6b38", soft: "#f8efe4",
      items: [
        { name: "إسبريسو", description: "قهوة إسبريسو — مثال للسعر", price: 55 },
        { name: "كابتشينو", description: "كابتشينو — مثال للسعر", price: 75 },
        { name: "آيس لاتيه", description: "مشروب بارد — مثال للسعر", price: 85 }
      ]
    },
    {
      id: "pharmacy-demo", sector: "PHARMACY", sectorLabel: "صيدليات",
      name: "الصيدلية التجريبية", initial: "ص", city: "بركة السبع",
      description: "عرض توضيحي لمستلزمات عامة وأسعار افتراضية. لا يحتوي على ملفات مرضى أو بيانات طبية حقيقية.",
      accent: "#287a69", soft: "#eaf6f1",
      items: [
        { name: "ميزان حرارة رقمي", description: "مستلزم عام — مثال للسعر", price: 220 },
        { name: "شاش طبي معقم", description: "مستلزم إسعافات أولية — مثال للسعر", price: 35 },
        { name: "مطهر يدين", description: "منتج عناية عامة — مثال للسعر", price: 65 }
      ]
    },
    {
      id: "doctor-demo", sector: "DOCTOR", sectorLabel: "أطباء وعيادات",
      name: "عيادة الباطنة التجريبية", initial: "ع", city: "شبين الكوم",
      description: "مثال توضيحي لصفحة عيادة تعرض الخدمات وأسعارها. كل البيانات والأسعار افتراضية وليست حجزًا فعليًا.",
      accent: "#47719d", soft: "#edf4fb",
      items: [
        { name: "كشف عيادة", description: "خدمة توضيحية — مثال للسعر", price: 250 },
        { name: "استشارة متابعة", description: "خدمة توضيحية — مثال للسعر", price: 120 },
        { name: "قياس ضغط الدم", description: "خدمة توضيحية — مثال للسعر", price: 50 }
      ]
    },
    {
      id: "store-demo", sector: "STORE", sectorLabel: "متاجر",
      name: "متجر البيت العصري", initial: "ب", city: "طنطا",
      description: "مثال توضيحي لمتجر يعرض منتجاته وأسعارها دون دفع إلكتروني أو طلبات حقيقية.",
      accent: "#6d5a9d", soft: "#f1eef9",
      items: [
        { name: "مصباح مكتبي", description: "إضاءة منزلية — مثال للسعر", price: 350 },
        { name: "منظم أدراج", description: "تنظيم المنزل — مثال للسعر", price: 140 },
        { name: "كوب حراري", description: "أدوات منزلية — مثال للسعر", price: 180 }
      ]
    }
  ];

  const currency = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 });
  const grid = document.getElementById("catalog-grid");
  const search = document.getElementById("catalog-search");
  const noResults = document.getElementById("no-results");
  let activeSector = "ALL";

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function matches(item, query) {
    const haystack = [
      item.name, item.sectorLabel, item.city, item.description,
      ...item.items.flatMap((product) => [product.name, product.description])
    ].join(" ").toLocaleLowerCase("ar");
    return (!query || haystack.includes(query)) &&
      (activeSector === "ALL" || item.sector === activeSector);
  }

  function renderCard(item) {
    const products = item.items.map((product) => `
      <div class="guest-product-row">
        <div>
          <div class="guest-product-name">${escapeHtml(product.name)}</div>
          <div class="guest-product-description">${escapeHtml(product.description)}</div>
        </div>
        <div class="guest-product-price">${currency.format(product.price)} ج.م</div>
      </div>
    `).join("");

    return `
      <article class="guest-business-card" data-card-id="${escapeHtml(item.id)}" style="--card-accent:${escapeHtml(item.accent)};--card-soft:${escapeHtml(item.soft)}">
        <div class="guest-card-accent"></div>
        <div class="guest-card-main">
          <div class="guest-card-top">
            <div class="guest-business-mark" aria-hidden="true">${escapeHtml(item.initial)}</div>
            <div class="guest-business-heading">
              <h3>${escapeHtml(item.name)}</h3>
              <p>نشاط تجريبي · ${escapeHtml(item.city)}</p>
            </div>
            <span class="guest-sector-badge">${escapeHtml(item.sectorLabel)}</span>
          </div>
          <p class="guest-business-description">${escapeHtml(item.description)}</p>
          <div class="guest-card-meta">
            <span>⌖ ${escapeHtml(item.city)}</span>
            <span>• أمثلة للعرض فقط</span>
          </div>
        </div>
        <div class="guest-card-footer">
          <span class="guest-item-count">${item.items.length} عناصر في الكتالوج</span>
          <button class="btn btn-secondary guest-card-toggle" type="button" data-action="toggle-catalog" aria-expanded="false" aria-controls="products-${escapeHtml(item.id)}">عرض الكتالوج</button>
        </div>
        <div class="guest-products" id="products-${escapeHtml(item.id)}">${products}</div>
      </article>
    `;
  }

  function render() {
    const query = (search.value || "").trim().toLocaleLowerCase("ar");
    const filtered = samples.filter((item) => matches(item, query));
    grid.innerHTML = filtered.map(renderCard).join("");
    noResults.hidden = filtered.length !== 0;
  }

  document.querySelectorAll("[data-sector]").forEach((button) => {
    button.addEventListener("click", () => {
      activeSector = button.dataset.sector || "ALL";
      document.querySelectorAll("[data-sector]").forEach((candidate) => {
        const selected = candidate === button;
        candidate.classList.toggle("active", selected);
        candidate.setAttribute("aria-pressed", String(selected));
      });
      render();
    });
  });

  search.addEventListener("input", render);

  grid.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="toggle-catalog"]');
    if (!button) return;
    const card = button.closest("[data-card-id]");
    if (!card) return;
    const expanded = card.classList.toggle("expanded");
    button.setAttribute("aria-expanded", String(expanded));
    button.textContent = expanded ? "إخفاء الكتالوج" : "عرض الكتالوج";
  });

  render();
})();