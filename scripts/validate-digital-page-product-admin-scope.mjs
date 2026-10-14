import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20261014230000_rc525_digital_page_product_platform_admin_scope.sql",
  "utf8"
);
const checks = [
  ["removes the broad legacy admin policy", /drop policy if exists digital_page_products_admin_write on public\.digital_page_products/i.test(migration)],
  ["creates a replacement policy limited to authenticated callers", /create policy digital_page_products_platform_admin_write[\s\S]*for all[\s\S]*to authenticated/i.test(migration)],
  ["requires the platform tenant", /m\.tenant_id\s*=\s*'MNTY-PLATFORM'/i.test(migration)],
  ["requires active membership", /m\.status\s*=\s*'ACTIVE'/i.test(migration)],
  ["requires SUPER_ADMIN role", /upper\(m\.role\)\s*=\s*'SUPER_ADMIN'/i.test(migration)],
  ["requires explicit platform scope and full control using fail-closed JSON containment", /m\.permissions\s*@>\s*'\{"scope":"PLATFORM","full_control":true\}'::jsonb/i.test(migration) && /coalesce\([\s\S]*false/i.test(migration)],
  ["enforces both USING and WITH CHECK", /using\s*\([\s\S]*with check\s*\(/i.test(migration)],
  ["preserves active public-read policy by not dropping it", !/drop policy[^;]*digital_page_products_public_read/i.test(migration)],
  ["does not mutate catalog data", !/^\s*(?:insert\s+into|update\s+public\.digital_page_products|delete\s+from|truncate\s+)/im.test(migration)],
  ["documents the forward-only production migration", /Forward-only security correction/i.test(migration)],
];
for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + name);
assert.ok(checks.every(([, ok]) => ok), "Digital-page product platform-admin policy validation failed");
console.log("Digital-page product platform-admin scope: PASS");
