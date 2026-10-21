#!/usr/bin/env node
import assert from "node:assert/strict";

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
if (!token || !repository || !Number.isInteger(currentPrNumber) || currentPrNumber < 1) {
  console.error("Missing GITHUB_TOKEN, GITHUB_REPOSITORY, or PULL_REQUEST_NUMBER.");
  process.exit(2);
}

async function githubGet(url) {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: "Bearer " + token,
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });
      if (response.ok) return response.json();

      const retryable = response.status === 429 || [500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt === maxAttempts - 1) {
        const detail = await response.text().catch(() => "");
        throw new Error("GitHub API request failed (" + response.status + "): " + url +
          (detail ? " — " + detail.slice(0, 500) : ""));
      }
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      const delayMs = retryAfter > 0
        ? Math.min(retryAfter * 1000, 10000)
        : Math.min(300 * (2 ** attempt), 5000);
      console.warn("Retrying transient GitHub API " + response.status + " response in " + delayMs + "ms (" + (attempt + 1) + "/" + maxAttempts + "): " + url);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } catch (error) {
      if (attempt === maxAttempts - 1 || !(error instanceof TypeError)) throw error;
      const delayMs = Math.min(300 * (2 ** attempt), 5000);
      console.warn("Retrying transient GitHub API network error in " + delayMs + "ms (" + (attempt + 1) + "/" + maxAttempts + "): " + url);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("GitHub API request exhausted retry budget: " + url);
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
  // Prefer event-provided base metadata so the current PR lookup does not require
  // an additional API call. The open-PR listing below remains mandatory and fail-closed.
  const baseRef = process.env.CURRENT_PR_BASE_REF;
  const baseRepo = process.env.CURRENT_PR_BASE_REPO;
  const current = baseRef && baseRepo
    ? { base: { ref: baseRef, repo: { full_name: baseRepo } } }
    : await githubGet("https://api.github.com/repos/" + repository + "/pulls/" + currentPrNumber);
  // Use one GraphQL request to avoid exhausting the GitHub App installation
  // REST quota by fetching every open PR and then each PR's file list separately.
  const [owner, repoName] = repository.split("/");
  if (!owner || !repoName) throw new Error("GITHUB_REPOSITORY must be owner/repository.");
  const query = `
    query MigrationCollisionAudit($owner: String!, $name: String!, $baseRef: String!) {
      repository(owner: $owner, name: $name) {
        pullRequests(first: 100, states: OPEN, baseRefName: $baseRef, orderBy: {field: UPDATED_AT, direction: DESC}) {
          pageInfo { hasNextPage }
          nodes {
            number
            title
            url
            baseRefName
            baseRepository { nameWithOwner }
            files(first: 100) {
              pageInfo { hasNextPage endCursor }
              nodes { path changeType }
            }
          }
        }
      }
    }`;
  const graphResponse = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({ query, variables: { owner, name: repoName, baseRef: current.base.ref } })
  });
  const graphBody = await graphResponse.json().catch(() => ({}));
  if (!graphResponse.ok || graphBody.errors?.length) {
    const detail = (graphBody.errors || []).map(item => item.message).join("; ");
    throw new Error("GitHub GraphQL migration audit failed (" + graphResponse.status + ")" + (detail ? ": " + detail : ""));
  }
  const openPulls = graphBody.data?.repository?.pullRequests;
  if (!openPulls || openPulls.pageInfo?.hasNextPage) {
    throw new Error("Migration audit cannot safely enumerate all open PRs in one page; refusing to pass incomplete results.");
  }

  const all = [];
  for (const pr of openPulls.nodes) {
    if (pr.baseRefName !== current.base.ref || pr.baseRepository?.nameWithOwner?.toLowerCase() !== current.base.repo.full_name.toLowerCase()) continue;
    const fileNodes = [...(pr.files?.nodes || [])];
    let filePage = pr.files;
    while (filePage?.pageInfo?.hasNextPage) {
      const pageQuery = `
        query MigrationCollisionFilePage($owner: String!, $name: String!, $number: Int!, $cursor: String!) {
          repository(owner: $owner, name: $name) {
            pullRequest(number: $number) {
              files(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes { path changeType }
              }
            }
          }
        }`;
      const pageResponse = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28"
        },
        body: JSON.stringify({
          query: pageQuery,
          variables: { owner, name: repoName, number: pr.number, cursor: filePage.pageInfo.endCursor }
        })
      });
      const pageBody = await pageResponse.json().catch(() => ({}));
      if (!pageResponse.ok || pageBody.errors?.length) {
        const detail = (pageBody.errors || []).map(item => item.message).join("; ");
        throw new Error("Could not enumerate changed files for PR #" + pr.number + " (" + pageResponse.status + ")" + (detail ? ": " + detail : ""));
      }
      filePage = pageBody.data?.repository?.pullRequest?.files;
      if (!filePage) throw new Error("GitHub returned no changed-file page for PR #" + pr.number + "; refusing to pass incomplete results.");
      fileNodes.push(...(filePage.nodes || []));
    }
    const files = fileNodes.map(file => ({
      filename: file.path,
      status: file.changeType === "DELETED" ? "removed" : file.changeType.toLowerCase()
    }));
    const entries = migrationEntries(pr.number, files);
    if (entries.length) all.push({ prNumber: pr.number, title: pr.title, url: pr.url, base: { ref: pr.baseRefName, repo: { full_name: pr.baseRepository.nameWithOwner } }, entries });
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
    console.warn("Known cross-PR migration collisions exist elsewhere, but the current PR does not introduce or modify a colliding migration; not blocking this unrelated PR.");
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
