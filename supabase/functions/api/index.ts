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

  if (path === "/api/health" || path === "/health") return json({ status: "ok", requestId })

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

  if (req.method === "POST" && path === "/api/v1/erp/runtime") {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "INVALID_REQUEST" }, 400)
    const operation = String(body.operation ?? "")
    const tenantId = String(body.tenantId ?? "").trim()
    const businessId = String(body.businessId ?? "").trim()
    const branchId = body.branchId ? String(body.branchId).trim() : ""
    if (!tenantId || !businessId) return json({ error: "ERP_SCOPE_REQUIRED" }, 400)

    const { data: memberships, error: membershipError } = await supabaseAdmin.from("user_memberships")
      .select("role,business_id,branch_id").eq("user_id", user.id).eq("tenant_id", tenantId)
      .eq("business_id", businessId).eq("status", "ACTIVE")
    if (membershipError) {
      console.error("[erp-runtime] membership lookup failed", { code: membershipError.code })
      return json({ error: "ERP_MEMBERSHIP_LOOKUP_FAILED" }, 500)
    }
    const roles = ["OWNER","BUSINESS_OWNER","ADMIN","MANAGER","EMPLOYEE","STAFF","ACCOUNTANT","FINANCE_MANAGER","FINANCE"]
    const membership = (memberships ?? []).find((row) => {
      const role = String(row.role ?? "").toUpperCase()
      if (!roles.includes(role)) return false
      if (!branchId) return !row.branch_id || (["OWNER","BUSINESS_OWNER","ADMIN"].includes(role) && !row.branch_id)
      return !row.branch_id || String(row.branch_id) === branchId || (["OWNER","BUSINESS_OWNER","ADMIN"].includes(role) && !row.branch_id)
    })
    if (!membership) return json({ error: branchId ? "ERP_BRANCH_SCOPE_REQUIRED" : "ERP_MEMBERSHIP_REQUIRED" }, 403)
    const role = String(membership.role ?? "").toUpperCase()
    const { data: business, error: businessError } = await supabaseAdmin.from("businesses")
      .select("id,tenant_id,status").eq("id", businessId).eq("tenant_id", tenantId).maybeSingle()
    if (businessError) return json({ error: "ERP_BUSINESS_LOOKUP_FAILED" }, 500)
    if (!business || String(business.status ?? "").toUpperCase() !== "ACTIVE") return json({ error: "ERP_BUSINESS_SCOPE_INVALID" }, 403)
    if (branchId) {
      const { data: branch, error: branchError } = await supabaseAdmin.from("branches")
        .select("id").eq("id", branchId).eq("tenant_id", tenantId).eq("business_id", businessId).eq("status", "ACTIVE").maybeSingle()
      if (branchError) return json({ error: "ERP_BRANCH_LOOKUP_FAILED" }, 500)
      if (!branch) return json({ error: "ERP_BRANCH_SCOPE_INVALID" }, 403)
    }

    if (operation === "list") {
      let warehouseQuery = supabaseAdmin.from("warehouses").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).limit(100).order("name", { ascending: true })
      if (branchId) warehouseQuery = warehouseQuery.eq("branch_id", branchId)
      let branchesQuery = supabaseAdmin.from("branches").select("id,tenant_id,business_id,name,code,status").eq("tenant_id", tenantId).eq("business_id", businessId).eq("status", "ACTIVE").limit(100).order("name", { ascending: true })
      if (branchId) branchesQuery = branchesQuery.eq("id", branchId)
      const [{ data: warehousesData, error: warehousesError }, { data: branchesData, error: branchesError }] = await Promise.all([warehouseQuery, branchesQuery])
      if (warehousesError || branchesError) return json({ error: "ERP_DATA_LOAD_FAILED" }, 500)
      const supplierBase = () => supabaseAdmin.from("erp_suppliers").select("*")
        .eq("tenant_id", tenantId).eq("business_id", businessId).eq("status", "ACTIVE")
        .limit(300).order("name_ar", { ascending: true })
      const [globalSuppliersRes, branchSuppliersRes] = branchId
        ? await Promise.all([supplierBase().is("branch_id", null), supplierBase().eq("branch_id", branchId)])
        : [await supplierBase(), { data: [], error: null }]
      if (globalSuppliersRes.error || branchSuppliersRes.error) return json({ error: "ERP_DATA_LOAD_FAILED" }, 500)
      const suppliersData = [...new Map([...(globalSuppliersRes.data ?? []), ...(branchSuppliersRes.data ?? [])].map((row) => [String(row.id), row])).values()]
      const warehouseIds = (warehousesData ?? []).map((row) => String(row.id))
      let ordersQuery = supabaseAdmin.from("erp_purchase_orders").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).limit(100).order("created_at", { ascending: false })
      if (branchId) ordersQuery = ordersQuery.eq("branch_id", branchId)
      let receiptsQuery = supabaseAdmin.from("erp_purchase_receipts").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).limit(100).order("created_at", { ascending: false })
      if (branchId) receiptsQuery = warehouseIds.length ? receiptsQuery.in("warehouse_id", warehouseIds) : receiptsQuery.in("warehouse_id", ["00000000-0000-0000-0000-000000000000"])
      let productsQuery = supabaseAdmin.from("catalog_items").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).eq("status", "ACTIVE").limit(200).order("name_ar", { ascending: true })
      if (branchId) productsQuery = productsQuery.or(`branch_id.is.null,branch_id.eq.${branchId}`)
      let balancesQuery = supabaseAdmin.from("stock_balances").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).limit(300).order("updated_at", { ascending: false })
      let transactionsQuery = supabaseAdmin.from("inventory_transactions").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).limit(300).order("created_at", { ascending: false })
      if (branchId) {
        balancesQuery = balancesQuery.eq("branch_id", branchId)
        transactionsQuery = transactionsQuery.eq("branch_id", branchId)
      }
      const [ordersRes, receiptsRes, productsRes, balancesRes, transactionsRes] = await Promise.all([ordersQuery, receiptsQuery, productsQuery, balancesQuery, transactionsQuery])
      let transfers = []
      if (!branchId) {
        const { data, error } = await supabaseAdmin.from("erp_stock_transfers").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).limit(100).order("created_at", { ascending: false })
        if (error) return json({ error: "ERP_DATA_LOAD_FAILED" }, 500)
        transfers = data ?? []
      } else if (warehouseIds.length) {
        const [fromRes, toRes] = await Promise.all([
          supabaseAdmin.from("erp_stock_transfers").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).in("from_warehouse_id", warehouseIds).limit(100).order("created_at", { ascending: false }),
          supabaseAdmin.from("erp_stock_transfers").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).in("to_warehouse_id", warehouseIds).limit(100).order("created_at", { ascending: false })
        ])
        if (fromRes.error || toRes.error) return json({ error: "ERP_DATA_LOAD_FAILED" }, 500)
        transfers = [...new Map([...(fromRes.data ?? []), ...(toRes.data ?? [])].map((row) => [String(row.id), row])).values()]
      }
      if (ordersRes.error || receiptsRes.error || productsRes.error || balancesRes.error || transactionsRes.error) return json({ error: "ERP_DATA_LOAD_FAILED" }, 500)
      const safeRows = (rows, fields) => (rows ?? []).map((row) => Object.fromEntries(fields.filter((field) => Object.prototype.hasOwnProperty.call(row, field)).map((field) => [field, row[field]])))
      return json({
        success: true,
        orders: safeRows(ordersRes.data, ["id","tenant_id","business_id","branch_id","order_number","supplier_id","total_amount","tax_amount","discount_amount","status","reason","created_at","updated_at"]),
        receipts: safeRows(receiptsRes.data, ["id","tenant_id","business_id","purchase_order_id","receipt_number","warehouse_id","product_id","received_quantity","unit_cost","status","created_at"]),
        transfers: safeRows(transfers, ["id","tenant_id","business_id","transfer_number","from_warehouse_id","to_warehouse_id","product_id","quantity","status","created_at","updated_at"]),
        warehouses: safeRows(warehousesData, ["id","tenant_id","business_id","branch_id","name","code","status"]),
        branches: safeRows(branchesData, ["id","tenant_id","business_id","name","code","status"]),
        catalog_items: safeRows(productsRes.data, ["id","tenant_id","business_id","branch_id","name_ar","name_en","sku","item_type","status","tax_rate"]),
        stock_balances: safeRows(balancesRes.data, ["id","tenant_id","business_id","branch_id","warehouse_id","product_id","quantity_on_hand","quantity_reserved","updated_at"]),
        inventory_transactions: safeRows(transactionsRes.data, ["id","tenant_id","business_id","branch_id","warehouse_id","product_id","transaction_type","quantity","unit_cost","reference_id","created_by","created_at"]),
        suppliers: safeRows(suppliersData, ["id","tenant_id","business_id","branch_id","supplier_code","name_ar","name_en","contact_name","phone","email","payment_terms","status","created_at","updated_at"])
      })
    }

    if (operation !== "mutate") return json({ error: "INVALID_OPERATION" }, 400)
    const action = String(body.action ?? "")
    const allowedOperations = new Set(["create_supplier","create_purchase_order","update_purchase_order_status","receive_purchase_stock","create_stock_transfer","update_stock_transfer_status","receive_stock_transfer"])
    if (!allowedOperations.has(action)) return json({ error: "ERP_OPERATION_NOT_ALLOWED" }, 400)
    const args = body.arguments
    if (!args || typeof args !== "object" || Array.isArray(args)) return json({ error: "INVALID_ARGUMENTS" }, 400)
    const scopeMismatch = () => json({ error: "ERP_SCOPE_MISMATCH" }, 403)
    if (["create_supplier","create_purchase_order","receive_purchase_stock","create_stock_transfer"].includes(action)) {
      if (String(args.p_tenant_id ?? "") !== tenantId || String(args.p_business_id ?? "") !== businessId) return scopeMismatch()
    }
    if (["create_supplier","create_purchase_order"].includes(action) && String(args.p_branch_id ?? "") !== branchId) return scopeMismatch()
    if (["update_purchase_order_status","receive_purchase_stock"].includes(action)) {
      const orderId = action === "update_purchase_order_status" ? args.p_order_id : args.p_purchase_order_id
      const { data: order, error: orderError } = await supabaseAdmin.from("erp_purchase_orders")
        .select("id,tenant_id,business_id,branch_id").eq("id", String(orderId ?? ""))
        .eq("tenant_id", tenantId).eq("business_id", businessId).maybeSingle()
      if (orderError) return json({ error: "ERP_RECORD_LOOKUP_FAILED" }, 500)
      if (!order) return json({ error: "ERP_RECORD_NOT_FOUND" }, 404)
      if (branchId && String(order.branch_id ?? "") !== branchId) return scopeMismatch()
    }
    if (action === "receive_purchase_stock") {
      const { data: warehouse, error: warehouseError } = await supabaseAdmin.from("warehouses")
        .select("id,branch_id,status").eq("id", String(args.p_warehouse_id ?? ""))
        .eq("tenant_id", tenantId).eq("business_id", businessId).eq("status", "ACTIVE").maybeSingle()
      if (warehouseError) return json({ error: "ERP_WAREHOUSE_LOOKUP_FAILED" }, 500)
      if (!warehouse || (branchId && String(warehouse.branch_id ?? "") !== branchId)) return scopeMismatch()
      const { data: product, error: productError } = await supabaseAdmin.from("catalog_items")
        .select("id,branch_id,status").eq("id", String(args.p_product_id ?? ""))
        .eq("tenant_id", tenantId).eq("business_id", businessId).eq("status", "ACTIVE").maybeSingle()
      if (productError) return json({ error: "ERP_PRODUCT_LOOKUP_FAILED" }, 500)
      if (!product || (branchId && product.branch_id && String(product.branch_id) !== branchId)) return scopeMismatch()
    }
    if (action === "create_stock_transfer") {
      const warehouseIds = [String(args.p_from_warehouse_id ?? ""), String(args.p_to_warehouse_id ?? "")]
      if (!warehouseIds[0] || !warehouseIds[1] || warehouseIds[0] === warehouseIds[1]) return json({ error: "ERP_WAREHOUSE_SELECTION_INVALID" }, 400)
      const { data: warehouses, error: warehousesError } = await supabaseAdmin.from("warehouses")
        .select("id,branch_id,status").eq("tenant_id", tenantId).eq("business_id", businessId).in("id", warehouseIds).eq("status", "ACTIVE")
      if (warehousesError) return json({ error: "ERP_WAREHOUSE_LOOKUP_FAILED" }, 500)
      if ((warehouses ?? []).length !== 2 || (branchId && warehouses.some((row) => String(row.branch_id ?? "") !== branchId))) return scopeMismatch()
      const { data: product, error: productError } = await supabaseAdmin.from("catalog_items")
        .select("id,branch_id,status").eq("id", String(args.p_product_id ?? ""))
        .eq("tenant_id", tenantId).eq("business_id", businessId).eq("status", "ACTIVE").maybeSingle()
      if (productError) return json({ error: "ERP_PRODUCT_LOOKUP_FAILED" }, 500)
      if (!product || (branchId && product.branch_id && String(product.branch_id) !== branchId)) return scopeMismatch()
    }
    if (["update_stock_transfer_status","receive_stock_transfer"].includes(action)) {
      const transferId = args.p_transfer_id ?? args.p_id
      const { data: transfer, error: transferError } = await supabaseAdmin.from("erp_stock_transfers")
        .select("id,tenant_id,business_id,from_warehouse_id,to_warehouse_id")
        .eq("id", String(transferId ?? "")).eq("tenant_id", tenantId).eq("business_id", businessId).maybeSingle()
      if (transferError) return json({ error: "ERP_RECORD_LOOKUP_FAILED" }, 500)
      if (!transfer) return json({ error: "ERP_RECORD_NOT_FOUND" }, 404)
      if (branchId) {
        const { data: warehouses, error: warehousesError } = await supabaseAdmin.from("warehouses")
          .select("id,branch_id,status").eq("tenant_id", tenantId).eq("business_id", businessId)
          .in("id", [String(transfer.from_warehouse_id), String(transfer.to_warehouse_id)]).eq("status", "ACTIVE")
        if (warehousesError) return json({ error: "ERP_WAREHOUSE_LOOKUP_FAILED" }, 500)
        if ((warehouses ?? []).length !== 2 || warehouses.some((row) => String(row.branch_id ?? "") !== branchId)) return scopeMismatch()
      }
    }
    if (action === "create_supplier") {
      const { data: supplierResult, error: supplierError } = await supabaseAdmin.rpc("erp_supplier_create_backend", {
        p_actor_user_id: user.id, p_arguments: args
      })
      if (supplierError) {
        const denied = /UNAUTHENTICATED|MEMBERSHIP_REQUIRED|ROLE_REQUIRED|FORBIDDEN|SCOPE_REQUIRED|NOT_ALLOWED|BRANCH_SCOPE_REQUIRED/.test(String(supplierError.message ?? ""))
        console.error("[erp-runtime] supplier create rejected", { code: supplierError.code, denied })
        return json({ error: denied ? "ERP_OPERATION_FORBIDDEN" : /CODE_ALREADY_EXISTS/.test(String(supplierError.message ?? "")) ? "ERP_SUPPLIER_CODE_ALREADY_EXISTS" : "ERP_OPERATION_FAILED" }, denied ? 403 : 400)
      }
      return json({ success: true, result: supplierResult })
    }
    const { data, error } = await supabaseAdmin.rpc("erp_runtime_execute", {
      p_actor_user_id: user.id, p_operation: action, p_arguments: args
    })
    if (error) {
      const denied = /UNAUTHENTICATED|MEMBERSHIP_REQUIRED|ROLE_REQUIRED|FORBIDDEN|SCOPE_REQUIRED|NOT_ALLOWED|BRANCH_SCOPE_REQUIRED/.test(String(error.message ?? ""))
      console.error("[erp-runtime] mutation rejected", { action, code: error.code, denied })
      return json({ error: denied ? "ERP_OPERATION_FORBIDDEN" : "ERP_OPERATION_FAILED" }, denied ? 403 : 400)
    }
    return json({ success: true, result: data })
  }

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

    const { data: branches, error: branchesError } = await supabaseAdmin.from("branches")
      .select("id,business_id,name,code,status,address,phone")
      .eq("business_id", businessId).eq("status", "ACTIVE")
      .order("name", { ascending: true }).limit(100);
    if (branchesError) return json({ error: "Failed to load branches" }, 500);

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
      branches: branches ?? [],
      items: items ?? [],
      prices: pricesRes.data ?? [],
      options: optionsRes.data ?? []
    });
  }

  if (req.method === "POST" && path === "/api/v1/orders") {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400)
    const required = ["orderId","tenantId","businessId","clientIdempotencyKey","items","paymentMethod"]
    if (required.some((k) => body[k] == null || body[k] === "")) return json({ error: "Missing required order fields" }, 400)
    if (String(body.paymentMethod).toUpperCase() !== "CASH_ON_DELIVERY") return json({ error: "CASH_ONLY_LAUNCH" }, 400)
    if (!/^[0-9a-f-]{36}$/i.test(String(body.orderId))) return json({ error: "Invalid orderId" }, 400)
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) return json({ error: "Invalid items" }, 400)
    if (String(body.clientIdempotencyKey).length > 200) return json({ error: "Invalid idempotency key" }, 400)

    const { data: business, error: businessError } = await supabaseAdmin.from("businesses")
      .select("id,tenant_id,status").eq("id", String(body.businessId)).single()
    if (businessError || !business || String(business.status ?? "").toUpperCase() !== "ACTIVE")
      return json({ error: "Business not available" }, 404)
    const tenantId = String(business.tenant_id)
    if (String(body.tenantId) !== tenantId) return json({ error: "Business tenant mismatch" }, 403)

    const { data: membership } = await supabaseAdmin.from("user_memberships")
      .select("id,role").eq("user_id", user.id).eq("tenant_id", tenantId).eq("status", "ACTIVE")
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

    const { data: cashMethod, error: cashMethodError } = await supabaseAdmin.from("tenant_payment_methods").select("id")
      .eq("tenant_id", tenantId).eq("payment_method", "CASH_ON_DELIVERY")
      .eq("provider", "CASH_ON_DELIVERY").eq("is_enabled", true).limit(1).maybeSingle()
    if (cashMethodError) return json({ error: "Cash payment configuration unavailable" }, 500)
    if (!cashMethod) return json({ error: "Cash payment is not enabled for this tenant" }, 409)

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
      .select("id,tenant_id,business_id,total_amount,currency,customer_id,status").eq("id", orderId).single()
    if (orderError || !order) return json({ error: "Order not found" }, 404)
    if (!["PENDING","CREATED"].includes(String(order.status ?? "").toUpperCase()))
      return json({ error: "ORDER_NOT_PAYABLE" }, 409)

    const { data: memberships, error: membershipError } = await supabaseAdmin.from("user_memberships")
      .select("id,role,permissions,business_id").eq("user_id", user.id).eq("tenant_id", order.tenant_id).eq("status", "ACTIVE")
    if (membershipError) return json({ error: "Payment authorization check failed" }, 500)

    const isOrderOwner = String(order.customer_id) === String(user.id)
    const operationalPaymentAccess = (memberships || []).some((m: any) => {
      const role = String(m.role ?? "").toUpperCase()
      const permissions = m.permissions && typeof m.permissions === "object" ? m.permissions : []
      const hasCreatePermission = Array.isArray(permissions)
        ? permissions.includes("PAYMENT_CREATE")
        : permissions.PAYMENT_CREATE === true
      const businessScoped = !m.business_id || String(m.business_id) === String(order.business_id)
      return businessScoped && (["SUPER_ADMIN","ADMIN","OWNER","MANAGER","CASHIER","STAFF"].includes(role) || hasCreatePermission)
    })
    if (!isOrderOwner && !operationalPaymentAccess) return json({ error: "Forbidden" }, 403)

    const { data: configuredMethod } = await supabaseAdmin.from("tenant_payment_methods").select("id")
      .eq("tenant_id", order.tenant_id).eq("payment_method", "CASH_ON_DELIVERY")
      .eq("provider", "CASH_ON_DELIVERY").eq("is_enabled", true).limit(1).maybeSingle()
    if (!configuredMethod) return json({ error: "Cash payment is not enabled for this tenant" }, 409)

    const normalizedIdempotencyKey = String(idempotencyKey)
    const { data: existingIntent, error: existingIntentError } = await supabaseAdmin.from("payment_intents")
      .select("*").eq("tenant_id", order.tenant_id).eq("idempotency_key", normalizedIdempotencyKey).maybeSingle()
    if (existingIntentError) return json({ error: "Failed to verify payment intent idempotency" }, 500)
    const matchesCashOrder = (intent: any) =>
      String(intent.order_id) === String(order.id) &&
      String(intent.provider) === "CASH_ON_DELIVERY" &&
      String(intent.payment_method) === "CASH_ON_DELIVERY" &&
      Number(intent.amount) === Number(order.total_amount) &&
      String(intent.currency).toUpperCase() === String(order.currency).toUpperCase()
    if (existingIntent) {
      if (!matchesCashOrder(existingIntent)) return json({ error: "Idempotency key is already bound to another payment" }, 409)
      return json(existingIntent)
    }

    const newIntent = {
      id: crypto.randomUUID(),
      tenant_id: order.tenant_id,
      order_id: order.id,
      amount: order.total_amount,
      currency: order.currency,
      status: "CREATED",
      provider: "CASH_ON_DELIVERY",
      payment_method: "CASH_ON_DELIVERY",
      idempotency_key: normalizedIdempotencyKey,
    }
    const { data, error } = await supabaseAdmin.from("payment_intents")
      .insert(newIntent).select().single()
    if (error) {
      const { data: racedIntent } = await supabaseAdmin.from("payment_intents")
        .select("*").eq("tenant_id", order.tenant_id).eq("idempotency_key", normalizedIdempotencyKey).maybeSingle()
      if (racedIntent && matchesCashOrder(racedIntent)) return json(racedIntent)
      if (racedIntent) return json({ error: "Idempotency key is already bound to another payment" }, 409)
      return json({ error: "Failed to create payment intent" }, 500)
    }
    return json(data)
  }

  const cashOrderPaymentMatch = path.match(/^\/api\/v1\/orders\/([^/]+)\/cash-payment$/)
  if (req.method === "GET" && cashOrderPaymentMatch) {
    const orderId = cashOrderPaymentMatch[1]
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "Invalid orderId" }, 400)
    const { data: order, error: orderError } = await supabaseAdmin.from("orders")
      .select("id,tenant_id,business_id,customer_id,status,total_amount,currency")
      .eq("id", orderId).maybeSingle()
    if (orderError || !order) return json({ error: "Order not found" }, 404)
    const isCustomer = String(order.customer_id) === String(user.id)
    const { data: memberships, error: membershipError } = await supabaseAdmin.from("user_memberships")
      .select("role,permissions,business_id").eq("user_id", user.id).eq("tenant_id", order.tenant_id).eq("status", "ACTIVE")
    if (membershipError) return json({ error: "Payment access check failed" }, 500)
    const operationalRead = (memberships || []).some((m: any) => {
      const role = String(m.role || "").toUpperCase()
      const permissions = m.permissions && typeof m.permissions === "object" ? m.permissions : []
      const hasReadPermission = Array.isArray(permissions)
        ? permissions.includes("PAYMENT_READ_ALL")
        : permissions.PAYMENT_READ_ALL === true
      const businessScoped = !m.business_id || String(m.business_id) === String(order.business_id)
      return businessScoped && (["SUPER_ADMIN","ADMIN","OWNER","MANAGER","CASHIER","STAFF"].includes(role) || hasReadPermission)
    })
    if (!isCustomer && !operationalRead) return json({ error: "Forbidden" }, 403)
    const { data: paymentIntent, error: paymentError } = await supabaseAdmin.from("payment_intents")
      .select("id,tenant_id,order_id,amount,currency,status,provider,payment_method,created_at")
      .eq("tenant_id", order.tenant_id).eq("order_id", order.id)
      .eq("provider", "CASH_ON_DELIVERY").eq("payment_method", "CASH_ON_DELIVERY")
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
    if (paymentError) return json({ error: "Cash payment lookup failed" }, 500)
    return json({ order, paymentIntent: paymentIntent || null })
  }


  const paymentIntentMatch = path.match(/^\/api\/v1\/payments\/intents\/([^/]+)$/)
  if (req.method === "GET" && paymentIntentMatch) {
    const { data: intent, error } = await supabaseAdmin.from("payment_intents").select("*").eq("id", paymentIntentMatch[1]).single()
    if (error || !intent) return json({ error: "Intent not found" }, 404)
    const { data: linkedOrder, error: linkedOrderError } = await supabaseAdmin.from("orders")
      .select("customer_id,business_id").eq("id", intent.order_id).eq("tenant_id", intent.tenant_id).maybeSingle()
    if (linkedOrderError) return json({ error: "Payment order lookup failed" }, 500)
    if (!linkedOrder) return json({ error: "Linked order not found" }, 404)
    const isOrderCustomer = String(linkedOrder.customer_id) === String(user.id)
    if (!isOrderCustomer) {
      const { data: memberships, error: membershipError } = await supabaseAdmin.from("user_memberships")
        .select("role,permissions,business_id").eq("user_id", user.id).eq("tenant_id", intent.tenant_id).eq("status", "ACTIVE")
      if (membershipError) return json({ error: "Payment access check failed" }, 500)
      const operationalPaymentRead = (memberships || []).some((m: any) => {
        const role = String(m.role ?? "").toUpperCase()
        const permissions = m.permissions && typeof m.permissions === "object" ? m.permissions : []
        const hasReadPermission = Array.isArray(permissions)
          ? permissions.includes("PAYMENT_READ_ALL")
          : permissions.PAYMENT_READ_ALL === true
        const businessScoped = !m.business_id || String(m.business_id) === String(linkedOrder.business_id)
        return businessScoped && (["SUPER_ADMIN","ADMIN","OWNER","MANAGER","CASHIER","STAFF"].includes(role) || hasReadPermission)
      })
      if (!operationalPaymentRead) return json({ error: "Forbidden" }, 403)
    }
    return json(intent)
  }

  const cashConfirmMatch = path.match(/^\/api\/v1\/payments\/([^/]+)\/cash\/confirm$/)
  if (req.method === "POST" && cashConfirmMatch) {
    const intentId = cashConfirmMatch[1]
    const { data: intent, error: intentError } = await supabaseAdmin.from("payment_intents")
      .select("tenant_id,order_id,provider,payment_method,status").eq("id", intentId).single()
    if (intentError || !intent) return json({ error: "Payment intent not found" }, 404)
    if (intent.provider !== "CASH_ON_DELIVERY" || intent.payment_method !== "CASH_ON_DELIVERY") return json({ error: "CASH_PAYMENT_REQUIRED" }, 409)
    const { data: order, error: orderError } = await supabaseAdmin.from("orders")
      .select("id,business_id,status").eq("id", intent.order_id).eq("tenant_id", intent.tenant_id).maybeSingle()
    if (orderError || !order) return json({ error: "Linked order not found" }, 404)
    const { data: memberships, error: membershipError } = await supabaseAdmin.from("user_memberships")
      .select("role,permissions,business_id").eq("user_id", user.id).eq("tenant_id", intent.tenant_id).eq("status", "ACTIVE")
    if (membershipError) return json({ error: "Cash confirmation authorization failed" }, 500)
    const authorized = (memberships || []).some((m: any) => {
      const role = String(m.role ?? "").toUpperCase()
      const permissions = m.permissions && typeof m.permissions === "object" ? m.permissions : []
      const hasCashPermission = Array.isArray(permissions)
        ? permissions.includes("PAYMENT_CONFIRM_CASH")
        : permissions.PAYMENT_CONFIRM_CASH === true
      const businessScoped = !m.business_id || String(m.business_id) === String(order.business_id)
      return businessScoped && (["ADMIN","MANAGER","CASHIER","STAFF","OWNER"].includes(role) || hasCashPermission)
    })
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