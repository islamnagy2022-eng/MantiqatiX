#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const migrationPattern = /^supabase\/migrations\/(\d{14})_.+\.sql$/;

function migrationEntries(prNumber, files) {
  return files.flatMap(item => {
    // GitHub lists deleted paths in a PR's changed-file list. A removed migration
    // no longer participates in the candidate migration set and must not create
    // a false-positive collision with a surviving migration in another PR.
    if (typeof item !== "string" && item.status === "removed") return [];
    const file = typeof item === "string" ? item : item.filename;
    const match = migrationPattern.exec(file);
    return match ? [{ version: match[1], file, prNumber, sha: typeof item === "string" ? null : item.sha }] : [];
  });
}

function crossPullRequestCollisions(pullRequests) {
  const collisions = [];
  for (let i = 0; i < pullRequests.length; i++) {
    const left = pullRequests[i];
    for (let j = i + 1; j < pullRequests.length; j++) {
      const right = pullRequests[j];
      for (const a of left.entries) {
        for (const b of right.entries) {
          if (a.version !== b.version) continue;
          if (a.file !== b.file || (a.sha && b.sha && a.sha !== b.sha)) {
            collisions.push({
              version: a.version,
              leftFile: a.file,
              leftPr: left.prNumber,
              rightFile: b.file,
              rightPr: right.prNumber
            });
          }
        }
      }
    }
  }
  return collisions;
}

function collisionsForPullRequest(collisions, prNumber) {
  return collisions.filter(collision => collision.leftPr === prNumber || collision.rightPr === prNumber);
}

function isRateLimited403(status, remaining, body) {
  return status === 403 && (
    String(remaining ?? "") === "0" ||
    /api rate limit exceeded|secondary rate limit|abuse detection/i.test(String(body ?? ""))
  );
}

if (process.argv.includes("--self-test")) {
  const candidates = [
    { prNumber: 10, entries: migrationEntries(10, ["supabase/migrations/20261009170000_rc430_payment.sql"]) },
    { prNumber: 20, entries: migrationEntries(20, ["supabase/migrations/20261009170000_mantigo_scope.sql", "supabase/migrations/20261010030000_rc441_scope.sql"]) },
    { prNumber: 30, entries: migrationEntries(30, ["supabase/migrations/20261010040000_rc442_erp.sql"]) }
  ];
  const collisions = crossPullRequestCollisions(candidates);
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].version, "20261009170000");
  assert.equal(collisionsForPullRequest(collisions, 10).length, 1);
  assert.equal(collisionsForPullRequest(collisions, 20).length, 1);
  assert.equal(collisionsForPullRequest(collisions, 30).length, 0);
  assert.equal(collisionsForPullRequest(collisions, 99).length, 0);
  assert.equal(isRateLimited403(403, "0", '{"message":"API rate limit exceeded"}'), true);
  assert.equal(isRateLimited403(403, "4999", '{"message":"Resource not accessible by integration"}'), false);
  assert.equal(isRateLimited403(403, "4999", '{"message":"You have exceeded a secondary rate limit"}'), true);
  assert.equal(crossPullRequestCollisions([candidates[0], candidates[2]]).length, 0);
  // Deleted migration paths must not be treated as active candidate migrations.
  assert.equal(migrationEntries(60, [{ filename: "supabase/migrations/20261009170000_removed.sql", status: "removed", sha: "deleted" }]).length, 0);
  assert.equal(crossPullRequestCollisions([
    { prNumber: 61, entries: migrationEntries(61, [{ filename: "supabase/migrations/20261009170000_removed.sql", status: "removed", sha: "deleted" }]) },
    { prNumber: 62, entries: migrationEntries(62, ["supabase/migrations/20261009170000_rc430_payment.sql"]) }
  ]).length, 0);
  assert.equal(crossPullRequestCollisions([
    { prNumber: 40, entries: migrationEntries(40, [{ filename: "supabase/migrations/20261010050000_same.sql", sha: "same" }]) },
    { prNumber: 41, entries: migrationEntries(41, [{ filename: "supabase/migrations/20261010050000_same.sql", sha: "same" }]) }
  ]).length, 0);
  assert.equal(crossPullRequestCollisions([
    { prNumber: 50, entries: migrationEntries(50, [{ filename: "supabase/migrations/20261010060000_same.sql", sha: "one" }]) },
    { prNumber: 51, entries: migrationEntries(51, [{ filename: "supabase/migrations/20261010060000_same.sql", sha: "two" }]) }
  ]).length, 1);
  console.log("Cross-PR migration collision detector self-test: PASS");
  process.exit(0);
}

