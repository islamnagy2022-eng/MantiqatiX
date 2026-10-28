// Supabase Edge Runtime provides Deno.serve at runtime; no runtime import is needed for its ambient type declarations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8080",
]);
const headersFor = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
});
const response = (origin: string | null, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
// PostgreSQL UUID columns accept legacy UUID-shaped values even when their
// version/variant nibbles do not follow RFC 4122.
const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isPlatformAdmin = (m: any) => String(m.role || "").toUpperCase() === "SUPER_ADMIN"
  && !m.business_id && !m.branch_id
  && m.permissions?.scope === "PLATFORM" && m.permissions?.full_control === true;
const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return response(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: headersFor(origin) });
  if (req.method !== "POST") return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return response(origin, { error: "AUTH_REQUIRED" }, 401);
  const token = authorization.slice(7).trim();
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return response(origin, { error: "SERVER_MISCONFIGURED" }, 500);
  const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const userClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });

  const { data: { user }, error: userError } = await service.auth.getUser(token);
  if (userError || !user || user.is_anonymous) return response(origin, { error: "AUTH_REQUIRED" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return response(origin, { error: "INVALID_JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return response(origin, { error: "INVALID_BODY" }, 400);
  const action = String(body.action || "").toUpperCase();

  try {
    const { data: memberships, error: membershipError } = await service.from("user_memberships")
      .select("id,user_id,tenant_id,organization_id,business_id,branch_id,role,status,permissions,created_at")
      .eq("user_id", user.id).eq("status", "ACTIVE").limit(250);
    if (membershipError) throw membershipError;
    const platformMemberships = (memberships || []).filter(isPlatformAdmin);
    if (!platformMemberships.length) return response(origin, { error: "PLATFORM_ADMIN_REQUIRED" }, 403);
    const tenantIds = [...new Set(platformMemberships.map((m: any) => String(m.tenant_id || "")).filter(Boolean))];

    const { data: tenants, error: tenantsError } = await service.from("tenants")
      .select("id,name,code,status,settings").in("id", tenantIds).eq("status", "ACTIVE").limit(100);
    if (tenantsError) throw tenantsError;
    const productionTenants = (tenants || []).filter((t: any) => {
      const id = String(t.id || "").toUpperCase();
      const purpose = String(t.settings?.purpose || "").toLowerCase();
      const code = String(t.code || "").toUpperCase();
      const name = String(t.name || "").toLowerCase();
      const testIdentity = /(^|[-_])TEST([-_]|$)|ISOLATION/.test(id) || /(^|[-_])TEST([-_]|$)|ISOLATION/.test(code);
      return !testIdentity && !purpose.includes("test") && !purpose.includes("isolation") && !name.includes("isolation test") && !name.includes("اختبار العزل");
    });
    const productionTenantIds = productionTenants.map((t: any) => String(t.id));
    if (!productionTenantIds.length) return response(origin, { error: "PRODUCTION_TENANT_REQUIRED" }, 409);

    if (action === "TENANT_LIST") {
      return response(origin, { tenants: productionTenants.map((t: any) => ({ id: t.id, name: t.name, code: t.code })) });
    }

    const requireTenant = (tenantIdValue: unknown) => {
      const tenantId = String(tenantIdValue || "").trim();
      if (!tenantId || !productionTenantIds.includes(tenantId)) throw new Error("TENANT_SCOPE_FORBIDDEN");
      return tenantId;
    };
    const getBusiness = async (tenantId: string, businessId: string) => {
      if (!isUuid(businessId)) throw new Error("INVALID_BUSINESS_ID");
      const { data, error } = await service.from("businesses").select("id,tenant_id,organization_id,name,code,status,settings")
        .eq("id", businessId).eq("tenant_id", tenantId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("BUSINESS_NOT_FOUND");
      return data;
    };

    if (action === "GET_SETTINGS") {
      const { data, error } = await service.from("bizcatalog_platform_settings")
        .select("settings").eq("settings_key", "bizcatalog").maybeSingle();
      if (error && !String(error.message || "").toLowerCase().includes("does not exist")) throw error;
      return response(origin, { settings: data?.settings || {} });
    }

    if (action === "SAVE_SETTINGS") {
      const input = body.settings && typeof body.settings === "object" ? body.settings : {};
      const safe: Record<string, unknown> = {};
      const keys = ["adminWhatsApp", "defaultCategories", "categories", "functionalGroups", "currency", "platformName", "platformEmail", "maxAllowedProductsPerBusiness", "defaultCommissionPerOrder", "overdueGracePeriodDays", "defaultPaymobFeePercentage", "defaultPaymobFeeFixed"];
      for (const k of keys) if (Object.prototype.hasOwnProperty.call(input, k)) safe[k] = input[k];
      if (Object.prototype.hasOwnProperty.call(input, "adminWhatsApp")) {
        const phone = String(input.adminWhatsApp || "").trim();
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 15) return response(origin, { error: "INVALID_ADMIN_WHATSAPP", message: "أدخل رقم واتساب صحيحًا من 10 إلى 15 رقمًا." }, 400);
        safe.adminWhatsApp = phone.slice(0, 40);
      }
      if (Object.prototype.hasOwnProperty.call(input, "defaultCommissionPerOrder")) {
        const commission = Number(input.defaultCommissionPerOrder);
        if (!Number.isFinite(commission) || commission < 0 || commission > 1000000) return response(origin, { error: "INVALID_DEFAULT_COMMISSION" }, 400);
        safe.defaultCommissionPerOrder = commission;
      }
      const { data: existing, error: readError } = await service.from("bizcatalog_platform_settings")
        .select("settings").eq("settings_key", "bizcatalog").maybeSingle();
      if (readError) throw readError;
      const current = existing?.settings && typeof existing.settings === "object" && !Array.isArray(existing.settings) ? existing.settings : {};
      const merged = { ...current, ...safe };
      const { error } = await service.from("bizcatalog_platform_settings").upsert({
        settings_key: "bizcatalog", settings: merged, updated_by: user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "settings_key" });
      if (error) throw error;
      return response(origin, { success: true, settings: merged });
    }

    if (action === "LIST_SUBSCRIBERS") {
      const { data: membershipRows, error: membershipListError } = await service.from("user_memberships")
        .select("id,user_id,tenant_id,organization_id,business_id,branch_id,role,status,permissions,created_at")
        .in("tenant_id", productionTenantIds).order("created_at", { ascending: false }).limit(1500);
      if (membershipListError) throw new Error("SUBSCRIBER_MEMBERSHIP_LIST_FAILED");

      const { data: businessRows, error: businessListError } = await service.from("businesses")
        .select("id,tenant_id,organization_id,name,code,status")
        .in("tenant_id", productionTenantIds).limit(1000);
      if (businessListError) throw new Error("SUBSCRIBER_BUSINESS_LIST_FAILED");
      const businessMap = new Map((businessRows || []).map((b: any) => [String(b.id), b]));

      // Auth is the source of account identity. Membership rows alone cannot represent
      // Google accounts that have not yet been assigned a role/activity.
      const authUsers: any[] = [];
      for (let page = 1; page <= 50; page += 1) {
        const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw new Error("AUTH_USER_DIRECTORY_FAILED");
        const pageUsers = data?.users || [];
        authUsers.push(...pageUsers.filter((u: any) => !u.is_anonymous));
        if (pageUsers.length < 1000) break;
        if (page === 50) throw new Error("AUTH_USER_DIRECTORY_LIMIT_REACHED");
      }
      const userMap = new Map(authUsers.map((u: any) => [String(u.id), u]));
      const rows = (membershipRows || []).filter((m: any) => userMap.has(String(m.user_id)));
      const ignoredOrphanMemberships = (membershipRows || []).length - rows.length;
      const assignedUserIds = new Set(rows.map((m: any) => String(m.user_id)));

      const providerOf = (u: any) => {
        const providers = [
          u?.app_metadata?.provider,
          ...(Array.isArray(u?.app_metadata?.providers) ? u.app_metadata.providers : []),
          ...(Array.isArray(u?.identities) ? u.identities.map((i: any) => i?.provider) : []),
        ].map((v: unknown) => String(v || "").toLowerCase()).filter(Boolean);
        return providers.includes("google") ? "google" : providers[0] || "email";
      };
      const nameOf = (u: any) => String(u?.user_metadata?.full_name || u?.user_metadata?.name || u?.user_metadata?.fullName || u?.email || "حساب بدون اسم");
      const phoneOf = (u: any) => String(u?.user_metadata?.phone || u?.phone || "");
      const accountBase = (u: any) => ({
        userId: String(u.id),
        fullName: nameOf(u),
        email: String(u.email || ""),
        phone: phoneOf(u),
        provider: providerOf(u),
        emailConfirmed: Boolean(u.email_confirmed_at),
        lastSignInAt: String(u.last_sign_in_at || ""),
        createdAt: String(u.created_at || ""),
        joinedDate: String(u.created_at || "").slice(0, 10),
        username: String(u.email || ""),
        authMethod: providerOf(u) === "google" ? "gmail_invite" : "direct_password",
        inviteStatus: "pending",
      });
      const subscribers = rows.map((m: any) => {
        const u: any = userMap.get(String(m.user_id));
        const b: any = businessMap.get(String(m.business_id || ""));
        return {
          id: String(m.id),
          ...accountBase(u),
          tenantId: String(m.tenant_id || ""),
          organizationId: String(m.organization_id || ""),
          businessId: String(m.business_id || ""),
          branchId: String(m.branch_id || ""),
          businessName: String(b?.name || ""),
          role: String(m.role || "CUSTOMER").toUpperCase(),
          status: String(m.status).toUpperCase() === "ACTIVE" ? "active" : String(m.status).toUpperCase() === "INACTIVE" ? "pending" : "suspended",
          membershipStatus: String(m.status || "INACTIVE").toUpperCase(),
          permissions: m.permissions && typeof m.permissions === "object" && !Array.isArray(m.permissions) ? m.permissions : {},
          isAccountOnly: false,
          isPlatformAccount: isPlatformAdmin(m),
        };
      });
      for (const u of authUsers) {
        if (assignedUserIds.has(String(u.id))) continue;
        subscribers.push({
          id: `ACCOUNT:${String(u.id)}`,
          ...accountBase(u),
          tenantId: "", organizationId: "", businessId: "", branchId: "", businessName: "",
          role: "CUSTOMER", status: "NONE", membershipStatus: "NONE", permissions: {},
          isAccountOnly: true, isPlatformAccount: false,
        });
      }
      subscribers.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      return response(origin, { subscribers, ignoredOrphanMemberships, source: "SUPABASE_AUTH_AND_USER_MEMBERSHIPS" });
    }

    if (action === "CREATE_BUSINESS") {
      const input = body.business && typeof body.business === "object" ? body.business : {};
      const name = String(input.name || "").trim();
      const category = String(input.category || "").trim();
      const activityGroupCode = String(input.activityGroupCode || "").trim().toLowerCase();
      const activityClassificationType = String(input.activityClassificationType || "activity").trim().toLowerCase();
      const activitySpecialty = String(input.activitySpecialty || "").trim();
      const canonicalActivityGroups = new Set([
        "medical_health", "food_grocery", "fashion_beauty", "home_maintenance",
        "construction_decor", "auto_transport", "real_estate", "education_training",
        "technology_communications", "professional_services", "marketing_media",
        "trade_ecommerce", "agriculture_animals", "sports_fitness", "tourism_events",
        "finance_insurance", "industry_workshops", "public_community",
      ]);
      const phone = String(input.phone || "").trim();
      const phoneDigits = phone.replace(/\D/g, "");
      const governorate = String(input.governorate || "").trim();
      const markaz = String(input.markaz || "").trim();
      const village = String(input.village || "").trim();
      const bio = String(input.bio || "").trim();
      const address = String(input.address || "").trim();
      const workingHours = String(input.workingHours || "").trim();
      const logoUrl = String(input.logoUrl || "").trim();
      const coverUrl = String(input.coverUrl || "").trim();
            let paymentDueDate = String(input.paymentDueDate || "").trim();
      const paymentGracePeriodDays = Number(input.paymentGracePeriodDays ?? 7);
      if (!paymentDueDate) {
        const defaultDueDate = new Date();
        defaultDueDate.setUTCDate(defaultDueDate.getUTCDate() + 7);
        paymentDueDate = defaultDueDate.toISOString().slice(0, 10);
      }
      if (name.length < 2 || name.length > 200) return response(origin, { error: "INVALID_BUSINESS_NAME" }, 400);
      if (category.length < 2 || category.length > 100) return response(origin, { error: "INVALID_BUSINESS_CATEGORY" }, 400);
      if (activityGroupCode && !canonicalActivityGroups.has(activityGroupCode)) return response(origin, { error: "INVALID_ACTIVITY_GROUP" }, 400);
      if (!["activity", "profession"].includes(activityClassificationType)) return response(origin, { error: "INVALID_ACTIVITY_CLASSIFICATION_TYPE" }, 400);
      if (activitySpecialty.length > 120) return response(origin, { error: "INVALID_ACTIVITY_SPECIALTY" }, 400);
      if (phoneDigits.length < 10 || phoneDigits.length > 15) return response(origin, { error: "INVALID_BUSINESS_WHATSAPP", message: "A valid owner WhatsApp number is required." }, 400);
      if ([governorate, markaz].some((value) => value.length < 2 || value.length > 100) || village.length > 100) return response(origin, { error: "INVALID_BUSINESS_LOCATION" }, 400);
      const parsedDueDate = new Date(`${paymentDueDate}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDueDate) || Number.isNaN(parsedDueDate.getTime()) || parsedDueDate.toISOString().slice(0, 10) !== paymentDueDate) return response(origin, { error: "INVALID_PAYMENT_DUE_DATE" }, 400);
      if (!Number.isInteger(paymentGracePeriodDays) || paymentGracePeriodDays < 0 || paymentGracePeriodDays > 90) return response(origin, { error: "INVALID_PAYMENT_GRACE_PERIOD" }, 400);
      const tenantId = requireTenant(body.tenantId || productionTenantIds.find((id) => id === "MNTY-PLATFORM") || productionTenantIds[0]);
      const { data: tenant, error: tenantError } = await service.from("tenants").select("id,status").eq("id", tenantId).eq("status", "ACTIVE").maybeSingle();
      if (tenantError) throw tenantError;
      if (!tenant) throw new Error("TENANT_NOT_ACTIVE");
      const platformMembership = platformMemberships.find((m: any) => String(m.tenant_id) === tenantId);
      const { data: orgs, error: orgError } = await service.from("organizations").select("id")
        .eq("tenant_id", tenantId).eq("status", "ACTIVE").limit(1);
      if (orgError) throw orgError;
      const organizationId = platformMembership?.organization_id || orgs?.[0]?.id || null;
      const randomCode = crypto.randomUUID().slice(0, 8).toUpperCase();
      const slug = slugify(String(input.slug || name)) || `business-${randomCode.toLowerCase()}`;
      let createdBusinessId = "";
      try {
        const businessId = crypto.randomUUID();
        const { data: created, error: createError } = await service.from("businesses").insert({
          id: businessId, tenant_id: tenantId, organization_id: organizationId, name,
          code: `MX-${randomCode}`, status: "INACTIVE",
          settings: {
            activity_code: category,
            category_code: category,
            ...(activityGroupCode ? { activity_group_code: activityGroupCode } : {}),
            activity_classification_type: activityClassificationType,
            activity_specialty: activitySpecialty || null,
            catalog_public_enabled: false,
            catalog_profile: { bio: bio.slice(0, 3000), governorate: governorate.slice(0, 100), markaz: markaz.slice(0, 100), village: village.slice(0, 100), working_hours: workingHours.slice(0, 300), logo_url: logoUrl.slice(0, 1500), cover_url: coverUrl.slice(0, 1500) },
            bizcatalog: { paymentStatus: "pending", paymentDueDate, paymentGracePeriodDays, publicationStatus: "PENDING_PUBLICATION", isFrozen: false, totalOrdersCount: 0, paymentConfirmedByAdmin: false } },
        }).select("id,tenant_id,organization_id,name,code,status,settings").single();
        if (createError) throw createError;
        createdBusinessId = String(created.id);
        const branchId = `main-${crypto.randomUUID().slice(0, 8)}`;
        const { error: branchError } = await service.from("branches").insert({
          id: branchId, tenant_id: tenantId, organization_id: organizationId, business_id: created.id,
          name: `${name} - الفرع الرئيسي`, code: `MAIN-${randomCode}`, status: "ACTIVE",
          phone: phone.slice(0, 40), address: address.slice(0, 500) || null,
          settings: { source: "bizcatalog-manager" },
        });
        if (branchError) throw branchError;
        const { error: providerError } = await service.from("marketing_provider_profiles").insert({
          provider_kind: "OFFICIAL", business_id: created.id,
          owner_user_id: null, name_ar: name, name_en: null, slug: `${slug}-${randomCode.toLowerCase()}`,
          description: bio.slice(0, 3000) || null, specialties: activitySpecialty ? [activitySpecialty] : [], service_areas: [], portfolio: [],
          status: "PENDING", is_verified: false, is_featured: false, ranking_weight: 0,
          settings: {
            ...(activityGroupCode ? { activity_group_code: activityGroupCode } : {}),
            activity_classification_type: activityClassificationType,
            activity_specialty: activitySpecialty || null,
          },
        });
        if (providerError) throw providerError;
        return response(origin, { business: { id: created.id, tenantId, organizationId, branchId, name, slug: `${slug}-${randomCode.toLowerCase()}`, category, status: "INACTIVE" } }, 201);
      } catch (error) {
        if (createdBusinessId) {
          await service.from("marketing_provider_profiles").delete().eq("business_id", createdBusinessId);
          await service.from("branches").delete().eq("business_id", createdBusinessId);
          await service.from("businesses").delete().eq("id", createdBusinessId).eq("tenant_id", tenantId);
        }
        throw error;
      }
    }

    if (action === "CREATE_SUBSCRIBER") {
      const tenantId = requireTenant(body.tenantId);
      const businessId = String(body.businessId || "");
      const business = await getBusiness(tenantId, businessId);
      if (String(business.status).toUpperCase() !== "ACTIVE") throw new Error("BUSINESS_NOT_ACTIVE");
      const email = String(body.email || "").trim().toLowerCase();
      const fullName = String(body.fullName || "").trim();
      const phone = String(body.phone || "").trim();
      if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response(origin, { error: "INVALID_EMAIL" }, 400);
      if (fullName.length < 2 || fullName.length > 160) return response(origin, { error: "INVALID_SUBSCRIBER_NAME" }, 400);

      // Reuse an existing Google/Supabase identity when the email already exists.
      // Never create a second account or set a password: subscriber login is Google-only.
      const findAuthUserByEmail = async () => {
        for (let page = 1; page <= 100; page += 1) {
          const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
          if (error) throw new Error("AUTH_USER_LOOKUP_FAILED");
          const users = data?.users || [];
          const match = users.find((candidate: any) => String(candidate.email || "").trim().toLowerCase() === email);
          if (match) return match;
          if (users.length < 1000) return null;
        }
        throw new Error("AUTH_USER_LOOKUP_LIMIT_REACHED");
      };

      let authUser = await findAuthUserByEmail();
      let createdAuthUser = false;
      if (!authUser) {
        const { data: authResult, error: authError } = await service.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName, name: fullName, phone: phone.slice(0, 40), onboarding_source: "catalog-platform-admin" },
        });
        if (authError || !authResult.user) {
          // Another request may have created this email between lookup and insert.
          authUser = await findAuthUserByEmail();
          if (!authUser) throw new Error(authError?.message || "AUTH_USER_CREATE_FAILED");
        } else {
          authUser = authResult.user;
          createdAuthUser = true;
        }
      }
      const userId = String(authUser.id);

      const { data: existingMemberships, error: existingMembershipError } = await service.from("user_memberships")
        .select("id,status").eq("user_id", userId).eq("tenant_id", tenantId).eq("business_id", businessId)
        .in("role", ["OWNER", "BUSINESS_OWNER"]).order("created_at", { ascending: true }).limit(1);
      if (existingMembershipError) {
        // Keep the Auth identity on database lookup failures. A concurrent request may
        // already have attached it to another membership; deleting it here could cascade
        // into valid production data.
        throw new Error("SUBSCRIBER_MEMBERSHIP_LOOKUP_FAILED");
      }
      const existingMembership = existingMemberships?.[0];
      if (existingMembership) {
        const membershipStatus = String(existingMembership.status).toUpperCase();
        return response(origin, {
          success: true, membershipId: existingMembership.id, userId, email,
          status: membershipStatus, paymentRequired: membershipStatus !== "ACTIVE",
          reusedAccount: true, existingMembership: true,
        }, 200);
      }

      const membershipId = crypto.randomUUID();
      const { error: membershipInsertError } = await service.from("user_memberships").insert({
        id: membershipId, user_id: userId, tenant_id: tenantId, organization_id: business.organization_id || null,
        business_id: businessId, branch_id: null, role: "BUSINESS_OWNER", status: "INACTIVE", permissions: { catalog: true, subscription_status: "PENDING_PAYMENT" },
      });
      if (membershipInsertError) {
        // The null-safe unique index on (user_id, business_id, COALESCE(branch_id, ''))
        // prevents duplicate business-wide memberships. If another request won the race,
        // return its membership rather than treating the duplicate
        // as a fatal error. Never delete the Auth user here: another request may have
        // successfully attached that identity and deletion could cascade into production.
        const { data: racedMemberships, error: raceLookupError } = await service.from("user_memberships")
          .select("id,status").eq("user_id", userId).eq("tenant_id", tenantId).eq("business_id", businessId)
          .in("role", ["OWNER", "BUSINESS_OWNER"]).order("created_at", { ascending: true }).limit(1);
        if (!raceLookupError && racedMemberships?.[0]) {
          const racedMembership = racedMemberships[0];
          const membershipStatus = String(racedMembership.status).toUpperCase();
          return response(origin, {
            success: true, membershipId: racedMembership.id, userId, email,
            status: membershipStatus, paymentRequired: membershipStatus !== "ACTIVE",
            reusedAccount: true, existingMembership: true, recoveredRace: true,
          }, 200);
        }
        throw new Error(membershipInsertError.message || "SUBSCRIBER_MEMBERSHIP_CREATE_FAILED");
      }
      await service.from("audit_logs").insert({
        actor_user_id: user.id, action: "BIZCATALOG_SUBSCRIBER_CREATED", entity_type: "user_membership",
        entity_id: membershipId, details: { tenantId, businessId, subscriberUserId: userId, reusedAuthIdentity: !createdAuthUser },
      }).then(() => {}).catch(() => {});
      return response(origin, { success: true, membershipId, userId, email, status: "INACTIVE", paymentRequired: true, reusedAccount: !createdAuthUser }, 201);
    }

    if (action === "SUBSCRIBER_STATUS") {
      const membershipId = String(body.membershipId || "");
      const status = String(body.status || "").toUpperCase();
      if (!membershipId || !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) return response(origin, { error: "INVALID_SUBSCRIBER_STATUS" }, 400);
      const { data: membership, error: findError } = await service.from("user_memberships")
        .select("id,user_id,tenant_id,business_id,branch_id,role,status,permissions").eq("id", membershipId).maybeSingle();
      if (findError) throw findError;
      if (!membership || !productionTenantIds.includes(String(membership.tenant_id))
        || String(membership.role || "").toUpperCase() === "SUPER_ADMIN" || isPlatformAdmin(membership)) {
        throw new Error("SUBSCRIBER_NOT_FOUND");
      }
      const role = String(membership.role || "").toUpperCase();
      if (status === "ACTIVE" && membership.business_id && ["OWNER", "BUSINESS_OWNER"].includes(role)) {
        const business = await getBusiness(String(membership.tenant_id), String(membership.business_id));
        const billing = business.settings?.bizcatalog && typeof business.settings.bizcatalog === "object" ? business.settings.bizcatalog : {};
        const isOfficialShowcase = business.settings?.source === "OFFICIAL_PLATFORM_SHOWCASE" || business.settings?.managed_by === "SUPER_ADMIN";
        if (!isOfficialShowcase && (String(billing.paymentStatus || "").toLowerCase() !== "paid" || billing.paymentConfirmedByAdmin !== true)) {
          return response(origin, { error: "SUBSCRIPTION_PAYMENT_REQUIRED", message: "Confirm the business subscription payment before activating the owner membership." }, 409);
        }
      }
      const { error } = await service.from("user_memberships").update({ status }).eq("id", membershipId).in("tenant_id", productionTenantIds);
      if (error) throw error;
      return response(origin, { success: true, membershipId, status });
    }

    if (action === "SAVE_MEMBERSHIP") {
      const tenantId = requireTenant(body.tenantId);
      const userId = String(body.userId || "").trim();
      const membershipId = String(body.membershipId || "").trim();
      const role = String(body.role || "CUSTOMER").trim().toUpperCase();
      const status = String(body.status || "INACTIVE").trim().toUpperCase();
      const businessId = String(body.businessId || "").trim();
      const branchId = String(body.branchId || "").trim();
      const allowedRoles = new Set([
        "CUSTOMER", "OWNER", "BUSINESS_OWNER", "ADMIN", "MANAGER", "FINANCE", "SALES", "MARKETING",
        "SUPPORT", "SUPPORT_MANAGER", "EMPLOYEE", "STAFF", "SERVICE_PROVIDER", "PROVIDER_OWNER",
        "PROVIDER_ADMIN", "BRANCH_MANAGER", "PROVIDER_FINANCE", "PROVIDER_MARKETING",
        "PROVIDER_OPERATIONS", "PROVIDER_SUPPORT",
      ]);
      if (!isUuid(userId) || !allowedRoles.has(role) || !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
        return response(origin, { error: "INVALID_MEMBERSHIP_ASSIGNMENT" }, 400);
      }
      // Prevent tenant-wide administrative/merchant roles from being granted
      // accidentally. Every non-customer assignment must be scoped to a business.
      if (!businessId && role !== "CUSTOMER") {
        return response(origin, { error: "BUSINESS_REQUIRED_FOR_ROLE", message: "اختر نشاطًا قبل إسناد دور إداري أو تشغيلي." }, 400);
      }
      const { data: authResult, error: authLookupError } = await service.auth.admin.getUserById(userId);
      if (authLookupError || !authResult?.user || authResult.user.is_anonymous) return response(origin, { error: "AUTH_USER_NOT_FOUND" }, 404);

      let business: any = null;
      if (businessId) {
        business = await getBusiness(tenantId, businessId);
        if (String(business.status || "").toUpperCase() !== "ACTIVE" && status === "ACTIVE") {
          return response(origin, { error: "BUSINESS_NOT_ACTIVE" }, 409);
        }
      } else if (branchId) {
        return response(origin, { error: "BRANCH_REQUIRES_BUSINESS" }, 400);
      }
      if (branchId) {
        if (!businessId || !safeBranch(branchId)) return response(origin, { error: "INVALID_BRANCH_ID" }, 400);
        const { data: branch, error: branchError } = await service.from("branches").select("id")
          .eq("id", branchId).eq("business_id", businessId).eq("tenant_id", tenantId).eq("status", "ACTIVE").maybeSingle();
        if (branchError) throw branchError;
        if (!branch) return response(origin, { error: "BRANCH_NOT_FOUND" }, 404);
      }

      let existing: any = null;
      if (membershipId) {
        const { data, error } = await service.from("user_memberships")
          .select("id,user_id,tenant_id,organization_id,business_id,branch_id,role,status,permissions")
          .eq("id", membershipId).maybeSingle();
        if (error) throw error;
        existing = data;
        if (!existing || !productionTenantIds.includes(String(existing.tenant_id))
          || String(existing.user_id) !== userId
          || String(existing.role || "").toUpperCase() === "SUPER_ADMIN" || isPlatformAdmin(existing)) {
          return response(origin, { error: "MEMBERSHIP_NOT_EDITABLE" }, 403);
        }
      } else {
        let existingQuery = service.from("user_memberships")
          .select("id,user_id,tenant_id,organization_id,business_id,branch_id,role,status,permissions")
          .eq("user_id", userId).eq("tenant_id", tenantId).limit(1);
        existingQuery = businessId ? existingQuery.eq("business_id", businessId) : existingQuery.is("business_id", null);
        existingQuery = branchId ? existingQuery.eq("branch_id", branchId) : existingQuery.is("branch_id", null);
        const { data, error } = await existingQuery;
        if (error) throw error;
        existing = (data || []).find((row: any) => String(row.role || "").toUpperCase() !== "SUPER_ADMIN" && !isPlatformAdmin(row)) || null;
      }

      const previousPermissions = existing?.permissions && typeof existing.permissions === "object" && !Array.isArray(existing.permissions)
        ? { ...existing.permissions } : {};
      delete previousPermissions.scope;
      delete previousPermissions.full_control;
      const catalogEnabled = typeof body.catalogEnabled === "boolean" ? body.catalogEnabled : previousPermissions.catalog !== false;
      const catalogWrite = typeof body.catalogWrite === "boolean" ? body.catalogWrite : previousPermissions.catalog_write !== false && previousPermissions.catalog_read_only !== true;
      previousPermissions.catalog = catalogEnabled;
      previousPermissions.catalog_write = catalogWrite;
      previousPermissions.catalog_read_only = catalogEnabled && !catalogWrite;
      previousPermissions.account_restricted = body.accountRestricted === true;

      if (status === "ACTIVE" && business && ["OWNER", "BUSINESS_OWNER"].includes(role)) {
        const billing = business.settings?.bizcatalog && typeof business.settings.bizcatalog === "object" ? business.settings.bizcatalog : {};
        const isOfficialShowcase = business.settings?.source === "OFFICIAL_PLATFORM_SHOWCASE" || business.settings?.managed_by === "SUPER_ADMIN";
        if (!isOfficialShowcase && (String(billing.paymentStatus || "").toLowerCase() !== "paid" || billing.paymentConfirmedByAdmin !== true)) {
          return response(origin, { error: "SUBSCRIPTION_PAYMENT_REQUIRED", message: "يجب تأكيد سداد اشتراك النشاط قبل تفعيل دور المالك." }, 409);
        }
      }

      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        organization_id: business?.organization_id || existing?.organization_id || null,
        business_id: businessId || null,
        branch_id: branchId || null,
        role,
        status,
        permissions: previousPermissions,
      };
      let saved: any;
      if (existing) {
        const { data, error } = await service.from("user_memberships").update(payload).eq("id", existing.id)
          .select("id,user_id,tenant_id,organization_id,business_id,branch_id,role,status,permissions,created_at").single();
        if (error) throw error;
        saved = data;
      } else {
        const id = crypto.randomUUID();
        const { data, error } = await service.from("user_memberships").insert({
          id, user_id: userId, ...payload,
        }).select("id,user_id,tenant_id,organization_id,business_id,branch_id,role,status,permissions,created_at").single();
        if (error) {
          // Handle a concurrent assignment safely by re-reading the canonical membership.
          throw new Error("MEMBERSHIP_SAVE_FAILED");
        }
        saved = data;
      }
      const { data: savedBusiness } = businessId
        ? await service.from("businesses").select("id,name").eq("id", businessId).maybeSingle()
        : { data: null };
      return response(origin, {
        success: true,
        membership: {
          id: String(saved.id), userId: String(saved.user_id), tenantId: String(saved.tenant_id),
          organizationId: String(saved.organization_id || ""), businessId: String(saved.business_id || ""),
          branchId: String(saved.branch_id || ""), role: String(saved.role || ""),
          status: String(saved.status || ""), permissions: saved.permissions || {},
          businessName: String(savedBusiness?.name || ""), createdAt: saved.created_at,
        },
      });
    }

    if (action === "BUSINESS_SETTINGS_UPDATE") {
      const tenantId = requireTenant(body.tenantId);
      const businessId = String(body.businessId || "");
      const business = await getBusiness(tenantId, businessId);
      const incoming = body.settings && typeof body.settings === "object" ? body.settings : {};
      const allowed = ["commissionPerOrder", "totalOrdersCount", "paymentStatus", "overdueDaysCount", "isFrozen", "operationalStatus", "lastPaymentDate", "paymentConfirmedByAdmin", "paymentDueDay", "paymentDueDate"];
      const current = business.settings?.bizcatalog && typeof business.settings.bizcatalog === "object" ? business.settings.bizcatalog : {};
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (Object.prototype.hasOwnProperty.call(incoming, k)) patch[k] = incoming[k];
      const nextSettings = { ...(business.settings || {}), bizcatalog: { ...current, ...patch } };
      const operationalStatus = String(patch.operationalStatus || "").toUpperCase();
      const nextBusinessStatus = operationalStatus === "ACTIVE" ? "ACTIVE" : operationalStatus === "INACTIVE" ? "INACTIVE" : operationalStatus === "FROZEN" ? "SUSPENDED" : String(business.status || "INACTIVE").toUpperCase();
      const updatePayload: Record<string, unknown> = { settings: nextSettings, updated_at: new Date().toISOString() };
      if (["ACTIVE", "INACTIVE", "FROZEN"].includes(operationalStatus)) updatePayload.status = nextBusinessStatus;
      const { error } = await service.from("businesses").update(updatePayload).eq("id", businessId).eq("tenant_id", tenantId);
      if (error) throw error;

      // Only an explicit admin-confirmed paid state can activate pending owner memberships.
      if (String(patch.paymentStatus || "").toLowerCase() === "paid" && patch.paymentConfirmedByAdmin === true) {
        const { error: activationError } = await service.from("user_memberships")
          .update({ status: "ACTIVE", permissions: { catalog: true, subscription_status: "ACTIVE" } })
          .eq("tenant_id", tenantId)
          .eq("business_id", businessId)
          .eq("status", "INACTIVE")
          .contains("permissions", { subscription_status: "PENDING_PAYMENT" })
          .in("role", ["OWNER", "BUSINESS_OWNER"]);
        if (activationError) throw new Error("PAID_SUBSCRIPTION_ACTIVATION_FAILED");
      }
      return response(origin, { success: true, settings: patch });
    }

    if (action === "DEACTIVATE_BUSINESS") {
      const tenantId = requireTenant(body.tenantId);
      const businessId = String(body.businessId || "");
      const business = await getBusiness(tenantId, businessId);
      const settings = { ...(business.settings || {}), catalog_public_enabled: false };
      const { error } = await service.from("businesses").update({ status: "INACTIVE", settings, updated_at: new Date().toISOString() })
        .eq("id", businessId).eq("tenant_id", tenantId);
      if (error) throw error;
      return response(origin, { success: true, businessId, status: "INACTIVE" });
    }

    if (action === "DELETE_BUSINESS") {
      const tenantId = requireTenant(body.tenantId);
      const businessId = String(body.businessId || "").trim();
      if (!isUuid(businessId)) return response(origin, { error: "INVALID_BUSINESS_ID" }, 400);
      await getBusiness(tenantId, businessId);
      const { data, error } = await service.rpc("mnty_platform_admin_delete_business", {
        p_tenant_id: tenantId,
        p_business_id: businessId,
        p_actor_user_id: user.id,
      });
      if (error) {
        const message = String(error.message || "");
        if (message.includes("BUSINESS_DELETE_BLOCKED_BY_HISTORY")) {
          return response(origin, {
            error: "BUSINESS_DELETE_BLOCKED_BY_HISTORY",
            message: "لا يمكن حذف النشاط نهائيًا لوجود طلبات أو حركات مخزون/محاسبة أو اتفاقيات مرتبطة به. يمكنك تجميده أو تعطيله مع الحفاظ على السجلات المالية.",
          }, 409);
        }
        if (message.includes("BUSINESS_NOT_FOUND")) return response(origin, { error: "BUSINESS_NOT_FOUND" }, 404);
        throw error;
      }
      return response(origin, data || { success: true, businessId, deleted: true });
    }

    return response(origin, { error: "UNSUPPORTED_ACTION" }, 400);
  } catch (error) {
    const errorRecord = error && typeof error === "object" ? error as Record<string, unknown> : {};
    const message = error instanceof Error ? error.message : String(errorRecord.message || errorRecord.code || "CATALOG_PLATFORM_OPERATION_FAILED");
    console.error("catalog-platform-admin failed", { message, code: errorRecord.code, details: errorRecord.details, hint: errorRecord.hint });
    const known = ["TENANT_SCOPE_FORBIDDEN", "BUSINESS_NOT_FOUND", "INVALID_BUSINESS_ID", "TENANT_NOT_ACTIVE", "BUSINESS_NOT_ACTIVE", "SUBSCRIBER_NOT_FOUND", "PRODUCTION_TENANT_REQUIRED"];
    return response(origin, { error: known.includes(message) ? message : "CATALOG_PLATFORM_OPERATION_FAILED" }, known.includes(message) ? 403 : 400);
  }
});
