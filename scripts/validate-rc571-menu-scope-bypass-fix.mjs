import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20261025230000_rc571_digital_page_menu_scope_bypass_fix.sql';
const sql = fs.readFileSync(migrationPath, 'utf8');

assert.match(sql, /if new\.page_type <> 'MENU' then\s+return new;\s+end if;/i,
  'non-MENU pages should not enter the MENU guard');
assert.match(sql, /if new\.digital_page_order_id is not null and new\.business_id is null then\s+raise exception 'DIGITAL_PAGE_MENU_BUSINESS_REQUIRED';/i,
  'order-backed MENU must reject missing business scope');
assert.match(sql, /if new\.digital_page_order_id is null then\s+return new;\s+end if;/i,
  'legacy non-order-backed MENU rows must preserve their existing creation path');
assert.match(sql, /v_order\.target_business_id is distinct from new\.business_id/i,
  'order business must match the page business');
assert.match(sql, /digital_page_subscription_active\(v_order\.id, v_actor\)/i,
  'order-backed MENU creation must require an active entitlement');
assert.match(sql, /owner_user_id is null\\s+and not \\(page_type = 'MENU' and digital_page_order_id is not null\\)/i,
  'legacy public-read behavior must remain unchanged while order-backed MENU rows are gated');
assert.match(sql, /public\.digital_page_public_subscription_active\(digital_page_order_id\)/i,
  'order-backed public page reads must pass the subscription gate');
assert.match(sql, /public\.digital_page_public_subscription_active\(p\.digital_page_order_id\)/i,
  'order-backed section reads must pass the subscription gate');
assert.match(sql, /revoke all on function public\.digital_page_business_menu_insert_guard\(\) from public, anon, authenticated/i,
  'trigger function must not be directly executable by application roles');

console.log('RC571 MENU scope bypass regression contract: PASS (source-level checks only; disposable-database and browser E2E remain separate).');
