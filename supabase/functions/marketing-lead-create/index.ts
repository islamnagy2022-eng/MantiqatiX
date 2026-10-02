import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const origin = req.headers.get("Origin");
  if (origin && origin !== allowedOrigin) return json({ error: "origin_not_allowed" }, 403);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_authorization" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "server_configuration_error" }, 500);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  const actor = data.user;
  if (error || !actor || actor.is_anonymous) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const requestedBusinessId = String(body.business_id || "").trim() || null;
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const serviceArea = String(body.service_area || "").trim();
  const budgetMin = Number(body.budget_min || 0);
  const budgetMax = Number(body.budget_max || 0);
  const requiredServices = Array.isArray(body.required_services)
    ? body.required_services.map(x => String(x || "").trim()).filter(Boolean)
    : [];

  if (!title || title.length > 200) return json({ error: "invalid_title" }, 400);
  if (!description || description.length > 5000) return json({ error: "invalid_description" }, 400);
  if (serviceArea.length > 200) return json({ error: "invalid_service_area" }, 400);
  if (requiredServices.length > 10 || requiredServices.some(x => x.length > 80)) return json({ error: "invalid_required_services" }, 400);
  if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax) || budgetMin < 0 || budgetMax < budgetMin) {
    return json({ error: "invalid_budget" }, 400);
  }

  const { data: memberships, error: membershipError } = await admin
    .from("user_memberships")
    .select("business_id")
    .eq("user_id", actor.id)
    .eq("status", "ACTIVE")
    .limit(50);
  if (membershipError) return json({ error: "membership_lookup_failed" }, 500);

  const businessIds = (memberships || []).map(x => x.business_id).filter(Boolean);
  if (requestedBusinessId && !businessIds.includes(requestedBusinessId)) {
    return json({ error: "business_not_authorized" }, 403);
  }
  if (businessIds.length > 1 && !requestedBusinessId) {
    return json({ error: "business_selection_required" }, 400);
  }
  const businessId = requestedBusinessId || businessIds[0] || null;
  const lead = {
    id: crypto.randomUUID(),
    requester_user_id: actor.id,
    requester_business_id: businessId,
    title,
    description,
    budget_min: budgetMin,
    budget_max: budgetMax,
    currency: "EGP",
    required_services: requiredServices,
    service_area: serviceArea,
    status: "OPEN",
    source: "PLATFORM",
  };

  const { data: created, error: insertError } = await admin
    .from("marketing_leads")
    .insert(lead)
    .select("id,title,status,source,created_at")
    .single();

  if (insertError) return json({ error: "lead_creation_failed" }, 500);
  return json({ ok: true, lead: created });
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
