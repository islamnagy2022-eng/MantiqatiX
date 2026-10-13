import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const migrationDir = "supabase/migrations";
const selfTest = process.argv.includes("--self-test");
const targetRelations = ["smm_provider_credentials", "smm_providers"];

function auditMigrations(entries) {
  const ordered = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const findings = [];
  for (const relation of targetRelations) {
    const createPattern = new RegExp(
      "\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\s*\\.\\s*)?\\\"?" + relation + "\\\"?\\b",
      "i"
    );
    const privilegePattern = new RegExp(
      "\\b(?:grant|revoke)\\b[\\s\\S]{0,300}?\\bon\\s+table\\s+(?:public\\s*\\.\\s*)?\\\"?" + relation + "\\\"?\\b",
      "i"
    );
    const createAt = ordered.findIndex(file => createPattern.test(file.content));
    const privilegeAt = ordered.findIndex(file => privilegePattern.test(file.content));
    if (privilegeAt >= 0 && (createAt < 0 || createAt > privilegeAt)) {
      findings.push({
        relation,
        first_privilege_migration: ordered[privilegeAt].name,
        first_create_migration: createAt < 0 ? null : ordered[createAt].name,
        result: createAt < 0 ? "NO_CREATE_MIGRATION_SOURCE" : "PRIVILEGE_BEFORE_CREATE"
      });
    }
  }
  return { migration_count: ordered.length, findings, result: findings.length ? "FAIL" : "PASS" };
}

if (selfTest) {
  const safe = auditMigrations([
    { name: "20260101000000_create.sql", content: "create table public.smm_provider_credentials(id int);" },
    { name: "20260102000000_privileges.sql", content: "revoke all on table public.smm_provider_credentials from authenticated;" }
  ]);
  assert.equal(safe.result, "PASS");
  const absent = auditMigrations([
    { name: "20260102000000_privileges.sql", content: "revoke references on table public.smm_provider_credentials from authenticated;" }
  ]);
  assert.equal(absent.findings[0]?.result, "NO_CREATE_MIGRATION_SOURCE");
  const late = auditMigrations([
    { name: "20260101000000_privileges.sql", content: "revoke all on table public.smm_providers from authenticated;" },
    { name: "20260102000000_create.sql", content: "create table if not exists public.smm_providers(id int);" }
  ]);
  assert.equal(late.findings[0]?.result, "PRIVILEGE_BEFORE_CREATE");
  console.log("SMM migration baseline dependency audit self-test PASS.");
  process.exit(0);
}

const files = fs.readdirSync(migrationDir)
  .filter(name => name.endsWith(".sql"))
  .sort()
  .map(name => ({ name, content: fs.readFileSync(path.join(migrationDir, name), "utf8") }));
const report = auditMigrations(files);
console.log(JSON.stringify({
  schema_version: 1,
  audit: "SMM migration baseline dependencies",
  ...report,
  note: "Static source audit only; it does not prove a clean replay or production schema state."
}, null, 2));
if (report.findings.length) {
  for (const finding of report.findings) {
    console.error("SMM baseline dependency " + finding.result + ": public." + finding.relation + "; privilege migration=" + finding.first_privilege_migration + "; create migration=" + (finding.first_create_migration ?? "NOT FOUND"));
  }
  process.exit(1);
}
