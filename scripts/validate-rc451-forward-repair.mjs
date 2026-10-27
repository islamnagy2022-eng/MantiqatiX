import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20261028010000_rc451_targeted_ads_search_path_forward_repair.sql', 'utf8');
const workflow = fs.readFileSync('.github/workflows/module-professionalization.yml', 'utf8');
const integration = fs.readFileSync('supabase/tests/rc451_targeted_ads_search_path_integration.sql', 'utf8');
const historical = fs.readFileSync('supabase/migrations/20261010200000_rc451_targeted_ads_empty_search_path.sql', 'utf8');

assert.match(migration, /RC451_FORWARD_REPAIR_FUNCTION_MISSING/);
assert.match(migration, /RC451_FORWARD_REPAIR_SCHEMA_QUALIFICATION_CONTRACT_DRIFT/);
assert.match(migration, /from\|join/);
assert.match(migration, /advertisement_target_locations/);
assert.match(migration, /platform_geo_areas/);
assert.match(migration, /platform_global_advertisements/);
assert.match(migration, /ALTER FUNCTION public\.get_mnty_targeted_advertisements/);
assert.match(migration, /SET search_path = ''/);
assert.match(migration, /has_function_privilege\('anon', v_oid, 'EXECUTE'\)/);
assert.match(migration, /has_function_privilege\('authenticated', v_oid, 'EXECUTE'\)/);
assert.match(migration, /RC451_FORWARD_REPAIR_EMPTY_SEARCH_PATH_NOT_APPLIED/);
assert.doesNotMatch(migration, /\b(?:INSERT|UPDATE|DELETE|DROP TABLE|TRUNCATE)\b/i,
  'The repair must not mutate business data or drop database objects');
assert.doesNotMatch(migration, /\b(?:GRANT|REVOKE)\b/i,
  'The repair must preserve existing execute grants rather than changing the public discovery boundary');
assert.match(workflow, /20261028010000_rc451_targeted_ads_search_path_forward_repair\.sql/,
  'The isolated PostgreSQL test must apply the forward repair');
assert.match(workflow, /ALTER FUNCTION public\.get_mnty_targeted_advertisements[\s\S]*?SET search_path = public, pg_temp/,
  'The isolated test must restore the drifted configuration before exercising the forward repair');
assert.match(workflow, /node scripts\/validate-rc451-forward-repair\.mjs/,
  'CI must run the forward repair contract validator');
assert.match(integration, /RC451_EMPTY_SEARCH_PATH_NOT_APPLIED/);
assert.match(integration, /RC451_INTENDED_PUBLIC_DISCOVERY_GRANTS_CHANGED/);
assert.match(historical, /set search_path = ''/,
  'The original immutable RC451 migration must remain unchanged');

console.log('RC451_FORWARD_REPAIR_CONTRACT=PASS');
