import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    if (origin && origin !== allowedOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (origin && origin !== allowedOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "SERVER_MISCONFIGURED" }, 500);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user || user.is_anonymous) return json({ error: "UNAUTHORIZED" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }

  const required = ["orderId", "tenantId", "businessId", "clientIdempotencyKey", "currency", "customerName", "customerPhone", "deliveryAddress", "items"];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null) return json({ error: "MISSING_FIELD", field: key }, 400);
  }

  if (!String(body.orderId).match(/^[0-9a-f-]{36}$/i)) return json({ error: "INVALID_ORDER_ID" }, 400);
  if (!String(body.clientIdempotencyKey).trim() || String(body.clientIdempotencyKey).length > 200) return json({ error: "INVALID_IDEMPOTENCY_KEY" }, 400);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) return json({ error: "INVALID_ITEMS" }, 400);
  if (!["EGP"].includes(String(body.currency).toUpperCase())) return json({ error: "UNSUPPORTED_CURRENCY" }, 400);

  const { data: membership, error: membershipError } = await admin
    .from("user_memberships")
    .select("id,role,status")
    .eq("user_id", user.id)
    .eq("tenant_id", body.tenantId)
    .eq("business_id", body.businessId)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) return json({ error: "FORBIDDEN" }, 403);

  const { data: business, error: businessError } = await admin
    .from("businesses")
    .select("id,status")
    .eq("id", body.businessId)
    .eq("tenant_id", body.tenantId)
    .single();
  if (businessError || !business || String(business.status).toUpperCase() !== "ACTIVE") {
    return json({ error: "BUSINESS_NOT_AVAILABLE" }, 409);
  }

  const normalizedItems = body.items.map((raw: any) => ({
    catalogItemId: String(raw?.catalogItemId ?? ""),
    quantity: Number(raw?.quantity),
    selectedOptionIds: Array.isArray(raw?.selectedOptionIds)
      ? raw.selectedOptionIds.map((x: unknown) => String(x))
      : Array.isArray(raw?.options)
        ? raw.options.map((x: any) => String(x?.id ?? x))
        : [],
  }));

  if (normalizedItems.some((x: any) => !x.catalogItemId || !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 1000)) {
    return json({ error: "INVALID_ITEM_QUANTITY" }, 400);
  }

  const itemIds = [...new Set(normalizedItems.map((x: any) => x.catalogItemId))];
  const { data: catalogItems, error: itemError } = await admin
    .from("catalog_items")
    .select("id,business_id,branch_id,name_ar,name_en,tax_rate,status")
    .eq("tenant_id", body.tenantId)
    .eq("business_id", body.businessId)
    .in("id", itemIds)
    .eq("status", "ACTIVE");
  if (itemError) return json({ error: "CATALOG_READ_FAILED" }, 500);

  const branchId = body.branchId ? String(body.branchId) : null;
  const itemMap = new Map((catalogItems ?? [])
    .filter((x: any) => !branchId || !x.branch_id || String(x.branch_id) === branchId)
    .map((x: any) => [String(x.id), x]));
  if (itemMap.size !== itemIds.length) return json({ error: "CATALOG_ITEM_NOT_AVAILABLE" }, 409);

  const nowIso = new Date().toISOString();
  const { data: priceRows, error: priceError } = await admin
    .from("catalog_item_prices")
    .select("catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to")
    .eq("tenant_id", body.tenantId)
    .in("catalog_item_id", itemIds)
    .eq("status", "ACTIVE")
    .eq("currency", String(body.currency).toUpperCase())
    .lte("effective_from", nowIso)
    .or("effective_to.is.null,effective_to.gte." + nowIso);
  if (priceError) return json({ error: "PRICING_READ_FAILED" }, 500);

  const priceMap = new Map<string, any>();
  for (const row of priceRows ?? []) {
    if (branchId && row.branch_id && String(row.branch_id) !== branchId) continue;
    const key = String(row.catalog_item_id);
    const existing = priceMap.get(key);
    const score = (row.branch_id ? 1000000 : 0) + Number(row.version ?? 0);
    const oldScore = existing ? (existing.branch_id ? 1000000 : 0) + Number(existing.version ?? 0) : -1;
    if (score > oldScore) priceMap.set(key, row);
  }
  if (priceMap.size !== itemIds.length) return json({ error: "ACTIVE_PRICE_NOT_AVAILABLE" }, 409);

  const optionIds = [...new Set(normalizedItems.flatMap((x: any) => x.selectedOptionIds))];
  const optionMap = new Map<string, any>();
  if (optionIds.length) {
    const { data: options, error: optionsError } = await admin
      .from("catalog_item_options")
      .select("id,catalog_item_id,price_delta,status")
      .eq("tenant_id", body.tenantId)
      .in("id", optionIds)
      .eq("status", "ACTIVE");
    if (optionsError) return json({ error: "OPTION_READ_FAILED" }, 500);
    for (const option of options ?? []) optionMap.set(String(option.id), option);
    if (optionMap.size !== optionIds.length) return json({ error: "OPTION_NOT_AVAILABLE" }, 409);
  }

  let subtotal = 0;
  let tax = 0;
  const authoritativeItems = normalizedItems.map((item: any) => {
    const catalog = itemMap.get(item.catalogItemId);
    const price = priceMap.get(item.catalogItemId);
    const optionRows = item.selectedOptionIds.map((id: string) => optionMap.get(id)).filter(Boolean);
    if (optionRows.some((x: any) => String(x.catalog_item_id) !== item.catalogItemId)) throw new Error("OPTION_ITEM_MISMATCH");
    const optionDelta = optionRows.reduce((sum: number, x: any) => sum + Number(x.price_delta ?? 0), 0);
    const unitPrice = Number(price.unit_price) + optionDelta;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("INVALID_SERVER_PRICE");
    const lineSubtotal = unitPrice * item.quantity;
    const taxRate = Number(catalog.tax_rate ?? 0);
    const lineTax = lineSubtotal * (Number.isFinite(taxRate) && taxRate > 0 ? taxRate / 100 : 0);
    subtotal += lineSubtotal;
    tax += lineTax;
    return {
      catalogItemId: item.catalogItemId,
      quantity: item.quantity,
      selectedOptionIds: item.selectedOptionIds,
      unitPrice,
      lineSubtotal,
      taxRate,
      lineTax,
    };
  });

  if (!Number.isFinite(subtotal) || !Number.isFinite(tax)) return json({ error: "INVALID_SERVER_TOTAL" }, 500);
  const totalAmount = subtotal + tax;

  const { data, error } = await admin.rpc("create_order_backend", {
    p_order_id: body.orderId,
    p_tenant_id: body.tenantId,
    p_business_id: body.businessId,
    p_branch_id: branchId,
    p_customer_id: user.id,
    p_client_idempotency_key: String(body.clientIdempotencyKey),
    p_subtotal: subtotal,
    p_discount: 0,
    p_tax: tax,
    p_delivery_fee: 0,
    p_total_amount: totalAmount,
    p_currency: String(body.currency).toUpperCase(),
    p_customer_name: String(body.customerName).trim(),
    p_customer_phone: String(body.customerPhone).trim(),
    p_delivery_address: String(body.deliveryAddress).trim(),
    p_items_json: authoritativeItems,
    p_notes: body.notes ?? null,
    p_metadata: {
      ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
      pricing_server_authoritative: true,
      pricing_authority: "catalog_v1",
      calculated_at: nowIso,
    },
  });

  if (error) return json({ error: error.message || "ORDER_CREATE_FAILED" }, 400);
  return json(data);
});