const repository = process.env.GITHUB_REPOSITORY;
const currentPrNumber = Number(process.env.PULL_REQUEST_NUMBER);
const baseRef = process.env.PULL_REQUEST_BASE_REF || "main";
if (!repository || !Number.isInteger(currentPrNumber) || currentPrNumber < 1 ||
    !/^[A-Za-z0-9._/-]+$/.test(baseRef) || baseRef.includes("..")) {
  console.error("Missing or invalid GITHUB_REPOSITORY, PULL_REQUEST_NUMBER, or PULL_REQUEST_BASE_REF.");
  process.exit(2);
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024
  }).trim();
}

function isAncestor(candidateBase, targetRef) {
  try {
    git(["merge-base", "--is-ancestor", candidateBase, targetRef]);
    return true;
  } catch {
    return false;
  }
}

function entriesForMergeRef(prNumber, mergeRef) {
  const parent = git(["rev-parse", mergeRef + "^1"]);
  const targetRef = "refs/remotes/origin/" + baseRef;
  // Only compare PRs whose synthetic merge base belongs to the selected target
  // branch's history. This keeps feature-branch PRs out of the main release set.
  if (!isAncestor(parent, targetRef)) return { prNumber, entries: [], comparable: false };

  const output = git([
    "diff", "--name-status", "--no-renames",
    mergeRef + "^1", mergeRef, "--", "supabase/migrations"
  ]);
  const entries = [];
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [status, file] = line.split("\t");
    if (!file || status === "D") continue;
    const match = migrationPattern.exec(file);
    if (!match) continue;
    const sha = git(["rev-parse", mergeRef + ":" + file]);
    entries.push({ version: match[1], file, prNumber, sha });
  }
  return { prNumber, entries, comparable: true };
}

try {
  // REST API calls can share an installation-wide rate limit across many CI
  // runs. Enumerate GitHub's read-only PR merge refs through Git instead of
  // requesting every open PR and its changed-file list via REST.
  git([
    "fetch", "--no-tags", "origin",
    "+refs/heads/" + baseRef + ":refs/remotes/origin/" + baseRef,
    "+refs/pull/*/merge:refs/remotes/origin/pr-merge/*"
  ]);

  const refs = git([
    "for-each-ref", "--format=%(refname)", "refs/remotes/origin/pr-merge/"
  ]).split(/\r?\n/).filter(Boolean);
  if (!refs.length) throw new Error("No open pull-request merge refs were available from origin.");

  const all = [];
  let currentFound = false;
  for (const refName of refs) {
    const match = /\/pr-merge\/(\d+)$/.exec(refName);
    if (!match) continue;
    const prNumber = Number(match[1]);
    const result = entriesForMergeRef(prNumber, refName);
    if (prNumber === currentPrNumber) {
      currentFound = true;
      if (!result.comparable) throw new Error("Current PR merge base is not in target branch history; cannot safely compare migration versions.");
    }
    if (result.comparable && result.entries.length) {
      all.push({ prNumber, entries: result.entries });
    } else if (result.comparable) {
      all.push({ prNumber, entries: [] });
    }
  }
  if (!currentFound) throw new Error("Current PR #" + currentPrNumber + " merge ref was not found; refusing to skip collision detection.");

  const collisions = crossPullRequestCollisions(all);
  const relevantCollisions = collisionsForPullRequest(collisions, currentPrNumber);
  if (relevantCollisions.length) {
    console.error("Cross-PR migration version collision detected involving the current PR:");
    for (const collision of relevantCollisions) {
      console.error(
        "- version " + collision.version +
        ": PR #" + collision.leftPr + " " + collision.leftFile +
        " conflicts with PR #" + collision.rightPr + " " + collision.rightFile
      );
      console.error("  PR #" + collision.leftPr + ": https://github.com/" + repository + "/pull/" + collision.leftPr);
      console.error("  PR #" + collision.rightPr + ": https://github.com/" + repository + "/pull/" + collision.rightPr);
    }
    console.error("Do not silence this check by renaming an already-applied migration. Reconcile the intended migration history and choose one canonical release path.");
    process.exit(1);
  }

  if (collisions.length) {
    console.warn("Known cross-PR migration collisions exist elsewhere, but the current PR does not introduce or modify a colliding migration; not blocking this unrelated PR.");
    for (const collision of collisions) {
      console.warn("- version " + collision.version + " between PR #" + collision.leftPr + " and PR #" + collision.rightPr);
    }
  }

  console.log(
    "Cross-PR migration collision check PASS for current PR #" + currentPrNumber +
    ": audited " + all.length +
    " GitHub pull-request merge ref(s) based on " + baseRef +
    "; no REST API calls required."
  );
} catch (error) {
  console.error("Cross-PR migration collision check could not complete:", error instanceof Error ? error.message : "unknown error");
  process.exit(2);
}
