import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);
const headersFor = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
});
const response = (origin: string | null, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const safeImageUrl = (value: unknown) => {
  const candidate = String(value || "").trim();
  return candidate.length <= 1500 && /^https:\/\//i.test(candidate) ? candidate : "";
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return response(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: headersFor(origin) });
  if (req.method !== "GET") return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);

  const url = new URL(req.url);
  const businessId = (url.searchParams.get("businessId") || url.searchParams.get("business") || "").trim();
  const requestedBranchId = (url.searchParams.get("branchId") || "").trim();
  if (!isUuid(businessId)) return response(origin, { error: "INVALID_BUSINESS_ID" }, 400);
  if (requestedBranchId && (requestedBranchId.length > 80 || !/^[a-z0-9_-]+$/i.test(requestedBranchId))) {
    return response(origin, { error: "INVALID_BRANCH_ID" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return response(origin, { error: "SERVER_MISCONFIGURED" }, 500);
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: business, error: businessError } = await db.from("businesses")
      .select("id,tenant_id,name,code,status,settings")
      .eq("id", businessId)
      .maybeSingle();
    if (businessError) throw businessError;
    if (!business || String(business.status || "").toUpperCase() !== "ACTIVE") {
      return response(origin, { error: "BUSINESS_NOT_PUBLIC" }, 404);
    }
    if (business.settings?.catalog_public_enabled !== true) {
      return response(origin, { error: "CATALOG_NOT_PUBLISHED" }, 404);
    }

    const { data: provider, error: providerError } = await db.from("marketing_provider_profiles")
      .select("business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured")
      .eq("business_id", businessId)
      .eq("status", "ACTIVE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (providerError) throw providerError;
    if (!provider) return response(origin, { error: "CATALOG_NOT_PUBLIC" }, 404);

    const tenantId = String(business.tenant_id || "");
    if (!tenantId) return response(origin, { error: "BUSINESS_TENANT_MISSING" }, 500);
    const { data: branches, error: branchError } = await db.from("branches")
      .select("id,name,code,status,address,phone")
      .eq("tenant_id", tenantId)
      .eq("business_id", businessId)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true })
      .limit(100);
    if (branchError) throw branchError;
    if (!branches?.length) return response(origin, { error: "NO_ACTIVE_BRANCH" }, 404);
    const selectedBranch = requestedBranchId
      ? branches.find((branch: any) => String(branch.id) === requestedBranchId)
      : branches[0];
    if (!selectedBranch) return response(origin, { error: "BRANCH_NOT_PUBLIC" }, 404);
    const branchId = String(selectedBranch.id);
    const now = new Date().toISOString();
    const { data: rawItems, error: itemError } = await db.from("catalog_items")
      .select("id,branch_id,item_type,name_ar,name_en,description,status,metadata")
      .eq("tenant_id", tenantId)
      .eq("business_id", businessId)
      .eq("status", "ACTIVE")
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)
      .order("name_ar", { ascending: true })
      .limit(150);
    if (itemError) throw itemError;

    const itemIds = (rawItems || []).map((item: any) => item.id);
    let prices: any[] = [], options: any[] = [];
    if (itemIds.length) {
      const [priceResult, optionResult] = await Promise.all([
        db.from("catalog_item_prices")
          .select("id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to")
          .eq("tenant_id", tenantId).in("catalog_item_id", itemIds).eq("status", "ACTIVE")
          .lte("effective_from", now).or(`effective_to.is.null,effective_to.gte.${now}`)
          .order("version", { ascending: false }),
        db.from("catalog_item_options")
          .select("id,catalog_item_id,name_ar,name_en,price_delta,status")
          .eq("tenant_id", tenantId).in("catalog_item_id", itemIds).eq("status", "ACTIVE")
          .order("name_ar", { ascending: true }),
      ]);
      if (priceResult.error || optionResult.error) throw priceResult.error || optionResult.error;
      prices = priceResult.data || [];
      options = optionResult.data || [];
    }

    const items = (rawItems || []).map((item: any) => {
      const meta = item.metadata?.catalog_public || {};
      const comparePrice = Number(meta.compare_price);
      return {
        id: item.id,
        branchId: item.branch_id,
        type: String(item.item_type || "").toUpperCase() === "SERVICE" ? "SERVICE" : "PRODUCT",
        nameAr: item.name_ar,
        nameEn: item.name_en,
        description: item.description || "",
        category: String(meta.category || "عام").slice(0, 100),
        unit: String(meta.unit || "").slice(0, 40),
        imageUrl: safeImageUrl(meta.image_url),
        comparePrice: Number.isFinite(comparePrice) && comparePrice >= 0 ? comparePrice : null,
        available: meta.is_available !== false,
      };
    });
    const profile = business.settings?.catalog_profile || {};
    const selectedBranchPhone = String(selectedBranch.phone || "");
    return response(origin, {
      business: { id: business.id, name: business.name, code: business.code },
      provider: {
        name: provider.name_ar || provider.name_en || business.name,
        nameAr: provider.name_ar,
        nameEn: provider.name_en,
        kind: provider.provider_kind,
        description: provider.description || profile.bio || "",
        slug: provider.slug,
        verified: Boolean(provider.is_verified),
        featured: Boolean(provider.is_featured),
      },
      profile: {
        bio: String(profile.bio || provider.description || ""),
        governorate: String(profile.governorate || ""),
        markaz: String(profile.markaz || ""),
        village: String(profile.village || ""),
        workingHours: String(profile.working_hours || ""),
        logoUrl: safeImageUrl(profile.logo_url),
        coverUrl: safeImageUrl(profile.cover_url),
        category: String(profile.category || provider.provider_kind || "").slice(0, 100),
      },
      branches: branches.map((branch: any) => ({
        id: branch.id,
        name: branch.name,
        code: branch.code,
        address: branch.address,
        phone: branch.phone,
      })),
      selectedBranchId: branchId,
      items,
      prices,
      options: options.map((option: any) => ({
        id: option.id, catalogItemId: option.catalog_item_id,
        nameAr: option.name_ar, nameEn: option.name_en,
        priceDelta: option.price_delta,
      })),
      contactPhone: selectedBranchPhone,
      paymentsEnabled: false,
      accessMode: "PUBLIC_READ_ONLY",
    });
  } catch (error) {
    console.error("public catalog read failed", error instanceof Error ? error.message : "UNKNOWN");
    return response(origin, { error: "PUBLIC_CATALOG_UNAVAILABLE" }, 500);
  }
});
