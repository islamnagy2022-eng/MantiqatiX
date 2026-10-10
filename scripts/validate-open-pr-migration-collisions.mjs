#!/usr/bin/env node
import assert from "node:assert/strict";

const migrationPattern = /^supabase\/migrations\/(\d{14})_.+\.sql$/;

function migrationEntries(prNumber, files) {
  return files.flatMap(item => {
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

if (process.argv.includes("--self-test")) {
  const candidates = [
    {
      prNumber: 10,
      entries: migrationEntries(10, [
        "supabase/migrations/20261009170000_rc430_payment.sql",
        "docs/release.md"
      ])
    },
    {
      prNumber: 20,
      entries: migrationEntries(20, [
        "supabase/migrations/20261009170000_mantigo_scope.sql",
        "supabase/migrations/20261010030000_rc441_scope.sql"
      ])
    },
    {
      prNumber: 30,
      entries: migrationEntries(30, [
        "supabase/migrations/20261010040000_rc442_erp.sql"
      ])
    }
  ];
  const collisions = crossPullRequestCollisions(candidates);
const relevantCollisions = collisionsForPullRequest(collisions, currentPrNumber);
if (relevantCollisions.length) {
  console.error("Cross-PR migration version collision detected involving the current PR:");
  for (const collision of relevantCollisions) {
    const left = candidates.find(pr => pr.prNumber === collision.leftPr);
    const right = candidates.find(pr => pr.prNumber === collision.rightPr);
    console.error(
      "- version " + collision.version +
      ": PR #" + collision.leftPr + " " + collision.leftFile +
      " conflicts with PR #" + collision.rightPr + " " + collision.rightFile
    );
    if (left?.url) console.error("  PR #" + collision.leftPr + ": " + left.url);
    if (right?.url) console.error("  PR #" + collision.rightPr + ": " + right.url);
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
  ": audited " + candidates.length +
  " open PR(s) with migration changes targeting " + currentPr.base.ref +
  "; unrelated existing collisions are reported as warnings."
);
