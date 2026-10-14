# MantiqaTiX — Next Session Resume

**Last updated:** 2026-10-14  
**Working branch:** `docs/rc521-admin-operations-discovery-20261013`  
**Current PR:** [#218](https://github.com/islamnagy2022-eng/MantiqatiX/pull/218) — OPEN, DRAFT, UNMERGED  
**Latest verified PR head at update:** `4c61137d20d72527c3fc5132d0611cbc46ca8d65`  
**Production release gate:** BLOCKED / NOT CERTIFIED  
**Website:** https://islamnagy2022-eng.github.io/MantiqaTiX/

## First actions in the next session

1. Read this file, then `docs/MASTER_PRODUCTION_TODO.md`, `docs/PROJECT_CONTINUITY.md`,
   `docs/SESSION_LOG.md`, and `docs/release/s04-migration-chain-clean-replay-report.md`
   from this branch before changing code.
2. Recheck PR #218 state/head and exact-head CI. The documentation head
   `4c61137d20d72527c3fc5132d0611cbc46ca8d65` had no associated workflow runs returned
   at the last check; do not claim CI passed for this commit.
3. Continue only with trusted-source recovery for
   `public.counter_offer_indrive_bid(uuid,uuid,numeric)` or a separately reviewed
   forward-baseline design. Do not implement a guessed historical migration.
4. If an authoritative source/backup is found, verify provenance, full body, dependencies,
   owner, SECURITY DEFINER, search_path, ACL, and behavior against the read-only production
   catalog evidence before editing migration code.
5. If no trusted source is recoverable, request explicit review of the proposal at
   `docs/release/counter-offer-rpc-forward-baseline-decision.md`. Proposal is not approval.
6. Only after the source/decision is reviewed, run disposable chronological replay and
   capture the next first error or full successful completion. Do not use a test-only fixture
   to conceal missing historical DDL.
7. Keep production read-only. No merge, deployment, migration application, grants/RLS/Auth
   changes, or financial operation without the documented preconditions and authorization.

## Current evidence

- S04 runs 159 and 160 reproducibly stop at
  `20260927095000_revoke_unused_security_definer_execute.sql` with
  `function public.counter_offer_indrive_bid(uuid, uuid, numeric) does not exist`
  (SQLSTATE 42883).
- Live catalog evidence: function exists in production, SECURITY DEFINER, owner `postgres`,
  search_path `public`, fingerprint
  `b0032d51962bddf93a74a679e8449644`; `anon` and `authenticated` cannot execute it.
- The production migration-ledger statement scan and current indexed source searches found no
  creation statement. Seven related InDrive/reverse-bidding migration files across candidate
  branches did not define it. This is a bounded search, not proof that no trusted backup exists.
- Proposal-only decision record:
  `docs/release/counter-offer-rpc-forward-baseline-decision.md`.
- Updated evidence report:
  `docs/release/s04-migration-chain-clean-replay-report.md`.
- Updated master TODO:
  `docs/MASTER_PRODUCTION_TODO.md`.
- Production ledger last verified at RC424 / `20261008222845`; 0/33 required post-RC424
  migrations proven applied; full chronological replay not completed.
- No production writes, migration applications, function deployments, merge, or release occurred.

## Safety invariants

- No invented historical DDL, conditional revoke workaround, or test-only function stub.
- Never equate source presence or a test-baseline replay with clean replay / production readiness.
- Do not make broad RLS/ACL changes or blanket grants/revokes.
- Record TODO states accurately: TODO / IN PROGRESS / WAIT / BLOCKED / DONE / VERIFIED.
- Report the website link at the end of every project status response.

Site: https://islamnagy2022-eng.github.io/MantiqaTiX/
