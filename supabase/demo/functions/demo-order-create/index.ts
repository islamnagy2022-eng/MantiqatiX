import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);
const headers = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
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

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return reply({ error: "AUTH_REQUIRED" }, 401, origin);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return reply({ error: "SERVER_MISCONFIGURED" }, 500, origin);
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(auth.slice(7).trim());
  if (authError || !user || user.is_anonymous) return reply({ error: "UNAUTHORIZED" }, 401, origin);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "INVALID_BODY" }, 400, origin);
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: "INVALID_JSON" }, 400, origin);
  }

  const businessId = String(body.businessId || "");
  const branchId = String(body.branchId || "");
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
  const deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const items = body.items;
  const idempotencyKey = typeof body.clientIdempotencyKey === "string" ? body.clientIdempotencyKey.trim() : "";

  if (!businessId || !branchId || !customerName || customerName.length > 200) return reply({ error: "INVALID_ORDER_DETAILS" }, 400, origin);
  if (customerPhone.length > 32 || deliveryAddress.length > 500 || notes.length > 2000) return reply({ error: "ORDER_FIELD_TOO_LONG" }, 400, origin);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) return reply({ error: "INVALID_IDEMPOTENCY_KEY" }, 400, origin);
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) return reply({ error: "INVALID_ITEMS" }, 400, origin);

  const normalizedItems = items.map((raw: any) => ({
    catalogItemId: String(raw?.catalogItemId ?? ""),
    quantity: Number(raw?.quantity),
    selectedOptionIds: Array.isArray(raw?.selectedOptionIds) ? raw.selectedOptionIds.map((x: unknown) => String(x)) : [],
  }));
  if (normalizedItems.some((x: any) => !x.catalogItemId || !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 1000)) {
    return reply({ error: "INVALID_ITEM_QUANTITY" }, 400, origin);
  }
  if (normalizedItems.some((x: any) => x.selectedOptionIds.length > 20 || new Set(x.selectedOptionIds).size !== x.selectedOptionIds.length)) {
    return reply({ error: "INVALID_ITEM_OPTIONS" }, 400, origin);
  }

  const { data: result, error } = await admin.rpc("create_order_backend", {
    p_order_id: crypto.randomUUID(),
    p_tenant_id: "MNTY-PLATFORM",
    p_business_id: businessId,
    p_branch_id: branchId,
    p_customer_id: user.id,
    p_client_idempotency_key: idempotencyKey,
    p_subtotal: 0,
    p_discount: 0,
    p_tax: 0,
    p_delivery_fee: 0,
    p_total_amount: 0,
    p_currency: "EGP",
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_delivery_address: deliveryAddress,
    p_items_json: normalizedItems,
    p_notes: notes || null,
    p_metadata: { source: "MANTIQATIX_DEMO", environment: "DEMO", payments_enabled: false, synthetic_only: true },
  });
  if (error) {
    console.error("demo order creation failed", error.message);
    return reply({ error: "DEMO_ORDER_CREATION_FAILED", detail: error.message || "RPC_FAILED" }, 400, origin);
  }
  return reply({ ok: true, order: result, payment: { mode: "DEMO_ONLY", collected: false } }, 200, origin);
});