# Supabase Edge Function Source Parity Audit — 2026-10-16

## Status

**Historical baseline audit. Follow-up production deployments are recorded in the addendum below; no financial-journal migration or SMM launch was performed.**

Project: `moyhiluyhjsujhwlyeuu`  
Repository: `islamnagy2022-eng/MantiqatiX`  
Repository baseline checked: `main` at `e10a11794401e81e6d441498d91edeeaa328fff7`  
Production migration ledger observed separately: 283 entries, latest applied version `20261008222845` (RC424).

## Results

Compared the deployed Edge Function `index.ts` source returned by Supabase against the corresponding `supabase/functions/<slug>/index.ts` on `main` for all 37 functions in the project listing.

- **31 exact byte matches**
- **6 entrypoints differ byte-for-byte**
- This is a source-parity result, not a claim that all matching functions are secure or functionally correct. A byte mismatch does not by itself prove a behavior change; formatting and implementation differences require review.

## Differing entrypoints — review before any sync

| Function | Observation | Safe next action |
| --- | --- | --- |
| `catalog-admin` | Live and repository entrypoint lengths differ (approximately 3,467 vs 3,135 characters). Full semantic diff has not been certified. | Fetch/compare complete source and review authorization, tenant scoping, and catalog mutation behavior. |
| `financial-journal` | Production is on an older entrypoint. The existing rollout runbook records wildcard CORS, legacy RPC use, and missing verified-actor forwarding in the deployed implementation. | Follow `docs/runbooks/RC450_FINANCIAL_JOURNAL_ROLLOUT.md`; do not deploy until RC449A/RC450 prerequisites, reviewed migration order, ACLs, and staging tests are proven. |
| `smm-gateway` | Live v12 source has helper modules missing from `main`. | Tracked separately in draft PR #254; preserve `SMM_INITIAL_LAUNCH_DEFERRED=true`; do not deploy or enable SMM as part of source recovery. |
| `business-branch-admin` | Live entrypoint is shorter than repository source (3,715 vs 3,875 characters); byte parity is false. | Inspect complete semantic diff and verify membership-query failure handling and tenant/business/branch authorization before deciding direction of sync. |
| `mnty-customer-registration` | Live entrypoint is shorter than repository source (2,056 vs 2,300 characters); byte parity is false. | Inspect complete semantic diff and verify token validation and the customer-membership activation RPC contract. |
| `digital-page-order-create` | Live entrypoint is longer than repository source (4,052 vs 3,953 characters); live source includes a publishable-key fallback in its ANON constant. | Inspect complete semantic diff and verify request validation, business membership checks, idempotency, and price derivation before deciding direction of sync. |

## Exact-match functions

The other 31 entrypoints matched byte-for-byte in this read-only comparison. Exact source parity is not a substitute for authorization, RLS, financial-integrity, dependency, or runtime tests.

## Financial-journal release blocker — confirmed against live ledger

A fresh read-only query of the live migration ledger returned 283 entries, with latest applied version `20261008222845` (`rc424_atomic_digital_page_payment_webhook`). The following source migrations exist on `main` but are **absent** from the live ledger:

- `20261010175000_rc449a_financial_journal_schema_prerequisites.sql`
- `20261010180000_rc450_financial_journal_service_role_boundary.sql`

This means the hardened `financial-journal` source on `main` is not a deploy-ready drop-in for production. RC450 explicitly preflights the schema columns introduced/restored by RC449A. Do not deploy the Edge Function independently, and do not apply either migration ad hoc. Use the reviewed sequence and acceptance criteria in `docs/runbooks/RC450_FINANCIAL_JOURNAL_ROLLOUT.md`; the baseline replay/review gate remains independent and blocked.

## Release and safety boundaries

- No Edge Function was deployed or modified in Supabase during this audit.
- No migrations, database rows, grants, Auth settings, RLS policies, wallet balances, payment settings, or provider settings were changed.
- Do not bulk-copy live source over `main` or `main` over live. Drift direction differs, and production `financial-journal` is known to lag the hardened repository implementation.
- Keep the migration baseline replay gate blocked until the required review of the 144 `SECURITY DEFINER` functions, RLS policies, grants, and disposable replay is complete.
- Resolve each differing function through a separate reviewed change with tests. A source-parity report is not approval to merge or deploy.

## Next steps

