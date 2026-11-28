import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const proxy = readFileSync('supabase/functions/ai-gemini-proxy/index.ts', 'utf8');
const cleanup = readFileSync('supabase/functions/cleanup-catalog-media/index.ts', 'utf8');
const library = readFileSync('apps/catalog-frontend/src/lib/production.ts', 'utf8');
const dashboard = readFileSync('apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx', 'utf8');
const migration = readFileSync('supabase/migrations/20261128070000_mnty_catalog_media_library_retention.sql', 'utf8');
const optimizedMigration = readFileSync('supabase/migrations/20261128071000_optimize_catalog_media_reference_scan.sql', 'utf8');
const allTextMigration = readFileSync('supabase/migrations/20261128072000_include_all_text_catalog_media_references.sql', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');

assert.ok(proxy.includes('action === "list_catalog_images"'), 'the authenticated image proxy must expose image-library listing');
assert.ok(proxy.includes('imageKind === "all" ? validImageKinds') &&
  proxy.includes('businesses/" + businessId + "/owner-uploads/" + mediaKind') &&
  proxy.includes('sourceKind: mediaKind'),
  'image-library listing must cover all four media kinds while preserving business scoping and source labels');
assert.ok(proxy.includes('.storage.from(IMAGE_BUCKET).list(folderPath'), 'image-library listing must use the Storage API');
assert.ok(proxy.includes('businessMemberships') && proxy.includes('catalogWriteAllowed'), 'image listing must reuse business/branch authorization');
assert.ok(library.includes('export async function listCatalogImages'), 'the production client must expose the image-library helper');
assert.ok(library.includes("action: 'list_catalog_images'") &&
  library.includes("imageKind: input.kind || 'all'") &&
  library.includes('sourceKind: item.sourceKind as CatalogAiImageKind'),
  'the client helper must request the unified business library and retain each image source kind');
assert.ok(dashboard.includes('openMediaLibrary(\'logo\')') && dashboard.includes('openMediaLibrary(\'cover\')') && dashboard.includes('openMediaLibrary(\'catalog\')'),
  'logo, cover, and catalogue item editors must offer previous-image selection');
assert.ok(dashboard.includes('aria-modal="true"') && dashboard.includes('مكتبة الصور المرفوعة سابقًا'),
  'the image picker must be an accessible gallery dialog');

assert.ok(migration.includes("now() - interval '5 days'"), 'retention must use a five-day unused age threshold');
assert.ok(migration.includes("c.relname <> 'audit_logs'"), 'upload audit records must not count as live media references');
assert.ok(migration.includes('mnty_catalog_media_object_is_referenced'), 'deletion candidates must be checked against persisted site references');
assert.ok(migration.includes("'pg_catalog.jsonb'::regtype") && migration.includes("'pg_catalog.text'::regtype"),
  'reference detection must search plain text and JSON content');
assert.ok(optimizedMigration.includes('unnest($1::text[])') && optimizedMigration.includes('array_agg(distinct ref.object_path)'),
  'retention must scan all expired candidates in bounded batches rather than rescanning every column per file');
assert.ok(optimizedMigration.includes("a.attname ilike any (array[") &&
  optimizedMigration.includes("'%image%'") && optimizedMigration.includes("'%url%'") && optimizedMigration.includes("'pg_catalog.jsonb'::regtype"),
  'batched reference scan must cover media-named text fields and every JSON/JSONB field');
assert.ok(allTextMigration.includes("'pg_catalog.text'::regtype") &&
  allTextMigration.includes("'pg_catalog.varchar'::regtype") &&
  allTextMigration.includes("'pg_catalog.bpchar'::regtype") &&
  allTextMigration.includes("'pg_catalog.jsonb'::regtype"),
  'the final cleanup scan must inspect every public text and JSON field, including generic page content');
assert.ok(!allTextMigration.includes('a.attname ilike any'),
  'generic text content must not be excluded based on column naming conventions');
assert.ok(migration.includes('cron.schedule(') && migration.includes("'17 * * * *'"),
  'unused media cleanup must be scheduled automatically every hour');
assert.ok(migration.includes('revoke all on function public.mnty_catalog_media_cleanup_token_valid(text) from public, anon, authenticated'),
  'the internal cleanup-token validator must not be callable by browser roles');
assert.ok(migration.includes('grant execute on function public.mnty_list_expired_catalog_media(integer) to service_role'),
  'only the service role may enumerate unused media');

assert.ok(cleanup.includes('mnty_catalog_media_cleanup_token_valid'), 'scheduled cleanup must authenticate with the Vault-backed token');
assert.ok(cleanup.includes('mnty_list_expired_catalog_media'), 'scheduled cleanup must request only expired unreferenced objects');
assert.ok(cleanup.includes('.storage.from(IMAGE_BUCKET).remove(batch)'), 'files must be removed through the Storage API');
assert.ok(config.includes('[functions.cleanup-catalog-media]') && /\[functions\.cleanup-catalog-media\][\s\S]*?verify_jwt = false/.test(config),
  'the isolated cleanup function must use its own high-entropy bearer validation');

console.log('CATALOG_MEDIA_LIBRARY_RETENTION=PASS (scoped_gallery=true, five_day_reference_aware_cleanup=true, cron=true)');
