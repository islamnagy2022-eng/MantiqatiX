import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const maxBodyBytes = 16 * 1024;
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const isUuid = (value: unknown) => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isRecordId = (value: unknown) => typeof value === "string"
  && value.trim().length > 0 && value.length <= 128 && !/[\\u0000-\\u001f]/.test(value);
const roles = new Set(["OWNER", "ADMIN", "MANAGER", "BUSINESS_OWNER", "SERVICE_PROVIDER", "STAFF"]);
const tableStatuses = new Set(["EMPTY", "OCCUPIED", "RESERVED", "CLEANING", "OUT_OF_SERVICE"]);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    if (origin && origin !== allowedOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (origin && origin !== allowedOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);
  const token = authHeader.slice(7).trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "SERVER_MISCONFIGURED" }, 500);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const actor = authData?.user;
  if (authError || !actor || actor.is_anonymous) return json({ error: "UNAUTHORIZED" }, 401);

  const contentLength = Number(req.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
  let body: any;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "INVALID_BODY" }, 400);
  if (!["TABLE_SAVE", "INVENTORY_SAVE"].includes(body.action)) return json({ error: "INVALID_ACTION" }, 400);
  if (typeof body.tenantId !== "string" || !body.tenantId.trim() || body.tenantId.length > 120
      || !isUuid(body.businessId) || typeof body.branchId !== "string" || !body.branchId.trim() || body.branchId.length > 120) {
    return json({ error: "INVALID_WORKSPACE_SCOPE" }, 400);
  }

  const { data: memberships, error: membershipError } = await admin
    .from("user_memberships")
    .select("id,role,branch_id")
    .eq("user_id", actor.id)
    .eq("tenant_id", body.tenantId.trim())
    .eq("business_id", body.businessId)
    .eq("branch_id", body.branchId.trim())
    .eq("status", "ACTIVE")
    .limit(20);
  if (membershipError) return json({ error: "MEMBERSHIP_READ_FAILED" }, 500);
  if (!(memberships ?? []).some((m: any) => roles.has(String(m.role ?? "").toUpperCase()))) {
    return json({ error: "FORBIDDEN_WORKSPACE_SCOPE" }, 403);
  }

  const scope = { tenant_id: body.tenantId.trim(), business_id: body.businessId, branch_id: body.branchId.trim() };
  if (body.action === "TABLE_SAVE") {
    const tableNumber = Number(body.tableNumber);
    const capacity = Number(body.capacityPersons);
    const status = String(body.status ?? "EMPTY").toUpperCase();
    const reservedName = body.reservedCustomerName == null ? null : String(body.reservedCustomerName).trim();
    if (!Number.isSafeInteger(tableNumber) || tableNumber < 1 || tableNumber > 100000
        || !Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1000
        || !tableStatuses.has(status) || (reservedName && reservedName.length > 200)) {
      return json({ error: "INVALID_TABLE_DATA" }, 400);
    }
    const { data, error } = await admin.rpc("restaurant_workspace_mutate_backend", {
      p_action: "TABLE_SAVE",
      p_payload: { tableId: body.tableId ?? null, tableNumber, capacityPersons: capacity, status, reservedCustomerName: reservedName || null },
      p_actor_user_id: actor.id,
      p_tenant_id: scope.tenant_id,
      p_business_id: scope.business_id,
      p_branch_id: scope.branch_id,
    });
    if (error) return json({ error: "TABLE_MUTATION_FAILED" }, 409);
    return json(data);
  }

  const inventoryId = body.inventoryId;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  const stock = Number(body.currentStockQty);
  const minimum = Number(body.minStockAlertThreshold);
  const cost = Number(body.unitCostEgp);
  const supplier = body.supplierName == null ? null : String(body.supplierName).trim();
  if (!name || name.length > 200 || !unit || unit.length > 32
      || ![stock, minimum, cost].every(Number.isFinite)
      || stock < 0 || stock > 1_000_000_000 || minimum < 0 || minimum > 1_000_000_000
      || cost < 0 || cost > 1_000_000_000 || (supplier && supplier.length > 200)) {
    return json({ error: "INVALID_INVENTORY_DATA" }, 400);
  }
  const { data, error } = await admin.rpc("restaurant_workspace_mutate_backend", {
    p_action: "INVENTORY_SAVE",
    p_payload: { inventoryId: inventoryId ?? null, name, unit, currentStockQty: stock, minStockAlertThreshold: minimum, unitCostEgp: cost, supplierName: supplier || null },
    p_actor_user_id: actor.id,
    p_tenant_id: scope.tenant_id,
    p_business_id: scope.business_id,
    p_branch_id: scope.branch_id,
  });
  if (error) return json({ error: "INVENTORY_MUTATION_FAILED" }, 409);
  return json(data);
});
