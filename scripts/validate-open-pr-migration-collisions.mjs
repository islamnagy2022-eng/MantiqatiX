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

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const currentPrNumber = Number(process.env.PULL_REQUEST_NUMBER);
const baseRef = process.env.PULL_REQUEST_BASE_REF || "main";
if (!token || !repository || !Number.isInteger(currentPrNumber) || currentPrNumber < 1 ||
    !/^[A-Za-z0-9._/-]+$/.test(baseRef) || baseRef.includes("..")) {
  console.error("Missing or invalid GITHUB_TOKEN, GITHUB_REPOSITORY, PULL_REQUEST_NUMBER, or PULL_REQUEST_BASE_REF.");
  process.exit(2);
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024
  }).trim();
}

async function graphql(query, variables) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({ query, variables })
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error("GitHub GraphQL request failed (" + response.status + "): " + body.slice(0, 400));
  }
  const payload = JSON.parse(body);
  if (payload.errors?.length) {
    throw new Error("GitHub GraphQL returned errors: " + payload.errors.map(e => e.message).join("; "));
  }
  return payload.data;
}

async function getOpenPullRequests(owner, name) {
  const query = "query($owner: String!, $name: String!, $cursor: String) {\n" +
    " repository(owner: $owner, name: $name) {\n" +
    "  pullRequests(first: 100, states: OPEN, after: $cursor, orderBy: {field: UPDATED_AT, direction: DESC}) {\n" +
    "   pageInfo { hasNextPage endCursor }\n" +
    "   nodes { number title url baseRefName baseRepository { nameWithOwner } headRefOid }\n" +
    "  }\n" +
    " }\n" +
    "}";
  const pulls = [];
  let cursor = null;
  do {
    const data = await graphql(query, { owner, name, cursor });
    const connection = data?.repository?.pullRequests;
    if (!connection) throw new Error("GraphQL did not return the repository pull-request connection.");
    pulls.push(...connection.nodes);
    cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (cursor);
  return pulls;
}

function migrationEntriesForHead(prNumber, headRef) {
  const mergeBase = git(["merge-base", "refs/remotes/origin/" + baseRef, headRef]);
  const output = git([
    "diff", "--name-status", "--no-renames",
    mergeBase, headRef, "--", "supabase/migrations"
  ]);
  const entries = [];
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [status, file] = line.split("\t");
    if (!file || status === "D") continue;
    const match = migrationPattern.exec(file);
    if (!match) continue;
    const sha = git(["rev-parse", headRef + ":" + file]);
    entries.push({ version: match[1], file, prNumber, sha });
  }
  return entries;
}

try {
  const [owner, name] = repository.split("/");
  if (!owner || !name) throw new Error("GITHUB_REPOSITORY must use owner/name format.");
  const pulls = await getOpenPullRequests(owner, name);
  const comparable = pulls.filter(pr =>
    pr.baseRefName === baseRef &&
    pr.baseRepository?.nameWithOwner === repository &&
    Number.isInteger(pr.number) &&
    typeof pr.headRefOid === "string"
  );
  const current = comparable.find(pr => pr.number === currentPrNumber);
  if (!current) throw new Error("Current PR #" + currentPrNumber + " is not present in the open pull-request list for base " + baseRef + ".");

  // Fetch the target branch plus each open PR head via its read-only hidden ref.
  // This avoids one REST API request per PR file list and reduces API rate pressure.
  git(["fetch", "--no-tags", "origin", "+refs/heads/" + baseRef + ":refs/remotes/origin/" + baseRef]);
  const refspecs = comparable.map(pr => "+refs/pull/" + pr.number + "/head:refs/remotes/origin/pr-head/" + pr.number);
  const fetched = new Set();
  for (let offset = 0; offset < refspecs.length; offset += 20) {
    const batch = refspecs.slice(offset, offset + 20);
    try {
      git(["fetch", "--no-tags", "origin", ...batch]);
      batch.forEach((_, idx) => fetched.add(comparable[offset + idx].number));
    } catch {
      for (let idx = 0; idx < batch.length; idx++) {
        const pr = comparable[offset + idx];
        try {
          git(["fetch", "--no-tags", "origin", batch[idx]]);
          fetched.add(pr.number);
        } catch {
          if (pr.number === currentPrNumber) throw new Error("Could not fetch the current PR head ref.");
          console.warn("Skipping PR #" + pr.number + " because its head ref disappeared during the scan.");
        }
      }
    }
  }
  if (!fetched.has(currentPrNumber)) throw new Error("Current PR head ref was not fetched; refusing to skip collision detection.");

  const all = [];
  for (const pr of comparable) {
    if (!fetched.has(pr.number)) continue;
    all.push({ prNumber: pr.number, title: pr.title, url: pr.url, entries: migrationEntriesForHead(pr.number, "refs/remotes/origin/pr-head/" + pr.number) });
  }

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
      const left = all.find(pr => pr.prNumber === collision.leftPr);
      const right = all.find(pr => pr.prNumber === collision.rightPr);
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
    ": audited " + all.length + " open PR(s) targeting " + baseRef +
    "; GraphQL listing plus Git ref diffs."
  );
} catch (error) {
  console.error("Cross-PR migration collision check could not complete:", error instanceof Error ? error.message : "unknown error");
  process.exit(2);
}
