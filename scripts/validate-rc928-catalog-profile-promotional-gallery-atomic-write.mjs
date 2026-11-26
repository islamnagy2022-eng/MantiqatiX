import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const migrationPath = "supabase/migrations/20261126010000_rc928_catalog_profile_promotional_gallery_atomic_write.sql";
const migration = read(migrationPath);
const edge = read("supabase/functions/catalog-admin/index.ts");
const shared = read("supabase/functions/_shared/promotional-images.mjs");
const sharedTests = read("supabase/functions/_shared/promotional-images.test.mjs");
const ownerIntegration = read("supabase/tests/owner_profile_persistence_integration.sql");
const primaryWorkflow = read(".github/workflows/primary-catalog-frontend.yml");
const replayWorkflow = read(".github/workflows/forward-migration-chain-replay.yml");
const releaseGate = read("scripts/validate-production-migration-chain-gate.mjs");
const productionVerifier = read("scripts/production/verify-production.mjs");
const liveContract = read("scripts/production/live-reconciliation-contract.mjs");
const manifest = JSON.parse(read("docs/release/production-migration-reconciliation.json"));
const crosswalk = read("docs/release/REQUIRED_85_MIGRATION_SOURCE_OBJECT_CROSSWALK_20261126.md");
const galleryValidator = read("scripts/validate-promotional-image-gallery.mjs");
const ownerValidator = read("scripts/validate-owner-profile-persistence.mjs");

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.upsert_catalog_business_profile_atomic_backend\(/);
assert.match(migration, /SECURITY DEFINER[\s\S]*?SET search_path TO ''/);
assert.match(migration, /auth\.uid\(\)/);
assert.match(migration, /auth\.jwt\(\)->>'is_anonymous'/);
assert.match(migration, /IS DISTINCT FROM 'false'/);
assert.match(migration, /public\.upsert_catalog_business_profile_backend\(/,
  "the new RPC must compose the existing owner/admin-scoped canonical write instead of duplicating weaker authz");
assert.match(migration, /FOR UPDATE/,
  "the business row lock must remain held while the promotional metadata JSONB patch is applied");
assert.match(migration, /pg_catalog\.jsonb_set\([\s\S]*?\{catalog_profile\}/);
assert.match(migration, /coalesce\(v_profile, '\{\}'::jsonb\) \|\| v_metadata/,
  "metadata must merge into the current locked catalog_profile rather than replace the settings object");
assert.match(migration, /promotional_images/);
assert.match(migration, /jsonb_array_length\(v_metadata->'promotional_images'\) > 10/);
assert.match(migration, /v_url !~\* '\^https:\/\/'/);
assert.match(migration, /additional_contact_phones/);
assert.match(migration, /public_contact_consent_audit_verified/,
  "new consent values must remain fail-closed until catalog-admin writes a durable audit row");
assert.match(migration, /REVOKE ALL ON FUNCTION public\.upsert_catalog_business_profile_atomic_backend[\s\S]*FROM PUBLIC, anon/);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.upsert_catalog_business_profile_atomic_backend[\s\S]*TO authenticated/);
assert.doesNotMatch(migration, /GRANT (?:ALL|INSERT|UPDATE|DELETE)[\s\S]*TO anon/,
  "RC928 must not widen anonymous access");

const edgeStart = edge.indexOf('if (action === "BUSINESS_PROFILE_UPSERT")');
const edgeEnd = edge.indexOf('if (action === "ITEM_PRICE_UPSERT")', edgeStart);
assert.ok(edgeStart >= 0 && edgeEnd > edgeStart, "catalog-admin profile write action must exist");
const profileAction = edge.slice(edgeStart, edgeEnd);
assert.ok(profileAction.includes('userClient.rpc("upsert_catalog_business_profile_atomic_backend"'),
  "catalog-admin must call the atomic database RPC");
assert.ok(profileAction.includes("p_profile_metadata: submittedProfileMetadata"),
  "the metadata patch must be submitted in the same RPC transaction as canonical profile writes");
assert.ok(profileAction.includes("validatePromotionalImages(body.promotionalImages)"),
  "Edge must validate owner-submitted gallery URLs before calling the database");
assert.ok(profileAction.includes("PUBLIC_CONTACT_CONSENT_AUDIT_FAILED")
  && profileAction.includes("PUBLIC_CONTACT_CONSENT_ACTIVATION_CONFLICT"),
  "durable public-contact audit and compare-and-set activation must remain fail-closed");
assert.ok(profileAction.includes('.eq("updated_at", pendingBusiness.updated_at)'),
  "public contact activation must preserve its concurrent-edit compare-and-set guard");
assert.ok(!profileAction.includes("imageSourceWriteError")
  && !profileAction.includes("socialWriteError")
  && !profileAction.includes("savedProfileSettings"),
  "gallery/social metadata may not be written via the old separate service-role JSONB read/merge/write path");

assert.match(shared, /MAX_PROMOTIONAL_IMAGES = 10/);
assert.match(shared, /url\.protocol === "https:"/);
assert.match(shared, /!url\.username/);
assert.match(shared, /!url\.password/);
assert.match(shared, /!url\.port/);
assert.match(sharedTests, /PROMOTIONAL_IMAGES_LIMIT_EXCEEDED/);
assert.match(sharedTests, /PROMOTIONAL_IMAGE_URL_INVALID/);

for (const marker of [
  "RC928_ATOMIC_PROFILE_RPC_DID_NOT_SUCCEED",
  "RC928_PREVIOUS_PUBLIC_CONTACT_STATE_WRONG",
  "RC928_ATOMIC_PROFILE_MERGE_OR_GALLERY_FAILED",
  "RC928_INVALID_GALLERY_URL_WAS_ALLOWED",
  "RC928_INVALID_GALLERY_PARTIALLY_CHANGED_PROFILE",
  "RC928_OVER_LIMIT_GALLERY_WAS_ALLOWED",
  "RC928_OVER_LIMIT_GALLERY_PARTIALLY_CHANGED_PROFILE",
  "RC928_MISSING_IDENTITY_CLAIM_WAS_ALLOWED",
  "RC928_ANONYMOUS_AUTH_WRITE_WAS_ALLOWED",
  "OWNER_PROFILE_BRANCH_MANAGER_WRITE_WAS_ALLOWED",
]) assert.ok(ownerIntegration.includes(marker), "PostgreSQL regression missing marker: " + marker);

assert.ok(primaryWorkflow.includes("node scripts/validate-rc928-catalog-profile-promotional-gallery-atomic-write.mjs"));
assert.ok(replayWorkflow.includes("node scripts/validate-rc928-catalog-profile-promotional-gallery-atomic-write.mjs"));
assert.ok(replayWorkflow.includes("supabase/tests/owner_profile_persistence_integration.sql"));
assert.ok(replayWorkflow.includes("OWNER_PROFILE_PERSISTENCE_INTEGRATION"));
assert.ok(releaseGate.includes("20261126010000_rc928_catalog_profile_promotional_gallery_atomic_write.sql"));
assert.ok(productionVerifier.includes("20261126010000_rc928_catalog_profile_promotional_gallery_atomic_write.sql"));
assert.ok(liveContract.includes('"20261126010000"'));
assert.equal(manifest.required_release_migration_ledger_check.expected_migration_versions, 85);
assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261126010000"));
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261126010000"));
assert.ok(crosswalk.includes("20261126010000_rc928_catalog_profile_promotional_gallery_atomic_write.sql"));
assert.ok(galleryValidator.includes('upsert_catalog_business_profile_atomic_backend'));
assert.ok(ownerValidator.includes("upsert_catalog_business_profile_atomic_backend"));

console.log("RC928_ATOMIC_CATALOG_PROFILE_PROMOTIONAL_GALLERY=PASS");
