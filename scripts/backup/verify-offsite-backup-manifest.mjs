#!/usr/bin/env node
/**
 * Verify an off-site encrypted MantiqaTix backup manifest and its disposable
 * restore evidence. This script is read-only: it never decrypts to disk,
 * modifies Production, or prints credentials.
 *
 * Usage:
 *   AGE_IDENTITY_FILE=/secure/backup-identity.txt \
 *     node scripts/backup/verify-offsite-backup-manifest.mjs /secure/backup/manifest.json
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const EXPECTED_PRODUCTION_PROJECT_REF = "moyhiluyhjsujhwlyeuu";
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function isInsideDirectory(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === "" ||
    (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
}
const REQUIRED_ARTIFACT_KINDS = [
  "database_roles",
  "database_schema",
  "database_data",
  "storage_objects",
];
const REQUIRED_RESTORE_CHECKS = [
  "postgres_version",
  "schema_inventory",
  "critical_row_counts",
  "auth_records",
  "rls_policies_and_acl",
  "security_definer_owners_and_grants",
  "financial_invariants",
  "storage_inventory",
  "vault_recovery",
  "edge_auth_smoke",
  "rollback_rehearsal",
];
const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|credential|service_role|private_key|database_url|connection_string|jwt|api_key|access_key)/i;

function blocked(message) {
  console.error(`BACKUP_GATE=BLOCKED ${message}`);
  process.exitCode = 1;
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function isValidDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function noSensitiveFields(value, location = "manifest") {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    requireCondition(
      !SENSITIVE_KEY_PATTERN.test(key),
      `sensitive field name is prohibited at ${location}.${key}`
    );
    noSensitiveFields(nested, `${location}.${key}`);
  }
}

function resolveArtifactPath(root, relativePath) {
  requireCondition(
    typeof relativePath === "string" &&
      relativePath.length > 0 &&
      !path.isAbsolute(relativePath) &&
      !relativePath.split(/[\\/]/).includes(".."),
    "artifact path must be a safe relative path"
  );
  const resolved = path.resolve(root, relativePath);
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
  requireCondition(
    resolved.startsWith(rootPrefix),
    "artifact path escapes the manifest directory"
  );
  return resolved;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const digest = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", chunk => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(digest.digest("hex")));
  });
}

function hasAgeHeader(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(24);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString("utf8").startsWith("age-encryption.org/v1\n");
  } finally {
    fs.closeSync(fd);
  }
}

function rejectPlaintextBackupFiles(root, manifestPath) {
  const forbidden = /\.(sql|dump|backup|tar|tar\.gz|zip)$/i;
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (candidate === manifestPath) continue;
      if (entry.isSymbolicLink()) throw new Error("symlink found inside backup artifact directory");
      if (entry.isDirectory()) {
        if (entry.name === "storage") throw new Error("plaintext Storage export directory remains beside encrypted artifacts");
        walk(candidate);
      } else if (entry.isFile() && forbidden.test(entry.name)) {
        throw new Error("plaintext database or Storage archive remains beside encrypted artifacts");
      }
    }
  };
  walk(root);
}

function verifyDecrypts(filePath, identityPath) {
  const result = spawnSync(
    "age",
    ["--decrypt", "--identity", identityPath, filePath],
    { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"], maxBuffer: 1024 * 1024 }
  );
  requireCondition(
    !result.error && result.status === 0,
    "an encrypted artifact could not be decrypted with the supplied recovery identity"
  );
}

async function verifyArtifact(root, artifact, identityPath) {
  requireCondition(
    artifact && REQUIRED_ARTIFACT_KINDS.includes(artifact.kind),
    "manifest contains an unsupported artifact kind"
  );
  requireCondition(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0,
    `invalid byte count for ${artifact.kind}`);
  requireCondition(typeof artifact.sha256 === "string" && /^[a-f0-9]{64}$/i.test(artifact.sha256),
    `invalid SHA-256 for ${artifact.kind}`);

  const filePath = resolveArtifactPath(root, artifact.path);
  const stat = fs.lstatSync(filePath);
  requireCondition(stat.isFile() && !stat.isSymbolicLink(),
    `${artifact.kind} must be a regular file, not a symlink`);
  requireCondition(stat.size === artifact.bytes,
    `byte count mismatch for ${artifact.kind}`);
  requireCondition(String(artifact.path).endsWith(".age"),
    `${artifact.kind} must be an encrypted .age artifact`);
  requireCondition(hasAgeHeader(filePath),
    `${artifact.kind} does not have an age encryption header`);

  const actualHash = await sha256File(filePath);
  requireCondition(actualHash.toLowerCase() === artifact.sha256.toLowerCase(),
    `SHA-256 mismatch for ${artifact.kind}`);
  verifyDecrypts(filePath, identityPath);
}

function verifyRestoreEvidence(manifest) {
  const restore = manifest.restore_rehearsal;
  requireCondition(restore && restore.status === "PASS",
    "isolated restore rehearsal is not marked PASS");
  requireCondition(
    typeof restore.target_project_ref === "string" &&
      restore.target_project_ref.length > 0 &&
      restore.target_project_ref !== manifest.production_project_ref,
    "restore target must be a separate project, not Production"
  );
  requireCondition(restore.postgres_major_version === 17,
    "restore target must use PostgreSQL 17");
  requireCondition(isValidDate(restore.started_at) && isValidDate(restore.finished_at) &&
    Date.parse(restore.finished_at) >= Date.parse(restore.started_at),
    "restore rehearsal timestamps are invalid");
  requireCondition(Number.isFinite(restore.rpo_seconds) && restore.rpo_seconds >= 0,
    "measured RPO seconds are missing or invalid");
  requireCondition(Number.isFinite(restore.rto_seconds) && restore.rto_seconds > 0,
    "measured RTO seconds are missing or invalid");
  requireCondition(typeof restore.evidence_ref === "string" && restore.evidence_ref.trim().length > 0,
    "restore evidence reference is required");
  requireCondition(typeof restore.reviewer === "string" && restore.reviewer.trim().length > 0 &&
    restore.reviewer !== manifest.backup_operator,
    "independent restore reviewer, separate from the backup operator, is required");
  requireCondition(restore.acceptance && typeof restore.acceptance === "object",
    "restore acceptance results are missing");
  for (const check of REQUIRED_RESTORE_CHECKS) {
    requireCondition(restore.acceptance[check] === true,
      `restore acceptance check is not PASS: ${check}`);
  }
}

async function main() {
  const manifestArgument = process.argv[2];
  requireCondition(manifestArgument, "usage: verify-offsite-backup-manifest.mjs <manifest.json>");

  const manifestPath = path.resolve(manifestArgument);
  const manifestStat = fs.lstatSync(manifestPath);
  requireCondition(manifestStat.isFile() && !manifestStat.isSymbolicLink(),
    "manifest must be a regular file");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const root = path.dirname(manifestPath);
  requireCondition(!isInsideDirectory(manifestPath, REPOSITORY_ROOT),
    "backup manifest and encrypted artifacts must be stored outside the Git repository");

  noSensitiveFields(manifest);
  requireCondition(manifest.schema_version === 1, "unsupported manifest schema_version");
  requireCondition(manifest.production_project_ref === EXPECTED_PRODUCTION_PROJECT_REF,
    "manifest production project reference does not match this repository");
  requireCondition(/^[a-f0-9]{40}$/i.test(manifest.source_commit_sha ?? ""),
    "source_commit_sha must be a full Git commit SHA");
  requireCondition(
    typeof manifest.source_postgres_version === "string" &&
      manifest.source_postgres_version.startsWith("17."),
    "source PostgreSQL version must be 17.x"
  );
  requireCondition(isValidDate(manifest.backup_started_at) &&
    isValidDate(manifest.backup_finished_at) &&
    Date.parse(manifest.backup_finished_at) >= Date.parse(manifest.backup_started_at),
    "backup timestamps are invalid");
  requireCondition(typeof manifest.backup_destination === "string" &&
    /^(s3|https?):\/\//i.test(manifest.backup_destination) &&
    !manifest.backup_destination.includes("@") &&
    !manifest.backup_destination.includes("?"),
    "backup destination must be a non-secret off-site URI without embedded credentials or query tokens");
  requireCondition(manifest.offsite_destination_outside_supabase_org === true &&
    manifest.offsite_retrieval_verified === true,
    "off-site storage separation and second-environment retrieval must be verified");
  requireCondition(typeof manifest.backup_operator === "string" &&
    manifest.backup_operator.trim().length > 0,
    "backup operator is required");
  requireCondition(typeof manifest.retention_until === "string" &&
    isValidDate(manifest.retention_until) &&
    Date.parse(manifest.retention_until) > Date.parse(manifest.backup_finished_at),
    "backup retention expiry must follow the backup completion time");
  requireCondition(manifest.encryption?.algorithm === "age" &&
    typeof manifest.encryption.recipient_id === "string" &&
    manifest.encryption.recipient_id.trim().length > 0,
    "age algorithm and non-secret recipient_id are required");

  const identityArgument = process.env.AGE_IDENTITY_FILE;
  requireCondition(identityArgument, "AGE_IDENTITY_FILE must point to the recovery identity outside this repository");
  const identityPath = path.resolve(identityArgument);
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
  requireCondition(!identityPath.startsWith(rootPrefix),
    "recovery identity must be stored separately from the backup artifact directory");
  requireCondition(!isInsideDirectory(identityPath, REPOSITORY_ROOT),
    "recovery identity must be stored outside the Git repository");
  const identityStat = fs.lstatSync(identityPath);
  requireCondition(identityStat.isFile() && !identityStat.isSymbolicLink(),
    "recovery identity must be a regular file, not a symlink");
  if (process.platform !== "win32") {
    requireCondition((identityStat.mode & 0o077) === 0,
      "recovery identity permissions must be owner-only (chmod 600)");
  }

  requireCondition(Array.isArray(manifest.artifacts), "encrypted artifacts list is required");
  const kinds = manifest.artifacts.map(item => item?.kind);
  requireCondition(new Set(kinds).size === kinds.length, "duplicate artifact kind in manifest");
  requireCondition(REQUIRED_ARTIFACT_KINDS.every(kind => kinds.includes(kind)),
    "manifest must include roles, schema, data and Storage-object encrypted artifacts");

  rejectPlaintextBackupFiles(root, manifestPath);
  console.log("PLAINTEXT_SCAN=PASS");

  for (const artifact of manifest.artifacts) {
    await verifyArtifact(root, artifact, identityPath);
    console.log(`ARTIFACT_${artifact.kind.toUpperCase()}=PASS bytes=${artifact.bytes}`);
  }

  requireCondition(Array.isArray(manifest.storage_buckets) && manifest.storage_buckets.length > 0,
    "Storage bucket inventory is required");
  const bucketNames = new Set();
  for (const bucket of manifest.storage_buckets) {
    requireCondition(typeof bucket.name === "string" && bucket.name.trim().length > 0,
      "Storage bucket name is invalid");
    requireCondition(!bucketNames.has(bucket.name), "duplicate Storage bucket name");
    bucketNames.add(bucket.name);
    requireCondition(Number.isSafeInteger(bucket.object_count) && bucket.object_count >= 0,
      `invalid Storage object count for bucket ${bucket.name}`);
    requireCondition(Number.isSafeInteger(bucket.total_bytes) && bucket.total_bytes >= 0,
      `invalid Storage byte total for bucket ${bucket.name}`);
    requireCondition(bucket.inventory_match === true,
      `Storage inventory mismatch for bucket ${bucket.name}`);
  }

  verifyRestoreEvidence(manifest);
  console.log(`STORAGE_BUCKETS=${manifest.storage_buckets.length} PASS`);
  console.log("ISOLATED_RESTORE=PASS");
  console.log("BACKUP_MANIFEST=PASS");
}

try {
  await main();
} catch (error) {
  blocked(error instanceof Error ? error.message : String(error));
}
