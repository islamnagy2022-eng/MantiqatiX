import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH_VERSION = "v26.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const ALLOWED_ORIGINS = new Set([
  "https://islamnagy2022-eng.github.io",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8080",
]);
const corsHeaders = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Vary": "Origin",
});
const reply = (origin: string | null, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });

type FacebookPage = {
  id: string;
  name: string;
  link?: string;
  category?: string;
  access_token?: string;
  tasks?: string[];
};

function safePageList(page: FacebookPage) {
  // Never return Page/User access tokens to the browser.
  return {
    id: String(page.id || ""),
    name: String(page.name || ""),
    link: String(page.link || ""),
    category: String(page.category || ""),
  };
}

async function graphJson(url: URL): Promise<any> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const code = Number(payload?.error?.code || 0);
    if (code === 190) throw new Error("FACEBOOK_SESSION_EXPIRED");
    if (code === 10 || code === 200 || code === 100) throw new Error("FACEBOOK_PERMISSION_REQUIRED");
    if (response.status === 429) throw new Error("FACEBOOK_RATE_LIMITED");
    throw new Error("FACEBOOK_GRAPH_UNAVAILABLE");
  }
  return payload;
}

async function verifyUserToken(token: string, appId: string, appSecret: string): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/debug_token`);
  url.searchParams.set("input_token", token);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);
  const result = await graphJson(url);
  const data = result?.data;
  if (!data?.is_valid || String(data.app_id || "") !== appId) {
    throw new Error("FACEBOOK_SESSION_EXPIRED");
  }
  const scopes = new Set<string>(Array.isArray(data.scopes) ? data.scopes : []);
  if (!scopes.has("pages_show_list") || !scopes.has("pages_read_engagement")) {
    throw new Error("FACEBOOK_PERMISSION_REQUIRED");
  }
}

async function getManagedPages(userToken: string): Promise<FacebookPage[]> {
  const pages: FacebookPage[] = [];
  let after = "";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const url = new URL(`${GRAPH_BASE}/me/accounts`);
    url.searchParams.set("fields", "id,name,link,category,tasks,access_token");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    url.searchParams.set("access_token", userToken);
    const result = await graphJson(url);
    const rows = Array.isArray(result?.data) ? result.data as FacebookPage[] : [];
    pages.push(...rows.filter((row) => row && /^\d+$/.test(String(row.id || "")) && row.access_token));
    const nextAfter = String(result?.paging?.cursors?.after || "");
    if (!result?.paging?.next || !nextAfter || nextAfter === after || rows.length === 0) break;
    after = nextAfter;
  }
  return pages;
}

function formatHours(page: any): string {
  const hours = page?.hours;
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) {
    return page?.is_always_open === true ? "مفتوح 24 ساعة" : "";
  }
  if (page?.is_always_open === true) return "مفتوح 24 ساعة";
  const days: Array<[string, string]> = [
    ["mon", "الإثنين"], ["tue", "الثلاثاء"], ["wed", "الأربعاء"],
    ["thu", "الخميس"], ["fri", "الجمعة"], ["sat", "السبت"], ["sun", "الأحد"],
  ];
  const output: string[] = [];
  for (const [key, label] of days) {
    const opens = Object.keys(hours)
      .filter((field) => field.startsWith(`${key}_`) && field.endsWith("_open"))
      .sort();
    const ranges = opens.flatMap((openField) => {
      const closeField = openField.replace(/_open$/, "_close");
      const open = hours[openField];
      const close = hours[closeField];
      return typeof open === "string" && typeof close === "string" && open && close
        ? [`${open} - ${close}`]
        : [];
    });
    if (ranges.length) output.push(`${label}: ${ranges.join(" / ")}`);
  }
  return output.join("؛ ");
}

function formatAddress(page: any): string {
  const singleLine = String(page?.single_line_address || "").trim();
  if (singleLine) return singleLine;
  const location = page?.location;
  if (!location || typeof location !== "object") return "";
  return [
    location.street, location.city, location.state, location.zip, location.country,
  ].map((part) => String(part || "").trim()).filter(Boolean).join("، ");
}

function publicPageDetails(page: any) {
  const pictureUrl = String(page?.picture?.data?.url || "").trim();
  const coverUrl = String(page?.cover?.source || "").trim();
  return {
    pageId: String(page?.id || ""),
    pageUrl: String(page?.link || ""),
    name: String(page?.name || ""),
    category: String(page?.category || ""),
    logoUrl: pictureUrl,
    coverUrl,
    bio: String(page?.bio || page?.about || page?.description || "").trim(),
    address: formatAddress(page),
    workingHours: formatHours(page),
  };
}

function publicError(error: unknown): { status: number; code: string; message: string } {
  const code = error instanceof Error ? error.message : "";
  const known: Record<string, { status: number; message: string }> = {
    AUTH_REQUIRED: { status: 401, message: "سجّل الدخول إلى حساب النشاط أولاً." },
    BUSINESS_SCOPE_FORBIDDEN: { status: 403, message: "لا تملك صلاحية تعديل بيانات هذا النشاط." },
    FACEBOOK_APP_NOT_CONFIGURED: { status: 503, message: "تكامل فيسبوك غير مهيأ بعد على المنصة. يلزم إعداد تطبيق Meta من الإدارة التقنية." },
    FACEBOOK_SESSION_EXPIRED: { status: 401, message: "انتهت جلسة فيسبوك أو لم تُصدر لتطبيق المنصة. أعد الاتصال بفيسبوك." },
    FACEBOOK_PERMISSION_REQUIRED: { status: 403, message: "وافق على صلاحيات عرض الصفحات التي تديرها وقراءة معلوماتها، ثم حاول مجدداً." },
    FACEBOOK_PAGE_NOT_MANAGED: { status: 403, message: "الصفحة المختارة غير موجودة ضمن الصفحات التي يديرها حساب فيسبوك المتصل." },
    FACEBOOK_PAGE_NOT_FOUND: { status: 404, message: "تعذر العثور على صفحة فيسبوك المختارة." },
    FACEBOOK_RATE_LIMITED: { status: 429, message: "طلبات فيسبوك كثيرة حالياً. انتظر قليلاً ثم أعد المحاولة." },
    FACEBOOK_GRAPH_UNAVAILABLE: { status: 502, message: "تعذر قراءة معلومات الصفحة من Meta. تحقق من الصفحة والصلاحيات ثم أعد المحاولة." },
  };
  const result = known[code] || { status: 500, message: "تعذر استيراد بيانات صفحة فيسبوك." };
  return { status: result.status, code: known[code] ? code : "FACEBOOK_IMPORT_FAILED", message: result.message };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return reply(origin, { error: "METHOD_NOT_ALLOWED" }, 405);

  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    const error = publicError(new Error("AUTH_REQUIRED"));
    return reply(origin, { error: error.code, message: error.message }, error.status);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const metaAppId = Deno.env.get("META_APP_ID") || "";
  const metaAppSecret = Deno.env.get("META_APP_SECRET") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return reply(origin, { error: "SERVER_MISCONFIGURED" }, 500);
  }

  try {
    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const accessToken = authorization.slice(7).trim();
    const { data: { user }, error: userError } = await service.auth.getUser(accessToken);
    if (userError || !user || user.is_anonymous) throw new Error("AUTH_REQUIRED");

    let body: any;
    try { body = await req.json(); } catch { return reply(origin, { error: "INVALID_JSON" }, 400); }
    const action = String(body?.action || "").toUpperCase();
    const businessId = String(body?.businessId || "").trim();
    const facebookUserAccessToken = String(body?.facebookUserAccessToken || "").trim();
    if (!businessId || !/^[0-9a-f-]{36}$/i.test(businessId)) {
      return reply(origin, { error: "INVALID_BUSINESS_ID" }, 400);
    }
    if (!["LIST_PAGES", "IMPORT_PAGE"].includes(action)) {
      return reply(origin, { error: "UNSUPPORTED_ACTION" }, 400);
    }
    if (!facebookUserAccessToken || facebookUserAccessToken.length > 4096) {
      throw new Error("FACEBOOK_SESSION_EXPIRED");
    }

    const { data: business, error: businessError } = await service.from("businesses")
      .select("id,tenant_id,status").eq("id", businessId).maybeSingle();
    if (businessError) throw new Error("BUSINESS_SCOPE_FORBIDDEN");
    if (!business) throw new Error("BUSINESS_SCOPE_FORBIDDEN");
    const { data: memberships, error: membershipError } = await service.from("user_memberships")
      .select("id,tenant_id,business_id,role,status,permissions")
      .eq("user_id", user.id)
      .eq("business_id", businessId)
      .eq("tenant_id", String(business.tenant_id))
      .eq("status", "ACTIVE")
      .in("role", ["OWNER", "BUSINESS_OWNER", "ADMIN", "MANAGER"])
      .limit(10);
    if (membershipError || !memberships?.length) throw new Error("BUSINESS_SCOPE_FORBIDDEN");
    const permitted = memberships.some((membership: any) => {
      const permissions = membership?.permissions && typeof membership.permissions === "object" ? membership.permissions : {};
      const modules = permissions?.modules && typeof permissions.modules === "object" ? permissions.modules : {};
      const catalog = modules?.CATALOG;
      return permissions.account_restricted !== true
        && permissions.catalog !== false
        && permissions.catalog_read_only !== true
        && catalog !== false
        && !(catalog && typeof catalog === "object" && catalog.write === false);
    });
    if (!permitted) throw new Error("BUSINESS_SCOPE_FORBIDDEN");

    if (!metaAppId || !metaAppSecret) throw new Error("FACEBOOK_APP_NOT_CONFIGURED");
    await verifyUserToken(facebookUserAccessToken, metaAppId, metaAppSecret);
    const pages = await getManagedPages(facebookUserAccessToken);

    if (action === "LIST_PAGES") {
      return reply(origin, { success: true, pages: pages.map(safePageList) });
    }

    const pageId = String(body?.pageId || "").trim();
    if (!/^\d+$/.test(pageId)) return reply(origin, { error: "INVALID_FACEBOOK_PAGE_ID" }, 400);
    const page = pages.find((candidate) => candidate.id === pageId && candidate.access_token);
    if (!page?.access_token) throw new Error("FACEBOOK_PAGE_NOT_MANAGED");

    const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(page.id)}`);
    url.searchParams.set("fields", "id,name,link,category,picture.type(large),cover,about,bio,description,single_line_address,location,hours,is_always_open");
    url.searchParams.set("access_token", page.access_token);
    const pageDetails = await graphJson(url);
    const profile = publicPageDetails(pageDetails);
    if (!profile.name) throw new Error("FACEBOOK_PAGE_NOT_FOUND");
    return reply(origin, { success: true, profile });
  } catch (error) {
    const result = publicError(error);
    return reply(origin, { error: result.code, message: result.message }, result.status);
  }
});
