import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://islamnagy2022-eng.github.io", "http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:3000", "http://127.0.0.1:8080"]);
const headersFor = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store",
});
const response = (origin: string | null, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
const safeImage = (value: unknown) => { const s = String(value || "").trim(); return s.length <= 1500 && /^https:\/\//i.test(s) ? s : ""; };

type DefaultImageKind = "activity" | "product" | "service" | "cover";

interface DefaultImageInput {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  kind?: DefaultImageKind;
}

const rules: Array<[RegExp, string]> = [
  [/قهو|بن\b|coffee|espresso|cafe|كافيه|محمص/i, "photo-1501339847302-ac426a4a7cbb"],
  [/مطعم|وجبات|اكل|أكل|طعام|food|restaurant|bakery|مخبز|حلويات/i, "photo-1517248135467-4c7edcad34c4"],
  [/بقال|سوبر.?ماركت|grocery|supermarket|خضار|فاكهه|فاكهة/i, "photo-1542838132-92c53300491e"],
  [/عطر|برفيوم|perfume|fragrance|مكياج|تجميل|cosmetic|makeup|beauty|skincare/i, "photo-1541643600914-78b084683601"],
  [/ملابس|ازياء|أزياء|fashion|clothing|apparel|shoes|احذيه|أحذية/i, "photo-1483985988355-763728e1935b"],
  [/سيار|قطع غيار|auto|car|vehicle|automotive/i, "photo-1492144534655-ae79c964c9d7"],
  [/عقار|عقارات|real.?estate|property|شقق|منازل|سكن/i, "photo-1560518883-ce09059eeffa"],
  [/صيدل|دواء|أدوية|pharmacy|medicine|medical|عياد|طبيب|دكتور|clinic|hospital|صحه|صحة|health|اسنان|أسنان|تحاليل|معمل|اشعه|أشعة/i, "photo-1576091160399-112ba8d25d1d"],
  [/صيان|كهرب|سباك|تكييف|ورشه|ورشة|maintenance|repair|plumb|electric|tools/i, "photo-1621905251189-08b45d6a269e"],
  [/تعليم|مدرس|مدرسه|مدرسة|جامعه|جامعة|education|school|course|training|دروس/i, "photo-1503676260728-1c00da094a0b"],
  [/سفر|سياح|رحلات|طيران|travel|tour|trip|hotel|vacation/i, "photo-1464822759023-fed622ff2c3b"],
  [/وظائف|توظيف|موارد بشرية|jobs|recruit|career|hiring/i, "photo-1521737711867-e3b97375f902"],
  [/زواج|اعراس|أعراس|wedding|bride|matrimony|engagement/i, "photo-1519741497674-611481863552"],
  [/رياض|لياقه|لياقة|sports|fitness|gym|football|كرة/i, "photo-1461896836934-ffe607ba8211"],
  [/تصوير|photography|photograph|camera|تصوير المنتجات/i, "photo-1492691527719-9d1e07e534b4"],
  [/فيديو|ريلز|video|reel|film production|مونتاج/i, "photo-1574717024653-61fd2cf4d44d"],
  [/كتابة|نصوص|copywriting|writing|content writing|كتابة المحتوى/i, "photo-1455390582262-044cdead277a"],
  [/تصميم|هوية بصرية|شعار|graphic design|branding|logo design/i, "photo-1558655146-d09347e92766"],
  [/تحليل|تقارير|analytics|reporting|seo|تحسين محركات|data analysis/i, "photo-1551288049-bebda4e38f71"],
  [/إدارة حملات|إدارة الحملات|حملة إعلانية|اعلانات ممولة|إعلانات ممولة|paid ads|advertising campaign/i, "photo-1460925895917-afdab827c52f"],
  [/صفحات هبوط|landing page|موقع تسويقي|landing pages/i, "photo-1498050108023-c5249f4df085"],
  [/متجر إلكتروني|متاجر إلكترونية|تجارة إلكترونية|ecommerce|e-commerce|تسويق المتاجر/i, "photo-1556742049-0cfed4f6a45d"],
  [/استراتيجية|استشارات|consulting|strategy|growth plan|خطة النمو/i, "photo-1521737711867-e3b97375f902"],
  [/التواصل الاجتماعي|سوشيال|social media|إدارة حسابات/i, "photo-1516321318423-f06f85e504b3"],
  [/تسويق محلي|local marketing|الملفات التجارية|business listing/i, "photo-1497366216548-37526070297c"],
  [/تسويق|اعلان|إعلان|حمله|حملة|محتوى|تصميم|marketing|advert|social media|seo|brand|digital/i, "photo-1460925895917-afdab827c52f"],
  [/برنامج|برمج|سوفت|تقني|software|technology|tech|computer|web|موقع إلكتروني/i, "photo-1498050108023-c5249f4df085"],
  [/اثاث|أثاث|موبيليا|furniture|interior|ديكور|منزل|home|kitchen/i, "photo-1555041469-a586c61ea9bc"],
  [/كتاب|كتب|قرطاسيه|قرطاسية|book|stationery|مكتبه|مكتبة/i, "photo-1507842217343-583bb7270b66"],
  [/حيوان|بيطر|pet|veterinary|vet|dogs|cats/i, "photo-1450778869180-41d0601e046e"],
  [/زهور|ورد|نبات|flowers|flower|plants|florist/i, "photo-1490750967868-88aa4486c946"],
  [/الكترون|إلكترون|موبايل|هاتف|كمبيوتر|electronics|phone|laptop|device/i, "photo-1518770660439-4636190af475"],
];

function resolveDefaultImage(input: DefaultImageInput = {}): string {
  const text = [input.name, input.description, input.category].filter(Boolean).join(" ").toLowerCase();
  const id = rules.find(([pattern]) => pattern.test(text))?.[1] ||
    ({ activity: "photo-1497366216548-37526070297c", cover: "photo-1497366216548-37526070297c", service: "photo-1521737711867-e3b97375f902", product: "photo-1491553895911-0055eca6402d" } as Record<DefaultImageKind, string>)[input.kind || "product"];
  const width = input.kind === "cover" ? 1600 : 900;
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&crop=entropy&w=${width}&q=85`;
}

function resolveDefaultActivityImages(input: Omit<DefaultImageInput, "kind">) {
  return {
    logoUrl: resolveDefaultImage({ ...input, kind: "activity" }),
    coverUrl: resolveDefaultImage({ ...input, kind: "cover" }),
  };
}


Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return response(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: headersFor(origin) });
  if (req.method !== "GET") return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return response(origin, { error: "SERVER_MISCONFIGURED" }, 500);
  const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    // Never publish isolated security-test tenants in the public directory.
    const { data: tenants, error: tenantError } = await db.from("tenants")
      .select("id,name,code,status,settings").eq("status", "ACTIVE").limit(100);
    if (tenantError) throw tenantError;
    const productionTenantIds = (tenants || []).filter((t: any) => {
      const id = String(t.id || "").toUpperCase();
      const code = String(t.code || "").toUpperCase();
      const name = String(t.name || "").toLowerCase();
      const purpose = String(t.settings?.purpose || "").toLowerCase();
      const testIdentity = /(^|[-_])TEST([-_]|$)|ISOLATION/.test(id) || /(^|[-_])TEST([-_]|$)|ISOLATION/.test(code);
      return !testIdentity && !purpose.includes("test") && !purpose.includes("isolation")
        && !name.includes("isolation test") && !name.includes("اختبار العزل");
    }).map((t: any) => String(t.id)).filter(Boolean);
    if (!productionTenantIds.length) return response(origin, { businesses: [], accessMode: "PUBLIC_DIRECTORY_READ_ONLY" });
    const { data: businesses, error: businessError } = await db.from("businesses")
      .select("id,tenant_id,organization_id,name,code,status,settings")
      .in("tenant_id", productionTenantIds).eq("status", "ACTIVE").limit(250);
    if (businessError) throw businessError;
    // Do not expose a business in public discovery until its owner explicitly publishes its catalog.
    const publishedBusinesses = (businesses || []).filter((b: any) => b.settings?.catalog_public_enabled === true);
    if (!publishedBusinesses.length) return response(origin, { businesses: [], accessMode: "PUBLIC_DIRECTORY_READ_ONLY" });
    const ids = publishedBusinesses.map((b: any) => b.id);
    const { data: providers, error: providerError } = await db.from("marketing_provider_profiles")
      .select("business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured")
      .in("business_id", ids).eq("status", "ACTIVE").limit(250);
    if (providerError) throw providerError;
    const providerMap = new Map((providers || []).map((p: any) => [String(p.business_id), p]));
    const publicBusinesses = publishedBusinesses.filter((b: any) => providerMap.has(String(b.id)));
    const results: any[] = [];
    for (const business of publicBusinesses.slice(0, 100)) {
      const tenantId = String(business.tenant_id || "");
      const { data: branches, error: branchError } = await db.from("branches")
        .select("id,name,code,status,address,phone").eq("tenant_id", tenantId).eq("business_id", business.id).eq("status", "ACTIVE").order("name").limit(100);
      if (branchError) throw branchError;
      if (!branches?.length) continue;
      const branch = branches[0];
      const branchId = String(branch.id);
      const provider: any = providerMap.get(String(business.id));
      const catalogPublished = business.settings?.catalog_public_enabled === true;
      let items: any[] = [];
      let prices: any[] = [];
      if (catalogPublished) {
        const { data: itemRows, error: itemError } = await db.from("catalog_items")
          .select("id,tenant_id,business_id,branch_id,item_type,name_ar,name_en,description,status,metadata")
          .eq("tenant_id", tenantId).eq("business_id", business.id).eq("status", "ACTIVE")
          .or(`branch_id.is.null,branch_id.eq.${branchId}`).order("name_ar").limit(150);
        if (itemError) throw itemError;
        items = (itemRows || []).filter((i: any) => i.metadata?.catalog_public?.is_available !== false);
        const itemIds = items.map((i: any) => i.id);
        if (itemIds.length) {
        const now = new Date().toISOString();
        const { data: p, error: priceError } = await db.from("catalog_item_prices")
          .select("id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to")
          .eq("tenant_id", tenantId).in("catalog_item_id", itemIds).eq("status", "ACTIVE")
          .lte("effective_from", now).or(`effective_to.is.null,effective_to.gte.${now}`).order("version", { ascending: false }).limit(1000);
        if (priceError) throw priceError;
        const hiddenPriceIds = new Set(
          items.filter((item: any) => item.metadata?.catalog_public?.show_price === false)
            .map((item: any) => String(item.id))
        );
        // Never serialize price rows for catalog entries explicitly marked as quote-only.
        prices = (p || []).filter((price: any) => !hiddenPriceIds.has(String(price.catalog_item_id)));
        }
      }
      const profile = business.settings?.catalog_profile || {};
      const activityName = String(provider?.name_ar || provider?.name_en || business.name);
      const activityCategory = String(profile.category || business.settings?.category_code || business.settings?.activity_code || (provider?.provider_kind !== "OFFICIAL" ? provider?.provider_kind : ""));
      const defaultImages = resolveDefaultActivityImages({
        name: activityName,
        description: String(profile.bio || provider?.description || business.settings?.headline || ""),
        category: activityCategory,
      });
      const phone = String(branch?.phone || profile.whatsapp_phone || profile.phone || "");
      const cleanPhone = phone.replace(/\D/g, "");
      const whatsappPhone = cleanPhone.startsWith("00") ? cleanPhone.slice(2)
        : cleanPhone.startsWith("0") ? "20" + cleanPhone.slice(1)
        : cleanPhone.startsWith("1") && cleanPhone.length === 10 ? "20" + cleanPhone : cleanPhone;
      results.push({
        id: business.id, tenantId, organizationId: business.organization_id,
        name: activityName,
        slug: provider?.slug || String(business.code || business.id),
        code: business.code, category: activityCategory,
        profile: { bio: String(profile.bio || provider?.description || ""), governorate: String(profile.governorate || ""), markaz: String(profile.markaz || ""), village: String(profile.village || ""), workingHours: String(profile.working_hours || ""), logoUrl: safeImage(profile.logo_url) || defaultImages.logoUrl, coverUrl: safeImage(profile.cover_url) || defaultImages.coverUrl, google_maps_url: String(profile.google_maps_url || ""), category: activityCategory, whatsappPhone },
        provider: { kind: activityCategory, description: provider?.description || profile.bio || "", slug: provider?.slug || "", verified: Boolean(provider?.is_verified), featured: Boolean(provider?.is_featured) },
        branches: branches || [], selectedBranchId: branchId || null, items, prices, contactPhone: phone,
        catalogPublished, publicEnabled: catalogPublished, paymentsEnabled: false, accessMode: "PUBLIC_READ_ONLY",
      });
    }
    return response(origin, { businesses: results, accessMode: "PUBLIC_DIRECTORY_READ_ONLY" });
  } catch (error) {
    console.error("public-catalog-directory failed", error instanceof Error ? error.message : "UNKNOWN");
    return response(origin, { error: "PUBLIC_DIRECTORY_UNAVAILABLE" }, 500);
  }
});
