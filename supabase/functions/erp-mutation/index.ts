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
const text = (value: unknown, max = 128) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
const finitePositive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && origin !== allowedOrigin) return json({ success: false, error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || !authorization.slice(7).trim()) {
    return json({ success: false, error: "UNAUTHENTICATED" }, 401);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ success: false, error: "SERVER_CONFIGURATION_ERROR" }, 503);

  try {
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(authorization.slice(7).trim());
    const user = authData?.user;
    if (authError || !user || user.is_anonymous) return json({ success: false, error: "UNAUTHENTICATED" }, 401);

    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 16384) return json({ success: false, error: "PAYLOAD_TOO_LARGE" }, 413);
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return json({ success: false, error: "INVALID_JSON" }, 400); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ success: false, error: "INVALID_JSON" }, 400);
    const body = parsed as Record<string, unknown>;
    const action = text(body.action, 64);
    const payload = body.payload;
    if (!action || !payload || typeof payload !== "object" || Array.isArray(payload)) return json({ success: false, error: "INVALID_INPUT" }, 400);
    const p = payload as Record<string, unknown>;

    let rpc: string;
    let args: Record<string, unknown>;
    if (action === "purchase-order-status") {
      const orderId = text(p.p_order_id);
      const target = text(p.p_target_status, 32);
      if (!orderId || !target || !["SUBMITTED", "APPROVED"].includes(target)) return json({ success: false, error: "INVALID_PURCHASE_ORDER_STATUS_INPUT" }, 400);
      rpc = "update_purchase_order_status_service_backend";
      args = { p_order_id: orderId, p_target_status: target, p_actor_user_id: user.id };
    } else if (action === "stock-transfer-create") {
      const id = text(p.p_id);
      const tenantId = text(p.p_tenant_id);
      const businessId = text(p.p_business_id, 64);
      const transferNumber = text(p.p_transfer_number);
      const from = text(p.p_from_warehouse_id);
      const to = text(p.p_to_warehouse_id);
      const productId = text(p.p_product_id, 64);
      const quantity = p.p_quantity;
      if (!id || !tenantId || !businessId || !uuidPattern.test(businessId) || !transferNumber ||
          !from || !to || !productId || !uuidPattern.test(productId) || !finitePositive(quantity)) {
        return json({ success: false, error: "INVALID_TRANSFER_INPUT" }, 400);
      }
      rpc = "create_stock_transfer_service_backend";
      args = {
        p_id: id, p_tenant_id: tenantId, p_business_id: businessId,
        p_transfer_number: transferNumber, p_from_warehouse_id: from, p_to_warehouse_id: to,
        p_product_id: productId, p_quantity: quantity, p_actor_user_id: user.id,
      };
    } else if (action === "stock-transfer-status") {
      const transferId = text(p.p_transfer_id);
      const target = text(p.p_target_status, 32);
      if (!transferId || !target || !["APPROVED", "IN_TRANSIT"].includes(target)) return json({ success: false, error: "INVALID_TRANSFER_STATUS_INPUT" }, 400);
      rpc = "update_stock_transfer_status_service_backend";
      args = { p_transfer_id: transferId, p_target_status: target, p_actor_user_id: user.id };
    } else if (action === "stock-transfer-receive") {
      const transferId = text(p.p_transfer_id);
      if (!transferId) return json({ success: false, error: "INVALID_TRANSFER_ID" }, 400);
      rpc = "receive_stock_transfer_service_backend";
      args = { p_transfer_id: transferId, p_actor_user_id: user.id };
    } else {
      return json({ success: false, error: "UNKNOWN_ACTION" }, 400);
    }

    const { data, error } = await admin.rpc(rpc, args);
    if (error) {
      const rawMessage = String(error.message ?? "");
      const allowedErrors = [
        "UNAUTHENTICATED", "INVALID_PURCHASE_ORDER_STATUS_INPUT", "PURCHASE_ORDER_NOT_FOUND",
        "PURCHASE_ORDER_ROLE_REQUIRED", "INVALID_STATUS_TRANSITION", "INVALID_TRANSFER_INPUT",
        "ERP_INVENTORY_ROLE_REQUIRED", "SOURCE_WAREHOUSE_INVALID", "TARGET_WAREHOUSE_INVALID",
        "SAME_WAREHOUSE", "PRODUCT_INVALID", "TRANSFER_IDEMPOTENCY_CONFLICT", "TRANSFER_NUMBER_CONFLICT",
        "INVALID_TRANSFER_STATUS_INPUT", "TRANSFER_NOT_FOUND", "INVALID_TRANSFER_ID",
        "TRANSFER_NOT_IN_TRANSIT", "SOURCE_STOCK_NOT_INITIALIZED", "INSUFFICIENT_AVAILABLE_STOCK",
      ];
      const safe = allowedErrors.find(code => rawMessage.includes(code)) ?? "ERP_MUTATION_FAILED";
      const status = safe.includes("ROLE_REQUIRED") ? 403
        : safe.includes("NOT_FOUND") ? 404
        : safe.includes("CONFLICT") || safe.includes("TRANSITION") || safe.includes("INSUFFICIENT") || safe.includes("NOT_IN_TRANSIT") ? 409
        : safe.startsWith("INVALID_") || safe.endsWith("_INVALID") || safe === "SAME_WAREHOUSE" ? 400 : 500;
      console.error(JSON.stringify({ stage: rpc, code: error.code ?? "UNKNOWN", safe }));
      return json({ success: false, error: safe }, status);
    }
    return json(data && typeof data === "object" ? data as Record<string, unknown> : { success: false, error: "ERP_MUTATION_FAILED" });
  } catch {
    return json({ success: false, error: "ERP_MUTATION_FAILED" }, 500);
  }
});
