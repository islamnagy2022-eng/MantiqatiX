import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const maxBodyBytes = 20000;
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const contentLength = Number(req.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) return json({ error: "payload_too_large" }, 413);

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

  const rawBytes = await readLimitedBody(req, maxBodyBytes);
  if (rawBytes === null) return json({ error: "payload_too_large" }, 413);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(new TextDecoder().decode(rawBytes));
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body || Array.isArray(body) || typeof body !== "object") return json({ error: "invalid_body" }, 400);

  if (body.business_id !== undefined && body.business_id !== null && typeof body.business_id !== "string") {
    return json({ error: "business_not_authorized" }, 403);
  }
  const requestedBusinessId = typeof body.business_id === "string" ? body.business_id.trim() || null : null;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const serviceArea = typeof body.service_area === "string" ? body.service_area.trim() : "";
  const budgetMin = body.budget_min === undefined || body.budget_min === null ? 0 : body.budget_min;
  const budgetMax = body.budget_max === undefined || body.budget_max === null ? 0 : body.budget_max;
  if (body.required_services !== undefined && !Array.isArray(body.required_services)) {
    return json({ error: "invalid_required_services" }, 400);
  }
  const rawRequiredServices = Array.isArray(body.required_services) ? body.required_services : [];
  if (rawRequiredServices.some(x => typeof x !== "string")) {
    return json({ error: "invalid_required_services" }, 400);
  }
  const requiredServices = rawRequiredServices.map(x => x.trim()).filter(Boolean);

  if (!title || title.length > 200) return json({ error: "invalid_title" }, 400);
  if (!description || description.length > 5000) return json({ error: "invalid_description" }, 400);
  if (serviceArea.length > 200) return json({ error: "invalid_service_area" }, 400);
  if (requiredServices.length > 10 || requiredServices.some(x => x.length > 80)) return json({ error: "invalid_required_services" }, 400);
  if (typeof budgetMin !== "number" || typeof budgetMax !== "number" ||
      !Number.isFinite(budgetMin) || !Number.isFinite(budgetMax) || budgetMin < 0 || budgetMax < budgetMin) {
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

async function readLimitedBody(req: Request, limit: number): Promise<Uint8Array | null> {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > limit) {
      try { await reader.cancel(); } catch { /* stream is already closed */ }
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
