#!/usr/bin/env node
import assert from "node:assert/strict";

const migrationPattern = /^supabase\/migrations\/(\d{14})_.+\.sql$/;

function migrationEntries(prNumber, files) {
  return files.flatMap(file => {
    const match = migrationPattern.exec(file);
    return match ? [{ version: match[1], file, prNumber }] : [];
  });
}

function crossPullRequestCollisions(currentEntries, otherPullRequests) {
  const collisions = [];
  for (const current of currentEntries) {
    for (const other of otherPullRequests) {
      for (const candidate of other.entries) {
        if (current.version === candidate.version) {
          collisions.push({
            version: current.version,
            currentFile: current.file,
            currentPr: current.prNumber,
            otherFile: candidate.file,
            otherPr: other.prNumber
          });
        }
      }
    }
  }
  return collisions;
}

if (process.argv.includes("--self-test")) {
  const current = migrationEntries(10, [
    "supabase/migrations/20261009170000_rc430_payment.sql",
    "docs/release.md"
  ]);
  const other = [{
    prNumber: 20,
    entries: migrationEntries(20, [
      "supabase/migrations/20261009170000_mantigo_scope.sql",
      "supabase/migrations/20261010030000_rc441_scope.sql"
    ])
  }];
  const collisions = crossPullRequestCollisions(current, other);
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].version, "20261009170000");
  assert.equal(crossPullRequestCollisions(
    migrationEntries(10, ["supabase/migrations/20261009170000_rc430_payment.sql"]),
    [{ prNumber: 20, entries: migrationEntries(20, ["supabase/migrations/20261010030000_rc441_scope.sql"]) }]
  ).length, 0);
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
const currentFiles = await allPages(apiRoot + "/pulls/" + currentPrNumber + "/files");
const currentEntries = migrationEntries(currentPrNumber, currentFiles.map(file => file.filename));
if (!currentEntries.length) {
  console.log("No migration files changed in PR #" + currentPrNumber + "; cross-PR migration collision check not applicable.");
  process.exit(0);
}

const openPrs = await allPages(apiRoot + "/pulls?state=open");
const sameBaseOpenPrs = openPrs.filter(pr =>
  pr.number !== currentPrNumber &&
  pr.base?.ref === currentPr.base?.ref &&
  pr.base?.repo?.full_name === repository
);

const otherPullRequests = [];
for (const pr of sameBaseOpenPrs) {
  const changedFiles = await allPages(apiRoot + "/pulls/" + pr.number + "/files");
  const entries = migrationEntries(pr.number, changedFiles.map(file => file.filename));
  if (entries.length) otherPullRequests.push({ prNumber: pr.number, title: pr.title, url: pr.html_url, entries });
}

const collisions = crossPullRequestCollisions(currentEntries, otherPullRequests);
if (collisions.length) {
  console.error("Cross-PR migration version collision detected. Resolve the competing migration path before merge:");
  for (const collision of collisions) {
    const other = otherPullRequests.find(pr => pr.prNumber === collision.otherPr);
    console.error(
      "- version " + collision.version +
      ": PR #" + collision.currentPr + " " + collision.currentFile +
      " conflicts with PR #" + collision.otherPr + " " + collision.otherFile +
      (other?.url ? " (" + other.url + ")" : "")
    );
  }
  console.error("Do not silence this check by renaming an already-applied migration. Reconcile the intended migration history and choose one canonical release path.");
  process.exit(1);
}

console.log(
  "Cross-PR migration collision check PASS: " + currentEntries.length +
  " migration file(s) in PR #" + currentPrNumber +
  "; checked " + otherPullRequests.length + " other open PR(s) targeting " + currentPr.base.ref + "."
);
