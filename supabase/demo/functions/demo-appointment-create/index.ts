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
  const token = authorization.slice(7).trim();
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return reply({ error: "SERVER_MISCONFIGURED" }, 500, origin);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user || user.is_anonymous) return reply({ error: "UNAUTHORIZED" }, 401, origin);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "INVALID_BODY" }, 400, origin);
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: "INVALID_JSON" }, 400, origin);
  }
  const businessId = String(body.businessId || "");
  const doctorId = String(body.doctorId || "");
  const dateTime = Number(body.dateTime);
  const appointmentId = crypto.randomUUID();
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;
  if (!businessId || !doctorId || !Number.isSafeInteger(dateTime) || dateTime <= Date.now()) {
    return reply({ error: "INVALID_DEMO_APPOINTMENT" }, 400, origin);
  }

  const { data, error } = await userClient.rpc("create_medical_appointment_backend", {
    p_user_id: user.id,
    p_appointment_id: appointmentId,
    p_business_id: businessId,
    p_doctor_id: doctorId,
    p_date_time: dateTime,
    p_reason: reason,
  });
  if (error) {
    console.error("demo appointment create failed", error.message);
    return reply({ error: "DEMO_APPOINTMENT_CREATION_FAILED", detail: error.message || "RPC_FAILED" }, 400, origin);
  }
  return reply({ ok: true, appointment: data, payment: { mode: "DEMO_ONLY", collected: false } }, 200, origin);
});