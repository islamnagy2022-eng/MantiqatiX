import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "no-store" } });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && origin !== allowedOrigin) return json({ success: false, error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ success: false, error: "UNAUTHENTICATED" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ success: false, error: "SERVER_CONFIGURATION_ERROR" }, 500);

  try {
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user || user.is_anonymous) return json({ success: false, error: "UNAUTHENTICATED" }, 401);

    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 65536) return json({ success: false, error: "PAYLOAD_TOO_LARGE" }, 413);
    let body: Record<string, unknown> | null;
    try { body = JSON.parse(raw) as Record<string, unknown>; } catch { body = null; }
    if (!body || Array.isArray(body) || typeof body !== "object") return json({ success: false, error: "INVALID_JSON" }, 400);

    const id = String(body.id ?? "").trim();
    const tenantId = String(body.tenant_id ?? "").trim();
    const businessId = String(body.business_id ?? "").trim();
    const purchaseOrderId = String(body.purchase_order_id ?? "").trim();
    const receiptNumber = String(body.receipt_number ?? "").trim();
    const warehouseId = String(body.warehouse_id ?? "").trim();
    const productId = String(body.product_id ?? "").trim();
    const quantity = Number(body.received_quantity);
    const unitCost = Number(body.unit_cost);

    if (!id || id.length > 128 || !tenantId || tenantId.length > 128 ||
        !purchaseOrderId || purchaseOrderId.length > 128 ||
        !receiptNumber || receiptNumber.length > 128 ||
        !warehouseId || warehouseId.length > 128 ||
        !uuidPattern.test(businessId) || !uuidPattern.test(productId)) {
      return json({ success: false, error: "INVALID_INPUT" }, 400);
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      return json({ success: false, error: "INVALID_RECEIPT_AMOUNT" }, 400);
    }

    // One server-side transaction validates the actor/order/scope and mutates receipt,
    // stock balance, and inventory ledger together. Never write these tables separately.
    const serviceClient = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await serviceClient.rpc("receive_purchase_stock_with_order_line_backend", {
      p_id: id,
      p_tenant_id: tenantId,
      p_business_id: businessId,
      p_purchase_order_id: purchaseOrderId,
      p_receipt_number: receiptNumber,
      p_warehouse_id: warehouseId,
      p_product_id: productId,
      p_received_quantity: quantity,
      p_unit_cost: unitCost,
      p_actor_user_id: user.id,
    });

    if (error) {
      const code = String(error.message ?? "");
      const status = code.includes("PURCHASE_RECEIVING_ROLE_REQUIRED") ? 403
        : code.includes("PURCHASE_ORDER_NOT_FOUND") ? 404
        : code.includes("PURCHASE_ORDER_NOT_APPROVED") || code.includes("IDEMPOTENCY_CONFLICT") || code.includes("STOCK_BALANCE_SCOPE_CONFLICT") || code.includes("PURCHASE_ORDER_QUANTITY_EXCEEDED") || code.includes("PURCHASE_ORDER_UNIT_COST_MISMATCH") || code.includes("PRODUCT_NOT_IN_PURCHASE_ORDER") ? 409
        : code.includes("INVALID_") || code.includes("WAREHOUSE_INVALID") || code.includes("PRODUCT_INVALID") || code.includes("BUSINESS_SCOPE_INVALID") ? 400
        : 500;
      const safeCode = /^(UNAUTHENTICATED|PURCHASE_RECEIVING_ROLE_REQUIRED|PURCHASE_ORDER_NOT_FOUND|PURCHASE_ORDER_NOT_APPROVED|RECEIPT_IDEMPOTENCY_CONFLICT|STOCK_BALANCE_SCOPE_CONFLICT|PURCHASE_ORDER_QUANTITY_EXCEEDED|PRODUCT_NOT_IN_PURCHASE_ORDER|PURCHASE_ORDER_UNIT_COST_MISMATCH|INVALID_RECEIPT_INPUT|WAREHOUSE_INVALID|PRODUCT_INVALID|BUSINESS_SCOPE_INVALID)$/.exec(code)?.[0] ?? "PURCHASE_RECEIPT_FAILED";
      return json({ success: false, error: safeCode }, status);
    }

    return json(data && typeof data === "object" ? data as Record<string, unknown> : { success: false, error: "PURCHASE_RECEIPT_FAILED" }, 200);
  } catch {
    return json({ success: false, error: "PURCHASE_RECEIPT_FAILED" }, 500);
  }
});
