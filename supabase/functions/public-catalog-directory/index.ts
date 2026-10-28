import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://islamnagy2022-eng.github.io",
  "https://catalog.tagerflow.com", "http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:3000", "http://127.0.0.1:8080"]);
const headersFor = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store",
});
const response = (origin: string | null, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
const safeImage = (value: unknown, allowLegacyShowcaseImage = false) => {
  const s = String(value || "").trim();
  if (s.length > 1500 || !/^https:\/\//i.test(s)) return "";
  // Older official showcase cards already have category photos saved in production.
  // Restore those visuals only for platform-owned showcase activities; ordinary
  // businesses still require their own supplied images.
  if (/^https:\/\/images\.unsplash\.com\//i.test(s) && !allowLegacyShowcaseImage) return "";
  return s;
};

const isOfficialShowcase = (business: any) =>
  business?.settings?.source === "OFFICIAL_PLATFORM_SHOWCASE" ||
  business?.settings?.managed_by === "SUPER_ADMIN";

type DefaultImageKind = "activity" | "product" | "service" | "cover";
interface DefaultImageInput { name?: string | null; description?: string | null; category?: string | null; kind?: DefaultImageKind; }
const IMAGE_PUBLIC_BASE = "https://islamnagy2022-eng.github.io/MantiqatiX/";
type ArtKey = "food" | "health" | "pharmacy" | "auto" | "education" | "fitness" | "home" | "real-estate" | "travel" | "digital" | "fashion" | "grocery" | "marketing" | "maintenance" | "labs";
const imageContextText = (input: DefaultImageInput) => [input.name, input.description, input.category].filter(Boolean).join(" ").toLocaleLowerCase();
function imageArt(input: DefaultImageInput): ArtKey {
  const t = imageContextText(input);
  if (/صيدل|دواء|أدوية|pharmacy|medicine/.test(t)) return "pharmacy";
  if (/معمل|تحاليل|أشعة|مختبر|laborator|radiolog|lab/.test(t)) return "labs";
  if (/عياد|طبي|طبيب|أسنان|مستشفى|صحة|health|medical|clinic|hospital|dent/.test(t)) return "health";
  if (/مطعم|مأكولات|أطعمة|غذاء|أغذية|وجبات|مخبز|حلويات|قهوة|كافيه|food|restaurant|bakery|cafe|coffee/.test(t)) return "food";
  if (/سيار|قطع غيار|ميكانيك|كهرباء سيارات|auto|car|vehicle/.test(t)) return "auto";
  if (/ملابس|أزياء|موضة|خياطة|بوتيك|fashion|clothing|apparel/.test(t)) return "fashion";
  if (/بقال|سوبر ماركت|خضروات|فاكهة|مواد غذائية|تسوق|grocery|market|supermarket/.test(t)) return "grocery";
  if (/تعليم|تدريب|مدرس|دروس|جامعة|كتب|education|training|school|tutor/.test(t)) return "education";
  if (/جيم|لياقة|رياضة|تمارين|fitness|gym|sport/.test(t)) return "fitness";
  if (/سفر|سياحة|رحلات|حجز طيران|travel|tourism|flight/.test(t)) return "travel";
  if (/عقار|عقارات|تشطيب|ديكور|أثاث|منزل|مفروشات|سباكة|نجار|حداد|صيانة|تنظيف|home|furniture|real estate|property|maintenance|repair|plumb|carpenter/.test(t)) return /عقار|عقارات|real estate|property/.test(t) ? "real-estate" : "home";
  if (/تسويق|إعلان|إعلانات|تصميم|برمجة|رقمي|تكنولوجيا|software|digital|marketing|design|developer|technology/.test(t)) return "digital";
  if (/خدمات|استشارات|محام|قانون|مكتب|ترجمة|محاسبة|خدمة|service|legal|consult|account/.test(t)) return "marketing";
  return "grocery";
}
const activityImageAssets: Record<ArtKey, string> = {
  food:"legacy/activity/food.svg", health:"legacy/activity/medical.svg", pharmacy:"legacy/activity/pharmacy.svg",
  auto:"legacy/activity/auto.svg", education:"legacy/activity/education.svg", fitness:"legacy/activity/fitness.svg",
  home:"legacy/activity/home.svg", "real-estate":"legacy/activity/real-estate.svg", travel:"legacy/activity/travel.svg",
  digital:"legacy/activity/digital.svg", fashion:"legacy/activities/fashion.svg", grocery:"legacy/activities/grocery.svg",
  marketing:"legacy/activities/marketing.svg", maintenance:"legacy/activities/maintenance.svg", labs:"legacy/activity/labs.svg",
};
const itemImageAssets: Record<ArtKey, string> = {
  food:"legacy/activities/food.svg", health:"legacy/activities/health.svg", pharmacy:"legacy/activities/health.svg",
  auto:"legacy/activities/auto.svg", education:"legacy/activities/education.svg", fitness:"legacy/activities/health.svg",
  home:"legacy/activity/home.svg", "real-estate":"legacy/activity/real-estate.svg", travel:"legacy/activity/travel.svg",
  digital:"legacy/activities/marketing.svg", fashion:"legacy/activities/fashion.svg", grocery:"legacy/activities/grocery.svg",
  marketing:"legacy/activities/marketing.svg", maintenance:"legacy/activities/maintenance.svg", labs:"legacy/activities/health.svg",
};
function resolveDefaultImage(input: DefaultImageInput = {}): string {
  const art = imageArt(input);
  return IMAGE_PUBLIC_BASE + ((input.kind === "activity" || input.kind === "cover") ? activityImageAssets[art] : itemImageAssets[art]);
}
function resolveDefaultActivityImages(input: Omit<DefaultImageInput, "kind">) {
  return { logoUrl: resolveDefaultImage({ ...input, kind: "activity" }), coverUrl: resolveDefaultImage({ ...input, kind: "cover" }) };
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
    // Customer-owned catalogues remain opt-in. Platform-owned showcase activities
    // are public directory cards even before their module/catalog is separately enabled.
    const directoryBusinesses = (businesses || []).filter((b: any) =>
      b.settings?.catalog_public_enabled === true || isOfficialShowcase(b)
    );
    if (!directoryBusinesses.length) return response(origin, { businesses: [], accessMode: "PUBLIC_DIRECTORY_READ_ONLY" });
    const ids = directoryBusinesses.map((b: any) => b.id);
    const { data: providers, error: providerError } = await db.from("marketing_provider_profiles")
      .select("business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured")
      .in("business_id", ids).eq("status", "ACTIVE").limit(250);
    if (providerError) throw providerError;
    const providerMap = new Map((providers || []).map((p: any) => [String(p.business_id), p]));
    const publicBusinesses = directoryBusinesses.filter((b: any) => providerMap.has(String(b.id)));
    const results: any[] = [];
    for (const business of publicBusinesses.slice(0, 100)) {
      const tenantId = String(business.tenant_id || "");
      const { data: branches, error: branchError } = await db.from("branches")
        .select("id,name,code,status,address,phone").eq("tenant_id", tenantId).eq("business_id", business.id).eq("status", "ACTIVE").order("name").limit(100);
      if (branchError) throw branchError;
      const catalogPublished = business.settings?.catalog_public_enabled === true;
      // A public catalogue needs a real branch. An official showcase card can be
      // displayed without one, since it does not expose products or operations.
      if (!branches?.length && catalogPublished) continue;
      const branch: any = branches?.[0] || null;
      const branchId = String(branch?.id || "");
      const provider: any = providerMap.get(String(business.id));
      const officialShowcase = isOfficialShowcase(business);
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
        profile: { bio: String(profile.bio || provider?.description || business.settings?.headline || ""), governorate: String(profile.governorate || ""), markaz: String(profile.markaz || ""), village: String(profile.village || ""), workingHours: String(profile.working_hours || ""), logoUrl: safeImage(profile.logo_url, officialShowcase) || defaultImages.logoUrl, coverUrl: safeImage(profile.cover_url, officialShowcase) || defaultImages.coverUrl, google_maps_url: String(profile.google_maps_url || ""), category: activityCategory, whatsappPhone },
        provider: { kind: activityCategory, description: provider?.description || profile.bio || business.settings?.headline || "", slug: provider?.slug || "", verified: Boolean(provider?.is_verified), featured: Boolean(provider?.is_featured) },
        branches: branches || [], selectedBranchId: branchId || null, items, prices, contactPhone: phone,
        catalogPublished, publicEnabled: catalogPublished, isOfficialShowcase: officialShowcase,
        paymentsEnabled: false, accessMode: "PUBLIC_READ_ONLY",
      });
    }
    return response(origin, { businesses: results, accessMode: "PUBLIC_DIRECTORY_READ_ONLY" });
  } catch (error) {
    console.error("public-catalog-directory failed", error instanceof Error ? error.message : "UNKNOWN");
    return response(origin, { error: "PUBLIC_DIRECTORY_UNAVAILABLE" }, 500);
  }
});
