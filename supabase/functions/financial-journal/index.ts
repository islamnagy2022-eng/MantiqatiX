import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    if (origin && origin !== allowedOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (origin && origin !== allowedOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);
  const token = authorization.slice(7).trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return json({ error: "SERVER_MISCONFIGURED" }, 500);

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user || user.is_anonymous) return json({ error: "AUTH_REQUIRED" }, 401);

    const parsed: unknown = await req.json().catch(() => null);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "INVALID_JSON" }, 400);
    }
    const body = parsed as Record<string, unknown>;
    const rawEntry = body.entry;
    const lines = body.lines;
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry) ||
        !Array.isArray(lines) || lines.length === 0) {
      return json({ error: "JOURNAL_ENTRY_AND_LINES_REQUIRED" }, 400);
    }

    const entry = rawEntry as Record<string, unknown>;
    const tenantId = String(body.tenantId ?? entry.tenant_id ?? "").trim();
    if (!tenantId) return json({ error: "TENANT_REQUIRED" }, 400);
    if (String(entry.status ?? "") !== "POSTED") {
      return json({ error: "ONLY_POSTED_JOURNALS_SUPPORTED" }, 400);
    }

    // This RPC is intentionally service_role-only. The bearer token is verified above,
    // and the database rechecks the supplied actor's active financial membership.
    const { data, error } = await admin.rpc("post_financial_journal_backend", {
      p_user_id: user.id,
      p_entry: { ...entry, tenant_id: tenantId },
      p_lines: lines,
    });
    if (error) {
      console.error(JSON.stringify({ stage: "post_financial_journal_backend", code: error.code ?? "UNKNOWN" }));
      return json({ error: "JOURNAL_POST_FAILED" }, 400);
    }
    return json({ success: true, journal: data });
  } catch {
    return json({ error: "JOURNAL_POST_FAILED" }, 400);
  }
});
