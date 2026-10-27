import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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

    if (action === "PLATFORM_DASHBOARD_METRICS") {
      const countQuery = async (query: any) => {
        const { count, error } = await query;
        if (error) throw error;
        return Number(count || 0);
      };
      const [businesses, activeBusinesses, inactiveBusinesses, suspendedBusinesses,
        activeOwners, unassignedBusinesses, customers, activeSubscriptions, pastDueSubscriptions,
        cancelledSubscriptions, activeGroups, activeActivities, recentAudit] = await Promise.all([
        countQuery(service.from("businesses").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds)),
        countQuery(service.from("businesses").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds).eq("status", "ACTIVE")),
        countQuery(service.from("businesses").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds).eq("status", "INACTIVE")),
        countQuery(service.from("businesses").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds).eq("status", "SUSPENDED")),
        countQuery(service.from("user_memberships").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds).in("role", ["OWNER", "BUSINESS_OWNER"]).eq("status", "ACTIVE")),
        countQuery(service.from("businesses").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds).not("id", "in", "(select business_id from user_memberships where status = 'ACTIVE' and role in ('OWNER','BUSINESS_OWNER'))")),
        countQuery(service.from("user_memberships").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds).eq("role", "CUSTOMER").eq("status", "ACTIVE")),
        countQuery(service.from("business_subscriptions").select("id", { count: "exact", head: true }).eq("status", "ACTIVE")),
        countQuery(service.from("business_subscriptions").select("id", { count: "exact", head: true }).in("status", ["PAST_DUE", "PAST-DUE", "UNPAID"])),
        countQuery(service.from("business_subscriptions").select("id", { count: "exact", head: true }).in("status", ["CANCELLED", "CANCELED"])),
        countQuery(service.from("business_activity_types").select("id", { count: "exact", head: true }).eq("node_type", "SECTOR_GROUP").eq("status", "ACTIVE")),
        countQuery(service.from("business_activity_types").select("id", { count: "exact", head: true }).neq("node_type", "SECTOR_GROUP").eq("status", "ACTIVE")),
        service.from("audit_logs").select("action,entity_type,entity_id,result,created_at").eq("tenant_id", String(platformMemberships[0].tenant_id)).order("created_at", { ascending: false }).limit(8),
      ]);
      const auditResult = recentAudit as any;
      if (auditResult.error) throw auditResult.error;
      return response(origin, {
        metrics: {
          businesses, activeBusinesses, inactiveBusinesses, suspendedBusinesses,
          activeOwners, unassignedBusinesses, customers,
          activeSubscriptions, pastDueSubscriptions, cancelledSubscriptions,
          activeActivityGroups: activeGroups, activeActivities,
          visits: null, visitsStatus: "NOT_WIRED",
          commissionAccrued: null, commissionCollected: null, commissionOutstanding: null,
          claimsDue: null, claimsStatus: "NOT_WIRED",
        },
        recentAudit: auditResult.data || [],
        metricDefinitions: {
          businesses: "عدد سجلات businesses ضمن نطاقات الإنتاج المصرح بها",
          customers: "عضويات CUSTOMER النشطة فقط؛ قد لا تمثل عدد الأشخاص الفريدين",
          activeOwners: "عضويات مالك النشاط النشطة وليست عدد المستخدمين الفريدين",
          visits: "لا يوجد حتى الآن مصدر زيارات موحد موثق في هذا المسار؛ لا يتم اختلاق أرقام",
          commissions: "تحتاج ربطًا موثقًا بحالات دفتر الأستاذ والتسويات قبل عرض إجماليات مالية",
        },
      });
    }

    if (action === "LIST_ACTIVITY_TYPES") {
      const { data: rows, error } = await service.from("business_activity_types")
        .select("id,sector_id,parent_id,legacy_category_id,code,name_ar,name_en,node_type,status,sort_order,metadata,created_at,updated_at")
        .order("sector_id", { ascending: true }).order("sort_order", { ascending: true }).order("name_ar", { ascending: true }).limit(2000);
      if (error) throw error;
      return response(origin, { activityTypes: rows || [] });
    }

    if (action === "UPSERT_ACTIVITY_TYPE") {
      const input = body.activityType && typeof body.activityType === "object" ? body.activityType : {};
      const id = String(input.id || "").trim();
      const sectorId = String(input.sector_id || "").trim();
      const parentId = String(input.parent_id || "").trim() || null;
      const code = String(input.code || "").trim().toUpperCase();
      const nameAr = String(input.name_ar || "").trim();
      const nameEn = String(input.name_en || "").trim();
      const nodeType = String(input.node_type || "").trim().toUpperCase();
      const status = String(input.status || "ACTIVE").trim().toUpperCase();
      const sortOrder = Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : 100;
      if (!/^[a-zA-Z0-9_-]{2,100}$/.test(id) || !/^[A-Z0-9_-]{2,100}$/.test(code)
        || nameAr.length < 2 || nameAr.length > 160 || nameEn.length > 160
        || !["SECTOR_GROUP", "ACTIVITY", "SPECIALTY"].includes(nodeType)
        || !["ACTIVE", "INACTIVE", "ARCHIVED"].includes(status)
        || !/^[A-Z0-9_-]{2,100}$/.test(sectorId)) {
        return response(origin, { error: "INVALID_ACTIVITY_TYPE" }, 400);
      }
      const { data: sector, error: sectorError } = await service.from("business_sectors")
        .select("id").eq("id", sectorId).maybeSingle();
      if (sectorError) throw sectorError;
      if (!sector) return response(origin, { error: "ACTIVITY_SECTOR_NOT_FOUND" }, 400);
      if (parentId) {
        if (parentId === id) return response(origin, { error: "INVALID_ACTIVITY_PARENT" }, 400);
        const { data: parent, error: parentError } = await service.from("business_activity_types")
          .select("id,sector_id,node_type").eq("id", parentId).maybeSingle();
        if (parentError) throw parentError;
        if (!parent || String(parent.sector_id) !== sectorId
          || (nodeType === "SECTOR_GROUP" && parent.node_type !== "SECTOR_GROUP")) {
          return response(origin, { error: "INVALID_ACTIVITY_PARENT" }, 400);
        }
      } else if (nodeType !== "SECTOR_GROUP") {
        return response(origin, { error: "ACTIVITY_PARENT_REQUIRED" }, 400);
      }
      const { data: previous, error: previousError } = await service.from("business_activity_types")
        .select("*").eq("id", id).maybeSingle();
      if (previousError) throw previousError;
      const next = {
        id, sector_id: sectorId, parent_id: parentId,
        legacy_category_id: String(input.legacy_category_id || "").trim() || null,
        code, name_ar: nameAr, name_en: nameEn, node_type: nodeType,
        status, sort_order: Math.max(0, Math.min(100000, sortOrder)),
        metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {},
        updated_by: user.id, updated_at: new Date().toISOString(),
        ...(previous ? {} : { created_by: user.id, created_at: new Date().toISOString() }),
      };
      const { data: saved, error: saveError } = await service.from("business_activity_types")
        .upsert(next, { onConflict: "id" }).select("id,sector_id,parent_id,legacy_category_id,code,name_ar,name_en,node_type,status,sort_order,metadata,created_at,updated_at").single();
      if (saveError) throw saveError;
      const { error: auditError } = await service.from("audit_logs").insert({
        tenant_id: String(platformMemberships[0].tenant_id), actor_user_id: user.id,
        action: previous ? "ACTIVITY_TYPE_UPDATED" : "ACTIVITY_TYPE_CREATED",
        entity_type: "business_activity_type", entity_id: id,
        old_values: previous || null, new_values: saved, result: "SUCCESS",
      });
      if (auditError) {
        console.error("activity taxonomy audit write failed", auditError.message);
        return response(origin, { error: "ACTIVITY_TYPE_SAVED_AUDIT_FAILED", saved: false }, 500);
      }
      return response(origin, { success: true, activityType: saved });
    }

    if (action === "SET_ACTIVITY_TYPE_STATUS") {
      const id = String(body.id || "").trim();
      const status = String(body.status || "").trim().toUpperCase();
      const reason = String(body.reason || "").trim().slice(0, 500);
      if (!/^[a-zA-Z0-9_-]{2,100}$/.test(id) || !["ACTIVE", "INACTIVE", "ARCHIVED"].includes(status) || reason.length < 3) {
        return response(origin, { error: "INVALID_ACTIVITY_STATUS_CHANGE" }, 400);
      }
      const { data: previous, error: findError } = await service.from("business_activity_types").select("*").eq("id", id).maybeSingle();
      if (findError) throw findError;
      if (!previous) return response(origin, { error: "ACTIVITY_TYPE_NOT_FOUND" }, 404);
      const { data: children, error: childError } = await service.from("business_activity_types")
        .select("id").eq("parent_id", id).eq("status", "ACTIVE").limit(1);
      if (childError) throw childError;
      if (status !== "ACTIVE" && children?.length) return response(origin, { error: "ACTIVE_CHILDREN_MUST_BE_DISABLED_FIRST" }, 409);
      const { data: saved, error: updateError } = await service.from("business_activity_types")
        .update({ status, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", id)
        .select("id,sector_id,parent_id,code,name_ar,name_en,node_type,status,sort_order").single();
      if (updateError) throw updateError;
      const { error: auditError } = await service.from("audit_logs").insert({
        tenant_id: String(platformMemberships[0].tenant_id), actor_user_id: user.id,
        action: "ACTIVITY_TYPE_STATUS_CHANGED", entity_type: "business_activity_type", entity_id: id,
        old_values: previous, new_values: { ...saved, reason }, result: "SUCCESS",
      });
      if (auditError) {
        console.error("activity taxonomy status audit write failed", auditError.message);
        return response(origin, { error: "ACTIVITY_TYPE_STATUS_AUDIT_FAILED" }, 500);
      }
      return response(origin, { success: true, activityType: saved });
    }

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
      const { error } = await service.from("bizcatalog_platform_settings").upsert({ settings_key: "bizcatalog", settings: safe, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "settings_key" });
      if (error) throw error;
      return response(origin, { success: true, settings: safe });
    }

    if (action === "LIST_SUBSCRIBERS") {
      const { data: rows, error } = await service.from("user_memberships")
        .select("id,user_id,tenant_id,organization_id,business_id,role,status,created_at")
        .in("tenant_id", productionTenantIds).not("business_id", "is", null)
        .in("role", ["OWNER", "BUSINESS_OWNER"]).limit(500);
      if (error) throw error;
      const records = (rows || []).filter((m: any) => isUuid(String(m.business_id || "")));
      const businessIds = [...new Set(records.map((m: any) => String(m.business_id)))];
      const { data: businesses, error: businessError } = businessIds.length
        ? await service.from("businesses").select("id,tenant_id,name").in("id", businessIds)
        : { data: [], error: null };
      if (businessError) throw businessError;
      const businessMap = new Map((businesses || []).map((b: any) => [String(b.id), b]));
      const userIds = [...new Set(records.map((m: any) => String(m.user_id)))];
      const userResults = await Promise.all(userIds.map(async (id) => {
        const result = await service.auth.admin.getUserById(id);
        return [id, result.data?.user || null] as const;
      }));
      const userMap = new Map(userResults);
      return response(origin, { subscribers: records.map((m: any) => {
        const u: any = userMap.get(String(m.user_id));
        const b: any = businessMap.get(String(m.business_id));
        return {
          id: String(m.id), userId: String(m.user_id), fullName: String(u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email || "مشترك"),
          email: String(u?.email || ""), phone: String(u?.user_metadata?.phone || ""), businessId: String(m.business_id),
          businessName: String(b?.name || "نشاط غير متاح"), status: String(m.status).toUpperCase() === "ACTIVE" ? "active" : "suspended",
          username: String(u?.email || ""), authMethod: "direct_password", inviteStatus: "direct_created", joinedDate: String(m.created_at || "").slice(0, 10),
        };
      }) });
    }

    if (action === "CREATE_BUSINESS") {
      const input = body.business && typeof body.business === "object" ? body.business : {};
      const name = String(input.name || "").trim();
      if (name.length < 2 || name.length > 200) return response(origin, { error: "INVALID_BUSINESS_NAME" }, 400);
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
        const { data: created, error: createError } = await service.from("businesses").insert({
          tenant_id: tenantId, organization_id: organizationId, name,
          code: `MX-${randomCode}`, status: "ACTIVE",
          settings: { activity_code: String(input.category || "retail"), catalog_public_enabled: false,
            catalog_profile: { bio: String(input.bio || "").slice(0, 3000), governorate: String(input.governorate || "").slice(0, 100), markaz: String(input.markaz || "").slice(0, 100), village: String(input.village || "").slice(0, 100), working_hours: String(input.workingHours || "").slice(0, 300), logo_url: String(input.logoUrl || "").slice(0, 1500), cover_url: String(input.coverUrl || "").slice(0, 1500) },
            bizcatalog: { paymentStatus: "pending", isFrozen: false, commissionPerOrder: 0.01, totalOrdersCount: 0, paymentDueDay: 1, paymentDueDate: new Date().toISOString().slice(0, 10), paymentConfirmedByAdmin: false } },
        }).select("id,tenant_id,organization_id,name,code,status,settings").single();
        if (createError) throw createError;
        createdBusinessId = String(created.id);
        const branchId = `main-${crypto.randomUUID().slice(0, 8)}`;
        const { error: branchError } = await service.from("branches").insert({
          id: branchId, tenant_id: tenantId, organization_id: organizationId, business_id: created.id,
          name: `${name} - الفرع الرئيسي`, code: `MAIN-${randomCode}`, status: "ACTIVE",
          phone: String(input.phone || "").slice(0, 40) || null, address: String(input.address || "").slice(0, 500) || null,
          settings: { source: "bizcatalog-manager" },
        });
        if (branchError) throw branchError;
        const { error: providerError } = await service.from("marketing_provider_profiles").insert({
          provider_kind: String(input.category || "retail").slice(0, 80), business_id: created.id,
          owner_user_id: null, name_ar: name, name_en: null, slug: `${slug}-${randomCode.toLowerCase()}`,
          description: String(input.bio || "").slice(0, 3000) || null, specialties: [], service_areas: [], portfolio: [],
          status: "ACTIVE", is_verified: false, is_featured: false, ranking_weight: 0, settings: {},
        });
        if (providerError) throw providerError;
        return response(origin, { business: { id: created.id, tenantId, organizationId, branchId, name, slug: `${slug}-${randomCode.toLowerCase()}`, category: String(input.category || "retail"), status: "ACTIVE" } }, 201);
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
        if (createdAuthUser) await service.auth.admin.deleteUser(userId);
        throw new Error("SUBSCRIBER_MEMBERSHIP_LOOKUP_FAILED");
      }
      const existingMembership = existingMemberships?.[0];
      if (existingMembership) {
        if (String(existingMembership.status).toUpperCase() !== "ACTIVE") {
          const { error } = await service.from("user_memberships").update({ status: "ACTIVE" }).eq("id", existingMembership.id);
          if (error) throw new Error("SUBSCRIBER_MEMBERSHIP_REACTIVATION_FAILED");
        }
        return response(origin, { success: true, membershipId: existingMembership.id, userId, email, reusedAccount: true, existingMembership: true }, 200);
      }

      const membershipId = crypto.randomUUID();
      const { error: membershipInsertError } = await service.from("user_memberships").insert({
        id: membershipId, user_id: userId, tenant_id: tenantId, organization_id: business.organization_id || null,
        business_id: businessId, branch_id: null, role: "BUSINESS_OWNER", status: "ACTIVE", permissions: { catalog: true },
      });
      if (membershipInsertError) {
        if (createdAuthUser) await service.auth.admin.deleteUser(userId);
        throw new Error(membershipInsertError.message || "SUBSCRIBER_MEMBERSHIP_CREATE_FAILED");
      }
      await service.from("audit_logs").insert({
        actor_user_id: user.id, action: "BIZCATALOG_SUBSCRIBER_CREATED", entity_type: "user_membership",
        entity_id: membershipId, details: { tenantId, businessId, subscriberUserId: userId, reusedAuthIdentity: !createdAuthUser },
      }).then(() => {}).catch(() => {});
      return response(origin, { success: true, membershipId, userId, email, reusedAccount: !createdAuthUser }, 201);
    }

    if (action === "SUBSCRIBER_STATUS") {
      const membershipId = String(body.membershipId || "");
      const status = String(body.status || "").toUpperCase();
      if (!membershipId || !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) return response(origin, { error: "INVALID_SUBSCRIBER_STATUS" }, 400);
      const { data: membership, error: findError } = await service.from("user_memberships")
        .select("id,tenant_id,business_id,role").eq("id", membershipId).maybeSingle();
      if (findError) throw findError;
      if (!membership || !productionTenantIds.includes(String(membership.tenant_id)) || !["OWNER", "BUSINESS_OWNER"].includes(String(membership.role).toUpperCase())) throw new Error("SUBSCRIBER_NOT_FOUND");
      const { error } = await service.from("user_memberships").update({ status }).eq("id", membershipId);
      if (error) throw error;
      return response(origin, { success: true, membershipId, status });
    }

    if (action === "BUSINESS_SETTINGS_UPDATE") {
      const tenantId = requireTenant(body.tenantId);
      const businessId = String(body.businessId || "");
      const business = await getBusiness(tenantId, businessId);
      const incoming = body.settings && typeof body.settings === "object" ? body.settings : {};
      const allowed = ["commissionPerOrder", "totalOrdersCount", "paymentStatus", "overdueDaysCount", "isFrozen", "lastPaymentDate", "paymentConfirmedByAdmin", "paymentDueDay", "paymentDueDate"];
      const current = business.settings?.bizcatalog && typeof business.settings.bizcatalog === "object" ? business.settings.bizcatalog : {};
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (Object.prototype.hasOwnProperty.call(incoming, k)) patch[k] = incoming[k];
      const nextSettings = { ...(business.settings || {}), bizcatalog: { ...current, ...patch } };
      const { error } = await service.from("businesses").update({ settings: nextSettings, updated_at: new Date().toISOString() }).eq("id", businessId).eq("tenant_id", tenantId);
      if (error) throw error;
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

    return response(origin, { error: "UNSUPPORTED_ACTION" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "CATALOG_PLATFORM_OPERATION_FAILED";
    console.error("catalog-platform-admin failed", message);
    const known = ["TENANT_SCOPE_FORBIDDEN", "BUSINESS_NOT_FOUND", "INVALID_BUSINESS_ID", "TENANT_NOT_ACTIVE", "BUSINESS_NOT_ACTIVE", "SUBSCRIBER_NOT_FOUND", "PRODUCTION_TENANT_REQUIRED"];
    return response(origin, { error: known.includes(message) ? message : "CATALOG_PLATFORM_OPERATION_FAILED" }, known.includes(message) ? 403 : 400);
  }
});
