import fs from "node:fs";
import assert from "node:assert/strict";

const edge = fs.readFileSync("supabase/functions/public-catalog-directory/index.ts", "utf8");
const helper = fs.readFileSync("supabase/functions/_shared/public-directory-pagination.mjs", "utf8");
const client = fs.readFileSync("apps/catalog-frontend/src/lib/production.ts", "utf8");
const context = fs.readFileSync("apps/catalog-frontend/src/context/AppContext.tsx", "utf8");
const view = fs.readFileSync("apps/catalog-frontend/src/components/DirectoryView.tsx", "utf8");
const browserE2E = fs.readFileSync("apps/catalog-frontend/tests/professional-dashboard.browser.e2e.mjs", "utf8");

assert.match(edge, /type PublicDirectoryFilters = \{[\s\S]*?area\?: string;[\s\S]*?query\?: string;/);
assert.match(edge, /normalizeDirectoryFilters\(requestUrl\.searchParams\) as PublicDirectoryFilters/);
assert.match(edge, /PUBLIC_DIRECTORY_PAGE_SIZE/);
assert.match(edge, /hashDirectoryScope/);
assert.match(edge, /verifyDirectoryCursor\(rawCursor/);
assert.match(edge, /issueDirectoryCursor\(/);
assert.match(edge, /\.order\("id", \{ ascending: true \}\)/);
assert.match(edge, /\.gt\("id", scanAfterId\)/);
assert.match(edge, /\.lte\("created_at", snapshotAt\)/);
assert.match(edge, /\.limit\(scanBatchSize\)/);
assert.match(edge, /matchesDirectoryBusinessFilters\(business, provider, filters\)/);
assert.match(edge, /matchesDirectoryVerificationPhase\(provider, phase\)/,
  "The server must partition verified and unverified activities before pagination.");
assert.match(edge, /if \(phase === "verified" && exhausted && results.length < PUBLIC_DIRECTORY_PAGE_SIZE \+ 1\)/,
  "The unverified phase must start only after verified activities are exhausted.");
assert.match(edge, /lookaheadPhase: results\[PUBLIC_DIRECTORY_PAGE_SIZE\]\.phase/,
  "The next cursor must account for the phase of the look-ahead result.");
assert.match(helper, /export function matchesDirectoryVerificationPhase/);
assert.match(helper, /export function getNextDirectoryCursorPosition/);
assert.match(helper, /lastPhase === "verified" && lookaheadPhase === "unverified"/,
  "The cursor must start unverified results from the beginning when the page ends with verified records.");
assert.match(edge, /\.select\(["\']business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured["\']\)/, "Directory must use the approved public provider field allowlist");
assert.doesNotMatch(edge, /\.select\(["\'][^"\']*specialties[^"\']*["\']\)/, "Directory must not expand the approved provider field projection with unapproved specialties");
assert.match(edge, /itemQuery\(\)\.is\("branch_id", null\)/, "Global catalog items must use a parameterized null-branch filter");
assert.match(edge, /itemQuery\(\)\.eq\("branch_id", branchId\)/, "Branch catalog items must use a parameterized equality filter");
assert.match(edge, /priceQuery\(\)\.is\("branch_id", null\)/, "Global prices must use a parameterized null-branch filter");
assert.match(edge, /priceQuery\(\)\.eq\("branch_id", branchId\)/, "Branch prices must use a parameterized equality filter");
assert.doesNotMatch(edge, /\.or\(\x60branch_id\.is\.null,branch_id\.eq\.\$\{branchId\}\x60\)/, "Do not interpolate branch IDs into PostgREST OR expressions");
assert.match(edge, /pagination: \{ pageSize: PUBLIC_DIRECTORY_PAGE_SIZE, hasMore, nextCursor \}/);
assert.match(edge, /DIRECTORY_SCAN_LIMIT_EXCEEDED/);
assert.match(edge, /getExplicitPublicContact\(profile,\s*branch\)/);
assert.match(edge, /matchesDirectoryAreaFilter\(publicContact\.address,\s*filters\.area\)/,
  "Area matching must use the exact branch-aware consent projection returned by getExplicitPublicContact.");
assert.ok(
  edge.indexOf("getExplicitPublicContact(profile, branch)") < edge.indexOf("matchesDirectoryAreaFilter(publicContact.address, filters.area)"),
  "Area search must occur after the verified public-contact projection."
);
assert.ok(
  edge.indexOf("matchesDirectoryAreaFilter(publicContact.address, filters.area)") <
    edge.indexOf('db.from("catalog_items")'),
  "Area filtering must happen before loading catalog items and prices for non-matching activities."
);
assert.match(helper, /export function mergePublicDirectoryCatalogItems\(/);
assert.match(edge, /mergePublicDirectoryCatalogItems\(/,
  "Global and branch catalog rows must be merged and sorted together before the 150-item cap.");
assert.match(helper, /export function matchesDirectoryAreaFilter\(publicAddress, area\)/);
assert.match(client, /'village', 'area', 'query'/);
assert.match(edge, /\.select\(["']id,name,code,status,address,phone["']\)/, "Branch contact columns may be read only as inputs to the explicit-consent projection");
const branchProjection = edge.match(/branches:\s*\(branches\s*\|\|\s*\[\]\)\.map\(\(entry:\s*any\)\s*=>\s*\(\{([\s\S]*?)\}\)\)/);
assert.ok(branchProjection, "Directory branches must keep an explicit response projection");
assert.doesNotMatch(branchProjection[1], /\b(phone|address)\s*:/, "Operational branch contacts must never be returned as raw branch fields");
assert.doesNotMatch(edge, /\.range\(/, "Keyset pagination must not use offset ranges");

for (const field of ["activity", "specialty", "governorate", "markaz", "village", "area", "query"]) {
  assert.match(helper, new RegExp(field), `Filter contract must retain ${field}`);
}
assert.match(helper, /MAX_CURSOR_AGE_MS/);
assert.match(helper, /crypto\.subtle\.sign\("HMAC"/);
assert.match(helper, /crypto\.subtle\.verify\("HMAC"/);
assert.match(helper, /scopeHash/);
assert.match(helper, /PUBLIC_DIRECTORY_PAGE_SIZE = PAGE_SIZE/);
assert.match(client, /fetchPublicDirectoryPage\([\s\S]{0,180}cursor\?: string \| null,[\s\S]{0,120}filters: PublicDirectoryPageFilters/);
assert.match(client, /query\.set\('limit', '20'\)/);
assert.match(client, /query\.set\('cursor', cursor\)/);
assert.match(client, /for \(const key of \['activity', 'specialty', 'governorate', 'markaz', 'village', 'area', 'query'\] as const\)/);
assert.match(client, /query\.set\(key, value\.slice\(0, 100\)\)/,
  "Public directory client must pass only bounded, allowlisted search/scope filters.");
const queryProjection = helper.match(/query:\s*\[([\s\S]*?)\]\s*,\s*\};/);
assert.ok(queryProjection, "Free text must match a bounded public business/provider field projection.");
assert.doesNotMatch(queryProjection[1], /phone|ownerWhatsApp|secondary_phone|address/i,
  "Server-side free-text projection must never include consent-gated contacts.");
assert.match(client, /pagination\?\.hasMore === true/);
assert.match(context, /fetchPublicDirectoryPage\(cursor\)/);
assert.match(context, /new Map<string, Business>/);
assert.match(context, /directoryNextCursorRef\.current = page\.nextCursor/);
assert.match(view, /fetchPublicDirectoryPage\(null, filters\)/, "Filtered searches must request a server-side page instead of searching only the first global 20.");
assert.match(view, /filters\.area = selectedAreaFilter/, "Area search must use the consent-scoped server-side filter.");
assert.match(view, /publicDirectoryPageFilters\.query \\|\\| publicDirectoryPageFilters\.area \\? 300 : 0/,
  "Typing free-form area filters must be debounced to avoid a request for every keystroke.");
assert.match(view, /list="directory-area-options"/,
  "Visitors must be able to type any area/address instead of being limited to addresses present in the first 20 activities.");
assert.match(view, /datalist id="directory-area-options"/,
  "Public consent-projected address suggestions must remain available as area-search hints.");
assert.match(view, /loadMoreScopedDirectoryBusinesses/, "Filtered activity searches must have a cursor-backed load-more action.");
const activityModule = fs.readFileSync("apps/catalog-frontend/src/modules/activities/ActivityModuleView.tsx", "utf8");
assert.match(view, /onLoadMoreBusinesses=\{\(\) => \{ void loadMoreScopedDirectoryBusinesses\(\); \}\}/,
  "Activity module must receive cursor-backed business pagination.");
assert.match(activityModule, /hasMoreListings \\|\\| hasMoreBusinesses/,
  "Activity module load-more visibility must include additional registered businesses.");
assert.match(activityModule, /if \(hasMoreBusinesses\) onLoadMoreBusinesses\(\)/,
  "The activity module load-more action must fetch the next registered-business page.");
const activityBusinessSearchStart = activityModule.indexOf("const verifiedBusinesses = businesses.filter");
const activityBusinessSearchEnd = activityModule.indexOf("const visibleListings = listings.filter", activityBusinessSearchStart);
assert.ok(activityBusinessSearchStart >= 0 && activityBusinessSearchEnd > activityBusinessSearchStart,
  "Activity module registered-business search block must exist.");
const activityBusinessSearchBlock = activityModule.slice(activityBusinessSearchStart, activityBusinessSearchEnd);
assert.doesNotMatch(activityBusinessSearchBlock, /business\.phone|business\.ownerWhatsApp/,
  "Activity module free-text search must not inspect consent-gated registered-business contact values.");
const activityListingSearchStart = activityModule.indexOf("const visibleListings = listings.filter");
const activityListingSearchEnd = activityModule.indexOf("const allVisibleBusinesses", activityListingSearchStart);
assert.ok(activityListingSearchStart >= 0 && activityListingSearchEnd > activityListingSearchStart,
  "Activity module public-listing search block must exist.");
const activityListingSearchBlock = activityModule.slice(activityListingSearchStart, activityListingSearchEnd);
assert.doesNotMatch(activityListingSearchBlock, /listing\.phone|listing\.secondary_phone/,
  "Activity module free-text search must not inspect contact values.");

assert.match(view, /directoryHasMoreForView/, "The load-more UI must follow the currently selected global or filtered result set.");
assert.match(view, /directoryProductsForView\.forEach/, "Featured-image ranking must use products from the active directory page set.");
const businessSearchBlockStart = view.indexOf("const filteredBusinesses = businesses.filter");
const businessSearchBlockEnd = view.indexOf("// Public-directory entries and registered businesses", businessSearchBlockStart);
assert.ok(businessSearchBlockStart >= 0 && businessSearchBlockEnd > businessSearchBlockStart, "Public activity search filter block must exist.");
const businessSearchBlock = view.slice(businessSearchBlockStart, businessSearchBlockEnd);
assert.match(businessSearchBlock, /biz\.name, biz\.category, biz\.bio, biz\.governorate, biz\.markaz, biz\.village/,
  "Client search must remain on public profile text.");
assert.doesNotMatch(businessSearchBlock, /biz\.phone|biz\.ownerWhatsApp/,
  "Client free-text search must not inspect consent-gated phone or WhatsApp values.");
assert.match(edge, /\.gt\("id", scanAfterId\)/, "Server scan must use stable ID continuation.");
assert.match(edge, /DIRECTORY_SCAN_LIMIT_EXCEEDED/, "Large scans must fail closed instead of returning silently truncated results.");
assert.match(browserE2E, /fetchLivePublicDirectoryPages/,
  "Live browser fixtures must follow all signed cursor pages when the paginated Edge bundle is deployed.");
assert.match(browserE2E, /e2e-directory-cursor:/,
  "Browser directory mocks must return an explicit continuation cursor.");
assert.match(browserE2E, /directoryPageRequests\[1\]\.cursor/);
assert.match(browserE2E, /directoryPageRequests\[2\]\.cursor/);
assert.match(browserE2E, /directory-progressive-cursor-pagination-20-20-remaining-five/);

console.log("PUBLIC_DIRECTORY_KEYSET_STATIC=PASS");
