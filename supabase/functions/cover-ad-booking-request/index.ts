import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "https://catalog.tagerflow.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
]);
const maxBodyBytes = 20_000;
const durations = new Set(["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]);
const placements = new Set(["BUSINESS_COVER", "HOME_ONLY", "BOTH"]);
const scopes = new Set(["CITY", "GOVERNORATE", "ALL"]);
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const respond = (body: Record<string, unknown>, status = 200) => json(body, status, origin);
  if (origin && !allowedOrigins.has(origin)) return respond({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  if (req.method !== "POST") return respond({ error: "METHOD_NOT_ALLOWED" }, 405);

  const length = Number(req.headers.get("Content-Length") || 0);
  if (Number.isFinite(length) && length > maxBodyBytes) return respond({ error: "PAYLOAD_TOO_LARGE" }, 413);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > maxBodyBytes) return respond({ error: "PAYLOAD_TOO_LARGE" }, 413);
    body = JSON.parse(raw);
  } catch {
    return respond({ error: "INVALID_JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return respond({ error: "INVALID_BODY" }, 400);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return respond({ error: "AUTH_REQUIRED" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return respond({ error: "SERVER_MISCONFIGURED" }, 500);
  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await service.auth.getUser(token);
  const actor = authData?.user;
  if (authError || !actor || actor.is_anonymous) return respond({ error: "AUTH_REQUIRED" }, 401);

  const businessId = String(body.businessId || "").trim();
  const title = String(body.title || "").trim();
  const duration = String(body.duration || "").toUpperCase();
  const placement = String(body.placement || "").toUpperCase();
  const locationScope = String(body.locationScope || "").toUpperCase();
  const locationValue = String(body.locationValue || "").trim();
  const targetUrl = String(body.targetUrl || "").trim();
  const notes = String(body.notes || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(businessId)) return respond({ error: "INVALID_BUSINESS" }, 400);
  if (title.length < 3 || title.length > 180) return respond({ error: "INVALID_TITLE" }, 400);
  if (!durations.has(duration)) return respond({ error: "INVALID_DURATION" }, 400);
  if (!placements.has(placement)) return respond({ error: "INVALID_PLACEMENT" }, 400);
  if (!scopes.has(locationScope)) return respond({ error: "INVALID_LOCATION_SCOPE" }, 400);
  if (locationScope !== "ALL" && (!locationValue || locationValue.length > 160)) return respond({ error: "INVALID_LOCATION" }, 400);
  if (locationScope === "ALL" && locationValue) return respond({ error: "INVALID_LOCATION" }, 400);
  if (targetUrl && (targetUrl.length > 1500 || !/^https:\/\//i.test(targetUrl))) return respond({ error: "INVALID_TARGET_URL" }, 400);
  if (notes.length > 3000) return respond({ error: "NOTES_TOO_LONG" }, 400);

  const { data: memberships, error: membershipError } = await service
    .from("user_memberships")
    .select("business_id,role,status")
    .eq("user_id", actor.id)
    .eq("business_id", businessId)
    .eq("status", "ACTIVE")
    .limit(50);
  if (membershipError) return respond({ error: "OWNER_AUTHORIZATION_LOOKUP_FAILED" }, 500);
  const isOwner = (memberships || []).some((membership: any) =>
    ["OWNER", "BUSINESS_OWNER"].includes(String(membership.role || "").toUpperCase())
  );
  if (!isOwner) return respond({ error: "BUSINESS_OWNER_REQUIRED" }, 403);

  const { data: business, error: businessError } = await service
    .from("businesses")
    .select("id,name,settings")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) return respond({ error: "BUSINESS_LOOKUP_FAILED" }, 500);
  if (!business) return respond({ error: "BUSINESS_NOT_FOUND" }, 404);

  const defaultLocations = (() => {
    const settings = business.settings && typeof business.settings === "object" ? business.settings as Record<string, unknown> : {};
    const profile = settings.catalog_profile && typeof settings.catalog_profile === "object" ? settings.catalog_profile as Record<string, unknown> : {};
    return {
      governorate: String(profile.governorate || ""),
      markaz: String(profile.markaz || ""),
      village: String(profile.village || ""),
    };
  })();
  const resolvedLocation = locationScope === "ALL"
    ? "كل الأماكن"
    : locationValue || (locationScope === "GOVERNORATE" ? defaultLocations.governorate : [defaultLocations.markaz, defaultLocations.village].filter(Boolean).join(" — "));
  if (locationScope !== "ALL" && !resolvedLocation) return respond({ error: "BUSINESS_LOCATION_REQUIRED" }, 400);

  const durationLabels: Record<string, string> = {
    MONTHLY: "شهري",
    QUARTERLY: "ربع سنوي — 3 أشهر",
    SEMIANNUAL: "نصف سنوي — 6 أشهر",
    ANNUAL: "سنوي — 12 شهرًا",
  };
  const placementLabels: Record<string, string> = {
    BUSINESS_COVER: "غلاف النشاط",
    HOME_ONLY: "الغلاف الرئيسي للموقع",
    BOTH: "الغلاف الرئيسي وغلاف النشاط",
  };
  const scopeLabels: Record<string, string> = {
    CITY: "بلدة / مركز / حي",
    GOVERNORATE: "محافظة",
    ALL: "كل الأماكن",
  };
  const description = [
    "طلب حجز مساحة إعلانية على MantiqatiX",
    "النشاط: " + String(business.name || ""),
    "عنوان الإعلان: " + title,
    "مدة الحجز المطلوبة: " + durationLabels[duration],
    "مكان النشر: " + placementLabels[placement],
    "النطاق الجغرافي: " + scopeLabels[locationScope] + " — " + resolvedLocation,
    "رابط الوجهة: " + (targetUrl || "لم يحدد"),
    "ملاحظات: " + (notes || "لا توجد"),
    "الطلب للمراجعة والتسعير والاعتماد من الإدارة. لا يعني هذا الطلب تفعيل إعلان أو تحصيل أي رسوم.",
  ].join("\n");
  const lead = {
    id: crypto.randomUUID(),
    requester_user_id: actor.id,
    requester_business_id: businessId,
    title: "طلب حجز إعلان غلاف: " + String(business.name || title),
    description,
    budget_min: 0,
    budget_max: 0,
    currency: "EGP",
    required_services: ["COVER_AD_BOOKING", "DURATION_" + duration, "PLACEMENT_" + placement, "LOCATION_" + locationScope],
    service_area: resolvedLocation.slice(0, 200),
    status: "OPEN",
    source: "PLATFORM",
  };
  const { data: created, error: insertError } = await service.from("marketing_leads")
    .insert(lead)
    .select("id,title,status,source,created_at")
    .single();
  if (insertError) {
    console.error("cover ad booking request persistence failed", insertError.message);
    return respond({ error: "BOOKING_REQUEST_SAVE_FAILED" }, 500);
  }
  return respond({ ok: true, request: created });
});

function json(body: Record<string, unknown>, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
