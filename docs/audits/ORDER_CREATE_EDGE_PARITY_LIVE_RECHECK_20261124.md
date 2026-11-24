# Order Create — Live Edge / Main Source Parity Recheck
**Date:** 2026-11-24  
**Production project:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Repository main:** `5baa0ce7612b685d152d968b8c82c902484b484a`  
**Method:** read-only retrieval of the deployed Supabase Edge Function and current-main source. No function invocation, database mutation, migration, Auth/RLS/GRANT change, payment, order, wallet, settlement, or deployment was performed.

## 1. Live deployment identity

| Field | Live value |
|---|---|
| Function | `order-create` |
| Status | `ACTIVE` |
| Version | `8` |
| `verify_jwt` | `true` |
| Import map | disabled |
| Deployed bundle SHA-256 | `16f9b8bb687c33afeca14d85cb4c43af9948bd8b3ef3178990cc76ca1abea782` |
| Current-main source | `supabase/functions/order-create/index.ts` |
| Current-main blob SHA | `3a6777683e537dcff1ad30cbd1c89e431f77d926` |

The deployed entrypoint is not source-identical to the current-main implementation. The deployed source is 10,083 characters; current main is 13,988 characters.

## 2. Confirmed source-level differences

### A. Branch-scoped membership authorization

- **Live v8:** the target-membership lookup selects `id,role,status` and filters by authenticated user, tenant, business and ACTIVE status. It does not select `branch_id` or constrain the membership to the requested branch.
- **Current main:** selects `branch_id` and adds an exact `.eq("branch_id", branchId)` condition whenever a branch is selected. The source comment explicitly states that staff operations must be authorized for the exact selected branch, not merely any branch belonging to the same business.

**Assessment:** the live source does not enforce the branch-specific membership check now present in main. Where staff memberships are branch-scoped, this is a cross-branch authorization gap requiring adversarial validation and coordinated release. This source comparison alone is not a claim that a production exploit was executed.

### B. Request-body resource bounds

- **Live v8:** calls `req.json()` directly and has no `MAX_BODY_BYTES` streaming limit.
- **Current main:** enforces a 256 KiB maximum, checks declared content length, reads the request stream with a cumulative byte limit, cancels oversized streams and decodes UTF-8 strictly.

### C. Metadata and customer-input validation

- **Live v8:** accepts an arbitrary object for metadata and spreads it into persisted metadata.
- **Current main:** accepts only the documented `source` and `catalog_authoritative` metadata keys, validates their types and lengths, and rejects unknown keys.
- **Current main** also bounds and validates customer name, phone, delivery address and notes before persistence.

## 3. Controls shared by both versions

Both inspected versions:
- verify the bearer token through Supabase Auth `getUser(token)`;
- reject missing/invalid users and anonymous users;
- calculate item prices server-side from catalog/pricing data;
- validate item quantities and options;
- persist through the `create_order_backend` RPC rather than trusting a client-supplied total.

These shared controls should be preserved when releasing the newer source.

## 4. Related candidate and release boundary

- Li2Lak PR #971 remains open and is not mergeable against its recorded base snapshot. Its head is `e37158ccbc7d33fd0ac1b00cb6b2ed649810bebb`, while current main is `5baa0ce7612b685d152d968b8c82c902484b484a`.
- Only four completed successful workflow runs were visible for that exact PR head in this recheck. This is not sufficient evidence for the required current-main rebase, full exact-head PostgreSQL 17 review/order tests, migration replay and frontend/RBAC validation.
- Production migration ledger remains 310 rows through `20261110150618`; source migration identifiers and physical effects still require the documented reconciliation.
- The full-platform release remains **BLOCKED / NOT CERTIFIED** pending owner-controlled encrypted database + Storage backup, Auth/Vault recovery coverage, independent PostgreSQL 17 restore/rollback with measured RPO/RTO, migration/physical-object reconciliation, Edge dependency parity and deployed-origin adversarial checks.

## 5. Required next sequence

1. Rebase PR #971 onto the current main commit and reconcile RC497/RC498 with the latest migration manifest.
2. Run the exact-head PostgreSQL 17 branch-isolation, order authorization, idempotency-race and full forward-replay suites; require all relevant current-head CI checks to pass.
3. Verify the live RPC signature, ACL, search_path and schema prerequisites against the candidate Edge source.
4. Complete the owner-controlled backup/restore and rollback gate.
5. Release the dependent database and Edge changes as one coordinated, approved unit; then run positive and negative deployed-origin order/branch tests.

**Release decision:** do not deploy `order-create` v8 replacement independently and do not apply its database prerequisites piecemeal. Preserve the current production behavior until the complete dependency slice passes.
