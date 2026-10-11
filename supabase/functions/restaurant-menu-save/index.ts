import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const maxBodyBytes = 12000;
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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    if (origin && origin !== allowedOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (origin && origin !== allowedOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const contentLength = Number(req.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "SERVER_MISCONFIGURED" }, 500);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const actor = authData?.user;
  if (authError || !actor || actor.is_anonymous) return json({ error: "UNAUTHORIZED" }, 401);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "INVALID_BODY" }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const action = String(body.action || "").toUpperCase();
  const itemId = String(body.itemId || "").trim();
  const tenantId = String(body.tenantId || "").trim();
  const businessId = String(body.businessId || "").trim();
  const branchId = String(body.branchId || "").trim();
  const name = String(body.name_ar || "").trim();
  const description = String(body.description_ar || "").trim();
  const category = String(body.category || "").trim();
  const price = Number(body.base_price_egp);
  const isAvailable = body.is_available;
  const isPopular = body.is_popular;

  if (!["CREATE", "UPDATE"].includes(action)) return json({ error: "INVALID_MENU_ACTION" }, 400);
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return json({ error: "INVALID_MENU_ITEM_ID" }, 400);
  if (!tenantId || tenantId.length > 120 || !branchId || branchId.length > 120 || !/^[0-9a-f-]{36}$/i.test(businessId)) {
    return json({ error: "INVALID_MENU_SCOPE" }, 400);
  }
  if (!name || name.length > 200 || description.length > 2000 || !category || category.length > 120) {
    return json({ error: "INVALID_MENU_FIELDS" }, 400);
  }
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000_000) return json({ error: "INVALID_MENU_PRICE" }, 400);
  if (typeof isAvailable !== "boolean" || typeof isPopular !== "boolean") return json({ error: "INVALID_MENU_FLAGS" }, 400);

  const payload = {
    id: itemId,
    tenant_id: tenantId,
    business_id: businessId,
    branch_id: branchId,
    name_ar: name,
    description_ar: description,
    category,
    base_price_egp: price,
    is_available: isAvailable,
    is_popular: isPopular,
  };
  const { data, error } = await admin.rpc("restaurant_menu_catalog_mutate_backend", {
    p_actor_user_id: actor.id,
    p_action: action,
    p_payload: payload,
  });
  if (error) {
    const code = String(error.message || "RESTAURANT_MENU_SAVE_FAILED").slice(0, 180);
    const status = /FORBIDDEN|UNAVAILABLE|SCOPE_CONFLICT|NOT_FOUND/i.test(code) ? 403 : 400;
    return json({ error: code }, status);
  }
  return json(data ?? { ok: true });
});
