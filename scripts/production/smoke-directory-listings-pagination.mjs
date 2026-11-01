import assert from "node:assert/strict";

const siteConfigUrl = "https://islamnagy2022-eng.github.io/MantiqatiX/config.js";
const siteOrigin = "https://islamnagy2022-eng.github.io";
const responseTimeoutMs = 15000;

const configResponse = await fetch(siteConfigUrl, {
  headers: { accept: "text/javascript" },
  signal: AbortSignal.timeout(responseTimeoutMs),
});
assert.equal(configResponse.status, 200, "Published catalog config.js must be reachable");
const configText = await configResponse.text();
const supabaseUrl = configText.match(/supabaseUrl:\s*'([^']+)'/)?.[1];
const supabaseKey = configText.match(/supabaseKey:\s*'([^']+)'/)?.[1];
assert.ok(supabaseUrl, "Published config.js must expose the public Supabase URL");
assert.ok(supabaseKey, "Published config.js must expose the public anon/publishable key");

const endpoint = new URL("/functions/v1/directory-listings", supabaseUrl);
const request = async (params) => {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return fetch(url, {
    headers: {
      apikey: supabaseKey,
      accept: "application/json",
      origin: siteOrigin,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(responseTimeoutMs),
  });
};
const json = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`directory-listings returned non-JSON HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
};

const firstResponse = await request({ type: "doctor", limit: 2 });
assert.equal(firstResponse.status, 200, "First public doctor page must return HTTP 200");
assert.equal(
  firstResponse.headers.get("access-control-allow-origin"),
  siteOrigin,
  "Directory CORS must allow the published catalog origin",
);
const first = await json(firstResponse);
assert.ok(Array.isArray(first.listings), "First page must contain a listings array");
assert.equal(first.pageSize, 2, "Server must honor the requested two-row page size");
assert.ok(first.listings.length > 0 && first.listings.length <= 2, "First page must return at most two public rows");
assert.equal(first.hasMore, true, "Production doctor baseline should exercise keyset continuation");
assert.ok(typeof first.nextCursor === "string" && first.nextCursor.length > 0, "First page must return a continuation cursor");

for (const row of first.listings) {
  assert.equal(row.listing_type, "doctor", "The server must apply the type filter before limiting");
  assert.equal(row.listing_status, "PUBLISHED", "Only published rows may be exposed");
  assert.ok(!("claimed_user_id" in row), "Public response must not expose claimed_user_id");
  assert.ok(!("claimed_business_id" in row), "Public response must not expose claimed_business_id");
}

const secondResponse = await request({ type: "doctor", limit: 2, cursor: first.nextCursor });
assert.equal(secondResponse.status, 200, "Cursor continuation must return HTTP 200");
const second = await json(secondResponse);
assert.ok(Array.isArray(second.listings), "Second page must contain a listings array");
assert.equal(second.pageSize, 2, "Cursor continuation must preserve page size");
assert.ok(second.listings.length > 0 && second.listings.length <= 2, "Second page must return at most two rows");
const firstIds = new Set(first.listings.map((row) => row.id));
for (const row of second.listings) {
  assert.equal(row.listing_type, "doctor", "Cursor continuation must preserve the type filter");
  assert.equal(row.listing_status, "PUBLISHED", "Cursor continuation must remain public-only");
  assert.ok(!firstIds.has(row.id), "Cursor continuation must not duplicate a row from page one");
}
console.log(`DIRECTORY_KEYSET_CONTINUATION=PASS; first=${first.listings.length}; second=${second.listings.length}`);

const invalidLimit = await request({ type: "doctor", limit: 0 });
assert.equal(invalidLimit.status, 400, "Invalid page limits must be rejected with HTTP 400");
assert.equal((await json(invalidLimit)).error, "INVALID_PAGE_LIMIT", "Invalid page limit error code must be stable");

const invalidCursor = await request({ type: "doctor", limit: 2, cursor: "not-a-valid-cursor" });
assert.equal(invalidCursor.status, 400, "Malformed cursors must be rejected with HTTP 400");
assert.equal((await json(invalidCursor)).error, "INVALID_PAGE_CURSOR", "Invalid cursor error code must be stable");
console.log("DIRECTORY_PAGINATION_INVALID_INPUTS=PASS");
console.log("DIRECTORY_PUBLIC_ONLY_AND_CORS=PASS");

const expectedGovernorates = [
  "القاهرة",
  "الجيزة",
  "القليوبية",
  "الإسكندرية",
  "البحيرة",
  "مطروح",
  "كفر الشيخ",
  "الغربية",
  "المنوفية",
  "الدقهلية",
  "دمياط",
  "بورسعيد",
  "الإسماعيلية",
  "السويس",
  "الشرقية",
  "شمال سيناء",
  "جنوب سيناء",
  "بني سويف",
  "الفيوم",
  "المنيا",
  "أسيوط",
  "سوهاج",
  "قنا",
  "الأقصر",
  "أسوان",
  "الوادي الجديد",
  "البحر الأحمر",
];

// Walk every public doctor page to verify the imported national directory is
// actually visible through the same cursor API used by the catalog UI.
const allDoctorIds = new Set();
const doctorsByGovernorate = new Map();
let cursor = null;
let pageCount = 0;
do {
  const pageResponse = await request({ type: "doctor", limit: 100, cursor });
  assert.equal(pageResponse.status, 200, "Every public doctor page must return HTTP 200");
  const page = await json(pageResponse);
  assert.ok(Array.isArray(page.listings), "Every page must return a listings array");
  assert.equal(page.pageSize, 100, "National directory scan must honor the 100-row limit");
  assert.ok(page.listings.length <= 100, "No page may exceed its requested limit");

  for (const row of page.listings) {
    assert.equal(row.listing_type, "doctor", "National scan must preserve the doctor filter");
    assert.equal(row.listing_status, "PUBLISHED", "National scan must expose published rows only");
    assert.ok(row.id, "Every public doctor row must have an ID");
    assert.ok(!allDoctorIds.has(row.id), "Keyset scan must not repeat an ID across pages");
    allDoctorIds.add(row.id);
    const governorate = String(row.governorate || "").trim();
    assert.ok(governorate, "Every imported doctor must retain a governorate value");
    doctorsByGovernorate.set(governorate, (doctorsByGovernorate.get(governorate) || 0) + 1);
    assert.ok(!("claimed_user_id" in row), "Public list rows must not expose claimed_user_id");
    assert.ok(!("claimed_business_id" in row), "Public list rows must not expose claimed_business_id");
  }

  pageCount += 1;
  assert.ok(pageCount <= 20, "National doctor pagination exceeded the safety page cap");
  if (page.hasMore === true) {
    assert.ok(typeof page.nextCursor === "string" && page.nextCursor.length > 0, "A page with more rows must include a cursor");
    cursor = page.nextCursor;
  } else {
    assert.equal(page.nextCursor, null, "The final page must not advertise another cursor");
    cursor = null;
  }
} while (cursor);

assert.ok(allDoctorIds.size >= 450, "Public directory must expose the verified 450-record baseline or more");
const missingGovernorates = expectedGovernorates.filter((name) => !doctorsByGovernorate.has(name));
assert.deepEqual(missingGovernorates, [], "All 27 Egyptian governorates must appear in the public doctor directory");
console.log(
  "DIRECTORY_NATIONAL_DOCTOR_COVERAGE=PASS; " +
  "records=" + allDoctorIds.size +
  "; governorates=" + doctorsByGovernorate.size +
  "; pages=" + pageCount,
);

