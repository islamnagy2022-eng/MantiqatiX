import { execFileSync } from "node:child_process";
import "./validate-directory-platform-admin-registry.mjs";

execFileSync(process.execPath, ["--test", "supabase/functions/settlement-financial-atomic/authorization.test.mjs"], {
  stdio: "inherit",
});
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sanitizePublicDirectoryListing } from "../supabase/functions/directory-listings/public-directory-output-contract.mjs";
import { buildDirectoryPaginationOrFilter } from "../supabase/functions/directory-listings/pagination-filter.mjs";
import { collectActiveAddressConsentIds } from "../supabase/functions/directory-listings/consent-pagination.mjs";
import { collectActiveContactConsentScopes } from "../supabase/functions/directory-listings/contact-consent-pagination.mjs";

const source = readFileSync("supabase/functions/directory-listings/index.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261118020000_rc473_directory_listing_contact_consent.sql", "utf8");
const ui = readFileSync("apps/catalog-frontend/src/components/DirectoryListingsView.tsx", "utf8");
const client = readFileSync("apps/catalog-frontend/src/lib/directoryListings.ts", "utf8");
const pagination = readFileSync("supabase/functions/directory-listings/pagination-filter.mjs", "utf8");
const consentPagination = readFileSync("supabase/functions/directory-listings/consent-pagination.mjs", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const release = JSON.parse(readFileSync("docs/release/production-migration-reconciliation.json", "utf8"));
const releaseContract = readFileSync("scripts/production/live-reconciliation-contract.mjs", "utf8");
const directoryBoundary = release.directory_contact_consent_boundary;
const directoryBoundaryEvidenceValid = directoryBoundary?.status === "BLOCKED"
  ? directoryBoundary.live_function?.version === 16 &&
    directoryBoundary.live_function?.complete_bundle_match === false &&
    directoryBoundary.live_function?.missing_live_files?.includes("consent-pagination.mjs") &&
    directoryBoundary.consent_table_exists === false &&
    directoryBoundary.consent_table?.exists === false &&
    directoryBoundary.published_contact_rows_without_consent_exposure > 0
  : directoryBoundary?.status === "PASS"
    ? directoryBoundary.live_function?.exact_source_match === true &&
      directoryBoundary.live_function?.complete_bundle_match === true &&
      directoryBoundary.live_function?.required_files_present === true &&
      (directoryBoundary.live_function?.missing_live_files?.length ?? 0) === 0 &&
      directoryBoundary.consent_table_exists === true &&
      directoryBoundary.consent_table?.exists === true &&
      directoryBoundary.public_get_contact_fields_consent_scoped === true &&
      directoryBoundary.published_contact_rows_without_consent_exposure === 0 &&
      directoryBoundary.anonymous_contract_tests === "PASS" &&
      directoryBoundary.owner_consent_grant_revoke_tests === "PASS" &&
      directoryBoundary.registry_outage_fail_closed === true
    : false;

const syntheticConsentRows = Array.from({ length: 2205 }, (_, index) => ({
  listing_id: `listing-${String(index).padStart(4, "0")}`,
}));
let pageCalls = 0;
const completeConsentLookup = await collectActiveAddressConsentIds(async (offset, pageSize) => {
  pageCalls += 1;
  // Simulate a PostgREST max_rows cap of 400, lower than the requested page size.
  return { data: syntheticConsentRows.slice(offset, offset + Math.min(pageSize, 400)), error: null };
});
assert.equal(completeConsentLookup.ready, true);
assert.equal(completeConsentLookup.ids.length, 2205, "all consented listings must be collected beyond 1,000 rows");
assert.equal(pageCalls, 7, "short capped pages must continue until an empty page is observed");

const failedConsentLookup = await collectActiveAddressConsentIds(async (offset) => ({
  data: offset === 0 ? syntheticConsentRows.slice(0, 1000) : null,
  error: offset === 0 ? null : new Error("synthetic registry outage"),
}));
assert.equal(failedConsentLookup.ready, false, "registry failure must fail closed");
assert.deepEqual(failedConsentLookup.ids, [], "partial consent results must never be used after a page failure");

const thrownConsentLookup = await collectActiveAddressConsentIds(async (offset) => {
  if (offset === 0) return { data: syntheticConsentRows.slice(0, 1000), error: null };
  throw new Error("synthetic network failure");
});
assert.equal(thrownConsentLookup.ready, false,
  "thrown network/runtime errors must fail closed");
assert.deepEqual(thrownConsentLookup.ids, [],
  "partial address consent IDs must be discarded after a thrown fetch error");

const malformedConsentLookup = await collectActiveAddressConsentIds(async () => ({ data: null, error: null }));
assert.equal(malformedConsentLookup.ready, false, "malformed registry responses must fail closed");
assert.deepEqual(malformedConsentLookup.ids, [], "malformed registry responses must not yield partial consent IDs");

const contactScopes = ["PHONE", "SECONDARY_PHONE", "ADDRESS", "PRECISE_LOCATION"];
const syntheticContactRows = Array.from({ length: 2205 }, (_, index) => ({
  listing_id: `listing-${String(Math.floor(index / 4)).padStart(4, "0")}`,
  scope: contactScopes[index % 4],
}));
const requestedListingIds = Array.from({ length: 600 }, (_, index) =>
  `listing-${String(index).padStart(4, "0")}`);
let contactPageCalls = 0;
const completeContactLookup = await collectActiveContactConsentScopes(
  [...requestedListingIds, requestedListingIds[0]],
  async (offset, pageSize, ids) => {
    contactPageCalls += 1;
    assert.equal(ids.length, 600, "listing IDs must be deduplicated before querying");
    return {
      data: syntheticContactRows.slice(offset, offset + Math.min(pageSize, 400)),
      error: null,
    };
  },
);
assert.equal(completeContactLookup.ready, true);
assert.equal(completeContactLookup.scopes.size, 552,
  "all returned listing consent groups must be collected across capped pages");
assert.deepEqual(
  [...completeContactLookup.scopes.get("listing-0000")].sort(),
  [...contactScopes].sort(),
  "all four independent scopes must survive pagination",
);
assert.equal(contactPageCalls, 7,
  "short capped consent pages must continue until an empty page is observed");

const failedContactLookup = await collectActiveContactConsentScopes(
  requestedListingIds,
  async (offset) => ({
    data: offset === 0 ? syntheticContactRows.slice(0, 400) : null,
    error: offset === 0 ? null : new Error("synthetic registry outage"),
  }),
);
assert.equal(failedContactLookup.ready, false,
  "contact consent lookup must fail closed after any page error");
assert.equal(failedContactLookup.scopes.size, 0,
  "partial contact consent rows must be discarded after a later page error");

const thrownContactLookup = await collectActiveContactConsentScopes(
  requestedListingIds,
  async (offset) => {
    if (offset === 0) return { data: syntheticContactRows.slice(0, 400), error: null };
    throw new Error("synthetic contact registry network failure");
  },
  400,
);
assert.equal(thrownContactLookup.ready, false,
  "thrown contact-consent network/runtime errors must fail closed");
assert.equal(thrownContactLookup.scopes.size, 0,
  "partial contact consent scopes must be discarded after a thrown fetch error");

const malformedContactLookup = await collectActiveContactConsentScopes(
  requestedListingIds,
  async () => ({ data: null, error: null }),
);
assert.equal(malformedContactLookup.ready, false,
  "malformed contact consent pages must fail closed");
assert.equal(malformedContactLookup.scopes.size, 0,
  "malformed contact consent pages must not produce partial scopes");

let emptyContactFetchCalls = 0;
const emptyContactLookup = await collectActiveContactConsentScopes([], async () => {
  emptyContactFetchCalls += 1;
  return { data: [], error: null };
});
assert.equal(emptyContactLookup.ready, true);
assert.equal(emptyContactLookup.scopes.size, 0);
assert.equal(emptyContactFetchCalls, 0, "empty listing sets must not query the consent registry");


const row = {
  id: "listing-1",
  display_name: "Synthetic provider",
  phone: "01000000000",
  secondary_phone: "02000000000",
  address: "Synthetic exact address",
  governorate: "Gharbia",
  district: "Tanta",
  village: "Synthetic village",
  metadata: {
    bio: "Public profile summary",
    google_maps_url: "https://www.google.com/maps?q=30.7,31.0",
    websiteUrl: "https://example.test",
  },
};

const hidden = sanitizePublicDirectoryListing(row);
assert.equal(Object.hasOwn(hidden, "phone"), false, "phone must be hidden without explicit consent");
assert.equal(Object.hasOwn(hidden, "secondary_phone"), false, "secondary phone must be hidden without explicit consent");
assert.equal(Object.hasOwn(hidden, "address"), false, "exact address must be hidden without explicit consent");
assert.equal(Object.hasOwn(hidden.metadata, "google_maps_url"), false, "precise map link must be hidden without consent");
assert.equal(hidden.governorate, "Gharbia", "coarse governorate remains public");
assert.equal(hidden.district, "Tanta", "coarse district remains public");
assert.equal(hidden.display_name, row.display_name, "public listing identity remains intact");

const phoneOnly = sanitizePublicDirectoryListing(row, new Set(["PHONE"]));
assert.equal(phoneOnly.phone, row.phone);
assert.equal(Object.hasOwn(phoneOnly, "secondary_phone"), false);
assert.equal(Object.hasOwn(phoneOnly, "address"), false);
assert.equal(Object.hasOwn(phoneOnly.metadata, "google_maps_url"), false);

const addressOnly = sanitizePublicDirectoryListing(row, new Set(["ADDRESS"]));
assert.equal(addressOnly.address, row.address);
assert.equal(Object.hasOwn(addressOnly, "phone"), false);
assert.equal(Object.hasOwn(addressOnly.metadata, "google_maps_url"), false);

const preciseOnly = sanitizePublicDirectoryListing(row, new Set(["PRECISE_LOCATION"]));
assert.equal(preciseOnly.metadata.google_maps_url, row.metadata.google_maps_url);
assert.equal(Object.hasOwn(preciseOnly, "address"), false);

const all = sanitizePublicDirectoryListing(row, new Set(["PHONE", "SECONDARY_PHONE", "ADDRESS", "PRECISE_LOCATION"]));
assert.equal(all.phone, row.phone);
assert.equal(all.secondary_phone, row.secondary_phone);
assert.equal(all.address, row.address);
assert.equal(all.metadata.google_maps_url, row.metadata.google_maps_url);

const publicSearch = buildDirectoryPaginationOrFilter("01000000000", null) || "";
assert.equal(/phone|secondary_phone|address/i.test(publicSearch), false, "free-text public search must not probe hidden contact fields");

const checks = [
  ["free-text search excludes private phone and address fields", !["phone", "secondary_phone", "address"].some((field) => pagination.includes('"' + field + '"')) && !/phone|secondary_phone|address/i.test(publicSearch)],
  ["address-specific search requires an active ADDRESS consent record", source.includes('eq("scope", "ADDRESS")') && source.includes('is("revoked_at", null)') && source.includes("addressVisibleIds")],
  ["address search paginates the entire consent registry instead of truncating at the first 1000 records",
    source.includes("loadAddressConsentListingIds") &&
    source.includes('.order("listing_id", { ascending: true })') &&
    source.includes(".range(offset, offset + pageSize - 1)") &&
    !source.includes('.is("revoked_at", null).limit(1000)')],
  ["address consent pagination continues across server-capped short pages and fails closed on registry errors",
    source.includes("collectActiveAddressConsentIds") &&
    consentPagination.includes("offset += rows.length")],
  ["all public GET paths use consent-aware sanitization and never return raw rows",
    (source.match(/sanitizePublicDirectoryListing\(/g) || []).length >= 3 &&
    !source.includes("...publicRow, is_verified") &&
    !source.includes("listing: { ...publicListing")],
  ["GET consent lookup fails closed and is used for slug, legacy and paginated reads",
    source.includes("loadContactConsentScopes") && source.includes("directory_listing_contact_consents") &&
    source.includes("sanitizePublicDirectoryListing(data, ownerAccess.contactScopes)") &&
    source.includes("can_edit: ownerAccess.canEdit") &&
    source.includes("consentState.scopes.get(String(row.id)) || new Set<string>()")],
  ["all active contact-consent scopes are paginated in stable listing/scope order",
    source.includes("collectActiveContactConsentScopes") &&
    source.includes('.order("listing_id", { ascending: true })') &&
    source.includes('.order("scope", { ascending: true })') &&
    source.includes(".range(offset, offset + pageSize - 1)")],
  ["contact-consent lookup discards partial pages and fails closed on registry errors",
    source.includes("if (!result.ready)") &&
    source.includes("partial consent pages must never enable contact disclosure")],
  ["owner edit and consent controls fail closed when the registry is unavailable",
    source.includes("resolveDirectoryOwnerAccess(isOwner, consentState.ready, activeScopes)") &&
    source.includes("can_edit: ownerAccess.canEdit") &&
    source.includes("contact_consent_ready: consentState.ready") &&
    ui.includes("detail.contact_consent_ready === false")],
  ["directory-listings public JWT boundary is explicitly configured",
    /\[functions\.directory-listings\]\s*verify_jwt\s*=\s*false/.test(config)],
  ["exact-address filter requires ready ADDRESS consent IDs and fails closed",
    source.includes("loadAddressConsentListingIds()") &&
    source.includes("if (!addressConsentState.ready)") &&
    source.includes('.in("id", addressVisibleIds).ilike("address"')],
  ["full-production gate requires exact directory Edge parity and consent proof",
    releaseContract.includes('"directory-listings"') &&
    releaseContract.includes('directoryContact?.status === "PASS"') &&
    releaseContract.includes("complete_bundle_match === true") &&
    releaseContract.includes("required_files_present === true") &&
    releaseContract.includes("published_contact_rows_without_consent_exposure === 0")],
  ["live reconciliation manifest accurately records blocked or verified directory consent evidence",
    directoryBoundaryEvidenceValid],
  ["POST consent actions verify a real non-anonymous Supabase user and bind actor to auth.uid",
    source.includes("service.auth.getUser(token)") &&
    source.includes("userError || !user || user.is_anonymous") &&
    source.includes("consented_by: user.id") &&
    source.includes("revoked_by: user.id")],
  ["only a claimed listing owner or active business owner can change consent",
    source.includes('action === "SET_PUBLIC_CONTACT_CONSENT"') &&
    source.includes('listing.claim_status !== "CLAIMED"') &&
    source.includes('listing.claimed_user_id') &&
    source.includes('in("role", ["BUSINESS_OWNER", "OWNER"])')],
  ["consent is explicit, scope-specific, versioned and revocable",
    source.includes("consented_by: user.id") &&
    source.includes('consent_version: "directory-contact-v1-2026-11-18"') &&
    source.includes("revoked_by: user.id") &&
    source.includes("OWNER_WITHDREW_CONSENT")],
  ["registry is forced-RLS and inaccessible to browser roles",
    migration.includes("ENABLE ROW LEVEL SECURITY") &&
    migration.includes("FORCE ROW LEVEL SECURITY") &&
    migration.includes("REVOKE ALL ON TABLE") &&
    migration.includes("GRANT SELECT, INSERT, UPDATE")],
  ["owner UI offers separate contact and precise-location controls",
    ui.includes("موافقة عرض بيانات التواصل للجمهور") &&
    ["PHONE", "SECONDARY_PHONE", "ADDRESS", "PRECISE_LOCATION"].every((scope) => ui.includes(scope))],
  ["client action calls the authenticated directory Edge Function",
    client.includes("SET_PUBLIC_CONTACT_CONSENT") &&
    client.includes("setPublicDirectoryListingContactConsent")],
  ["consent POST authenticates before dispatching any privileged action",
    source.indexOf('service.auth.getUser(token)') >= 0 &&
    source.indexOf('service.auth.getUser(token)') < source.indexOf('if (action === "SET_PUBLIC_CONTACT_CONSENT")')],
  ["consent input rejects unknown scopes and non-boolean enabled values",
    source.includes('new Set(["PHONE", "SECONDARY_PHONE", "ADDRESS", "PRECISE_LOCATION"])') &&
    source.includes('typeof enabled !== "boolean"') &&
    source.includes('INVALID_CONTACT_CONSENT')],
  ["consent cannot be granted for an unclaimed or unpublished listing",
    source.includes('listing.claim_status !== "CLAIMED"') &&
    source.includes('(enabled && listing.listing_status !== "PUBLISHED")')],
  ["owner authorization is bound to the authenticated user and exact claimed business",
    source.includes('String(listing.claimed_user_id || "") === String(user.id)') &&
    source.includes('.eq("business_id", listing.claimed_business_id)') &&
    source.includes('.eq("user_id", user.id)') &&
    source.includes('.eq("status", "ACTIVE")') &&
    source.includes('.in("role", ["BUSINESS_OWNER", "OWNER"])')],
  ["branch-scoped memberships cannot inspect or change business-level contact consent",
    (source.match(/\\.is\\("branch_id", null\\)/g) || []).length === 2],
  ["consent grant ignores caller-supplied actor identity and persists auth.uid-derived user.id",
    source.includes("consented_by: user.id") &&
    !source.includes("consented_by: body.") &&
    !source.includes("consented_by: String(body.")],
  ["repeated grants are idempotent and concurrent unique-index conflicts do not fail open",
    source.includes('if (existing) return out(origin, { success: true, scope, enabled: true, unchanged: true })') &&
    source.includes('if (insertError.code === "23505") return out(origin, { success: true, scope, enabled: true, unchanged: true })')],
  ["revocation is owner-only, scope-bound, active-row-only and retains revocation attribution",
    source.includes('.update({') &&
    source.includes('revoked_by: user.id') &&
    source.includes('revoked_at: new Date().toISOString()') &&
    source.includes('revocation_reason: "OWNER_WITHDREW_CONSENT"') &&
    source.includes('.eq("listing_id", listingId).eq("scope", scope).is("revoked_at", null)')],
];
for (const [name, ok] of checks) {
  console.log((ok ? "PASS " : "FAIL ") + name);
}
assert.equal(checks.every(([, ok]) => ok), true, "Directory contact consent source contract failed");
console.log("DIRECTORY_CONTACT_CONSENT=" + (checks.length + 8) + "/" + (checks.length + 8) + " PASS");
