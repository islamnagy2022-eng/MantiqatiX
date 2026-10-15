# Decision Record — Missing InDrive Counter-Offer RPC Source

**Date:** 2026-10-14  
**Status:** PROPOSAL ONLY — NOT APPROVED, NOT IMPLEMENTED  
**Release gate:** BLOCKED / NOT CERTIFIED  
**Scope:** Disposable migration-chain recovery; no production mutation authorized.

## 1. Problem statement

The disposable Supabase replay repeatedly stops at
`20260927095000_revoke_unused_security_definer_execute.sql` because
`public.counter_offer_indrive_bid(uuid,uuid,numeric)` does not exist at that point
in the replay chain (SQLSTATE 42883).

Read-only production catalog evidence records a live function with:
- Owner: `postgres`
- Security mode: `SECURITY DEFINER`
- Function-level search path: `public`
- Definition fingerprint: `b0032d51962bddf93a74a679e8449644`
- `anon` and `authenticated` cannot execute it in the inspected live ACL.
- Observed body behavior: rejects null/anonymous caller identity; validates nonnegative
  counter price; updates a bid tied to the supplied request only when that request
  belongs to the authenticated caller and is not completed/cancelled.

This catalog evidence describes the currently deployed behavior; it does not establish
the original source file, creation timestamp, intended historical dependencies, or
whether all implementation details have been captured.

## 2. Investigation completed

- Repeated S04 disposable replay runs 159 and 160 independently produced the same first
  blocker at the revocation migration.
- Read-only scan of production migration-ledger statement arrays returned zero matches
  for the function name.
- Current tracked migration search did not locate the function definition.
- Seven InDrive/reverse-bidding migration sources inspected across candidate branches did
  not contain the function.
- Searches of indexed repository code/commit records did not reveal an authentic creation
  source. This is a bounded search result, not proof that no backup or unreachable history
  exists.

## 3. Options

### Option A — Recover the original historical source (preferred)

Recover from a trusted Git object/branch, archived deployment artifact, verified backup,
or another authoritative source. Verify provenance, exact function signature, dependencies,
ACL, owner, security mode, search path, and body. Reconcile it with the production ledger
and chronological ordering before adding it to the disposable replay source set.

**Acceptance:** provenance documented; source hash and origin recorded; no unexplained
difference from live behavior; dependency order reviewed; disposable replay succeeds past
this prerequisite without test-only function stubs.

### Option B — Reviewed forward-baseline strategy (fallback proposal)

If authentic history cannot be recovered, prepare a separate forward migration/repair plan
for reviewer approval. It must explicitly describe that this is a forward baseline for an
existing live object, not a recovered historical migration. It must:
1. Be reviewed against a read-only export of the complete live function definition and
   catalog metadata, with the export preserved as a restricted, integrity-checked artifact.
2. Preserve the observed caller checks, request ownership/state guard, price validation,
   function owner/security mode, fixed search path, and least-privilege ACL.
3. Define how fresh databases and existing production databases converge without silently
   rewriting migration history or pretending the object was created by an earlier migration.
4. Include tests for anonymous caller, wrong owner/request, completed/cancelled request,
   negative price, valid owner update, concurrent state change, and unauthorized EXECUTE.
5. Include reviewer sign-off, rollback/forward-recovery plan, and explicit environment
   applicability. Any migration execution must follow the repository's separate release
   authorization and preflight process.

This document does not implement Option B and is not an authorization to create or apply
such a migration.

## 4. Prohibited shortcuts

- Do not synthesize a historical migration from memory or merely copy the live body into
  an invented old timestamp.
- Do not make the revocation statement conditional to conceal the missing prerequisite.
- Do not inject a function fixture into the test-only baseline to make the chain appear
  complete.
- Do not change production, function ACL, RLS, Auth, schema, or migration ledger as part
  of this investigation.
- Do not label a test-baseline replay as a clean replay or production certification.

## 5. Decision and next actions

**Current decision:** neither Option A nor Option B is approved for implementation yet.
Keep the gate blocked.

- [ ] Search authoritative backups/deployment artifacts with provenance.
- [ ] If recovered, verify source hash, signature, dependencies, owner, SECURITY DEFINER,
  search_path, ACL, and behavior against the read-only catalog evidence.
- [ ] If not recovered, request explicit review of Option B as a separate forward-baseline
  design before creating migration code.
- [ ] Only after the selected path is reviewed, rerun disposable chronological replay and
  document the next first error or full success.
- [ ] Reconcile the full migration chain; one resolved function does not certify the
  remaining historical gaps or production release.

## 6. Evidence references

- S04 run 159: https://github.com/islamnagy2022-eng/MantiQaTiX/actions/runs/38499236142
- S04 run 160: https://github.com/islamnagy2022-eng/MantiQaTiX/actions/runs/38499702486
- S04 investigation report: https://github.com/islamnagy2022-eng/MantiqatiX/blob/docs/rc521-admin-operations-discovery-20261013/docs/release/s04-migration-chain-clean-replay-report.md
- Production TODO: https://github.com/islamnagy2022-eng/MantiqatiX/blob/docs/rc521-admin-operations-discovery-20261013/docs/MASTER_PRODUCTION_TODO.md

**Production writes:** none. **Migration applied:** no. **Merge/deployment:** no.  
**Release:** BLOCKED / NOT CERTIFIED.

Site: https://islamnagy2022-eng.github.io/MantiqaTiX/
