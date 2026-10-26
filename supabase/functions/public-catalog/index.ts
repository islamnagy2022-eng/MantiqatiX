import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const corsHeaders = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin)
    ? origin
    : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(req.headers.get("Origin")),
  });
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const safeBranchId = (value: string) =>
  value.length >= 1 && value.length <= 80 && /^[a-z0-9_-]+$/i.test(value);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  if (req.method !== "GET") return json(req, { error: "METHOD_NOT_ALLOWED" }, 405);

  const url = new URL(req.url);
  const businessId = (url.searchParams.get("businessId") || url.searchParams.get("business") || "").trim();
  const requestedBranchId = (url.searchParams.get("branchId") || "").trim();
  if (!isUuid(businessId)) return json(req, { error: "INVALID_BUSINESS_ID" }, 400);
  if (requestedBranchId && !safeBranchId(requestedBranchId)) return json(req, { error: "INVALID_BRANCH_ID" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json(req, { error: "SERVER_MISCONFIGURED" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: business, error: businessError } = await admin
      .from("businesses")
      .select("id,tenant_id,name,code,status,settings")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) throw businessError;
    if (!business || String(business.status || "").toUpperCase() !== "ACTIVE") {
      return json(req, { error: "BUSINESS_NOT_PUBLIC" }, 404);
    }

    const { data: provider, error: providerError } = await admin
      .from("marketing_provider_profiles")
      .select("business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured")
      .eq("business_id", businessId)
      .eq("status", "ACTIVE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (providerError) throw providerError;
    if (!provider) return json(req, { error: "CATALOG_NOT_PUBLIC" }, 404);

    const tenantId = String(business.tenant_id || "");
    if (!tenantId) return json(req, { error: "BUSINESS_TENANT_MISSING" }, 500);

    const { data: branches, error: branchesError } = await admin
      .from("branches")
      .select("id,name,code,status,address,phone")
      .eq("tenant_id", tenantId)
      .eq("business_id", businessId)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true })
      .limit(100);

    if (branchesError) throw branchesError;
    if (!branches?.length) return json(req, { error: "NO_ACTIVE_BRANCH" }, 404);

    const branchId = requestedBranchId || String(branches[0].id);
    const selectedBranch = branches.find((branch) => String(branch.id) === branchId);
    if (!selectedBranch) return json(req, { error: "BRANCH_NOT_PUBLIC" }, 404);

    const { data: items, error: itemError } = await admin
      .from("catalog_items")
      .select("id,business_id,branch_id,item_type,name_ar,name_en,description,status")
      .eq("tenant_id", tenantId)
      .eq("business_id", businessId)
      .eq("status", "ACTIVE")
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)
      .order("name_ar", { ascending: true })
      .limit(100);

    if (itemError) throw itemError;

    const itemIds = (items || []).map((item) => item.id);
    let prices: Record<string, unknown>[] = [];
    let options: Record<string, unknown>[] = [];
    if (itemIds.length) {
      const now = new Date().toISOString();
      const [priceResult, optionResult] = await Promise.all([
        admin.from("catalog_item_prices")
          .select("id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to")
          .eq("tenant_id", tenantId)
          .in("catalog_item_id", itemIds)
          .eq("status", "ACTIVE")
          .lte("effective_from", now)
          .or(`effective_to.is.null,effective_to.gte.${now}`)
          .order("version", { ascending: false }),
        admin.from("catalog_item_options")
          .select("id,catalog_item_id,name_ar,name_en,price_delta,status")
          .eq("tenant_id", tenantId)
          .in("catalog_item_id", itemIds)
          .eq("status", "ACTIVE")
          .order("name_ar", { ascending: true }),
      ]);
      if (priceResult.error || optionResult.error) throw priceResult.error || optionResult.error;
      prices = priceResult.data || [];
      options = optionResult.data || [];
    }

    return json(req, {
      business: { id: business.id, name: business.name, code: business.code },
      provider: {
        name: provider.name_ar || provider.name_en || business.name,
        nameAr: provider.name_ar,
        nameEn: provider.name_en,
        kind: provider.provider_kind,
        description: provider.description,
        slug: provider.slug,
        verified: Boolean(provider.is_verified),
        featured: Boolean(provider.is_featured),
      },
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        code: branch.code,
        address: branch.address,
        phone: branch.phone,
      })),
      selectedBranchId: branchId,
      items: items || [],
      prices,
      options,
      paymentsEnabled: false,
      accessMode: "PUBLIC_READ_ONLY",
    });
  } catch (error) {
    console.error("public catalog read failed", error instanceof Error ? error.message : "UNKNOWN");
    return json(req, { error: "PUBLIC_CATALOG_UNAVAILABLE" }, 500);
  }
});
