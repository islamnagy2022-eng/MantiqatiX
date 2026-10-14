#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = new Set(process.argv.slice(2));
const capture = args.has("--capture");
const verify = args.has("--verify");
if (capture === verify) {
  console.error("Usage: node scripts/validate-production-schema-baseline.mjs --capture|--verify");
  process.exit(2);
}

const snapshotPath = "supabase/tests/baselines/production_schema_snapshot.sql";
const manifestPath = "supabase/tests/baselines/production_schema_snapshot.manifest.json";
const ledgerPath = process.env.BASELINE_LEDGER_VERSIONS_FILE || "/tmp/mantiqatix-ledger-versions.txt";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const fail = (message) => { console.error("BASELINE_BLOCKED: " + message); process.exit(1); };

function readLedgerVersions() {
  if (!fs.existsSync(ledgerPath)) fail("read-only migration ledger export is missing");
  const lines = fs.readFileSync(ledgerPath, "utf8").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (!lines.length) fail("migration ledger export is empty");
  if (lines.some((v) => !/^\d{14}$/.test(v))) fail("migration ledger contains an unexpected version format");
  const sorted = [...lines].sort();
  if (new Set(lines).size !== lines.length) fail("migration ledger contains duplicate versions");
  if (lines.some((v, i) => v !== sorted[i])) fail("migration ledger export is not ordered ascending");
  return lines;
}

function validateSchemaOnly(sql) {
  if (!sql.trim()) fail("schema snapshot is empty");
  if (/^\s*COPY\s+.+\s+FROM\s+stdin\s*;?\s*$/im.test(sql)) fail("snapshot contains COPY data payloads");
  if (/\b(?:sb_secret_[A-Za-z0-9_-]{16,}|sbp_[A-Za-z0-9_-]{24,}|sk-[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/.test(sql)) fail("snapshot matched a known secret/token pattern; do not publish it");
  if (/postgres(?:ql)?:\/\/[^\s'"]+:[^\s'"]+@/i.test(sql)) fail("snapshot contains a database connection string; do not publish it");
  if (/(?:api[_-]?key|secret|password|access[_-]?token|private[_-]?key)\s*[:=]\s*['"][^'"]{12,}['"]/i.test(sql)) fail("snapshot contains a credential-like assignment; do not publish it");
  if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(sql)) fail("snapshot matched a JWT-shaped token; do not publish it");
}

if (capture) {
  if (!fs.existsSync(snapshotPath)) fail("Supabase schema-only dump is missing");
  const sql = fs.readFileSync(snapshotPath, "utf8");
  validateSchemaOnly(sql);
  const versions = readLedgerVersions();
  const sourceProjectRef = process.env.SUPABASE_PROJECT_REF || "moyhiluyhjsujhwlyeuu";
  const postgresMajor = Number(process.env.BASELINE_POSTGRES_MAJOR_VERSION || "0");
  if (!Number.isInteger(postgresMajor) || postgresMajor < 14 || postgresMajor > 99) fail("PostgreSQL major version was not captured from the live database");
  const manifest = {
    format: "mantiqatix-production-schema-baseline/v1",
    review_status: "PENDING_REVIEW",
    purpose: "test-only bootstrap for isolated forward migration replay; not historical migration source",
    source_project_ref: sourceProjectRef,
    postgres_major_version: postgresMajor,
    capture_method: "Supabase CLI db dump; schema-only; no rows or custom roles",
    captured_at_utc: new Date().toISOString(),
    captured_from_commit: process.env.GITHUB_SHA || "unknown",
    workflow_run_id: process.env.GITHUB_RUN_ID || "manual",
    last_applied_migration_version: versions.at(-1),
    applied_migration_count: versions.length,
    applied_migration_versions_sha256: sha256(versions.join("\n") + "\n"),
    schema_snapshot_sha256: sha256(sql),
    schema_only: true,
    data_included: false,
    production_writes_performed: false,
    deployment_approved: false,
    notes: [
      "This is a snapshot of the observed live schema at the recorded migration-ledger checkpoint, not a reconstruction of historical DDL.",
      "Never place this file in supabase/migrations and never apply it to production.",
      "Review object definitions, policies, grants, SECURITY DEFINER functions, and the manifest before changing review_status.",
      "The snapshot must be replayed only in a disposable Supabase/PostgreSQL environment, followed by migrations newer than last_applied_migration_version."
    ]
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log("BASELINE_CAPTURE=PASS");
  console.log("BASELINE_REVIEW_STATUS=PENDING_REVIEW");
  console.log("BASELINE_LEDGER_CHECKPOINT=" + manifest.last_applied_migration_version);
  console.log("BASELINE_SCHEMA_SHA256=" + manifest.schema_snapshot_sha256);
  console.log("BASELINE_LEDGER_SHA256=" + manifest.applied_migration_versions_sha256);
  process.exit(0);
}

if (!fs.existsSync(snapshotPath) || !fs.existsSync(manifestPath)) fail("snapshot or provenance manifest is missing");
const sql = fs.readFileSync(snapshotPath, "utf8");
validateSchemaOnly(sql);
let manifest;
try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { fail("provenance manifest is invalid JSON"); }
if (manifest.format !== "mantiqatix-production-schema-baseline/v1") fail("unsupported manifest format");
if (typeof manifest.source_project_ref !== "string" || !manifest.source_project_ref.trim()) fail("source project ref is missing");
if (!/^\d{14}$/.test(manifest.last_applied_migration_version || "")) fail("manifest ledger checkpoint is missing or invalid");
if (!Number.isInteger(manifest.applied_migration_count) || manifest.applied_migration_count < 1) fail("manifest migration count is missing or invalid");
if (!/^[a-f0-9]{64}$/.test(manifest.applied_migration_versions_sha256 || "")) fail("manifest ledger-version hash is missing or invalid");
if (!Number.isInteger(manifest.postgres_major_version) || manifest.postgres_major_version < 14) fail("manifest PostgreSQL major version is missing or invalid");
if (manifest.schema_only !== true || manifest.data_included !== false || manifest.production_writes_performed !== false || manifest.deployment_approved !== false) fail("snapshot safety flags do not match the test-only contract");
if (manifest.schema_snapshot_sha256 !== sha256(sql)) fail("schema snapshot SHA-256 does not match the manifest");
if (process.env.REQUIRE_BASELINE_REVIEW === "1" && manifest.review_status !== "APPROVED_FOR_DISPOSABLE_REPLAY") fail("baseline has not passed explicit disposable-replay review");
if (fs.existsSync(ledgerPath)) {
  const versions = readLedgerVersions();
  if (manifest.last_applied_migration_version !== versions.at(-1)) fail("manifest checkpoint does not match the captured migration ledger export");
  if (manifest.applied_migration_count !== versions.length) fail("manifest migration count does not match the ledger export");
  if (manifest.applied_migration_versions_sha256 !== sha256(versions.join("\n") + "\n")) fail("manifest ledger hash does not match the captured migration ledger export");
}
console.log("BASELINE_VERIFY=PASS");
console.log("BASELINE_REVIEW_STATUS=" + manifest.review_status);
console.log("BASELINE_LEDGER_CHECKPOINT=" + manifest.last_applied_migration_version);
console.log("BASELINE_SCHEMA_SHA256=" + manifest.schema_snapshot_sha256);
