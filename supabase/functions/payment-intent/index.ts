import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const PAYMOB_SECRET_KEY = Deno.env.get("PAYMOB_SECRET_KEY") ?? "";
const PAYMOB_INTEGRATION_ID = Deno.env.get("PAYMOB_INTEGRATION_ID") ?? "";
const PAYMOB_CALLBACK_URL = Deno.env.get("PAYMOB_CALLBACK_URL") ?? `${SUPABASE_URL}/functions/v1/paymob-webhook`;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

const json = (body: unknown, status = 200, requestId?: string) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(requestId ? { "X-Request-Id": requestId } : {}) }
});

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, requestId);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401, requestId);
  if (!SUPABASE_ANON_KEY) return json({ error: "Server authentication configuration missing" }, 500, requestId);

  const token = auth.slice(7);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user || user.is_anonymous) return json({ error: "Unauthorized" }, 401, requestId);

  if (!PAYMOB_SECRET_KEY || !PAYMOB_INTEGRATION_ID) return json({ error: "Electronic payment gateway is not configured" }, 503, requestId);

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid JSON" }, 400, requestId);

  const orderId = String(body.orderId ?? "");
  const idempotencyKey = String(body.idempotencyKey ?? "");
  if (!orderId || !idempotencyKey || idempotencyKey.length > 200) return json({ error: "orderId and idempotencyKey are required" }, 400, requestId);

  const { data: order, error: orderError } = await admin.from("orders")
    .select("id,tenant_id,business_id,customer_id,total,total_amount,currency,pricing_version,pricing_hash,pricing_authority,customer_name,customer_phone,delivery_address,status")
    .eq("id", orderId).single();
  if (orderError || !order) return json({ error: "Order not found" }, 404, requestId);

  if (String(order.status ?? "").toUpperCase() === "CANCELLED") return json({ error: "Order is cancelled" }, 409, requestId);
  if (!order.pricing_hash || order.pricing_version == null || !order.pricing_authority) return json({ error: "Order pricing snapshot is unavailable" }, 409, requestId);

  if (order.customer_id && order.customer_id !== user.id) {
    const { data: financeMembership } = await admin.from("user_memberships").select("id,role")
      .eq("user_id", user.id).eq("tenant_id", order.tenant_id).eq("status", "ACTIVE")
      .in("role", ["OWNER","ADMIN","MANAGER","FINANCE","ACCOUNTANT","FINANCE_MANAGER"]).limit(1).maybeSingle();
    if (!financeMembership) return json({ error: "Forbidden" }, 403, requestId);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } }
  });

  const rpc = await userClient.rpc("create_payment_intent_backend", {
    p_tenant_id: order.tenant_id, p_order_id: order.id, p_amount: order.total,
    p_currency: order.currency, p_provider: "PAYMOB", p_payment_method: "CARD", p_idempotency_key: idempotencyKey
  });
  if (rpc.error) {
    console.error(JSON.stringify({ requestId, stage: "create_payment_intent_backend", code: rpc.error.code }));
    return json({ error: "Payment intent creation failed", requestId }, 400, requestId);
  }

  const intent = (rpc.data ?? {}) as Record<string, unknown>;
  const paymentIntentId = String(intent.id ?? "");
  if (!paymentIntentId) return json({ error: "Payment intent creation failed", requestId }, 500, requestId);

  const amount = Number(intent.amount ?? order.total);
  const pricingVersion = Number(intent.pricing_version ?? order.pricing_version);
  const pricingHash = String(intent.pricing_hash ?? order.pricing_hash);
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount - Number(order.total_amount)) > 0.01 ||
      Math.abs(amount - Number(order.total)) > 0.01 || pricingHash !== String(order.pricing_hash) ||
      pricingVersion !== Number(order.pricing_version)) {
    return json({ error: "Authoritative pricing changed; restart payment", requestId }, 409, requestId);
  }

  const amountCents = Math.round(amount * 100);
  const phone = String(order.customer_phone ?? user.phone ?? "");
  const email = String(user.email ?? "");
  const paymobPayload = {
    amount: amountCents, currency: String(order.currency || "EGP").toUpperCase(),
    payment_methods: [Number(PAYMOB_INTEGRATION_ID)],
    items: [{ name: "MantiqaTix order", amount: amountCents, description: `MantiqaTix order ${order.id}`, quantity: 1 }],
    billing_data: {
      apartment: "NA", first_name: String(order.customer_name ?? user.email?.split("@")[0] ?? "Customer").split(" ")[0] || "Customer",
      last_name: String(order.customer_name ?? "Customer").split(" ").slice(1).join(" ") || "Customer",
      street: String(order.delivery_address ?? "NA"), building: "NA", phone_number: phone || "NA", city: "Cairo", country: "EG",
      email: email || "customer@example.com", floor: "NA", state: "Cairo"
    },
    special_reference: paymentIntentId, expiration: 3600, notification_url: PAYMOB_CALLBACK_URL
  };

  const response = await fetch("https://accept.paymob.com/v1/intention/", {
    method: "POST", headers: { "Authorization": `Token ${PAYMOB_SECRET_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(paymobPayload)
  });
  const provider = await response.json().catch(() => ({}));
  if (!response.ok || !provider?.id || !provider?.client_secret) {
    await admin.from("payment_intents").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", paymentIntentId);
    console.error(JSON.stringify({ requestId, stage: "paymob_intention", httpStatus: response.status }));
    return json({ error: "Payment provider rejected the payment intent", requestId }, 502, requestId);
  }

  const { error: updateError } = await admin.from("payment_intents").update({
    provider_intent_id: String(provider.id), status: "PENDING", updated_at: new Date().toISOString()
  }).eq("id", paymentIntentId).eq("pricing_hash", pricingHash).eq("pricing_version", pricingVersion);

  if (updateError) {
    console.error(JSON.stringify({ requestId, stage: "persist_provider_intent", code: updateError.code }));
    return json({ error: "Payment intent persistence failed", requestId }, 500, requestId);
  }

  return json({ id: paymentIntentId, provider: "PAYMOB", status: "PENDING", amount, currency: String(order.currency).toUpperCase(),
    pricingVersion, pricingHash, pricingAuthority: String(order.pricing_authority), clientSecret: String(provider.client_secret), requestId }, 200, requestId);
});