import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const source = fs.readFileSync('web/feature-flags.js', 'utf8');
const context = { window: {}, module: { exports: {} }, globalThis: {} };
vm.runInNewContext(source, context, { filename: 'web/feature-flags.js' });
const flags = context.window.MNTYFeatureFlags || context.module.exports;
assert.ok(flags, 'feature flag resolver must be exported');

const resolved = flags.resolve([
  { id: 'global-on', scope_type: 'GLOBAL', module_code: 'CATALOG', feature_code: 'MODULE_ENABLED', enabled: true, updated_at: '2026-01-01T00:00:00Z' },
  { id: 'sector-off', scope_type: 'SECTOR', sector_id: 'HOMEWARES', module_code: 'CATALOG', feature_code: 'MODULE_ENABLED', enabled: false, updated_at: '2026-01-02T00:00:00Z' },
  { id: 'tenant-on', scope_type: 'TENANT', tenant_id: 'TENANT-A', module_code: 'CATALOG', feature_code: 'MODULE_ENABLED', enabled: true, updated_at: '2026-01-03T00:00:00Z' },
  { id: 'business-off', scope_type: 'BUSINESS', business_id: 'BUSINESS-A', module_code: 'CATALOG', feature_code: 'MODULE_ENABLED', enabled: false, updated_at: '2026-01-04T00:00:00Z' },
  { id: 'other-tenant', scope_type: 'TENANT', tenant_id: 'TENANT-B', module_code: 'CATALOG', feature_code: 'MODULE_ENABLED', enabled: true },
  { id: 'other-branch', scope_type: 'BRANCH', branch_id: 'BRANCH-B', module_code: 'CATALOG', feature_code: 'MODULE_ENABLED', enabled: true }
], { sectorId: 'HOMEWARES', tenantId: 'TENANT-A', businessId: 'BUSINESS-A', branchId: 'BRANCH-A' });
assert.equal(resolved['CATALOG:MODULE_ENABLED'].id, 'business-off', 'business-specific flag must override global, sector and tenant');
assert.equal(flags.moduleEnabled('Catalog', resolved, {}), false, 'disabled module must be hidden');
assert.equal(flags.moduleEnabled('Unconfigured module', resolved, {}), true, 'unconfigured modules remain compatible');
assert.equal(flags.featureEnabled('MARKETING', 'QUOTE_REQUEST', resolved), false, 'unconfigured feature must default off');
assert.equal(flags.scopeMatches({ scope_type: 'WIDGET', scope_id: 'catalog-summary' }, { widgetIds: ['catalog-summary'] }), true, 'widget scope must require exact widget context');
assert.equal(flags.scopeMatches({ scope_type: 'WIDGET', scope_id: 'catalog-summary' }, {}), false, 'widget flags must not leak into module-wide defaults');
console.log('PLATFORM_FEATURE_FLAGS=PASS');
