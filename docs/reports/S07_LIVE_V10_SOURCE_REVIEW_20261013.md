# S07 follow-up — live v10 source review and parity checkpoint

Date: 2026-10-13  
Function: `smm-gateway`  
Project: `moyhiluyhjsujhwlyeuu`

## Live snapshot rechecked

- Status: ACTIVE
- Version: 10
- `verify_jwt`: true
- Supabase-reported source SHA-256: `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`
- The returned live source contains `SMM_INITIAL_LAUNCH_DEFERRED=true`, calls `getSmmLaunchDecision`, and returns `503 SMM_DEFERRED` before authenticated action dispatch. The gate was not removed.
- This verifies the source-level contract, not a live HTTP 503 response. The available recent logs only returned v8 OPTIONS 200 and POST 403 events, not a v10 smoke request.

## Live source safeguards observed (static inspection only)

| Area | Observation | Test status |
|---|---|---|
| Provider transport | HTTPS endpoint allowlist via `SMM_PROVIDER_HOSTS`; redirect disabled; 15-second AbortController timeout; bounded JSON response | Source observed; no outbound request made |
| Request validation | Bounded JSON parser; HTTPS target URL checks; quantity validation; idempotency key required | Source observed; unit/integration runtime not run |
| Pricing | Finite numeric checks, safe integer quantity, positive margin and rounded money | Source observed; boundary matrix not run |
| Duplicate submissions | Unique-key conflict path checks same user/service/target/quantity and replays prior result without a new submission | Source observed; concurrent DB test not run |
| Ambiguous provider outcome | Does not automatically refund; returns `PROVIDER_RESULT_UNKNOWN` with reconciliation required | Source observed; fault injection not run |
| Unknown debit outcome | Returns `WALLET_DEBIT_RESULT_UNKNOWN`; marks reconciliation needed instead of treating it as a normal insufficient-balance result | Source observed; RPC fault injection not run |
| Provider accepted, persistence failed | Returns `PROVIDER_ACCEPTED_PERSISTENCE_PENDING` and flags reconciliation | Source observed; DB failure not injected |
| Order status | Uses terminal-state normalization and compare-and-set status update scoped to user/order | Source observed; concurrency test not run |
| Event persistence | Submission event failure is surfaced as `event_recorded:false`; status-event failure is logged | Source observed; persistence fault not injected |
| Provider credentials | Secret retrieval is via server-side RPC; public catalog projection excludes provider credentials and internal provider costs | Source observed; secret-leak integration test not run |

## Source parity warning

The current `main` file retrieved for `supabase/functions/smm-gateway/index.ts` is materially older/different from live v10: it lacks the v10 helper imports and contains older order/refund/status behavior. The S07 branch was originally created from `main`, so the branch must not be represented as a full v10 source-convergence PR merely because it contains the launch-gate helper.

A source-sync attempt was not completed. Do not merge PR #221 as a production source candidate until every live helper file and the entrypoint are reconciled and reviewed in a separate, explicit source-parity step.

## Database privilege finding

A read-only query of `information_schema.role_table_grants` returned only REFERENCES/TRIGGER/TRUNCATE entries for `service_role` on the inspected SMM tables and no SELECT/INSERT/UPDATE/DELETE rows. Because the live gateway directly reads/writes several tables, this remains a release blocker until the effective privilege model (including inherited grants, RLS bypass semantics, and RPC-only access boundaries) is verified in a disposable environment. No grants or migrations were changed.

## Next safe tests (must be isolated)

1. Unit tests for endpoint allowlist: missing allowlist, unlisted hostname, HTTP, credentials in URL, localhost/IP/private host, non-443 port, and valid allowlisted HTTPS host.
2. Response parsing: non-2xx, non-JSON, invalid UTF-8/JSON, empty body, oversized body, and timeout.
3. Order input/pricing: missing or malformed idempotency key, URL schemes/credentials/IP hosts, zero/unsafe quantities, NaN/Infinity, non-positive margin, rounding edges, and max monetary bounds.
4. Idempotency: same key + same payload returns the original order; same key + different payload returns 409; concurrent duplicate insert causes at most one provider submission and one wallet debit.
5. Fault injection: debit RPC error/false, provider timeout after possible acceptance, missing provider order ID, provider accepted but persistence fails, event insert fails, status update races with a terminal state.
6. Authorization: customer can read only their own orders/wallet; tenant-level OWNER/ADMIN must not inherit platform admin; provider secrets/costs never enter client responses.
7. Run tests against disposable PostgreSQL and mocked provider transport only. Never call a real provider or mutate production wallet data.

## Decision

**BLOCKED / NOT CERTIFIED.** Keep the live launch gate intact. No deployment, merge, migration, secret change, live provider call, paid campaign, or wallet mutation was performed.

## Follow-up checkpoint — fail-closed parity guard

Date: 2026-10-13

