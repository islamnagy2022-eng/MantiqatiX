(function () {
  "use strict";
  const STORAGE_KEY = "MNTYPendingReferralCode";
  const CODE_PATTERN = /^[A-Z0-9]{6,32}$/;
  function normalizeCode(value) {
    const code = String(value || "").trim().toUpperCase();
    return CODE_PATTERN.test(code) ? code : "";
  }
  function captureReferralCode() {
    try {
      const url = new URL(window.location.href);
      const queryCode = normalizeCode(url.searchParams.get("ref"));
      const pathMatch = url.pathname.match(/\/join\/([A-Za-z0-9]{6,32})\/?$/i);
      const code = queryCode || normalizeCode(pathMatch?.[1]);
      if (code) localStorage.setItem(STORAGE_KEY, code);
    } catch (_) {}
  }
  function pendingCode() {
    try {
      const stored = normalizeCode(localStorage.getItem(STORAGE_KEY));
      if (stored) return stored;
      const url = new URL(window.location.href);
      const code = normalizeCode(url.searchParams.get("ref"));
      if (code) localStorage.setItem(STORAGE_KEY, code);
      return code;
    } catch (_) { return ""; }
  }
  function clearPendingCode() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("ref")) {
        url.searchParams.delete("ref");
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      }
    } catch (_) {}
  }
  async function claimPending(sb) {
    const code = pendingCode();
    if (!code || !sb?.rpc) return { claimed: false, reason: "NO_PENDING_REFERRAL" };
    const { data, error } = await sb.rpc("claim_referral", { p_code: code });
    if (error) {
      const message = String(error.message || error.code || "");
      if (/INVALID_REFERRAL_CODE|SELF_REFERRAL_NOT_ALLOWED|ALREADY_CLAIMED/i.test(message)) {
        clearPendingCode();
        return { claimed: false, reason: message };
      }
      console.warn("[MantiqatiX referral] referral claim remains pending", message);
      return { claimed: false, pending: true, reason: message };
    }
    if (data?.accepted === true || data?.reason === "ALREADY_CLAIMED") {
      clearPendingCode();
      window.dispatchEvent(new CustomEvent("mnty:referral-claimed", { detail: data }));
      return { claimed: data.accepted === true, reason: data.reason || "ACCEPTED" };
    }
    clearPendingCode();
    return { claimed: false, reason: data?.reason || "NOT_ACCEPTED" };
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }
  function buildInviteUrl(code) {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("ref", code);
    return url.toString();
  }
  function shareText() {
    return "صديقك يدعوك لتجربة MantiqatiX — اكتشف الخدمات والأنشطة ومقدمي الخدمة من مكان واحد. سجّل من رابط الدعوة:";
  }
  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
  function ensureStyles() {
    if (document.getElementById("mx-referral-styles")) return;
    const style = document.createElement("style");
    style.id = "mx-referral-styles";
    style.textContent = `
      .mx-referral-card{margin:18px 0;padding:22px;border:1px solid #dbe5f4;border-radius:20px;background:linear-gradient(145deg,#fff 0%,#f5f8ff 100%);box-shadow:0 8px 24px rgba(15,23,42,.06)}
      .mx-referral-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}
      .mx-referral-icon{display:grid;place-items:center;width:44px;height:44px;flex:0 0 44px;border-radius:14px;background:#eaf1ff;color:#0750c9;font-size:25px;font-weight:900}
      .mx-referral-heading h3{margin:2px 0 5px;font-size:19px;color:#14213d}
      .mx-referral-heading p,.mx-referral-note{margin:0;color:#64748b;font-size:12px;line-height:1.8}
      .mx-referral-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}
      .mx-referral-stats>div{padding:12px;border:1px solid #e2e8f0;border-radius:14px;background:#fff}
      .mx-referral-stats strong,.mx-referral-stats span{display:block}
      .mx-referral-stats strong{font-size:23px;color:#0750c9}
      .mx-referral-stats span,.mx-referral-code-row span,.mx-referral-link-label{font-size:11px;color:#64748b}
      .mx-referral-code-row{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;margin:12px 0;border:1px dashed #93b4ed;border-radius:12px;background:#fff}
      .mx-referral-code-row strong{letter-spacing:2px;color:#0f2f67}
      .mx-referral-link-label{display:block;margin:12px 0 6px;font-weight:800}
      .mx-referral-link-row{display:flex;gap:8px}
      .mx-referral-link-row input{min-width:0;flex:1;padding:11px 12px;border:1px solid #dbe3ef;border-radius:11px;background:#fff;color:#334155;font-size:11px}
      .mx-referral-link-row .btn{width:auto;white-space:nowrap}
      .mx-referral-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
      .mx-referral-actions .btn{width:auto;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
      .mx-referral-note{margin-top:10px}
      .mx-referral-status{min-height:20px;margin-top:8px;color:#087443;font-size:12px;font-weight:700}
      @media(max-width:520px){.mx-referral-card{padding:16px}.mx-referral-link-row{flex-direction:column}.mx-referral-link-row .btn{width:100%}.mx-referral-actions .btn{flex:1 1 42%}}
    `;
    document.head.appendChild(style);
  }

  async function render({ sb, user }) {
    ensureStyles();
    if (!user?.id) return "";
    const { data, error } = await sb.rpc("get_or_create_my_referral_profile");
    if (error) {
      return '<section class="mx-referral-card" id="mx-referral-center" dir="rtl">' +
        '<div class="mx-referral-heading"><span class="mx-referral-icon" aria-hidden="true">↗</span><div><span class="eyebrow">INVITE FRIENDS</span><h3>ادعُ أصدقاءك إلى MantiqatiX</h3></div></div>' +
        '<p class="muted">خدمة الدعوات قيد تفعيل صلاحياتها الآمنة. لم يتم إنشاء رابط غير موثوق أو عرض إحصائيات غير مؤكدة.</p>' +
        '<button class="btn btn-outline" type="button" data-referral-retry>إعادة المحاولة</button></section>';
    }
    const code = normalizeCode(data?.code);
    if (!code) return '<section class="mx-referral-card" id="mx-referral-center" dir="rtl"><h3>تعذر إنشاء رابط الدعوة</h3><p class="muted">لم يُرجع الخادم كود دعوة صالحًا.</p></section>';
    const url = buildInviteUrl(code);
    const count = Number.isFinite(Number(data?.referralsCount)) ? Number(data.referralsCount) : 0;
    const safeUrl = escapeHtml(url);
    const safeCode = escapeHtml(code);
    const message = encodeURIComponent(shareText() + " " + url);
    const encodedUrl = encodeURIComponent(url);
    return '<section class="mx-referral-card" id="mx-referral-center" dir="rtl">' +
      '<div class="mx-referral-heading"><span class="mx-referral-icon" aria-hidden="true">↗</span><div><span class="eyebrow">INVITE FRIENDS</span><h3>ادعُ أصدقاءك إلى MantiqatiX</h3><p>شارك رابطك الشخصي، وسنربط التسجيلات الجديدة بك تلقائيًا بعد تسجيل الدخول.</p></div></div>' +
      '<div class="mx-referral-stats"><div><strong>' + count + '</strong><span>إحالات مسجلة</span></div><div><strong>دائم</strong><span>كود دعوتك</span></div></div>' +
      '<div class="mx-referral-code-row"><span>كود الدعوة</span><strong dir="ltr">' + safeCode + '</strong></div>' +
      '<label class="mx-referral-link-label" for="mx-referral-link">رابط الدعوة الشخصي</label>' +
      '<div class="mx-referral-link-row"><input id="mx-referral-link" type="text" readonly dir="ltr" value="' + safeUrl + '"><button type="button" class="btn btn-primary" data-referral-copy>نسخ الرابط</button></div>' +
      '<div class="mx-referral-actions">' +
      '<button type="button" class="btn btn-primary" data-referral-share>مشاركة من الهاتف</button>' +
      '<a class="btn btn-outline" href="https://wa.me/?text=' + message + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>' +
      '<a class="btn btn-outline" href="https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl + '" target="_blank" rel="noopener noreferrer">Facebook</a>' +
      '<a class="btn btn-outline" href="https://t.me/share/url?url=' + encodedUrl + '&text=' + encodeURIComponent("انضم إلى MantiqatiX") + '" target="_blank" rel="noopener noreferrer">Telegram</a>' +
      '<a class="btn btn-outline" href="sms:?body=' + message + '">رسالة SMS</a>' +
      '</div><p class="mx-referral-note">للمشاركة على Instagram: انسخ الرابط ثم أضفه إلى الرسائل أو القصة. لا نطلب الوصول إلى جهات اتصالك أو كلمات مرور حسابات التواصل.</p>' +
      '<div class="mx-referral-status" aria-live="polite" data-referral-status></div></section>';
  }
  function bind(root) {
    if (!root || root.dataset.referralBound === "true") return;
    root.dataset.referralBound = "true";
    root.querySelector("[data-referral-retry]")?.addEventListener("click", () => window.accountView?.());
    const status = root.querySelector("[data-referral-status]");
    const link = root.querySelector("#mx-referral-link");
    root.querySelector("[data-referral-copy]")?.addEventListener("click", async () => {
      if (!link?.value) return;
      try {
        const ok = await copyText(link.value);
        if (status) status.textContent = ok ? "تم نسخ رابط الدعوة." : "تعذر النسخ تلقائيًا؛ حدد الرابط وانسخه.";
      } catch (_) {
        if (status) status.textContent = "تعذر النسخ تلقائيًا؛ حدد الرابط وانسخه.";
      }
    });
    root.querySelector("[data-referral-share]")?.addEventListener("click", async () => {
      if (!link?.value) return;
      const payload = { title: "دعوة إلى MantiqatiX", text: shareText(), url: link.value };
      if (navigator.share) {
        try {
          await navigator.share(payload);
          if (status) status.textContent = "تم فتح قائمة المشاركة.";
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      window.open("https://wa.me/?text=" + encodeURIComponent(payload.text + " " + payload.url), "_blank", "noopener,noreferrer");
    });
  }
  captureReferralCode();
  window.MNTYReferral = Object.freeze({ render, bind, claimPending, pendingCode });

  // Handle the case where app.js restored an existing session before this module loaded.
  // New sign-ins are also handled by enterAuthenticatedApp in app.js.
  try {
    const client = window.MNTY_SB;
    if (client?.auth?.getSession) {
      client.auth.getSession().then(({ data, error }) => {
        if (!error && data?.session?.user && pendingCode()) {
          return claimPending(client);
        }
        return null;
      }).catch((error) => console.warn("[MantiqatiX referral] session claim deferred", error));
    }
  } catch (_) {}
})();