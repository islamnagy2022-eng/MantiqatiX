import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync('web/home.js', 'utf8');
const migration = readFileSync('supabase/migrations/20261019090000_rc457_public_marketing_service_catalog.sql', 'utf8');

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

console.log('RC457_PUBLIC_CATALOG_SOURCE=PASS');