A further read of the S07 branch entrypoint confirmed that it is still the older `index.ts` implementation, not the reviewed live v10 source. It still contains a direct `smm_refund_wallet` call after provider execution failure, lacks the v10 provider-transport/request/order-validation helpers, and uses the older provider call path. The static launch gate currently returns before these actions, but this does **not** make the stale action implementation suitable for a future launch.

To prevent the current static validator from certifying that stale source, the validator now explicitly requires the v10 helper imports and the ambiguous-outcome markers (`PROVIDER_RESULT_UNKNOWN`, `WALLET_DEBIT_RESULT_UNKNOWN`, `PROVIDER_ACCEPTED_PERSISTENCE_PENDING`), and rejects the legacy automatic-refund call. It also checks for all seven gate test IDs. Given the checked-in entrypoint, this parity validator is expected to fail until a reviewed source-parity update is made; this is an intentional safety block, not a regression to bypass.

The added tests `S07_GATE_006` and `S07_GATE_007` cover false/empty flags and all non-approved flag pairs. They have been committed but have not yet been confirmed by a completed Deno CI run.

No live function, secrets, database grants, provider, wallet, or production deployment was changed. Keep PR #221 draft and do not certify it for production until source parity and isolated integration tests are complete.


## Follow-up checkpoint — live helper parity and CI evidence

Date: 2026-10-13

A read-only retrieval of the active Supabase Edge Function `smm-gateway` (version 10; reported function SHA-256 `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`) was compared against the S07 branch files.

| File | Live bytes | Branch bytes | Result |
|---|---:|---:|---|
| `launch-gate.ts` | 479 | 479 | Byte-identical |
| `provider-transport.ts` | 3,180 | 3,180 | Byte-identical |
| `order-status.ts` | 820 | 820 | Byte-identical |
| `catalog-normalization.ts` | 2,872 | 2,872 | Byte-identical |
| `order-validation.ts` | 3,988 | 3,988 | Byte-identical |
| `request-validation.ts` | 2,159 | 2,159 | Byte-identical |
| `index.ts` | 19,650 | 10,678 | **Different; parity not established** |

This narrows the tracked-file parity gap: all six helper files currently in the branch match the deployed v10 helper contents byte-for-byte, while the entrypoint is materially different and does not import/use the v10 safety helpers. This is not full source parity, and the function-level SHA-256 must not be represented as an individual-file hash.

### CI observation

The GitHub Actions run `38338350751` completed the seven Deno launch-gate unit tests successfully (**7 passed, 0 failed**) but failed the static validator at the expected source-parity assertion because the branch entrypoint does not import `./provider-transport.ts`. This confirms that the guard is actively blocking the stale entrypoint; it does not certify the gateway or the production runtime.

The newer validator revision that checks actual import declarations was committed separately as `2b0c468b7196a226f62f69d2b87981971f3d23ef`. Its workflow result is not yet confirmed. Do not weaken the assertion to turn CI green. Next source-parity work must reconcile the entrypoint's behavior in reviewed, bounded changes, preserve the hard deferred-launch gate, and then run isolated tests. No production function, database privilege, secret, wallet, provider, or deployment was changed during this read-only comparison.


### Entrypoint safety-feature comparison

The following source-marker comparison was also performed against the retrieved live v10 `index.ts`. These are source observations only, not runtime proofs:

| Safety behavior / marker | Live v10 entrypoint | S07 branch entrypoint |
|---|---|---|
| Bounded request JSON (32 KiB) | Present | Missing |
| Provider HTTPS allowlist helper | Present | Missing |
| Provider request timeout (15 s) | Present | Missing |
| Redirects rejected | Present | Missing |
| Order input validation helper | Present | Missing |
| Pricing/margin validation helper | Present | Missing |
| Money normalization helper | Present | Missing |
| Idempotency handling marker | Present | Missing |
| Explicit ambiguous provider result marker | Present | Missing |
| Explicit ambiguous wallet debit marker | Present | Missing |
| Provider accepted, persistence pending handling | Present | Missing |
| Provider status normalization helper | Present | Missing |
| Provider service normalization helper | Present | Missing |
| Bounded provider response parser | Present | Missing |
| Legacy automatic refund RPC `smm_refund_wallet` | Absent | Present |
| Hard deferred launch gate | Present | Present |

This matrix explains why the entrypoint must not be certified even though the helper files match. Do not resolve the mismatch by simply deleting the validator or by opening the launch gate. The next code change should be a reviewed reconciliation of the entrypoint with the six already-matching helpers, followed by isolated tests for idempotency, debit/provider ambiguity, persistence failure, SSRF/redirect/timeout handling, and terminal status transitions.


### Follow-up checkpoint — catalog sync path is still unsafe in stale entrypoint

A fresh read of the current `agent/s07-smm-gateway` branch confirms that `supabase/functions/smm-gateway/index.ts` imports only `launch-gate.ts`, not the matching v10 helpers. In particular, the `sync_services` action still constructs a row directly from provider input with these behaviors:

