const TENANT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function isValidTenantId(value) {
  return typeof value === "string" && TENANT_ID_PATTERN.test(value.trim());
}
