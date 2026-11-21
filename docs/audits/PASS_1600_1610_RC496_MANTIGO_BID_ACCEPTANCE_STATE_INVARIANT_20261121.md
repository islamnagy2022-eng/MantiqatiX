# Pass 1600–1610 — RC496 MantiGO bid acceptance state invariant

Date: 2026-11-21  
Issue: [#912](https://github.com/islamnagy2022-eng/MantiqaTix/issues/912)  
Source candidate: PR #958 — RC488–RC496 coordinated release branch  
Migration: `20261121030000_rc496_mantigo_bid_accept_state_invariant.sql`

## Finding

The Production RPC `public.accept_mantigo_bid_backend(uuid,text,text)` authenticated the caller and ride owner and checked that the ride was open, but it did not require the selected bid's current status to be `OFFERED`. Consequently, a same-ride bid already marked `ACCEPTED`, `REJECTED`, `WITHDRAWN`, or `EXPIRED` could be selected by this RPC while the ride remained open. This is a source/live contract finding; no Production RPC was invoked to demonstrate an exploit and no user rows were changed.

## Source correction

RC496 is a forward-only migration. It does not edit historical migrations.

- Locks the ride row first with `FOR UPDATE`, serializing competing winner selections for that ride.
- Locks the selected bid and rejects every state except `OFFERED`.
- Performs the selected bid transition with a conditional `WHERE status='OFFERED'` and checks that exactly one row changed.
- Rejects only other `OFFERED` sibling bids.
- Updates the ride only while it remains open and has no accepted bid.
- Calls `lock_mantigo_fare_backend` only after the bid and ride winner are persisted in the same transaction; a financial failure rolls back the complete state transition.
- Allows a retry for the same accepted bid and rejects a different winner.
- Pins the SECURITY DEFINER function to empty `search_path`, preserves authenticated EXECUTE, and revokes PUBLIC/anon EXECUTE.

## Disposable regression coverage

Dedicated fixture and workflow:
- `supabase/tests/rc496_mantigo_bid_accept_state_invariant_fixture.sql`
- `supabase/tests/rc496_mantigo_bid_accept_state_invariant_integration.sql`
- `scripts/validate-rc496-mantigo-bid-accept-state-invariant.mjs`
- `scripts/test-rc496-mantigo-bid-accept-concurrency.sh`
- `.github/workflows/mantigo-bid-accept-state-invariant.yml`

The suite covers:
- Valid `OFFERED` acceptance, sibling rejection and preserved non-OFFERED sibling status.
- Denial for selected bid states `ACCEPTED`, `REJECTED`, `WITHDRAWN`, and `EXPIRED`.
- Caller identity and ride-owner binding.
- Missing bid and cross-ride bid denial.
- Same-winner idempotency and prevention of a second winner.
- Full rollback when the downstream fare-lock step fails.
- Two independent PostgreSQL sessions attempting different bids for the same ride; exactly one winner, one denial, one fare lock, one acceptance audit and one notification are required.

The concurrency test and fixture are isolated disposable PostgreSQL only. The full chronological schema replay applies the RC496 migration and validates its source contract; the standalone PostgreSQL workflow runs the detailed state-machine and concurrent-session fixture.

## Release inventory update

The exact release migration contract was increased from 75 to **76** ordered versions:
- `scripts/production/live-reconciliation-contract.mjs`
- `scripts/validate-production-migration-chain-gate.mjs`
- `.github/workflows/forward-migration-chain-replay.yml`
- `docs/release/production-migration-reconciliation.json`
- `docs/runbooks/PRODUCTION_BACKUP_RESTORE_RC484_20261119.md`

Latest read-only Production ledger evidence remains 310 rows through `20261110150618`, with 0 of the 76 exact release versions recorded. RC496 has not been applied to Production.

## Validation and disposition

At the time of this record the latest PR #958 exact-head checks were queued; no RC496 test pass is claimed until the dedicated workflow and full current-head replay complete successfully.

No Production migration, DDL/DML, RLS/GRANT, Edge deployment, Auth, Storage, payment, financial settlement, or customer-data mutation occurred.

**Disposition: RC496 SOURCE CANDIDATE / CI PENDING / PRODUCTION BLOCKED / NOT CERTIFIED.** Issue #912 remains open until coordinated migration application and live positive/negative authorization verification pass.

## Fare-ledger identity and corrupt-state follow-up — 2026-11-21

- Extended the RC496 migration to replace `lock_mantigo_fare_backend(uuid,text)` in the same forward-only release. The helper now requires the accepted bid row to belong to the ride and have `status='ACCEPTED'`, and exactly one accepted bid may exist for the ride before any fare lock is created.
- Idempotent fare-lock retries now verify the persisted ledger's customer, captain, EGP currency, gross amount, zero commission, captain net, deterministic idempotency key and metadata's accepted bid/source before returning the existing record. A mismatch raises `MANTIGO_FINANCIAL_IDENTITY_MISMATCH`; it is not silently accepted as an idempotent retry.
- Production ledger inventory was checked read-only before adding this guard: zero live MantiGO financial-ledger rows existed at the check, so no existing customer ledger required reconciliation in this snapshot.
- Added disposable test cases for duplicate ACCEPTED bid rows and a pre-existing ledger tied to the wrong captain. The fare-lock failure trigger still verifies full rollback of accepted ride/bid state and prevents partial financial rows.
- The test fixture now models the actual financial ledger fields and the concurrency test asserts exactly one persisted ledger row, rather than counting test-only lock-call markers.
- The updated exact-head RC496 workflow and full 76-migration replay must complete before claiming a test pass. No Production function, data, ledger or Edge deployment was changed.

## Terminal accepted-bid fixture expectation correction — 2026-11-21

- The first dedicated RC496 workflow run applied the migration successfully and failed in the adversarial fixture at the terminal-state matrix. The `RC496-ACCEPTED` case deliberately models a legacy inconsistent state: the ride row is still `OPEN` with no `accepted_bid_id`, while a related bid row is already `ACCEPTED`.
- The migration correctly detects that inconsistent winner state before inspecting the requested bid and raises `RIDE_ACCEPTANCE_STATE_MISMATCH`; this fail-closed behavior prevents creating a second winner. The fixture incorrectly expected `BID_NOT_OFFERED` for that case.
- Updated only the test expectation: the inconsistent `ACCEPTED` row expects `RIDE_ACCEPTANCE_STATE_MISMATCH`; `REJECTED`, `WITHDRAWN`, and `EXPIRED` rows continue to expect `BID_NOT_OFFERED`. No migration or production function logic was weakened or changed.
- Test correction commit: `47057fe870ef486d197a74d79d8ef34b600891b2`.
- The exact-head workflow and forward migration replay have been retriggered by the commit. No pass is claimed until both complete.
- No Production migration, function, DDL/DML, RLS/GRANT, Edge deployment, Auth, Storage, payment, settlement or customer data was modified.

## Exact-head RC496 regression verification — PASS — 2026-11-21

- Exact source head: `bb3e0d021857401d6e33101ad15cc83307eab6b6`.
- GitHub Actions workflow: `MantiGO Bid Acceptance State Invariant RC496`, run `44919294795`.
- Disposable PostgreSQL schema fixture creation: PASS.
- RC496 migration application: PASS.
- Adversarial state and idempotency tests: PASS.
- Two-session concurrent acceptance race: PASS.
- The accepted-ride inconsistent legacy fixture now asserts `RIDE_ACCEPTANCE_STATE_MISMATCH`, matching the migration's fail-closed behavior; other non-OFFERED states assert `BID_NOT_OFFERED`.
- This is a CI/disposable-database result only. The full chronological production-checkpoint migration replay and remaining PR checks are still running; no Production migration or deployment is implied.
