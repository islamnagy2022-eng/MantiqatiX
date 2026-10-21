import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("supabase/functions/catalog-admin/index.ts", "utf8");

assert.match(source, /const allowedOrigin = "https:\/\/islamnagy2022-eng\.github\.io"/, "only the production GitHub Pages origin should be allowed");
assert.doesNotMatch(source, /["']Access-Control-Allow-Origin["']\s*:\s*["']\*["']/, "wildcard CORS must not return");
assert.match(source, /["']Access-Control-Allow-Origin["']\s*:\s*allowedOrigin/, "CORS must use the exact allowlisted origin");
assert.match(source, /["']Access-Control-Allow-Headers["']\s*:\s*["']authorization, x-client-info, apikey, content-type["']/, "required Supabase request headers must remain allowed");
assert.match(source, /["']Access-Control-Allow-Methods["']\s*:\s*["']POST, OPTIONS["']/, "only POST and preflight should be allowed");
assert.match(source, /["']Vary["']\s*:\s*["']Origin["']/, "cache behavior must vary by origin");
assert.match(source, /const origin = req\.headers\.get\("Origin"\);[\s\S]*?if \(origin && origin !== allowedOrigin\)[\s\S]*?ORIGIN_NOT_ALLOWED[\s\S]*?if \(req\.method === "OPTIONS"\)/, "reject disallowed browser origins before preflight or request routing");
assert.match(source, /if \(req\.method !== "POST"\)/, "non-POST requests must remain rejected");
assert.match(source, /await client\.auth\.getUser\(auth\.slice\(7\)\)/, "bearer token must still be verified");
assert.match(source, /user\.is_anonymous/, "anonymous sessions must remain rejected");
assert.match(source, /if \(!tenantId \|\| !businessId\)/, "tenant and business identifiers remain mandatory");
assert.match(source, /upsert_catalog_item_backend/);
assert.match(source, /upsert_catalog_price_backend/);
assert.match(source, /upsert_catalog_settings_backend/);

assert.match(source, /catch\(e\)\{return new Response\(JSON\.stringify\(\{error:"CATALOG_OPERATION_FAILED"\}\),\{status:400,headers:cors\}\);\}/, "catalog operations must return a stable public error code");
assert.doesNotMatch(source, /e instanceof Error\?e\.message/, "catalog operations must not expose raw exception messages");

console.log("Catalog admin CORS and authorization source contract: PASS");
