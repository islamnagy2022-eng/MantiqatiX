import type { AuthSession } from '../types';

const BUSINESS_MANAGEMENT_ROLES = new Set(['OWNER', 'BUSINESS_OWNER', 'ADMIN']);
const DASHBOARD_MODULES = ['HOME', 'CATALOG', 'ORDERS', 'CUSTOMERS', 'EMPLOYEES', 'SETTINGS', 'REPORTS', 'ANALYTICS', 'FINANCE'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getModulePermissions = (session: AuthSession): Record<string, unknown> => {
  const permissions = session.membershipPermissions;
  if (!isRecord(permissions)) return {};
  const modules = permissions.modules;
  return isRecord(modules) ? modules : permissions;
};

export const getBusinessMembershipRole = (session: AuthSession): string =>
  String(session.membershipRole || '').trim().toUpperCase();

export const isBusinessManagementRole = (session: AuthSession): boolean =>
  BUSINESS_MANAGEMENT_ROLES.has(getBusinessMembershipRole(session));

export const hasBusinessModulePermission = (
  session: AuthSession,
  moduleName: string,
  allowedActions: string[] = ['view'],
): boolean => {
  if (session.role === 'admin') return true;
  if (isBusinessManagementRole(session)) {
    // The broad legacy UI and business-level reports are not branch-aware yet.
    // Branch-scoped managers are limited to the branch-aware catalog and employee RPCs.
    if (!session.membershipBranchId) return true;
    return ['HOME', 'CATALOG', 'EMPLOYEES'].includes(moduleName.toUpperCase());
  }
  // RC115's server resolver reads scoped permissions from EMPLOYEE/STAFF memberships
  // (or platform_role_assignments); a raw MANAGER/FINANCE/etc user_membership row
  // is not a supported grant source, so the UI must fail closed for those roles.
  if (!['EMPLOYEE', 'STAFF'].includes(getBusinessMembershipRole(session))) return false;
  const modules = getModulePermissions(session);
  const configured = modules[moduleName] ?? modules[moduleName.toLowerCase()];
  const actions = Array.isArray(configured)
    ? configured.map((action) => String(action).trim().toLowerCase())
    : isRecord(configured) && Array.isArray(configured.actions)
      ? configured.actions.map((action) => String(action).trim().toLowerCase())
      : [];
  const accepted = new Set(allowedActions.map((action) => action.toLowerCase()));
  // "manage" necessarily includes read access; other permissions are not inferred.
  return actions.includes('manage') || actions.some((action) => accepted.has(action));
};

export const canAccessProfessionalDashboard = (session: AuthSession): boolean => {
  if (session.role === 'admin') return true;
  if (session.role !== 'subscriber' || !session.businessId) return false;
  if (isBusinessManagementRole(session)) return true;
  return DASHBOARD_MODULES.some((moduleName) =>
    hasBusinessModulePermission(session, moduleName, ['view', 'manage'])
  );
};

/**
 * The legacy merchant dashboard currently contains several broad tabs and is not
 * implemented as a per-module permission renderer. Until those old tabs enforce
 * each employee permission independently, only explicit business management roles
 * may enter it; employees use the scoped professional dashboard instead.
 */
export const canAccessMerchantDashboard = (session: AuthSession): boolean =>
  session.role === 'admin' ||
  (session.role === 'subscriber' &&
    Boolean(session.businessId) &&
    !session.membershipBranchId &&
    isBusinessManagementRole(session));
