import fs from "node:fs";
import assert from "node:assert/strict";

const edge = fs.readFileSync("supabase/functions/public-catalog-directory/index.ts", "utf8");
const helper = fs.readFileSync("supabase/functions/_shared/public-directory-pagination.mjs", "utf8");
const client = fs.readFileSync("apps/catalog-frontend/src/lib/production.ts", "utf8");
const context = fs.readFileSync("apps/catalog-frontend/src/context/AppContext.tsx", "utf8");
const view = fs.readFileSync("apps/catalog-frontend/src/components/DirectoryView.tsx", "utf8");

assert.match(edge, /PUBLIC_DIRECTORY_PAGE_SIZE/);
assert.match(edge, /hashDirectoryScope/);
assert.match(edge, /verifyDirectoryCursor\(rawCursor/);
assert.match(edge, /issueDirectoryCursor\(/);
assert.match(edge, /\.order\("id", \{ ascending: true \}\)/);
assert.match(edge, /\.gt\("id", scanAfterId\)/);
assert.match(edge, /\.lte\("created_at", snapshotAt\)/);
assert.match(edge, /\.limit\(scanBatchSize\)/);
assert.match(edge, /matchesDirectoryBusinessFilters\(business, provider, filters\)/);
assert.match(edge, /\.select\(["\']business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured,specialties["\']\)/, "Canonical provider specialties must be selected before Specialty matching");
assert.match(edge, /itemQuery\(\)\.is\("branch_id", null\)/, "Global catalog items must use a parameterized null-branch filter");
assert.match(edge, /itemQuery\(\)\.eq\("branch_id", branchId\)/, "Branch catalog items must use a parameterized equality filter");
assert.match(edge, /priceQuery\(\)\.is\("branch_id", null\)/, "Global prices must use a parameterized null-branch filter");
assert.match(edge, /priceQuery\(\)\.eq\("branch_id", branchId\)/, "Branch prices must use a parameterized equality filter");
assert.doesNotMatch(edge, /\.or\(\x60branch_id\.is\.null,branch_id\.eq\.\$\{branchId\}\x60\)/, "Do not interpolate branch IDs into PostgREST OR expressions");
assert.match(edge, /pagination: \{ pageSize: PUBLIC_DIRECTORY_PAGE_SIZE, hasMore, nextCursor \}/);
assert.match(edge, /DIRECTORY_SCAN_LIMIT_EXCEEDED/);
assert.match(edge, /getExplicitPublicContact\(profile,\s*branch\)/);
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
assert.match(client, /for \(const key of \['activity', 'specialty', 'governorate', 'markaz', 'village', 'query'\] as const\)/);
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
assert.match(view, /loadMoreScopedDirectoryBusinesses/, "Filtered activity searches must have a cursor-backed load-more action.");
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

console.log("PUBLIC_DIRECTORY_KEYSET_STATIC=PASS (39 assertions)");
