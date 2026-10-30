import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const directoryFunction = fs.readFileSync("supabase/functions/public-catalog-directory/index.ts", "utf8");
const catalogFunction = fs.readFileSync("supabase/functions/public-catalog/index.ts", "utf8");
const catalogFrontend = path.resolve("apps/catalog-frontend");
const PUBLIC_PROVIDER_COLUMNS = "business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured";

function providerQueryBlock(source, label) {
  const start = source.indexOf('.from("marketing_provider_profiles")');
  assert.notEqual(start, -1, `${label} must use the provider profile table through its server-side client`);
  const end = source.indexOf(";", start);
  assert.notEqual(end, -1, `${label} provider query must terminate`);
  return source.slice(start, end + 1);
}

function assertServerRole(source, label, keyName) {
  assert.match(source, new RegExp(`${keyName}\\\\s*=\\\\s*Deno\\\\.env\\\\.get\\\\(["']SUPABASE_SERVICE_ROLE_KEY["']\\\\)`),
    `${label} must read the service-role key only inside the Edge Function`);
  assert.match(source, new RegExp(`createClient\\\\([\\\\s\\\\S]{0,240}${keyName}`),
    `${label} must use its server-side service-role client`);
}

function walkFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkFiles(full));
    else if (/\\.(?:ts|tsx|js|jsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

for (const [source, label] of [
  [directoryFunction, "public-catalog-directory"],
  [catalogFunction, "public-catalog"],
]) {
  const query = providerQueryBlock(source, label);
  assert.ok(query.includes(`.select("${PUBLIC_PROVIDER_COLUMNS}")`),
    `${label} must request only the approved public provider columns`);
  assert.match(query, /\\.eq\\(["']status["']\\s*,\\s*["']ACTIVE["']\\)/,
    `${label} must expose active provider profiles only`);
  assert.doesNotMatch(query, /owner_user_id|settings|select\\(["']\\*["']\\)/i,
    `${label} must not read owner UUID, private profile settings, or wildcard profile columns`);
}

assertServerRole(directoryFunction, "public-catalog-directory", "serviceKey");
assertServerRole(catalogFunction, "public-catalog", "serviceRoleKey");

// Responses must be deliberate public projections, never raw provider/profile rows.
assert.match(directoryFunction, /provider:\\s*\\{\\s*kind:/,
  "public-catalog-directory must map the provider response into an explicit public object");
assert.match(catalogFunction, /provider:\\s*\\{/,
  "public-catalog must map the provider response into an explicit public object");
assert.doesNotMatch(
  directoryFunction.slice(directoryFunction.indexOf("const buildPublicBusiness"), directoryFunction.lastIndexOf("return response")),
  /owner_user_id|provider\\.settings|\\.settings.*provider/i,
  "public-catalog-directory must not serialize private provider ownership/settings"
);
assert.doesNotMatch(
  catalogFunction.slice(catalogFunction.indexOf("const profile ="), catalogFunction.lastIndexOf("return response")),
  /owner_user_id|provider\\.settings|\\.settings.*provider/i,
  "public-catalog must not serialize private provider ownership/settings"
);

// The primary catalog frontend must call the curated Edge Functions rather than
// reading the base provider profile table using its public Supabase key.
const frontendFiles = walkFiles(catalogFrontend);
assert.ok(frontendFiles.length > 0, "primary catalog frontend source files must be present");
const frontendSource = frontendFiles.map((file) => fs.readFileSync(file, "utf8")).join("\\n");
assert.match(frontendSource, /public-catalog-directory/,
  "primary catalog must use the curated public directory Edge Function");
assert.match(frontendSource, /public-catalog/,
  "primary catalog must use the curated public business catalog Edge Function");
assert.doesNotMatch(frontendSource, /marketing_provider_profiles/,
  "primary catalog frontend must not query the provider profile base table directly");

console.log("Public marketing provider exposure contract passed: server-side service-role access, active-only explicit field projection, no owner_user_id/settings in public responses, and primary frontend uses curated Edge Functions.");
console.log("Database anon table grants remain a separate migration/release item; this source contract does not claim to remove direct PostgREST access.");
