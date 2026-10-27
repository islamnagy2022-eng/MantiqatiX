import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8080",
]);
const response = (origin: string | null, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "public, max-age=60, s-maxage=60",
  },
});

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: response(origin, {}).headers });
  if (req.method !== "POST") return response(origin, { error: "method_not_allowed" }, 405);
  if (origin && !allowedOrigins.has(origin)) return response(origin, { error: "origin_not_allowed" }, 403);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return response(origin, { error: "server_configuration_error" }, 500);

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await service
    .from("business_activity_types")
    .select("id,sector_id,parent_id,legacy_category_id,code,name_ar,name_en,node_type,status,sort_order")
    .eq("status", "ACTIVE")
    .order("sector_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name_ar", { ascending: true })
    .limit(2000);

  if (error) {
    console.error("active taxonomy lookup failed", error.message);
    return response(origin, { error: "activity_taxonomy_unavailable" }, 503);
  }
  return response(origin, { activityTypes: data || [] });
});
