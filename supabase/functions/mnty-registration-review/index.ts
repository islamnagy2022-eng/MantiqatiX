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

  let body: { request_id?: string; decision?: "APPROVED" | "REJECTED"; tenant_id?: string; organization_id?: string | null };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body.request_id || !body.decision) return json({ error: "request_id_and_decision_required" }, 400);

  const { data: result, error: reviewError } = await admin
    .schema("private")
    .rpc("review_registration_request_atomic", {
      p_actor_user_id: actor.id,
      p_request_id: body.request_id,
      p_decision: body.decision,
      p_tenant_id: body.tenant_id ?? null,
      p_organization_id: body.organization_id ?? null,
    });

  if (reviewError) {
    const message = reviewError.message || "";
    const status =
      /required|not_found|invalid_decision/.test(message) ? 400 :
      /not_pending|already_exists/.test(message) ? 409 :
      /platform_admin/.test(message) ? 403 : 500;
    return json({ error: message || "review_failed" }, status);
  }

  return json({ ok: true, ...(result ?? {}) });
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
