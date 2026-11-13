const BUSINESS_FINANCE_ROLES = new Set([
  "OWNER",
  "BUSINESS_OWNER",
  "ADMIN",
  "ACCOUNTANT",
  "FINANCE_MANAGER",
  "FINANCE",
]);

const TENANT_FINANCE_ROLES = new Set([
  "OWNER",
  "ADMIN",
  "ACCOUNTANT",
  "FINANCE_MANAGER",
  "FINANCE",
]);

// Must stay aligned with the current create_settlement_and_post_journal RPC.
const DATABASE_FINANCE_ROLES = new Set([
  "ADMIN",
  "SUPER_ADMIN",
  "OWNER",
  "BUSINESS_OWNER",
  "ACCOUNTANT",
  "FINANCE_MANAGER",
  "FINANCE",
]);

function normalizedId(value) {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result.length ? result : null;
}

function isActive(membership, tenantId) {
  return membership &&
    normalizedId(membership.tenant_id) === tenantId &&
    String(membership.status ?? "").toUpperCase() === "ACTIVE";
}

function isPlatformSuperAdmin(membership) {
  const permissions = membership?.permissions ?? {};
  return String(membership?.role ?? "").toUpperCase() === "SUPER_ADMIN" &&
    normalizedId(membership?.business_id) === null &&
    normalizedId(membership?.branch_id) === null &&
    permissions?.scope === "PLATFORM" &&
    String(permissions?.full_control).toLowerCase() === "true";
}

/**
 * Decide whether a verified actor may create a settlement for this tenant/business.
 * The Edge Function must load memberships for the authenticated user only and order
 * them by created_at ascending, matching the current database RPC's actor-role lookup.
 * Branch-scoped memberships are rejected because the RPC has no branch argument.
 */
export function hasSettlementAuthority({ tenantId, businessId = null, memberships = [] }) {
  const tenant = normalizedId(tenantId);
  const business = normalizedId(businessId);
  if (!tenant || !Array.isArray(memberships)) return false;

  const active = memberships.filter((membership) => isActive(membership, tenant));
  if (!active.length) return false;

  // The database RPC selects the earliest ACTIVE tenant membership by created_at.
  // Fail closed if that role is not accepted by the current database function.
  const earliest = [...active].sort((a, b) => {
    const aTime = Date.parse(a?.created_at ?? "");
    const bTime = Date.parse(b?.created_at ?? "");
    if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return 0;
    return aTime - bTime;
  })[0];
  if (!DATABASE_FINANCE_ROLES.has(String(earliest?.role ?? "").toUpperCase())) return false;

  if (tenant === "MNTY-PLATFORM" && active.some(isPlatformSuperAdmin)) return true;

  if (business) {
    return active.some((membership) =>
      normalizedId(membership.business_id) === business &&
      normalizedId(membership.branch_id) === null &&
      BUSINESS_FINANCE_ROLES.has(String(membership.role ?? "").toUpperCase())
    );
  }

  // A tenant-wide settlement must never be authorized by a business-level role.
  if (tenant === "MNTY-PLATFORM") return false;
  return active.some((membership) =>
    normalizedId(membership.business_id) === null &&
    normalizedId(membership.branch_id) === null &&
    TENANT_FINANCE_ROLES.has(String(membership.role ?? "").toUpperCase())
  );
}
