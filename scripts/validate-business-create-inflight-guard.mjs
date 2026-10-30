import assert from 'node:assert/strict';
import fs from 'node:fs';

const context = fs.readFileSync('apps/catalog-frontend/src/context/AppContext.tsx', 'utf8');
const admin = fs.readFileSync('supabase/functions/catalog-platform-admin/index.ts', 'utf8');
assert.match(context, /const addBusinessInFlightRef = useRef<Map<string, Promise<string>>>\(new Map\(\)\)/,
  'activity creation must maintain in-flight requests inside the shared app context');
const start = context.indexOf('const addBusiness = async');
const end = context.indexOf('const updateBusinessLocation', start);
assert.ok(start >= 0 && end > start, 'addBusiness function must remain present');
const addBusiness = context.slice(start, end);
assert.match(addBusiness, /const createBusinessPayload = \{/,
  'the request identity must be built from the canonical business payload');
assert.match(addBusiness, /const requestKey = JSON\.stringify\(createBusinessPayload\)/,
  'in-flight identity must be based on the actual payload sent to the backend');
assert.match(addBusiness, /const inFlightRequest = addBusinessInFlightRef\.current\.get\(requestKey\);\s*if \(inFlightRequest\) return inFlightRequest;/,
  'repeat submissions with the same in-flight payload must reuse the original Promise');
assert.match(addBusiness, /callPlatformAdmin\(\{ action: 'CREATE_BUSINESS', business: createBusinessPayload \}\)/,
  'the guarded payload must be the exact payload submitted to the server');
assert.match(addBusiness, /addBusinessInFlightRef\.current\.set\(requestKey, request\)/,
  'new requests must be registered before a later click can create another request');
assert.match(addBusiness, /finally \{[\s\S]*addBusinessInFlightRef\.current\.get\(requestKey\) === request[\s\S]*addBusinessInFlightRef\.current\.delete\(requestKey\)/,
  'the in-flight slot must always be cleaned up after success or failure');
assert.match(admin, /error: "DUPLICATE_BUSINESS"/,
  'the existing server-side duplicate guard must remain active as the second line of defense');
assert.match(addBusiness, /return inFlightRequest/,
  'different payloads must not be collapsed into one request');
console.log('CATALOG_BUSINESS_CREATE_INFLIGHT_GUARD=PASS');
