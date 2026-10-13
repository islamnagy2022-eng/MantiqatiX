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
