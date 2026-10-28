import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
]);
const bucketName = "mantiqatix-profile-media";
const settingsKey = "bizcatalog";
const maxBodyChars = 4_500_000;
const maxImageBytes = 3 * 1024 * 1024;
const durationMonths: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

const response = (origin: string | null, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
      "Cache-Control": "no-store",
    },
  });

const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const calculateEndDate = (startDate: string, duration: string): string => {
  const months = durationMonths[duration];
  const date = new Date(startDate + "T00:00:00.000Z");
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDayOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDayOfMonth));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

const isLive = (ad: any, now = new Date()) => {
  if (String(ad?.status || "").toUpperCase() !== "ACTIVE") return false;
  if (!validDate(ad.startDate) || !validDate(ad.endDate)) return false;
  const startsAt = new Date(ad.startDate + "T00:00:00.000Z").getTime();
  const endsAt = new Date(ad.endDate + "T23:59:59.999Z").getTime();
  return startsAt <= now.getTime() && endsAt >= now.getTime();
};

const readSettings = async (service: any) => {
  const { data, error } = await service.from("bizcatalog_platform_settings")
    .select("settings").eq("settings_key", settingsKey).maybeSingle();
  if (error) throw error;
  const value = data?.settings && typeof data.settings === "object" && !Array.isArray(data.settings) ? data.settings : {};
  return value as Record<string, unknown>;
};

const writeAds = async (service: any, actorId: string, ads: any[]) => {
  const current = await readSettings(service);
  const next = { ...current, coverAdvertisements: ads };
  const { error } = await service.from("bizcatalog_platform_settings").upsert({
    settings_key: settingsKey,
    settings: next,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "settings_key" });
  if (error) throw error;
};

