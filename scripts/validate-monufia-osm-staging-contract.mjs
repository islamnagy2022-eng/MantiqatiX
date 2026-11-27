import fs from 'node:fs';
import assert from 'node:assert/strict';

const script = fs.readFileSync('scripts/prepare-monufia-osm-candidates.mjs', 'utf8');
const query = fs.readFileSync('scripts/queries/monufia-overpass.ql', 'utf8');
const workflow = fs.readFileSync('.github/workflows/menoufia-osm-candidate-extract.yml', 'utf8');
const docs = fs.readFileSync('docs/release/MENOUFIA_OSM_ODBL_STAGING_2026-11-27.md', 'utf8');
const taxonomy = fs.readFileSync('apps/catalog-frontend/src/data/productionDefaults.ts', 'utf8');

for (const match of script.matchAll(/groupId:'([^']+)', code:'([^']+)'/g)) {
  assert.ok(
    taxonomy.includes("s('" + match[1] + "','" + match[2] + "'"),
    'OSM mapping must use an existing canonical activity category: ' + match[1] + '/' + match[2],
  );
}

for (const value of ['3824207','ODbL-1.0','UNVERIFIED','DRAFT','UNCLAIMED','public_enabled: false','publishable: false','contact_consent_status','taxonomyReviewRequired']) {
  assert.ok(script.includes(value), 'Candidate script must preserve ' + value);
}
for (const forbidden of ['phone:', 'email:', 'website:', 'ownerWhatsApp:', 'address:']) {
  assert.equal(script.includes(forbidden), false, 'Candidate output must not add contact field ' + forbidden);
}
assert.ok(query.includes('rel(3824207)'), 'Overpass query must use the verified Monufia relation.');
assert.ok(query.includes('map_to_area'), 'Overpass query must use the administrative relation area.');
assert.ok(workflow.includes('types: [opened, synchronize, reopened]'), 'Static contracts must rerun on open, synchronize and explicit reopen events.');
assert.ok(workflow.includes('retention-days: 14'), 'Candidate artifact retention must be short and explicit.');
assert.ok(workflow.includes('No fallback scraping or alternate directory source will be attempted.'), 'Source failure must never trigger unlicensed fallback scraping.');
assert.ok(docs.includes('ODbL 1.0') && docs.includes('© OpenStreetMap contributors'), 'License and attribution obligations must be explicit.');
assert.ok(script.includes("!classification.taxonomyReviewRequired"), 'Taxonomy-review flags must prevent uncertain classifications entering the mapped candidate list.');
assert.ok(script.includes("suggested_activity_category_code"), 'Uncertain classifications may retain a suggestion separately from accepted taxonomy IDs.');
assert.ok(!script.includes("value:'company', groupId:"), 'Generic office=company tags must not be forced into a taxonomy category.');
assert.ok(!script.includes("value:'estate_agent', groupId:"), 'Estate-agent tags must remain in human taxonomy review until a suitable canonical category exists.');
assert.ok(workflow.includes('types: [opened, synchronize, reopened]'), 'Static contracts must rerun when the PR opens, changes or reopens.');
assert.ok(workflow.includes("github.event.action == 'opened' || github.event.action == 'reopened'"), 'The external OSM data fetch must run only on the initial open or an explicit reopen.');
assert.ok(workflow.includes('node scripts/validate-monufia-osm-staging-contract.mjs'), 'The staging contract validator must run in CI.');
assert.ok(script.includes('extractionApiUrl'), 'The manifest must preserve the actual source endpoint used.');
assert.ok(workflow.includes('https://ovp.dresel.systems/api-af/interpreter'), 'The workflow must include the public Africa-region Overpass fallback.');
assert.ok(workflow.includes('https://overpass.private.coffee/api/interpreter'), 'The workflow must include the documented public Overpass fallback.');
assert.ok(workflow.includes('--output /tmp/monufia-osm-candidates \\\n            --source-endpoint'), 'The actual responding endpoint must be passed to the extractor as a continued command.');

console.log('MENOUFIA_OSM_ODBL_STAGING=PASS');
console.log('PUBLICATION=DISABLED; PRODUCTION_WRITES=NONE; CONTACT_FIELDS=EXCLUDED');
