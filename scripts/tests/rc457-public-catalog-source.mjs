import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync('web/home.js', 'utf8');
const migration = readFileSync('supabase/migrations/20261019090000_rc457_public_marketing_service_catalog.sql', 'utf8');
const providerMigration = readFileSync('supabase/migrations/20261019100000_rc458_public_provider_profile_column_allowlist.sql', 'utf8');

assert.match(home, /from\('marketing_services'\)\.select\('id,code,name_ar,name_en,category_code,description'\)/,
  'public directory must request only the service catalog fields it renders');
assert.match(home, /from\('marketing_provider_profiles'\)\.select\('id,business_id,name_ar,name_en,provider_kind,description,service_areas,status,is_verified,is_featured,ranking_weight,profile_image_path,updated_at'\)/,
  'public provider listing must use an explicit public field allowlist');
assert.doesNotMatch(home, /from\('marketing_provider_profiles'\)\.select\([^)]*settings/,
  'public directory must not fetch provider settings, which may contain private configuration');
assert.doesNotMatch(home, /provider\?\.settings\?\.branding/,
  'public provider rendering must not depend on private provider settings');
assert.match(migration, /create policy marketing_services_public_active_read[\s\S]*?using \(status = 'ACTIVE'\)/,
  'public service catalog must be restricted to ACTIVE rows');
assert.match(migration, /grant select \([\s\S]*?\) on table public\.marketing_services to anon/,
  'anonymous catalog access must be column-limited');
assert.match(migration, /revoke select on table public\.marketing_services from public, anon/,
  'table-wide anonymous/public select must be revoked before allowlist grant');

assert.ok(providerMigration.includes('drop policy if exists "Public can view active marketing providers"'),
  'legacy authenticated-only public-provider policy must be replaced');
assert.ok(providerMigration.includes('for select to anon, authenticated') && providerMigration.includes("using (status = 'ACTIVE')"),
  'anonymous provider discovery must be explicitly ACTIVE-only');
assert.ok(providerMigration.includes('revoke select on table public.marketing_provider_profiles from public, anon'),
  'anonymous/public table-wide provider profile access must be revoked');
assert.ok(providerMigration.includes(') on table public.marketing_provider_profiles to anon'),
  'anonymous provider profile reads must use an explicit column allowlist');
assert.doesNotMatch(providerMigration, /settings|owner_user_id|portfolio/,
  'private provider fields must not be granted to anonymous visitors');

console.log('RC457_RC458_PUBLIC_CATALOG_SOURCE=PASS');
