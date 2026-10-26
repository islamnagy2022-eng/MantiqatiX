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

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return reply({ error: "SERVER_MISCONFIGURED" }, 500, origin);
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7).trim());
  if (authError || !user || user.is_anonymous) return reply({ error: "UNAUTHORIZED" }, 401, origin);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "INVALID_BODY" }, 400, origin);
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: "INVALID_JSON" }, 400, origin);
  }
  const action = String(body.action || "");
  const businessId = String(body.businessId || "");
  const branchId = String(body.branchId || "");
  if (!businessId || !branchId) return reply({ error: "DEMO_SCOPE_REQUIRED" }, 400, origin);

  const { data: owner, error: ownerError } = await admin.from("user_memberships")
    .select("id,role,status,business_id,branch_id,tenant_id")
    .eq("user_id", user.id).eq("tenant_id", "MNTY-PLATFORM")
    .eq("business_id", businessId).eq("branch_id", branchId).eq("status", "ACTIVE")
    .limit(1).maybeSingle();
  if (ownerError) return reply({ error: "DEMO_MEMBERSHIP_CHECK_FAILED" }, 500, origin);
  if (!owner || String(owner.role).toUpperCase() !== "OWNER") {
    return reply({ error: "DEMO_OWNER_REQUIRED" }, 403, origin);
  }
  const { data: branch, error: branchError } = await admin.from("branches")
    .select("id,business_id,tenant_id,status")
    .eq("id", branchId).eq("business_id", businessId).eq("tenant_id", "MNTY-PLATFORM").eq("status", "ACTIVE")
    .maybeSingle();
  if (branchError || !branch) return reply({ error: "DEMO_BRANCH_NOT_FOUND" }, 404, origin);

  if (action === "list") {
    const { data: rows, error } = await admin.from("user_memberships")
      .select("id,user_id,role,status,branch_id")
      .eq("tenant_id", "MNTY-PLATFORM").eq("business_id", businessId)
      .eq("branch_id", branchId).eq("status", "ACTIVE").order("created_at", { ascending: true });
    if (error) return reply({ error: "DEMO_MEMBERS_LIST_FAILED" }, 500, origin);
    const members = [];
    for (const m of rows || []) {
      const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(m.user_id);
      if (userErr) {
        members.push({ membershipId: m.id, userId: m.user_id, role: m.role, name: "", email: "" });
      } else {
        members.push({
          membershipId: m.id,
          userId: m.user_id,
          role: m.role,
          name: String(userRes.user.user_metadata?.full_name || userRes.user.user_metadata?.name || ""),
          email: String(userRes.user.email || ""),
        });
      }
    }
    return reply({ ok: true, members }, 200, origin);
  }

  if (action === "grant") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = String(body.role || "").toUpperCase();
    if (!email || email.length > 180 || !email.includes("@")) return reply({ error: "INVALID_EMAIL" }, 400, origin);
    if (!["MANAGER", "STAFF"].includes(role)) return reply({ error: "DEMO_ROLE_NOT_ALLOWED" }, 400, origin);

    let target = null;
    for (let page = 1; page <= 10; page++) {
      const { data: listing, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return reply({ error: "DEMO_AUTH_USER_LOOKUP_FAILED" }, 500, origin);
      target = (listing.users || []).find((u: any) => String(u.email || "").toLowerCase() === email) || null;
      if (target || (listing.users || []).length < 1000) break;
    }
    if (!target || target.is_anonymous) return reply({ error: "DEMO_USER_NOT_FOUND", detail: "أنشئ الحساب التجريبي وسجّل الدخول به مرة واحدة أولًا." }, 404, origin);
    if (target.id === user.id) return reply({ error: "CANNOT_CHANGE_OWN_ROLE" }, 400, origin);

    const { data: existing, error: existingError } = await admin.from("user_memberships")
      .select("id,role,status")
      .eq("user_id", target.id).eq("tenant_id", "MNTY-PLATFORM")
      .eq("business_id", businessId).eq("branch_id", branchId).limit(1).maybeSingle();
    if (existingError) return reply({ error: "DEMO_MEMBERSHIP_LOOKUP_FAILED" }, 500, origin);
    if (existing && String(existing.role).toUpperCase() === "OWNER") return reply({ error: "OWNER_ROLE_IMMUTABLE" }, 409, origin);

    let error;
    if (existing) {
      const result = await admin.from("user_memberships")
        .update({ role, status: "ACTIVE", permissions: { scope: "BRANCH", demo: true } })
        .eq("id", existing.id).eq("tenant_id", "MNTY-PLATFORM")
        .eq("business_id", businessId).eq("branch_id", branchId);
      error = result.error;
    } else {
      const result = await admin.from("user_memberships").insert({
        id: crypto.randomUUID(),
        user_id: target.id,
        tenant_id: "MNTY-PLATFORM",
        organization_id: "MNTY-MAIN",
        business_id: businessId,
        branch_id: branchId,
        role,
        permissions: { scope: "BRANCH", demo: true },
        status: "ACTIVE",
      });
      error = result.error;
    }
    if (error) {
      console.error("demo role assignment failed", error.message);
      return reply({ error: "DEMO_ROLE_ASSIGNMENT_FAILED", detail: error.message || "DATABASE_WRITE_FAILED" }, 400, origin);
    }
    return reply({ ok: true, email, role, businessId, branchId, environment: "DEMO" }, 200, origin);
  }

  return reply({ error: "UNSUPPORTED_DEMO_MEMBER_ACTION" }, 400, origin);
});