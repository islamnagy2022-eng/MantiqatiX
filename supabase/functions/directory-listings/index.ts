import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  buildDirectoryPaginationOrFilter,
  decodeDirectoryPaginationCursor,
  encodeDirectoryPaginationCursor,
  expandDirectoryFunctionalGroupIds,
  expandDirectoryTaxonomyCategoryIds,
  parseDirectoryPaginationLimit,
  sanitizeDirectoryPaginationSearch,
} from "./pagination-filter.mjs";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
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
const publicFields = "id,slug,display_name,listing_type,functional_group_id,taxonomy_category_id,taxonomy_specialty,specialty,phone,secondary_phone,address,governorate,district,village,source_name,source_url,source_checked_at,listing_status,claim_status,completeness,metadata,created_at,updated_at";
const listingTypes = new Set(["doctor","clinic","pharmacy","medical_center","hospital","laboratory","health_provider","business"]);
const listingStatuses = new Set(["DRAFT","PUBLISHED","HIDDEN"]);
const outreachStatuses = new Set(["NEW","CONTACTED","INTERESTED","OFFER_SENT","FOLLOW_UP","SUBSCRIPTION_PENDING","SUBSCRIBED","NOT_INTERESTED","CORRECTION_REQUESTED"]);
const dateOrNull = (value: unknown): string | null => { if (!value) return null; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? null : date.toISOString(); };
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
      const { data, error } = await service.from("public_directory_listings")
        .select(publicFields + ",claimed_user_id,claimed_business_id")
        .eq("slug", slug).eq("listing_status", "PUBLISHED").maybeSingle();
      if (error) return out(origin, { error: "DIRECTORY_READ_FAILED" }, 500);
      if (!data) return out(origin, { error: "LISTING_NOT_FOUND" }, 404);
      let canEdit = false;
      const authHeader = req.headers.get("Authorization") || "";
      const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (bearer) {
        const { data: viewerData } = await service.auth.getUser(bearer);
        const viewer = viewerData?.user;
        if (viewer && !viewer.is_anonymous) {
          canEdit = data.claim_status === "CLAIMED" && String(data.claimed_user_id || "") === String(viewer.id);
          if (!canEdit && data.claim_status === "CLAIMED" && data.claimed_business_id) {
            const { data: memberships } = await service.from("user_memberships").select("id")
              .eq("user_id", viewer.id).eq("business_id", data.claimed_business_id).eq("status", "ACTIVE")
              .in("role", ["BUSINESS_OWNER","OWNER"]).limit(1);
            canEdit = Boolean(memberships?.length);
          }
        }
      }
      const { claimed_user_id: _claimedUserId, claimed_business_id: _claimedBusinessId, ...publicListing } = data;
      return out(origin, { listing: { ...publicListing, can_edit: canEdit, owned_business_id: canEdit ? String(data.claimed_business_id || "") : null } });
    }
    const type = clean(url.searchParams.get("type"), 40);
    const pageMode = ["limit","cursor","governorate","district","village","address","specialty","functionalGroupId","taxonomyCategoryId","taxonomySpecialty","q"].some((key) => url.searchParams.has(key));
    if (!pageMode) {
      let legacyQuery = service.from("public_directory_listings").select(publicFields)
        .eq("listing_status", "PUBLISHED").order("specialty", { ascending: true }).order("display_name", { ascending: true }).limit(500);
      if (type && listingTypes.has(type)) legacyQuery = legacyQuery.eq("listing_type", type);
      const { data, error } = await legacyQuery;
      if (error) return out(origin, { error: "DIRECTORY_READ_FAILED" }, 500);
      return out(origin, { listings: data || [] });
    }

    // Stable keyset pagination: never use offset for the growing national directory.
    const limit = parseDirectoryPaginationLimit(url.searchParams.get("limit"));
    if (limit === null) {
      return out(origin, { error: "INVALID_PAGE_LIMIT", message: "حجم الصفحة يجب أن يكون بين 1 و100." }, 400);
    }
    let cursor: { created_at: string; id: string } | null;
    try {
      cursor = decodeDirectoryPaginationCursor(clean(url.searchParams.get("cursor"), 1200));
    } catch {
      return out(origin, { error: "INVALID_PAGE_CURSOR", message: "مؤشر تحميل النتائج غير صالح. أعد تحميل الدليل." }, 400);
    }

    let pageQuery = service.from("public_directory_listings").select(publicFields)
      .eq("listing_status", "PUBLISHED")
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(limit + 1);
    if (type && listingTypes.has(type)) pageQuery = pageQuery.eq("listing_type", type);
    const governorate = clean(url.searchParams.get("governorate"), 100);
    const district = clean(url.searchParams.get("district"), 100);
    const village = clean(url.searchParams.get("village"), 100);
    const address = clean(url.searchParams.get("address"), 250);
    const specialty = clean(url.searchParams.get("specialty"), 160);
    const functionalGroupId = clean(url.searchParams.get("functionalGroupId"), 100);
    const taxonomyCategoryId = clean(url.searchParams.get("taxonomyCategoryId"), 180);
    const taxonomySpecialty = clean(url.searchParams.get("taxonomySpecialty"), 160);

    // Apply every explicit public filter in SQL before limiting the page.
    // This is essential: filtering after a 20-row fetch would silently omit valid matches.
    // Match canonical labels against common stored prefixes such as "محافظة" / "مركز" / "قرية".
    // Sanitization removes PostgREST wildcards and logical-filter delimiters before building ILIKE values.
    const governorateSearch = sanitizeDirectoryPaginationSearch(governorate);
    const districtSearch = sanitizeDirectoryPaginationSearch(district);
    const villageSearch = sanitizeDirectoryPaginationSearch(village);
    if (governorateSearch) pageQuery = pageQuery.ilike("governorate", "%" + governorateSearch + "%");
    if (districtSearch) pageQuery = pageQuery.ilike("district", "%" + districtSearch + "%");
    if (villageSearch) pageQuery = pageQuery.ilike("village", "%" + villageSearch + "%");
    if (address) {
      const addressSearch = sanitizeDirectoryPaginationSearch(address);
      if (addressSearch) pageQuery = pageQuery.ilike("address", "%" + addressSearch + "%");
    }
    if (functionalGroupId) pageQuery = pageQuery.in("functional_group_id", expandDirectoryFunctionalGroupIds(functionalGroupId));
    if (taxonomyCategoryId) pageQuery = pageQuery.in("taxonomy_category_id", expandDirectoryTaxonomyCategoryIds(taxonomyCategoryId));

    const search = sanitizeDirectoryPaginationSearch(url.searchParams.get("q"));
    // Keep free-text search, the selected specialty across both stored fields, and the keyset cursor in one logic tree.
    const logicalFilter = buildDirectoryPaginationOrFilter(search, cursor, taxonomySpecialty || specialty);
    if (logicalFilter) pageQuery = pageQuery.or(logicalFilter);
    const { data, error } = await pageQuery;
    if (error) return out(origin, { error: "DIRECTORY_READ_FAILED" }, 500);
    const rows = data || [];
    const hasMore = rows.length > limit;
    const listings = hasMore ? rows.slice(0, limit) : rows;
    const last = listings[listings.length - 1];
    const nextCursor = hasMore && last ? encodeDirectoryPaginationCursor({ created_at: last.created_at, id: last.id }) : null;
    return out(origin, { listings, nextCursor, hasMore, pageSize: limit });
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

  if (action === "UPDATE_OWNED_LISTING") {
    const listingId = clean(body.listingId, 80);
    const { data: listing, error: listingError } = await service.from("public_directory_listings")
      .select("id,claim_status,claimed_user_id,claimed_business_id,metadata")
      .eq("id", listingId).eq("listing_status", "PUBLISHED").maybeSingle();
    if (listingError) return out(origin, { error: "LISTING_READ_FAILED" }, 500);
    if (!listing || listing.claim_status !== "CLAIMED") return out(origin, { error: "LISTING_NOT_CLAIMED" }, 409);
    let authorized = String(listing.claimed_user_id || "") === String(user.id);
    if (!authorized && listing.claimed_business_id) {
      const { data: memberships, error: membershipError } = await service.from("user_memberships").select("id")
        .eq("user_id", user.id).eq("business_id", listing.claimed_business_id).eq("status", "ACTIVE")
        .in("role", ["BUSINESS_OWNER","OWNER"]).limit(1);
      if (membershipError) return out(origin, { error: "OWNER_CHECK_FAILED" }, 500);
      authorized = Boolean(memberships?.length);
    }
    if (!authorized) return out(origin, { error: "LISTING_OWNER_REQUIRED" }, 403);
    const displayName = clean(body.displayName, 200);
    const phone = clean(body.phone, 40);
    const secondaryPhone = clean(body.secondaryPhone, 40);
    const specialty = clean(body.specialty, 160);
    const address = clean(body.address, 500);
    const governorate = clean(body.governorate || "المنوفية", 100);
    const district = clean(body.district || "بركة السبع", 100);
    const village = clean(body.village, 100);
    if (displayName.length < 2) return out(origin, { error: "INVALID_DISPLAY_NAME" }, 400);
    const metadataInput = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {};
    const currentMetadata = listing.metadata && typeof listing.metadata === "object" && !Array.isArray(listing.metadata) ? listing.metadata : {};
    const metadataPatch: Record<string, unknown> = {};
    for (const key of ["bio","workingHours","websiteUrl","bookingUrl","services","socialLinks","profileImageUrl"]) {
      if (Object.prototype.hasOwnProperty.call(metadataInput, key)) metadataPatch[key] = metadataInput[key];
    }
    const patch = {
      display_name: displayName, phone: phone || null, secondary_phone: secondaryPhone || null,
      specialty: specialty || null, address: address || null, governorate, district, village: village || null,
      metadata: { ...currentMetadata, ...metadataPatch, ownerProfileUpdatedAt: new Date().toISOString() },
      completeness: {
        name: true, phone: Boolean(phone || secondaryPhone), specialty: Boolean(specialty), address: Boolean(address),
        bio: Boolean(metadataPatch.bio), workingHours: Boolean(metadataPatch.workingHours), websiteUrl: Boolean(metadataPatch.websiteUrl),
      },
      last_verified_at: new Date().toISOString(), updated_by: user.id,
    };
    const { data: saved, error: saveError } = await service.from("public_directory_listings")
      .update(patch).eq("id", listingId).select(publicFields).single();
    if (saveError) return out(origin, { error: "OWNED_LISTING_UPDATE_FAILED" }, 500);
    return out(origin, { success: true, listing: { ...saved, can_edit: true, owned_business_id: String(listing.claimed_business_id || "") } });
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

  // Incremental doctor ingestion: accept small batches and persist each record
  // before moving to the next one. This action is restricted by the platform-admin
  // check above and is idempotent for matching phone or name/location records.
  if (action === "IMPORT_DOCTOR_BATCH") {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length || rows.length > 50) {
      return out(origin, { error: "INVALID_IMPORT_BATCH", message: "أرسل من 1 إلى 50 طبيبًا في الدفعة الواحدة." }, 400);
    }

    const results: Array<{ index: number; status: string; id?: string; reason?: string }> = [];
    let inserted = 0;
    let updated = 0;
    let drafted = 0;
    let failed = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] && typeof rows[index] === "object" && !Array.isArray(rows[index]) ? rows[index] : {};
      const displayName = clean(row.displayName || row.display_name, 200);
      const specialty = clean(row.specialty || row.taxonomySpecialty, 160);
      const governorate = clean(row.governorate, 100);
      const district = clean(row.district, 100);
      const village = clean(row.village, 100);
      const phone = clean(row.phone, 40).replace(/[^0-9+]/g, "");
      const secondaryPhone = clean(row.secondaryPhone || row.secondary_phone, 40).replace(/[^0-9+]/g, "");
      const taxonomyCategoryId = clean(row.taxonomyCategoryId || row.taxonomy_category_id, 180);
      const taxonomySpecialty = clean(row.taxonomySpecialty || row.taxonomy_specialty || specialty, 160) || null;
      const sourceName = clean(row.sourceName || row.source_name || "Doctor directory import", 160);
      const sourceUrl = clean(row.sourceUrl || row.source_url, 1000) || null;
      const hasPhone = phone.replace(/\D/g, "").length >= 7 || secondaryPhone.replace(/\D/g, "").length >= 7;

      if (displayName.length < 2 || !specialty || !governorate || !district ||
          !taxonomyCategoryId.startsWith("cat_medical_health_") && !taxonomyCategoryId.startsWith("cat_custom_")) {
        failed += 1;
        results.push({ index, status: "failed", reason: "REQUIRED_FIELDS_OR_MEDICAL_CATEGORY_MISSING" });
        continue;
      }

      const slug = slugify(row.slug || [displayName, district, village].filter(Boolean).join("-"));
      const requestedStatus = clean(row.listingStatus || row.listing_status || "PUBLISHED", 20).toUpperCase();
      const listingStatus = hasPhone && requestedStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
      const completeness = {
        name: true,
        specialty: true,
        phone: hasPhone,
        address: Boolean(clean(row.address, 500)),
        governorate: true,
        district: true,
        village: Boolean(village),
      };
      const metadataInput = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {};
      const patch: Record<string, unknown> = {
        slug,
        display_name: displayName,
        listing_type: "doctor",
        functional_group_id: "medical_health",
        taxonomy_category_id: taxonomyCategoryId,
        taxonomy_specialty: taxonomySpecialty,
        specialty,
        phone: phone || null,
        secondary_phone: secondaryPhone || null,
        address: clean(row.address, 500) || null,
        governorate,
        district,
        village: village || null,
        source_name: sourceName,
        source_url: sourceUrl,
        source_checked_at: dateOrNull(row.sourceCheckedAt || row.source_checked_at) || new Date().toISOString(),
        listing_status: listingStatus,
        claim_status: "UNCLAIMED",
        completeness,
        metadata: { ...metadataInput, ingestion: "incremental_doctor_batch" },
        updated_by: user.id,
      };

      try {
        let existing: any = null;
        if (hasPhone) {
          const byPrimaryPhone = await service.from("public_directory_listings")
            .select("id,listing_status").eq("listing_type", "doctor").eq("phone", phone).limit(1).maybeSingle();
          if (byPrimaryPhone.error) throw byPrimaryPhone.error;
          existing = byPrimaryPhone.data;
          if (!existing && secondaryPhone) {
            const bySecondaryPhone = await service.from("public_directory_listings")
              .select("id,listing_status").eq("listing_type", "doctor").eq("secondary_phone", secondaryPhone).limit(1).maybeSingle();
            if (bySecondaryPhone.error) throw bySecondaryPhone.error;
            existing = bySecondaryPhone.data;
          }
        }
        if (!existing) {
          const byIdentity = await service.from("public_directory_listings")
            .select("id,listing_status").eq("listing_type", "doctor")
            .eq("display_name", displayName).eq("governorate", governorate).eq("district", district)
            .limit(1).maybeSingle();
          if (byIdentity.error) throw byIdentity.error;
          existing = byIdentity.data;
        }

        if (existing) {
          // Never downgrade an already-public record merely because a later source
          // snapshot omitted a phone number.
          if (existing.listing_status === "PUBLISHED" && !hasPhone) patch.listing_status = "PUBLISHED";
          const saved = await service.from("public_directory_listings")
            .update(patch).eq("id", existing.id).select("id,listing_status").single();
          if (saved.error) throw saved.error;
          updated += 1;
          if (saved.data.listing_status === "DRAFT") drafted += 1;
          results.push({ index, status: saved.data.listing_status === "PUBLISHED" ? "updated_published" : "updated_draft", id: saved.data.id });
        } else {
          const saved = await service.from("public_directory_listings")
            .insert({ ...patch, created_by: user.id }).select("id,listing_status").single();
          if (saved.error) throw saved.error;
          inserted += 1;
          if (saved.data.listing_status === "DRAFT") drafted += 1;
          results.push({ index, status: saved.data.listing_status === "PUBLISHED" ? "inserted_published" : "inserted_draft", id: saved.data.id });
        }
      } catch (error) {
        failed += 1;
        const errorCode = (error as { code?: string })?.code || "IMPORT_ROW_FAILED";
        results.push({ index, status: "failed", reason: errorCode });
      }
    }

    return out(origin, {
      success: failed === 0,
      processed: rows.length,
      inserted,
      updated,
      drafted,
      failed,
      results,
    }, failed === rows.length ? 422 : 200);
  }

  if (action === "UPSERT_LISTING") {
    const id = clean(body.id, 80);
    const displayName = clean(body.displayName, 200);
    const listingType = clean(body.listingType || "doctor", 40);
    const listingStatus = clean(body.listingStatus || "DRAFT", 20).toUpperCase();
    const functionalGroupId = clean(body.functionalGroupId || "medical_health", 80);
    const taxonomyCategoryId = clean(body.taxonomyCategoryId, 180);
    const taxonomySpecialty = clean(body.taxonomySpecialty, 160) || null;
    const slug = slugify(body.slug || displayName);
    const validGroups = new Set(["medical_health","food_grocery","fashion_beauty","home_maintenance","auto_transport","real_estate","education_training","technology_communications","professional_services","agriculture_animals"]);
    if (displayName.length < 2 || !listingTypes.has(listingType) || !listingStatuses.has(listingStatus) || !validGroups.has(functionalGroupId) || taxonomyCategoryId.length < 4) {
      return out(origin, { error: "INVALID_LISTING", message: "راجع اسم الصفحة والمجموعة الوظيفية والتصنيف وحالة النشر." }, 400);
    }
    if (!taxonomyCategoryId.startsWith("cat_" + functionalGroupId + "_") && !taxonomyCategoryId.startsWith("cat_custom_")) {
      return out(origin, { error: "TAXONOMY_GROUP_MISMATCH", message: "التصنيف المختار لا يتبع المجموعة الوظيفية المحددة." }, 400);
    }
    const phone = clean(body.phone, 40);
    const secondaryPhone = clean(body.secondaryPhone, 40);
    const hasPhone = phone.replace(/\D/g, "").length >= 7 || secondaryPhone.replace(/\D/g, "").length >= 7;
    if (listingStatus === "PUBLISHED" && !hasPhone) {
      return out(origin, { error: "PHONE_REQUIRED_FOR_PUBLICATION", message: "لا يمكن نشر النشاط قبل إضافة رقم هاتف صحيح من 7 أرقام على الأقل." }, 400);
    }
    const patch: Record<string, unknown> = {
      slug, display_name: displayName, listing_type: listingType,
      functional_group_id: functionalGroupId,
      taxonomy_category_id: taxonomyCategoryId,
      taxonomy_specialty: taxonomySpecialty,
      specialty: clean(body.specialty || taxonomySpecialty, 160) || null,
      phone: phone || null, secondary_phone: secondaryPhone || null,
      address: clean(body.address, 500) || null,
      governorate: clean(body.governorate || "المنوفية", 100),
      district: clean(body.district || "بركة السبع", 100), village: clean(body.village, 100) || null,
      source_name: clean(body.sourceName || "إدخال إدارة المنصة", 160),
      source_url: clean(body.sourceUrl, 1000) || null,
      source_checked_at: body.sourceCheckedAt ? String(body.sourceCheckedAt) : new Date().toISOString(),
      listing_status: listingStatus,
      outreach_status: outreachStatuses.has(clean(body.outreachStatus || "NEW", 40).toUpperCase()) ? clean(body.outreachStatus || "NEW", 40).toUpperCase() : "NEW",
      outreach_notes: clean(body.outreachNotes, 3000) || null,
      last_contacted_at: dateOrNull(body.lastContactedAt),
      subscription_offer_at: dateOrNull(body.subscriptionOfferAt),
      next_follow_up_at: dateOrNull(body.nextFollowUpAt),
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
    if (!["PENDING","REVIEWING"].includes(String(claim.status || "").toUpperCase())) return out(origin, { error: "CLAIM_NOT_PENDING", message: "طلب الاستلام لم يعد مفتوحًا للمراجعة." }, 409);
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
      .limit(1).maybeSingle();
    if (existingMembershipError) return out(origin, { error: "CLAIM_MEMBERSHIP_LOOKUP_FAILED" }, 500);
    const permissions = {
      ...(existingMembership?.permissions && typeof existingMembership.permissions === "object" ? existingMembership.permissions : {}),
      owner: true, catalog: true, catalog_write: true, profile_manage: true,
      subscription_status: "PAID", claimed_directory_listing_id: claim.listing_id,
    };
    if (existingMembership) {
      membershipId = String(existingMembership.id);
      const { error } = await service.from("user_memberships").update({ role: "BUSINESS_OWNER", status: "ACTIVE", permissions })
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
      claimed_at: now, last_verified_at: now, verified_by: user.id, outreach_status: "SUBSCRIBED",
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
