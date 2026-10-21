const BUSINESS_MANAGER_ROLES = new Set(["OWNER", "ADMIN", "BUSINESS_OWNER", "MANAGER"]);

export function isBranchCreationAuthorized(memberships, businessId) {
  if (!Array.isArray(memberships) || typeof businessId !== "string" || !businessId) return false;

  return memberships.some((membership) => {
    if (!membership || typeof membership !== "object") return false;
    const role = String(membership.role ?? "").toUpperCase();
    const scopedBusinessId = String(membership.business_id ?? "");

    if (BUSINESS_MANAGER_ROLES.has(role)) {
      return scopedBusinessId === businessId;
    }

    return role === "SUPER_ADMIN"
      && scopedBusinessId === ""
      && membership.permissions?.scope === "PLATFORM"
      && membership.permissions?.full_control === true;
  });
}
