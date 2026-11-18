import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

async function tokenMatches(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ status: "method_not_allowed", service: "mantiqatix-health" }), {
      status: 405,
      headers: { "Allow": "GET", "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const timestamp = new Date().toISOString();
  const monitorToken = Deno.env.get("HEALTH_MONITOR_TOKEN");
  const authorization = req.headers.get("Authorization") || "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!monitorToken) {
    return new Response(JSON.stringify({ status: "degraded", service: "mantiqatix-health", monitor: "not_configured", timestamp }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  if (!suppliedToken || !(await tokenMatches(suppliedToken, monitorToken))) {
    return new Response(JSON.stringify({ status: "unauthorized", service: "mantiqatix-health", timestamp }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({
      status: "degraded",
      service: "mantiqatix-health",
      database: { status: "error", mode: "service_role_read_only" },
      timestamp,
    }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  try {
    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Read one primary key only; no business/customer data is returned.
    const { error } = await db.from("businesses").select("id").limit(1).maybeSingle();
    if (error) throw error;

    return new Response(JSON.stringify({
      status: "ok",
      service: "mantiqatix-health",
      database: { status: "ok", mode: "service_role_read_only" },
      timestamp,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    console.error("health database probe failed");
    return new Response(JSON.stringify({
      status: "degraded",
      service: "mantiqatix-health",
      database: { status: "error", mode: "service_role_read_only" },
      timestamp,
    }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});
