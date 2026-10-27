import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveDefaultActivityImages } from "../_shared/default-images.ts";

const allowedOrigins = new Set(["https://islamnagy2022-eng.github.io", "http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:3000", "http://127.0.0.1:8080"]);
const headersFor = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store",
});
const response = (origin: string | null, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
const safeImage = (value: unknown) => { const s = String(value || "").trim(); return s.length <= 1500 && /^https:\/\//i.test(s) ? s : ""; };

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
    // Public discovery is available to guests regardless of subscription/catalog publication.
    // Only ACTIVE businesses in non-test tenants are listed. Product/price details remain
    // hidden unless the business explicitly publishes its catalog.
    const activeBusinesses = businesses || [];
    if (!activeBusinesses.length) return response(origin, { businesses: [], accessMode: "PUBLIC_DIRECTORY_READ_ONLY" });
    const ids = activeBusinesses.map((b: any) => b.id);
    const { data: providers, error: providerError } = await db.from("marketing_provider_profiles")
      .select("business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured")
      .in("business_id", ids).eq("status", "ACTIVE").limit(250);
    if (providerError) throw providerError;
    const providerMap = new Map((providers || []).map((p: any) => [String(p.business_id), p]));
    const results: any[] = [];
    for (const business of activeBusinesses.slice(0, 100)) {
      const tenantId = String(business.tenant_id || "");
      const { data: branches, error: branchError } = await db.from("branches")
        .select("id,name,code,status,address,phone").eq("tenant_id", tenantId).eq("business_id", business.id).eq("status", "ACTIVE").order("name").limit(100);
      if (branchError) throw branchError;
      const branch = branches?.[0] || null;
      const branchId = branch ? String(branch.id) : "";
      const provider: any = providerMap.get(String(business.id)) || null;
      const catalogPublished = business.settings?.catalog_public_enabled === true && Boolean(branch);
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
