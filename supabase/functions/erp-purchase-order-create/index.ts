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
  if (!url || !anon || !service) return json({ success: false, error: "SERVER_CONFIGURATION_ERROR" }, 503);

  try {
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user || user.is_anonymous) return json({ success: false, error: "UNAUTHENTICATED" }, 401);

    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 65536) return json({ success: false, error: "PAYLOAD_TOO_LARGE" }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ success: false, error: "INVALID_JSON" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ success: false, error: "INVALID_JSON" }, 400);
    const b = body as Record<string, unknown>;
    const id = String(b.id ?? "").trim();
    const tenantId = String(b.tenant_id ?? "").trim();
    const businessId = String(b.business_id ?? "").trim();
    const branchId = b.branch_id == null || String(b.branch_id).trim() === "" ? null : String(b.branch_id).trim();
    const orderNumber = String(b.order_number ?? "").trim();
    const supplierId = String(b.supplier_id ?? "").trim();
    const taxAmount = Number(b.tax_amount);
    const discountAmount = Number(b.discount_amount);
    const reason = b.reason == null ? null : String(b.reason).slice(0, 2000);
    if (!id || id.length > 128 || !tenantId || tenantId.length > 128 || !uuidPattern.test(businessId) ||
        (branchId !== null && branchId.length > 128) || !orderNumber || orderNumber.length > 128 ||
        !supplierId || supplierId.length > 128 || !Number.isFinite(taxAmount) || taxAmount < 0 ||
        !Number.isFinite(discountAmount) || discountAmount < 0 || !Array.isArray(b.lines) || b.lines.length < 1 || b.lines.length > 200) {
      return json({ success: false, error: "INVALID_PURCHASE_ORDER_INPUT" }, 400);
    }
    const lines = b.lines.map(rawLine => {
      if (!rawLine || typeof rawLine !== "object" || Array.isArray(rawLine)) return null;
      const line = rawLine as Record<string, unknown>;
      const productId = String(line.product_id ?? "").trim();
      const quantity = Number(line.quantity ?? line.ordered_quantity);
      const unitCost = Number(line.unit_cost);
      if (!uuidPattern.test(productId) || !Number.isFinite(quantity) || quantity <= 0 ||
          !Number.isFinite(unitCost) || unitCost < 0) return null;
      return { product_id: productId, ordered_quantity: quantity, unit_cost: unitCost, description: String(line.description ?? "").slice(0, 500) };
    });
    if (lines.some(line => line === null)) return json({ success: false, error: "INVALID_PURCHASE_ORDER_LINE" }, 400);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.rpc("create_purchase_order_with_lines_backend", {
      p_id: id, p_tenant_id: tenantId, p_business_id: businessId, p_branch_id: branchId,
      p_order_number: orderNumber, p_supplier_id: supplierId, p_tax_amount: taxAmount,
      p_discount_amount: discountAmount, p_reason: reason, p_lines: lines, p_actor_user_id: user.id,
    });
    if (error) {
      const message = String(error.message ?? "");
      const safe = [
        "PURCHASE_ORDER_ROLE_REQUIRED", "PURCHASE_ORDER_LINES_FORBIDDEN", "BUSINESS_INVALID", "BRANCH_INVALID",
        "INVALID_PURCHASE_ORDER", "INVALID_PURCHASE_ORDER_TOTALS", "INVALID_PURCHASE_ORDER_LINE",
        "PURCHASE_ORDER_LINES_REQUIRED", "PRODUCT_INVALID", "DUPLICATE_PURCHASE_ORDER_PRODUCT",
        "PURCHASE_ORDER_IDEMPOTENCY_CONFLICT", "PURCHASE_ORDER_NUMBER_CONFLICT",
      ].find(code => message.includes(code));
      const status = message.includes("ROLE_REQUIRED") || message.includes("FORBIDDEN") ? 403
        : message.includes("NUMBER_CONFLICT") || message.includes("IDEMPOTENCY_CONFLICT") || error.code === "23505" ? 409
        : message.includes("INVALID") || message.includes("REQUIRED") || message.includes("PRODUCT") || message.includes("BRANCH") || message.includes("BUSINESS") ? 400 : 500;
      console.error(JSON.stringify({ stage: "create_purchase_order_with_lines_backend", code: error.code }));
      return json({ success: false, error: safe ?? "PURCHASE_ORDER_CREATE_FAILED" }, status);
    }
    return json(data && typeof data === "object" ? data as Record<string, unknown> : { success: false, error: "PURCHASE_ORDER_CREATE_FAILED" });
  } catch {
    return json({ success: false, error: "PURCHASE_ORDER_CREATE_FAILED" }, 500);
  }
});
