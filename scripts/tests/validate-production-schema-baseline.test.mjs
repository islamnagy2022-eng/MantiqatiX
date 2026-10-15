import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const validatorSource = path.join(repoRoot, "scripts/validate-production-schema-baseline.mjs");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const versions = ["20261001000000", "20261014000000"];

function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mantiqatix-baseline-validator-"));
  const snapshotPath = path.join(cwd, "supabase/tests/baselines/production_schema_snapshot.sql");
  const manifestPath = path.join(cwd, "supabase/tests/baselines/production_schema_snapshot.manifest.json");
  const ledgerPath = path.join(cwd, "ledger.txt");
  const sql = "CREATE SCHEMA public;\n";
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, sql);
  fs.writeFileSync(ledgerPath, versions.join("\n") + "\n");
  const manifest = {
    format: "mantiqatix-production-schema-baseline/v1",
    review_status: "APPROVED_FOR_DISPOSABLE_REPLAY",
    source_project_ref: "test-project-ref",
    postgres_major_version: 16,
    last_applied_migration_version: versions.at(-1),
    applied_migration_count: versions.length,
    applied_migration_versions_sha256: sha256(versions.join("\n") + "\n"),
    schema_snapshot_sha256: sha256(sql),
    schema_only: true,
    data_included: false,
    production_writes_performed: false,
    deployment_approved: false
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return { cwd, manifestPath, manifest, ledgerPath, cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }) };
}

function verify(f, extraEnv = {}) {
  return spawnSync(process.execPath, [validatorSource, "--verify"], {
    cwd: f.cwd,
    encoding: "utf8",
    env: { ...process.env, BASELINE_LEDGER_VERSIONS_FILE: f.ledgerPath, REQUIRE_BASELINE_REVIEW: "1", ...extraEnv }
  });
}

test("accepts a valid 14-digit migration checkpoint and matching provenance", () => {
  const f = fixture();
  try {
    const result = verify(f);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /BASELINE_VERIFY=PASS/);
  } finally { f.cleanup(); }
});

test("rejects a malformed migration checkpoint", () => {
  const f = fixture();
  try {
    f.manifest.last_applied_migration_version = "2026-10-14";
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    const result = verify(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /checkpoint is missing or invalid/);
  } finally { f.cleanup(); }
});

test("rejects a schema snapshot whose SHA-256 differs from the manifest", () => {
  const f = fixture();
  try {
    f.manifest.schema_snapshot_sha256 = "0".repeat(64);
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    const result = verify(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SHA-256 does not match/);
  } finally { f.cleanup(); }
});


test("fails closed when independent migration ledger evidence is missing", () => {
  const f = fixture();
  try {
    const result = verify(f, { BASELINE_LEDGER_VERSIONS_FILE: path.join(f.cwd, "missing-ledger.txt") });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /read-only migration ledger export is missing/);
  } finally { f.cleanup(); }
});

test("rejects duplicate migration versions in independent ledger evidence", () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.ledgerPath, versions[0] + "\\n" + versions[0] + "\\n");
    const result = verify(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /contains duplicate versions/);
  } finally { f.cleanup(); }
});

test("rejects out-of-order migration versions in independent ledger evidence", () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.ledgerPath, [...versions].reverse().join("\\n") + "\\n");
    const result = verify(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not ordered ascending/);
  } finally { f.cleanup(); }
});

test("rejects migration ledger checkpoint mismatch", () => {
  const f = fixture();
  try {
    f.manifest.last_applied_migration_version = "20261015000000";
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    const result = verify(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /checkpoint does not match/);
  } finally { f.cleanup(); }
});

test("rejects migration ledger count mismatch", () => {
  const f = fixture();
  try {
    f.manifest.applied_migration_count = versions.length + 1;
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    const result = verify(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /count does not match/);
  } finally { f.cleanup(); }
});

test("rejects migration ledger SHA-256 mismatch", () => {
  const f = fixture();
  try {
    f.manifest.applied_migration_versions_sha256 = "0".repeat(64);
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    const result = verify(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /hash does not match/);
  } finally { f.cleanup(); }
});

test("fails closed when explicit disposable-replay review is missing", () => {
  const f = fixture();
  try {
    f.manifest.review_status = "PENDING_REVIEW";
    fs.writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
    const result = verify(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /has not passed explicit disposable-replay review/);
  } finally { f.cleanup(); }
});
