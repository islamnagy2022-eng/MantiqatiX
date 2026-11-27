import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8080",
]);

const headersFor = (origin: string | null, requestId?: string) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin)
    ? origin
    : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
  ...(requestId ? { "X-Request-Id": requestId } : {}),
});

const respond = (origin: string | null, body: unknown, status = 200, requestId?: string) =>
  new Response(JSON.stringify(body), { status, headers: headersFor(origin, requestId) });

const isPlatformAdmin = (membership: any) =>
  String(membership.role || "").toUpperCase() === "SUPER_ADMIN"
  && !membership.business_id
  && !membership.branch_id
  && membership.permissions?.scope === "PLATFORM"
  && membership.permissions?.full_control === true;

const isProductionTenant = (tenant: any) => {
  const id = String(tenant.id || "").toUpperCase();
  const code = String(tenant.code || "").toUpperCase();
  const name = String(tenant.name || "").toLowerCase();
  const purpose = String(tenant.settings?.purpose || "").toLowerCase();
  const testIdentity = /(^|[-_])TEST([-_]|$)|ISOLATION/.test(id)
    || /(^|[-_])TEST([-_]|$)|ISOLATION/.test(code);
  return !testIdentity
    && !purpose.includes("test")
    && !purpose.includes("isolation")
    && !name.includes("isolation test")
    && !name.includes("اختبار العزل");
};

