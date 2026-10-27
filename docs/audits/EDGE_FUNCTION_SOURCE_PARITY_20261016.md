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


## Follow-up evidence — 2026-10-16, post-merge

### Customer registration RPC contract

- PR #261 added a static guard and a staging acceptance matrix documenting why `private.activate_customer_registration_atomic` (RC213) and `private.ensure_customer_membership_for_user` (RC215) are not interchangeable.
- PR #264 added disposable PostgreSQL integration tests for first activation, replay, pending-request cleanup differences, required-vs-best-effort audit writes, tenant activation checks, platform business/branch scope, and service-role-only execution grants.
- PR #264 merged as `cbfd31b9446064d0e6bc9065554a5b71d4121e6c`. Its exact-head PostgreSQL integration job and source-contract job passed. This is isolated test evidence only; production RPC behavior was not changed and the live Edge Function RPC mismatch remains intentionally unresolved pending an explicit invariant decision.

### SMM gateway source deployment

- After PR #262 restored source parity on current `main`, the `smm-gateway` Edge Function was deployed with all seven source files from that commit.
- Supabase live verification: status `ACTIVE`, version `13`, `verify_jwt=true`, bundle SHA-256 `a45cee9f5c90beba2c2409ba4fe2927f5be3df4965fb3929f5b7d467b3121b72`.
- The deployed entrypoint exactly matches the tracked `main` source. `SMM_INITIAL_LAUNCH_DEFERRED=true` remains hard-coded and the gate runs before authentication/action routing, returning `SMM_DEFERRED` (503). Missing wallet rows remain distinguishable from initialized zero-balance wallets.
- This is a source deployment, **not** SMM launch approval. No provider calls, wallet mutations, orders, or production migrations were performed.

### Current release gate result

- Production Health Monitor passed for the current main commit, but the Production Verification Engine intentionally failed closed: the migration source chain RC425–RC441 is incomplete in `main`, the live ledger remains reconciled only through RC424, and chronological replay, tenant isolation, payment/finance E2E, backup/restore, and other release evidence remain unverified.
- Do not treat a green health monitor or a successful source/test workflow as production certification. Do not bulk-apply migrations or rewrite the live ledger to silence the gate.


## Fresh deployed-source comparison — 2026-10-27 (read-only)

This addendum supersedes the historical version notes above where current live evidence differs. Compared Supabase's retrieved active function files in Production project `moyhiluyhjsujhwlyeuu` against the corresponding `main` files. Byte-length/match findings are indicators for semantic review; mismatches alone are not proof of exploitation or approval to deploy.

| Function | Deployed state | Live index.ts bytes | Main index.ts bytes | Fresh finding / decision |
| --- | --- | ---: | ---: | --- |
| `smm-gateway` | v13, `verify_jwt=true` | 20,040 | 20,040 | **Exact source match** across all seven deployed files. The live entrypoint keeps `SMM_INITIAL_LAUNCH_DEFERRED=true` and rejects requests with `503 SMM_DEFERRED` before authentication/body/action routing. This proves source parity and the deny-first source guard, not the requested live negative-request/no-side-effect test; see issue #212. |
| `financial-journal` | v3, `verify_jwt=true` | 1,591 | 3,387 | **Critical source drift.** Live source retains wildcard CORS and calls legacy `post_financial_journal`; `main` calls `post_financial_journal_backend` and no longer uses wildcard CORS. Live ledger still lacks RC449A (`20261010175000`) and RC450 (`20261010180000`). Do not deploy the newer entrypoint independently of the approved migration order; see issue #104 and the RC450 rollout runbook. |
| `catalog-admin` | v13, `verify_jwt=false` | 24,407 | 25,731 | Entrypoints differ; the current `main` imports `../_shared/default-images.ts`, which is absent from the live entrypoint. Review complete behavior, explicit JWT/body authorization, CORS, tenant and business scope before deciding direction of sync. `verify_jwt=false` is not itself a vulnerability finding because the function may implement its own authentication contract. |
| `catalog-platform-admin` | v2, `verify_jwt=true` | 20,807 | 20,923 | Entrypoints differ. The first material source difference concerns UUID validation: `main` accepts legacy UUID-shaped values that the stricter live pattern rejects. Check callers and regression coverage before deployment. |
| `digital-page-payment-intent` | v5, `verify_jwt=true` | 5,345 | 6,532 | Live source lacks the shared `isValidPaymobAmountCents` / `matchesPaymobIntention` correlation helper import present in `main`. Review provider amount, order binding, and intent correlation together with the canonical RC425–RC441 migration chain; see issues #269 and #270. |
| `payment-intent` | v8, `verify_jwt=true` | 8,114 | 10,366 | Live source lacks the shared Paymob amount/intent correlation helper import present in `main`. Do not sync the function alone until required database sources, grants, and end-to-end payment tests are verified. |
| `paymob-webhook` | v10, `verify_jwt=false` | 11,538 | 12,665 | Live source differs from `main`; `main` rejects invalid/non-finite amounts via an explicit `Number.isFinite(amount)` check that the live entrypoint lacks. Provider webhook signature and order/amount correlation still need staging E2E; `verify_jwt=false` is expected for provider callbacks only when the handler independently verifies the webhook. |
| `public-catalog-directory` | v1, `verify_jwt=false` | 6,901 | 8,723 | Entrypoints differ; `main` imports `../_shared/default-images.ts`, absent from the live entrypoint. Review default-image behavior and public directory filtering in staging before syncing. Public read access is intentional for this endpoint, subject to the explicit response allowlist. |

### Required follow-up

1. Preserve the current live source and migration history while each difference is reviewed against its authorization and data contract.
2. For financial-journal, follow the exact RC449A → RC450 → matching Edge Function rollout in `docs/runbooks/RC450_FINANCIAL_JOURNAL_ROLLOUT.md`; current Production is missing those ledger versions.
3. For payment intent and webhook source, verify migration presence, ACL/RPC compatibility, request signing, amount/currency/order/provider-intent correlation, idempotency, duplicate/retried callbacks, and ambiguous provider outcomes on a disposable/staging environment before proposing deployment.
4. For catalog functions, test authorization and tenant/business scope as well as intentional public reads. Never treat a byte match alone as a security certification.
5. Keep `PRODUCTION_GATE=BLOCKED` while migration statement identity, backup/restore, provider/finance E2E, function parity and live Auth security settings remain unverified.

This addendum was produced from read-only deployment/source inspection. No Edge Function deployment, database write, migration application, permission change, wallet operation, order creation, or provider request was performed.
