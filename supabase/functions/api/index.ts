import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const allowedOrigin = "https://islamnagy2022-eng.github.io"
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
}

serve(async (req) => {
  const origin = req.headers.get("Origin")
  if (req.method === "OPTIONS") {
    if (origin && origin !== allowedOrigin) {
      return new Response(JSON.stringify({ error: "origin_not_allowed" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    return new Response("ok", { status: 200, headers: corsHeaders })
  }
  if (origin && origin !== allowedOrigin) {
    return new Response(JSON.stringify({ error: "origin_not_allowed" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
  const requestId = req.headers.get("x-request-id")?.trim() || crypto.randomUUID()
  const url = new URL(req.url)
  const path = url.pathname
  const json = (body: unknown, status = 200, extra: Record<string,string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": requestId, ...extra } })

  if (path === "/health") return json({ status: "ok", requestId })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401)
  const token = authHeader.slice(7)

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user || user.is_anonymous) return json({ error: "Unauthorized" }, 401)

  if (req.method === "GET" && path === "/api/v1/brand") {
    const { data: brand, error } = await supabaseAdmin.from("platform_brand_identity")
      .select("brand_key,brand_name_en,brand_name_ar,tagline_ar,primary_colors,typography,logo_usage,icon_sizes,version,status,logo_asset_ref,app_icon_asset_ref")
      .eq("brand_key", "MANTIQATIX").eq("status", "ACTIVE").single()
    if (error || !brand) { console.error(`[${requestId}] brand read failed`); return json({ error: "Brand identity not found", requestId }, 404) }
    return new Response(JSON.stringify(brand), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } })
  }

  if (path === "/api/v1/me") {
    const { data, error } = await supabaseAdmin.from("user_memberships")
      .select("id,tenant_id,organization_id,business_id,branch_id,role,permissions,status")
      .eq("user_id", user.id).eq("status", "ACTIVE")
    if (error) { console.error(`[${requestId}] memberships read failed`, error); return json({ error: "Failed to load memberships", requestId }, 500) }
    return json({ id: user.id, memberships: data ?? [] })
  }

  if (req.method === "GET" && path === "/api/v1/catalog") {
    const requestedTenantId = url.searchParams.get("tenantId");
    const businessId = url.searchParams.get("businessId");
    const branchId = url.searchParams.get("branchId");
    const parsedLimit = Number(url.searchParams.get("limit") ?? "100");
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 100);
    if (!businessId) return json({ error: "businessId is required" }, 400);

    const { data: business, error: businessError } = await supabaseAdmin.from("businesses")
      .select("id,tenant_id,status").eq("id", businessId).single();
    if (businessError || !business || String(business.status ?? "").toUpperCase() !== "ACTIVE")
      return json({ error: "Business not available" }, 404);
    const tenantId = String(business.tenant_id);
    if (requestedTenantId && requestedTenantId !== tenantId) return json({ error: "Business tenant mismatch" }, 403);

    const { data: membership } = await supabaseAdmin.from("user_memberships")
      .select("id,role").eq("user_id", user.id).eq("tenant_id", tenantId).eq("status", "ACTIVE")
      .limit(1).maybeSingle();
    if (!membership) {
      const { data: customerMembership } = await supabaseAdmin.from("user_memberships")
        .select("id,role").eq("user_id", user.id).eq("status", "ACTIVE").eq("role", "CUSTOMER")
        .limit(1).maybeSingle();
      if (!customerMembership) return json({ error: "Forbidden" }, 403);
    }
    const { data: provider } = await supabaseAdmin.from("marketing_provider_profiles")
      .select("id").eq("business_id", businessId).eq("status", "ACTIVE").limit(1).maybeSingle();
    if (!provider) return json({ error: "Provider not available" }, 404);


    let itemQuery = supabaseAdmin.from("catalog_items")
      .select("id,tenant_id,business_id,branch_id,legacy_ref,item_type,name_ar,name_en,description,sku,status,tax_rate,metadata")
      .eq("tenant_id", tenantId).eq("business_id", businessId).eq("status", "ACTIVE")
      .order("name_ar", { ascending: true }).limit(limit);
    if (branchId) itemQuery = itemQuery.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    const { data: items, error: itemError } = await itemQuery;
    if (itemError) return json({ error: "Failed to load catalog" }, 500);

    const ids = (items ?? []).map((x: any) => x.id);
    if (!ids.length) return json({ tenantId, businessId, branchId: branchId ?? null, items: [], prices: [], options: [] });

    const nowIso = new Date().toISOString();
    const [pricesRes, optionsRes] = await Promise.all([
      supabaseAdmin.from("catalog_item_prices")
        .select("id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to")
        .eq("tenant_id", tenantId).in("catalog_item_id", ids).eq("status", "ACTIVE")
        .lte("effective_from", nowIso).or(`effective_to.is.null,effective_to.gte.${nowIso}`)
        .order("version", { ascending: false }),
      supabaseAdmin.from("catalog_item_options")
        .select("id,catalog_item_id,name_ar,name_en,price_delta,status,metadata")
        .eq("tenant_id", tenantId).in("catalog_item_id", ids).eq("status", "ACTIVE")
        .order("name_ar", { ascending: true })
    ]);
    if (pricesRes.error || optionsRes.error) return json({ error: "Failed to load catalog pricing" }, 500);

    return json({
      tenantId, businessId, branchId: branchId ?? null,
      pricingAuthority: "catalog_v1",
      items: items ?? [],
      prices: pricesRes.data ?? [],
      options: optionsRes.data ?? []
    });
  }

  if (req.method === "POST" && path === "/api/v1/orders") {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400)
    const required = ["orderId","tenantId","businessId","branchId","clientIdempotencyKey","items"]
    if (required.some((k) => body[k] == null || body[k] === "")) return json({ error: "Missing required order fields" }, 400)
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) return json({ error: "Invalid items" }, 400)
    if (String(body.clientIdempotencyKey).length > 200) return json({ error: "Invalid idempotency key" }, 400)

    const { data: membership } = await supabaseAdmin.from("user_memberships")
      .select("id,role").eq("user_id", user.id).eq("tenant_id", String(body.tenantId)).eq("status", "ACTIVE")
      .limit(1).maybeSingle()
    if (!membership) {
      const { data: customerMembership } = await supabaseAdmin.from("user_memberships")
        .select("id,role").eq("user_id", user.id).eq("status", "ACTIVE").eq("role", "CUSTOMER")
        .limit(1).maybeSingle()
      if (!customerMembership) return json({ error: "Forbidden" }, 403)
    }
    const { data: provider } = await supabaseAdmin.from("marketing_provider_profiles")
      .select("id").eq("business_id", String(body.businessId)).eq("status", "ACTIVE").limit(1).maybeSingle()
    if (!provider) return json({ error: "Provider not available" }, 404)

    const { data, error } = await supabaseAdmin.rpc("create_order_backend", {
      p_order_id: String(body.orderId),
      p_tenant_id: String(body.tenantId),
      p_business_id: String(body.businessId),
      p_branch_id: body.branchId == null ? null : String(body.branchId),
      p_customer_id: user.id,
      p_client_idempotency_key: String(body.clientIdempotencyKey),
      p_subtotal: 0,
      p_discount: 0,
      p_tax: 0,
      p_delivery_fee: 0,
      p_total_amount: 0,
      p_currency: String(body.currency || "EGP"),
      p_customer_name: String(body.customerName || ""),
      p_customer_phone: String(body.customerPhone || ""),
      p_delivery_address: String(body.deliveryAddress || ""),
      p_items_json: body.items,
      p_notes: body.notes == null ? null : String(body.notes),
      p_metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    })
    if (error) return json({ error: error.message }, 400)
    return json(data, 201)
  }

  const orderMatch = path.match(/^\/api\/v1\/orders\/([^/]+)$/)
  if (req.method === "GET" && orderMatch) {
    const { data: order, error } = await supabaseAdmin.from("orders").select("*").eq("id", orderMatch[1]).single()
    if (error || !order) return json({ error: "Order not found" }, 404)
    const { data: membership } = await supabaseAdmin.from("user_memberships").select("id,role,permissions,business_id")
      .eq("user_id", user.id).eq("tenant_id", order.tenant_id).eq("status", "ACTIVE").limit(1).maybeSingle()
    if (!membership) return json({ error: "Forbidden" }, 403)
    const role = String(membership.role ?? "").toUpperCase()
    const permissions = Array.isArray(membership.permissions) ? membership.permissions : []
    const operationalOrderRead =
      ["SUPER_ADMIN","ADMIN","OWNER","MANAGER","STAFF","CASHIER","DELIVERY_PARTNER"].includes(role) ||
      permissions.includes("ORDER_READ_ALL")
    const providerOrderRead =
      role === "SERVICE_PROVIDER" &&
      !!membership.business_id &&
      String(membership.business_id) === String(order.business_id)
    if (order.customer_id !== user.id && !operationalOrderRead && !providerOrderRead) return json({ error: "Forbidden" }, 403)
    return json(order)
  }

  if (req.method === "POST" && path === "/api/v1/payments/intents") {
    const body = await req.json().catch(() => null)
    if (!body) return json({ error: "Invalid JSON body" }, 400)
    const { orderId, provider, idempotencyKey } = body
    if (provider !== "CASH_ON_DELIVERY") return json({ error: "Only CASH_ON_DELIVERY is enabled in production" }, 400)
    if (!orderId || !idempotencyKey || String(idempotencyKey).length > 200) return json({ error: "orderId and idempotencyKey are required" }, 400)

    const { data: order, error: orderError } = await supabaseAdmin.from("orders")
      .select("id,tenant_id,total,currency,customer_id").eq("id", orderId).single()
    if (orderError || !order) return json({ error: "Order not found" }, 404)

    const { data: membership } = await supabaseAdmin.from("user_memberships").select("id,role,permissions")
      .eq("user_id", user.id).eq("tenant_id", order.tenant_id).eq("status", "ACTIVE").limit(1).maybeSingle()
    if (!membership) return json({ error: "Forbidden" }, 403)

    const role = String(membership.role ?? "").toUpperCase()
    const permissions = Array.isArray(membership.permissions) ? membership.permissions : []
    const operationalPaymentAccess =
      ["SUPER_ADMIN","ADMIN","OWNER","MANAGER","CASHIER","STAFF"].includes(role) ||
      permissions.includes("PAYMENT_CREATE")
    const isOrderOwner = order.customer_id === user.id
    if (!isOrderOwner && !operationalPaymentAccess) return json({ error: "Forbidden" }, 403)

    const { data: configuredMethod } = await supabaseAdmin.from("tenant_payment_methods").select("id")
      .eq("tenant_id", order.tenant_id).eq("payment_method", "CASH_ON_DELIVERY")
      .eq("provider", "CASH_ON_DELIVERY").eq("is_enabled", true).limit(1).maybeSingle()
    if (!configuredMethod) return json({ error: "Cash payment is not enabled for this tenant" }, 409)

    const newIntent = {
      id: crypto.randomUUID(),
      tenant_id: order.tenant_id,
      order_id: order.id,
      amount: order.total,
      currency: order.currency,
      status: "CREATED",
      provider: "CASH_ON_DELIVERY",
      payment_method: "CASH_ON_DELIVERY",
      idempotency_key: String(idempotencyKey),
    }
    const { data, error } = await supabaseAdmin.from("payment_intents")
      .upsert(newIntent, { onConflict: "tenant_id,idempotency_key" }).select().single()
    if (error) return json({ error: "Failed to create payment intent" }, 500)
    return json(data)
  }

  const paymentIntentMatch = path.match(/^\/api\/v1\/payments\/intents\/([^/]+)$/)
  if (req.method === "GET" && paymentIntentMatch) {
    const { data: intent, error } = await supabaseAdmin.from("payment_intents").select("*").eq("id", paymentIntentMatch[1]).single()
    if (error || !intent) return json({ error: "Intent not found" }, 404)
    const { data: membership } = await supabaseAdmin.from("user_memberships").select("id,role,permissions")
      .eq("user_id", user.id).eq("tenant_id", intent.tenant_id).eq("status", "ACTIVE").limit(1).maybeSingle()
    if (!membership) return json({ error: "Forbidden" }, 403)
    const role = String(membership.role ?? "").toUpperCase()
    const permissions = Array.isArray(membership.permissions) ? membership.permissions : []
    const operationalPaymentRead =
      ["SUPER_ADMIN","ADMIN","OWNER","MANAGER","CASHIER","STAFF"].includes(role) ||
      permissions.includes("PAYMENT_READ_ALL")
    const { data: linkedOrder } = await supabaseAdmin.from("orders").select("customer_id").eq("id", intent.order_id).eq("tenant_id", intent.tenant_id).maybeSingle()
    if (linkedOrder?.customer_id !== user.id && !operationalPaymentRead) return json({ error: "Forbidden" }, 403)
    return json(intent)
  }

  const cashConfirmMatch = path.match(/^\/api\/v1\/payments\/([^/]+)\/cash\/confirm$/)
  if (req.method === "POST" && cashConfirmMatch) {
    const intentId = cashConfirmMatch[1]
    const { data: intent, error: intentError } = await supabaseAdmin.from("payment_intents")
      .select("tenant_id").eq("id", intentId).single()
    if (intentError || !intent) return json({ error: "Payment intent not found" }, 404)

    const { data: membership } = await supabaseAdmin.from("user_memberships")
      .select("role,permissions").eq("user_id", user.id).eq("tenant_id", intent.tenant_id)
      .eq("status", "ACTIVE").limit(1).maybeSingle()
    if (!membership) return json({ error: "Forbidden" }, 403)

    const permissions = Array.isArray(membership.permissions) ? membership.permissions : []
    const authorized = ["ADMIN","MANAGER","CASHIER","STAFF","OWNER"].includes(String(membership.role ?? "").toUpperCase()) ||
      permissions.includes("PAYMENT_CONFIRM_CASH")
    if (!authorized) return json({ error: "Forbidden: insufficient permissions" }, 403)

    const { data, error } = await supabaseAdmin.rpc("confirm_cash_payment", {
      p_payment_intent_id: intentId,
      p_user_id: user.id,
    })
    if (error) return json({ error: error.message }, 400)
    return json(data)
  }

  return json({ error: "Not Found" }, 404)
})