const requirePlatformAdmin = async (service: any, token: string) => {
  const { data: authData, error: authError } = await service.auth.getUser(token);
  const actor = authData?.user;
  if (authError || !actor || actor.is_anonymous) return { error: "AUTH_REQUIRED", status: 401 };
  const { data: memberships, error: membershipError } = await service.from("user_memberships")
    .select("business_id,branch_id,role,status,permissions")
    .eq("user_id", actor.id).eq("status", "ACTIVE").limit(100);
  if (membershipError) return { error: "ADMIN_AUTHORIZATION_LOOKUP_FAILED", status: 500 };
  const authorized = (memberships || []).some((membership: any) =>
    String(membership.role || "").toUpperCase() === "SUPER_ADMIN"
    && !membership.business_id
    && !membership.branch_id
    && membership.permissions?.scope === "PLATFORM"
    && membership.permissions?.full_control === true
  );
  if (!authorized) return { error: "PLATFORM_ADMIN_REQUIRED", status: 403 };
  return { actor };
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return response(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
  if (req.method !== "POST") return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);

  const contentLength = Number(req.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBodyChars) return response(origin, { error: "PAYLOAD_TOO_LARGE" }, 413);
  let body: any;
  try {
    const raw = await req.text();
    if (raw.length > maxBodyChars) return response(origin, { error: "PAYLOAD_TOO_LARGE" }, 413);
    body = JSON.parse(raw);
  } catch {
    return response(origin, { error: "INVALID_JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return response(origin, { error: "INVALID_BODY" }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return response(origin, { error: "SERVER_MISCONFIGURED" }, 500);
  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const action = String(body.action || "").toUpperCase();

  try {
    if (action === "PUBLIC_LIST") {
      const settings = await readSettings(service);
      const ads = Array.isArray(settings.coverAdvertisements) ? settings.coverAdvertisements : [];
      return response(origin, {
        ads: ads.filter((ad: any) => isLive(ad)).map((ad: any) => ({
          id: String(ad.id || ""),
          title: String(ad.title || ""),
          imageUrl: String(ad.imageUrl || ""),
          targetUrl: String(ad.targetUrl || ""),
          placement: String(ad.placement || "HOME_ONLY"),
          duration: String(ad.duration || "MONTHLY"),
          startDate: String(ad.startDate || ""),
          endDate: String(ad.endDate || ""),
          targetBusinessIds: Array.isArray(ad.targetBusinessIds) ? ad.targetBusinessIds.map(String) : [],
          locationScope: String(ad.locationScope || "ALL"),
          locationValue: String(ad.locationValue || ""),
          status: String(ad.status || "INACTIVE"),
        })),
      });
    }

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return response(origin, { error: "AUTH_REQUIRED" }, 401);
    const auth = await requirePlatformAdmin(service, token);
    if (auth.error) return response(origin, { error: auth.error }, auth.status);
    const actor = auth.actor as any;

    const settings = await readSettings(service);
    const existingAds = Array.isArray(settings.coverAdvertisements) ? settings.coverAdvertisements : [];

    if (action === "LIST_ADMIN") {
      return response(origin, { ads: existingAds });
    }

    if (action === "SAVE_AD") {
      const input = body.ad && typeof body.ad === "object" ? body.ad : {};
      const id = String(input.id || crypto.randomUUID()).trim();
      const existingIndex = existingAds.findIndex((ad: any) => String(ad.id) === id);
      if (existingIndex < 0 && existingAds.length >= 10) {
        return response(origin, { error: "COVER_AD_LIMIT_REACHED", message: "الحد الأقصى 10 إعلانات للغلاف." }, 409);
      }

      const title = String(input.title || "").trim();
      const placement = String(input.placement || "HOME_ONLY").toUpperCase();
      const duration = String(input.duration || "MONTHLY").toUpperCase();
      const startDate = String(input.startDate || "").trim();
      const locationScope = String(input.locationScope || "ALL").toUpperCase();
      const locationValue = String(input.locationValue || "").trim();
      const status = String(input.status || "INACTIVE").toUpperCase();
      const targetUrl = String(input.targetUrl || "").trim();
      const price = Number(input.price ?? 0);
      const targetBusinessIds = Array.isArray(input.targetBusinessIds)
        ? [...new Set(input.targetBusinessIds.map((id: unknown) => String(id || "").trim()).filter(Boolean))]
        : [];
      if (title.length < 2 || title.length > 180) return response(origin, { error: "INVALID_AD_TITLE" }, 400);
      if (!["HOME_ONLY", "BUSINESS_COVER", "BOTH"].includes(placement)) return response(origin, { error: "INVALID_AD_PLACEMENT" }, 400);
      if (!Object.prototype.hasOwnProperty.call(durationMonths, duration)) return response(origin, { error: "INVALID_AD_DURATION" }, 400);
      if (!validDate(startDate)) return response(origin, { error: "INVALID_AD_START_DATE" }, 400);
      if (!["ALL", "GOVERNORATE", "CITY"].includes(locationScope)) return response(origin, { error: "INVALID_AD_LOCATION_SCOPE" }, 400);
      if (locationScope !== "ALL" && (!locationValue || locationValue.length > 100)) return response(origin, { error: "INVALID_AD_LOCATION_VALUE" }, 400);
      if (targetBusinessIds.length > 100) return response(origin, { error: "TOO_MANY_TARGET_BUSINESSES" }, 400);
      if (["BUSINESS_COVER", "BOTH"].includes(placement) && targetBusinessIds.length === 0) {
        return response(origin, { error: "TARGET_ACTIVITY_REQUIRED", message: "اختر نشاطًا واحدًا على الأقل لعرض الإعلان على غلافه." }, 400);
      }
      if (targetBusinessIds.length > 0) {
        const { data: matches, error: businessesError } = await service.from("businesses").select("id").in("id", targetBusinessIds);
        if (businessesError) throw businessesError;
        if ((matches || []).length !== targetBusinessIds.length) return response(origin, { error: "INVALID_TARGET_BUSINESS" }, 400);
      }
      if (targetUrl && !(targetUrl.startsWith("/") && !targetUrl.startsWith("//")) && !/^https:\/\//i.test(targetUrl)) {
        return response(origin, { error: "INVALID_TARGET_URL" }, 400);
      }
      if (!Number.isFinite(price) || price < 0 || price > 100_000_000) return response(origin, { error: "INVALID_AD_PRICE" }, 400);
      if (!["ACTIVE", "INACTIVE"].includes(status)) return response(origin, { error: "INVALID_AD_STATUS" }, 400);

      let imageUrl = String(input.imageUrl || "").trim();
      let storagePath = String(input.storagePath || "").trim();
      let priorStoragePath = existingIndex >= 0 ? String((existingAds[existingIndex] as any).storagePath || "") : "";
      const imageBase64 = String(body.imageBase64 || "").trim();
      const imageMimeType = String(body.imageMimeType || "").trim().toLowerCase();
      if (imageBase64) {
        const extensionByMime: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
        const extension = extensionByMime[imageMimeType];
        if (!extension) return response(origin, { error: "UNSUPPORTED_IMAGE_TYPE" }, 400);
        if (imageBase64.length > Math.ceil(maxImageBytes * 4 / 3) + 20 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
          return response(origin, { error: "INVALID_IMAGE_DATA" }, 400);
        }
        const binary = atob(imageBase64);
        if (binary.length > maxImageBytes) return response(origin, { error: "IMAGE_TOO_LARGE", message: "حجم الصورة يجب ألا يتجاوز 3 ميجابايت." }, 413);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        storagePath = "platform/cover-ads/" + id + "-" + Date.now() + "." + extension;
        const { error: uploadError } = await service.storage.from(bucketName).upload(storagePath, bytes, {
          contentType: imageMimeType,
          upsert: true,
          cacheControl: "31536000",
        });
        if (uploadError) throw new Error("COVER_AD_IMAGE_UPLOAD_FAILED");
        imageUrl = service.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl;
        if (priorStoragePath && priorStoragePath !== storagePath && priorStoragePath.startsWith("platform/cover-ads/")) {
          await service.storage.from(bucketName).remove([priorStoragePath]);
        }
      }
      if (!imageUrl || imageUrl.length > 2000 || (!(imageUrl.startsWith("/") && !imageUrl.startsWith("//")) && !/^https:\/\//i.test(imageUrl))) {
        return response(origin, { error: "AD_IMAGE_REQUIRED", message: "ارفع صورة أو اختر أحد تصميمات MantiqatiX أو أدخل رابط صورة آمنًا." }, 400);
      }

      const endDate = calculateEndDate(startDate, duration);
      const savedAd = {
        id,
        title,
        imageUrl,
        storagePath,
        targetUrl,
        placement,
        duration,
        startDate,
        endDate,
        targetBusinessIds,
        locationScope,
        locationValue: locationScope === "ALL" ? "" : locationValue,
        price,
        status,
        createdAt: existingIndex >= 0 ? String((existingAds[existingIndex] as any).createdAt || new Date().toISOString()) : new Date().toISOString(),
        createdBy: String(actor.id),
      };
      const nextAds = [...existingAds];
      if (existingIndex >= 0) nextAds[existingIndex] = savedAd;
      else nextAds.push(savedAd);
      await writeAds(service, String(actor.id), nextAds);
      return response(origin, { success: true, ad: savedAd, ads: nextAds });
    }

    if (action === "DELETE_AD") {
      const id = String(body.id || "").trim();
      if (!id) return response(origin, { error: "INVALID_AD_ID" }, 400);
      const found = existingAds.find((ad: any) => String(ad.id) === id) as any;
      const nextAds = existingAds.filter((ad: any) => String(ad.id) !== id);
      if (nextAds.length === existingAds.length) return response(origin, { error: "AD_NOT_FOUND" }, 404);
      await writeAds(service, String(actor.id), nextAds);
      const storagePath = String(found?.storagePath || "");
      if (storagePath.startsWith("platform/cover-ads/")) {
        await service.storage.from(bucketName).remove([storagePath]);
      }
      return response(origin, { success: true, ads: nextAds });
    }

    return response(origin, { error: "UNSUPPORTED_ACTION" }, 400);
  } catch (error) {
    console.error("catalog-cover-ads failed", error instanceof Error ? error.message : "UNKNOWN_ERROR");
    return response(origin, { error: "COVER_AD_OPERATION_FAILED" }, 400);
  }
});