1. Re-audit the three remaining drifted entrypoints: `financial-journal`, `smm-gateway`, and `mnty-customer-registration`.
2. Keep financial-journal blocked until the approved RC449A → RC450 → Edge Function sequence, ACL checks, staging tests, and explicit release approval are complete.
3. Preserve `SMM_INITIAL_LAUNCH_DEFERRED=true`; source restoration is not launch authorization.
4. Resolve customer-registration RPC drift only after reviewed behavior invariants and isolated integration tests.
5. Continue using focused pull requests and require CI on the exact proposed head.

## Follow-up semantic finding — `mnty-customer-registration` (2026-10-16)

A direct read-only comparison of the deployed entrypoint and tracked `main` source confirms a material RPC-name difference, not just formatting:

- **Deployed source:** calls `private.ensure_customer_membership_for_user`.
- **Tracked `main` source:** calls `private.activate_customer_registration_atomic`.
- Both sources verify the bearer token, reject anonymous users, restrict the tenant to `MNTY-PLATFORM`, and reject foreign browser origins. However, the RPC change can alter database behavior and depends on the deployed private-schema function, grants, and migration state.
- The deployed response maps activation errors using the same broad message matching but has a different fallback error message.

**Decision:** do not bulk-sync or deploy either variant based on source parity alone. Before any change, verify both RPC definitions, execute grants, authorization semantics, and migration presence in a non-production environment; then add behavioral tests for existing/new customer membership and replay/idempotency. Production deployment remains out of scope without explicit approval.

### Production database verification — customer registration RPCs

A read-only query against the connected production database confirms **both** private-schema RPCs currently exist and are executable by `service_role`, while `authenticated` and `anon` do not have direct execute permission:

| RPC | Security definer | Behavior confirmed in definition |
|---|---:|---|
| `activate_customer_registration_atomic` | Yes | Takes a per-user advisory lock; cancels pending CUSTOMER registration requests; inserts membership with required audit-log write; returns existing active membership when present. |
| `ensure_customer_membership_for_user` | Yes | Takes a per-user/customer/tenant advisory lock; includes `business_id` and `branch_id` in the insert; returns existing membership deterministically; wraps audit-log insertion in an exception handler that suppresses audit failures. |

Both functions set an empty `search_path` and check that the tenant is active. They are **not behaviorally interchangeable**: their locking keys, registration-request handling, membership insert columns, existing-membership selection, and audit failure behavior differ.

**Decision remains unchanged:** do not replace the deployed RPC call merely to match `main`. Reconcile the intended invariants and audit requirements, add isolated integration tests for concurrency, duplicate memberships, pending-request cleanup, and audit-write failure, then propose a reviewed migration/source change. No production mutation was made during this inspection.



## Follow-up deployment delta — 2026-10-16

Three of the six baseline source mismatches have now been addressed through reviewed, narrowly scoped changes. This addendum updates status only; it does not imply the other functions are cleared for deployment.

| Function | Change | Repository evidence | Production evidence |
| --- | --- | --- | --- |
| `digital-page-order-create` | Hardened idempotency replay matching and fail-closed lookup behavior | PR #257 merged as `d8544c2c0c25fabc776fff0b22bee3cf67c1274d` | Supabase reports ACTIVE version 4, `verify_jwt=true`; live source contains `IDEMPOTENCY_KEY_REUSED` and replay lookup failure guards. |
| `catalog-admin` | Restrict browser CORS to the GitHub Pages app origin; preserve bearer and tenant/business checks | PR #256 merged as `f34be0fb75e4ba778e038f289c96b5589d073be6` | Supabase reports ACTIVE version 6, `verify_jwt=true`; live source rejects disallowed origins and no longer uses wildcard CORS. |
| `business-branch-admin` | Restore actual TypeScript line breaks where literal backslash-n text was embedded | PR #259 merged as `90afc3f40b4457fe20c827a5ea60681c56649507` | Supabase reports ACTIVE version 5, `verify_jwt=true`; live source has no literal backslash-n sequences and retains membership fail-closed and role/business guards. |

No production migration, database row, grant, Auth/RLS policy, wallet, payment, or provider configuration was changed as part of these three deployments. The remaining mismatches are still gated: `financial-journal` is blocked by unapplied RC449A/RC450 prerequisites; `smm-gateway` source recovery does not authorize launch; `mnty-customer-registration` has non-interchangeable RPC behavior that needs isolated tests and an explicit design decision.
