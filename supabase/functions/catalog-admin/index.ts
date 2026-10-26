import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const cors = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin)
    ? origin
    : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
});
const out = (origin: string | null, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(origin) });

const isPlatformAdmin = (m: any) =>
  String(m.role || "").toUpperCase() === "SUPER_ADMIN" &&
  !m.business_id &&
  m.permissions?.scope === "PLATFORM" &&
  m.permissions?.full_control === true;

const businessRole = (m: any) =>
  ["OWNER", "BUSINESS_OWNER", "ADMIN", "MANAGER"].includes(String(m.role || "").toUpperCase());

const isUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const safeBranch = (value: unknown) =>
  typeof value === "string" && value.length > 0 && value.length <= 80 && /^[a-z0-9_-]+$/i.test(value);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return out(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors(origin) });
  if (req.method !== "POST") return out(origin, { error: "METHOD_NOT_ALLOWED" }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return out(origin, { error: "AUTH_REQUIRED" }, 401);
  const token = auth.slice(7).trim();
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return out(origin, { error: "SERVER_MISCONFIGURED" }, 500);

  const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const userClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const { data: { user }, error: userError } = await service.auth.getUser(token);
  if (userError || !user || user.is_anonymous) return out(origin, { error: "AUTH_REQUIRED" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return out(origin, { error: "INVALID_JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return out(origin, { error: "INVALID_BODY" }, 400);

  const action = String(body.action || "").toUpperCase();
  const tenantId = String(body.tenantId || "").trim();
  const businessId = String(body.businessId || "").trim();
  const branchId = body.branchId == null || body.branchId === "" ? null : String(body.branchId).trim();

  try {
    const { data: memberships, error: membershipError } = await service
      .from("user_memberships")
      .select("id,tenant_id,business_id,branch_id,role,status,permissions")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .limit(250);
    if (membershipError) throw membershipError;

    const activeMemberships = memberships || [];
    const hasPlatformScope = activeMemberships.some(isPlatformAdmin);

    if (action === "BUSINESS_LIST") {
      if (!hasPlatformScope) return out(origin, { error: "SUPER_ADMIN_REQUIRED" }, 403);
      const platformTenants = [...new Set(activeMemberships.filter(isPlatformAdmin).map((m: any) => String(m.tenant_id)))];
      if (tenantId && !platformTenants.includes(tenantId)) return out(origin, { error: "TENANT_SCOPE_FORBIDDEN" }, 403);
      if (!platformTenants.length) return out(origin, { businesses: [] });
      let query = service.from("businesses")
        .select("id,tenant_id,organization_id,name,code,status,settings")
        .in("tenant_id", platformTenants)
        .order("name", { ascending: true })
        .limit(250);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data: businesses, error } = await query;
      if (error) throw error;
      const rows = businesses || [];
      const ids = rows.map((b: any) => b.id);
      const { data: profiles, error: profilesError } = ids.length
        ? await service.from("marketing_provider_profiles")
          .select("business_id,name_ar,name_en,provider_kind,status")
          .in("business_id", ids)
        : { data: [], error: null };
      if (profilesError) throw profilesError;
      const profileMap = new Map((profiles || []).map((p: any) => [String(p.business_id), p]));
      return out(origin, {
        businesses: rows.map((b: any) => {
          const p: any = profileMap.get(String(b.id));
          return {
            id: b.id, tenantId: b.tenant_id, organizationId: b.organization_id,
            name: p?.name_ar || p?.name_en || b.name,
            code: b.code, status: b.status,
            sector: p?.provider_kind || b.settings?.activity_code || b.settings?.category_code || "",
          };
        }),
      });
    }

    if (!tenantId || tenantId.length > 80) return out(origin, { error: "TENANT_REQUIRED" }, 400);
    if (!isUuid(businessId)) return out(origin, { error: "INVALID_BUSINESS_ID" }, 400);
    if (branchId && !safeBranch(branchId)) return out(origin, { error: "INVALID_BRANCH_ID" }, 400);

    const businessMemberships = activeMemberships.filter((m: any) =>
      String(m.tenant_id) === tenantId &&
      String(m.business_id || "") === businessId &&
      businessRole(m) &&
      (!m.branch_id || !branchId || String(m.branch_id) === String(branchId))
    );
    const scopedPlatformMembership = activeMemberships.some((m: any) =>
      String(m.tenant_id) === tenantId && isPlatformAdmin(m)
    );
    const hasBusinessScope = businessMemberships.length > 0 || scopedPlatformMembership;
    if (!hasBusinessScope) return out(origin, { error: "BUSINESS_MANAGEMENT_REQUIRED" }, 403);

    const { data: business, error: businessError } = await service
      .from("businesses")
      .select("id,tenant_id,organization_id,name,code,status,settings")
      .eq("id", businessId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (businessError) throw businessError;
    if (!business) return out(origin, { error: "BUSINESS_NOT_FOUND" }, 404);

    if (action === "CATALOG_READ") {
      const { data: rawBranches, error: branchesError } = await service.from("branches")
        .select("id,name,code,status,phone,address")
        .eq("tenant_id", tenantId)
        .eq("business_id", businessId)
        .eq("status", "ACTIVE")
        .order("name", { ascending: true })
        .limit(100);
      if (branchesError) throw branchesError;
      const branchOnlyMemberships = businessMemberships.filter((m: any) => Boolean(m.branch_id));
      const hasBusinessWideMembership = businessMemberships.some((m: any) => !m.branch_id);
      let branches = rawBranches || [];
      if (!scopedPlatformMembership && branchOnlyMemberships.length && !hasBusinessWideMembership) {
        const allowed = new Set(branchOnlyMemberships.map((m: any) => String(m.branch_id)));
        branches = branches.filter((b: any) => allowed.has(String(b.id)));
      }
      if (!branches.length) return out(origin, { error: "ACTIVE_BRANCH_REQUIRED" }, 409);
      const chosenBranch = branchId || String(branches[0].id);
      if (!branches.some((b: any) => String(b.id) === chosenBranch)) {
        return out(origin, { error: "BRANCH_SCOPE_FORBIDDEN" }, 403);
      }
      const [{ data: provider, error: providerError }, { data: items, error: itemsError }] = await Promise.all([
        service.from("marketing_provider_profiles")
          .select("id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured")
          .eq("business_id", businessId).eq("status", "ACTIVE")
          .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        service.from("catalog_items")
          .select("id,tenant_id,business_id,branch_id,legacy_ref,item_type,name_ar,name_en,description,sku,status,tax_rate,metadata,updated_at")
          .eq("tenant_id", tenantId).eq("business_id", businessId)
          .or(`branch_id.is.null,branch_id.eq.${chosenBranch}`)
          .order("name_ar", { ascending: true }).limit(150),
      ]);
      if (providerError) throw providerError;
      if (itemsError) throw itemsError;
      const itemIds = (items || []).map((item: any) => item.id);
      let prices: any[] = [], options: any[] = [];
      if (itemIds.length) {
        const now = new Date().toISOString();
        const [priceRes, optionRes] = await Promise.all([
          service.from("catalog_item_prices")
            .select("id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to")
            .eq("tenant_id", tenantId).in("catalog_item_id", itemIds).eq("status", "ACTIVE")
            .or(`branch_id.is.null,branch_id.eq.${chosenBranch}`)
            .lte("effective_from", now).or(`effective_to.is.null,effective_to.gte.${now}`)
            .order("version", { ascending: false }),
          service.from("catalog_item_options")
            .select("id,catalog_item_id,name_ar,name_en,price_delta,status,metadata")
            .eq("tenant_id", tenantId).in("catalog_item_id", itemIds).eq("status", "ACTIVE")
            .order("name_ar", { ascending: true }),
        ]);
        if (priceRes.error || optionRes.error) throw priceRes.error || optionRes.error;
        prices = priceRes.data || [];
        options = optionRes.data || [];
      }
      const profile = business.settings?.catalog_profile || {};
      return out(origin, {
        business: {
          id: business.id, tenantId: business.tenant_id, organizationId: business.organization_id,
          name: provider?.name_ar || provider?.name_en || business.name,
          code: business.code, status: business.status,
          profile: {
            bio: String(profile.bio || provider?.description || ""),
            governorate: String(profile.governorate || ""),
            markaz: String(profile.markaz || ""),
            village: String(profile.village || ""),
            workingHours: String(profile.working_hours || ""),
            logoUrl: String(profile.logo_url || ""),
            coverUrl: String(profile.cover_url || ""),
            publicEnabled: business.settings?.catalog_public_enabled === true,
          },
        },
        provider: provider ? {
          id: provider.id,
          name: provider.name_ar || provider.name_en || business.name,
          nameAr: provider.name_ar, nameEn: provider.name_en,
          kind: provider.provider_kind, description: provider.description,
          slug: provider.slug, status: provider.status,
          verified: Boolean(provider.is_verified), featured: Boolean(provider.is_featured),
        } : null,
        branches: branches.map((branch: any) => ({
          id: branch.id, name: branch.name, code: branch.code,
          phone: branch.phone, address: branch.address,
        })),
        selectedBranchId: chosenBranch,
        items: items || [], prices, options,
        paymentsEnabled: false,
      });
    }

    if (action === "BUSINESS_PROFILE_UPSERT") {
      const roleForBusiness = businessMemberships.find((m: any) =>
        ["OWNER", "BUSINESS_OWNER", "ADMIN"].includes(String(m.role).toUpperCase())
      );
      if (!roleForBusiness && !scopedPlatformMembership) {
        return out(origin, { error: "CATALOG_PROFILE_WRITE_FORBIDDEN" }, 403);
      }
      const { data, error } = await userClient.rpc("upsert_catalog_business_profile_backend", {
        p_tenant_id: tenantId,
        p_business_id: businessId,
        p_branch_id: branchId,
        p_name: String(body.name || ""),
        p_bio: String(body.bio || ""),
        p_phone: String(body.phone || ""),
        p_address: String(body.address || ""),
        p_governorate: String(body.governorate || ""),
        p_markaz: String(body.markaz || ""),
        p_village: String(body.village || ""),
        p_working_hours: String(body.workingHours || ""),
        p_logo_url: String(body.logoUrl || ""),
        p_cover_url: String(body.coverUrl || ""),
        p_public_enabled: body.publicEnabled === true,
      });
      if (error) throw error;
      return out(origin, data);
    }

    if (action === "ITEM_PRICE_UPSERT") {
      const { data, error } = await userClient.rpc("upsert_catalog_item_and_price_backend", {
        p_tenant_id: tenantId, p_business_id: businessId,
        p_item_branch_id: Object.prototype.hasOwnProperty.call(body, "itemBranchId") ? body.itemBranchId : branchId,
        p_price_branch_id: Object.prototype.hasOwnProperty.call(body, "priceBranchId") ? body.priceBranchId : branchId,
        p_legacy_ref: body.legacyRef ?? null,
        p_item_type: body.itemType ?? "PRODUCT",
        p_name_ar: String(body.nameAr || ""),
        p_name_en: body.nameEn ?? null,
        p_description: body.description ?? null,
        p_sku: body.sku ?? null,
        p_tax_rate: Number(body.taxRate ?? 0),
        p_metadata: body.metadata ?? {},
        p_id: body.id ?? null,
        p_currency: body.currency ?? "EGP",
        p_unit_price: Number(body.unitPrice),
        p_effective_from: body.effectiveFrom ?? new Date().toISOString(),
        p_effective_to: body.effectiveTo ?? null,
      });
      if (error) throw error;
      return out(origin, data);
    }

    if (action === "ITEM_STATUS_UPDATE") {
      const { data, error } = await userClient.rpc("update_catalog_item_status_backend", {
        p_tenant_id: tenantId, p_business_id: businessId,
        p_catalog_item_id: body.catalogItemId,
        p_branch_id: branchId,
        p_status: body.status,
      });
      if (error) throw error;
      return out(origin, data);
    }

    if (action === "ITEM_UPSERT") {
      const { data, error } = await userClient.rpc("upsert_catalog_item_backend", {
        p_tenant_id: tenantId, p_business_id: businessId, p_branch_id: branchId,
        p_legacy_ref: body.legacyRef ?? null, p_item_type: body.itemType ?? "PRODUCT",
        p_name_ar: String(body.nameAr || ""), p_name_en: body.nameEn ?? null,
        p_description: body.description ?? null, p_sku: body.sku ?? null,
        p_tax_rate: Number(body.taxRate ?? 0), p_metadata: body.metadata ?? {},
        p_id: body.id ?? null,
      });
      if (error) throw error;
      return out(origin, data);
    }

    if (action === "PRICE_UPSERT") {
      const { data, error } = await userClient.rpc("upsert_catalog_price_backend", {
        p_tenant_id: tenantId, p_business_id: businessId,
        p_catalog_item_id: body.catalogItemId, p_branch_id: branchId,
        p_currency: body.currency ?? "EGP", p_unit_price: Number(body.unitPrice),
        p_effective_from: body.effectiveFrom ?? new Date().toISOString(),
        p_effective_to: body.effectiveTo ?? null,
      });
      if (error) throw error;
      return out(origin, data);
    }

    if (action === "SETTINGS_UPSERT") {
      const { data, error } = await userClient.rpc("upsert_catalog_settings_backend", {
        p_tenant_id: tenantId, p_business_id: businessId,
        p_currency: String(body.currency ?? "EGP").toUpperCase(),
        p_delivery_fee: Number(body.deliveryFee ?? 0),
        p_tax_inclusive: Boolean(body.taxInclusive ?? false),
        p_allow_discounts: Boolean(body.allowDiscounts ?? false),
      });
      if (error) throw error;
      return out(origin, data);
    }

    return out(origin, { error: "UNSUPPORTED_ACTION" }, 400);
  } catch (error) {
    console.error("catalog-admin failed", error instanceof Error ? error.message : "UNKNOWN");
    return out(origin, { error: error instanceof Error ? error.message : "CATALOG_OPERATION_FAILED" }, 400);
  }
});
