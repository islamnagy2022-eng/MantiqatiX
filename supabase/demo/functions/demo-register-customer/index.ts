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

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return reply({ error: "AUTH_REQUIRED" }, 401, origin);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return reply({ error: "SERVER_MISCONFIGURED" }, 500, origin);

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(auth.slice(7).trim());
  if (authError || !user || user.is_anonymous) return reply({ error: "UNAUTHORIZED" }, 401, origin);

  const { data, error } = await admin.rpc("demo_register_customer_atomic", { p_user_id: user.id });
  if (error) {
    console.error("demo customer registration failed", error.message);
    return reply({ error: "DEMO_CUSTOMER_REGISTRATION_FAILED" }, 400, origin);
  }
  return reply({ ok: true, userId: user.id, membership: data }, 200, origin);
});