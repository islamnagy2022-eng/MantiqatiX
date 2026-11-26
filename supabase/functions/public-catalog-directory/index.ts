// Supabase Edge Runtime provides Deno.serve at runtime; no runtime import is needed for its ambient type declarations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizeActivityModuleOverrides } from "../_shared/activity-module-overrides.mjs";
import { filterRowsToPubliclyPricedItems, getExplicitlyPublicComparePrice } from "../_shared/public-price-visibility.mjs";
import { getExplicitPublicContact } from "../_shared/public-contact-visibility.mjs";
import { sanitizePublicPromotionalImages } from "../_shared/promotional-images.mjs";
import {
  PUBLIC_DIRECTORY_PAGE_SIZE,
  getNextDirectoryCursorPosition,
  hashDirectoryScope,
  issueDirectoryCursor,
  matchesDirectoryAreaFilter,
  matchesDirectoryVerificationPhase,
  matchesDirectoryBusinessFilters,
  mergePublicDirectoryCatalogItems,
  normalizeDirectoryFilters,
  parseDirectorySlugs,
  verifyDirectoryCursor,
} from "../_shared/public-directory-pagination.mjs";

type PublicDirectoryFilters = {
  activity?: string;
  specialty?: string;
  governorate?: string;
  markaz?: string;
  village?: string;
  area?: string;
  query?: string;
};

const allowedOrigins = new Set(["https://islamnagy2022-eng.github.io", "http://localhost:3000", "http://localhost:5173", "http://localhost:8080", "http://127.0.0.1:3000", "http://127.0.0.1:5173", "http://127.0.0.1:8080"]);
const headersFor = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store",
});
const response = (origin: string | null, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headersFor(origin) });

