import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20261118210000_rc480_digital_pages_anon_column_boundary.sql",
  "utf8",
);
const renderer = fs.readFileSync("web/digital-page.js", "utf8");
const integration = fs.readFileSync(
  "supabase/tests/rc480_digital_pages_anon_columns_integration.sql",
  "utf8",
);

const expected = [
  "id",
  "page_type",
  "slug",
  "title",
  "subtitle",
  "description",
  "seo_title",
  "seo_description",
  "status",
  "version",
];

assert.match(migration, /^REVOKE SELECT ON TABLE public\.digital_pages FROM anon;$/m);
const grant = migration.match(
  /^GRANT SELECT \(([\s\S]*?)\) ON TABLE public\.digital_pages TO anon;$/m,
);
assert.ok(grant, "RC480 must grant an explicit column allowlist to anon");
const granted = grant[1]
  .split(",")
  .map((column) => column.trim())
  .filter(Boolean);
assert.deepEqual(granted, expected, "RC480 allowlist must exactly match the public renderer query");

assert.equal((migration.match(/\bREVOKE\b/g) || []).length, 1);
assert.equal((migration.match(/\bGRANT\b/g) || []).length, 1);
assert.doesNotMatch(
  migration,
  /REVOKE[\s\S]*?FROM\s+(?:authenticated|service_role|PUBLIC)\s*;/i,
  "RC480 must not revoke authenticated, service_role, or PUBLIC privileges",
);
assert.doesNotMatch(
  migration,
  /DROP\s+POLICY|CREATE\s+POLICY|DELETE\s+FROM|TRUNCATE|DROP\s+TABLE/i,
  "RC480 must not alter RLS policy definitions or production rows",
);

const query = renderer.match(
  /from\(['"]digital_pages['"]\)\.select\(['"]([^'"]+)['"]\)/,
);
assert.ok(query, "public page renderer must keep an explicit digital_pages projection");
assert.deepEqual(
  query[1].split(",").map((column) => column.trim()),
  expected,
  "public renderer projection must exactly match the anonymous column allowlist",
);

for (const marker of [
  "RC480_ANON_TABLE_LEVEL_SELECT_STILL_GRANTED",
  "RC480_AUTHENTICATED_TABLE_PRIVILEGES_CHANGED",
  "RC480_SERVICE_ROLE_SELECT_CHANGED",
  "RC480_PUBLIC_RENDERER_COLUMN_GRANTS_MISSING",
  "RC480_INTERNAL_PAGE_COLUMNS_STILL_SELECTABLE",
  "RC480_ANON_CREATED_BY_READ_SUCCEEDED",
  "RC480_ANON_WILDCARD_READ_SUCCEEDED",
  "RC480_AUTHENTICATED_OWNER_READ_REGRESSED",
]) {
  assert.ok(integration.includes(marker), "missing RC480 integration assertion: " + marker);
}

console.log("RC480 digital-page anonymous column boundary contract: PASS");
