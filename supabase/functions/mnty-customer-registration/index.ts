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

  let body: { tenant_id?: string };
  try { body = await req.json(); } catch { body = {}; }

  const tenantId = String(body.tenant_id || "MNTY-PLATFORM").trim();
  if (tenantId !== "MNTY-PLATFORM") return json({ error: "invalid_customer_tenant" }, 400);

  const { data: result, error: activationError } = await admin
    .schema("private")
    .rpc("activate_customer_registration_atomic", {
      p_user_id: actor.id,
      p_tenant_id: tenantId,
    });

  if (activationError) {
    const message = activationError.message || "";
    const status =
      /required/.test(message) ? 400 :
      /tenant/.test(message) ? 409 : 500;
    return json({ error: message || "customer_activation_failed" }, status);
  }

  return json({ ok: true, ...(result ?? {}) });
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
