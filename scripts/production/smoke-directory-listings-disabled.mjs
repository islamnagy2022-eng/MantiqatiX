import assert from "node:assert/strict";

const siteOrigin = "https://islamnagy2022-eng.github.io";
const siteConfigUrl = siteOrigin + "/MantiqatiX/config.js";
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
const headers = {
  apikey: supabaseKey,
  accept: "application/json",
  origin: siteOrigin,
};

const getResponse = await fetch(endpoint, {
  headers,
  cache: "no-store",
  signal: AbortSignal.timeout(responseTimeoutMs),
});
assert.equal(getResponse.status, 200, "Public listing reads must preserve the empty-success response contract");
assert.equal(getResponse.headers.get("access-control-allow-origin"), siteOrigin);
const bodyText = await getResponse.text();
const body = JSON.parse(bodyText);
assert.deepEqual(body.listings, []);
assert.equal(body.pageSize, 0);
assert.equal(body.hasMore, false);
assert.equal(body.nextCursor, null);
assert.equal(body.directoryDisabled, true);
assert.ok(!/"?(?:phone|secondary_phone|address|display_name)"?\s*:/.test(bodyText), "Disabled endpoint must not expose directory contact fields");

const postResponse = await fetch(endpoint, {
  method: "POST",
  headers: { ...headers, "content-type": "application/json" },
  body: JSON.stringify({ action: "CLAIM_SUBMIT", listingId: "disabled-v1" }),
  cache: "no-store",
  signal: AbortSignal.timeout(responseTimeoutMs),
});
assert.equal(postResponse.status, 503, "Unclaimed directory mutations must remain disabled in V1");
assert.equal((await postResponse.json()).error, "DIRECTORY_LISTINGS_DISABLED_FOR_V1");

const preflight = await fetch(endpoint, {
  method: "OPTIONS",
  headers: { origin: siteOrigin, "access-control-request-method": "GET" },
  signal: AbortSignal.timeout(responseTimeoutMs),
});
assert.equal(preflight.status, 200, "CORS preflight should remain available for the disabled endpoint");

console.log("DIRECTORY_LISTINGS_EMPTY_READ_V1=PASS; GET=200_EMPTY; POST=503; CORS=PASS; contact_data_returned=false");
