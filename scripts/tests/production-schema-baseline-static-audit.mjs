#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";

const root = process.env.GITHUB_WORKSPACE || process.cwd();
const base = root + "/supabase/tests/baselines/";
const snapshot = fs.readFileSync(base + "production_schema_snapshot.sql", "utf8");
const manifest = JSON.parse(fs.readFileSync(base + "production_schema_snapshot.manifest.json", "utf8"));
const ledgerText = fs.readFileSync(base + "production_schema_migration_versions.txt", "utf8");
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const fail = (m) => { console.error("BASELINE_STATIC_AUDIT=FAIL " + m); process.exit(1); };

if (!snapshot.trim()) fail("snapshot empty");
if (/^\s*COPY\s+.+\s+FROM\s+stdin\s*;?\s*$/im.test(snapshot)) fail("COPY data payload detected");
if (/(?:postgres(?:ql)?:\/\/[^\s'"]+:[^\s'"]+@|sb_secret_[A-Za-z0-9_-]{16,}|sbp_[A-Za-z0-9_-]{24,}|sk-[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/i.test(snapshot)) fail("known credential/token pattern detected");
if (manifest.schema_snapshot_sha256 !== sha256(snapshot)) fail("snapshot SHA-256 mismatch");
if (manifest.review_status !== "PENDING_REVIEW") fail("capture artifact must remain pending review in this PR");
if (manifest.schema_only !== true || manifest.data_included !== false || manifest.production_writes_performed !== false || manifest.deployment_approved !== false) fail("safety flags invalid");

const versions = ledgerText.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
if (!versions.length || versions.some(v => !/^\d{14}$/.test(v))) fail("ledger version format invalid");
if (new Set(versions).size !== versions.length) fail("duplicate ledger versions");
if (versions.some((v, i) => i && versions[i - 1] > v)) fail("ledger versions not sorted");
if (manifest.last_applied_migration_version !== versions.at(-1)) fail("ledger checkpoint mismatch");
if (manifest.applied_migration_count !== versions.length) fail("ledger count mismatch");
if (manifest.applied_migration_versions_sha256 !== sha256(versions.join("\n") + "\n")) fail("ledger hash mismatch");

const publicTables = [...snapshot.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"public"\."([^"]+)"/g)].map(m => m[1]);
const uniqueTables = [...new Set(publicTables)];
const rlsEnabled = new Set([...snapshot.matchAll(/ALTER TABLE "public"\."([^"]+)" ENABLE ROW LEVEL SECURITY;/g)].map(m => m[1]));
const missingRls = uniqueTables.filter(t => !rlsEnabled.has(t));
if (!uniqueTables.length) fail("no public tables parsed");
if (missingRls.length) fail("public tables missing RLS enablement: " + missingRls.join(", "));

const policyCount = [...snapshot.matchAll(/CREATE POLICY /g)].length;
const securityDefiner = [];
const lines = snapshot.split("\n");
const functionDeclarations = [];
for (let i = 0; i < lines.length; i++) {
  if (!/^CREATE OR REPLACE FUNCTION /.test(lines[i])) continue;

  // SECURITY DEFINER and SET search_path are function-header attributes.
  // Stop at the AS dollar-quote opener rather than assuming the body ends with $;
  // pg_dump may use different dollar tags and body delimiters.
  let j = i;
  while (j < lines.length && j < i + 120 && !/^\s*AS\s+\$[A-Za-z_0-9]*\$\s*;?\s*$/i.test(lines[j])) j++;
  if (j >= lines.length || j >= i + 120) {
    fail("could not find function body opener for declaration at line " + (i + 1));
  }

  const header = lines.slice(i, j + 1).join("\n");
  const m = lines[i].match(/^CREATE OR REPLACE FUNCTION "([^"]+)"\."([^"]+)"\(/);
  if (!m) fail("could not parse function declaration at line " + (i + 1));
  const [, schema, name] = m;
  functionDeclarations.push({ schema, name, header, line: i + 1 });

  if (!/\bSECURITY DEFINER\b/i.test(header)) continue;
  const revoke = lines.some(line => line.trim().startsWith(`REVOKE ALL ON FUNCTION "${schema}"."${name}"(`) && line.includes(" FROM PUBLIC;"));
  const hasPath = /SET "search_path" TO /i.test(header);
  securityDefiner.push({ schema, name, hasPath, hasPublicRevoke: revoke, line: i + 1 });
}
const declaredSecurityDefinerCount = [...snapshot.matchAll(/\bSECURITY DEFINER\b/gi)].length;
if (!securityDefiner.length) fail("no SECURITY DEFINER functions parsed");
if (declaredSecurityDefinerCount !== securityDefiner.length) {
  fail("SECURITY DEFINER header coverage mismatch: snapshot has " + declaredSecurityDefinerCount + " occurrences but parser accounted for " + securityDefiner.length + " function headers");
}
const missingPath = securityDefiner.filter(f => !f.hasPath);
const missingRevoke = securityDefiner.filter(f => !f.hasPublicRevoke);
if (missingPath.length) fail("SECURITY DEFINER functions missing search_path: " + missingPath.map(f => f.schema + "." + f.name).join(", "));
if (missingRevoke.length) fail("SECURITY DEFINER functions without PUBLIC revoke: " + missingRevoke.map(f => f.schema + "." + f.name).join(", "));

const publicCreateForUntrusted = snapshot.split("\n").filter(l => /^GRANT CREATE ON SCHEMA "public" TO "(anon|authenticated)";$/.test(l.trim()));
if (publicCreateForUntrusted.length) fail("CREATE on public schema granted to anon/authenticated");

console.log("BASELINE_STATIC_AUDIT=PASS");
console.log("REVIEW_STATUS=" + manifest.review_status);
console.log("LEDGER_COUNT=" + versions.length);
console.log("LEDGER_CHECKPOINT=" + versions.at(-1));
console.log("PUBLIC_TABLES=" + uniqueTables.length);
console.log("PUBLIC_TABLES_WITH_RLS=" + (uniqueTables.length - missingRls.length));
console.log("POLICIES=" + policyCount);
console.log("SECURITY_DEFINER_FUNCTIONS=" + securityDefiner.length);
console.log("SECURITY_DEFINER_WITH_SEARCH_PATH=" + (securityDefiner.length - missingPath.length));
console.log("SECURITY_DEFINER_REVOKED_FROM_PUBLIC=" + (securityDefiner.length - missingRevoke.length));
console.log("NOTE=Static checks only; manual function/grant/RLS review and runtime isolation tests remain required.");
