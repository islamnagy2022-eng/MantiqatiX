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
  assert.equal(collisions.length, 1, "one duplicated migration version should be detected");
  assert.equal(collisions[0].version, "20261009170000");
  assert.deepEqual(collisionsForPullRequest(collisions, 10).length, 1);
  assert.deepEqual(collisionsForPullRequest(collisions, 20).length, 1);
  assert.equal(collisionsForPullRequest(collisions, 30).length, 0);
  assert.equal(crossPullRequestCollisions([
    { prNumber: 40, entries: migrationEntries(40, [{ filename: "supabase/migrations/20261010050000_same.sql", sha: "same" }]) },
    { prNumber: 41, entries: migrationEntries(41, [{ filename: "supabase/migrations/20261010050000_same.sql", sha: "same" }]) }
  ]).length, 0, "same path and same blob is not a collision");
  assert.equal(crossPullRequestCollisions([
    { prNumber: 50, entries: migrationEntries(50, [{ filename: "supabase/migrations/20261010060000_same.sql", sha: "one" }]) },
    { prNumber: 51, entries: migrationEntries(51, [{ filename: "supabase/migrations/20261010060000_same.sql", sha: "two" }]) }
  ]).length, 1, "same path with divergent content is a collision");
  console.log("Cross-PR migration collision detector self-test: PASS");
  process.exit(0);
}

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const currentPrNumber = Number(process.env.PULL_REQUEST_NUMBER);
if (!token || !repository || !Number.isInteger(currentPrNumber) || currentPrNumber < 1) {
  console.error("Missing GITHUB_TOKEN, GITHUB_REPOSITORY, or PULL_REQUEST_NUMBER.");
  process.exit(2);
}

async function githubGet(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!response.ok) {
    throw new Error("GitHub API request failed (" + response.status + "): " + url);
  }
  return response.json();
}

async function getAllPages(url) {
  const results = [];
  let page = 1;
  while (true) {
    const separator = url.includes("?") ? "&" : "?";
    const batch = await githubGet(url + separator + "per_page=100&page=" + page);
    if (!Array.isArray(batch) || batch.length === 0) break;
    results.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return results;
}

try {
  const current = await githubGet("https://api.github.com/repos/" + repository + "/pulls/" + currentPrNumber);
  const openPulls = await getAllPages("https://api.github.com/repos/" + repository + "/pulls?state=open");
  const comparable = openPulls.filter(pr =>
    pr.number !== currentPrNumber &&
    pr.base?.ref === current.base?.ref &&
    pr.base?.repo?.full_name === current.base?.repo?.full_name
  );

  const currentFiles = await getAllPages("https://api.github.com/repos/" + repository + "/pulls/" + currentPrNumber + "/files");
  const all = [{
    prNumber: currentPrNumber,
    url: current.html_url,
    base: current.base,
    entries: migrationEntries(currentPrNumber, currentFiles)
  }];

  for (const pr of comparable) {
    const files = await getAllPages("https://api.github.com/repos/" + repository + "/pulls/" + pr.number + "/files");
    const entries = migrationEntries(pr.number, files);
    if (entries.length) all.push({ prNumber: pr.number, url: pr.html_url, base: pr.base, entries });
  }

  const collisions = crossPullRequestCollisions(all);
  const relevantCollisions = collisionsForPullRequest(collisions, currentPrNumber);
  if (relevantCollisions.length) {
    console.error("Cross-PR migration version collision detected involving the current PR:");
    for (const collision of relevantCollisions) {
      const left = all.find(pr => pr.prNumber === collision.leftPr);
      const right = all.find(pr => pr.prNumber === collision.rightPr);
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
    console.warn("Known cross-PR migration collisions exist elsewhere, but the current PR does not introduce or modify a colliding migration; reporting as warnings.");
    for (const collision of collisions) {
      console.warn("- version " + collision.version + " between PR #" + collision.leftPr + " and PR #" + collision.rightPr);
    }
  }

  console.log(
    "Cross-PR migration collision check PASS for current PR #" + currentPrNumber +
    ": audited " + all.length +
    " open PR(s) with migration changes targeting " + current.base.ref +
    "; unrelated existing collisions are warnings."
  );
} catch (error) {
  console.error("Cross-PR migration collision check could not complete:", error instanceof Error ? error.message : "unknown error");
  process.exit(2);
}
