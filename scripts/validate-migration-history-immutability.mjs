import { execFileSync } from "node:child_process";

const migrationPrefix = "supabase/migrations/";
const selfTest = process.argv.includes("--self-test");

function isMigrationPath(path) {
  return path.startsWith(migrationPrefix) && path.endsWith(".sql");
}

function decision(status, path, existsInBase) {
  if (!isMigrationPath(path)) return "ignore";
  if (status === "A" && !existsInBase) return "allow-new";
  if (existsInBase) return "block-history-change";
  return "block-ambiguous";
}

if (selfTest) {
  const cases = [
    ["A", "supabase/migrations/20990101000000_new_change.sql", false, "allow-new"],
    ["M", "supabase/migrations/20261009010000_old.sql", true, "block-history-change"],
    ["D", "supabase/migrations/20261009010000_old.sql", true, "block-history-change"],
    ["A", "web/app.js", false, "ignore"],
    ["M", "supabase/migrations/20990101000000_new_change.sql", false, "block-ambiguous"]
  ];
  for (const [status, path, existsInBase, expected] of cases) {
    const actual = decision(status, path, existsInBase);
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
  const result = decision(status, path, existsInBase);
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
