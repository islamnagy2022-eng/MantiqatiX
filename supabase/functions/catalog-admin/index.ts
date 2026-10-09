import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const CATALOG_ACTIONS: Record<string, string[]> = {
  OWNER: ["create", "update"],
  BUSINESS_OWNER: ["create", "update"],
  ADMIN: ["create", "update"],
  MANAGER: ["update"],
  SERVICE_PROVIDER: ["update"],
  PROVIDER_OWNER: ["create", "update"],
  PROVIDER_ADMIN: ["create", "update"],
  BRANCH_MANAGER: ["update"],
};
const BRANCH_SCOPED_ROLES = new Set(["MANAGER", "BRANCH_MANAGER"]);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && origin !== allowedOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);
  const token = auth.slice("Bearer ".length).trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!projectUrl || !serviceKey) return json({ error: "SERVER_MISCONFIGURED" }, 500);

  // The service-role client is used only after the bearer token is verified and
  // the requested catalog action is authorized against the user's active membership.
  const admin = createClient(projectUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user || user.is_anonymous) return json({ error: "AUTH_REQUIRED" }, 401);

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "INVALID_JSON" }, 400);
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    const action = String(body.action ?? "").toUpperCase();
    const tenantId = String(body.tenantId ?? "").trim();
    const businessId = String(body.businessId ?? "").trim();
    const branchId = body.branchId == null || body.branchId === "" ? null : String(body.branchId).trim();
    if (!tenantId || !businessId) return json({ error: "TENANT_BUSINESS_REQUIRED" }, 400);
    if (!["ITEM_UPSERT", "PRICE_UPSERT", "SETTINGS_UPSERT"].includes(action)) {
      return json({ error: "UNSUPPORTED_ACTION" }, 400);
    }

    const catalogPermission = action === "ITEM_UPSERT"
      ? (body.id ? "update" : "create")
      : "update";

    const { data: memberships, error: membershipError } = await admin
      .from("user_memberships")
      .select("tenant_id,business_id,branch_id,role,permissions,status")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE");
    if (membershipError) return json({ error: "MEMBERSHIP_CHECK_FAILED" }, 500);

    const allowed = (memberships ?? []).some((membership: any) => {
      const role = String(membership.role ?? "").toUpperCase();
      const permissions = membership.permissions && typeof membership.permissions === "object"
        ? membership.permissions
        : {};
      if (role === "SUPER_ADMIN") {
        return permissions.scope === "PLATFORM" && permissions.full_control === true;
      }
      if (!(CATALOG_ACTIONS[role] ?? []).includes(catalogPermission)) return false;

      const membershipBusinessId = membership.business_id == null ? null : String(membership.business_id);
      if (role === "OWNER") {
        if (membershipBusinessId && membershipBusinessId !== businessId) return false;
      } else if (membershipBusinessId !== businessId) {
        return false;
      }

      const membershipBranchId = membership.branch_id == null ? null : String(membership.branch_id);
      if (BRANCH_SCOPED_ROLES.has(role)) {
        return Boolean(branchId && membershipBranchId && membershipBranchId === branchId);
      }
      return !branchId || !membershipBranchId || membershipBranchId === branchId;
    });
    if (!allowed) return json({ error: "CATALOG_SCOPE_FORBIDDEN" }, 403);

    if (branchId) {
      const { data: branch, error: branchError } = await admin
        .from("branches")
        .select("id")
        .eq("id", branchId)
        .eq("tenant_id", tenantId)
        .eq("business_id", businessId)
        .eq("status", "ACTIVE")
        .maybeSingle();
      if (branchError || !branch) return json({ error: "BRANCH_NOT_AVAILABLE" }, 403);
    }

    if (action === "ITEM_UPSERT") {
      const nameAr = String(body.nameAr ?? "").trim();
      const taxRate = Number(body.taxRate ?? 0);
      if (!nameAr || nameAr.length > 300) return json({ error: "INVALID_ITEM_NAME" }, 400);
      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return json({ error: "INVALID_TAX_RATE" }, 400);
      const { data, error } = await admin.rpc("upsert_catalog_item_backend", {
        p_tenant_id: tenantId,
        p_business_id: businessId,
        p_branch_id: branchId,
        p_legacy_ref: body.legacyRef ?? null,
        p_item_type: body.itemType ?? "PRODUCT",
        p_name_ar: nameAr,
        p_name_en: body.nameEn ?? null,
        p_description: body.description ?? null,
        p_sku: body.sku ?? null,
        p_tax_rate: taxRate,
        p_metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {},
        p_id: body.id ?? null,
      });
      if (error) return json({ error: "CATALOG_ITEM_WRITE_FAILED" }, 400);
      return json(data);
    }

    if (action === "PRICE_UPSERT") {
      const catalogItemId = String(body.catalogItemId ?? "").trim();
      const unitPrice = Number(body.unitPrice);
      const currency = String(body.currency ?? "EGP").toUpperCase();
      const effectiveFrom = body.effectiveFrom == null ? new Date().toISOString() : String(body.effectiveFrom);
      const effectiveTo = body.effectiveTo == null || body.effectiveTo === "" ? null : String(body.effectiveTo);
      if (!catalogItemId) return json({ error: "CATALOG_ITEM_REQUIRED" }, 400);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return json({ error: "INVALID_UNIT_PRICE" }, 400);
      if (currency !== "EGP") return json({ error: "UNSUPPORTED_CURRENCY" }, 400);
      if (!Number.isFinite(Date.parse(effectiveFrom)) || (effectiveTo && !Number.isFinite(Date.parse(effectiveTo)))) {
        return json({ error: "INVALID_PRICE_EFFECTIVITY" }, 400);
      }
      if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom)) {
        return json({ error: "INVALID_PRICE_EFFECTIVITY" }, 400);
      }
      const { data, error } = await admin.rpc("upsert_catalog_price_backend", {
        p_tenant_id: tenantId,
        p_business_id: businessId,
        p_catalog_item_id: catalogItemId,
        p_branch_id: branchId,
        p_currency: currency,
        p_unit_price: unitPrice,
        p_effective_from: effectiveFrom,
        p_effective_to: effectiveTo,
      });
      if (error) return json({ error: "CATALOG_PRICE_WRITE_FAILED" }, 400);
      return json(data);
    }

    const currency = String(body.currency ?? "EGP").toUpperCase();
    const deliveryFee = Number(body.deliveryFee ?? 0);
    if (currency !== "EGP") return json({ error: "UNSUPPORTED_CURRENCY" }, 400);
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) return json({ error: "INVALID_DELIVERY_FEE" }, 400);
    if (typeof body.taxInclusive !== "boolean" || typeof body.allowDiscounts !== "boolean") {
      return json({ error: "INVALID_CATALOG_SETTINGS" }, 400);
    }
    const { data, error } = await admin.rpc("upsert_catalog_settings_backend", {
      p_tenant_id: tenantId,
      p_business_id: businessId,
      p_currency: currency,
      p_delivery_fee: deliveryFee,
      p_tax_inclusive: body.taxInclusive,
      p_allow_discounts: body.allowDiscounts,
    });
    if (error) return json({ error: "CATALOG_SETTINGS_WRITE_FAILED" }, 400);
    return json(data);
  } catch {
    return json({ error: "CATALOG_OPERATION_FAILED" }, 500);
  }
});
