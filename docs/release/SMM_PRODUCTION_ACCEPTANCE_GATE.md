# SMM Production Acceptance Gate

Status: **BLOCKED / NOT CERTIFIED**  
Scope: SMM external storefront, gateway, provider integration, and wallet/order lifecycle.  
Rule: passing source CI is not production acceptance. Do not activate real orders until every required gate below has objective evidence and the release owner authorizes deployment.

## Gate 0 — Production safety and scope

- [x] Keep the separate SMM storefront deferred in the candidate source.
- [x] Candidate gateway uses canonical `MNTY_SMM_ENABLED` flag; only exact string `true` allows SMM actions.
- [ ] Verify the live gateway source/hash and version after an authorized deployment.
- [ ] Test unauthenticated request: expected denial, no database mutation.
- [ ] Test ordinary authenticated user while disabled: expected `503 SMM_DEFERRED`, no database/provider/wallet mutation.
- [ ] Test malformed/unknown actions while disabled: denial occurs before action parsing and side effects.
- [ ] Verify logs contain no bearer tokens, provider secrets, or wallet-sensitive data.

## Gate 1 — Migration lineage and schema

- [ ] Reconcile repository migration history with production migration ledger; preserve applied migration immutability.
- [ ] Resolve the credit-table historical-baseline blocker using provenance-backed schema history; do not invent a baseline or treat RC40 as exact production history.
- [ ] Re-run full-chain disposable database replay from a clean database.
- [ ] Confirm replay and production schema agree for the SMM tables, constraints, indexes, triggers, functions, and RLS policies.
- [ ] Verify the required SMM migrations are in the reconciled chain and applied in a reviewed order: service-role boundary (RC456), order idempotency (RC463), and wallet exactly-once (RC464).
- [ ] Verify `smm_orders.idempotency_key` exists with the expected uniqueness/scope constraints.
- [ ] Verify unique wallet debit/refund references and indexes exist and match the RPC contract.
- [ ] Capture read-only schema diff and migration ledger evidence.

## Gate 2 — Least-privilege access boundary

- [ ] Verify service_role receives only the table privileges needed by the gateway.
- [ ] Verify anon/authenticated do not receive direct write access to provider credentials, orders, wallet ledger, or sensitive provider data.
- [ ] Verify provider secrets can only be read/updated through approved RPCs and never appear in client responses/logs.
- [ ] Verify SECURITY DEFINER functions have pinned safe search_path, narrow EXECUTE grants, authorization checks, and bounded input validation.
- [ ] Run the SMM service-role boundary validator against the exact release commit and reconciled schema.

## Gate 3 — Provider and catalog readiness

- [ ] Configure at least one explicitly approved provider in a non-production/sandbox environment.
- [ ] Verify provider endpoint allowlisting/HTTPS, timeout, bounded response size, and safe parsing.
- [ ] Verify invalid credentials and provider errors fail closed without leaking secrets.
- [ ] Sync catalog in sandbox and verify prices, currency, quantity limits, service status, and provider mapping.
- [ ] Ensure customer selling price is not blindly set equal to provider rate; verify the approved pricing/margin policy.
- [ ] Verify inactive provider/service cannot accept new orders.
- [ ] Production provider activation requires a separate explicit release approval.

## Gate 4 — Order and wallet correctness

- [ ] Same idempotency key and same user/payload returns the original order without a second debit.
- [ ] Reusing a key with a different user or materially different payload is rejected.
- [ ] Concurrent duplicate requests result in one order and one debit.
- [ ] Insufficient balance rejects order without creating provider work.
- [ ] Database failure before debit creates no order/debit/provider call.
- [ ] Timeout after provider submission enters a reconcilable uncertain state; do not auto-refund while provider acceptance is unknown.
- [ ] Provider acceptance followed by local persistence failure is recoverable without duplicate submission or debit.
- [ ] Provider rejection produces at most one compensating refund.
- [ ] Confirmed cancellation is claimed atomically and refund is idempotent.
- [ ] Unconfirmed cancellation never triggers a refund.
- [ ] Every debit/refund is tied to a unique order/reference and auditable event.
- [ ] Balance equals ledger-derived balance after each test scenario.

## Gate 5 — Abuse resistance and operational controls

- [ ] Enforce authentication, per-user ownership, admin RBAC, rate limits, and bounded pagination.
- [ ] Add request/provider timeouts and safe retry budgets.
- [ ] Verify no arbitrary provider URL can be supplied by a client (SSRF guard).
- [ ] Verify input bounds, integer quantity rules, amount/currency validation, and response schemas.
- [ ] Confirm reconciliation queue has bounded batch size, safe retry, audit trail, and admin-only access.
- [ ] Confirm alerts exist for repeated provider failures, stuck uncertain orders, duplicate attempts, and wallet reconciliation mismatch.
- [ ] Confirm backups and restore/reconciliation runbook cover SMM order and wallet ledger data.

## Gate 6 — Exact-head CI and release review

