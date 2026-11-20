export function isPlatformAdminMembershipCandidate(membership) {
  return String(membership?.status || "").toUpperCase() === "ACTIVE" &&
    String(membership?.role || "").toUpperCase() === "SUPER_ADMIN" &&
    !membership?.business_id && !membership?.branch_id &&
    membership?.permissions?.scope === "PLATFORM" &&
    membership?.permissions?.full_control === true;
}

export function resolveDirectoryPlatformAdmin(memberships, registryResult, registryError) {
  return !registryError &&
    registryResult === true &&
    Array.isArray(memberships) &&
    memberships.some(isPlatformAdminMembershipCandidate);
}
