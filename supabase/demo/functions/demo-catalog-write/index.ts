import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);
const headers = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
});
const reply = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: headers(origin) });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) return reply({ error: "ORIGIN_NOT_ALLOWED" }, 403, origin);
    return new Response("ok", { status: 200, headers: headers(origin) });
  }
  if (origin && !allowedOrigins.has(origin)) return reply({ error: "ORIGIN_NOT_ALLOWED" }, 403, origin);
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405, origin);
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return reply({ error: "AUTH_REQUIRED" }, 401, origin);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return reply({ error: "SERVER_MISCONFIGURED" }, 500, origin);
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7).trim());
  if (authError || !user || user.is_anonymous) return reply({ error: "UNAUTHORIZED" }, 401, origin);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "INVALID_BODY" }, 400, origin);
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: "INVALID_JSON" }, 400, origin);
  }
  const operation = String(body.operation || "");
  const businessId = String(body.businessId || "");
  const branchId = String(body.branchId || "");
  if (!businessId || !branchId) return reply({ error: "DEMO_SCOPE_REQUIRED" }, 400, origin);

  if (operation === "item") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const itemType = String(body.itemType || "PRODUCT").toUpperCase();
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const price = Number(body.price);
    const stock = Number(body.stock);
    if (name.length < 1 || name.length > 180) return reply({ error: "INVALID_NAME" }, 400, origin);
    if (!["PRODUCT", "SERVICE"].includes(itemType)) return reply({ error: "INVALID_ITEM_TYPE" }, 400, origin);
    if (!Number.isFinite(price) || price < 0 || price > 100000000) return reply({ error: "INVALID_PRICE" }, 400, origin);
    if (!Number.isInteger(stock) || stock < 0 || stock > 10000000) return reply({ error: "INVALID_STOCK" }, 400, origin);
    if (description.length > 400) return reply({ error: "DESCRIPTION_TOO_LONG" }, 400, origin);

    const { data: saved, error: saveError } = await admin.rpc("demo_upsert_catalog_item_price_atomic", {
      p_actor_user_id: user.id,
      p_tenant_id: "MNTY-PLATFORM",
      p_business_id: businessId,
      p_branch_id: branchId,
      p_item_type: itemType,
      p_name_ar: name,
      p_name_en: null,
      p_description: description || null,
      p_sku: null,
      p_tax_rate: 0,
      p_unit_price: price,
      p_demo_stock: stock,
      p_currency: "EGP",
    });
    if (saveError || !saved?.ok) {
      console.error("demo catalogue item and price write failed", saveError?.message || "NO_RESULT");
      return reply({ error: "DEMO_CATALOG_ITEM_PRICE_WRITE_FAILED", detail: saveError?.message || "NO_RESULT" }, 400, origin);
    }
    return reply({ ok: true, ...saved }, 200, origin);
  }

  if (operation === "price") {
    const itemId = String(body.itemId || "");
    const price = Number(body.price);
    if (!itemId || !Number.isFinite(price) || price < 0 || price > 100000000) return reply({ error: "INVALID_PRICE_REQUEST" }, 400, origin);
    const { data, error } = await admin.rpc("demo_upsert_catalog_price_atomic", {
      p_actor_user_id: user.id,
      p_tenant_id: "MNTY-PLATFORM",
      p_business_id: businessId,
      p_branch_id: branchId,
      p_catalog_item_id: itemId,
      p_unit_price: price,
      p_currency: "EGP",
    });
    if (error) {
      console.error("demo catalogue price update failed", error.message);
      return reply({ error: "DEMO_CATALOG_PRICE_WRITE_FAILED", detail: error.message }, 400, origin);
    }
    return reply({ ok: true, price: data }, 200, origin);
  }
  return reply({ error: "UNSUPPORTED_DEMO_CATALOG_OPERATION" }, 400, origin);
});