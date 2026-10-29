import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const dashboardPath = 'apps/catalog-frontend/src/modules/dashboard/ProfessionalDashboard.tsx';
const employeeManagerPath = 'apps/catalog-frontend/src/components/merchant/BusinessEmployeeManager.tsx';
const migrationPath = 'supabase/migrations/20261028225000_rc457_business_employee_permission_ceiling.sql';
const manifestPath = 'docs/release/production-migration-reconciliation.json';

const dashboardPresent = exists(dashboardPath) && read(dashboardPath).includes('export const ProfessionalDashboard');
if (!dashboardPresent) {
  console.log('PROFESSIONAL_DASHBOARD_PRODUCTION_DEPENDENCIES=NOT_APPLICABLE; dashboard route is not part of this source tree.');
  process.exit(0);
}

const manifest = JSON.parse(read(manifestPath));
const evidence = manifest.professional_dashboard_dependency_check;
const observed = Array.isArray(evidence?.required_objects) ? evidence.required_objects : [];
const missing = observed.filter((entry) => entry?.exists !== true || entry?.status !== 'PASS');
const dashboardUsesEmployeeRpc = read(dashboardPath).includes('BusinessEmployeeManager');
const managerUsesScopedRpc = exists(employeeManagerPath) && read(employeeManagerPath).includes("mnty_business_employee_list_scoped");
const migrationDefinesScopedRpc = exists(migrationPath) && read(migrationPath).includes('create or replace function public.mnty_business_employee_list_scoped(');
const ready = evidence?.status === 'PASS' && observed.length >= 9 && missing.length === 0 &&
  dashboardUsesEmployeeRpc && managerUsesScopedRpc && migrationDefinesScopedRpc;
const isMainDeployment = process.env.GITHUB_REF === 'refs/heads/main' &&
  (process.env.GITHUB_EVENT_NAME === 'push' || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch');

if (ready) {
  console.log('PROFESSIONAL_DASHBOARD_PRODUCTION_DEPENDENCIES=PASS; live database evidence is complete.');
  process.exit(0);
}

const missingNames = missing.map((entry) => String(entry?.object || 'unknown object'));
if (!managerUsesScopedRpc) missingNames.push('frontend employee manager must use the branch-scoped roster RPC');
if (!migrationDefinesScopedRpc) missingNames.push('RC457 migration must define the branch-scoped roster RPC');
console.log('PROFESSIONAL_DASHBOARD_PRODUCTION_DEPENDENCIES=BLOCKED; evidence=' +
  String(evidence?.status || 'MISSING') + '; missing=' + (missingNames.join(', ') || 'live dependency evidence is incomplete') + '.');
console.log('Feature-branch and pull-request validation may continue, but production deployment must wait for a reviewed migration rollout and fresh live-object verification.');
if (isMainDeployment) {
  console.error('Refusing main deployment: dashboard employee controls depend on RC113-RC115 and RC457 database objects absent from verified live evidence.');
  process.exitCode = 1;
}
