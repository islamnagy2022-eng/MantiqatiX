import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);
const headers = (origin: string | null) => ({
  ...(origin && allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
});
const reply = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: headers(origin) });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) return reply({ error: "ORIGIN_NOT_ALLOWED" }, 403, origin);
    return new Response("ok", { status: 200, headers: headers(origin) });
  }
  if (origin && !allowedOrigins.has(origin)) return reply({ error: "ORIGIN_NOT_ALLOWED" }, 403, origin);
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405, origin);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "INVALID_BODY" }, 400, origin);
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: "INVALID_JSON" }, 400, origin);
  }
  const businessId = String(body.businessId || "");
  const requestedBranchId = body.branchId == null ? "" : String(body.branchId);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId)) return reply({ error: "INVALID_BUSINESS_ID" }, 400, origin);
  if (requestedBranchId && !/^[0-9a-f-]{36}$/i.test(requestedBranchId)) return reply({ error: "INVALID_BRANCH_ID" }, 400, origin);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return reply({ error: "SERVER_MISCONFIGURED" }, 500, origin);
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: business, error: businessError } = await admin.from("businesses")
    .select("id,tenant_id,name,status,settings")
    .eq("id", businessId).eq("tenant_id", "MNTY-PLATFORM").eq("status", "ACTIVE").maybeSingle();
  if (businessError) return reply({ error: "PUBLIC_CATALOG_LOOKUP_FAILED" }, 500, origin);
  const sectorCode = String(business?.settings?.sector_code || "").toUpperCase();
  if (!business || business.settings?.environment !== "DEMO" || !["FOOD", "PHARMACY", "DOCTOR", "STORE"].includes(sectorCode)) {
    return reply({ error: "DEMO_BUSINESS_NOT_FOUND" }, 404, origin);
  }

  let branchQuery = admin.from("branches")
    .select("id,name,phone,address,status,settings,created_at")
    .eq("business_id", businessId).eq("tenant_id", "MNTY-PLATFORM").eq("status", "ACTIVE")
    .order("created_at", { ascending: true }).limit(50);
  if (requestedBranchId) branchQuery = branchQuery.eq("id", requestedBranchId);
  const { data: branches, error: branchError } = await branchQuery;
  if (branchError) return reply({ error: "PUBLIC_CATALOG_BRANCH_LOOKUP_FAILED" }, 500, origin);
  const branch = (branches || []).find((row: any) => row.settings?.environment === "DEMO");
  if (!branch) return reply({ error: "DEMO_BRANCH_NOT_FOUND" }, 404, origin);

  const { data: rawItems, error: itemsError } = await admin.from("catalog_items")
    .select("id,name_ar,description,item_type,branch_id,metadata,status,created_at")
    .eq("tenant_id", "MNTY-PLATFORM").eq("business_id", businessId).eq("status", "ACTIVE")
    .order("created_at", { ascending: false }).limit(500);
  if (itemsError) return reply({ error: "PUBLIC_CATALOG_ITEMS_FAILED" }, 500, origin);
  const items = (rawItems || []).filter((item: any) =>
    item.branch_id === branch.id && item.metadata?.environment === "DEMO" && item.metadata?.synthetic_only === true
  );
  const itemIds = items.map((item: any) => item.id);
  let rawPrices: any[] = [];
  if (itemIds.length) {
    const { data: prices, error: pricesError } = await admin.from("catalog_item_prices")
      .select("catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to")
      .eq("tenant_id", "MNTY-PLATFORM").eq("status", "ACTIVE").in("catalog_item_id", itemIds)
      .lte("effective_from", new Date().toISOString()).limit(1000);
    if (pricesError) return reply({ error: "PUBLIC_CATALOG_PRICES_FAILED" }, 500, origin);
    rawPrices = prices || [];
  }
  const now = Date.now();
  const publicItems = items.map((item: any) => {
    const candidates = rawPrices.filter((price: any) =>
      price.catalog_item_id === item.id && (!price.branch_id || price.branch_id === branch.id) &&
      (!price.effective_to || new Date(price.effective_to).getTime() > now)
    ).sort((a: any, b: any) => Number(b.branch_id === branch.id) - Number(a.branch_id === branch.id) || Number(b.version || 0) - Number(a.version || 0));
    const price = candidates[0] || null;
    return { id: item.id, name: String(item.name_ar || ""), description: String(item.description || ""),
      itemType: String(item.item_type || "PRODUCT").toUpperCase(), stock: Number(item.metadata?.demo_stock ?? 0),
      price: price ? Number(price.unit_price) : null, currency: price?.currency || "EGP" };
  });

  // Public whitelist only: never return memberships, emails, orders, appointments,
  // internal provider IDs, raw settings, or Auth data.
  return reply({
    ok: true,
    environment: "DEMO",
    business: {
      id: business.id, name: String(business.name || ""), sectorCode,
      description: String(business.settings?.description || ""),
      phone: String(business.settings?.phone || branch.phone || ""), city: String(business.settings?.city || ""),
    },
    branch: { id: branch.id, name: String(branch.name || ""), phone: String(branch.phone || ""), address: String(branch.address || "") },
    items: publicItems,
    paymentsEnabled: false,
  }, 200, origin);
});