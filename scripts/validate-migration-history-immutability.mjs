import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const migrationPrefix = "supabase/migrations/";
const selfTest = process.argv.includes("--self-test");
const unappliedCorrection = {
  path: "supabase/migrations/20260928184000_rc199_customer_cross_tenant_order_visibility.sql",
  version: "20260928184000",
  originalBlobSha: "4e87ab0526640c390f5427cbddf9350f3cde1632",
  appliedVersionsPath: "supabase/tests/baselines/production_schema_migration_versions.txt",
  manifestPath: "supabase/tests/baselines/production_schema_snapshot.manifest.json",
  expectedAppliedVersionsSha256: "0b60096967ef51a912a08b437a10377e2f12d357dd6b25d5dc80677b1f8832b2",
  previousAppliedVersion: "20260928154411"
};

function isMigrationPath(path) {
  return path.startsWith(migrationPrefix) && path.endsWith(".sql");
}

function decision(status, path, existsInBase, authorizedUnappliedCorrection = false) {
  if (!isMigrationPath(path)) return "ignore";
  if (status === "A" && !existsInBase) return "allow-new";
  if (status === "M" && existsInBase && path === unappliedCorrection.path && authorizedUnappliedCorrection) {
    return "allow-unapplied-correction";
  }
  if (existsInBase) return "block-history-change";
  return "block-ambiguous";
}

function validateUnappliedCorrection(base, status, path, existsInBase) {
  if (status !== "M" || path !== unappliedCorrection.path || !existsInBase) return false;
  try {
    const baseBlobSha = execFileSync("git", ["rev-parse", `${base}:${path}`], { encoding: "utf8" }).trim();
    if (baseBlobSha !== unappliedCorrection.originalBlobSha) return false;

    const manifest = JSON.parse(readFileSync(unappliedCorrection.manifestPath, "utf8"));
    const appliedVersionsText = readFileSync(unappliedCorrection.appliedVersionsPath, "utf8");
    const appliedVersionsSha256 = createHash("sha256").update(appliedVersionsText).digest("hex");
    const appliedVersions = new Set(appliedVersionsText.split(/\r?\n/).filter(Boolean));
    const priorPolicy = readFileSync("supabase/migrations/20260928154411_rc199_marketplace_order_read_grants_v2.sql", "utf8");
    const correctedSource = readFileSync(path, "utf8");

    return manifest.workflow_run_id === "38993809648" &&
      manifest.review_status === "PENDING_REVIEW" &&
      manifest.last_applied_migration_version === "20261008222845" &&
      manifest.applied_migration_count === 283 &&
      manifest.applied_migration_versions_sha256 === unappliedCorrection.expectedAppliedVersionsSha256 &&
      manifest.schema_only === true &&
      manifest.data_included === false &&
      manifest.production_writes_performed === false &&
      manifest.deployment_approved === false &&
      appliedVersionsSha256 === unappliedCorrection.expectedAppliedVersionsSha256 &&
      appliedVersions.has(unappliedCorrection.previousAppliedVersion) &&
      !appliedVersions.has(unappliedCorrection.version) &&
      /create policy order_status_history_customer_select_own/i.test(priorPolicy) &&
      /customer_id = auth\.uid\(\)/i.test(priorPolicy) &&
      /create policy orders_customer_select_own/i.test(correctedSource) &&
      /order_status_history_customer_select_own_policy_contract_mismatch/i.test(correctedSource) &&
      /orders_customer_select_own_policy_contract_mismatch/i.test(correctedSource) &&
      /grant select on public\.orders to authenticated/i.test(correctedSource) &&
      /grant select on public\.order_status_history to authenticated/i.test(correctedSource);
  } catch {
    return false;
  }
}

if (selfTest) {
  const cases = [
    ["A", "supabase/migrations/20990101000000_new_change.sql", false, false, "allow-new"],
    ["M", "supabase/migrations/20261009010000_old.sql", true, false, "block-history-change"],
    ["D", "supabase/migrations/20261009010000_old.sql", true, false, "block-history-change"],
    ["A", "web/app.js", false, false, "ignore"],
    ["M", "supabase/migrations/20990101000000_new_change.sql", false, false, "block-ambiguous"],
    ["M", unappliedCorrection.path, true, true, "allow-unapplied-correction"],
    ["M", "supabase/migrations/20260928154411_rc199_marketplace_order_read_grants_v2.sql", true, true, "block-history-change"]
  ];
  for (const [status, path, existsInBase, authorizedCorrection, expected] of cases) {
    const actual = decision(status, path, existsInBase, authorizedCorrection);
    if (actual !== expected) {
      console.error("Self-test failed:", { status, path, existsInBase, expected, actual });
      process.exit(1);
    }
  }
  console.log("Migration immutability guard self-test PASS.");
  process.exit(0);
}

const baseRef = process.env.GITHUB_BASE_REF;
if (!baseRef) {
  console.error("GITHUB_BASE_REF is required; this validator must run in a pull_request workflow.");
  process.exit(2);
}
const base = `origin/${baseRef}`;
let diff;
try {
  diff = execFileSync("git", [
    "diff", "--name-status", "--no-renames", `${base}...HEAD`, "--", migrationPrefix
  ], { encoding: "utf8" });
} catch (error) {
  console.error("Could not compare migration history to the PR base:", error.message);
  process.exit(2);
}

const failures = [];
for (const line of diff.split("\n").filter(Boolean)) {
  const [status, path] = line.split("\t");
  if (!path || !isMigrationPath(path)) continue;
  let existsInBase = false;
  try {
    execFileSync("git", ["cat-file", "-e", `${base}:${path}`], { stdio: "ignore" });
    existsInBase = true;
  } catch {
    existsInBase = false;
  }
  const authorizedCorrection = validateUnappliedCorrection(base, status, path, existsInBase);
  const result = decision(status, path, existsInBase, authorizedCorrection);
  if (result === "allow-unapplied-correction") {
    console.log("Narrowly allowed unapplied migration correction after validating the pinned read-only production migration ledger: " + path);
    continue;
  }
  if (result === "block-history-change" || result === "block-ambiguous") {
    failures.push({ status, path, result });
  }
}

if (failures.length) {
  console.error("Migration immutability FAILED. Never edit or delete an existing migration file; add a new forward-only migration instead.");
  for (const failure of failures) {
    console.error(`- ${failure.status} ${failure.path} (${failure.result})`);
  }
  process.exit(1);
}

console.log("Migration immutability PASS: only new migration files may be added; existing migration history is unchanged.");
