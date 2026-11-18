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
  'expected_search_path',
  'search_path=""',
  'search_path=public, pg_temp',
  'oidvectortypes(p.proargtypes)','replace(pg_catalog.oidvectortypes'
]) {
  if (!sql.includes(marker)) throw new Error('MantiGO release security marker missing: '+marker);
}
if (!sql.includes('FAIL_SEARCH_PATH') || !sql.includes('expected_search_path') || !sql.includes("'search_path=\"\"'")) throw new Error('MantiGO exact search_path regression contract is missing');
console.log('MantiGO high-risk SECURITY DEFINER regression contract: PASS');
