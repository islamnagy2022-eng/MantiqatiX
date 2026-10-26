(() => {
  "use strict";

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const roleName = (role) => ({
    OWNER: "مالك النشاط", BUSINESS_OWNER: "مالك النشاط", ADMIN: "مدير نشاط",
    MANAGER: "مدير فرع", SUPER_ADMIN: "مالك المنصة"
  }[String(role || "").toUpperCase()] || String(role || ""));
  const currency = (value) => new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(Number(value || 0)) + " ج.م";
  const currentRoleCanEditProfile = (role) =>
    ["OWNER", "BUSINESS_OWNER", "ADMIN", "SUPER_ADMIN"].includes(String(role || "").toUpperCase());

  const css = `
  .mx-catalog-module{display:grid;gap:16px;direction:rtl}
  .mx-catalog-module *{box-sizing:border-box}
  .mx-catalog-module .mx-cat-header-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .mx-catalog-module .mx-cat-public-link{color:#0750c9;text-decoration:none;font-weight:800;font-size:12px;display:inline-flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid #d5e4f9;background:#f5f9ff;border-radius:10px}
  .mx-catalog-module .mx-cat-intro-note{font-size:12px;color:#60738a;line-height:1.9;margin:8px 0 0}
  .mx-catalog-module .mx-cat-status{border:1px solid #dfe8f2;background:#f8fbff;border-radius:10px;padding:11px 13px;font-size:12px;line-height:1.8;color:#536981}
  .mx-catalog-module .mx-cat-status.error{border-color:#f0d2d2;background:#fff6f6;color:#942e2e}
  .mx-catalog-module .mx-cat-status.success{border-color:#ccebd8;background:#effaf3;color:#176343}
  .mx-catalog-module .mx-cat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
  .mx-catalog-module .mx-cat-card{background:#fff;border:1px solid #e1e8f0;border-radius:15px;padding:17px;min-width:0}
  .mx-catalog-module .mx-cat-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
  .mx-catalog-module .mx-cat-card-head h3{font-size:17px;margin:0 0 5px;color:#172c49}
  .mx-catalog-module .mx-cat-card-head p{font-size:11px;line-height:1.8;color:#687b91;margin:0}
  .mx-catalog-module .mx-cat-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
  .mx-catalog-module .mx-cat-field{display:grid;gap:6px;min-width:0}
  .mx-catalog-module .mx-cat-field>span{font-size:11px;font-weight:800;color:#536780}
  .mx-catalog-module .mx-cat-field input,.mx-catalog-module .mx-cat-field select,.mx-catalog-module .mx-cat-field textarea{width:100%;min-width:0;max-width:100%;min-height:40px;padding:9px 10px;border:1px solid #d8e2ee;border-radius:9px;background:#fff;color:#17253a;font:inherit;font-size:12px;outline:none}
  .mx-catalog-module .mx-cat-field textarea{resize:vertical;min-height:74px}
  .mx-catalog-module .mx-cat-field input:focus,.mx-catalog-module .mx-cat-field select:focus,.mx-catalog-module .mx-cat-field textarea:focus{border-color:#7fa4df;box-shadow:0 0 0 3px #e7f0ff}
  .mx-catalog-module .mx-cat-span-2{grid-column:1/-1}
  .mx-catalog-module .mx-cat-check{display:flex;align-items:flex-start;gap:8px;padding:10px;border:1px solid #dfe8f1;background:#f8fbff;border-radius:10px}
  .mx-catalog-module .mx-cat-check input{margin-top:3px;accent-color:#0750c9}
  .mx-catalog-module .mx-cat-check strong,.mx-catalog-module .mx-cat-check small{display:block}
  .mx-catalog-module .mx-cat-check strong{font-size:12px}
  .mx-catalog-module .mx-cat-check small{font-size:10px;line-height:1.8;color:#6d7d91;margin-top:3px}
  .mx-catalog-module .mx-cat-form-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}
  .mx-catalog-module .mx-cat-branch-row{display:grid;grid-template-columns:minmax(190px,260px) minmax(0,1fr);gap:12px;align-items:end;margin-bottom:14px}
  .mx-catalog-module .mx-cat-summary{display:flex;gap:8px;flex-wrap:wrap}
  .mx-catalog-module .mx-cat-pill{display:inline-flex;align-items:center;gap:5px;border-radius:8px;padding:7px 9px;background:#f3f7fc;color:#4c6580;border:1px solid #e1eaf4;font-size:10px;font-weight:800}
  .mx-catalog-module .mx-cat-pill.good{background:#eaf8f1;border-color:#ccebd9;color:#166746}
  .mx-catalog-module .mx-cat-pill.warn{background:#fff6e5;border-color:#f2dfb5;color:#825914}
  .mx-catalog-module .mx-cat-item-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
  .mx-catalog-module .mx-cat-item{border:1px solid #e0e7f0;background:#fff;border-radius:12px;padding:13px;min-width:0;display:grid;gap:8px}
  .mx-catalog-module .mx-cat-item-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
  .mx-catalog-module .mx-cat-item-top strong{font-size:13px;line-height:1.6;overflow-wrap:anywhere}
  .mx-catalog-module .mx-cat-item p{font-size:11px;line-height:1.8;color:#6b7c91;margin:0;overflow-wrap:anywhere}
  .mx-catalog-module .mx-cat-item-price{font-size:15px;font-weight:900;color:#104b8a}
  .mx-catalog-module .mx-cat-item-meta{font-size:10px;color:#75859a;line-height:1.8}
  .mx-catalog-module .mx-cat-item-actions{display:flex;gap:7px;flex-wrap:wrap;border-top:1px solid #edf1f6;padding-top:10px}
  .mx-catalog-module .mx-cat-item-actions button{border:1px solid #dce5ef;background:#f8fafc;border-radius:8px;padding:7px 9px;color:#425a75;font-size:10px;font-weight:800}
  .mx-catalog-module .mx-cat-item-actions button[data-catalog-toggle="ACTIVE"]{color:#086b4d;background:#eefaf3;border-color:#c9ebd7}
  .mx-catalog-module .mx-cat-empty{grid-column:1/-1;padding:20px;border:1px dashed #ccd8e5;border-radius:12px;text-align:center;color:#708197;font-size:12px;line-height:1.9;background:#fbfdff}
  .mx-catalog-module .mx-cat-filter-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
  .mx-catalog-module .mx-cat-filter-row input{flex:1;min-width:180px;min-height:38px;border:1px solid #d8e2ee;border-radius:9px;padding:8px 10px;font:inherit;font-size:12px}
  .mx-catalog-module .mx-cat-card .muted{line-height:1.8}
  .mx-catalog-module .mx-cat-platform-picker{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:end}
  .mx-catalog-module .mx-cat-platform-picker select{min-height:42px;border:1px solid #d8e2ee;border-radius:9px;background:#fff;padding:9px 10px;font:inherit;font-size:12px}
  @media(max-width:900px){.mx-catalog-module .mx-cat-grid{grid-template-columns:1fr}.mx-catalog-module .mx-cat-item-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:620px){.mx-catalog-module .mx-cat-form-grid,.mx-catalog-module .mx-cat-item-list{grid-template-columns:1fr}.mx-catalog-module .mx-cat-span-2{grid-column:auto}.mx-catalog-module .mx-cat-branch-row{grid-template-columns:1fr}.mx-catalog-module .mx-cat-platform-picker{grid-template-columns:1fr}.mx-catalog-module .mx-cat-platform-picker button{width:100%}.mx-catalog-module .mx-cat-card{padding:13px}.mx-catalog-module .mx-cat-card-head{flex-direction:column}}
  `;

  if (!document.getElementById("mnty-catalog-module-style")) {
    const style = document.createElement("style");
    style.id = "mnty-catalog-module-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  async function invoke(action) {
    const cfg = window.MANTIQATIX_CONFIG || window.MNTY_CONFIG;
    const sb = window.MNTY_SB;
    if (!cfg?.supabaseUrl || !cfg?.supabaseKey || !sb) throw new Error("CATALOG_RUNTIME_NOT_READY");
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.access_token) throw new Error("AUTH_REQUIRED");
    const response = await fetch(cfg.supabaseUrl + "/functions/v1/catalog-admin", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "apikey": cfg.supabaseKey,
        "Authorization": "Bearer " + session.access_token,
      },
      body: JSON.stringify(action),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "CATALOG_REQUEST_FAILED");
    if (payload?.error) throw new Error(payload.error);
    return payload;
  }

  function toast(message, type = "success") {
    if (typeof window.showToast === "function") {
      window.showToast(message, type === "error" ? "error" : "success");
      return;
    }
    const root = document.querySelector("[data-mx-catalog-status]");
    if (root) {
      root.textContent = message;
      root.className = "mx-cat-status " + (type === "error" ? "error" : "success");
    }
  }

  function publicUrl(businessId) {
    const url = new URL("catalog/", window.location.href);
    url.searchParams.set("businessId", businessId);
    return url.toString();
  }

  function render(context = {}) {
    const role = String(context.role || "").toUpperCase();
    const businessId = context.businessId || "";
    const tenantId = context.tenantId || "";
    const branchId = context.branchId || "";
    return `
      <section class="mnty-product-shell mx-catalog-module" id="mx-catalog-module"
        data-role="${esc(role)}" data-business-id="${esc(businessId)}"
        data-tenant-id="${esc(tenantId)}" data-branch-id="${esc(branchId)}">
        <div class="mnty-product-head">
          <div>
            <span class="eyebrow">MANTIQATIX CATALOG MODULE</span>
            <h2>كتالوج النشاط</h2>
            <p>مديول مستقل لعرض النشاط وإدارة المنتجات والخدمات والأسعار، متصل بقاعدة MantiqatiX الحالية.</p>
          </div>
          <div class="mx-cat-header-actions">
            <a id="mx-cat-public-link" class="mx-cat-public-link" href="#" target="_blank" rel="noopener noreferrer" hidden>↗ معاينة صفحة النشاط</a>
            <button class="btn btn-outline" id="mx-cat-refresh" type="button">تحديث البيانات</button>
          </div>
        </div>
        <p class="mx-cat-intro-note">الدخول يتم بجلسة Google الحالية. لا توجد كلمات مرور داخل المديول، والحفظ يتم من خلال واجهة خادمية تتحقق من صلاحية النشاط والفرع. الطلبات من الصفحة العامة تتواصل عبر واتساب فقط ولا يوجد دفع إلكتروني هنا.</p>
        <div id="mx-cat-manager-content" style="margin-top:15px"><div class="empty-state">جاري تحميل الكتالوج...</div></div>
      </section>`;
  }

  function messageFor(error) {
    const e = String(error?.message || error || "");
    return ({
      AUTH_REQUIRED: "انتهت جلسة الدخول. سجّل الدخول بحساب Google ثم أعد المحاولة.",
      BUSINESS_MANAGEMENT_REQUIRED: "حسابك لا يملك صلاحية إدارة هذا النشاط.",
      BRANCH_SCOPE_FORBIDDEN: "الفرع المطلوب خارج نطاق صلاحيات حسابك.",
      ACTIVE_BRANCH_REQUIRED: "لا يوجد فرع نشط متاح لهذا النشاط.",
      CATALOG_PROFILE_WRITE_FORBIDDEN: "تعديل بيانات النشاط متاح للمالك أو المدير المخول فقط.",
      ACTIVE_PROVIDER_PROFILE_REQUIRED: "يجب أن يكون للنشاط ملف مقدم خدمة نشط حتى يتم نشر الكتالوج.",
      CATALOG_ITEM_LIMIT_REACHED: "وصل النشاط إلى الحد الأقصى وهو 150 منتجًا أو خدمة نشطة.",
      INVALID_CATALOG_IMAGE_URL: "رابط صورة المنتج يجب أن يبدأ بـ HTTPS.",
      INVALID_LOGO_URL: "رابط الشعار يجب أن يبدأ بـ HTTPS.",
      INVALID_COVER_URL: "رابط الغلاف يجب أن يبدأ بـ HTTPS.",
      CATALOG_WRITE_FORBIDDEN: "ليس لديك صلاحية تعديل هذا المنتج أو السعر.",
      BUSINESS_NOT_ACTIVE: "لا يمكن نشر كتالوج نشاط غير نشط.",
      CATALOG_NOT_PUBLISHED: "لم يتم نشر الكتالوج العام بعد.",
    }[e] || "تعذر تنفيذ العملية (" + (e || "UNKNOWN") + "). راجع الصلاحيات والبيانات ثم حاول مجددًا.");
  }

  const activePriceFor = (data, itemId, branchId) => {
    const rows = (data?.prices || []).filter((price) =>
      String(price.catalog_item_id) === String(itemId) &&
      (!price.branch_id || String(price.branch_id) === String(branchId))
    );
    rows.sort((a, b) => {
      const aExact = String(a.branch_id || "") === String(branchId || "") ? 1 : 0;
      const bExact = String(b.branch_id || "") === String(branchId || "") ? 1 : 0;
      return bExact - aExact || Number(b.version || 0) - Number(a.version || 0);
    });
    return rows[0] || null;
  };

  const selectedItemMeta = (item) => item?.metadata?.catalog_public || {};

  function businessOptionLabel(business) {
    const status = String(business.status || "").toUpperCase();
    return (business.name || "نشاط بلا اسم") + " — " + (business.sector || "قطاع غير محدد") +
      (status !== "ACTIVE" ? " (" + status + ")" : "");
  }

  function showPicker(root, businesses, error = "") {
    const content = root.querySelector("#mx-cat-manager-content");
    const selectOptions = (businesses || []).map((business) =>
      '<option value="' + esc(business.id) + '" data-tenant-id="' + esc(business.tenantId) + '" data-status="' + esc(business.status) + '">' +
      esc(businessOptionLabel(business)) + "</option>"
    ).join("");
    content.innerHTML = `
      <section class="mx-cat-card">
        <div class="mx-cat-card-head"><div><h3>اختر النشاط المطلوب إدارته</h3><p>هذا الخيار متاح لمالك المنصة ذي الصلاحية الكاملة فقط. بقية الأدوار تعمل داخل النشاط المرتبط بعضويتها.</p></div></div>
        ${error ? '<div class="mx-cat-status error" data-mx-catalog-status>' + esc(error) + '</div>' : ""}
        <form id="mx-cat-business-picker" class="mx-cat-platform-picker">
          <label class="mx-cat-field"><span>الأنشطة المسجلة</span><select id="mx-cat-business-select" required>
            <option value="">اختر النشاط</option>${selectOptions}
          </select></label>
          <button type="submit" class="btn btn-primary" ${businesses?.length ? "" : "disabled"}>فتح الكتالوج</button>
        </form>
        ${businesses?.length ? "" : '<div class="mx-cat-empty">لا توجد أنشطة متاحة ضمن نطاق المنصة الحالي.</div>'}
      </section>`;
    const form = content.querySelector("#mx-cat-business-picker");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const select = content.querySelector("#mx-cat-business-select");
      const option = select?.selectedOptions?.[0];
      if (!select?.value || !option?.dataset?.tenantId) return;
      root.dataset.businessId = select.value;
      root.dataset.tenantId = option.dataset.tenantId;
      root.dataset.branchId = "";
      await loadAndRender(root);
    });
  }

  function renderFormFields(data, canEditProfile, role) {
    const business = data.business || {};
    const profile = business.profile || {};
    const branch = (data.branches || []).find((b) => String(b.id) === String(data.selectedBranchId)) || {};
    return `
      <div class="mx-cat-grid">
        <section class="mx-cat-card">
          <div class="mx-cat-card-head">
            <div><h3>بيانات النشاط والهوية البصرية</h3><p>تظهر البيانات العامة أعلى صفحة الكتالوج. غيّر بياناتك ثم احفظها.</p></div>
            <span class="mx-cat-pill ${profile.publicEnabled ? "good" : "warn"}">${profile.publicEnabled ? "الكتالوج منشور" : "الكتالوج غير منشور"}</span>
          </div>
          <form id="mx-cat-profile-form">
            <div class="mx-cat-form-grid">
              <label class="mx-cat-field mx-cat-span-2"><span>اسم النشاط *</span><input id="mx-cat-profile-name" maxlength="200" required value="${esc(business.name || "")}" ${canEditProfile ? "" : "readonly"}></label>
              <label class="mx-cat-field mx-cat-span-2"><span>نبذة النشاط</span><textarea id="mx-cat-profile-bio" maxlength="3000" ${canEditProfile ? "" : "readonly"}>${esc(profile.bio || data.provider?.description || "")}</textarea></label>
              <label class="mx-cat-field"><span>واتساب / هاتف الفرع</span><input id="mx-cat-profile-phone" maxlength="40" value="${esc(branch.phone || "")}" ${canEditProfile ? "" : "readonly"}></label>
              <label class="mx-cat-field"><span>عنوان الفرع</span><input id="mx-cat-profile-address" maxlength="500" value="${esc(branch.address || "")}" ${canEditProfile ? "" : "readonly"}></label>
              <label class="mx-cat-field"><span>المحافظة</span><input id="mx-cat-profile-governorate" maxlength="100" value="${esc(profile.governorate || "")}" ${canEditProfile ? "" : "readonly"}></label>
              <label class="mx-cat-field"><span>المركز / القسم</span><input id="mx-cat-profile-markaz" maxlength="100" value="${esc(profile.markaz || "")}" ${canEditProfile ? "" : "readonly"}></label>
              <label class="mx-cat-field"><span>القرية / الحي</span><input id="mx-cat-profile-village" maxlength="100" value="${esc(profile.village || "")}" ${canEditProfile ? "" : "readonly"}></label>
              <label class="mx-cat-field"><span>مواعيد العمل</span><input id="mx-cat-profile-hours" maxlength="300" value="${esc(profile.workingHours || "")}" ${canEditProfile ? "" : "readonly"}></label>
              <label class="mx-cat-field mx-cat-span-2"><span>رابط الشعار (HTTPS)</span><input id="mx-cat-profile-logo" type="url" maxlength="1500" placeholder="https://..." value="${esc(profile.logoUrl || "")}" ${canEditProfile ? "" : "readonly"}></label>
              <label class="mx-cat-field mx-cat-span-2"><span>رابط صورة الغلاف (HTTPS)</span><input id="mx-cat-profile-cover" type="url" maxlength="1500" placeholder="https://..." value="${esc(profile.coverUrl || "")}" ${canEditProfile ? "" : "readonly"}></label>
              <label class="mx-cat-check mx-cat-span-2">
                <input id="mx-cat-profile-public" type="checkbox" ${profile.publicEnabled ? "checked" : ""} ${canEditProfile ? "" : "disabled"}>
                <span><strong>نشر الكتالوج للعامة</strong><small>عند التفعيل يمكن لأي زائر مشاهدة بيانات النشاط والمنتجات النشطة وأسعارها دون تسجيل دخول. لا يتم عرض أي بيانات طلبات أو عضويات.</small></span>
              </label>
            </div>
            ${canEditProfile ? '<div class="mx-cat-form-actions"><button class="btn btn-primary" id="mx-cat-profile-save" type="submit" style="width:auto">حفظ بيانات النشاط</button></div>' : '<p class="mx-cat-intro-note">تعديل بيانات النشاط والنشر متاح للمالك أو المدير المخول. دورك الحالي (' + esc(roleName(role)) + ') يمكنه إدارة عناصر الكتالوج ضمن صلاحياته فقط.</p>'}
          </form>
        </section>

        <section class="mx-cat-card">
          <div class="mx-cat-card-head"><div><h3 id="mx-cat-item-form-title">إضافة منتج أو خدمة</h3><p>الحد الأقصى 150 عنصرًا نشطًا لكل نشاط. يتم حفظ العنصر والسعر في عملية قاعدة بيانات واحدة.</p></div></div>
          <form id="mx-cat-item-form">
            <input id="mx-cat-item-id" type="hidden" value="">
            <div class="mx-cat-form-grid">
              <label class="mx-cat-field mx-cat-span-2"><span>اسم المنتج أو الخدمة *</span><input id="mx-cat-item-name" maxlength="180" required autocomplete="off"></label>
              <label class="mx-cat-field"><span>نوع العنصر</span><select id="mx-cat-item-type"><option value="PRODUCT">منتج</option><option value="SERVICE">خدمة</option></select></label>
              <label class="mx-cat-field"><span>السعر بالجنيه المصري *</span><input id="mx-cat-item-price" type="number" min="0" max="100000000" step="0.01" inputmode="decimal" required></label>
              <label class="mx-cat-field"><span>القسم / التصنيف</span><input id="mx-cat-item-category" maxlength="100" placeholder="مثل: مشروبات، عناية، كشف طبي"></label>
              <label class="mx-cat-field"><span>الوحدة</span><input id="mx-cat-item-unit" maxlength="40" placeholder="قطعة، وجبة، جلسة..."></label>
              <label class="mx-cat-field"><span>السعر قبل الخصم (اختياري)</span><input id="mx-cat-item-compare" type="number" min="0" max="100000000" step="0.01" inputmode="decimal"></label>
              <label class="mx-cat-field"><span>كود الصنف (اختياري)</span><input id="mx-cat-item-sku" maxlength="80" autocomplete="off"></label>
              <label class="mx-cat-field mx-cat-span-2"><span>رابط صورة المنتج (HTTPS)</span><input id="mx-cat-item-image" type="url" maxlength="1500" placeholder="https://..."></label>
              <label class="mx-cat-field mx-cat-span-2"><span>الوصف</span><textarea id="mx-cat-item-description" maxlength="2000"></textarea></label>
              <label class="mx-cat-check mx-cat-span-2"><input id="mx-cat-item-available" type="checkbox" checked><span><strong>متاح للطلب أو الاستفسار</strong><small>إلغاء التحديد يعرض العنصر كغير متاح دون حذفه من السجل.</small></span></label>
            </div>
            <div class="mx-cat-form-actions">
              <button class="btn btn-primary" id="mx-cat-item-save" type="submit" style="width:auto">حفظ العنصر والسعر</button>
              <button class="btn btn-outline" id="mx-cat-item-cancel" type="button" hidden>إلغاء التعديل</button>
            </div>
          </form>
        </section>
      </div>
      <section class="mx-cat-card">
        <div class="mx-cat-card-head">
          <div><h3>كتالوج النشاط</h3><p>إدارة العناصر النشطة والمؤرشفة. الأرشفة لا تحذف السجلات التاريخية.</p></div>
          <div class="mx-cat-summary">
            <span class="mx-cat-pill">الإجمالي: ${(data.items || []).length}</span>
            <span class="mx-cat-pill good">نشط: ${(data.items || []).filter((item) => String(item.status).toUpperCase() === "ACTIVE").length}</span>
            <span class="mx-cat-pill">الحد: 150 عنصرًا نشطًا</span>
          </div>
        </div>
        <div class="mx-cat-branch-row">
          <label class="mx-cat-field"><span>الفرع الذي تديره</span><select id="mx-cat-branch-select">${(data.branches || []).map((branch) => '<option value="' + esc(branch.id) + '" ' + (String(branch.id) === String(data.selectedBranchId) ? "selected" : "") + '>' + esc(branch.name || branch.code || branch.id) + '</option>').join("")}</select></label>
          <label class="mx-cat-field"><span>بحث بالاسم أو الوصف</span><input id="mx-cat-item-search" type="search" placeholder="ابحث في العناصر..." autocomplete="off"></label>
        </div>
        <div id="mx-cat-item-list" class="mx-cat-item-list"></div>
      </section>
      <div id="mx-cat-operation-status" class="mx-cat-status" data-mx-catalog-status role="status" aria-live="polite">تم تحميل بيانات النشاط.</div>`;
  }

  function renderItems(root, data, selectedBranchId, queryText = "", editingRole) {
    const list = root.querySelector("#mx-cat-item-list");
    if (!list) return;
    const query = String(queryText || "").trim().toLocaleLowerCase("ar");
    const rows = (data.items || []).filter((item) => {
      const hasBranch = !item.branch_id || String(item.branch_id) === String(selectedBranchId);
      const text = [item.name_ar, item.name_en, item.description, item.sku, selectedItemMeta(item).category].join(" ").toLocaleLowerCase("ar");
      return hasBranch && (!query || text.includes(query));
    });
    if (!rows.length) {
      list.innerHTML = '<div class="mx-cat-empty">لا توجد عناصر مطابقة في هذا الفرع. أضف أول منتج أو خدمة من النموذج أعلاه.</div>';
      return;
    }
    list.innerHTML = rows.map((item) => {
      const meta = selectedItemMeta(item);
      const price = activePriceFor(data, item.id, selectedBranchId);
      const active = String(item.status || "").toUpperCase() === "ACTIVE";
      const available = meta.is_available !== false;
      const branchLabel = item.branch_id ? "فرع محدد" : "متاح على مستوى النشاط";
      return '<article class="mx-cat-item" data-mx-item-id="' + esc(item.id) + '">' +
        '<div class="mx-cat-item-top"><strong>' + esc(item.name_ar || item.name_en || "عنصر") + '</strong>' +
        '<span class="mx-cat-pill ' + (active ? "good" : "warn") + '">' + (active ? "نشط" : "مؤرشف") + '</span></div>' +
        '<p>' + esc(item.description || "لا يوجد وصف") + '</p>' +
        '<div class="mx-cat-item-price">' + (price ? esc(currency(price.unit_price)) : "السعر غير مسجل") + '</div>' +
        '<div class="mx-cat-item-meta">' + esc(String(item.item_type || "PRODUCT").toUpperCase() === "SERVICE" ? "خدمة" : "منتج") +
        ' · ' + esc(meta.category || "عام") + ' · ' + branchLabel + ' · ' + (available ? "متاح" : "غير متاح") + '</div>' +
        '<div class="mx-cat-item-actions">' +
        '<button type="button" data-mx-item-edit="' + esc(item.id) + '">تعديل البيانات والسعر</button>' +
        '<button type="button" data-catalog-toggle="' + (active ? "INACTIVE" : "ACTIVE") + '" data-catalog-item-id="' + esc(item.id) + '">' +
        (active ? "أرشفة" : "إعادة تفعيل") + '</button></div></article>';
    }).join("");

    list.querySelectorAll("[data-mx-item-edit]").forEach((button) => button.addEventListener("click", () => {
      const item = (data.items || []).find((candidate) => String(candidate.id) === String(button.dataset.mxItemEdit));
      if (!item) return;
      const meta = selectedItemMeta(item);
      const price = activePriceFor(data, item.id, selectedBranchId);
      root.querySelector("#mx-cat-item-id").value = item.id;
      root.querySelector("#mx-cat-item-name").value = item.name_ar || item.name_en || "";
      root.querySelector("#mx-cat-item-type").value = String(item.item_type || "PRODUCT").toUpperCase() === "SERVICE" ? "SERVICE" : "PRODUCT";
      root.querySelector("#mx-cat-item-price").value = price ? String(price.unit_price) : "";
      root.querySelector("#mx-cat-item-category").value = meta.category || "";
      root.querySelector("#mx-cat-item-unit").value = meta.unit || "";
      root.querySelector("#mx-cat-item-compare").value = meta.compare_price == null ? "" : String(meta.compare_price);
      root.querySelector("#mx-cat-item-sku").value = item.sku || "";
      root.querySelector("#mx-cat-item-image").value = meta.image_url || "";
      root.querySelector("#mx-cat-item-description").value = item.description || "";
      root.querySelector("#mx-cat-item-available").checked = meta.is_available !== false;
      root.querySelector("#mx-cat-item-form-title").textContent = "تعديل " + (item.name_ar || item.name_en || "عنصر");
      root.querySelector("#mx-cat-item-save").textContent = "حفظ التعديلات والسعر";
      root.querySelector("#mx-cat-item-cancel").hidden = false;
      root.querySelector("#mx-cat-item-form").scrollIntoView({ behavior: "smooth", block: "start" });
    }));

    list.querySelectorAll("[data-catalog-toggle]").forEach((button) => button.addEventListener("click", async () => {
      const itemId = button.dataset.catalogItemId;
      const targetStatus = button.dataset.catalogToggle;
      if (!itemId || !targetStatus) return;
      const promptText = targetStatus === "INACTIVE" ? "أرشفة هذا العنصر؟ سيختفي من الكتالوج العام." : "إعادة تفعيل هذا العنصر؟";
      if (!window.confirm(promptText)) return;
      button.disabled = true;
      setOperationStatus(root, "جارٍ تحديث حالة العنصر...");
      try {
        await invoke({
          action: "ITEM_STATUS_UPDATE",
          tenantId: root.dataset.tenantId,
          businessId: root.dataset.businessId,
          branchId: selectedBranchId,
          catalogItemId: itemId,
          status: targetStatus,
        });
        toast(targetStatus === "ACTIVE" ? "تمت إعادة تفعيل العنصر." : "تمت أرشفة العنصر.", "success");
        await loadAndRender(root, selectedBranchId, queryText);
      } catch (error) {
        setOperationStatus(root, messageFor(error), true);
        button.disabled = false;
      }
    }));
  }

  function setOperationStatus(root, message, isError = false, isSuccess = false) {
    const node = root.querySelector("#mx-cat-operation-status");
    if (!node) return;
    node.textContent = message;
    node.className = "mx-cat-status" + (isError ? " error" : isSuccess ? " success" : "");
  }

  function setPublicLink(root, businessId) {
    const anchor = root.querySelector("#mx-cat-public-link");
    if (!anchor || !businessId) return;
    anchor.href = publicUrl(businessId);
    anchor.hidden = false;
  }

  async function loadBusinessList(root) {
    const content = root.querySelector("#mx-cat-manager-content");
    const role = String(root.dataset.role || "").toUpperCase();
    content.innerHTML = '<div class="empty-state">جاري تحميل الأنشطة المتاحة ضمن نطاق صلاحياتك...</div>';
    try {
      const request = { action: "BUSINESS_LIST" };
      // Tenant-level OWNER can choose only from their own tenant. Platform
      // SUPER_ADMIN selection is restricted by server-side platform scope.
      if (role !== "SUPER_ADMIN") request.tenantId = root.dataset.tenantId || null;
      const response = await invoke(request);
      showPicker(root, response.businesses || []);
    } catch (error) {
      showPicker(root, [], messageFor(error));
    }
  }

  async function loadAndRender(root, branchId = "", queryText = "") {
    const content = root.querySelector("#mx-cat-manager-content");
    const businessId = root.dataset.businessId || "";
    const tenantId = root.dataset.tenantId || "";
    const role = root.dataset.role || "";
    if (!businessId || !tenantId) {
      if (String(role).toUpperCase() === "SUPER_ADMIN" ||
          (String(role).toUpperCase() === "OWNER" && Boolean(tenantId))) {
        await loadBusinessList(root);
      } else {
        content.innerHTML = '<div class="empty-state">لا توجد عضوية نشاط مرتبطة بحسابك الحالي. اختر النشاط أو الدور الصحيح من حسابي أولًا.</div>';
      }
      return;
    }
    content.innerHTML = '<div class="empty-state">جاري تحميل بيانات النشاط والكتالوج...</div>';
    try {
      const data = await invoke({
        action: "CATALOG_READ",
        tenantId,
        businessId,
        branchId: branchId || root.dataset.branchId || null,
      });
      root.dataset.branchId = data.selectedBranchId || "";
      setPublicLink(root, businessId);
      const canEditProfile = currentRoleCanEditProfile(role);
      content.innerHTML = renderFormFields(data, canEditProfile, role);
      const branchSelect = content.querySelector("#mx-cat-branch-select");
      branchSelect?.addEventListener("change", () => {
        root.dataset.branchId = branchSelect.value;
        loadAndRender(root, branchSelect.value);
      });
      const search = content.querySelector("#mx-cat-item-search");
      search?.addEventListener("input", () => renderItems(root, data, branchSelect?.value || data.selectedBranchId, search.value, role));
      renderItems(root, data, data.selectedBranchId, queryText, role);

      const profileForm = content.querySelector("#mx-cat-profile-form");
      profileForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const save = content.querySelector("#mx-cat-profile-save");
        if (save?.disabled) return;
        if (save) { save.disabled = true; save.textContent = "جارٍ الحفظ..."; }
        setOperationStatus(root, "جارٍ حفظ بيانات النشاط...");
        try {
          await invoke({
            action: "BUSINESS_PROFILE_UPSERT",
            tenantId,
            businessId,
            branchId: branchSelect?.value || data.selectedBranchId,
            name: content.querySelector("#mx-cat-profile-name").value.trim(),
            bio: content.querySelector("#mx-cat-profile-bio").value.trim(),
            phone: content.querySelector("#mx-cat-profile-phone").value.trim(),
            address: content.querySelector("#mx-cat-profile-address").value.trim(),
            governorate: content.querySelector("#mx-cat-profile-governorate").value.trim(),
            markaz: content.querySelector("#mx-cat-profile-markaz").value.trim(),
            village: content.querySelector("#mx-cat-profile-village").value.trim(),
            workingHours: content.querySelector("#mx-cat-profile-hours").value.trim(),
            logoUrl: content.querySelector("#mx-cat-profile-logo").value.trim(),
            coverUrl: content.querySelector("#mx-cat-profile-cover").value.trim(),
            publicEnabled: content.querySelector("#mx-cat-profile-public").checked,
          });
          setOperationStatus(root, "تم حفظ بيانات النشاط. افتح رابط الكتالوج العام لمراجعة الصفحة.", false, true);
          await loadAndRender(root, branchSelect?.value || data.selectedBranchId, search?.value || "");
        } catch (error) {
          setOperationStatus(root, messageFor(error), true);
          if (save) { save.disabled = false; save.textContent = "حفظ بيانات النشاط"; }
        }
      });

      const itemForm = content.querySelector("#mx-cat-item-form");
      const resetItemForm = () => {
        itemForm?.reset();
        content.querySelector("#mx-cat-item-id").value = "";
        content.querySelector("#mx-cat-item-available").checked = true;
        content.querySelector("#mx-cat-item-form-title").textContent = "إضافة منتج أو خدمة";
        content.querySelector("#mx-cat-item-save").textContent = "حفظ العنصر والسعر";
        content.querySelector("#mx-cat-item-cancel").hidden = true;
      };
      content.querySelector("#mx-cat-item-cancel")?.addEventListener("click", resetItemForm);
      itemForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const save = content.querySelector("#mx-cat-item-save");
        if (save?.disabled) return;
        const nameAr = content.querySelector("#mx-cat-item-name").value.trim();
        const itemType = content.querySelector("#mx-cat-item-type").value;
        const unitPrice = Number(content.querySelector("#mx-cat-item-price").value);
        const compareText = content.querySelector("#mx-cat-item-compare").value.trim();
        const comparePrice = compareText === "" ? null : Number(compareText);
        const category = content.querySelector("#mx-cat-item-category").value.trim();
        const unit = content.querySelector("#mx-cat-item-unit").value.trim();
        const sku = content.querySelector("#mx-cat-item-sku").value.trim();
        const imageUrl = content.querySelector("#mx-cat-item-image").value.trim();
        const description = content.querySelector("#mx-cat-item-description").value.trim();
        const available = content.querySelector("#mx-cat-item-available").checked;
        const itemId = content.querySelector("#mx-cat-item-id").value.trim() || null;
        const currentItem = itemId ? (data.items || []).find((item) => String(item.id) === itemId) : null;
        const branch = branchSelect?.value || data.selectedBranchId;
        const oldPrice = currentItem ? activePriceFor(data, currentItem.id, branch) : null;
        if (!nameAr || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000000 ||
            (compareText !== "" && (!Number.isFinite(comparePrice) || comparePrice < 0 || comparePrice > 100000000))) {
          setOperationStatus(root, "أدخل اسمًا صحيحًا وسعرًا صالحًا. السعر قبل الخصم يجب أن يكون رقمًا غير سالب.", true);
          return;
        }
        if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
          setOperationStatus(root, "رابط صورة المنتج يجب أن يبدأ بـ HTTPS.", true);
          return;
        }
        if (save) { save.disabled = true; save.textContent = "جارٍ الحفظ..."; }
        setOperationStatus(root, "جارٍ حفظ بيانات العنصر والسعر...");
        try {
          const itemBranchId = currentItem ? (currentItem.branch_id || null) : branch;
          const priceBranchId = currentItem
            ? (oldPrice?.branch_id || (currentItem.branch_id ? currentItem.branch_id : null))
            : branch;
          await invoke({
            action: "ITEM_PRICE_UPSERT",
            tenantId,
            businessId,
            branchId: branch,
            itemBranchId,
            priceBranchId,
            id: itemId,
            itemType,
            nameAr,
            nameEn: null,
            description,
            sku: sku || null,
            taxRate: 0,
            metadata: {
              source: "MNTY_CATALOG_MANAGER",
              catalog_public: {
                category: category || "عام",
                unit: unit || null,
                image_url: imageUrl || null,
                compare_price: comparePrice,
                is_available: available,
              },
            },
            currency: "EGP",
            unitPrice,
          });
          toast(itemId ? "تم تحديث المنتج/الخدمة والسعر." : "تمت إضافة المنتج/الخدمة والسعر.", "success");
          await loadAndRender(root, branch, "");
        } catch (error) {
          setOperationStatus(root, messageFor(error), true);
          if (save) { save.disabled = false; save.textContent = itemId ? "حفظ التعديلات والسعر" : "حفظ العنصر والسعر"; }
        }
      });

      root.querySelector("#mx-cat-refresh")?.addEventListener("click", () => loadAndRender(root, branchSelect?.value || data.selectedBranchId));
      const status = content.querySelector("#mx-cat-operation-status");
      if (status) status.textContent = "تم تحميل " + (data.items || []).length + " عنصرًا ضمن نطاق النشاط والفرع المحددين.";
    } catch (error) {
      const message = messageFor(error);
      content.innerHTML = '<div class="mx-cat-status error">' + esc(message) +
        '</div><div class="mx-cat-form-actions"><button type="button" class="btn btn-outline" id="mx-cat-retry">إعادة المحاولة</button></div>';
      content.querySelector("#mx-cat-retry")?.addEventListener("click", () => loadAndRender(root, branchId, queryText));
    }
  }

  function bind() {
    const root = document.getElementById("mx-catalog-module");
    if (!root || root.dataset.bound === "true") return;
    root.dataset.bound = "true";
    root.querySelector("#mx-cat-refresh")?.addEventListener("click", () =>
      loadAndRender(root, root.dataset.branchId || "")
    );
    loadAndRender(root, root.dataset.branchId || "");
  }

  window.MNTYCatalogModule = Object.freeze({ render, bind });
})();