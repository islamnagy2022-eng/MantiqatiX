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
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].version, "20261009170000");
  assert.equal(crossPullRequestCollisions([candidates[0], candidates[2]]).length, 0);
  assert.equal(crossPullRequestCollisions([
    { prNumber: 40, entries: migrationEntries(40, [{ filename: "supabase/migrations/20261010050000_same.sql", sha: "aaa" }]) },
    { prNumber: 41, entries: migrationEntries(41, [{ filename: "supabase/migrations/20261010050000_same.sql", sha: "bbb" }]) }
  ]).length, 1);
  console.log("Cross-PR migration collision guard self-test PASS.");
  process.exit(0);
}

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const currentPrNumber = Number(process.env.PULL_REQUEST_NUMBER);
if (!repository || !token || !Number.isInteger(currentPrNumber) || currentPrNumber < 1) {
  console.error("Required environment: GITHUB_REPOSITORY, GITHUB_TOKEN, PULL_REQUEST_NUMBER.");
  process.exit(2);
}

async function githubJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!response.ok) {
    throw new Error("GitHub API " + response.status + " for " + url + ": " + (await response.text()).slice(0, 500));
  }
  return response.json();
}

async function allPages(url) {
  const results = [];
  for (let page = 1; ; page++) {
    const separator = url.includes("?") ? "&" : "?";
    const batch = await githubJson(url + separator + "per_page=100&page=" + page);
    if (!Array.isArray(batch)) throw new Error("Expected a GitHub API array from " + url);
    results.push(...batch);
    if (batch.length < 100) return results;
  }
}

const apiRoot = "https://api.github.com/repos/" + repository;
const currentPr = await githubJson(apiRoot + "/pulls/" + currentPrNumber);
const openPrs = await allPages(apiRoot + "/pulls?state=open");
const sameBaseOpenPrs = openPrs.filter(pr =>
  pr.base?.ref === currentPr.base?.ref &&
  pr.base?.repo?.full_name === repository
);

const candidates = [];
for (const pr of sameBaseOpenPrs) {
  const changedFiles = await allPages(apiRoot + "/pulls/" + pr.number + "/files");
  const entries = migrationEntries(pr.number, changedFiles);
  if (entries.length) {
    candidates.push({ prNumber: pr.number, title: pr.title, url: pr.html_url, entries });
  }
}

const collisions = crossPullRequestCollisions(candidates);
if (collisions.length) {
  console.error("Cross-PR migration version collision detected across open PRs targeting " + currentPr.base.ref + ":");
  for (const collision of collisions) {
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

console.log(
  "Cross-PR migration collision check PASS: audited " + candidates.length +
  " open PR(s) with migration changes targeting " + currentPr.base.ref + "."
);
