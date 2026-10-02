import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const url = Deno.env.get("SUPABASE_URL") ?? ""
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
})

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const auth = req.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401)
  const { data: { user }, error: authError } = await admin.auth.getUser(auth.slice(7))
  if (authError || !user || user.is_anonymous) return json({ error: "Unauthorized" }, 401)

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const businessId = String(body?.businessId ?? "")
  const reason = body?.reason == null ? null : String(body.reason)
  if (!businessId) return json({ error: "businessId is required" }, 400)

  const { data, error } = await admin.rpc("deactivate_business", {
    p_business_id: businessId,
    p_reason: reason,
  })
  if (error) return json({ error: error.message }, 403)
  return json(data)
})