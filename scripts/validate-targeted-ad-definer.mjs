import fs from "node:fs";
import assert from "node:assert/strict";

const migrationPath = "supabase/migrations/20261014120000_rc524_targeted_ads_empty_search_path.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const lower = migration.toLowerCase();

assert.match(migration, /create or replace function public\.get_mnty_targeted_advertisements\s*\(/i);
assert.match(migration, /security definer\s+set search_path\s*=\s*''/i);
assert.doesNotMatch(migration, /set search_path\s+(?:to\s+)?(?:public|pg_temp)/i);
for (const table of ["advertisements", "advertisement_target_locations", "platform_geo_areas", "platform_global_advertisements"]) {
  assert.match(migration, new RegExp("\\bfrom\\s+public\\." + table + "\\b|\\bjoin\\s+public\\." + table + "\\b", "i"), table + " must be schema-qualified");
}
assert.match(migration, /a\.status\s*=\s*'ACTIVE'\s+and\s+a\.approval_status\s*=\s*'APPROVED'/i);
assert.match(migration, /g\.status\s*=\s*'ACTIVE'\s+and\s+g\.country_code/i);
assert.match(migration, /g\.status\s*=\s*'ACTIVE'\s+and\s+g\.approval_status\s*=\s*'APPROVED'/i);
assert.match(migration, /limit\s+greatest\s*\(\s*1\s*,\s*least\s*\(\s*coalesce\s*\(\s*p_limit\s*,\s*3\s*\)\s*,\s*50\s*\)\s*\)/i);
assert.match(migration, /revoke all on function public\.get_mnty_targeted_advertisements[\s\S]*from public/i);
assert.match(migration, /grant execute on function public\.get_mnty_targeted_advertisements[\s\S]*to anon, authenticated/i);
assert.doesNotMatch(migration, /insert\s+into|update\s+public\.|delete\s+from/i);
assert.doesNotMatch(lower, /email|phone|user_id|customer_id|payment|wallet|credential/i);
console.log("RC524 targeted-ad SECURITY DEFINER boundary PASS");
