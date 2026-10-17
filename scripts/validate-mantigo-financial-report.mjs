#!/usr/bin/env node
import fs from 'node:fs';

const file = 'supabase/migrations/20261017100000_rc565_mantigo_financial_report_column_scope_fix.sql';
if (!fs.existsSync(file)) throw new Error('RC565 migration missing');
const sql = fs.readFileSync(file, 'utf8');
const testFile = 'supabase/tests/rc565_mantigo_financial_report_integration.sql';
if (!fs.existsSync(testFile)) throw new Error('RC565 integration test missing');
const testSql = fs.readFileSync(testFile, 'utf8');
const required = [
  ['correct gross column', /sum\(l\.gross_amount\)/],
  ['correct captain net column', /sum\(l\.captain_net_amount\)/],
  ['commission column', /sum\(l\.commission_amount\)/],
  ['platform-scope authorization', /public\.mnty_can_platform_admin\(\)/],
  ['actor identity binding', /v_auth\s*<>\s*p_admin_user_id/],
  ['fixed search_path', /set search_path\s*=\s*''/i],
  ['anon/public execute revoked', /revoke all on function[\s\S]*from public, anon/i],
  ['authenticated execute explicitly granted', /grant execute on function[\s\S]*to authenticated/i],
  ['invalid date range rejected', /v_from\s*>=\s*v_to/],
  ['exclusive upper bound', /l\.created_at\s*<\s*v_to/],
];
for (const [label, pattern] of required) {
  if (!pattern.test(sql)) throw new Error('RC565 contract missing: ' + label);
}
if (/sum\(l\.(amount|captain_amount)\)/.test(sql)) {
  throw new Error('RC565 uses a column name not present in the live ledger schema');
}
if (!/drop column if exists amount/i.test(testSql) ||
    !/drop column if exists captain_amount/i.test(testSql) ||
    !/fixture must omit legacy report columns/i.test(testSql) ||
    /commission_rate, payment_status, settlement_status, settlement_reference,\s*amount, captain_amount/i.test(testSql)) {
  throw new Error('RC565 integration fixture must remove and not insert legacy report columns');
}
console.log('RC565 integration fixture parity: PASS (legacy amount aliases removed before behavioral assertions)');
console.log('RC565 MantiGO financial report source contract: PASS');
console.log('Note: this is a source-contract check, not an isolated PostgreSQL execution or production E2E test.');
