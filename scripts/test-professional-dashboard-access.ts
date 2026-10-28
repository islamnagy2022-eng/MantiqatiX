import assert from 'node:assert/strict';
import type { AuthSession } from '../apps/catalog-frontend/src/types/index.ts';
import {
  canAccessMerchantDashboard,
  canAccessProfessionalDashboard,
  hasBusinessModulePermission,
  isBusinessManagementRole,
} from '../apps/catalog-frontend/src/utils/dashboardAccess.ts';

const makeSession = (overrides: Partial<AuthSession> = {}): AuthSession => ({
  role: 'subscriber',
  isAuthenticated: true,
  userId: 'user-test',
  businessId: 'business-test',
  membershipRole: 'EMPLOYEE',
  membershipPermissions: {},
  ...overrides,
});

const guest = makeSession({ role: 'guest', businessId: undefined, membershipRole: undefined });
assert.equal(canAccessProfessionalDashboard(guest), false, 'guest must not open the professional dashboard');
assert.equal(canAccessMerchantDashboard(guest), false, 'guest must not open the merchant dashboard');

const platformAdmin = makeSession({ role: 'admin', businessId: undefined, membershipRole: undefined });
assert.equal(canAccessProfessionalDashboard(platformAdmin), true, 'platform admin can open professional dashboard');
assert.equal(canAccessMerchantDashboard(platformAdmin), true, 'platform admin can reach existing merchant tools');

const owner = makeSession({ membershipRole: 'OWNER', membershipPermissions: {} });
assert.equal(isBusinessManagementRole(owner), true);
assert.equal(canAccessProfessionalDashboard(owner), true, 'business owner can open professional dashboard');
assert.equal(canAccessMerchantDashboard(owner), true, 'business-wide owner can open existing merchant dashboard');

const branchOwner = makeSession({ membershipRole: 'OWNER', membershipBranchId: 'branch-a', membershipPermissions: {} });
assert.equal(canAccessProfessionalDashboard(branchOwner), true, 'branch owner can use the scoped professional dashboard');
assert.equal(canAccessMerchantDashboard(branchOwner), false, 'branch owner cannot enter the broad unscoped legacy dashboard');

const managerWithoutPermissions = makeSession({ membershipRole: 'MANAGER', membershipPermissions: {} });
assert.equal(isBusinessManagementRole(managerWithoutPermissions), false, 'MANAGER role must not automatically grant full control');
assert.equal(canAccessProfessionalDashboard(managerWithoutPermissions), false, 'manager with no permissions must be denied');
assert.equal(canAccessMerchantDashboard(managerWithoutPermissions), false, 'limited manager must not open the broad legacy dashboard');

const catalogViewer = makeSession({
  membershipRole: 'EMPLOYEE',
  membershipPermissions: { modules: { CATALOG: ['view'] } },
});
assert.equal(canAccessProfessionalDashboard(catalogViewer), true, 'catalog view permission grants the scoped workspace');
assert.equal(canAccessMerchantDashboard(catalogViewer), false, 'catalog viewer must not enter broad legacy admin tools');
assert.equal(hasBusinessModulePermission(catalogViewer, 'CATALOG', ['view', 'manage']), true);
assert.equal(hasBusinessModulePermission(catalogViewer, 'CATALOG', ['create', 'update', 'manage']), false, 'view-only catalog permission must not permit writes');

const employeeViewer = makeSession({
  membershipRole: 'EMPLOYEE',
  membershipPermissions: { modules: { EMPLOYEES: ['view'] } },
});
assert.equal(canAccessProfessionalDashboard(employeeViewer), true, 'employee viewer may open the scoped dashboard');
assert.equal(hasBusinessModulePermission(employeeViewer, 'EMPLOYEES', ['view', 'manage']), true);
assert.equal(hasBusinessModulePermission(employeeViewer, 'EMPLOYEES', ['create', 'update', 'manage']), false, 'employee view permission must remain read-only');

const createOnly = makeSession({
  membershipRole: 'EMPLOYEE',
  membershipPermissions: { modules: { CATALOG: ['create'] } },
});
assert.equal(canAccessProfessionalDashboard(createOnly), false, 'create-only must not be treated as implicit read access');

const noBusiness = makeSession({ membershipRole: 'OWNER', businessId: undefined });
assert.equal(canAccessProfessionalDashboard(noBusiness), false, 'subscriber without a resolved business must be denied');

const scopedManager = makeSession({
  membershipRole: 'MANAGER',
  membershipPermissions: { modules: { CATALOG: ['view'], EMPLOYEES: ['manage'] } },
});
assert.equal(canAccessProfessionalDashboard(scopedManager), false, 'MANAGER user_memberships are not a supported server permission source until the RPC resolver is extended');
assert.equal(canAccessMerchantDashboard(scopedManager), false);
assert.equal(hasBusinessModulePermission(scopedManager, 'EMPLOYEES', ['create', 'update', 'manage']), false);

console.log('PROFESSIONAL_DASHBOARD_PERMISSION_MATRIX=PASS');
console.log('Covered guest, platform admin, owner, limited manager, view-only employee, create-only denial, and missing-business denial.');
