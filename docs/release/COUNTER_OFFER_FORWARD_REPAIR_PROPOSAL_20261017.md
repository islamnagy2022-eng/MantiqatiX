# Counter-Offer RPC — Evidence-Led Forward Repair Proposal

**Date:** 2026-10-17  
**Status:** DESIGN PROPOSAL ONLY — NOT APPROVED, NOT IMPLEMENTED  
**Production release gate:** BLOCKED / NOT CERTIFIED  
**Scope:** source-provenance recovery and disposable migration replay design. This document authorizes no production mutation, migration, grant change, function deployment, or merge.

## Executive decision

The missing historical creation source for `public.counter_offer_indrive_bid(uuid,uuid,numeric)` remains unrecovered. A current live-derived definition is available in an unmerged review branch, but that artifact explicitly says it is a **test-only live snapshot, not historical creation DDL**. It must not be relabeled or copied into a historical migration.

The immediate replay failure is a confirmed dependency-order gap: `20260927095000_revoke_unused_security_definer_execute.sql` executes a `REVOKE EXECUTE` against the function before a clean replay has created it. A new forward migration with a later version cannot, by itself, repair this earlier failure.

## Evidence inspected

1. **Current revoke migration source** — blob SHA `8d3fb7330680056b45b4992d298ce1363f069e9d`, path `supabase/migrations/20260927095000_revoke_unused_security_definer_execute.sql`. It contains the revoke statement but no function-creation DDL.
2. **Live-derived test snapshot** — PR #207 branch `reconcile/rc425-458-current-main-20261011`, head `676adc5ceeaf774dd27329b42361355b7b2c08eb`; file `supabase/tests/baselines/legacy_security_definer_functions.sql`, blob SHA `ed4270f8fbfa2881fbfd6b251161ec4cbe7fd2c7`. Its header says it was extracted from read-only `pg_get_functiondef/pg_proc` catalog data on 2026-10-12, is not recovered historical DDL, and is injected only into disposable CI replay.
3. **Definition fingerprint in the existing decision record:** `b0032d51962bddf93a74a679e8449644`. Recorded live metadata: owner `postgres`, `SECURITY DEFINER`, `search_path=public`; the inspected live ACL does not permit `anon` or `authenticated` to execute it.
4. **Definition in the live-derived snapshot:** returns `void`; accepts `p_request_id uuid, p_bid_id uuid, p_new_counter_price numeric`; rejects a missing/anonymous caller and null/negative price; updates `public.indrive_bids.offered_price` and its note only when the bid and request IDs match and the request belongs to `auth.uid()` and is not in `COMPLETED` or `CANCELLED`; raises `bid_not_owned_or_request_not_editable` when no row is updated.
5. **Historical source searches:** examined PR #218 (137 changed-file patches), PR #207 (329), PR #198 (17), and PR #193 (6). Exact identifier matches were found in reports/runbooks/static checks and the explicitly live-derived test fixture, not in an authoritative historical function-creation migration. The search is bounded; it cannot prove no external backup or unreachable Git object exists.
6. **Existing decision/runbook:** PR #218's `docs/release/counter-offer-rpc-forward-baseline-decision.md` and PR #207's `docs/runbooks/RESTORE_HISTORICAL_SECURITY_DEFINER_BASELINE.md` already prohibit fabricated historical DDL and distinguish a test baseline from a complete historical replay. They are unmerged review artifacts, not approvals for this branch.

## Root cause and impact

- **Root cause status:** CONFIRMED dependency gap; original historical creation version/source remains UNKNOWN.
- **Observed symptom:** disposable chronological replay stops at `20260927095000_revoke_unused_security_definer_execute.sql` with SQLSTATE `42883` because the function does not exist in the clean replay database at that point.
- **Impact:** the full migration chain cannot be certified from a clean database. Later passing unit/static checks cannot establish historical completeness.
- **Security note:** the function is currently not executable by `anon` or `authenticated` in the inspected live ACL. A fixture must preserve the captured least-privilege ACL immediately after creation; PostgreSQL's default function EXECUTE grant to `PUBLIC` must not be accidentally introduced by a test baseline.
- **Behavioral note:** the live snapshot's predicate checks the request status within the update statement but does not explicitly lock the request row. Any forward behavioral hardening for concurrent status transitions must be designed and tested separately; do not silently change semantics in a provenance fixture.

## Decision tree

### Path A — Recover authentic historical DDL (preferred)

Continue searching trusted Git objects/branches, PR artifacts, archived deployment/source bundles, and verified backups. Accept a candidate only after recording its origin, immutable blob/artifact hash, original migration identity/order, full definition, dependencies, owner, language, return type, volatility, security mode, search path, and ACL. Compare the candidate to the current live snapshot and explain any differences.

**Acceptance:** authentic provenance is recorded; original migration ordering is evidenced; function and prerequisite tables/types exist before the revoke; the disposable chronological replay reaches and passes this migration without injecting a synthetic function; the next first error is captured and triaged.

### Path B — Approved test-only live-derived baseline (replay aid, not historical recovery)

