# Pass 231–270 — Directory claim approval/rejection atomicity audit

Date: 2026-11-17
Branch: `security/public-contact-consent-current-main-20261117`
Reviewed head: `47aba334b5447233da516c9fc864447bd8d9ad08`
Scope: read-only source audit of `supabase/functions/directory-listings/index.ts` and the known null-safe membership uniqueness migration. No database, migration, Edge deployment, or production mutation.

## 40 source-level checks

### Authorization and request boundary (231–240)
- [x] 231. Request method/CORS boundary reviewed.
- [x] 232. Service-role client creation is server-side and requires configured secrets.
- [x] 233. Authenticated user resolution precedes privileged write actions.
- [x] 234. Active membership lookup is scoped to the authenticated user.
- [x] 235. Platform-admin authorization requires SUPER_ADMIN role.
- [x] 236. Platform-admin authorization rejects business-scoped memberships.
- [x] 237. Platform-admin authorization rejects branch-scoped memberships.
- [x] 238. Platform scope permission is explicitly required.
- [x] 239. Full-control permission is explicitly required.
- [x] 240. REVIEW_CLAIM executes after the platform-admin gate.

### Claim-state and rejection flow (241–250)
- [x] 241. Claim lookup is by supplied claim ID.
- [x] 242. Missing claim returns CLAIM_NOT_FOUND.
- [x] 243. Only PENDING or REVIEWING claims are accepted at initial read.
- [x] 244. REVIEWING and REJECTED share a multi-write branch.
- [x] 245. Claim status update is not guarded by the previously-read status.
- [x] 246. Rejection updates claim before releasing listing lock.
- [x] 247. Listing lock release filters by listing ID.
- [x] 248. Listing lock release filters by claimed user ID.
- [x] 249. Listing lock release filters by CLAIM_PENDING.
- [x] 250. Listing lock release error is ignored; endpoint can report REJECTED while lock remains held.

### Approval prerequisites and tenant/owner checks (251–260)
- [x] 251. Approval requires ownershipVerified=true in request.
- [x] 252. Business must exist and be ACTIVE.
- [x] 253. Paid subscription status is checked in business settings.
- [x] 254. Admin payment confirmation is required in business settings.
- [x] 255. Request-level subscriptionPaid=true is also required.
- [x] 256. Business tenant scope is checked against admin memberships, except platform tenant.
- [x] 257. Active owner memberships are queried for the target business.
- [x] 258. Foreign non-automatic owners block approval.
- [x] 259. Existing claimant membership lookup is business-wide (branch_id IS NULL).
- [x] 260. Existing membership lookup is not protected by an approval transaction or row lock.

### Membership/listing/finalization consistency (261–270)
- [x] 261. Existing claimant membership is activated before listing update.
- [x] 262. Missing claimant membership is inserted before listing update.
- [x] 263. Membership insert/update errors return early, leaving prior writes intact if any.
- [x] 264. Automatically assigned foreign owners are deactivated in a separate write.
- [x] 265. Failure to deactivate automatic owners leaves claimant membership already changed.
- [x] 266. Listing claim update is a separate write.
- [x] 267. Listing update is filtered only by listing ID, not expected CLAIM_PENDING state/user.
- [x] 268. Claim request approval/final linkage is a separate final write.
- [x] 269. Claim finalization failure can leave membership and listing committed while claim remains open.
- [x] 270. Concurrent reviews can both pass the initial read and race through the multi-write approval path.

## Findings

**Release blocker remains confirmed.** Claim approval/rejection is not atomic. The rejection path ignores listing-lock release failure. Approval performs membership activation/creation, automatic-owner deactivation, listing update, and claim finalization as separate requests. There is no compare-and-set on the claim status at finalization and no expected-state guard on the listing update. A partial failure or concurrent reviewer can leave inconsistent ownership state.

The known membership unique index
`ux_user_memberships_user_business_branch_nullsafe`
protects duplicate business-wide membership keys, but it does not make the multi-table workflow transactional and does not serialize claim approval.

## Required next engineering step

Before implementing a migration/RPC, obtain the authoritative current definitions for:
- `directory_listing_claim_requests` (columns, status constraints, indexes, triggers, foreign keys);
- `public_directory_listings` (claim-state columns, constraints, triggers);
- `user_memberships` (all required columns, role/status constraints, triggers, unique indexes);
- `businesses` (tenant/status/settings columns and relevant constraints).

Then implement one database transaction/RPC that locks and validates claim + listing + business, enforces the expected pending states and owner conflict rules, updates membership/listing/claim atomically, and returns stable error codes. Add database integration tests for rejection lock release, duplicate/concurrent approval, membership uniqueness conflict, inactive business, unpaid subscription, foreign owner conflict, and injected failure rollback.

The available repository connector did not provide a directory-tree/schema-discovery operation in this session. Therefore no schema-dependent migration or RPC was authored on assumptions.

## Release boundary

- Source-only audit; no source code changed in this pass.
- No migration created or applied.
- No production DB, RLS, grants, Auth, Edge Function, payment, or Pages deployment changed.
- PR #756 remains open and unmerged.
- CI for the reviewed head `47aba334...`: all 12 PR-triggered workflow runs completed successfully. This does not resolve the atomicity blocker or certify production.


## Production schema cross-check (read-only, 2026-11-17)

The earlier note that schema definitions were not available through the repository connector is superseded by a read-only inspection of the connected active project `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`). No SQL writes were issued.

- `directory_listing_claim_requests`: UUID primary key; listing/user UUID foreign keys; status CHECK permits PENDING, REVIEWING, APPROVED, REJECTED, CANCELLED; one-open-request partial unique index on (listing_id,user_id) for PENDING/REVIEWING.
- `public_directory_listings`: UUID primary key; claim status CHECK permits UNCLAIMED, CLAIM_PENDING, CLAIMED; claimed user/business foreign keys; updated_at trigger only.
- `user_memberships`: text primary key; user UUID, tenant/business UUID, organization/branch text, role, JSONB permissions, status; unique index currently is `uk_user_biz_branch (user_id,business_id,branch_id)`, whose nullable branch key does not prevent duplicate business-wide rows under PostgreSQL default NULL semantics.
- `businesses`: UUID primary key; tenant and optional organization text keys; status CHECK; JSONB settings; updated_at trigger and a deferred AFTER INSERT default-owner trigger.
- Triggers observed: claim/listing updated_at triggers, business updated_at/legal activation triggers, deferred default-owner assignment trigger, and membership legal employee-activation trigger.
- Production migration history does **not** contain version `20261027090000`; the repository migration `20261027090000_rc113_user_membership_business_scope_idempotency.sql` is therefore not reflected in the connected production migration history.
- Read-only preflight: 10 business-wide memberships; 0 duplicate (user_id,business_id) groups among rows with branch_id IS NULL. The absence of duplicates today does not replace the missing uniqueness invariant.
- Aggregate workflow state at inspection: one REVIEWING claim and one CLAIM_PENDING listing; no claim/user identifiers or contact data were retrieved.

**Updated design constraint:** the claim transaction must explicitly account for the deferred default-owner trigger, the existing business-wide unique-index gap, the legal activation triggers, and current schema types. Do not blindly apply the repo migration to Production. First reconcile migration history and inspect the exact deployed migration source; then create and test a separate reviewed migration on a disposable/development database branch. No development branch was created because its cost/compute implications were not confirmed.
