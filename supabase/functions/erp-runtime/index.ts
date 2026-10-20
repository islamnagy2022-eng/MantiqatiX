import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "content-type": "application/json",
  "access-control-allow-origin": "https://islamnagy2022-eng.github.io",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
  "vary": "Origin",
  "cache-control": "no-store",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const allowedOperations = new Set([
  "create_purchase_order", "update_purchase_order_status", "receive_purchase_stock",
  "create_stock_transfer", "update_stock_transfer_status", "receive_stock_transfer",
]);
const safeRows = (rows: any[], fields: string[]) => (rows ?? []).map(row =>
  Object.fromEntries(fields.filter(field => Object.prototype.hasOwnProperty.call(row, field)).map(field => [field, row[field]]))
);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && origin !== "https://islamnagy2022-eng.github.io") return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
    return new Response("ok", { status: 200, headers });
  }
  if (origin && origin !== "https://islamnagy2022-eng.github.io") return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ error: "SERVER_CONFIGURATION_ERROR" }, 500);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user || user.is_anonymous) return json({ error: "AUTH_REQUIRED" }, 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "INVALID_REQUEST" }, 400);

    if (body.operation === "list") {
      const tenantId = String(body.tenantId ?? "").trim();
      const businessId = String(body.businessId ?? "").trim();
      const branchId = body.branchId ? String(body.branchId).trim() : "";
      if (!tenantId || !businessId) return json({ error: "ERP_SCOPE_REQUIRED" }, 400);
      const { data: membership, error: membershipError } = await admin.from("user_memberships")
        .select("role,business_id,branch_id").eq("user_id", user.id).eq("tenant_id", tenantId)
        .eq("business_id", businessId).eq("status", "ACTIVE").limit(1).maybeSingle();
      if (membershipError) throw new Error("ERP_MEMBERSHIP_LOOKUP_FAILED");
      const role = String(membership?.role ?? "").toUpperCase();
      if (!membership || !["OWNER","BUSINESS_OWNER","ADMIN","MANAGER","EMPLOYEE","STAFF","ACCOUNTANT","FINANCE_MANAGER","FINANCE"].includes(role))
        return json({ error: "ERP_MEMBERSHIP_REQUIRED" }, 403);
      if (branchId && membership.branch_id && String(membership.branch_id) !== branchId && !["OWNER","BUSINESS_OWNER","ADMIN","MANAGER"].includes(role))
        return json({ error: "ERP_BRANCH_SCOPE_REQUIRED" }, 403);
      const { data: business, error: businessError } = await admin.from("businesses")
        .select("id,tenant_id,status").eq("id", businessId).eq("tenant_id", tenantId).maybeSingle();
      if (businessError) throw new Error("ERP_BUSINESS_LOOKUP_FAILED");
      if (!business || String(business.status ?? "").toUpperCase() !== "ACTIVE") return json({ error: "ERP_BUSINESS_SCOPE_INVALID" }, 403);

      let warehouseQuery = admin.from("warehouses").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).limit(100).order("name", { ascending: true });
      if (branchId) warehouseQuery = warehouseQuery.eq("branch_id", branchId);
      const { data: warehousesData, error: warehousesError } = await warehouseQuery;
      if (warehousesError) {
        console.error("erp-runtime warehouse query failed", { code: warehousesError.code });
        return json({ error: "ERP_DATA_LOAD_FAILED" }, 500);
      }
      const warehouseIds = (warehousesData ?? []).map((row: any) => String(row.id));
      let ordersQuery = admin.from("erp_purchase_orders").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).limit(100).order("created_at", { ascending: false });
      if (branchId) ordersQuery = ordersQuery.or(`branch_id.is.null,branch_id.eq.${branchId}`);
      let receiptsQuery = admin.from("erp_purchase_receipts").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).limit(100).order("created_at", { ascending: false });
      if (branchId) receiptsQuery = warehouseIds.length ? receiptsQuery.in("warehouse_id", warehouseIds) : receiptsQuery.in("warehouse_id", ["00000000-0000-0000-0000-000000000000"]);
      const [ordersRes, receiptsRes] = await Promise.all([ordersQuery, receiptsQuery]);
      let transfers: any[] = [];
      if (!branchId) {
        const { data, error } = await admin.from("erp_stock_transfers").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).limit(100).order("created_at", { ascending: false });
        if (error) {
          console.error("erp-runtime transfer query failed", { code: error.code });
          return json({ error: "ERP_DATA_LOAD_FAILED" }, 500);
        }
        transfers = data ?? [];
      } else if (warehouseIds.length) {
        const [fromRes, toRes] = await Promise.all([
          admin.from("erp_stock_transfers").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).in("from_warehouse_id", warehouseIds).limit(100).order("created_at", { ascending: false }),
          admin.from("erp_stock_transfers").select("*").eq("tenant_id", tenantId).eq("business_id", businessId).in("to_warehouse_id", warehouseIds).limit(100).order("created_at", { ascending: false }),
        ]);
        if (fromRes.error || toRes.error) {
          console.error("erp-runtime branch transfer query failed", { from: !!fromRes.error, to: !!toRes.error });
          return json({ error: "ERP_DATA_LOAD_FAILED" }, 500);
        }
        transfers = [...new Map([...(fromRes.data ?? []), ...(toRes.data ?? [])].map((row: any) => [String(row.id), row])).values()];
      }
      if (ordersRes.error || receiptsRes.error) {
        console.error("erp-runtime list query failed", { orders: !!ordersRes.error, receipts: !!receiptsRes.error });
        return json({ error: "ERP_DATA_LOAD_FAILED" }, 500);
      }
      return json({
        success: true,
        orders: safeRows(ordersRes.data ?? [], ["id","tenant_id","business_id","branch_id","order_number","supplier_id","total_amount","tax_amount","discount_amount","status","reason","created_at","updated_at"]),
        receipts: safeRows(receiptsRes.data ?? [], ["id","tenant_id","business_id","purchase_order_id","receipt_number","warehouse_id","product_id","received_quantity","unit_cost","status","created_at"]),
        transfers: safeRows(transfers, ["id","tenant_id","business_id","transfer_number","from_warehouse_id","to_warehouse_id","product_id","quantity","status","created_at","updated_at"]),
        warehouses: safeRows(warehousesData ?? [], ["id","tenant_id","business_id","branch_id","name","code","status"]),
      });
    }

    if (body.operation !== "mutate") return json({ error: "INVALID_OPERATION" }, 400);
    const action = String(body.action ?? "");
    if (!allowedOperations.has(action)) return json({ error: "ERP_OPERATION_NOT_ALLOWED" }, 400);
    const args = body.arguments;
    if (!args || typeof args !== "object" || Array.isArray(args)) return json({ error: "INVALID_ARGUMENTS" }, 400);
    const { data, error } = await admin.rpc("erp_runtime_execute", {
      p_actor_user_id: user.id,
      p_operation: action,
      p_arguments: args,
    });
    if (error) {
      const message = String(error.message ?? "");
      const denied = /UNAUTHENTICATED|MEMBERSHIP_REQUIRED|ROLE_REQUIRED|FORBIDDEN|SCOPE_REQUIRED|NOT_ALLOWED/.test(message);
      console.error("erp-runtime mutation rejected", { action, code: error.code, denied });
      return json({ error: denied ? "ERP_OPERATION_FORBIDDEN" : "ERP_OPERATION_FAILED" }, denied ? 403 : 400);
    }
    return json({ success: true, result: data });
  } catch (error) {
    console.error("erp-runtime failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "ERP_RUNTIME_FAILED" }, 500);
  }
});
