import fs from 'node:fs';

const migration = fs.readFileSync(
  'supabase/migrations/20261009170000_mantigo_platform_admin_scope_hardening.sql',
  'utf8'
);

const requiredFunctions = [
  'get_mantigo_admin_dashboard_backend',
  'get_mantigo_admin_financial_report_backend',
  'expire_stale_mantigo_rides_backend',
];

for (const name of requiredFunctions) {
  if (!migration.includes(`FUNCTION public.${name}`)) {
    throw new Error('Missing hardened MantiGO function: ' + name);
  }
}

const platformScopeChecks = migration.match(/m\.tenant_id = 'MNTY-PLATFORM'[\s\S]*?m\.status = 'ACTIVE'[\s\S]*?upper\(m\.role\) = 'SUPER_ADMIN'[\s\S]*?m\.permissions->>'scope', ''\) = 'PLATFORM'[\s\S]*?m\.permissions->>'full_control'\)::boolean, false\) = true/g) || [];
if (platformScopeChecks.length !== 3) {
  throw new Error('Expected explicit platform-scoped SUPER_ADMIN gate in all three RPCs; found ' + platformScopeChecks.length);
}

if ((migration.match(/SET search_path TO 'public', 'pg_temp'/g) || []).length !== 3) {
  throw new Error('All three SECURITY DEFINER RPCs must pin search_path');
}
if ((migration.match(/p_admin_user_id <> auth\.uid\(\)/g) || []).length !== 2) {
  throw new Error('Human actor binding missing from dashboard/expiration RPCs');
}
if (!migration.includes('v_auth <> p_admin_user_id')) {
  throw new Error('Financial report actor binding missing');
}
if ((migration.match(/PLATFORM_ADMIN_REQUIRED/g) || []).length !== 3) {
  throw new Error('Stable platform-admin denial missing from all three RPCs');
}
if (/upper\(role\) in \('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','MANAGER','OPERATIONS','OPERATIONS_MANAGER'\)/.test(migration)) {
  throw new Error('Generic tenant roles must not authorize platform-wide RPCs');
}

console.log('MantiGO platform-admin scope hardening source contract: PASS');
