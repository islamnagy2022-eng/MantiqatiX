# S07 SMM Gateway — Isolated Integration Test Matrix

Date: 2026-10-13  
Branch: `agent/s07-smm-gateway`  
PR: [#221 — Draft](https://github.com/islamnagy2022-eng/MantiqatiX/pull/221)

## Gate status

**BLOCKED / NOT CERTIFIED.** This document defines the next verification work; it is not evidence that any integration test has run or passed. Keep the launch gate closed. Do not call a real provider, submit a campaign, mutate production wallet balances, alter production schema/grants/secrets, merge, or deploy.

## Preconditions for a disposable test environment

- Use a disposable Supabase project/database populated only through the approved migration chain.
- Use isolated test identities for regular user, tenant member, tenant admin, platform SMM admin, and unauthenticated caller.
- Use a local/mock provider transport with deterministic fixtures, delayed responses, connection failures, and malformed responses. No paid provider credentials or real campaign submissions.
- Reset database state between cases; capture request IDs and correlation IDs without recording secrets or full authorization headers.
- Confirm all test writes target the disposable project before running any integration suite.

## Integration cases

| ID | Scenario | Setup / action | Required assertion | Current evidence |
|---|---|---|---|---|
| S07_INT_001 | Deferred gate fails closed | Both approval flags absent, false, mixed-case, or whitespace-padded | HTTP 503 with stable `SMM_DEFERRED`; no auth-dependent dispatch, DB write, wallet mutation, or provider request | Source gate exists; live HTTP test not run |
| S07_INT_002 | Explicit gate approval contract | In isolated test harness only, supply both exact `true` flags and a test-only reviewed gate seam | Gate decision enables only when both values exactly equal `true`; never alter production constant to run this test | Helper unit tests exist; integration not run |
| S07_INT_003 | Authentication required | Missing, invalid, expired, and valid JWTs | Reject invalid callers; no sensitive details or side effects leak | Not run |
| S07_INT_004 | Tenant isolation | User A attempts to read or mutate User B / Tenant B order | Deny cross-tenant access; no rows or provider metadata disclosed | Not run |
| S07_INT_005 | Provider/admin authorization | Ordinary user calls provider configuration or admin-only actions | Deny; configuration secrets never returned | Not run |
| S07_INT_006 | Catalog normalization | Mock provider returns valid, malformed, inactive, zero-price, and extra-metadata service rows | Reject malformed rows; new services stay inactive and zero-priced until reviewed; discard unapproved metadata | Helper tests exist; gateway integration not run |
| S07_INT_007 | Order validation and pricing | Zero/negative/out-of-range quantity, invalid target URL, invalid price, non-positive margin | Reject before order persistence, wallet mutation, or provider request | Helper tests exist; gateway integration not run |
| S07_INT_008 | Idempotent duplicate submit | Submit the same idempotency key concurrently and sequentially | Exactly one logical order/debit/provider submission; duplicate returns stable existing result | Helper test exists for key validation; concurrency not run |
| S07_INT_009 | Concurrent wallet spending | Two simultaneous orders exceed the available balance in aggregate | At most the allowed debit succeeds; no negative balance or double debit; transactional invariant holds | Not run |
| S07_INT_010 | Provider timeout before known response | Mock provider times out after request dispatch | Mark outcome ambiguous; do not blindly retry or refund; preserve reconciliation reference | Not run |
| S07_INT_011 | Provider accepted, persistence fails | Provider mock accepts order, then simulated DB persistence failure occurs | Mark `PROVIDER_ACCEPTED_PERSISTENCE_PENDING`; preserve provider correlation for reconciliation; do not submit again automatically | Marker present in live v10; integration not run |
| S07_INT_012 | Wallet debit result ambiguous | Simulate a lost/ambiguous database response during debit | Mark `WALLET_DEBIT_RESULT_UNKNOWN`; reconcile authoritative wallet/order state before any retry | Marker present in live v10; integration not run |
| S07_INT_013 | Refund idempotency | Simulate a terminal provider failure and replay its event | At most one authorized refund; no legacy automatic refund shortcut; ledger and order state remain consistent | Branch entrypoint currently contains legacy `smm_refund_wallet`; blocked |
| S07_INT_014 | Provider endpoint SSRF/redirect | Attempt non-HTTPS, unlisted host, credentials in URL, private/local IP, unsafe port, and redirect | Reject unsafe endpoints; redirects disabled; no request reaches forbidden destination | Helper tests exist; integration not run |
| S07_INT_015 | Status transitions | Replay pending, processing, completed, failed, and unknown provider states | Terminal states do not regress; unknown states remain non-terminal/explicitly unknown; updates are idempotent | Helper tests exist; event integration not run |
| S07_INT_016 | Event/notification persistence | Repeated and out-of-order status events | Durable deduplication; correct order state; no duplicate notifications or cross-tenant event disclosure | Not run |
| S07_INT_017 | Secret and error redaction | Provider returns tokens, authorization values, stack traces, and malformed payloads | Client responses/logs omit secrets and sensitive payloads; stable safe error codes | Not run |
| S07_INT_018 | Rate/spend ceilings | Requests exceed configured per-user and spend limits | Reject before external provider dispatch and wallet debit; record safe audit event | Not run |

## Required sequence

1. Resolve the entrypoint parity gap: branch `index.ts` is 10,678 bytes while inspected live v10 `index.ts` is 19,650 bytes. Do not open the gate while the entrypoint still lacks the live helper wiring and safety controls.
2. Review source parity and dependencies against a reviewed candidate; do not blindly bulk-overwrite the entire live source.
3. Run all helper tests and record the exact GitHub Actions run URL, commit SHA, job conclusion, and test counts.
4. Run the matrix against the disposable database/mock provider, with concurrency and fault-injection cases separated and repeatable.
5. Reconcile the previously observed unclear `service_role` table grants using the approved migration chain in the disposable environment. Do not apply ad-hoc production grants.
6. Only after evidence review, request explicit release approval. Keep PR #221 Draft and do not merge/deploy before approval.

## Completion evidence template

- Commit SHA:
- Workflow run URL / conclusion:
- Helper tests: passed / failed / skipped:
- Disposable migration replay: passed / failed:
- Integration cases passed / failed / skipped:
- Unresolved blockers:
- Reviewer and approval:
- Production changes: **none** (must remain true for this workstream until separately authorized).

## Follow-up checkpoint — expanded catalog-normalization edge coverage

Date: 2026-10-13

Added three test cases to `supabase/functions/smm-gateway/catalog-normalization.test.ts`:

- `S07_CATALOG_006`: rejects blank/unsupported external service identifiers and missing/blank provider rates.
- `S07_CATALOG_007`: verifies zero, equal-cost, negative, and non-finite existing selling prices cannot preserve service activation; invalid stored prices normalize to zero.
- `S07_CATALOG_008`: asserts the normalized result has only the explicit output allowlist and does not copy arbitrary provider token/secret fields.

These are committed test additions only; the GitHub Actions result for this new commit must be checked before reporting them as passing. The normalization helper itself was not changed, preserving byte-for-byte parity with the inspected live helper.

### Remaining catalog review note

The current helper truncates external service IDs to 128 characters rather than rejecting overlong IDs. Two distinct upstream IDs sharing the same first 128 characters could collide in a database key. Because the helper is currently byte-identical to the inspected live v10 helper, this behavior is recorded as a source-parity follow-up rather than changed in isolation. A correction must include a deliberate parity decision, collision/migration review, and tests before adoption.

Status remains **BLOCKED / NOT CERTIFIED**. The launch gate remains closed; no provider request, wallet mutation, schema/grant change, merge, or deployment was performed.

## Follow-up checkpoint — order/status boundary coverage expanded

Date: 2026-10-13

Added focused unit cases:

- `S07_ORDER_007`: reserved/local suffixes, IPv6 loopback, and overlong target URLs are rejected by order-input validation.
- `S07_ORDER_008`: empty/overlong service IDs and unsafe/oversized quantity representations fail closed. The oversized numeric-string fixture was corrected to 16 digits so it actually exercises the validator's length rejection.
- `S07_STATUS_004`: terminal-state protection is case-insensitive for lowercase persisted terminal statuses.

No production gateway behavior was changed. These tests are not marked passed until the corresponding completed GitHub Actions run is observed. The static source-parity validator remains intentionally blocking because the entrypoint still lacks the reviewed v10 imports and outcome handling.
