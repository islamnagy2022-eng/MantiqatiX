import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req: Request) => {
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

  const required = ["orderId","tenantId","businessId","clientIdempotencyKey","subtotal","discount","tax","deliveryFee","totalAmount","currency","customerName","customerPhone","deliveryAddress","items"];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null) return json({ error: "MISSING_FIELD", field: key }, 400);
  }

  const { data, error } = await admin.rpc("create_order_backend", {
    p_order_id: body.orderId,
    p_tenant_id: body.tenantId,
    p_business_id: body.businessId,
    p_branch_id: body.branchId || null,
    p_customer_id: user.id,
    p_client_idempotency_key: body.clientIdempotencyKey,
    p_subtotal: body.subtotal,
    p_discount: body.discount,
    p_tax: body.tax,
    p_delivery_fee: body.deliveryFee,
    p_total_amount: body.totalAmount,
    p_currency: body.currency,
    p_customer_name: body.customerName,
    p_customer_phone: body.customerPhone,
    p_delivery_address: body.deliveryAddress,
    p_items_json: body.items,
    p_notes: body.notes ?? null,
    p_metadata: body.metadata ?? {}
  });

  if (error) return json({ error: error.message || "ORDER_CREATE_FAILED" }, 400);
  return json(data);
});