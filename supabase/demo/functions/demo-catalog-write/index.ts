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

  // The SQL helper verifies the business tag; verify the branch's DEMO tag here as well.
  const { data: branchScope, error: branchScopeError } = await admin.from("branches")
    .select("id,tenant_id,business_id,status,settings")
    .eq("id", branchId).eq("tenant_id", "MNTY-PLATFORM")
    .eq("business_id", businessId).eq("status", "ACTIVE").maybeSingle();
  if (branchScopeError) return reply({ error: "DEMO_BRANCH_LOOKUP_FAILED" }, 500, origin);
  if (!branchScope || branchScope.settings?.environment !== "DEMO") {
    return reply({ error: "DEMO_BRANCH_SCOPE_REQUIRED" }, 403, origin);
  }

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

  if (operation === "update-item") {
    const itemId = String(body.itemId || "");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const stock = Number(body.stock);
    const itemType = String(body.itemType || "PRODUCT").toUpperCase();
    if (!/^[0-9a-f-]{36}$/i.test(itemId)) return reply({ error: "INVALID_ITEM_ID" }, 400, origin);
    if (name.length < 1 || name.length > 180) return reply({ error: "INVALID_NAME" }, 400, origin);
    if (description.length > 400) return reply({ error: "DESCRIPTION_TOO_LONG" }, 400, origin);
    if (!Number.isInteger(stock) || stock < 0 || stock > 10000000) return reply({ error: "INVALID_STOCK" }, 400, origin);
    if (!["PRODUCT", "SERVICE"].includes(itemType)) return reply({ error: "INVALID_ITEM_TYPE" }, 400, origin);

    const { data: memberships, error: membershipError } = await admin.from("user_memberships")
      .select("role,status")
      .eq("user_id", user.id).eq("tenant_id", "MNTY-PLATFORM")
      .eq("business_id", businessId).eq("branch_id", branchId).eq("status", "ACTIVE")
      .limit(20);
    if (membershipError) return reply({ error: "DEMO_MEMBERSHIP_CHECK_FAILED" }, 500, origin);
    const canWrite = (memberships || []).some((m: any) =>
      ["OWNER", "BUSINESS_OWNER", "ADMIN", "MANAGER"].includes(String(m.role || "").toUpperCase()));
    if (!canWrite) return reply({ error: "DEMO_CATALOG_WRITE_FORBIDDEN" }, 403, origin);

    const { data: existing, error: itemLookupError } = await admin.from("catalog_items")
      .select("id,metadata")
      .eq("id", itemId).eq("tenant_id", "MNTY-PLATFORM")
      .eq("business_id", businessId).eq("branch_id", branchId).eq("status", "ACTIVE")
      .maybeSingle();
    if (itemLookupError) return reply({ error: "DEMO_CATALOG_ITEM_LOOKUP_FAILED" }, 500, origin);
    if (!existing || existing.metadata?.environment !== "DEMO" || existing.metadata?.synthetic_only !== true) {
      return reply({ error: "DEMO_CATALOG_ITEM_SCOPE_REQUIRED" }, 403, origin);
    }
    const metadata = { ...(existing.metadata || {}), environment: "DEMO", synthetic_only: true, demo_stock: stock };
    const { data: updatedItem, error: updateError } = await admin.from("catalog_items")
      .update({ name_ar: name, description: description || null, item_type: itemType, metadata, updated_at: new Date().toISOString() })
      .eq("id", itemId).eq("tenant_id", "MNTY-PLATFORM")
      .eq("business_id", businessId).eq("branch_id", branchId)
      .select("id,name_ar,description,item_type,branch_id,metadata").maybeSingle();
    if (updateError || !updatedItem) {
      console.error("demo catalog item update failed", updateError?.message || "NO_ROW");
      return reply({ error: "DEMO_CATALOG_ITEM_UPDATE_FAILED" }, 400, origin);
    }
    return reply({ ok: true, item: updatedItem, environment: "DEMO" }, 200, origin);
  }

  if (operation === "business-profile") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (name.length < 2 || name.length > 100) return reply({ error: "INVALID_BUSINESS_NAME" }, 400, origin);
    if (phone.length > 30 || city.length > 70 || description.length > 400) return reply({ error: "BUSINESS_FIELD_TOO_LONG" }, 400, origin);

    const { data: memberships, error: membershipError } = await admin.from("user_memberships")
      .select("role,status")
      .eq("user_id", user.id).eq("tenant_id", "MNTY-PLATFORM")
      .eq("business_id", businessId).eq("branch_id", branchId).eq("status", "ACTIVE")
      .limit(20);
    if (membershipError) return reply({ error: "DEMO_MEMBERSHIP_CHECK_FAILED" }, 500, origin);
    if (!(memberships || []).some((m: any) => String(m.role || "").toUpperCase() === "OWNER")) {
      return reply({ error: "DEMO_OWNER_REQUIRED" }, 403, origin);
    }

    const { data: business, error: businessLookupError } = await admin.from("businesses")
      .select("id,name,settings")
      .eq("id", businessId).eq("tenant_id", "MNTY-PLATFORM").eq("status", "ACTIVE").maybeSingle();
    if (businessLookupError) return reply({ error: "DEMO_BUSINESS_LOOKUP_FAILED" }, 500, origin);
    if (!business || business.settings?.environment !== "DEMO") return reply({ error: "DEMO_BUSINESS_SCOPE_REQUIRED" }, 403, origin);

    const settings = { ...(business.settings || {}), environment: "DEMO", demo: true, phone, city, description, payments_enabled: false, external_notifications_enabled: false };
    const { data: updatedBusiness, error: updateBusinessError } = await admin.from("businesses")
      .update({ name, settings }).eq("id", businessId).eq("tenant_id", "MNTY-PLATFORM")
      .select("id,name,settings").maybeSingle();
    if (updateBusinessError || !updatedBusiness) return reply({ error: "DEMO_BUSINESS_PROFILE_UPDATE_FAILED" }, 400, origin);

    const { error: branchUpdateError } = await admin.from("branches")
      .update({ name: name + " - الفرع الرئيسي", phone: phone || null, address: city || null })
      .eq("id", branchId).eq("business_id", businessId).eq("tenant_id", "MNTY-PLATFORM").eq("status", "ACTIVE");
    if (branchUpdateError) {
      console.error("demo branch profile sync failed", branchUpdateError.message);
      return reply({ ok: true, warning: "BUSINESS_SAVED_BRANCH_SYNC_FAILED", business: updatedBusiness }, 200, origin);
    }
    return reply({ ok: true, business: updatedBusiness, environment: "DEMO" }, 200, origin);
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