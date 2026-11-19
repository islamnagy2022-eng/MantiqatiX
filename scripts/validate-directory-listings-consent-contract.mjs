import fs from "node:fs";
import assert from "node:assert/strict";

const edge = fs.readFileSync("supabase/functions/directory-listings/index.ts", "utf8");
const output = fs.readFileSync("supabase/functions/directory-listings/public-directory-output-contract.mjs", "utf8");
const pagination = fs.readFileSync("supabase/functions/directory-listings/consent-pagination.mjs", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261118020000_rc473_directory_listing_contact_consent.sql", "utf8");
const frontend = fs.readFileSync("apps/catalog-frontend/src/lib/directoryListings.ts", "utf8");
const workflow = fs.readFileSync(".github/workflows/primary-catalog-frontend.yml", "utf8");
const config = fs.readFileSync("supabase/config.toml", "utf8");
const release = JSON.parse(fs.readFileSync("docs/release/production-migration-reconciliation.json", "utf8"));
const releaseContract = fs.readFileSync("scripts/production/live-reconciliation-contract.mjs", "utf8");

assert.match(edge, /sanitizePublicDirectoryListing/);
assert.match(config, /\[functions\.directory-listings\]\s*verify_jwt\s*=\s*false/);
assert.match(edge, /resolveDirectoryOwnerAccess/);
assert.match(edge, /const ownerAccess = resolveDirectoryOwnerAccess\(isOwner, consentState\.ready, activeScopes\)/);
assert.match(edge, /can_edit: ownerAccess\.canEdit/);
assert.doesNotMatch(edge, /return \{ \.\.\.publicRow, is_verified/);
assert.doesNotMatch(edge, /listing: \{ \.\.\.publicListing/);
assert.match(edge, /collectActiveAddressConsentIds/);
assert.match(edge, /directory_listing_contact_consents/);
assert.match(edge, /\.is\("revoked_at", null\)/);
assert.match(edge, /Fail closed: a consent registry outage must never expose contact details/);
assert.match(edge, /return \{ scopes, ready: false \}/);
assert.ok((edge.match(/sanitizePublicDirectoryListing\(/g) || []).length >= 3,
  "slug, legacy list and paginated public GET responses must all use the consent-aware sanitizer");
assert.match(edge, /action === "SET_PUBLIC_CONTACT_CONSENT"/);
assert.match(edge, /consented_by: user\.id/);
assert.match(edge, /consent_version: "directory-contact-v1-2026-11-18"/);

for (const field of ['"PHONE"', '"SECONDARY_PHONE"', '"ADDRESS"', '"PRECISE_LOCATION"']) {
  assert.ok(output.includes(field), "public output sanitizer must explicitly scope " + field);
}
assert.match(output, /if \(key === "phone" && !contactScopes\.has\("PHONE"\)\) continue/);
assert.match(output, /if \(key === "address" && !contactScopes\.has\("ADDRESS"\)\) continue/);
assert.match(output, /canEdit: Boolean\(isOwner && consentReady\)/);
assert.match(output, /contactScopes: isOwner \? new Set\(OWNER_CONTACT_SCOPES\) : consentReady \? new Set\(activeScopes\) : new Set\(\)/);
assert.match(pagination, /offset \+= rows\.length/,
  "consent pagination must advance by the actual capped response length");
assert.match(pagination, /return \{ ids: \[\], ready: false \}/,
  "consent pagination must fail closed without partial IDs");

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.directory_listing_contact_consents/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
assert.match(migration, /FORCE ROW LEVEL SECURITY/i);
assert.match(migration, /REVOKE ALL ON TABLE public\.directory_listing_contact_consents FROM PUBLIC, anon, authenticated/i);
assert.match(migration, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.directory_listing_contact_consents TO service_role/i);
assert.match(frontend, /SET_PUBLIC_CONTACT_CONSENT/);
assert.match(frontend, /setPublicDirectoryListingContactConsent/);
assert.match(workflow, /node --test supabase\/functions\/directory-listings\/\*\.test\.mjs/);
assert.match(workflow, /validate-directory-listings-consent-contract\.mjs/);
assert.match(releaseContract, /directoryContact\?\.status === "PASS"/);
assert.match(releaseContract, /published_contact_rows_without_consent_exposure === 0/);
assert.equal(release.directory_contact_consent_boundary?.status, "BLOCKED");
assert.equal(release.directory_contact_consent_boundary?.live_function?.version, 16);
assert.equal(release.directory_contact_consent_boundary?.consent_table?.exists, false);
assert.equal(release.directory_contact_consent_boundary?.published_contact_rows_without_consent_exposure, 869);

console.log("DIRECTORY_LISTINGS_CONTACT_CONSENT_CONTRACT_PASS");
