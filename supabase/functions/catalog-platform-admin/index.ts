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
        activeOwners, customers, activeGroups, activeActivities, businessRows, ownerRows, recentAudit] = await Promise.all([
        countQuery(service.from("businesses").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds)),
        countQuery(service.from("businesses").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds).eq("status", "ACTIVE")),
        countQuery(service.from("businesses").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds).eq("status", "INACTIVE")),
        countQuery(service.from("businesses").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds).eq("status", "SUSPENDED")),
        countQuery(service.from("user_memberships").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds).in("role", ["OWNER", "BUSINESS_OWNER"]).eq("status", "ACTIVE")),
        countQuery(service.from("user_memberships").select("id", { count: "exact", head: true }).in("tenant_id", productionTenantIds).eq("role", "CUSTOMER").eq("status", "ACTIVE")),
        countQuery(service.from("business_activity_types").select("id", { count: "exact", head: true }).eq("node_type", "SECTOR_GROUP").eq("status", "ACTIVE")),
        countQuery(service.from("business_activity_types").select("id", { count: "exact", head: true }).neq("node_type", "SECTOR_GROUP").eq("status", "ACTIVE")),
        service.from("businesses").select("id").in("tenant_id", productionTenantIds).limit(10000),
        service.from("user_memberships").select("business_id").in("tenant_id", productionTenantIds).in("role", ["OWNER", "BUSINESS_OWNER"]).eq("status", "ACTIVE").not("business_id", "is", null).limit(10000),
        service.from("audit_logs").select("action,entity_type,entity_id,result,created_at").eq("tenant_id", String(platformMemberships[0].tenant_id)).order("created_at", { ascending: false }).limit(8),
      ]);
      if ((businessRows as any).error) throw (businessRows as any).error;
      if ((ownerRows as any).error) throw (ownerRows as any).error;
      if ((recentAudit as any).error) throw (recentAudit as any).error;
      const businessesData = (businessRows as any).data || [];
      const ownedIds = new Set(((ownerRows as any).data || []).map((m: any) => String(m.business_id)));
      const unassignedBusinesses = businessesData.length < 10000
        ? businessesData.filter((b: any) => !ownedIds.has(String(b.id))).length
        : null;
      const businessIds = businessesData.map((b: any) => String(b.id));
      let subscriptionMetrics: any = { activeSubscriptions: null, pastDueSubscriptions: null, cancelledSubscriptions: null, status: "NOT_WIRED" };
      if (businessIds.length > 0 && businessIds.length < 500) {
        const [activeSubscriptions, pastDueSubscriptions, cancelledSubscriptions] = await Promise.all([
          countQuery(service.from("business_subscriptions").select("id", { count: "exact", head: true }).in("business_id", businessIds).eq("status", "ACTIVE")),
          countQuery(service.from("business_subscriptions").select("id", { count: "exact", head: true }).in("business_id", businessIds).in("status", ["PAST_DUE", "PAST-DUE", "UNPAID"])),
          countQuery(service.from("business_subscriptions").select("id", { count: "exact", head: true }).in("business_id", businessIds).in("status", ["CANCELLED", "CANCELED"])),
        ]);
        subscriptionMetrics = { activeSubscriptions, pastDueSubscriptions, cancelledSubscriptions, status: "LIVE" };
      }
      return response(origin, {
        metrics: {
          businesses, activeBusinesses, inactiveBusinesses, suspendedBusinesses, activeOwners,
          unassignedBusinesses, customers, ...subscriptionMetrics,
          activeActivityGroups: activeGroups, activeActivities,
          visits: null, visitsStatus: "NOT_WIRED",
          commissionAccrued: null, commissionCollected: null, commissionOutstanding: null,
          claimsDue: null, claimsStatus: "NOT_WIRED",
        },
        recentAudit: (recentAudit as any).data || [],
        metricDefinitions: {
          businesses: "عدد سجلات businesses ضمن نطاقات الإنتاج المصرح بها",
          customers: "عضويات CUSTOMER النشطة وليست بالضرورة أشخاصًا فريدين",
          activeOwners: "عضويات مالك النشاط النشطة؛ عدد العضويات وليس عدد الأشخاص الفريدين",
          unassignedBusinesses: "فرق بين الأنشطة المحملة والأنشطة التي لها عضوية مالك نشطة؛ null إذا تجاوز الاستعلام حد القراءة",
          visits: "مصدر الزيارات الموحد غير موصول؛ لا يتم اختلاق أرقام",
          commissions: "إجماليات العمولة لا تُعرض قبل ربط حالات دفتر الأستاذ والتسويات المعتمدة",
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
      if (nodeType === "SECTOR_GROUP" && parentId) return response(origin, { error: "GROUP_CANNOT_HAVE_PARENT" }, 400);
      if (parentId) {
        if (parentId === id) return response(origin, { error: "INVALID_ACTIVITY_PARENT" }, 400);
        const { data: parent, error: parentError } = await service.from("business_activity_types")
          .select("id,sector_id,node_type,status").eq("id", parentId).maybeSingle();
        if (parentError) throw parentError;
        const expectedParentType = nodeType === "ACTIVITY" ? "SECTOR_GROUP" : "ACTIVITY";
        if (!parent || String(parent.sector_id) !== sectorId || parent.node_type !== expectedParentType
          || (status === "ACTIVE" && parent.status !== "ACTIVE")) {
          return response(origin, { error: "INVALID_ACTIVITY_PARENT" }, 400);
        }
      } else if (nodeType !== "SECTOR_GROUP") {
        return response(origin, { error: "ACTIVITY_PARENT_REQUIRED" }, 400);
      }
      const { data: previous, error: previousError } = await service.from("business_activity_types")
        .select("*").eq("id", id).maybeSingle();
      if (previousError) throw previousError;
      if (previous) {
        const { data: existingChildren, error: existingChildrenError } = await service.from("business_activity_types")
          .select("id").eq("parent_id", id).limit(1);
        if (existingChildrenError) throw existingChildrenError;
        if (existingChildren?.length && (String(previous.sector_id) !== sectorId || String(previous.node_type) !== nodeType)) {
          return response(origin, { error: "PARENT_WITH_CHILDREN_STRUCTURE_IMMUTABLE" }, 409);
        }
      }
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
        const rollback = previous
          ? await service.from("business_activity_types").upsert(previous, { onConflict: "id" })
          : await service.from("business_activity_types").delete().eq("id", id);
        if (rollback.error) console.error("activity taxonomy compensating rollback failed", rollback.error.message);
        return response(origin, { error: rollback.error ? "ACTIVITY_TYPE_AUDIT_AND_ROLLBACK_FAILED" : "ACTIVITY_TYPE_AUDIT_FAILED_ROLLED_BACK" }, 500);
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
      const { data: allRows, error: childError } = await service.from("business_activity_types")
        .select("id,parent_id,status").eq("sector_id", previous.sector_id).limit(5000);
      if (childError) throw childError;
      const descendants = new Set([id]);
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const item of (allRows || [])) {
          if (item.parent_id && descendants.has(String(item.parent_id)) && !descendants.has(String(item.id))) {
            descendants.add(String(item.id)); expanded = true;
          }
        }
      }
      const activeDescendants = (allRows || []).some((item: any) => String(item.id) !== id
        && descendants.has(String(item.id)) && String(item.status).toUpperCase() === "ACTIVE");
      if (status !== "ACTIVE" && activeDescendants) return response(origin, { error: "ACTIVE_CHILDREN_MUST_BE_DISABLED_FIRST" }, 409);
      if (status === "ACTIVE" && previous.parent_id) {
        const { data: parent, error: parentError } = await service.from("business_activity_types")
          .select("status").eq("id", previous.parent_id).maybeSingle();
        if (parentError) throw parentError;
        if (!parent || String(parent.status).toUpperCase() !== "ACTIVE") return response(origin, { error: "ACTIVE_PARENT_REQUIRED" }, 409);
      }
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
        const rollback = await service.from("business_activity_types")
          .update({ status: previous.status, updated_by: previous.updated_by, updated_at: previous.updated_at }).eq("id", id);
        if (rollback.error) console.error("activity taxonomy status rollback failed", rollback.error.message);
        return response(origin, { error: rollback.error ? "ACTIVITY_TYPE_STATUS_AUDIT_AND_ROLLBACK_FAILED" : "ACTIVITY_TYPE_STATUS_AUDIT_FAILED_ROLLED_BACK" }, 500);
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

    if (action === "LIST_BUSINESSES") {
      const rawLimit = Number(body.limit || 25);
      const limit = Math.max(1, Math.min(50, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 25));
      const rawOffset = Number(body.offset || 0);
      const offset = Math.max(0, Math.min(100000, Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0));
      const search = String(body.search || "").trim().replace(/[%_]/g, "").slice(0, 100);
      const requestedStatus = String(body.status || "").trim().toUpperCase();
      if (requestedStatus && !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(requestedStatus)) {
        return response(origin, { error: "INVALID_BUSINESS_STATUS_FILTER" }, 400);
      }
      const requestedTenant = body.tenantId ? requireTenant(body.tenantId) : null;
      let query = service.from("businesses")
        .select("id,tenant_id,organization_id,name,code,status,settings,created_at,updated_at", { count: "exact" })
        .in("tenant_id", requestedTenant ? [requestedTenant] : productionTenantIds)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (requestedStatus) query = query.eq("status", requestedStatus);
      if (search) query = query.ilike("name", "%" + search + "%");
      const { data: rows, count, error } = await query;
      if (error) throw error;
      const businesses = rows || [];
      const ids = businesses.map((b: any) => String(b.id));
      if (!ids.length) return response(origin, { businesses: [], total: Number(count || 0), limit, offset });
      const [{ data: membershipsForPage, error: ownersError }, { data: subsForPage, error: subsError }] = await Promise.all([
        service.from("user_memberships").select("id,user_id,tenant_id,organization_id,business_id,role,status,created_at")
          .in("business_id", ids).in("role", ["OWNER", "BUSINESS_OWNER"]).order("created_at", { ascending: true }).limit(500),
        service.from("business_subscriptions").select("id,business_id,tier_code,billing_cycle,status,sector,starts_at,ends_at,provider,provider_reference,created_at,updated_at")
          .in("business_id", ids).order("created_at", { ascending: false }).limit(500),
      ]);
      if (ownersError) throw ownersError;
      if (subsError) throw subsError;
      const ownerRows = membershipsForPage || [];
      const ownerUserIds = [...new Set(ownerRows.map((m: any) => String(m.user_id)))];
      const userRows = await Promise.all(ownerUserIds.map(async id => {
        const result = await service.auth.admin.getUserById(id);
        return [id, result.data?.user || null] as const;
      }));
      const userMap = new Map(userRows);
      const ownerMap = new Map<string, any[]>();
      for (const m of ownerRows) {
        const key = String((m as any).business_id);
        const authUser: any = userMap.get(String((m as any).user_id));
        if (!ownerMap.has(key)) ownerMap.set(key, []);
        ownerMap.get(key)!.push({
          membershipId: (m as any).id, userId: (m as any).user_id, role: (m as any).role,
          status: (m as any).status, email: String(authUser?.email || ""),
          name: String(authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || ""),
          emailVerified: Boolean(authUser?.email_confirmed_at && !authUser?.is_anonymous),
        });
      }
      const subscriptionMap = new Map<string, any>();
      for (const sub of (subsForPage || [])) {
        const key = String((sub as any).business_id);
        if (!subscriptionMap.has(key)) subscriptionMap.set(key, sub);
      }
      return response(origin, {
        businesses: businesses.map((b: any) => ({
          id: b.id, tenantId: b.tenant_id, organizationId: b.organization_id,
          name: b.name, code: b.code, status: b.status,
          settings: b.settings || {}, createdAt: b.created_at, updatedAt: b.updated_at,
          owners: ownerMap.get(String(b.id)) || [],
          subscription: subscriptionMap.get(String(b.id)) || null,
        })),
        total: Number(count || 0), limit, offset,
      });
    }

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

    if (action === "ASSIGN_BUSINESS_OWNER") {
      const tenantId = requireTenant(body.tenantId);
      const businessId = String(body.businessId || "");
      const email = String(body.ownerEmail || "").trim().toLowerCase();
      const reason = String(body.reason || "").trim().slice(0, 500);
      if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return response(origin, { error: "VALID_OWNER_EMAIL_REQUIRED" }, 400);
      }
      if (reason.length < 3) return response(origin, { error: "OWNER_ASSIGNMENT_REASON_REQUIRED" }, 400);
      const business = await getBusiness(tenantId, businessId);
      if (business.settings?.deleted_at) return response(origin, { error: "BUSINESS_ARCHIVED" }, 409);

      let authUser: any = null;
      for (let page = 1; page <= 50; page += 1) {
        const { data: pageData, error: usersError } = await service.auth.admin.listUsers({ page, perPage: 1000 });
        if (usersError) throw new Error("OWNER_AUTH_LOOKUP_FAILED");
        const users = pageData?.users || [];
        authUser = users.find((candidate: any) => String(candidate.email || "").trim().toLowerCase() === email) || null;
        if (authUser || users.length < 1000) break;
      }
      if (!authUser) return response(origin, { error: "OWNER_ACCOUNT_NOT_FOUND", message: "اطلب من صاحب النشاط إنشاء حساب Google أولًا، ثم أعد تعيين المالك." }, 404);
      if (authUser.is_anonymous || !authUser.email_confirmed_at) {
        return response(origin, { error: "OWNER_GOOGLE_EMAIL_NOT_VERIFIED" }, 409);
      }
      const { data: existingRows, error: existingError } = await service.from("user_memberships")
        .select("id,user_id,tenant_id,organization_id,business_id,branch_id,role,status,permissions,created_at")
        .eq("user_id", authUser.id).eq("tenant_id", tenantId).eq("business_id", businessId).limit(5);
      if (existingError) throw existingError;
      const existing = (existingRows || []).find((m: any) => ["OWNER", "BUSINESS_OWNER"].includes(String(m.role).toUpperCase()));
      const conflicting = (existingRows || []).find((m: any) => !["OWNER", "BUSINESS_OWNER"].includes(String(m.role).toUpperCase()));
      if (!existing && conflicting) return response(origin, { error: "OWNER_MEMBERSHIP_CONFLICT" }, 409);

      const before = existing || null;
      let membershipId = String(existing?.id || crypto.randomUUID());
      if (existing) {
        const { error: updateError } = await service.from("user_memberships").update({
          role: "BUSINESS_OWNER", status: "ACTIVE",
          organization_id: business.organization_id || null,
          permissions: { ...(existing.permissions && typeof existing.permissions === "object" ? existing.permissions : {}), catalog: true },
        }).eq("id", membershipId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await service.from("user_memberships").insert({
          id: membershipId, user_id: authUser.id, tenant_id: tenantId,
          organization_id: business.organization_id || null, business_id: businessId,
          branch_id: null, role: "BUSINESS_OWNER", status: "ACTIVE", permissions: { catalog: true },
        });
        if (insertError) throw insertError;
      }
      const { error: auditError } = await service.from("audit_logs").insert({
        id: crypto.randomUUID(), tenant_id: tenantId, organization_id: business.organization_id || null,
        actor_user_id: user.id, action: "BUSINESS_OWNER_ASSIGNED", entity_type: "user_membership", entity_id: membershipId,
        old_values: before, new_values: {
          membership_id: membershipId, user_id: authUser.id, owner_email: email,
          business_id: businessId, role: "BUSINESS_OWNER", status: "ACTIVE", reason,
        }, result: "SUCCESS",
      });
      if (auditError) {
        const rollback = before
          ? await service.from("user_memberships").update({ role: before.role, status: before.status, organization_id: before.organization_id, permissions: before.permissions }).eq("id", membershipId)
          : await service.from("user_memberships").delete().eq("id", membershipId);
        if (rollback.error) console.error("owner assignment compensation failed", rollback.error.message);
        return response(origin, { error: rollback.error ? "OWNER_ASSIGNMENT_AUDIT_ROLLBACK_FAILED" : "OWNER_ASSIGNMENT_AUDIT_FAILED_ROLLED_BACK" }, 500);
      }
      return response(origin, {
        success: true, membershipId, businessId, ownerUserId: authUser.id, ownerEmail: email,
        reusedMembership: Boolean(existing), note: "لا يتم إنشاء كلمة مرور؛ يسجل المالك دخوله بحساب Google نفسه.",
      });
    }

    if (action === "SET_BUSINESS_STATUS") {
      const tenantId = requireTenant(body.tenantId);
      const businessId = String(body.businessId || "");
      const status = String(body.status || "").trim().toUpperCase();
      const reason = String(body.reason || "").trim().slice(0, 500);
      if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) return response(origin, { error: "INVALID_BUSINESS_STATUS" }, 400);
      if (reason.length < 3) return response(origin, { error: "BUSINESS_STATUS_REASON_REQUIRED" }, 400);
      const business = await getBusiness(tenantId, businessId);
      if (business.settings?.deleted_at && status === "ACTIVE") return response(origin, { error: "BUSINESS_ARCHIVED_REQUIRES_RESTORE" }, 409);
      const oldSettings = business.settings || {};
      const nextSettings = { ...oldSettings };
      if (status !== "ACTIVE") nextSettings.catalog_public_enabled = false;
      const { data: updated, error: updateError } = await service.from("businesses")
        .update({ status, settings: nextSettings, updated_at: new Date().toISOString() })
        .eq("id", businessId).eq("tenant_id", tenantId)
        .select("id,tenant_id,organization_id,name,code,status,settings,updated_at").single();
      if (updateError) throw updateError;
      const { error: auditError } = await service.from("audit_logs").insert({
        id: crypto.randomUUID(), tenant_id: tenantId, organization_id: business.organization_id || null,
        actor_user_id: user.id, action: "BUSINESS_STATUS_CHANGED", entity_type: "business", entity_id: businessId,
        old_values: { status: business.status, settings: oldSettings },
        new_values: { status: updated.status, settings: updated.settings, reason }, result: "SUCCESS",
      });
      if (auditError) {
        const rollback = await service.from("businesses").update({ status: business.status, settings: oldSettings, updated_at: business.updated_at })
          .eq("id", businessId).eq("tenant_id", tenantId);
        if (rollback.error) console.error("business status compensation failed", rollback.error.message);
        return response(origin, { error: rollback.error ? "BUSINESS_STATUS_AUDIT_ROLLBACK_FAILED" : "BUSINESS_STATUS_AUDIT_FAILED_ROLLED_BACK" }, 500);
      }
      return response(origin, { success: true, business: updated });
    }

    if (action === "SOFT_DELETE_BUSINESS") {
      const tenantId = requireTenant(body.tenantId);
      const businessId = String(body.businessId || "");
      const reason = String(body.reason || "").trim().slice(0, 500);
      if (reason.length < 3) return response(origin, { error: "BUSINESS_DELETE_REASON_REQUIRED" }, 400);
      const business = await getBusiness(tenantId, businessId);
      if (business.settings?.deleted_at) return response(origin, { success: true, businessId, status: "INACTIVE", alreadyArchived: true });
      const oldSettings = business.settings || {};
      const now = new Date().toISOString();
      const nextSettings = { ...oldSettings, catalog_public_enabled: false, deleted_at: now, deleted_by: user.id, delete_reason: reason };
      const { data: updated, error: updateError } = await service.from("businesses")
        .update({ status: "INACTIVE", settings: nextSettings, updated_at: now })
        .eq("id", businessId).eq("tenant_id", tenantId).select("id,tenant_id,organization_id,name,code,status,settings,updated_at").single();
      if (updateError) throw updateError;
      const { error: auditError } = await service.from("audit_logs").insert({
        id: crypto.randomUUID(), tenant_id: tenantId, organization_id: business.organization_id || null,
        actor_user_id: user.id, action: "BUSINESS_SOFT_DELETED", entity_type: "business", entity_id: businessId,
        old_values: { status: business.status, settings: oldSettings },
        new_values: { status: updated.status, deleted_at: now, reason }, result: "SUCCESS",
      });
      if (auditError) {
        const rollback = await service.from("businesses").update({ status: business.status, settings: oldSettings, updated_at: business.updated_at })
          .eq("id", businessId).eq("tenant_id", tenantId);
        if (rollback.error) console.error("business delete compensation failed", rollback.error.message);
        return response(origin, { error: rollback.error ? "BUSINESS_DELETE_AUDIT_ROLLBACK_FAILED" : "BUSINESS_DELETE_AUDIT_FAILED_ROLLED_BACK" }, 500);
      }
      return response(origin, { success: true, business: updated, mode: "SOFT_DELETE" });
    }

    if (action === "RESTORE_BUSINESS") {
      const tenantId = requireTenant(body.tenantId);
      const businessId = String(body.businessId || "");
      const reason = String(body.reason || "").trim().slice(0, 500);
      if (reason.length < 3) return response(origin, { error: "BUSINESS_RESTORE_REASON_REQUIRED" }, 400);
      const business = await getBusiness(tenantId, businessId);
      if (!business.settings?.deleted_at) return response(origin, { success: true, businessId, status: business.status, alreadyRestored: true });
      const oldSettings = business.settings || {};
      const nextSettings = { ...oldSettings, catalog_public_enabled: false };
      delete (nextSettings as any).deleted_at; delete (nextSettings as any).deleted_by; delete (nextSettings as any).delete_reason;
      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await service.from("businesses")
        .update({ status: "ACTIVE", settings: nextSettings, updated_at: now })
        .eq("id", businessId).eq("tenant_id", tenantId).select("id,tenant_id,organization_id,name,code,status,settings,updated_at").single();
      if (updateError) throw updateError;
      const { error: auditError } = await service.from("audit_logs").insert({
        id: crypto.randomUUID(), tenant_id: tenantId, organization_id: business.organization_id || null,
        actor_user_id: user.id, action: "BUSINESS_RESTORED", entity_type: "business", entity_id: businessId,
        old_values: { status: business.status, settings: oldSettings },
        new_values: { status: updated.status, reason }, result: "SUCCESS",
      });
      if (auditError) {
        const rollback = await service.from("businesses").update({ status: business.status, settings: oldSettings, updated_at: business.updated_at })
          .eq("id", businessId).eq("tenant_id", tenantId);
        if (rollback.error) console.error("business restore compensation failed", rollback.error.message);
        return response(origin, { error: rollback.error ? "BUSINESS_RESTORE_AUDIT_ROLLBACK_FAILED" : "BUSINESS_RESTORE_AUDIT_FAILED_ROLLED_BACK" }, 500);
      }
      return response(origin, { success: true, business: updated, catalogPublicEnabled: false });
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
