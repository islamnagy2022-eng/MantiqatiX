import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const manifestPath = "docs/release/LEDGER_RECOVERED_MIGRATION_SOURCE_MANIFEST.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

assert.equal(manifest.source_table, "supabase_migrations.schema_migrations");
assert.equal(manifest.original_file_bytes_recovered, false,
  "Do not claim the original migration file bytes were recovered");
assert.equal(manifest.migration_statement_bytes_recovered, true);
assert.ok(Array.isArray(manifest.migrations) && manifest.migrations.length === 11,
  "Expected the 11 specifically recovered production-ledger migrations");

const seenVersions = new Set();
for (const entry of manifest.migrations) {
  assert.match(entry.version, /^\d{14}$/);
  assert.equal(entry.path, path.join("supabase/migrations", entry.version + "_" + entry.name + ".sql"));
  assert.equal(entry.source, "live_production_ledger_statements[1]");
  assert.equal(entry.statement_count, 1);
  assert.ok(!seenVersions.has(entry.version), "Recovered migration versions must be unique");
  seenVersions.add(entry.version);

  const sql = fs.readFileSync(entry.path, "utf8");
  assert.equal(Buffer.byteLength(sql, "utf8"), entry.bytes,
    entry.version + " byte length must match the production ledger statement");
  assert.equal(crypto.createHash("sha256").update(sql, "utf8").digest("hex"), entry.statement_sha256,
    entry.version + " SHA-256 must match the production ledger statement");
  assert.ok(sql.trim().length > 0, entry.version + " SQL must not be empty");
  assert.doesNotMatch(sql, /(?:sk_live_|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,})/,
    entry.version + " must not contain a recognizable embedded secret");
}

console.log("Ledger-recovered migration source check PASS: 11 SQL statements match production ledger SHA-256 and byte lengths; original file-byte identity is not claimed.");
