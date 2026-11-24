import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edge = readFileSync("supabase/functions/directory-listings/index.ts", "utf8");
const contract = readFileSync("supabase/functions/directory-listings/doctor-publication-contract.mjs", "utf8");
const tests = readFileSync("scripts/production/test-doctor-publication-contract.mjs", "utf8");

assert.match(edge, /from "\.\/doctor-publication-contract\.mjs"/,
  "The deployed Edge entrypoint must import the reviewed doctor publication contract");
assert.match(edge, /\.from\("directory_source_permission_evidence"\)[\s\S]{0,1000}\.eq\("status", "APPROVED"\)[\s\S]{0,300}\.eq\("allows_doctor_profile_republication", true\)[\s\S]{0,300}\.eq\("allows_commercial_republication", true\)[\s\S]{0,300}\.lte\("valid_from", evidenceCheckedAt\)[\s\S]{0,300}\.is\("revoked_at", null\)/,
  "Public GET must read only current approved evidence granting both explicit scopes");
assert.match(edge, /doctorSourceEvidenceReady = !doctorSourceEvidenceError[\s\S]{0,250}doctorSourceEvidenceRows\.length < 1000/,
  "A failed or truncated permission registry read must be detected before filtering");
assert.match(edge, /doctorSourceEvidence = doctorSourceEvidenceReady \? doctorSourceEvidenceRows : null/,
  "Registry failure must pass no evidence to the doctor predicate, which denies doctor rows");
assert.doesNotMatch(edge, /DIRECTORY_SOURCE_RIGHTS_UNAVAILABLE/,
  "A source-rights registry outage must not globally block explicitly allowlisted non-doctor discovery");
assert.match(tests, /registry outage blocks doctor rows but preserves allowlisted non-doctor discovery/,
  "Behavior tests must prove registry outages fail closed for doctors without taking down non-doctor categories");
const getStart = edge.indexOf('if (req.method === "GET")');
const postStart = edge.indexOf('if (req.method !== "POST")', getStart);
assert.ok(getStart !== -1 && postStart > getStart, "GET and POST boundaries must remain explicit");
const getSource = edge.slice(getStart, postStart);
assert.match(getSource, /isDoctorPublicListingAllowed\(data, doctorSourceEvidence\)/,
  "Slug lookup must apply the doctor source-rights check");
assert.match(getSource, /filterPublicDirectoryListingsBySourceRights\(data \|\| \[\], doctorSourceEvidence\)/,
  "Legacy non-paginated list must filter doctor listings");
assert.match(getSource, /scanPublicDirectoryPageWithSourceRights\(/,
  "Keyset pagination must use the bounded source-rights cursor scanner");
assert.match(getSource, /nextCursor = scannedPage\.nextCursor[\s\S]{0,180}encodeDirectoryPaginationCursor/,
  "Pagination cursor must be generated from the last delivered eligible row");
assert.match(getSource, /DIRECTORY_SOURCE_RIGHTS_SCAN_LIMIT/,
  "A bounded scan must fail explicitly instead of silently skipping eligible rows");
assert.match(contract, /evidenceRows:\s*unknown\[\]\s*\|\s*null/,
  "The scanner contract must model the null evidence sentinel used on registry outage");
assert.match(tests, /source-rights registry outage blocks doctor rows but preserves allowlisted non-doctor discovery/,
  "Behavior tests must prove registry outages fail closed for doctors without taking down non-doctor categories");
assert.match(contract, /claiming or ownership[\s\S]{0,240}source republication permission|owner claim alone never waives that requirement/i,
  "Claim ownership must not bypass the separate source-republication requirement");
assert.match(contract, /separatelyGovernedNonDoctorTypes = new Set\(/,
  "Non-doctor publication must use an explicit, separate activity-type allowlist");
assert.match(contract, /Unknown or missing listing types are not eligible/,
  "Unknown listing types must fail closed rather than bypass the doctor source-rights gate");
assert.match(contract, /isCurrentDoctorRepublicationEvidence\(/,
  "Doctor publication must reuse the exact source/host/scope/date/revocation validator");
assert.match(tests, /approved exact-host and exact-source match|current exact-host/i,
  "Behavior tests must cover evidence-qualified publication");
assert.match(tests, /cursor scan fills a page beyond blocked doctor rows/i,
  "Behavior tests must cover pagination after source-rights filtering");

console.log("Directory doctor source-publication contract validation passed.");
