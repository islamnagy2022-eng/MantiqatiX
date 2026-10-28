import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const dashboard = read('../apps/catalog-frontend/src/modules/dashboard/ProfessionalDashboard.tsx');
const app = read('../apps/catalog-frontend/src/App.tsx');
const context = read('../apps/catalog-frontend/src/context/AppContext.tsx');
const navbar = read('../apps/catalog-frontend/src/components/Navbar.tsx');
const production = read('../apps/catalog-frontend/src/lib/production.ts');
const types = read('../apps/catalog-frontend/src/types/index.ts');
const access = read('../apps/catalog-frontend/src/utils/dashboardAccess.ts');
const employeeManager = read('../apps/catalog-frontend/src/components/merchant/BusinessEmployeeManager.tsx');
const merchantDashboard = read('../apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx');
const permissionRepair = read('../supabase/migrations/20261028225000_rc457_business_employee_permission_ceiling.sql');
const browserE2E = read('../apps/catalog-frontend/tests/professional-dashboard.browser.e2e.mjs');

assert.match(dashboard, /export const ProfessionalDashboard/);
assert.match(dashboard, /authLoading/);
assert.match(dashboard, /authBootstrapError/);
assert.match(dashboard, /canAccessProfessionalDashboard\(authSession\)/);
assert.match(dashboard, /visibleBusinesses = isPlatformAdmin \? businesses : currentBusiness \? \[currentBusiness\] : \[\]/);
assert.match(dashboard, /visibleBusinessIds\.has\(product\.businessId\)/);
assert.match(dashboard, /businessState\(business\)\.key === 'active'/);
assert.match(dashboard, /businessState\(business\)\.key === 'frozen'/);
assert.match(dashboard, /businessState\(business\)\.key === 'inactive'/);
assert.match(dashboard, /aria-label="أقسام الداشبورد"/);
assert.match(dashboard, /setSearchText/);
assert.match(dashboard, /setStatusFilter/);
assert.match(dashboard, /setCategoryFilter/);
assert.match(dashboard, /setGovernorateFilter/);
assert.match(dashboard, /activityTrend/);
assert.match(dashboard, /مساحة عمل محدودة الصلاحيات/);
assert.match(dashboard, /activeSection === 'activities'/);
assert.match(dashboard, /BusinessEmployeeManager business=\{currentBusiness\} readOnly=\{!canManageEmployees\}/);
assert.doesNotMatch(dashboard, /openExistingUserManager/);
assert.doesNotMatch(dashboard, /service_role|serviceRoleKey|SUPABASE_SERVICE_ROLE_KEY/);

assert.match(access, /export const canAccessProfessionalDashboard/);
assert.match(access, /export const canAccessMerchantDashboard/);
assert.match(access, /BUSINESS_MANAGEMENT_ROLES/);
assert.doesNotMatch(access, /new Set\(\['OWNER', 'BUSINESS_OWNER', 'ADMIN', 'MANAGER'\]\)/);
assert.match(access, /membershipPermissions/);
assert.match(access, /!session\.membershipBranchId/);
assert.match(access, /return \['HOME', 'CATALOG', 'EMPLOYEES'\]\.includes\(moduleName\.toUpperCase\(\)\)/);
assert.match(dashboard, /isBusinessManagementRole\(authSession\) && !authSession\.membershipBranchId/);
assert.ok(browserE2E.includes("baseUrl + '?view=merchant_admin'"), 'browser E2E must test branch-owner denial of the broad legacy route');
assert.match(browserE2E, /branch owner must not see unscoped business-wide settings/);
assert.match(access, /!\['EMPLOYEE', 'STAFF'\]\.includes\(getBusinessMembershipRole\(session\)\)/);
assert.match(permissionRepair, /mnty_business_employee_permission_ceiling_allows/);
assert.match(permissionRepair, /mnty_business_employee_list_scoped/);
assert.match(permissionRepair, /return public\.mnty_business_employee_list_scoped\(p_tenant_id,p_business_id,null\)/);
assert.match(permissionRepair, /Compatibility wrapper\. Delegates to the branch-aware function/);
assert.match(permissionRepair, /p_branch_id is null or e\.branch_id=p_branch_id/);
assert.match(permissionRepair, /m\.business_id is null and m\.branch_id is null and upper\(m\.role\) in \('OWNER','ADMIN'\)/);
assert.match(types, /membershipBranchId\?: string/);
assert.match(production, /membershipBranchId: String\(chosenMembership\?\.branch_id \|\| ''\) \|\| undefined/);
assert.match(employeeManager, /mnty_business_employee_list_scoped/);
assert.match(employeeManager, /p_branch_id: membershipBranchId/);
assert.match(browserE2E, /branchOwner:/);
assert.match(browserE2E, /rpcObservation\.scopedBranchId, branchId/);
assert.match(permissionRepair, /mnty_business_employee_list_scoped\(varchar,uuid,varchar\)/);