- [ ] All required workflows pass on the exact candidate commit.
- [ ] Disposable PostgreSQL contract tests pass on the same migration chain used for release.
- [ ] Deno type-check and SMM launch-gate tests pass on the exact source.
- [ ] Security review signs off on schema diff, grants, RPC boundaries, and provider error handling.
- [ ] Release owner reviews evidence and explicitly authorizes merge/deploy.
- [ ] Deploy gateway and migrations only through the approved reconciled release procedure.
- [ ] Record live function version/hash, migration ledger, environment flag state, and negative-test evidence.
- [ ] Keep `MNTY_SMM_ENABLED` unset/false until production acceptance is signed.
- [ ] Enable only after a separate explicit go-live approval; perform a small controlled smoke test and verify balances/ledger immediately.

## Current verified blockers (read-only snapshot, 2026-10-13)

- Live `smm-gateway`: ACTIVE version 8; hash `c16d88610845d8dbab5ee40f366452a40e9cc021df487d45ebcd8077199ee40f`; candidate launch gate is not in the live source.
- Production migration ledger ends at `20261008222845` / RC424 in the latest queried snapshot.
- Active SMM providers: 0; active services: 0; SMM orders: 0.
- `smm_orders.idempotency_key`: absent in production snapshot.
- `service_role` SELECT/INSERT/UPDATE privileges are absent on the six sampled SMM tables.
- RC456/RC463/RC464 remain candidate/source work and must not be independently applied outside the reconciled chain.
- Credit historical-baseline replay blocker remains unresolved; no approved baseline exists.

## Evidence policy

For each checked item record: exact commit SHA, workflow/run URL or SQL query, timestamp, expected result, observed result, reviewer, and any exceptions. Never mark a gate complete based solely on source inspection if the gate requires live evidence.

## Current decision

**BLOCKED / NOT CERTIFIED — not ready for real customer orders.**  
This document is a checklist, not an authorization to deploy, migrate, grant privileges, configure a live provider, or move money.


## 2026-10-13 — Provider transport hardening (candidate source only)
- [x] Hardened the candidate provider HTTP helper to require HTTPS, reject embedded URL credentials, non-standard ports, localhost/local hostnames and IP-literal hosts, reject redirects, enforce a 15-second timeout, bound response bodies to 1 MiB, require JSON, and avoid raw-body fallback.
- [x] Extended `scripts/validate-smm-deferred-gate.mjs` to assert these source-level transport guards.
- [ ] This does not provide DNS-resolution/egress allowlisting against every private-address or DNS-rebinding case; a reviewed provider hostname allowlist or network egress control remains required before enabling provider calls.
- [ ] The current order exception path still needs a separate redesign and tests so timeout/ambiguous provider outcomes or post-acceptance persistence errors cannot cause automatic refund. Keep SMM disabled until this is closed.
- [ ] Latest CI for the new commits is queued/in progress; no result is claimed yet.


## 2026-10-13 — Ambiguous order outcome quarantine (candidate source only)
- [x] Removed automatic SMM wallet refund from the provider exception path. Network errors, timeouts, invalid/unknown provider responses, and missing provider order IDs now return a reconciliation-required response and keep the debited order pending rather than guessing failure.
- [x] Split wallet debit RPC errors from an explicit rejected debit; an RPC error is treated as an unknown outcome rather than assumed to mean no debit.
- [x] If the provider returns an order ID but saving that ID fails, return `PROVIDER_ACCEPTED_PERSISTENCE_PENDING` and do not refund.
- [x] Added source-contract checks for these ambiguous-result behaviors.
- [ ] Verify against the exact live schema/status constraints and reconcile with the idempotency/terminal-state migrations before enabling SMM. This is candidate source only; CI is pending.


## CI update — 2026-10-13
- [x] Pages `validate` succeeded at candidate commit `68c78cc5f5a6fa57d4246967ac88849400371bcd`, including provider transport unit tests and source validation.
- [ ] The workflow's `deploy` job is skipped for the draft PR; no production deployment.
- [ ] Other exact-head CI checks were queued/in progress at the last inspection.
- [ ] Keep SMM disabled until live schema/idempotency/terminal-state reconciliation, provider egress controls, and production negative tests are complete.


## Order-status reconciliation — 2026-10-13
- [x] Candidate polling preserves terminal order states against stale provider responses.
- [x] Failed status persistence is surfaced as `ORDER_STATUS_PERSISTENCE_PENDING`.
- [x] Client responses contain only normalized status and provider status, not the raw provider payload.
- [ ] Exact-head CI is pending; production schema and terminal-state/idempotency contract still require verification.


## Exact-head CI update — 2026-10-13
- [x] SMM Service Role Access Boundary, including disposable PostgreSQL integration and Deno type-check, passed on `d110109fb42269d24885b41e78c9a25767003781`.
- [x] Module Professionalization and MantiGO privacy checks passed on the same head.
- [ ] Backend-only Module Boundary and Pages workflow were still running at last check.
- [ ] No production deploy; SMM must remain disabled pending live schema/idempotency parity, network egress controls, and production negative tests.


## Additional transport and order-state verification — 2026-10-13
- [x] Unit tests cover provider order status normalization and terminal-state regression.
- [x] The 15-second timeout remains active through response-body parsing.
- [x] Order events persist a minimal provider response summary, not the full provider payload.
- [x] Pages `validate` passed at `208621b59c0067d8637f3637fce5000f742c6aea`, including Deno tests, production verification engine, and syntax check.
- [ ] Deployment is not claimed (deploy job skipped for draft PR); exact-head PostgreSQL/other boundary checks are still completing.
