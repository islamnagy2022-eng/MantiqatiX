/* Scoped MantiqatiX feature flag resolver.
 * UI visibility is a convenience only. RLS, guarded RPCs and Edge Functions
 * remain the security boundary for every protected read or mutation.
 */
(function (root) {
  'use strict';
  const PRIORITY = Object.freeze({ GLOBAL: 1, SECTOR: 2, TENANT: 3, BUSINESS: 4, BRANCH: 5 });
  const normalize = value => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

  function scopeMatches(row, context) {
    const scope = String(row?.scope_type || '').toUpperCase();
    if (scope === 'GLOBAL') return true;
    if (scope === 'SECTOR') return Boolean(context.sectorId) && String(row.sector_id || '') === String(context.sectorId);
    if (scope === 'TENANT') return Boolean(context.tenantId) && String(row.tenant_id || '') === String(context.tenantId);
    if (scope === 'BUSINESS') return Boolean(context.businessId) && String(row.business_id || '') === String(context.businessId);
    if (scope === 'BRANCH') return Boolean(context.branchId) && String(row.branch_id || '') === String(context.branchId);
    // WIDGET flags require an explicit widget context and are not promoted to a
    // module-wide flag by accident.
    if (scope === 'WIDGET') return Array.isArray(context.widgetIds) && context.widgetIds.includes(String(row.scope_id || ''));
    return false;
  }

  function resolve(rows, context = {}) {
    const sorted = (Array.isArray(rows) ? rows : [])
      .filter(row => row && scopeMatches(row, context))
      .slice()
      .sort((a, b) => {
        const pa = PRIORITY[String(a.scope_type || '').toUpperCase()] || 0;
        const pb = PRIORITY[String(b.scope_type || '').toUpperCase()] || 0;
        if (pa !== pb) return pa - pb;
        const ta = Date.parse(a.updated_at || a.created_at || '') || 0;
        const tb = Date.parse(b.updated_at || b.created_at || '') || 0;
        if (ta !== tb) return ta - tb;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
    const flags = Object.create(null);
    for (const row of sorted) {
      const moduleCode = normalize(row.module_code);
      const featureCode = normalize(row.feature_code);
      const key = moduleCode + ':' + featureCode;
      flags[key] = { ...row, module_code: moduleCode, feature_code: featureCode };
    }
    return flags;
  }

  function moduleEnabled(name, flags, aliases = {}) {
    const keys = [normalize(name)].concat((aliases[name] || []).map(normalize));
    for (const key of keys) {
      for (const feature of ['MODULE_ENABLED', 'ENABLED', 'VISIBILITY']) {
        const flag = (flags || {})[key + ':' + feature];
        if (flag) return flag.enabled === true;
      }
    }
    // Preserve existing module availability when no flag has been configured.
    // This default does not grant data access: server-side authorization still applies.
    return true;
  }

  function featureEnabled(moduleCode, featureCode, flags) {
    const feature = normalize(featureCode);
    const local = (flags || {})[normalize(moduleCode) + ':' + feature];
    if (local) return local.enabled === true;
    const global = (flags || {})[':' + feature];
    return global?.enabled === true;
  }

  root.MNTYFeatureFlags = Object.freeze({ PRIORITY, normalize, scopeMatches, resolve, moduleEnabled, featureEnabled });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MNTYFeatureFlags;
})(typeof window !== 'undefined' ? window : globalThis);