const groupCount = (rows: any[], field: string) => rows.reduce((counts, row) => {
  const key = String(row?.[field] || "UNKNOWN").toUpperCase();
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {} as Record<string, number>);

const throwOnError = (stage: string, error: any) => {
  if (!error) return;
  console.error(JSON.stringify({ stage, code: error.code || "UNKNOWN" }));
  throw new Error(stage);
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();

  if (origin && !allowedOrigins.has(origin)) {
    return respond(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403, requestId);
  }
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: headersFor(origin, requestId) });
  }
  if (req.method !== "POST") {
    return respond(origin, { error: "METHOD_NOT_ALLOWED" }, 405, requestId);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return respond(origin, { error: "AUTH_REQUIRED" }, 401, requestId);
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceRole) {
    return respond(origin, { error: "SERVER_MISCONFIGURED" }, 500, requestId);
  }

  const service = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const token = authorization.slice(7).trim();
    const { data: { user }, error: authError } = await service.auth.getUser(token);
    if (authError || !user || user.is_anonymous) {
      return respond(origin, { error: "AUTH_REQUIRED" }, 401, requestId);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return respond(origin, { error: "INVALID_JSON" }, 400, requestId);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return respond(origin, { error: "INVALID_BODY" }, 400, requestId);
    }
    if (String(body.action || "").toUpperCase() !== "OVERVIEW") {
      return respond(origin, { error: "INVALID_ACTION" }, 400, requestId);
    }

    const { data: membershipRows, error: membershipError } = await service
      .from("user_memberships")
      .select("id,user_id,tenant_id,business_id,branch_id,role,status,permissions")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .limit(250);
    throwOnError("PLATFORM_MEMBERSHIP_READ_FAILED", membershipError);

    const platformMemberships = (membershipRows || []).filter(isPlatformAdmin);
    if (!platformMemberships.length) {
      return respond(origin, { error: "PLATFORM_ADMIN_REQUIRED" }, 403, requestId);
    }

    const tenantIds = [...new Set(
      platformMemberships.map((membership: any) => String(membership.tenant_id || "")).filter(Boolean),
    )];
    if (!tenantIds.length) {
      return respond(origin, { error: "PLATFORM_TENANT_REQUIRED" }, 409, requestId);
    }

    const { data: tenantRows, error: tenantError } = await service
      .from("tenants")
      .select("id,name,code,status,settings")
      .in("id", tenantIds)
      .eq("status", "ACTIVE")
      .limit(100);
    throwOnError("PLATFORM_TENANT_READ_FAILED", tenantError);

    const productionTenants = (tenantRows || []).filter(isProductionTenant);
    const productionTenantIds = productionTenants.map((tenant: any) => String(tenant.id));
    if (!productionTenantIds.length) {
      return respond(origin, { error: "PRODUCTION_TENANT_REQUIRED" }, 409, requestId);
    }

    const { data: businessRows, error: businessError } = await service
      .from("businesses")
      .select("id,tenant_id,name,code,status")
      .in("tenant_id", productionTenantIds)
      .order("created_at", { ascending: false })
      .limit(1500);
    throwOnError("PLATFORM_BUSINESS_READ_FAILED", businessError);

    const businesses = businessRows || [];
    const businessIds = businesses.map((business: any) => String(business.id));
    const businessMap = new Map(businesses.map((business: any) => [String(business.id), business]));

    const [subscriptionResult, intentResult, commissionResult, obligationResult, settlementResult] =
      businessIds.length
        ? await Promise.all([
            service.from("business_subscriptions")
              .select("id,business_id,tier_code,billing_cycle,status,starts_at,ends_at,created_at,updated_at")
              .in("business_id", businessIds)
              .order("created_at", { ascending: false })
              .limit(2000),
            service.from("subscription_payment_intents")
              .select("id,business_id,tier_code,billing_cycle,status,provider,expires_at,created_at")
              .in("business_id", businessIds)
              .order("created_at", { ascending: false })
              .limit(2000),
            service.from("commission_transactions")
              .select("id,tenant_id,status,created_at")
              .in("tenant_id", productionTenantIds)
              .limit(5000),
            service.from("financial_obligations")
              .select("id,tenant_id,obligation_type,status")
              .in("tenant_id", productionTenantIds)
              .limit(5000),
            service.from("settlement_transactions")
              .select("id,tenant_id,status,beneficiary_type")
              .in("tenant_id", productionTenantIds)
              .limit(5000),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ];

    throwOnError("PLATFORM_SUBSCRIPTIONS_READ_FAILED", subscriptionResult.error);
    throwOnError("PLATFORM_PAYMENT_INTENTS_READ_FAILED", intentResult.error);
    throwOnError("PLATFORM_COMMISSIONS_READ_FAILED", commissionResult.error);
    throwOnError("PLATFORM_OBLIGATIONS_READ_FAILED", obligationResult.error);
    throwOnError("PLATFORM_SETTLEMENTS_READ_FAILED", settlementResult.error);

    const subscriptions = subscriptionResult.data || [];
    const paymentIntents = intentResult.data || [];
    const commissions = commissionResult.data || [];
    const obligations = obligationResult.data || [];
    const settlements = settlementResult.data || [];

    const subscriptionRows = subscriptions.slice(0, 250).map((subscription: any) => {
      const business = businessMap.get(String(subscription.business_id));
      return {
        businessName: String(business?.name || "نشاط غير متاح"),
        businessStatus: String(business?.status || "UNKNOWN"),
        tierCode: String(subscription.tier_code || "—"),
        billingCycle: String(subscription.billing_cycle || "—"),
        status: String(subscription.status || "UNKNOWN"),
        startsAt: subscription.starts_at || null,
        endsAt: subscription.ends_at || null,
      };
    });

    const summary = {
      businessCount: businesses.length,
      activeSubscriptionCount: subscriptions.filter((row: any) => String(row.status).toUpperCase() === "ACTIVE").length,
      trialingSubscriptionCount: subscriptions.filter((row: any) => String(row.status).toUpperCase() === "TRIALING").length,
      subscriptionCount: subscriptions.length,
      pendingPaymentIntentCount: paymentIntents.filter((row: any) => ["CREATED", "PENDING"].includes(String(row.status).toUpperCase())).length,
      commissionTransactionCount: commissions.length,
      commissionByStatus: groupCount(commissions, "status"),
      obligationCount: obligations.length,
      obligationByType: groupCount(obligations, "obligation_type"),
      settlementCount: settlements.length,
      pendingSettlementCount: settlements.filter((row: any) => String(row.status).toUpperCase() === "PENDING").length,
      settlementByStatus: groupCount(settlements, "status"),
    };

    const auditRows = productionTenantIds.map((tenantId) => ({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: "PLATFORM_COMMERCIAL_OVERVIEW_READ",
      entity_type: "platform_commercial_overview",
      entity_id: tenantId,
      old_values: {},
      new_values: {
        source: "platform-commercial-overview",
        businessCount: summary.businessCount,
        subscriptionCount: summary.subscriptionCount,
        commissionTransactionCount: summary.commissionTransactionCount,
        settlementCount: summary.settlementCount,
      },
      result: "SUCCESS",
    }));
    const { error: auditError } = await service.from("audit_logs").insert(auditRows);
    throwOnError("PLATFORM_COMMERCIAL_AUDIT_FAILED", auditError);

    return respond(origin, {
      summary,
      subscriptions: subscriptionRows,
      generatedAt: new Date().toISOString(),
      truncated: {
        businesses: businesses.length === 1500,
        subscriptions: subscriptions.length === 2000,
        paymentIntents: paymentIntents.length === 2000,
        commissions: commissions.length === 5000,
        obligations: obligations.length === 5000,
        settlements: settlements.length === 5000,
        subscriptionDirectory: subscriptions.length > 250,
      },
      disclosure: "ملخص إداري للقراءة فقط؛ لا يعرض مبالغ أو مراجع معاملات أو بيانات دفع حساسة.",
    }, 200, requestId);
  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      stage: error instanceof Error ? error.message : "PLATFORM_COMMERCIAL_OVERVIEW_FAILED",
    }));
    return respond(origin, { error: "PLATFORM_COMMERCIAL_OVERVIEW_FAILED", requestId }, 500, requestId);
  }
});
