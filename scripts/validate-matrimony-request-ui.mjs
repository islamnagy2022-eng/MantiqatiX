import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("web/operations-modules.js", "utf8");
const index = fs.readFileSync("web/index.html", "utf8");
assert.match(source, /'الزواج':\{key:'MARRIAGE',tabs:\['live'\],tables:\['matrimony_profiles','matrimony_requests'\]/, "matrimony UI must not query contact-unlock table directly");
assert.match(source, /sb\.rpc\('matrimony_discover_profiles_backend'/, "discovery must use allowlisted backend RPC");
assert.match(source, /sb\.rpc\('matrimony_create_request_backend'/, "request creation must use trusted RPC");
assert.match(source, /sb\.rpc\('matrimony_respond_request_backend'/, "request decisions must use trusted RPC");
assert.match(source, /sb\.rpc\('matrimony_unlock_contact_backend'/, "contact unlock must use trusted RPC");
assert.match(source, /sb\.rpc\('matrimony_get_unlocked_contact_backend'/, "contact retrieval must use trusted RPC");
assert.doesNotMatch(source, /sb\.from\(['"]matrimony_contact_unlocks['"]\)/, "browser must not read contact-unlock rows directly");
assert.doesNotMatch(source, /sb\.from\(['"]matrimony_requests['"]\)\.(insert|update|upsert|delete)\s*\(/i, "browser must not mutate request rows directly");
assert.match(source, /data-matrimony-respond/, "incoming requests must expose accept/reject actions");
assert.match(source, /rows\.matrimony_unlocked_contacts\[requestId\]/, "revealed contacts should remain in-memory only");
assert.match(index, /operations-modules\.js\?v=mnty118/, "operations module cache key must be refreshed");

console.log("Matrimony request UI backend-boundary contract: PASS");
