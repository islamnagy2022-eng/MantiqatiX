# Pass 271–300 — Transactional directory claim review implementation

Date: 2026-11-18
Base: `main` at `300eb8a0e9808c45dee2eefc77c3e9e19f425559`
Branch: `fix/directory-claim-atomicity-20261118`
Status: IMPLEMENTED IN SOURCE; exact-head CI pending. No Production writes or deployments.

## Production schema evidence (read-only)

Connected project: `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`).

- The live ledger contains 310 migrations through `20261110150618`; version `20261027090000` is absent.
- The repository still contains `20261027090000_rc113_user_membership_business_scope_idempotency.sql`, which proposes a null-safe unique expression index for business-wide memberships. It is not recorded in the live ledger.
- Live `user_memberships` has `uk_user_biz_branch(user_id,business_id,branch_id)`, which does not prevent duplicate rows where `branch_id IS NULL`.
- Read-only preflight found zero duplicate `(user_id,business_id)` groups for business-wide rows; a forward-only index can therefore be added without deleting or rewriting membership data.
- Claim requests use PENDING/REVIEWING/APPROVED/REJECTED/CANCELLED. Listings use UNCLAIMED/CLAIM_PENDING/CLAIMED.
- `businesses` has a deferred default-owner trigger. The function checks for an existing active owner before assigning the automatic platform owner. Membership activation also has a legal employee trigger; it applies to EMPLOYEE/STAFF roles, not BUSINESS_OWNER.
- No identifiers or contact details from live claim records were read for this audit.

## Changes on this branch

- Added forward migration `20261118010000_rc472_directory_claim_review_atomicity.sql`.
- Added the null-safe membership unique expression index without replaying the missing historical RC113 migration.
- Added `public.review_directory_listing_claim_atomic`, a service-role-only SECURITY DEFINER RPC with an empty search_path.
- The RPC locks the claim, listing, and target business; validates expected claim/listing states, active business and paid/admin-confirmed subscription; blocks foreign non-automatic owners; creates/activates the claimant membership; deactivates only automatic default owners; and finalizes listing plus claim in the same transaction.
- Rejection now releases the listing lock and updates the claim in one transaction. Any failure raises and rolls back all writes.
- Updated `directory-listings` REVIEW_CLAIM to call the RPC rather than performing separate REST writes. Existing platform-admin and tenant-scope checks remain in the Edge Function; browser roles cannot execute the RPC.
- Added isolated PostgreSQL fixture/integration tests for approval, rejection, automatic-owner detach, injected rejection failure, injected approval-finalization failure, foreign-owner conflict, unpaid subscription, null-branch duplicate prevention and RPC ACL.
- Added a GitHub Actions workflow that applies the fixture + migration + integration tests on PostgreSQL 16 and runs Deno type-check on the affected Edge Function.

## Verification and release boundary

- Production preflight: PASS — zero current null-branch duplicate groups.
- Schema/trigger inspection: PASS — authoritative definitions inspected read-only.
- Source implementation: present on branch; not yet merged.
- PostgreSQL integration + concurrent-review suite: PASS on branch head `94fe788fb1f92a902bc613f65c0a7334d9146798`.
- Deno Edge Function type-check: PASS on the same branch head.
- Concurrent multi-session test: PASS — two separate PostgreSQL sessions raced approvals for the same business; exactly one claim committed and the other failed with BUSINESS_ALREADY_HAS_OWNER.
- Supabase development branch: not created; no cost-bearing branch was started.
- No Production migration, data update, grant/RLS/Auth change, Edge deployment, payment action, or Pages deployment occurred.

## Remaining gates

1. Complete all remaining repository-wide PR checks and review the final SQL/Edge diffs.
2. Merge only after every relevant check is green on the final PR head.
3. Apply the forward migration and deploy the Edge Function only through a separately reviewed Production release with backup/rollback approval. Source merge alone is not deployment approval.
