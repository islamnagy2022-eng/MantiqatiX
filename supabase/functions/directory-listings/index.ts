import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "https://catalog.tagerflow.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);
const cors = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
});
const out = (origin: string | null, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(origin) });
const publicFields = "id,slug,display_name,listing_type,specialty,phone,secondary_phone,address,governorate,district,village,source_name,source_url,source_checked_at,listing_status,claim_status,completeness,metadata,created_at,updated_at";
const listingTypes = new Set(["doctor","clinic","pharmacy","medical_center","hospital","laboratory","health_provider","business"]);
const listingStatuses = new Set(["DRAFT","PUBLISHED","HIDDEN"]);
const slugify = (value: unknown) => {
  const slug = String(value || "").normalize("NFKD").toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 115);
  return slug || ("listing-" + crypto.randomUUID().slice(0, 8));
};
const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const platformAdmin = (membership: any) =>
  String(membership?.role || "").toUpperCase() === "SUPER_ADMIN" &&
  !membership?.business_id && !membership?.branch_id &&
  membership?.permissions?.scope === "PLATFORM" &&
  membership?.permissions?.full_control === true;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return out(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors(origin) });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return out(origin, { error: "SERVER_MISCONFIGURED" }, 500);
  const service = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const slug = clean(url.searchParams.get("slug"), 140);
    if (slug) {
      const { data, error } = await service.from("public_directory_listings").select(publicFields)
        .eq("slug", slug).eq("listing_status", "PUBLISHED").maybeSingle();
      if (error) return out(origin, { error: "DIRECTORY_READ_FAILED" }, 500);
      if (!data) return out(origin, { error: "LISTING_NOT_FOUND" }, 404);
      return out(origin, { listing: data });
    }
    const type = clean(url.searchParams.get("type"), 40);
    let query = service.from("public_directory_listings").select(publicFields)
      .eq("listing_status", "PUBLISHED").order("specialty", { ascending: true }).order("display_name", { ascending: true }).limit(500);
    if (type && listingTypes.has(type)) query = query.eq("listing_type", type);
    const { data, error } = await query;
    if (error) return out(origin, { error: "DIRECTORY_READ_FAILED" }, 500);
    return out(origin, { listings: data || [] });
  }
  if (req.method !== "POST") return out(origin, { error: "METHOD_NOT_ALLOWED" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return out(origin, { error: "INVALID_JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return out(origin, { error: "INVALID_BODY" }, 400);
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return out(origin, { error: "AUTH_REQUIRED" }, 401);
  const { data: userData, error: userError } = await service.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user || user.is_anonymous) return out(origin, { error: "AUTH_REQUIRED" }, 401);
  const action = String(body.action || "").toUpperCase();

  if (action === "CLAIM_LISTING") {
    const listingId = clean(body.listingId, 80);
    const contactName = clean(body.contactName || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0], 160);
    const contactPhone = clean(body.contactPhone, 40);
    const evidenceNote = clean(body.evidenceNote, 1200);
    if (!listingId || contactName.length < 2 || contactPhone.replace(/\D/g, "").length < 7) {
      return out(origin, { error: "CLAIM_CONTACT_REQUIRED", message: "أدخل الاسم ورقم تواصل صحيحًا لاستكمال طلب الاستلام." }, 400);
    }
    const { data: listing, error: listingError } = await service.from("public_directory_listings")
      .select("id,display_name,listing_status,claim_status").eq("id", listingId).maybeSingle();
    if (listingError) return out(origin, { error: "LISTING_READ_FAILED" }, 500);
    if (!listing || listing.listing_status !== "PUBLISHED") return out(origin, { error: "LISTING_NOT_FOUND" }, 404);
    if (listing.claim_status === "CLAIMED") return out(origin, { error: "LISTING_ALREADY_CLAIMED", message: "تم استلام الصفحة بالفعل. تواصل مع إدارة المنصة للمساعدة." }, 409);
    const { data: prior, error: priorError } = await service.from("directory_listing_claim_requests")
      .select("id,status").eq("listing_id", listingId).eq("user_id", user.id).in("status", ["PENDING","REVIEWING"]).limit(1).maybeSingle();
    if (priorError) return out(origin, { error: "CLAIM_LOOKUP_FAILED" }, 500);
    if (prior) return out(origin, { success: true, requestId: prior.id, status: prior.status, existingRequest: true });
    if (listing.claim_status !== "UNCLAIMED") return out(origin, { error: "CLAIM_UNAVAILABLE", message: "هناك طلب استلام قيد المراجعة لهذه الصفحة." }, 409);
    const { data: request, error: insertError } = await service.from("directory_listing_claim_requests").insert({
      listing_id: listingId, user_id: user.id, contact_name: contactName, contact_phone: contactPhone,
      contact_email: clean(user.email || body.contactEmail, 254) || null, evidence_note: evidenceNote || null, status: "PENDING",
    }).select("id,status").single();
    if (insertError) return out(origin, { error: "CLAIM_CREATE_FAILED" }, 500);
    const { data: locked, error: lockError } = await service.from("public_directory_listings")
      .update({ claim_status: "CLAIM_PENDING", claimed_user_id: user.id })
      .eq("id", listingId).eq("claim_status", "UNCLAIMED").select("id").maybeSingle();
    if (lockError || !locked) {
      await service.from("directory_listing_claim_requests").delete().eq("id", request.id);
      return out(origin, { error: "CLAIM_UNAVAILABLE", message: "سبقك طلب آخر على هذه الصفحة. تواصل مع الإدارة." }, 409);
    }
    return out(origin, { success: true, requestId: request.id, status: request.status }, 201);
  }

  const { data: memberships, error: membershipsError } = await service.from("user_memberships")
    .select("id,user_id,tenant_id,organization_id,business_id,branch_id,role,status,permissions")
    .eq("user_id", user.id).eq("status", "ACTIVE").limit(250);
  if (membershipsError) return out(origin, { error: "ADMIN_PERMISSION_LOOKUP_FAILED" }, 500);
  if (!(memberships || []).some(platformAdmin)) return out(origin, { error: "PLATFORM_ADMIN_REQUIRED" }, 403);

  if (action === "ADMIN_LIST") {
    const [listingsResult, claimsResult, businessesResult] = await Promise.all([
      service.from("public_directory_listings").select("*").order("created_at", { ascending: false }).limit(1000),
      service.from("directory_listing_claim_requests").select("*").order("created_at", { ascending: false }).limit(1000),
      service.from("businesses").select("id,name,tenant_id,status,settings").order("created_at", { ascending: false }).limit(1000),
    ]);
    const error = listingsResult.error || claimsResult.error || businessesResult.error;
    if (error) return out(origin, { error: "ADMIN_DIRECTORY_READ_FAILED" }, 500);
    return out(origin, { listings: listingsResult.data || [], claims: claimsResult.data || [], businesses: businessesResult.data || [] });
  }

  if (action === "UPSERT_LISTING") {
    const id = clean(body.id, 80);
    const displayName = clean(body.displayName, 200);
    const listingType = clean(body.listingType || "doctor", 40);
    const listingStatus = clean(body.listingStatus || "DRAFT", 20).toUpperCase();
    const slug = slugify(body.slug || displayName);
    if (displayName.length < 2 || !listingTypes.has(listingType) || !listingStatuses.has(listingStatus)) {
      return out(origin, { error: "INVALID_LISTING", message: "راجع اسم الصفحة وتصنيفها وحالة النشر." }, 400);
    }
    const patch: Record<string, unknown> = {
      slug, display_name: displayName, listing_type: listingType,
      specialty: clean(body.specialty, 160) || null,
      phone: clean(body.phone, 40) || null, secondary_phone: clean(body.secondaryPhone, 40) || null,
      address: clean(body.address, 500) || null,
      governorate: clean(body.governorate || "المنوفية", 100),
      district: clean(body.district || "بركة السبع", 100), village: clean(body.village, 100) || null,
      source_name: clean(body.sourceName || "إدخال إدارة المنصة", 160),
      source_url: clean(body.sourceUrl, 1000) || null,
      source_checked_at: body.sourceCheckedAt ? String(body.sourceCheckedAt) : new Date().toISOString(),
      listing_status: listingStatus,
      completeness: body.completeness && typeof body.completeness === "object" ? body.completeness : {},
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
      updated_by: user.id,
    };
    if (id) {
      const { data, error } = await service.from("public_directory_listings").update(patch).eq("id", id).select("*").single();
      if (error) return out(origin, { error: "LISTING_UPDATE_FAILED", detail: error.code === "23505" ? "SLUG_ALREADY_EXISTS" : undefined }, error.code === "23505" ? 409 : 500);
      return out(origin, { listing: data });
    }
    const { data, error } = await service.from("public_directory_listings")
      .insert({ ...patch, created_by: user.id, listing_status: listingStatus, claim_status: "UNCLAIMED" }).select("*").single();
    if (error) return out(origin, { error: "LISTING_CREATE_FAILED", detail: error.code === "23505" ? "SLUG_ALREADY_EXISTS" : undefined }, error.code === "23505" ? 409 : 500);
    return out(origin, { listing: data }, 201);
  }

  if (action === "REVIEW_CLAIM") {
    const claimId = clean(body.claimId, 80);
    const decision = clean(body.decision, 20).toUpperCase();
    const reviewNote = clean(body.reviewNote, 1200);
    const { data: claim, error: claimError } = await service.from("directory_listing_claim_requests")
      .select("*").eq("id", claimId).maybeSingle();
    if (claimError) return out(origin, { error: "CLAIM_READ_FAILED" }, 500);
    if (!claim) return out(origin, { error: "CLAIM_NOT_FOUND" }, 404);
    if (["REVIEWING","REJECTED"].includes(decision)) {
      const { error } = await service.from("directory_listing_claim_requests").update({
        status: decision, review_note: reviewNote || null, reviewed_by: user.id, reviewed_at: new Date().toISOString(),
      }).eq("id", claimId);
      if (error) return out(origin, { error: "CLAIM_REVIEW_FAILED" }, 500);
      if (decision === "REJECTED") {
        await service.from("public_directory_listings").update({ claim_status: "UNCLAIMED", claimed_user_id: null })
          .eq("id", claim.listing_id).eq("claimed_user_id", claim.user_id).eq("claim_status", "CLAIM_PENDING");
      }
      return out(origin, { success: true, status: decision });
    }
    if (decision !== "APPROVED") return out(origin, { error: "INVALID_CLAIM_DECISION" }, 400);
    if (body.ownershipVerified !== true) return out(origin, { error: "OWNERSHIP_NOT_VERIFIED", message: "لا تعتمد الاستلام قبل التحقق المباشر من هوية مقدم الطلب وملكيته." }, 400);
    const businessId = clean(body.businessId, 80);
    const { data: business, error: businessError } = await service.from("businesses")
      .select("id,tenant_id,organization_id,name,status,settings").eq("id", businessId).maybeSingle();
    if (businessError) return out(origin, { error: "BUSINESS_READ_FAILED" }, 500);
    if (!business || String(business.status).toUpperCase() !== "ACTIVE") {
      return out(origin, { error: "BUSINESS_NOT_ACTIVE", message: "يجب ربط الصفحة بنشاط موجود ونشط أولاً." }, 409);
    }
    const settings = business.settings && typeof business.settings === "object" ? business.settings : {};
    const billing = settings.bizcatalog && typeof settings.bizcatalog === "object" ? settings.bizcatalog : {};
    if (String(billing.paymentStatus || "").toLowerCase() !== "paid" || billing.paymentConfirmedByAdmin !== true || body.subscriptionPaid !== true) {
      return out(origin, { error: "PAID_SUBSCRIPTION_REQUIRED", message: "لا يمكن تسليم الملكية قبل تأكيد الاشتراك المدفوع من إدارة المنصة." }, 409);
    }
    if (String(business.tenant_id || "") !== "MNTY-PLATFORM" && !memberships.some((m: any) => String(m.tenant_id) === String(business.tenant_id))) {
      return out(origin, { error: "BUSINESS_SCOPE_FORBIDDEN" }, 403);
    }
    const { data: ownerRows, error: ownerError } = await service.from("user_memberships")
      .select("id,user_id,role,status,permissions").eq("business_id", businessId)
      .eq("status", "ACTIVE").in("role", ["BUSINESS_OWNER","OWNER"]).limit(100);
    if (ownerError) return out(origin, { error: "OWNER_CHECK_FAILED" }, 500);
    const foreignOwners = (ownerRows || []).filter((m: any) => String(m.user_id) !== String(claim.user_id));
    const nonAutomaticOwners = foreignOwners.filter((m: any) => m.permissions?.auto_assigned_default_owner !== true);
    if (nonAutomaticOwners.length) return out(origin, { error: "BUSINESS_ALREADY_HAS_OWNER", message: "النشاط مرتبط بمالك فعلي آخر. يلزم حل التعارض إداريًا قبل التسليم." }, 409);
    let membershipId = "";
    const { data: existingMembership, error: existingMembershipError } = await service.from("user_memberships")
      .select("id,user_id,tenant_id,business_id,branch_id,role,status,permissions")
      .eq("user_id", claim.user_id).eq("business_id", businessId).is("branch_id", null)
      .in("role", ["BUSINESS_OWNER","OWNER"]).limit(1).maybeSingle();
    if (existingMembershipError) return out(origin, { error: "CLAIM_MEMBERSHIP_LOOKUP_FAILED" }, 500);
    const permissions = {
      ...(existingMembership?.permissions && typeof existingMembership.permissions === "object" ? existingMembership.permissions : {}),
      owner: true, catalog: true, catalog_write: true, profile_manage: true,
      subscription_status: "PAID", claimed_directory_listing_id: claim.listing_id,
    };
    if (existingMembership) {
      membershipId = String(existingMembership.id);
      const { error } = await service.from("user_memberships").update({ status: "ACTIVE", permissions })
        .eq("id", membershipId);
      if (error) return out(origin, { error: "CLAIM_MEMBERSHIP_ACTIVATE_FAILED" }, 500);
    } else {
      membershipId = crypto.randomUUID();
      const { error } = await service.from("user_memberships").insert({
        id: membershipId, user_id: claim.user_id, tenant_id: business.tenant_id,
        organization_id: business.organization_id || null, business_id: businessId, branch_id: null,
        role: "BUSINESS_OWNER", status: "ACTIVE", permissions,
      });
      if (error) return out(origin, { error: "CLAIM_MEMBERSHIP_CREATE_FAILED" }, 500);
    }
    const automaticIds = foreignOwners.filter((m: any) => m.permissions?.auto_assigned_default_owner === true).map((m: any) => String(m.id));
    if (automaticIds.length) {
      const { error } = await service.from("user_memberships").update({ status: "INACTIVE" }).in("id", automaticIds);
      if (error) return out(origin, { error: "DEFAULT_OWNER_DETACH_FAILED", membershipId }, 500);
    }
    const now = new Date().toISOString();
    const { error: listingUpdateError } = await service.from("public_directory_listings").update({
      claim_status: "CLAIMED", claimed_user_id: claim.user_id, claimed_business_id: businessId,
      claimed_at: now, last_verified_at: now, verified_by: user.id,
    }).eq("id", claim.listing_id);
    if (listingUpdateError) return out(origin, { error: "LISTING_CLAIM_SAVE_FAILED", membershipId }, 500);
    const { error: claimUpdateError } = await service.from("directory_listing_claim_requests").update({
      status: "APPROVED", reviewed_by: user.id, reviewed_at: now, review_note: reviewNote || null,
      linked_business_id: businessId, linked_membership_id: membershipId,
    }).eq("id", claimId);
    if (claimUpdateError) return out(origin, { error: "CLAIM_FINALIZE_FAILED", membershipId }, 500);
    return out(origin, { success: true, status: "APPROVED", membershipId, businessId });
  }
  return out(origin, { error: "UNSUPPORTED_ACTION" }, 400);
});
