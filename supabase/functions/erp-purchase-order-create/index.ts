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
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const scale4 = (v: number) => Math.abs(v * 10000 - Math.round(v * 10000)) < 1e-7;

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
    const branchId = String(body.branch_id ?? "").trim() || null;
    const orderNumber = String(body.order_number ?? "").trim();
    const supplierId = String(body.supplier_id ?? "").trim();
    const reason = body.reason == null ? null : String(body.reason).trim();
    const tax = Number(body.tax_amount ?? 0);
    const discount = Number(body.discount_amount ?? 0);
    const rawLines = body.lines;

    if (!id || id.length < 8 || id.length > 128 || !tenantId || tenantId.length > 128 ||
        !uuidPattern.test(businessId) || (branchId && branchId.length > 128) ||
        !orderNumber || orderNumber.length > 128 || !supplierId || supplierId.length > 128 ||
        (reason && reason.length > 2000)) return json({ success: false, error: "INVALID_PURCHASE_ORDER" }, 400);
    if (!Number.isFinite(tax) || !Number.isFinite(discount) || tax < 0 || discount < 0) {
      return json({ success: false, error: "INVALID_PURCHASE_ORDER_TOTALS" }, 400);
    }
    if (!Array.isArray(rawLines) || rawLines.length < 1 || rawLines.length > 200) {
      return json({ success: false, error: "PURCHASE_ORDER_LINES_REQUIRED" }, 400);
    }
    const lines: Array<Record<string, unknown>> = [];
    for (const rawLine of rawLines) {
      if (!rawLine || typeof rawLine !== "object" || Array.isArray(rawLine)) return json({ success: false, error: "INVALID_PURCHASE_ORDER_LINE" }, 400);
      const line = rawLine as Record<string, unknown>;
      const productId = String(line.product_id ?? "").trim();
      const quantity = Number(line.ordered_quantity ?? line.quantity);
      const unitCost = Number(line.unit_cost);
      const description = line.description == null ? null : String(line.description).trim();
      if (!uuidPattern.test(productId) || !finite(quantity) || quantity <= 0 || !scale4(quantity) ||
          !finite(unitCost) || unitCost < 0 || !scale4(unitCost) || (description && description.length > 500)) {
        return json({ success: false, error: "INVALID_PURCHASE_ORDER_LINE" }, 400);
      }
      lines.push({ product_id: productId, ordered_quantity: quantity, unit_cost: unitCost, description });
    }

    const serviceClient = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await serviceClient.rpc("create_purchase_order_with_lines_backend", {
      p_id: id,
      p_tenant_id: tenantId,
      p_business_id: businessId,
      p_branch_id: branchId,
      p_order_number: orderNumber,
      p_supplier_id: supplierId,
      p_tax_amount: tax,
      p_discount_amount: discount,
      p_reason: reason,
      p_lines: lines,
      p_actor_user_id: user.id,
    });
    if (error) {
      const code = String(error.message ?? "");
      const status = code.includes("PURCHASE_ORDER_ROLE_REQUIRED") ? 403
        : code.includes("PURCHASE_ORDER_NUMBER_CONFLICT") || code.includes("PURCHASE_ORDER_IDEMPOTENCY_CONFLICT") ? 409
        : code.includes("INVALID_") || code.includes("PURCHASE_ORDER_LINES_REQUIRED") || code.includes("DUPLICATE_PURCHASE_ORDER_PRODUCT") || code.includes("PRODUCT_INVALID") || code.includes("BRANCH_INVALID") || code.includes("BUSINESS_INVALID") ? 400
        : 500;
      const safeCode = /^(UNAUTHENTICATED|PURCHASE_ORDER_ROLE_REQUIRED|PURCHASE_ORDER_NOT_FOUND|PURCHASE_ORDER_NUMBER_CONFLICT|PURCHASE_ORDER_IDEMPOTENCY_CONFLICT|INVALID_PURCHASE_ORDER|INVALID_PURCHASE_ORDER_TOTALS|INVALID_PURCHASE_ORDER_LINE|PURCHASE_ORDER_LINES_REQUIRED|DUPLICATE_PURCHASE_ORDER_PRODUCT|PRODUCT_INVALID|BRANCH_INVALID|BUSINESS_INVALID)$/.exec(code)?.[0] ?? "PURCHASE_ORDER_CREATE_FAILED";
      return json({ success: false, error: safeCode }, status);
    }
    return json(data && typeof data === "object" ? data as Record<string, unknown> : { success: false, error: "PURCHASE_ORDER_CREATE_FAILED" }, 200);
  } catch {
    return json({ success: false, error: "PURCHASE_ORDER_CREATE_FAILED" }, 500);
  }
});
