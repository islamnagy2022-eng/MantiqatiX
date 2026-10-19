import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync('web/home.js', 'utf8');
const serviceMigration = readFileSync('supabase/migrations/20261019090000_rc457_public_marketing_service_catalog.sql', 'utf8');
const providerMigration = readFileSync('supabase/migrations/20261019100000_rc458_public_provider_profile_column_allowlist.sql', 'utf8');
const sqlTest = readFileSync('supabase/tests/rc457_public_marketing_service_catalog.sql', 'utf8');

assert.match(home, /from\('marketing_services_public'\)\.select\('id,code,name_ar,name_en,category_code,description'\)/,
  'public directory must query the allowlisted service catalog view');
assert.match(home, /from\('marketing_provider_profiles_public'\)\.select\('id,business_id,name_ar,name_en,provider_kind,description,service_areas,status,is_verified,is_featured,ranking_weight,profile_image_path,updated_at'\)/,
  'public provider listing must query the allowlisted public profile view');
assert.doesNotMatch(home, /from\('marketing_provider_profiles'\)\.select\([^)]*settings/,
  'public directory must not fetch provider settings');
assert.doesNotMatch(home, /provider\?\.settings\?\.branding/,
  'public provider rendering must not depend on private provider settings');

assert.match(serviceMigration, /with \(security_barrier = true\)/,
  'public service catalog must use a security-barrier view');
assert.match(providerMigration, /with \(security_barrier = true\)/,
  'public provider directory must use a security-barrier view');
assert.match(serviceMigration, /create or replace view public\.marketing_services_public[\s\S]*?where status = 'ACTIVE'/,
  'public service catalog view must expose ACTIVE rows only');
assert.match(serviceMigration, /grant select on table public\.marketing_services_public to anon, authenticated/,
  'public service catalog view must be readable by visitors and signed-in users');
assert.match(serviceMigration, /revoke all on table public\.marketing_services from public, anon/,
  'anonymous visitors must not directly read the base service table');

assert.match(providerMigration, /create or replace view public\.marketing_provider_profiles_public[\s\S]*?where status = 'ACTIVE'/,
  'public provider view must expose ACTIVE rows only');
assert.match(providerMigration, /grant select on table public\.marketing_provider_profiles_public to anon, authenticated/,
  'public provider view must be readable by visitors and signed-in users');
assert.match(providerMigration, /revoke all on table public\.marketing_provider_profiles from public, anon/,
  'anonymous visitors must not directly read the base provider table');
assert.doesNotMatch(providerMigration, /settings|owner_user_id|portfolio/,
  'private provider fields must not be exposed by the public view');
assert.ok(!providerMigration.includes('drop policy if exists "Owners manage their marketing provider profile"'),
  'RC458 must preserve the existing owner policy on the base table');
assert.ok(!providerMigration.includes('drop policy if exists "CRM managers view marketing providers"'),
  'RC458 must preserve the existing CRM-manager policy on the base table');
assert.match(serviceMigration, /revoke all on table public\.marketing_services_public from public, anon, authenticated;[\s\S]*?grant select on table public\.marketing_services_public to anon, authenticated;/,
  'service view must grant SELECT only after revoking other privileges');
assert.match(providerMigration, /revoke all on table public\.marketing_provider_profiles_public from public, anon, authenticated;[\s\S]*?grant select on table public\.marketing_provider_profiles_public to anon, authenticated;/,
  'provider view must grant SELECT only after revoking other privileges');
assert.match(sqlTest, /create policy provider_owner_private_profile_read[\s\S]*?owner_user_id::text = current_setting\('request\.jwt\.claim\.sub', true\)/,
  'isolated RLS regression must retain an owner-scoped private-profile policy');
assert.match(sqlTest, /RC458 owner could not read own private provider profile under existing RLS/,
  'isolated RLS regression must verify owner private-profile access remains available');
assert.match(sqlTest, /RC458 unrelated authenticated user read another provider base row/,
  'isolated RLS regression must deny unrelated authenticated base-table reads');

console.log('RC457_RC458_PUBLIC_CATALOG_SOURCE=PASS');
