import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const adminUi = read('apps/catalog-frontend/src/components/admin/ActivityModulesAdmin.tsx');
const adminDashboard = read('apps/catalog-frontend/src/components/admin/AdminDashboard.tsx');
const types = read('apps/catalog-frontend/src/types/index.ts');
const registry = read('apps/catalog-frontend/src/modules/activities/activityModuleRegistry.ts');
const moduleView = read('apps/catalog-frontend/src/modules/activities/ActivityModuleView.tsx');
const context = read('apps/catalog-frontend/src/context/AppContext.tsx');
const backend = read('supabase/functions/catalog-platform-admin/index.ts');

assert.match(adminDashboard, /'activity_modules'/, 'The activity module editor must be reachable from the existing admin navigation.');
assert.match(adminDashboard, /<ActivityModulesAdmin \/>/, 'The admin navigation must render the activity module editor.');
assert.match(adminUi, /updateAdminSettings\(\{ activityModuleOverrides: nextOverrides \}\)/, 'Activity overrides must use the existing server-authoritative settings action.');
assert.match(adminUi, /ACTIVITY_SPECIFIC_OVERRIDES\[category\.id\]/, 'The admin editor must be limited to the 50 canonical activity IDs.');
assert.doesNotMatch(adminUi, /\.from\(['"]bizcatalog_platform_settings['"]\)/, 'The browser must never write platform settings directly.');
assert.match(adminUi, /draft\.capabilities\.length !== 3/, 'The editor must preserve exactly three reviewed capabilities per canonical activity.');
assert.match(adminUi, /قيد التجهيز/, 'The editor must keep unintegrated operational capabilities explicitly planned.');
assert.match(adminUi, /لا يمكن تفعيل حالة «متاح»/, 'The editor must not allow administrative copy changes to activate unverified workflows.');
assert.match(types, /export type ActivityModuleOverrides = Record<string, ActivityModuleSettingsOverride>/, 'Persisted activity module settings must be typed.');
assert.match(types, /activityModuleOverrides\?: ActivityModuleOverrides/, 'Admin settings must carry the optional activity override map.');
assert.match(registry, /persistedOverrides\?: ActivityModuleOverrides/, 'The activity resolver must accept persisted overrides.');
assert.match(registry, /state: 'planned' as const/, 'Persisted configuration must never promote a planned capability to available.');
assert.match(moduleView, /resolveActivityModuleConfig\(category, adminSettings\.activityModuleOverrides\)/, 'Public activity pages must consume saved admin configuration.');
assert.match(backend, /sanitizeActivityModuleOverrides/, 'The Edge Function must validate activity settings server-side.');
assert.match(backend, /"activityModuleOverrides"/, 'The existing settings allowlist must explicitly permit only the new settings key.');
assert.match(backend, /PLATFORM_ACTIVITY_MODULE_SETTINGS_UPDATED/, 'Activity module settings changes must be audited server-side.');
assert.match(backend, /auditLogged/, 'The server response must disclose audit logging status.');
assert.match(backend, /productionTenantIds\[0\]/, 'The audit entry must use a verified production tenant from the authenticated platform-admin scope.');
assert.match(context, /result\?\.auditLogged === false/, 'The client must surface a persisted-but-unaudited result instead of claiming full success.');

console.log('Activity module admin contract: PASS');