If Path A is genuinely unavailable, an authorized maintainer may separately approve use of the already existing live-derived snapshot strictly for disposable CI. Do not copy it into `supabase/migrations/` or claim it recovers the original history.

Required controls before enabling this path on the active replay branch:
- Written approval for this exact fixture and branch.
- Keep the fixture under a test-only path, outside the production migration directory.
- Pin the exact reviewed fixture blob/hash and assert the expected function signature and definition fingerprint.
- Immediately enforce the captured ACL (no unintended `PUBLIC`, `anon`, or `authenticated` EXECUTE grant); assert owner, `SECURITY DEFINER`, and function settings.
- Inject only into a freshly created disposable database, before the revoke migration, and fail closed if the environment is not disposable.
- Mark the run **“chronological migrations replayed against an approved live-derived test baseline”**. It is not proof of full historical source recovery or a clean reconstruction from original migrations.
- Continue validating all remaining migrations in timestamp order and report every later blocker.

This path has not been enabled on PR #289 by this proposal.

### Path C — Separate forward-only production convergence/security change

A forward migration can be considered only as a separate reviewed change, with a newly assigned unique version after dependency/order review. It must not pretend to be the missing historical migration. Because it runs later, it cannot make the earlier revoke succeed on an empty database without Path A or an explicitly approved test-only baseline.

Before implementation, review the complete restricted live catalog export and define whether the change is meant to preserve behavior exactly or also harden it. For any hardening:
- Preserve caller identity, anonymous-session rejection, non-negative price validation, bid/request ID binding, request ownership, and editable-state conditions.
- Use a hardened fixed search path (prefer empty `search_path` with all non-built-in objects schema-qualified) if compatibility review and tests support it.
- Explicitly preserve least-privilege EXECUTE grants; do not grant the function to client roles merely to make a test pass.
- Decide and test the concurrency contract for a request becoming completed/cancelled while a counter-offer is attempted.
- Include forward-recovery/rollback strategy, schema prerequisites, code parity implications, and reviewer sign-off.

**No forward migration SQL is created by this document.** Implementation requires separate approval and focused tests.

## Required tests before closing this blocker

1. **Definition/catalog contract:** exact identity arguments, return type, owner, language, volatility, `SECURITY DEFINER`, fixed search path, and ACL.
2. **Authorization/validation:** no caller, anonymous caller, null price, negative price, wrong request, wrong bid, non-owner, and valid owner on an editable request.
3. **Lifecycle/concurrency:** completed/cancelled request rejected; concurrent request-state transition has deterministic documented outcome.
4. **Privilege contract:** `anon` and `authenticated` cannot EXECUTE unless a separately reviewed product decision changes that requirement; `PUBLIC` must not receive unintended execution.
5. **Replay contract:** clean disposable chronological replay, no skipped migration and no synthetic historical migration; if Path B is approved, label the baseline explicitly and pin its hash.
6. **Regression scope:** rerun only tests invalidated by actual source/fixture/workflow changes; log exact commit, workflow URL, result, and what the run does not prove.

## Next executable actions

1. Search for external/trusted source artifacts or older reachable commits for the original creation DDL.
2. If no source is found, submit Path B for explicit approval if disposable replay progress is desired, while retaining the historical-provenance blocker.
3. Independently submit Path C for design/security review only if there is a concrete forward behavior or security change to make; do not use it as a substitute for the early replay prerequisite.
4. After an approved path is implemented, run the targeted validation and full disposable replay once on the exact resulting code SHA, then record the next first failure or full result in `docs/TEST_EXECUTION_LEDGER.md` and `docs/SESSION_LOG.md`.

## Safety state

No production changes, migrations, grants, RLS/Auth changes, function deployments, payments, merges, or releases occurred during this investigation. The production release gate remains **BLOCKED / NOT CERTIFIED**.


## Addendum — disposable forward-replay evidence (2026-10-17)

Path B has now been exercised **only on the dedicated test branch** `test/production-baseline-forward-replay-20261017`, whose local manifest is marked `APPROVED_FOR_DISPOSABLE_REPLAY`. This does not change the manifest in PR #284, which remains `PENDING_REVIEW`.

- Exact test-branch commit: `a79b2caa5b883817f5c1b550d044b09780f06820` (`test(db): include RC526 in reviewed baseline forward replay`).
- Workflow: [Reviewed Production Baseline Forward Replay run 39010395892](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010395892) — PASS.
- The job completed baseline fail-closed tests, provenance/review verification, PostgreSQL 17 isolated Supabase startup, snapshot restore plus forward migration replay, evidence-artifact upload, and stack shutdown.
- Snapshot checkpoint: `20261008222845`; applied ledger count: 283. Snapshot SHA-256: `ee16d095177110de67dac57f1b9a1e67610b40a3712981e850eff17d637a67a2`. Ledger SHA-256: `0b60096967ef51a912a08b437a10377e2f12d357dd6b25d5dc80677b1f8832b2`.
- Exact-run artifact `production-baseline-forward-replay-39010395892` exists (2336 bytes, not expired when inspected). Its contents were not independently read; no migration count is claimed here.