assert.match(permissionRepair, /mnty_business_employee_permissions_subset/);
assert.ok((permissionRepair.match(/EMPLOYEE_PERMISSION_ESCALATION/g) || []).length >= 2, 'Employee permission creation and overrides must both fail closed on escalation.');
assert.match(permissionRepair, /v_module\|\|'.'\|\|v_action/);

assert.match(context, /'professional_dashboard'/);
assert.match(context, /canAccessProfessionalDashboard\(boot\.authSession\)/);
assert.match(context, /requestedView === 'super_admin' && boot\.authSession\.role === 'admin'/);
assert.match(context, /requestedView === 'merchant_admin' && canAccessMerchantDashboard\(boot\.authSession\)/);
assert.match(context, /requestedView === 'professional_dashboard' && canAccessProfessionalDashboard\(boot\.authSession\)/);
assert.match(dashboard, /visibleSectionItems = SECTION_ITEMS\.filter/);
assert.match(dashboard, /isPlatformAdmin \|\| isBusinessManager/);
assert.match(access, /new Set\(\['OWNER', 'BUSINESS_OWNER', 'ADMIN'\]\)/);
assert.match(dashboard, /canViewEmployees && currentBusiness/);
assert.match(context, /canAccessMerchantDashboard\(boot\.authSession\)/);
assert.match(context, /currentView === 'professional_dashboard'/);
assert.match(context, /setCurrentViewState\('directory'\)/);
assert.match(context, /if \(view !== 'merchant_admin'\) url\.searchParams\.delete\('merchantTab'\)/);
assert.match(types, /membershipRole\?: string/);
assert.match(types, /membershipPermissions\?: Record<string, unknown>/);

assert.match(production, /membershipRole: String\(chosenMembership\?\.role \|\| ''\)\.toUpperCase\(\)/);
assert.match(production, /const managementRoles = \['OWNER', 'BUSINESS_OWNER', 'ADMIN'\]/);
assert.match(production, /business_id \|\| ''\) === chosen\.id && managementRoles\.includes/);
assert.match(production, /A tenant-wide OWNER is valid only within that owner's tenant/);
assert.match(production, /membershipPermissions: chosenMembership\?\.permissions/);
assert.match(production, /businesses\.find\(\(b\) => roleMemberships\.some\(\(m: any\) => String\(m\.business_id \|\| ''\) === b\.id\)\)/);

assert.match(app, /import \{ ProfessionalDashboard \} from '\.\/modules\/dashboard\/ProfessionalDashboard'/);
assert.match(app, /import \{ canAccessMerchantDashboard, canAccessProfessionalDashboard \} from '\.\/utils\/dashboardAccess'/);
assert.match(app, /visibleView === 'professional_dashboard' && <ProfessionalDashboard \/>/);
assert.match(app, /!canAccessProfessionalDashboard\(authSession\)/);
assert.match(app, /!canAccessMerchantDashboard\(authSession\)/);

assert.match(navbar, /canAccessMerchantDashboard\(authSession\)/);
assert.match(navbar, /canAccessProfessionalDashboard\(authSession\)/);
assert.match(navbar, /setCurrentView\('professional_dashboard'\)/);

assert.match(employeeManager, /readOnly\?: boolean/);
assert.match(employeeManager, /readOnly && <p className="rounded-xl border border-sky-200/);
assert.match(merchantDashboard, /get\('merchantTab'\)/);
assert.match(merchantDashboard, /'employees'/);

console.log('PROFESSIONAL_DASHBOARD_CONTRACT=PASS');
console.log('Role-gated route, selected membership scope, permission-aware sections, read-only employee view, filters, and integration with existing screens are present.');
console.log('This static contract does not replace server authorization, RLS, browser E2E, or deployment verification.');