- `selling_price: Number(s.rate || 0)` uses provider cost as the customer selling price.
- `active: true` activates imported services without a reviewed price/margin.
- `metadata: s` persists the raw provider object rather than the allowlisted normalized metadata.
- The action upserts the row directly instead of using `normalizeProviderService`.

The hard-coded `SMM_INITIAL_LAUNCH_DEFERRED=true` check occurs before authenticated action dispatch, so this stale action path remains blocked while the gate is intact. It must not be enabled by changing the constant or environment flags until the entrypoint is reconciled with the v10 helper modules and tests. The existing static validator already requires the v10 imports and is expected to fail against this entrypoint; retain that failure as a release block.

This is a source-level finding only. No provider call, service sync, wallet mutation, migration, live function update, or deployment was performed.


### Follow-up checkpoint — endpoint-policy failure isolated for next run

The latest S07 CI run completed with 22 passing tests and one failure in the combined provider-endpoint test. The error was `Provider endpoint rejected by outbound URL policy`; the combined test did not identify which endpoint assertion triggered it. To avoid guessing at a fix, the test was split into separate cases for: an allowlisted HTTPS host, an unlisted host, HTTP, embedded credentials, and a non-standard port. This is test-only instrumentation to identify the exact failing condition on the next workflow run.

The gateway entrypoint remains stale relative to deployed v10, and the validator intentionally blocks it. Do not remove the parity assertions or open the hard launch gate to make CI pass. The split-test run is queued; the endpoint-policy failure is not yet resolved.


## Follow-up checkpoint — current S07 and S09 CI evidence

Date: 2026-10-13

- S07 run `38342505446` completed **failure** at the intentional source-parity validator. All **44 Deno helper tests passed** (0 failed); the static validator then rejected the stale entrypoint because it does not import `./provider-transport.ts` and the other v10 helpers. This is the desired fail-closed result; do not weaken the validator to get a green run.
- The validator's failure output still shows the legacy entrypoint has the old `sync_services` behavior (`selling_price = provider rate`, `active = true`, raw provider metadata) and legacy automatic refund logic. The hard launch gate is still ahead of the action dispatch. Keep the gateway disabled until the entrypoint is reconciled and isolated action tests pass.
- S09 frontend QA run `38342361759` completed **success** at commit `3cd6eec1d48c3bc3e741587235fb7667840c1bcc`. Its 18 Node smoke tests passed, and the JS syntax check that had failed on an earlier head now passed. This is static/frontend smoke evidence only; it does not establish browser E2E, backend authorization, or production readiness.
- Separate `Deploy MantiqatiX Web` workflow run `38342505487` completed successfully on the S07 branch, but a workflow-level success alone is not evidence of a production deployment. The Pages workflow's deploy job is gated to `main` pushes or manual dispatch; inspect the individual job before making any deployment claim.

No live SMM function, database privilege, secret, provider, wallet, or production deployment was changed in this checkpoint.


## Follow-up checkpoint — v10 entrypoint source reconciliation committed

Date: 2026-10-13

A read-only retrieval of the active Supabase Edge Function `smm-gateway` returned ACTIVE version 10, `verify_jwt=true`, and function source SHA-256 `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`. The returned `index.ts` content was copied into the isolated S07 branch and fetched back from GitHub for exact content comparison.

- Branch `supabase/functions/smm-gateway/index.ts` now matches the returned live v10 entrypoint content exactly: **19,650 characters, exact comparison true**.
- The five v10 helper imports (`provider-transport.ts`, `order-validation.ts`, `request-validation.ts`, `order-status.ts`, and `catalog-normalization.ts`) are present in the reconciled entrypoint; the helper files had already been verified byte-identical to the live source in the previous checkpoint.
- `SMM_INITIAL_LAUNCH_DEFERRED=true` remains in the source. The code path is still blocked before authenticated action dispatch. The legacy automatic refund call is absent from the reconciled entrypoint.
- Commit: `93e282449fb579861c3300bbbed77fe2b34cf6eb`.

This is a source-reconciliation change to the draft branch only. It did **not** deploy or modify the live Edge Function, database grants, secrets, provider, wallet, or campaigns. It also does not by itself prove runtime behavior, database privilege sufficiency, or release readiness. The S07 CI workflow must pass against this exact head, and isolated authorization/provider/fault-injection tests remain required before any future launch-gate change.


## Final checkpoint for this iteration — S07 contract green after source reconciliation

- Workflow run `38342774931` on the reconciled entrypoint commit `93e282449fb579861c3300bbbed77fe2b34cf6eb` completed successfully.
- Deno helper suite: **44 passed / 0 failed**.
- Static entrypoint/parity validator: **PASS**.
- The separate run `38342770170` was still in progress at the last status check; the completed run above is the confirmed green evidence.
- The hard source-level launch deferral remains intact. A green contract run does not mean SMM is enabled or certified for production: runtime HTTP smoke, effective database grants, real role/tenant integration, and provider/database fault-injection tests remain outstanding.

