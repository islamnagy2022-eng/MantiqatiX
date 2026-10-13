import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const maxBodyBytes = 64 * 1024;
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

  const contentLength = Number(req.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);

  let body: any;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "INVALID_BODY" }, 400);
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const required = ["orderId", "tenantId", "businessId", "clientIdempotencyKey", "currency", "customerName", "customerPhone", "deliveryAddress", "items"];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null) return json({ error: "MISSING_FIELD", field: key }, 400);
  }

  const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  if (!isUuid(body.orderId)) return json({ error: "INVALID_ORDER_ID" }, 400);
  const idempotencyKey = String(body.clientIdempotencyKey).trim();
  if (!idempotencyKey || idempotencyKey.length > 200) return json({ error: "INVALID_IDEMPOTENCY_KEY" }, 400);
  if (typeof body.tenantId !== "string" || !body.tenantId.trim() || body.tenantId.length > 120 || !isUuid(body.businessId)) {
    return json({ error: "INVALID_ORDER_SCOPE" }, 400);
  }
  if (body.branchId !== undefined && body.branchId !== null && (typeof body.branchId !== "string" || body.branchId.length > 120)) {
    return json({ error: "INVALID_BRANCH_ID" }, 400);
  }
  if (typeof body.customerName !== "string" || !body.customerName.trim() || body.customerName.trim().length > 200
      || typeof body.customerPhone !== "string" || !body.customerPhone.trim() || body.customerPhone.trim().length > 40
      || typeof body.deliveryAddress !== "string" || body.deliveryAddress.length > 1000) {
    return json({ error: "INVALID_CUSTOMER_DETAILS" }, 400);
  }
  if (body.notes !== undefined && body.notes !== null && (typeof body.notes !== "string" || body.notes.length > 2000)) {
    return json({ error: "INVALID_ORDER_NOTES" }, 400);
  }
  if (body.metadata !== undefined && body.metadata !== null && (typeof body.metadata !== "object" || Array.isArray(body.metadata))) {
    return json({ error: "INVALID_ORDER_METADATA" }, 400);
  }
  const fulfillmentType = String((body.metadata as Record<string, unknown> | null)?.fulfillmentType ?? "DELIVERY").toUpperCase();
  if (!["DELIVERY", "PICKUP", "DINE_IN"].includes(fulfillmentType)) return json({ error: "INVALID_FULFILLMENT_TYPE" }, 400);
  if (fulfillmentType === "DELIVERY" && !body.deliveryAddress.trim()) return json({ error: "DELIVERY_ADDRESS_REQUIRED" }, 400);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) return json({ error: "INVALID_ITEMS" }, 400);
  if (!["EGP"].includes(String(body.currency).toUpperCase())) return json({ error: "UNSUPPORTED_CURRENCY" }, 400);

  const requestedBranchId = typeof body.branchId === "string" && body.branchId.trim()
    ? body.branchId.trim()
    : null;
  const { data: targetMemberships, error: targetMembershipError } = await admin
    .from("user_memberships")
    .select("id,role,status,branch_id")
    .eq("user_id", user.id)
    .eq("tenant_id", body.tenantId)
    .eq("business_id", body.businessId)
    .eq("status", "ACTIVE")
    .limit(100);
  if (targetMembershipError) return json({ error: "MEMBERSHIP_READ_FAILED" }, 500);

  const targetMembership = (targetMemberships ?? []).find((membership: any) =>
    !membership.branch_id || (requestedBranchId && String(membership.branch_id) === requestedBranchId)
  );
  if (!targetMembership && (targetMemberships ?? []).length > 0) {
    return json({ error: "BRANCH_MEMBERSHIP_MISMATCH" }, 403);
  }

  if (!targetMembership) {
    const { data: customerMembership, error: customerMembershipError } = await admin
      .from("user_memberships")
      .select("id,role,status")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .eq("role", "CUSTOMER")
      .limit(1)
      .maybeSingle();
    if (customerMembershipError) return json({ error: "CUSTOMER_MEMBERSHIP_READ_FAILED" }, 500);
    if (!customerMembership) return json({ error: "FORBIDDEN" }, 403);
  }

  const { data: business, error: businessError } = await admin
    .from("businesses")
    .select("id,status")
    .eq("id", body.businessId)
    .eq("tenant_id", body.tenantId)
    .single();
  if (businessError || !business || String(business.status).toUpperCase() !== "ACTIVE") {
    return json({ error: "BUSINESS_NOT_AVAILABLE" }, 409);
  }

  const normalizedItems: Array<{ catalogItemId: string; quantity: number; selectedOptionIds: string[] }> = body.items.map((raw: any) => ({
    catalogItemId: String(raw?.catalogItemId ?? ""),
    quantity: Number(raw?.quantity),
    selectedOptionIds: Array.isArray(raw?.selectedOptionIds)
      ? raw.selectedOptionIds.map((x: unknown) => String(x))
      : Array.isArray(raw?.options)
        ? raw.options.map((x: any) => String(x?.id ?? x))
        : [],
  }));

  if (normalizedItems.some((x: any) => !isUuid(x.catalogItemId) || !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 1000)) {
    return json({ error: "INVALID_ITEM_QUANTITY" }, 400);
  }

  if (normalizedItems.some((item: any) => item.selectedOptionIds.some((id: string) => !isUuid(id)))) {
    return json({ error: "INVALID_ITEM_OPTION_ID" }, 400);
  }

  if (normalizedItems.some((item: any) => new Set(item.selectedOptionIds).size !== item.selectedOptionIds.length)) {
    return json({ error: "DUPLICATE_ITEM_OPTION" }, 400);
  }

  const itemIds: string[] = [...new Set<string>(normalizedItems.map((x: any) => String(x.catalogItemId)))];
  const { data: catalogItems, error: itemError } = await admin
    .from("catalog_items")
    .select("id,business_id,branch_id,name_ar,name_en,tax_rate,status")
    .eq("tenant_id", body.tenantId)
    .eq("business_id", body.businessId)
    .in("id", itemIds)
    .eq("status", "ACTIVE");
  if (itemError) return json({ error: "CATALOG_READ_FAILED" }, 500);

  const branchId = requestedBranchId;
  const { data: activeBranches, error: branchReadError } = await admin
    .from("branches")
    .select("id")
    .eq("tenant_id", body.tenantId)
    .eq("business_id", body.businessId)
    .eq("status", "ACTIVE")
    .limit(100);
  if (branchReadError) return json({ error: "BRANCH_READ_FAILED" }, 500);
  if ((activeBranches ?? []).length > 0 && !branchId) {
    return json({ error: "BRANCH_REQUIRED" }, 409);
  }
  if (branchId && !(activeBranches ?? []).some((branch: any) => String(branch.id) === branchId)) {
    return json({ error: "BRANCH_NOT_AVAILABLE" }, 409);
  }
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
    .or("effective_to.is.null,effective_to.gt." + nowIso);
  if (priceError) return json({ error: "PRICING_READ_FAILED" }, 500);

  const priceMap = new Map<string, any>();
  for (const itemId of itemIds) {
    const candidates = (priceRows ?? []).filter((row: any) => {
      if (String(row.catalog_item_id) !== itemId) return false;
      if (row.branch_id && (!branchId || String(row.branch_id) !== branchId)) return false;
      return true;
    });
    const branchSpecific = branchId
      ? candidates.filter((row: any) => String(row.branch_id ?? "") === branchId)
      : [];
    const applicable = branchSpecific.length
      ? branchSpecific
      : candidates.filter((row: any) => row.branch_id === null || row.branch_id === undefined);
    if (applicable.length > 1) return json({ error: "AMBIGUOUS_ACTIVE_PRICE" }, 409);
    if (applicable.length === 1) priceMap.set(itemId, applicable[0]);
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

  if (normalizedItems.some((item: any) => {
    const optionRows = item.selectedOptionIds.map((id: string) => optionMap.get(id)).filter(Boolean);
    return optionRows.some((x: any) => String(x.catalog_item_id) !== item.catalogItemId);
  })) return json({ error: "OPTION_ITEM_MISMATCH" }, 409);

  if (normalizedItems.some((item: any) => {
    const price = priceMap.get(item.catalogItemId);
    const catalog = itemMap.get(item.catalogItemId);
    const optionRows = item.selectedOptionIds.map((id: string) => optionMap.get(id)).filter(Boolean);
    const optionDelta = optionRows.reduce((sum: number, x: any) => sum + Number(x.price_delta ?? 0), 0);
    const unitPrice = Number(price?.unit_price) + optionDelta;
    const taxRate = Number(catalog?.tax_rate ?? 0);
    return !Number.isFinite(Number(price?.unit_price)) || Number(price?.unit_price) < 0
      || !Number.isFinite(optionDelta) || !Number.isFinite(unitPrice) || unitPrice < 0
      || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100;
  })) return json({ error: "INVALID_SERVER_PRICING_DATA" }, 409);

  let subtotal = 0;
  let tax = 0;
  const authoritativeItems = normalizedItems.map((item: any) => {
    const catalog = itemMap.get(item.catalogItemId);
    const price = priceMap.get(item.catalogItemId);
    const optionRows = item.selectedOptionIds.map((id: string) => optionMap.get(id)).filter(Boolean);
    const optionDelta = optionRows.reduce((sum: number, x: any) => sum + Number(x.price_delta ?? 0), 0);
    const unitPrice = Number(price.unit_price) + optionDelta;
    const lineSubtotal = unitPrice * item.quantity;
    const taxRate = Number(catalog.tax_rate ?? 0);
    const lineTax = lineSubtotal * (taxRate > 0 ? taxRate / 100 : 0);
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
    p_client_idempotency_key: idempotencyKey,
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
