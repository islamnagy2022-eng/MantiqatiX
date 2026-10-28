import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const allowedOrigin = "https://islamnagy2022-eng.github.io";

const cors = (_origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
});
const out = (origin: string | null, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(origin) });

const isPlatformAdmin = (m: any) =>
  String(m.role || "").toUpperCase() === "SUPER_ADMIN" &&
  !m.business_id &&
  !m.branch_id &&
  m.permissions?.scope === "PLATFORM" &&
  m.permissions?.full_control === true;

const businessRole = (m: any) =>
  ["OWNER", "BUSINESS_OWNER", "ADMIN", "MANAGER", "SERVICE_PROVIDER", "PROVIDER_OWNER", "PROVIDER_ADMIN"].includes(String(m.role || "").toUpperCase());

const catalogMutationActions = new Set([
  "BUSINESS_PROFILE_UPSERT", "ITEM_PRICE_UPSERT", "ITEM_STATUS_UPDATE",
  "WAREHOUSE_CREATE", "STOCK_ADJUST", "ITEM_UPSERT", "PRICE_UPSERT", "SETTINGS_UPSERT",
]);

const canUseCatalog = (membership: any, write = false) => {
  const p = membership?.permissions && typeof membership.permissions === "object" && !Array.isArray(membership.permissions)
    ? membership.permissions : {};
  const modules = p.modules && typeof p.modules === "object" && !Array.isArray(p.modules) ? p.modules : {};
  const catalog = modules.CATALOG;
  if (p.account_restricted === true || p.catalog === false || catalog === false) return false;
  if (catalog && typeof catalog === "object" && catalog.view === false) return false;
  if (write && (p.catalog_write === false || p.catalog_read_only === true)) return false;
  if (write && catalog && typeof catalog === "object" && catalog.write === false) return false;
  if (Array.isArray(catalog) && !catalog.includes("view")) return false;
  if (write && Array.isArray(catalog) && !catalog.some((action: string) => ["create", "update", "approve", "manage"].includes(action))) return false;
  return true;
};

// PostgreSQL UUID columns accept any 128-bit UUID-shaped value. Some existing
// platform business IDs are legacy values whose version/variant nibbles do not
// follow RFC 4122; validate the canonical shape without rejecting those rows.
const isUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const safeBranch = (value: unknown) =>
  typeof value === "string" && value.length > 0 && value.length <= 80 && /^[a-z0-9_-]+$/i.test(value);

