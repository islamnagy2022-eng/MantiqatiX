# S06 — Orders, Payments & Financial Integrity Test Record

Date: 2026-10-13
Branch: `test/s06-payment-integrity-20261013`
Scope: source-level regression contracts only; no production mutations.

## Added test file

`tests/s06-payment-integrity.test.mjs`

The 12 Node.js `node:test` checks cover:
1. Authenticated, non-anonymous caller boundary.
2. Required/bounded idempotency key and backend payment-intent RPC.
3. Server-authoritative order/intent amount and pricing snapshot comparison.
4. Pricing authority and payable-state guards.
5. Currency source and provider-intent persistence.
6. Paymob HMAC verification and verification-before-processing order.
7. Invalid signature rejection.
8. Provider event identity and amount/currency comparison.
9. Verified backend payment processing RPC.
10. Digital-page idempotency claim before provider request and in-progress response.
11. Claim release on provider failure/unavailability.
12. Backend finalization of the provider intent.

## Evidence classification

- **Added to repository:** yes; source file committed on the S06 branch.
- **Executed locally in this session:** no. The connected GitHub API permits repository edits and CI inspection but does not provide a local Node/Deno execution environment here.
- **CI result:** pending inspection for the exact new commit; do not infer success from earlier runs.
- **Runtime integration:** not tested. These are source-text regression checks, not execution of Edge Functions, SQL RPCs, concurrency races, or database transactions.
- **Provider sandbox:** not exercised. No provider request was sent.
- **Real payments/refunds/settlements:** none.
- **Production Supabase writes, migrations, Edge Function deployments, merges:** none.

## Remaining high-value tests / evidence gaps

- Run these tests in CI and fix any assertion or syntax failures.
- Disposable PostgreSQL integration tests for unique idempotency constraints and concurrent duplicate requests.
- Webhook HMAC fixture tests with valid/invalid signatures, event replay, out-of-order success/failure events, and transactionally atomic event/ledger updates.
- Verify terminal-state guards prevent late failure events from downgrading successful payments.
- Verify ledger balance invariants and exactly-once posting under concurrent webhook deliveries.
- Exercise provider sandbox only when credentials and isolated test merchant configuration are available.
- Reconcile tracked source to the actual deployed Edge Function version; source checks alone do not establish production parity.

## Status

**S06: PARTIAL / NOT CERTIFIED.** Source-level test cases are staged. Do not claim test pass until CI reports success for the exact test commit. Real provider lifecycle, concurrent database execution, ledger reconciliation, and production parity remain unverified.