// Return only display-safe catalogue metadata. Inventory controls and tenant-specific fields stay server-side.
const publicCatalogItemMetadata = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const metadata = value as Record<string, unknown>;
  const rawPublic = metadata.catalog_public && typeof metadata.catalog_public === "object" && !Array.isArray(metadata.catalog_public)
    ? metadata.catalog_public as Record<string, unknown> : {};
  const catalogPublic: Record<string, unknown> = {};
  if (typeof rawPublic.is_available === "boolean") catalogPublic.is_available = rawPublic.is_available;
  if (typeof rawPublic.show_price === "boolean") catalogPublic.show_price = rawPublic.show_price;
  if (typeof rawPublic.image_url === "string") catalogPublic.image_url = rawPublic.image_url.slice(0, 1500);
  if (typeof rawPublic.image_source === "string") catalogPublic.image_source = rawPublic.image_source.slice(0, 24);
  if (typeof rawPublic.category === "string") catalogPublic.category = rawPublic.category.slice(0, 100);
  if (typeof rawPublic.unit === "string") catalogPublic.unit = rawPublic.unit.slice(0, 40);
  const comparePrice = getExplicitlyPublicComparePrice({ metadata: { catalog_public: rawPublic } });
  if (comparePrice !== null) catalogPublic.compare_price = comparePrice;
  const result: Record<string, unknown> = { catalog_public: catalogPublic };
  if (typeof metadata.image_url === "string") result.image_url = metadata.image_url.slice(0, 1500);
  return result;
};
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
    const requestUrl = new URL(req.url);
    const filters = normalizeDirectoryFilters(requestUrl.searchParams) as PublicDirectoryFilters;
    const parsedSlugs = parseDirectorySlugs(requestUrl.searchParams.get("slugs"));
    if (!parsedSlugs.ok) return response(origin, { error: "INVALID_SLUG_FILTER" }, 400);
    const requestedSlugs = new Set(parsedSlugs.slugs);
    const requestedLimit = requestUrl.searchParams.get("limit");
    if (requestedLimit !== null && requestedLimit !== String(PUBLIC_DIRECTORY_PAGE_SIZE)) {
      return response(origin, { error: "PAGE_SIZE_NOT_SUPPORTED", pageSize: PUBLIC_DIRECTORY_PAGE_SIZE }, 400);
    }
    const scopeHash = await hashDirectoryScope(filters, parsedSlugs.slugs);
    let cursorState: { ok: true; phase: "verified" | "unverified"; lastId: string | null; snapshotAt: string } | null = null;
    const rawCursor = requestUrl.searchParams.get("cursor");
    if (rawCursor) {
      const verified = await verifyDirectoryCursor(rawCursor, { scopeHash, secret: serviceKey });
      if (!verified.ok || (verified.phase !== "verified" && verified.phase !== "unverified") ||
          (verified.phase === "verified" && typeof verified.lastId !== "string") ||
          (verified.phase === "unverified" && verified.lastId !== null && typeof verified.lastId !== "string") ||
          typeof verified.snapshotAt !== "string") {
        return response(origin, { error: "INVALID_CURSOR" }, 400);
      }
      cursorState = {
        ok: true,
        phase: verified.phase,
        lastId: verified.lastId,
        snapshotAt: verified.snapshotAt,
      };
    }
    const snapshotAt = cursorState?.snapshotAt || new Date().toISOString();

    // Never publish isolated security-test tenants in the public directory.
    const { data: tenants, error: tenantError, count: tenantCount } = await db.from("tenants")
      .select("id,name,code,status,settings", { count: "exact" })
      .eq("status", "ACTIVE").order("id", { ascending: true }).limit(1000);
    if (tenantError) throw tenantError;
    if (tenantCount !== null && tenantCount > (tenants || []).length) throw new Error("TENANT_DIRECTORY_SCAN_LIMIT_EXCEEDED");
    const productionTenantIds = (tenants || []).filter((t: any) => {
      const id = String(t.id || "").toUpperCase();
      const code = String(t.code || "").toUpperCase();
      const name = String(t.name || "").toLowerCase();
      const purpose = String(t.settings?.purpose || "").toLowerCase();
      const testIdentity = /(^|[-_])TEST([-_]|$)|ISOLATION/.test(id) || /(^|[-_])TEST([-_]|$)|ISOLATION/.test(code);
      return !testIdentity && !purpose.includes("test") && !purpose.includes("isolation")
        && !name.includes("isolation test") && !name.includes("اختبار العزل");
    }).map((t: any) => String(t.id)).filter(Boolean);
    if (!productionTenantIds.length) return response(origin, { businesses: [], activityModuleOverrides: {}, activityModuleOverridesAvailable: false, accessMode: "PUBLIC_DIRECTORY_READ_ONLY", pagination: { pageSize: PUBLIC_DIRECTORY_PAGE_SIZE, hasMore: false, nextCursor: null } });

    // Publish only the explicitly public activity-module copy. Never return the
    // complete platform settings object or private contact/payment configuration.
    let activityModuleOverrides: Record<string, unknown> = {};
    let activityModuleOverridesAvailable = false;
    const { data: platformSettings, error: platformSettingsError } = await db.from("bizcatalog_platform_settings")
      .select("settings").eq("settings_key", "bizcatalog").maybeSingle();
    if (platformSettingsError) {
      console.warn("public activity module settings unavailable", platformSettingsError.message);
    } else {
      try {
        activityModuleOverrides = Object.fromEntries(Object.entries(sanitizeActivityModuleOverrides(platformSettings?.settings?.activityModuleOverrides || {})));
        activityModuleOverridesAvailable = true;
      } catch {
        console.warn("public activity module settings failed validation");
      }
    }
    // The public feed is keyset-paginated; never load an unbounded directory into the browser.
    const buildPublicBusiness = async (business: any): Promise<any | null> => {
      const tenantId = String(business.tenant_id || "");
      const { data: branches, error: branchError } = await db.from("branches")
        .select("id,name,code,status,address,phone").eq("tenant_id", tenantId).eq("business_id", business.id).eq("status", "ACTIVE").order("name").limit(100);
      if (branchError) throw branchError;
      const catalogPublished = business.settings?.catalog_public_enabled === true;
      const bizcatalog = business.settings?.bizcatalog && typeof business.settings.bizcatalog === "object"
        ? business.settings.bizcatalog : {};
      const operationalStatus = String(bizcatalog.operationalStatus || (bizcatalog.isFrozen ? "FROZEN" : "ACTIVE")).toUpperCase();
      const operationallyActive = operationalStatus === "ACTIVE"
        && bizcatalog.isFrozen !== true
        && String(bizcatalog.paymentStatus || "").toLowerCase() !== "frozen";
      // A public catalogue needs a real branch even while operations are paused;
      // the approved profile may remain visible without exposing sellable items.
      if (!branches?.length && catalogPublished) return null;
      const branch: any = branches?.[0] || null;
      const branchId = String(branch?.id || "");
      const profile = business.settings?.catalog_profile || {};
      const publicContact = getExplicitPublicContact(profile, branch);
      // Match the same branch-aware address that the public response will expose,
      // only after the explicit owner-consent and audit projection has been applied.
      if (filters.area && !matchesDirectoryAreaFilter(publicContact.address, filters.area)) return null;
      const provider: any = providerMap.get(String(business.id));
      const officialShowcase = isOfficialShowcase(business);
      let items: any[] = [];
      let prices: any[] = [];
      if (catalogPublished && operationallyActive) {
        const itemQuery = () => db.from("catalog_items")
          .select("id,tenant_id,business_id,branch_id,item_type,name_ar,name_en,description,status,metadata")
          .eq("tenant_id", tenantId).eq("business_id", business.id).eq("status", "ACTIVE")
          .order("name_ar").limit(150);
        const [globalItemResult, branchItemResult] = await Promise.all([
          itemQuery().is("branch_id", null),
          itemQuery().eq("branch_id", branchId),
        ]);
        if (globalItemResult.error || branchItemResult.error) {
          throw globalItemResult.error || branchItemResult.error;
        }
        items = mergePublicDirectoryCatalogItems(
          (globalItemResult.data || []).filter((item: any) => item.metadata?.catalog_public?.is_available === true),
          (branchItemResult.data || []).filter((item: any) => item.metadata?.catalog_public?.is_available === true),
          150,
        );
        const itemIds = items.map((i: any) => i.id);
        if (itemIds.length) {
          const now = new Date().toISOString();
          const priceQuery = () => db.from("catalog_item_prices")
            .select("id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to")
            .eq("tenant_id", tenantId).in("catalog_item_id", itemIds).eq("status", "ACTIVE")
            .lte("effective_from", now).or(`effective_to.is.null,effective_to.gte.${now}`)
            .order("version", { ascending: false }).limit(1000);
          const [globalPriceResult, branchPriceResult] = await Promise.all([
            priceQuery().is("branch_id", null),
            priceQuery().eq("branch_id", branchId),
          ]);
          if (globalPriceResult.error || branchPriceResult.error) {
            throw globalPriceResult.error || branchPriceResult.error;
          }
          // Stored prices are returned only when the owner explicitly opted in with show_price=true.
          prices = filterRowsToPubliclyPricedItems(items, [
            ...(globalPriceResult.data || []),
            ...(branchPriceResult.data || []),
          ]);
        }
      }
      const activityName = String(provider?.name_ar || provider?.name_en || business.name);
      const activityCategory = String(profile.category || business.settings?.category_code || business.settings?.activity_code || (provider?.provider_kind !== "OFFICIAL" ? provider?.provider_kind : ""));
      const defaultImages = resolveDefaultActivityImages({
        name: activityName,
        description: String(profile.bio || provider?.description || business.settings?.headline || ""),
        category: activityCategory,
      });
      const externalLogoUrl = safeImage(profile.logo_url, officialShowcase);
      const externalCoverUrl = safeImage(profile.cover_url, officialShowcase);
      const whatsappPhone = publicContact.whatsappNumber;
      return {
        id: business.id,
        status: String(business.status || "").trim().toUpperCase(),
        name: activityName,
        slug: provider?.slug || String(business.code || business.id),
        code: business.code, category: activityCategory,
        activityGroupCode: String(business.settings?.activity_group_code || business.settings?.taxonomy_group_code || ""),
        activityCategoryCode: String(business.settings?.activity_category_code || ""),
        activityClassificationType: String(business.settings?.activity_classification_type || "activity").toLowerCase() === "profession" ? "profession" : "activity",
        activitySpecialty: String(business.settings?.activity_specialty || ""),
        profile: { bio: String(profile.bio || provider?.description || business.settings?.headline || ""), governorate: String(profile.governorate || ""), markaz: String(profile.markaz || ""), village: String(profile.village || ""), workingHours: String(profile.working_hours || ""), logoUrl: externalLogoUrl || defaultImages.logoUrl, coverUrl: externalCoverUrl || defaultImages.coverUrl, promotionalImages: sanitizePublicPromotionalImages(profile.promotional_images), externalLogoUrl, externalCoverUrl, google_maps_url: publicContact.googleMapsUrl, public_contact_enabled: profile.public_contact_enabled === true, public_contact_consent_audit_verified: profile.public_contact_consent_audit_verified === true, category: activityCategory, phoneDisplay: publicContact.phoneDisplay, whatsappNumber: publicContact.whatsappNumber, whatsappUrl: publicContact.whatsappUrl, address: publicContact.address, additionalContactPhones: publicContact.additionalContactPhones, whatsappPhone },
        provider: { kind: activityCategory, description: provider?.description || profile.bio || business.settings?.headline || "", slug: provider?.slug || "", verified: Boolean(provider?.is_verified), featured: Boolean(provider?.is_featured) },
        branches: (branches || []).map((entry: any) => ({ id: entry.id, name: entry.name, code: entry.code })),
        selectedBranchId: branchId || null,
        items: items.map((item: any) => ({
          id: item.id, status: String(item.status || "ACTIVE").trim().toUpperCase(),
          item_type: item.item_type, name_ar: item.name_ar, name_en: item.name_en,
          description: item.description, metadata: publicCatalogItemMetadata(item.metadata),
        })),
        prices: prices.map((price: any) => ({
          catalog_item_id: price.catalog_item_id, branch_id: price.branch_id,
          currency: price.currency, unit_price: price.unit_price,
        })),
        contactPhone: publicContact.phoneDisplay || publicContact.whatsappNumber,
        catalogPublished, publicEnabled: catalogPublished, isOfficialShowcase: officialShowcase,
        operationalStatus,
        operationallyAvailable: operationallyActive,
        paymentsEnabled: false, accessMode: "PUBLIC_READ_ONLY",
      };
    };

    // Keep the established verified-first ranking across page boundaries.
    // The verified phase is exhausted before the unverified phase begins.
    const providerMap = new Map<string, any>();
    const results: Array<{ business: any; phase: "verified" | "unverified" }> = [];
    const scanBatchSize = 100;
    const maxScanRounds = 50;
    let phase: "verified" | "unverified" = cursorState?.phase || "verified";
    let scanAfterId = cursorState?.lastId ?? null;
    let scanRounds = 0;
    let exhausted = false;
    const scanCurrentPhase = async () => {
      while (results.length < PUBLIC_DIRECTORY_PAGE_SIZE + 1 && !exhausted && scanRounds < maxScanRounds) {
        let businessQuery = db.from("businesses")
          .select("id,tenant_id,organization_id,name,code,status,settings,created_at")
          .in("tenant_id", productionTenantIds)
          .eq("status", "ACTIVE")
          .lte("created_at", snapshotAt)
          .order("id", { ascending: true })
          .limit(scanBatchSize);
        if (scanAfterId) businessQuery = businessQuery.gt("id", scanAfterId);
        const { data: businessRows, error: businessError } = await businessQuery;
        if (businessError) throw businessError;
        const rows = businessRows || [];
        if (!rows.length) { exhausted = true; break; }
        scanAfterId = String(rows[rows.length - 1].id || "");
        scanRounds += 1;
        if (rows.length < scanBatchSize) exhausted = true;

        const directoryBusinesses = rows.filter((b: any) =>
          b.settings?.catalog_public_enabled === true || isOfficialShowcase(b)
        );
        if (!directoryBusinesses.length) continue;

        const businessIds = directoryBusinesses.map((business: any) => business.id);
        const { data: providers, error: providerError } = await db.from("marketing_provider_profiles")
          .select("business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured")
          .in("business_id", businessIds).eq("status", "ACTIVE").limit(250);
        if (providerError) throw providerError;
        providerMap.clear();
        for (const provider of providers || []) providerMap.set(String(provider.business_id), provider);

        const matchingBusinesses = directoryBusinesses.filter((business: any) => {
          const provider: any = providerMap.get(String(business.id));
          return Boolean(provider) &&
            matchesDirectoryVerificationPhase(provider, phase) &&
            (requestedSlugs.size === 0 || requestedSlugs.has(String(provider?.slug || "").trim())) &&
            matchesDirectoryBusinessFilters(business, provider, filters);
        });

        // Keep DB ordering within each verified/unverified phase while limiting
        // concurrent branch/catalog reads.
        for (let offset = 0; offset < matchingBusinesses.length && results.length < PUBLIC_DIRECTORY_PAGE_SIZE + 1; offset += 8) {
          const batch = matchingBusinesses.slice(offset, offset + 8);
          const built = await Promise.all(batch.map((business: any) => buildPublicBusiness(business)));
          for (const business of built) {
            if (!business) continue;
            results.push({ business, phase });
            if (results.length >= PUBLIC_DIRECTORY_PAGE_SIZE + 1) break;
          }
        }
      }
    };

    await scanCurrentPhase();
    if (phase === "verified" && exhausted && results.length < PUBLIC_DIRECTORY_PAGE_SIZE + 1) {
      phase = "unverified";
      scanAfterId = null;
      scanRounds = 0;
      exhausted = false;
      await scanCurrentPhase();
    }

    if (!exhausted && results.length <= PUBLIC_DIRECTORY_PAGE_SIZE && scanRounds >= maxScanRounds) {
      return response(origin, { error: "DIRECTORY_SCAN_LIMIT_EXCEEDED", retryable: true }, 503);
    }
    const hasMore = results.length > PUBLIC_DIRECTORY_PAGE_SIZE;
    const pageEntries = results.slice(0, PUBLIC_DIRECTORY_PAGE_SIZE);
    const pageBusinesses = pageEntries.map((entry) => entry.business);
    let nextCursor: string | null = null;
    if (hasMore && pageEntries.length) {
      const lastEntry = pageEntries[pageEntries.length - 1];
      const nextPosition = getNextDirectoryCursorPosition({
        lastId: String(lastEntry.business.id),
        lastPhase: lastEntry.phase,
        lookaheadPhase: results[PUBLIC_DIRECTORY_PAGE_SIZE].phase,
      });
      nextCursor = await issueDirectoryCursor({
        ...nextPosition,
        snapshotAt,
        scopeHash,
        secret: serviceKey,
      });
    }
    return response(origin, {
      businesses: pageBusinesses,
      activityModuleOverrides,
      activityModuleOverridesAvailable,
      accessMode: "PUBLIC_DIRECTORY_READ_ONLY",
      pagination: { pageSize: PUBLIC_DIRECTORY_PAGE_SIZE, hasMore, nextCursor },
    });
  } catch (error) {
    console.error("public-catalog-directory failed", error instanceof Error ? error.message : "UNKNOWN");
    return response(origin, { error: "PUBLIC_DIRECTORY_UNAVAILABLE" }, 500);
  }
});
