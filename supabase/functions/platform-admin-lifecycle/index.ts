import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const origin = req.headers.get("Origin");
  if (origin && origin !== allowedOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);
  const token = authorization.slice(7).trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "SERVER_CONFIGURATION_ERROR" }, 500);

  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await service.auth.getUser(token);
  const actor = authData.user;
  if (authError || !actor || actor.is_anonymous) return json({ error: "UNAUTHORIZED" }, 401);

  const { data: rootRecord, error: rootError } = await service
    .schema("private")
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", actor.id)
    .maybeSingle();

  if (rootError) return json({ error: "PLATFORM_AUTHORITY_CHECK_FAILED" }, 500);
  if (!rootRecord) return json({ error: "PLATFORM_ADMIN_REQUIRED" }, 403);

  let body: { action?: string; target_user_id?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const action = String(body.action || "").trim().toLowerCase();
  const targetUserId = String(body.target_user_id || "").trim();
  const reason = String(body.reason || "").trim();

  if (action !== "grant" && action !== "revoke") return json({ error: "INVALID_ACTION" }, 400);
  if (!UUID_RE.test(targetUserId)) return json({ error: "INVALID_TARGET_USER_ID" }, 400);
  if (reason.length < 10 || reason.length > 500) return json({ error: "REASON_REQUIRED" }, 400);

  const routine = action === "grant" ? "grant_platform_admin" : "revoke_platform_admin";
  const { data: result, error: lifecycleError } = await service
    .schema("private")
    .rpc(routine, {
      p_actor_user_id: actor.id,
      p_target_user_id: targetUserId,
      p_reason: reason,
    });

  if (lifecycleError) {
    const message = lifecycleError.message || "";
    const status =
      /PLATFORM_ADMIN_REQUIRED/.test(message) ? 403 :
      /ALREADY|LAST_ROOT|SELF_|MULTIPLE|CANONICAL|NOT_ACTIVE/.test(message) ? 409 :
      /REQUIRED|NOT_FOUND|NOT_ELIGIBLE|TENANT_ID_CODE_CONFLICT/.test(message) ? 400 : 500;
    const safeError = status === 403 ? "PLATFORM_ADMIN_REQUIRED" :
      status === 409 ? "PLATFORM_ADMIN_LIFECYCLE_CONFLICT" :
      status === 400 ? "PLATFORM_ADMIN_LIFECYCLE_INPUT_REJECTED" :
      "PLATFORM_ADMIN_LIFECYCLE_FAILED";
    return json({ error: safeError }, status);
  }

  return json({ ok: true, ...(result ?? {}) });
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
