import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = readFileSync("supabase/config.toml", "utf8");
const specs = {
  "api": ["supabase/functions/api/index.ts", ["supabaseAdmin.auth.getUser(token)", "user_memberships"]],
  "catalog-admin": ["supabase/functions/catalog-admin/index.ts", ["service.auth.getUser(token)", "mnty_can_platform_admin"]],
  "directory-listings": ["supabase/functions/directory-listings/index.ts", ["service.auth.getUser(token)", "sanitizePublicDirectoryListing", "loadContactConsentScopes"]],
  "health": ["supabase/functions/health/index.ts", ["HEALTH_MONITOR_TOKEN", "tokenMatches"]],
  "mantigo-payment-intent": ["supabase/functions/mantigo-payment-intent/index.ts", ["admin.auth.getUser(token)", "user.is_anonymous"]],
  "mnty-push-dispatch": ["supabase/functions/mnty-push-dispatch/index.ts", ["get_mnty_push_secrets", "x-mnty-push-secret", "constantTimeSecretEquals"]],
  "paymob-webhook": ["supabase/functions/paymob-webhook/index.ts", ["PAYMOB_HMAC_SECRET", "hmacSha512Hex", "INVALID_PROVIDER_SIGNATURE"]],
  "payment-webhook": ["supabase/functions/payment-webhook/index.ts", ["MANTIQATIX_WEBHOOK_SECRET", "x-mantiqatix-signature", "signatureVerified"]],
  "public-catalog": ["supabase/functions/public-catalog/index.ts", ['req.method !== "GET"', "METHOD_NOT_ALLOWED"]],
  "public-catalog-directory": ["supabase/functions/public-catalog-directory/index.ts", ['req.method !== "GET"', "METHOD_NOT_ALLOWED"]],
};

const sections = new Map();
let current = null;
for (const line of config.split(/\r?\n/)) {
  const heading = line.match(/^\[functions\.([a-z0-9-]+)\]$/);
  if (heading) {
    current = heading[1];
    assert.equal(sections.has(current), false, "Duplicate function config section: " + current);
    sections.set(current, []);
    continue;
  }
  if (/^\[/.test(line)) current = null;
  if (current) sections.get(current).push(line);
}

const configuredPublic = [];
for (const [slug, lines] of sections) {
  const jwtLines = lines.filter(line => /^\s*verify_jwt\s*=/.test(line));
  if (jwtLines.some(line => /^\s*verify_jwt\s*=\s*false\s*(?:#.*)?$/.test(line))) configuredPublic.push(slug);
}
assert.deepEqual(
  configuredPublic.sort(),
  Object.keys(specs).sort(),
  "Every intentionally public Edge gateway must be explicit, and no unreviewed function may disable gateway JWT verification",
);

for (const [slug, [path, markers]] of Object.entries(specs)) {
  const lines = sections.get(slug);
  assert.ok(lines, "Missing explicit config section for " + slug);
  assert.equal(
    lines.filter(line => /^\s*verify_jwt\s*=\s*false\s*(?:#.*)?$/.test(line)).length,
    1,
    slug + " must declare verify_jwt = false exactly once",
  );
  const source = readFileSync(path, "utf8");
  for (const marker of markers) {
    assert.ok(source.includes(marker), slug + " must retain its handler-side security contract: " + marker);
  }
}

console.log("EDGE_JWT_CONFIG_CONTRACT=PASS");
console.log("explicit_public_functions=" + Object.keys(specs).length);
console.log("handler_security_contracts=PASS");
