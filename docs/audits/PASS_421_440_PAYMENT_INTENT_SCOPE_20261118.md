# Pass 421–440 — Payment intent business/branch authorization review

Date: 2026-11-18  
Production project: `moyhiluyhjsujhwlyeuu`  
PR: #774 — RC474 payment-intent scope hardening

## Live Production evidence (read-only)

- `public.create_payment_intent_backend` is SECURITY DEFINER with `search_path=public, pg_temp`.
- EXECUTE is granted to `authenticated` and `service_role`; it is denied to `anon` and `PUBLIC`.
- The current function's first non-customer authorization check accepts any active membership in the target tenant/business, or any tenant-wide membership.
- Its second financial-role check is tenant-only: it does not bind the role to the same `business_id` or `branch_id` that passed the first check. A user can therefore combine a non-finance role in one business/branch with a finance role in another business/branch.
- The financial-role check only runs when `orders.customer_id IS NOT NULL` and differs from the actor. A NULL customer_id bypasses that role check.
- The business authorization model explicitly recognizes `BUSINESS_OWNER` as a business-scoped owner role; RC474 includes it only when the membership matches the exact order business and branch.
- The function uses `search_path=public, pg_temp` and unqualified table references.
- Current live aggregates: 0 orders and 0 cross-business finance membership pairs. This is a latent authorization defect, not evidence of an existing payment or prior exploitation.
- No Production payment RPC was invoked; no payment intent, order, ledger, journal, provider event, membership, grant or function was changed.

## Source remediation in RC474

- Bind both non-customer checks to the exact order business and branch.
- A branch-specific membership is accepted only for the order's branch; a business-wide membership must have `branch_id IS NULL`; tenant-wide scope requires both `business_id IS NULL` and `branch_id IS NULL`.
- Use `IS DISTINCT FROM` so a NULL customer_id still requires authorized staff/finance scope.
- Keep customer-owned cross-tenant payment behavior intact.
- Pin the SECURITY DEFINER RPC to an empty search_path and schema-qualify table/Auth references.
- Normalize ACLs: authenticated + service_role execute; anon + PUBLIC do not.
- Remove the Edge Function's redundant tenant-only membership precheck. The user-scoped RPC becomes the single business/branch authorization authority.
- Add a disposable PostgreSQL 16 fixture covering cross-business role mixing, cross-branch role mixing, NULL customer, customer-owned payment, exact branch/business/tenant-wide finance roles, same-business BUSINESS_OWNER access, and idempotent replay.

## Validation / release status

- Static source assertions were locally checked in the orchestration layer: 12/12 targeted checks passed.
- RC474's scoped role set includes `BUSINESS_OWNER` for the exact same business/branch, with a positive integration test. The first static CI attempt correctly caught that the validator's expected-role regex had not been updated; the validator was corrected and exact-head CI is rerunning.
- PR #773 was closed as superseded because its base became stale after PR #772 merged; no code was merged from #773.
- Main currently includes PR #772 as `30531e00a43d059159b409f3f57ace5d640ad641`.
- Supabase Production remains at migration `20261110150618`; RC464/RC471/RC472/RC473/RC474 are not applied.
- Verified off-site backup + restore remains a hard release gate. Do not run RC474 or deploy the Edge source to Production before that evidence and coordinated release review.

**Disposition:** RC474 is a source-only forward migration and Edge hardening candidate. Production remains read-only and uncertified for this payment-intent release.
