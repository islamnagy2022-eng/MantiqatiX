import fs from "node:fs";
import assert from "node:assert/strict";

const edge = fs.readFileSync("supabase/functions/directory-listings/index.ts", "utf8");
const helper = fs.readFileSync("supabase/functions/directory-listings/platform-admin-registry.mjs", "utf8");
const tests = fs.readFileSync("supabase/functions/directory-listings/platform-admin-registry.test.mjs", "utf8");

assert.ok(edge.includes('from "./platform-admin-registry.mjs"'), "directory Edge Function must import the registry contract");
assert.ok(edge.includes('userClient.rpc("mnty_can_platform_admin")'), "global admin route must call the protected registry RPC using the caller JWT");
assert.ok(edge.includes("Authorization: `Bearer ${token}`"), "registry RPC client must carry the verified caller JWT");
assert.ok(edge.includes("resolveDirectoryPlatformAdmin(memberships, registryResult, registryError)"), "registry errors and false results must fail closed");
assert.ok(!edge.includes(".some(platformAdmin)"), "legacy membership-only platform admin gate must be removed");
assert.ok(helper.includes("registryResult === true") && helper.includes("!registryError"), "only exact true registry result without error may authorize");
assert.ok(tests.includes("legacy tenant SUPER_ADMIN membership cannot grant platform-root authority"), "negative tenant-admin regression must be covered");
assert.ok(tests.includes("RPC errors") && tests.includes("inactive membership"), "RPC error and inactive membership failures must be covered");
assert.ok(edge.includes('if (req.method === "GET")'), "public GET route must remain available");
assert.ok(edge.includes('if (userError || !user || user.is_anonymous)'), "manual bearer verification and anonymous-user rejection must remain");
console.log("Directory platform-admin registry contract: PASS");