const catalogMetadataWithImage = (
  value: unknown,
  name: string,
  description: string,
  itemType: string,
) => {
  const root = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
  const catalog = root.catalog_public && typeof root.catalog_public === "object" && !Array.isArray(root.catalog_public)
    ? root.catalog_public as Record<string, any>
    : {};
  const currentUrl = String(catalog.image_url || "").trim();
  const explicitSource = String(catalog.image_source || "").toLowerCase();
  const legacyStockUrl = /^https:\/\/images\.unsplash\.com\//i.test(currentUrl);
  const neutralPlaceholderUrl = /(?:^|\/)catalog-item-placeholder\.svg(?:[?#].*)?$/i.test(currentUrl);
  const imageSource = explicitSource === "ai" && Boolean(currentUrl)
    ? "ai"
    : explicitSource === "auto" || !currentUrl || legacyStockUrl || neutralPlaceholderUrl ? "auto" : "owner";
  const imageUrl = imageSource === "owner" || imageSource === "ai"
    ? currentUrl
    : resolveDefaultImage({
      name,
      description,
      category: String(catalog.category || ""),
      kind: String(itemType).toUpperCase() === "SERVICE" ? "service" : "product",
    });
  return {
    ...root,
    catalog_public: {
      ...catalog,
      image_url: imageUrl,
      image_source: imageSource,
    },
  };
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && origin !== allowedOrigin) return out(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors(origin) });
  if (req.method !== "POST") return out(origin, { error: "METHOD_NOT_ALLOWED" }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return out(origin, { error: "AUTH_REQUIRED" }, 401);
  const token = auth.slice(7).trim();
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return out(origin, { error: "SERVER_MISCONFIGURED" }, 500);

  const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const userClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const { data: { user }, error: userError } = await service.auth.getUser(token);
  if (userError || !user || user.is_anonymous) return out(origin, { error: "AUTH_REQUIRED" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return out(origin, { error: "INVALID_JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return out(origin, { error: "INVALID_BODY" }, 400);

  const action = String(body.action || "").toUpperCase();
  const tenantId = String(body.tenantId || "").trim();
  const businessId = String(body.businessId || "").trim();
  const branchId = body.branchId == null || body.branchId === "" ? null : String(body.branchId).trim();

  try {
    const { data: memberships, error: membershipError } = await service
      .from("user_memberships")
      .select("id,tenant_id,business_id,branch_id,role,status,permissions")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .limit(250);
    if (membershipError) throw membershipError;

    const activeMemberships = memberships || [];
    const hasPlatformScope = activeMemberships.some(isPlatformAdmin);

    if (action === "BUSINESS_LIST") {
      const tenantOwnerScope = tenantId && activeMemberships.some((m: any) =>
        String(m.tenant_id) === tenantId &&
        String(m.role || "").toUpperCase() === "OWNER" &&
        !m.business_id && !m.branch_id &&
        String(m.status || "").toUpperCase() === "ACTIVE"
      );
      if (!hasPlatformScope && !tenantOwnerScope) return out(origin, { error: "CATALOG_BUSINESS_LIST_FORBIDDEN" }, 403);
      const platformTenants = [...new Set(activeMemberships.filter(isPlatformAdmin).map((m: any) => String(m.tenant_id)))];
      if (hasPlatformScope && tenantId && !platformTenants.includes(tenantId)) return out(origin, { error: "TENANT_SCOPE_FORBIDDEN" }, 403);
      const authorizedTenants = hasPlatformScope ? platformTenants : [tenantId];
      if (!authorizedTenants.length || authorizedTenants.some((value: string) => !value)) return out(origin, { businesses: [] });
      let query = service.from("businesses")
        .select("id,tenant_id,organization_id,name,code,status,settings")
        .in("tenant_id", authorizedTenants)
        .eq("status", "ACTIVE")
        .order("name", { ascending: true })
        .limit(250);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data: businesses, error } = await query;
      if (error) throw error;
      const rows = businesses || [];
      const ids = rows.map((b: any) => b.id);
      const { data: profiles, error: profilesError } = ids.length
        ? await service.from("marketing_provider_profiles")
          .select("business_id,name_ar,name_en,provider_kind,status")
          .in("business_id", ids)
        : { data: [], error: null };
      if (profilesError) throw profilesError;
      const profileMap = new Map((profiles || []).map((p: any) => [String(p.business_id), p]));
      return out(origin, {
        businesses: rows.map((b: any) => {
          const p: any = profileMap.get(String(b.id));
          return {
            id: b.id, tenantId: b.tenant_id, organizationId: b.organization_id,
            name: p?.name_ar || p?.name_en || b.name,
            code: b.code, status: b.status,
            sector: p?.provider_kind || b.settings?.activity_code || b.settings?.category_code || "",
          };
        }),
      });
    }

    if (!tenantId || tenantId.length > 80) return out(origin, { error: "TENANT_REQUIRED" }, 400);
    if (!isUuid(businessId)) return out(origin, { error: "INVALID_BUSINESS_ID" }, 400);
    if (branchId && !safeBranch(branchId)) return out(origin, { error: "INVALID_BRANCH_ID" }, 400);

    const businessMemberships = activeMemberships.filter((m: any) =>
      String(m.tenant_id) === tenantId &&
      businessRole(m) &&
      (
        String(m.business_id || "") === businessId ||
        (String(m.role || "").toUpperCase() === "OWNER" && !m.business_id && !m.branch_id)
      ) &&
      (!m.branch_id || String(m.branch_id) === String(branchId || ""))
    );
    const scopedPlatformMembership = activeMemberships.some((m: any) =>
      String(m.tenant_id) === tenantId && isPlatformAdmin(m)
    );
    const hasBusinessScope = businessMemberships.length > 0 || scopedPlatformMembership;
    if (!hasBusinessScope) return out(origin, { error: "BUSINESS_MANAGEMENT_REQUIRED" }, 403);

    const { data: business, error: businessError } = await service
      .from("businesses")
      .select("id,tenant_id,organization_id,name,code,status,settings")
      .eq("id", businessId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (businessError) throw businessError;
    if (!business) return out(origin, { error: "BUSINESS_NOT_FOUND" }, 404);

    // Subscription enforcement belongs on the server, not only in dashboard UI.
    // Keep reads available so an owner can see status and request reactivation,
    // but block merchant mutations after a business is frozen or deactivated.
    const catalogSettings = business.settings?.bizcatalog && typeof business.settings.bizcatalog === "object"
      ? business.settings.bizcatalog
      : {};
    const mutationActions = catalogMutationActions;
    if (!scopedPlatformMembership && action === "CATALOG_READ"
      && !businessMemberships.some((m: any) => canUseCatalog(m, false))) {
      return out(origin, { error: "CATALOG_ACCESS_RESTRICTED", message: "تم تقييد الوصول إلى كتالوج هذا النشاط من إدارة المنصة." }, 403);
    }
    if (!scopedPlatformMembership && mutationActions.has(action)
      && !businessMemberships.some((m: any) => canUseCatalog(m, true))) {
      return out(origin, { error: "CATALOG_READ_ONLY", message: "هذا الحساب يملك صلاحية العرض فقط أو تم منع التعديل من إدارة المنصة." }, 403);
    }
    if (mutationActions.has(action) && !scopedPlatformMembership) {
      if (String(business.status || "").toUpperCase() !== "ACTIVE") {
        return out(origin, { error: "BUSINESS_INACTIVE", message: "النشاط غير نشط؛ تواصل مع إدارة المنصة لإعادة التفعيل." }, 409);
      }
      if (catalogSettings.isFrozen === true || String(catalogSettings.paymentStatus || "").toLowerCase() === "frozen") {
        return out(origin, { error: "SUBSCRIPTION_FROZEN", message: "تم إيقاف التعديلات بسبب حالة الاشتراك؛ تواصل مع إدارة المنصة لتجديده." }, 423);
      }
    }

    if (action === "CATALOG_READ") {
      const { data: rawBranches, error: branchesError } = await service.from("branches")
        .select("id,name,code,status,phone,address")
        .eq("tenant_id", tenantId)
        .eq("business_id", businessId)
        .eq("status", "ACTIVE")
        .order("name", { ascending: true })
        .limit(100);
      if (branchesError) throw branchesError;
      const branchOnlyMemberships = businessMemberships.filter((m: any) => Boolean(m.branch_id));
      const hasBusinessWideMembership = businessMemberships.some((m: any) => !m.branch_id);
      let branches = rawBranches || [];
      if (!scopedPlatformMembership && branchOnlyMemberships.length && !hasBusinessWideMembership) {
        const allowed = new Set(branchOnlyMemberships.map((m: any) => String(m.branch_id)));
        branches = branches.filter((b: any) => allowed.has(String(b.id)));
      }
      // A known business must remain visible to its authorized owner/admin even
      // before a branch is activated. Return metadata-only state instead of
      // turning a valid membership into a bootstrap failure or silently hiding it.
      if (!branches.length) {
        if (branchId) return out(origin, { error: "BRANCH_SCOPE_FORBIDDEN" }, 403);
        const { data: provider, error: providerError } = await service.from("marketing_provider_profiles")
          .select("id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured")
          .eq("business_id", businessId).eq("status", "ACTIVE")
          .order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (providerError) throw providerError;
        const profile = business.settings?.catalog_profile || {};
        return out(origin, {
          business: {
            id: business.id, tenantId: business.tenant_id, organizationId: business.organization_id,
            name: provider?.name_ar || provider?.name_en || business.name,
            code: business.code, status: business.status,
            profile: {
              bio: String(profile.bio || provider?.description || ""),
              governorate: String(profile.governorate || ""),
              markaz: String(profile.markaz || ""),
              village: String(profile.village || ""),
              workingHours: String(profile.working_hours || ""),
              logoUrl: String(profile.logo_url || ""),
              coverUrl: String(profile.cover_url || ""),
              google_maps_url: String(profile.google_maps_url || ""),
              publicEnabled: business.settings?.catalog_public_enabled === true,
            },
            bizcatalog: business.settings?.bizcatalog && typeof business.settings.bizcatalog === "object"
              ? business.settings.bizcatalog
              : {},
          },
          provider: provider ? {
            id: provider.id,
            name: provider.name_ar || provider.name_en || business.name,
            nameAr: provider.name_ar, nameEn: provider.name_en,
            kind: provider.provider_kind, description: provider.description,
            slug: provider.slug, status: provider.status,
            verified: Boolean(provider.is_verified), featured: Boolean(provider.is_featured),
          } : null,
          branches: [], selectedBranchId: "",
          items: [], prices: [], options: [], warehouses: [], stockBalances: [],
          paymentsEnabled: false, catalogReadiness: "BRANCH_REQUIRED",
          message: "النشاط موجود، لكن لا يوجد فرع نشط. يلزم إعداد فرع قبل إدارة المنتجات والأسعار.",
        });
      }
      const chosenBranch = branchId || String(branches[0].id);
      if (!branches.some((b: any) => String(b.id) === chosenBranch)) {
        return out(origin, { error: "BRANCH_SCOPE_FORBIDDEN" }, 403);
      }
      const [{ data: provider, error: providerError }, { data: items, error: itemsError }] = await Promise.all([
        service.from("marketing_provider_profiles")
          .select("id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured")
          .eq("business_id", businessId).eq("status", "ACTIVE")
          .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        service.from("catalog_items")
          .select("id,tenant_id,business_id,branch_id,legacy_ref,item_type,name_ar,name_en,description,sku,status,tax_rate,metadata,updated_at")
          .eq("tenant_id", tenantId).eq("business_id", businessId)
          .or(`branch_id.is.null,branch_id.eq.${chosenBranch}`)
          .order("name_ar", { ascending: true }).limit(150),
      ]);
      if (providerError) throw providerError;
      if (itemsError) throw itemsError;
      const itemIds = (items || []).map((item: any) => item.id);
      let prices: any[] = [], options: any[] = [];
      if (itemIds.length) {
        const now = new Date().toISOString();
        const priceQuery = () => service.from("catalog_item_prices")
          .select("id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to")
          .eq("tenant_id", tenantId).in("catalog_item_id", itemIds).eq("status", "ACTIVE")
          .lte("effective_from", now).or(`effective_to.is.null,effective_to.gte.${now}`)
          .order("version", { ascending: false });
        const [globalPriceRes, branchPriceRes, optionRes] = await Promise.all([
          priceQuery().is("branch_id", null),
          priceQuery().eq("branch_id", chosenBranch),
          service.from("catalog_item_options")
            .select("id,catalog_item_id,name_ar,name_en,price_delta,status,metadata")
            .eq("tenant_id", tenantId).in("catalog_item_id", itemIds).eq("status", "ACTIVE")
            .order("name_ar", { ascending: true }),
        ]);
        if (globalPriceRes.error || branchPriceRes.error || optionRes.error) {
          throw globalPriceRes.error || branchPriceRes.error || optionRes.error;
        }
        prices = [...(globalPriceRes.data || []), ...(branchPriceRes.data || [])];
        options = optionRes.data || [];
      }
      let warehouseQuery = service.from("warehouses")
        .select("id,branch_id,name,code,status")
        .eq("tenant_id", tenantId)
        .eq("business_id", businessId)
        .eq("status", "ACTIVE")
        .order("name", { ascending: true })
        .limit(100);
      if (branchOnlyMemberships.length && !hasBusinessWideMembership && !scopedPlatformMembership) {
        warehouseQuery = warehouseQuery.eq("branch_id", chosenBranch);
      } else {
        warehouseQuery = warehouseQuery.or(`branch_id.is.null,branch_id.eq.${chosenBranch}`);
      }
      const { data: warehouseRows, error: warehouseError } = await warehouseQuery;
      if (warehouseError) throw warehouseError;
      const warehouses = warehouseRows || [];
      const warehouseIds = warehouses.map((warehouse: any) => String(warehouse.id));
      let stockBalances: any[] = [];
      if (itemIds.length && warehouseIds.length) {
        const { data: balances, error: balancesError } = await service.from("stock_balances")
          .select("id,branch_id,warehouse_id,product_id,quantity_on_hand,quantity_reserved")
          .eq("tenant_id", tenantId)
          .eq("business_id", businessId)
          .in("warehouse_id", warehouseIds)
          .in("product_id", itemIds);
        if (balancesError) throw balancesError;
        stockBalances = balances || [];
      }
      const profile = business.settings?.catalog_profile || {};
      return out(origin, {
        business: {
          id: business.id, tenantId: business.tenant_id, organizationId: business.organization_id,
          name: provider?.name_ar || provider?.name_en || business.name,
          code: business.code, status: business.status,
          profile: {
            bio: String(profile.bio || provider?.description || ""),
            governorate: String(profile.governorate || ""),
            markaz: String(profile.markaz || ""),
            village: String(profile.village || ""),
            workingHours: String(profile.working_hours || ""),
            logoUrl: String(profile.logo_url || ""),
            coverUrl: String(profile.cover_url || ""),
            google_maps_url: String(profile.google_maps_url || ""),
            publicEnabled: business.settings?.catalog_public_enabled === true,
          },
          bizcatalog: business.settings?.bizcatalog && typeof business.settings.bizcatalog === "object"
            ? business.settings.bizcatalog
            : {},
        },
        provider: provider ? {
          id: provider.id,
          name: provider.name_ar || provider.name_en || business.name,
          nameAr: provider.name_ar, nameEn: provider.name_en,
          kind: provider.provider_kind, description: provider.description,
          slug: provider.slug, status: provider.status,
          verified: Boolean(provider.is_verified), featured: Boolean(provider.is_featured),
        } : null,
        branches: branches.map((branch: any) => ({
          id: branch.id, name: branch.name, code: branch.code,
          phone: branch.phone, address: branch.address,
        })),
        selectedBranchId: chosenBranch,
        items: items || [], prices, options,
        warehouses: warehouses.map((warehouse: any) => ({
          id: warehouse.id, branchId: warehouse.branch_id,
          name: warehouse.name, code: warehouse.code,
        })),
        stockBalances,
        paymentsEnabled: false,
      });
    }

    if (action === "BUSINESS_PROFILE_UPSERT") {
      const roleForBusiness = businessMemberships.find((m: any) =>
        ["OWNER", "BUSINESS_OWNER", "ADMIN"].includes(String(m.role).toUpperCase())
      );
      if (!roleForBusiness && !scopedPlatformMembership) {
        return out(origin, { error: "CATALOG_PROFILE_WRITE_FORBIDDEN" }, 403);
      }
      const { data, error } = await userClient.rpc("upsert_catalog_business_profile_backend", {
        p_tenant_id: tenantId,
        p_business_id: businessId,
        p_branch_id: branchId,
        p_name: String(body.name || ""),
        p_bio: String(body.bio || ""),
        p_phone: String(body.phone || ""),
        p_address: String(body.address || ""),
        p_governorate: String(body.governorate || ""),
        p_markaz: String(body.markaz || ""),
        p_village: String(body.village || ""),
        p_working_hours: String(body.workingHours || ""),
        p_logo_url: String(body.logoUrl || ""),
        p_cover_url: String(body.coverUrl || ""),
        p_public_enabled: body.publicEnabled === true,
      });
      if (error) throw error;
      return out(origin, data);
    }

    if (action === "ITEM_PRICE_UPSERT") {
      const { data, error } = await userClient.rpc("upsert_catalog_item_and_price_backend", {
        p_tenant_id: tenantId, p_business_id: businessId,
        p_item_branch_id: Object.prototype.hasOwnProperty.call(body, "itemBranchId") ? body.itemBranchId : branchId,
        p_price_branch_id: Object.prototype.hasOwnProperty.call(body, "priceBranchId") ? body.priceBranchId : branchId,
        p_legacy_ref: body.legacyRef ?? null,
        p_item_type: body.itemType ?? "PRODUCT",
        p_name_ar: String(body.nameAr || ""),
        p_name_en: body.nameEn ?? null,
        p_description: body.description ?? null,
        p_sku: body.sku ?? null,
        p_tax_rate: Number(body.taxRate ?? 0),
        p_metadata: catalogMetadataWithImage(body.metadata, String(body.nameAr || ""), String(body.description || ""), String(body.itemType || "PRODUCT")),
        p_id: body.id ?? null,
        p_currency: body.currency ?? "EGP",
        p_unit_price: Number(body.unitPrice),
        p_effective_from: body.effectiveFrom ?? new Date().toISOString(),
        p_effective_to: body.effectiveTo ?? null,
      });
      if (error) throw error;
      return out(origin, data);
    }

    if (action === "ITEM_STATUS_UPDATE") {
      const { data, error } = await userClient.rpc("update_catalog_item_status_backend", {
        p_tenant_id: tenantId, p_business_id: businessId,
        p_catalog_item_id: body.catalogItemId,
        p_branch_id: branchId,
        p_status: body.status,
      });
      if (error) throw error;
      return out(origin, data);
    }

    if (action === "WAREHOUSE_CREATE") {
      if (!branchId || !safeBranch(branchId)) return out(origin, { error: "BRANCH_REQUIRED" }, 400);
      const name = String(body.name || "").trim();
      const code = String(body.code || "").trim();
      if (name.length < 2 || name.length > 160) return out(origin, { error: "INVALID_WAREHOUSE_NAME" }, 400);
      if (!/^[A-Za-z0-9_-]{2,40}$/.test(code)) return out(origin, { error: "INVALID_WAREHOUSE_CODE" }, 400);
      const { data, error } = await userClient.rpc("create_catalog_warehouse_backend", {
        p_tenant_id: tenantId,
        p_business_id: businessId,
        p_branch_id: branchId,
        p_name: name,
        p_code: code,
      });
      if (error) throw error;
      return out(origin, data);
    }

    if (action === "STOCK_ADJUST") {
      if (!isUuid(body.catalogItemId)) return out(origin, { error: "INVALID_CATALOG_ITEM_ID" }, 400);
      if (!branchId || !safeBranch(branchId)) return out(origin, { error: "BRANCH_REQUIRED" }, 400);
      if (!safeBranch(body.warehouseId)) return out(origin, { error: "INVALID_WAREHOUSE_ID" }, 400);
      const requestId = String(body.requestId || "");
      const reason = String(body.reason || "");
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) return out(origin, { error: "INVALID_STOCK_REQUEST_ID" }, 400);
      if (reason.trim().length < 3 || reason.length > 300) return out(origin, { error: "INVALID_STOCK_REASON" }, 400);
      const { data, error } = await userClient.rpc("adjust_catalog_stock_backend", {
        p_tenant_id: tenantId,
        p_business_id: businessId,
        p_branch_id: branchId,
        p_warehouse_id: String(body.warehouseId),
        p_catalog_item_id: body.catalogItemId,
        p_target_quantity: Number(body.targetQuantity),
        p_unit_cost: Number(body.unitCost ?? 0),
        p_request_id: requestId,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      return out(origin, data);
    }

    if (action === "ITEM_UPSERT") {
      const { data, error } = await userClient.rpc("upsert_catalog_item_backend", {
        p_tenant_id: tenantId, p_business_id: businessId, p_branch_id: branchId,
        p_legacy_ref: body.legacyRef ?? null, p_item_type: body.itemType ?? "PRODUCT",
        p_name_ar: String(body.nameAr || ""), p_name_en: body.nameEn ?? null,
        p_description: body.description ?? null, p_sku: body.sku ?? null,
        p_tax_rate: Number(body.taxRate ?? 0), p_metadata: catalogMetadataWithImage(body.metadata, String(body.nameAr || ""), String(body.description || ""), String(body.itemType || "PRODUCT")),
        p_id: body.id ?? null,
      });
      if (error) throw error;
      return out(origin, data);
    }

    if (action === "PRICE_UPSERT") {
      const { data, error } = await userClient.rpc("upsert_catalog_price_backend", {
        p_tenant_id: tenantId, p_business_id: businessId,
        p_catalog_item_id: body.catalogItemId, p_branch_id: branchId,
        p_currency: body.currency ?? "EGP", p_unit_price: Number(body.unitPrice),
        p_effective_from: body.effectiveFrom ?? new Date().toISOString(),
        p_effective_to: body.effectiveTo ?? null,
      });
      if (error) throw error;
      return out(origin, data);
    }

    if (action === "SETTINGS_UPSERT") {
      const { data, error } = await userClient.rpc("upsert_catalog_settings_backend", {
        p_tenant_id: tenantId, p_business_id: businessId,
        p_currency: String(body.currency ?? "EGP").toUpperCase(),
        p_delivery_fee: Number(body.deliveryFee ?? 0),
        p_tax_inclusive: Boolean(body.taxInclusive ?? false),
        p_allow_discounts: Boolean(body.allowDiscounts ?? false),
      });
      if (error) throw error;
      return out(origin, data);
    }

    return out(origin, { error: "UNSUPPORTED_ACTION" }, 400);
  } catch (error) {
    console.error("catalog-admin failed", error instanceof Error ? error.message : "UNKNOWN");
    return out(origin, { error: error instanceof Error ? error.message : "CATALOG_OPERATION_FAILED" }, 400);
  }
});
