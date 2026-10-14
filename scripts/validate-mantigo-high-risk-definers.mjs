import fs from 'node:fs';

const sql=fs.readFileSync('scripts/verify-mantigo-high-risk-definers.sql','utf8');
for (const marker of [
  'create_payment_intent_backend',
  'mnty_active_membership',
  'mnty_can_platform_admin',
  'preview_commission_backend',
  'get_mantigo_admin_dashboard_backend',
  'get_mantigo_admin_financial_report_backend',
  'review_mantigo_captain_application',
  'settle_mantigo_captain_backend',
  'expire_stale_mantigo_rides_backend',
  "has_function_privilege('anon'",
  "has_function_privilege('authenticated'",
  'expect_empty_search_path',
  'require_platform_guard',
  'require_exact_platform_permission',
  'FAIL_PLATFORM_GUARD',
  'FAIL_PLATFORM_PERMISSION_PREDICATE',
  'p.prosrc',
  'permissions @>',
  '"scope":"PLATFORM"',
  '"full_control":true',
  'search_path='
]) {
  if (!sql.includes(marker)) throw new Error('MantiGO release security marker missing: '+marker);
}
const requiredPlatformRows = [
  ["get_mantigo_admin_dashboard_backend", ",false,true,true,true,false)"],
  ["get_mantigo_admin_financial_report_backend", ",false,true,true,true,false)"],
  ["settle_mantigo_captain_backend", ",false,true,true,true,false)"],
  ["expire_stale_mantigo_rides_backend", ",false,true,true,true,false)"]
];
for (const [rpc, tuple] of requiredPlatformRows) {
  const row=sql.split('\n').find(line=>line.includes(rpc));
  if (!row || !row.includes(tuple)) {
    throw new Error('MantiGO platform RPC must require the platform guard and empty search_path: '+rpc);
  }
}
console.log('MantiGO high-risk SECURITY DEFINER regression contract: PASS');
