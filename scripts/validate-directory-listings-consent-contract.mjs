import fs from "node:fs";
import assert from "node:assert/strict";

const edge = fs.readFileSync("supabase/functions/directory-listings/index.ts", "utf8");
const output = fs.readFileSync("supabase/functions/directory-listings/public-directory-output-contract.mjs", "utf8");
const pagination = fs.readFileSync("supabase/functions/directory-listings/consent-pagination.mjs", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261118020000_rc473_directory_listing_contact_consent.sql", "utf8");
const frontend = fs.readFileSync("apps/catalog-frontend/src/lib/directoryListings.ts", "utf8");
const workflow = fs.readFileSync(".github/workflows/primary-catalog-frontend.yml", "utf8");

assert.match(edge, /sanitizePublicDirectoryListing/);
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

console.log("DIRECTORY_LISTINGS_CONTACT_CONSENT_CONTRACT_PASS");
