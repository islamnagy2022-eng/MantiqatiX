import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20261118220000_rc481_legal_edge_service_role_column_grants.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const center = fs.readFileSync("supabase/functions/legal-center/index.ts", "utf8");
const cms = fs.readFileSync("supabase/functions/legal-cms/index.ts", "utf8");
const integration = fs.readFileSync("supabase/tests/rc481_legal_edge_service_role_acl_integration.sql", "utf8");

const grantBlocks = migration.match(/^GRANT (?:SELECT|INSERT) \([\s\S]*?\) ON TABLE public\.[a-z_]+ TO service_role;$/gm) || [];
assert.equal(grantBlocks.length, 7, "RC481 must contain exactly seven column-level grants");
assert.match(migration, /^BEGIN;[\s\S]*COMMIT;\s*$/);
assert.doesNotMatch(migration, /GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)\s+ON\s+TABLE/i,
  "RC481 must not grant table-wide privileges");
assert.doesNotMatch(migration, /GRANT\s+(?:ALL|UPDATE|DELETE)\b/i,
  "RC481 must not grant UPDATE, DELETE, or ALL");
assert.doesNotMatch(migration, /REVOKE|DROP POLICY|CREATE POLICY|TRUNCATE|DELETE FROM/i,
  "RC481 must not revoke existing ACLs, change RLS, or mutate rows");

const expected = {
  legal_documents_select: ["id","document_type","title","status","published_at","effective_at","target_audience","required_consent","requires_reconsent","sector_codes","locale"],
  legal_document_versions_select: ["id","document_id","version_number","published_at","effective_at","content_hash","content"],
  legal_requirements_select: ["action_key","document_type","target_audience","required","enabled","business_scoped"],
  user_consents_select: ["id","user_id","document_id","document_version_id","agreement_id","account_type","consent_status","consented_at","content_hash","source"],
  legal_documents_insert: ["document_type","title","target_audience","required_consent","requires_reconsent","sector_codes","locale","status","created_by","updated_by"],
  legal_document_versions_insert: ["document_id","version_number","content","content_hash","status","created_by"],
  consent_audit_log_insert: ["actor_user_id","event_type","document_id","document_version_id","event_at","metadata"],
};
for (const [key, columns] of Object.entries(expected)) {
  const [table, privilege] = key.split(/_(?=[^_]+$)/);
  const re = new RegExp(
    "^GRANT " + privilege.toUpperCase() + " \\(([^)]*)\\) ON TABLE public\\." + table + " TO service_role;$",
    "m",
  );
  const match = migration.match(re);
  assert.ok(match, "missing exact RC481 grant: " + key);
  assert.deepEqual(match[1].split(",").map(x => x.trim()).filter(Boolean), columns,
    "unexpected RC481 columns for " + key);
}

const readChecks = [
  ['legal_documents','id,document_type,title,status,published_at,effective_at,target_audience,required_consent,requires_reconsent,sector_codes,locale'],
  ['legal_document_versions','id,document_id,version_number,published_at,effective_at,content_hash,content'],
  ['legal_requirements','action_key,document_type,target_audience,required,enabled,business_scoped'],
  ['user_consents','id,document_id,document_version_id,agreement_id,account_type,consent_status,consented_at,content_hash,source'],
];
for (const [table,projection] of readChecks) {
  assert.ok(center.includes(`from("${table}")`) || center.includes(`from('${table}')`),
    "Legal Center must use the audited " + table + " read path");
  assert.ok(center.includes(`select("${projection}")`) || center.includes(`select('${projection}')`),
    "Legal Center projection drifted for " + table);
}
assert.ok(center.includes('.eq("user_id",user.id)'), "own-consent query must remain user-scoped");

for (const marker of [
  'from("legal_documents").insert(',
  'from("legal_document_versions").insert(',
  'from("consent_audit_log").insert(',
  'private', // admin verification must remain separate from the granted INSERT path
]) {
  assert.ok(cms.includes(marker), "Legal CMS direct write contract missing: " + marker);
}
assert.ok(cms.includes("LEGAL_ADMIN_REQUIRED"), "Legal CMS must retain its admin authorization gate");

for (const marker of [
  "RC481_UNEXPECTED_TABLE_LEVEL_SERVICE_ROLE_PRIVILEGE",
  "RC481_REQUIRED_LEGAL_EDGE_SELECT_COLUMN_MISSING",
  "RC481_UNNECESSARY_OR_SENSITIVE_SELECT_COLUMN_GRANTED",
  "RC481_REQUIRED_LEGAL_CMS_INSERT_COLUMN_MISSING",
  "RC481_UNNECESSARY_LEGAL_CMS_INSERT_COLUMN_GRANTED",
  "RC481_EXISTING_ANON_OR_AUTHENTICATED_PRIVILEGE_CHANGED",
  "RC481_SERVICE_ROLE_READ_CONSENT_IP_SUCCEEDED",
  "RC481_SERVICE_ROLE_READ_AUDIT_LOG_SUCCEEDED",
  "RC481_SERVICE_ROLE_UPDATE_SUCCEEDED",
  "RC481_SERVICE_ROLE_DELETE_SUCCEEDED",
]) {
  assert.ok(integration.includes(marker), "missing RC481 PostgreSQL assertion: " + marker);
}

console.log("RC481 Legal Edge service-role ACL contract: PASS");