### Scope and disposition

This is evidence that migrations newer than the captured live-schema checkpoint can replay in the guarded disposable environment on that exact commit, including the RC526 migration included by the commit. It is **not** evidence of a clean empty-database chronological replay, and it does not recover the original historical migration identity for `counter_offer_indrive_bid`. It does not authorize production application, merging PR #284, or release.

The historical-provenance blocker therefore remains open. Continue Path A searches for authentic source/backup provenance. Do not invent or backdate DDL, do not alter the historical revoke migration, and do not promote the test-only snapshot into `supabase/migrations/`.


## Addendum — post-replay RPC privilege contract result (2026-10-17)

The test-only baseline branch now runs `supabase/tests/baselines/counter_offer_rpc_privilege_contract.sql` after forward replay. Exact run [39010917548](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010917548) passed on commit `b32e0741a7ed5d07ade4f4847070702855f90124`; the replay job and evidence upload completed successfully. Artifact ID `12091784983` (2477 bytes; contents not independently read).

The assertion checks the post-replay function exists, retains its expected `postgres` owner, SECURITY DEFINER flag and `search_path=public`, denies EXECUTE to `anon` and `authenticated`, and denies CREATE on `public` to both client roles. This is a useful ACL regression for the **live-derived snapshot plus forward migrations** path. It does not recover historical creation DDL and does not close clean chronological replay.

The test-only approval remains confined to `test/production-baseline-forward-replay-20261017`; PR #284 remains `PENDING_REVIEW`. Production remains **BLOCKED / NOT CERTIFIED**.


## Addendum — direct main-line parent-tree evidence (2026-10-17)

A direct GitHub API inspection of the commit immediately before the revoke migration adds a stronger repository-local provenance fact:

- Parent commit `33d7b626c75ee649a71b6ae6d3f5303d1a47901e`, authored at `2026-09-27T09:45:09Z`, had exactly one file in `supabase/migrations/`: `20260927074200_harden_smm_table_api_privileges.sql`.
- The next commit, `aaae0b57db23b487c9089a74421094f268b0ab00` at `2026-09-27T09:46:28Z`, adds only `20260927095000_revoke_unused_security_definer_execute.sql`; its diff contains the ten REVOKE statements and no function-creation DDL.
- Additional Library search returned the 2026-10-15 schema snapshot containing the current function definition, but no separate authentic historical creation migration/archive. That snapshot remains live-derived and cannot establish the original version or body.
- **Conclusion:** the checked main-line tree did not have a function-creation migration immediately before the revoke was added. The historical provenance gap is therefore confirmed within available repository history; external/archived provenance remains unproven. This is not authorization to backfill or rewrite migration history.

## Addendum — Paymob minor-unit correlation fix (2026-10-17)

A source review of the official [Paymob Create Intention documentation](https://developers.paymob.com/paymob-docs/intention-apis/create-intention) and the [official Paymob API collection example](https://github.com/PaymobAccept/API-Postman-Collections/blob/main/Paymob%20Subscription%20Module%20API.postman_collection.json) found that request amounts are expressed in cents and the response example returns `intention_detail.amount` as `1000` with item amounts `500 + 500`. The previous correlation comment incorrectly treated the response amount as major currency units. The code now compares the response against the integer `amountCents`, rejects non-integer values, and has exact-head CI passing on `d7fc64d0759b7eac303fc1dbcc33a2322115750e` (runs in `docs/TEST_EXECUTION_LEDGER.md`). Live Paymob Sandbox behavior remains unverified and is still a release gate; no provider request or payment was performed.


## Addendum — pre-revoke branch sweep and RC339 bootstrap ledger record (2026-10-17)

- Checked the pre-revoke migration directory on seven accessible branches: `fix/production-security-source-reconciliation`, `hardening/mantigo-p0-production`, `security/mantigo-captain-boundary-v1`, `feature/mantigo-idempotent-matching-v1`, `fix/mantigo-rate-limit-direct-execute-boundary`, `fix/mantigo-atomic-paymob-webhook`, and `fix/mantigo-open-ride-captain-scope-20261009`. Each had only `20260927074200_harden_smm_table_api_privileges.sql` before the revoke timestamp; none supplied the missing counter-offer function creation DDL.
- A read-only production ledger query recovered metadata for applied migration `20260927131555 / bootstrap_mnty_owner_islam_nagy_v2`. Its stored SQL creates `MNTY-PLATFORM`, `MNTY-MAIN`, and an active platform OWNER membership by looking up a particular auth user by email. It includes a hard-coded owner email and elevated platform permissions. The email was deliberately omitted from public documentation and no verbatim SQL was committed.
- This provides authoritative applied-ledger evidence relevant to RC339, but exact source restoration to a public repository requires privacy/security review; replay also requires the matching auth user. Any sanitized/test-user alternative is a test adaptation, not the original migration. Do not fabricate identity data.
- This RC339 bootstrap is separate from the unresolved counter-offer function source; both prevent claiming a clean empty-database replay from the checked-in historical chain.
