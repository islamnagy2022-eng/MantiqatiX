# SMM Gateway Security Verification — 2026-10-13

## Scope and baseline
- Repository: `islamnagy2022-eng/MantiqatiX`
- Starting PR: #218, head `77012649e41fe22077538c39cd8593bf696ab33e`
- Working branch: `security/smm-gateway-runtime-verification-20261013`
- Scope: source-level SMM gateway security contract and CI wiring only.
- No production deployment, Supabase mutation, auth/RLS/grant change, migration-ledger edit, merge, wallet action, or provider request was performed.

## Findings confirmed from source
1. The gateway responds with `503 SMM_DEFERRED` when `SMM_INITIAL_LAUNCH_DEFERRED` is true, before user lookup, body parsing, provider calls, wallet RPCs, or order mutations. The source constant is currently hard-coded to `true`; this is a safe containment state, not evidence that the feature is ready to launch.
2. The secondary launch helper requires both `MNTY_SMM_ENABLED=true` and `MNTY_SMM_POST_LAUNCH_APPROVED=true`, but those flags cannot override the hard-coded deferred constant.
3. User data queries include verified-user scoping; order-status reads are scoped by both order ID and user ID. Admin actions use an explicit SMM admin allowlist or a platform-scoped SUPER_ADMIN membership with `full_control === true`.
4. Request JSON is bounded and validates media type, JSON shape, and size. Provider transport requires an HTTPS host allowlist, rejects redirects, has a 15-second timeout, and bounds/validates provider JSON.
5. Provider credentials are obtained through `smm_get_provider_secret`; the gateway source does not directly select `api_key_ciphertext`. Existing ACL integration asserts provider credentials and wallet transactions remain RPC-only.
6. Order creation has an idempotency key and detects same-key/different-payload conflicts. Ambiguous provider outcomes are returned as reconciliation-required and are not automatically refunded.

## Verification performed in this branch
- Added a static security-contract validator checking gate order, authorization, tenant/user scoping, idempotency, secret/log boundaries, outbound transport and ACL contract.
- Added a dedicated GitHub Actions workflow to run the static validator, existing service-role validator, Deno type check and SMM unit tests on relevant changes.
- SMM code-contract CI: **PASS** on code-bearing commit `b1c43c1affeffd44e7e44d4ce07b554bc59a354d`, tested as synthetic merge commit `55974e2` against PR #218 base `77012649e41fe22077538c39cd8593bf696ab33e`. Run [#38349997044](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38349997044) passed the source contract validator, service-role boundary validator, Deno type check, and SMM unit/negative-input tests. The current branch head is later documentation-only; the runtime/validator files have not changed since the passing code commit.
- Local runtime execution: NOT RUN; the GitHub connector does not provide a local Deno/PostgreSQL runtime in this session.
- HTTP negative tests against a running Edge Function: NOT RUN. The existing unit tests validate helper behavior, not end-to-end HTTP responses or absence of database/provider side effects at runtime.
- Live deployed parity: **VERIFIED by read-only source comparison**. Supabase reports `smm-gateway` ACTIVE v10, `verify_jwt=true`, entrypoint SHA-256 `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`. Retrieved deployed `index.ts` is byte-for-byte identical after newline normalization to the PR #218 source at `77012649e41fe22077538c39cd8593bf696ab33e` (19,650 characters). It includes `SMM_INITIAL_LAUNCH_DEFERRED=true` and returns `503 SMM_DEFERRED` before user lookup, body parsing, provider transport, wallet RPCs, or order writes. This is source/deployment parity evidence, not a live HTTP request test.

## Current verified state

- Static contract and helper unit tests pass on the code-bearing commit noted above.
- Deployed v10 source matches the reviewed PR #218 source and is hard-disabled at the handler entrypoint.
- No live HTTP request or provider call was performed. No production deployment, migration, grant, Auth/RLS, wallet, payment, or data mutation was performed in this session.
- Global release remains **BLOCKED / NOT CERTIFIED** by the independent MantiGO live authorization and chronological migration replay blockers.

## Required before any launch
1. Keep SMM deferred until an approved release change removes/changes the hard-coded kill switch through reviewed source and CI.
2. Run isolated HTTP integration tests against a disposable Supabase/Edge Runtime with mocked provider endpoints and DB/RPC spies. Assert 503 before auth lookup/body parsing and zero DB writes/provider calls/wallet RPCs.
3. Test missing/invalid/expired JWT, anonymous user, unauthorized tenant admin, malformed/oversized payload, cross-user order ID, same-key replay, changed-payload idempotency conflict, timeout, provider 4xx/5xx/malformed response, persistence failure after provider acceptance, and terminal status preservation.
4. Re-run the RC456 disposable PostgreSQL ACL integration and review the live grants/RLS/RPC contracts read-only. Do not apply production grants, migrations or deployments from this branch.
5. Confirm the deployed function version/source hash, `verify_jwt`, CORS allowlist, environment flags, provider host allowlist and secret RPC behavior in an approved staging environment. Verify redacted logs and response bodies.
6. Run full required release gates, exact-head CI, backup/restore and rollback evidence; release stays BLOCKED / NOT CERTIFIED until independently verified.

## Risk notes
- The current hard-disabled flag in the deployed v10 source prevents SMM requests from reaching auth or business logic, which is fail-closed but means allowed-path HTTP behavior has not been proven.
- Static checks cannot prove runtime side-effect ordering, JWT verification at the gateway edge, actual database grants, deployed/source parity, or provider behavior.
- The gateway's `order_status` path has no local try/catch around its provider call; top-level catch returns a generic 500, but runtime timeout/response behavior still needs integration coverage.
- Provider result parsing recognizes a returned order identifier but does not locally validate every provider-specific error shape; provider contract fixtures are still needed.
