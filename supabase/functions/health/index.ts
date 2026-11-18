import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

Deno.serve(async (_req: Request) => {
  const timestamp = new Date().toISOString();
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
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // businesses is an existing service-role-readable table in Production.
    // Select only its primary key; no customer/provider data is returned.
    const { error } = await db.from("businesses").select("id").limit(1).maybeSingle();
    if (error) throw error;

    return new Response(JSON.stringify({
      status: "ok",
      service: "mantiqatix-health",
      database: { status: "ok", mode: "service_role_read_only" },
      timestamp,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // Do not expose database errors, SQL details, or credentials on a public endpoint.
    console.error("health database probe failed");
    return new Response(JSON.stringify({
      status: "degraded",
      service: "mantiqatix-health",
      database: { status: "error", mode: "service_role_read_only" },
      timestamp,
    }), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
});
