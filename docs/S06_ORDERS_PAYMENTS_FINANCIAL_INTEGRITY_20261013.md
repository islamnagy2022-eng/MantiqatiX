# S06 — Orders, Payments & Financial Integrity Test Record

Date: 2026-10-13
Branch: `test/s06-payment-integrity-20261013`
Scope: source-level regression contracts only; no production mutations.

## Added test file

`tests/s06-payment-integrity.test.mjs`

The 13 Node.js `node:test` checks cover:
1. Authenticated, non-anonymous caller boundary.
2. Required/bounded idempotency key and backend payment-intent RPC.
3. Server-authoritative order/intent amount and pricing snapshot comparison.
4. Pricing authority and payable-state guards.
5. Currency source and provider-intent persistence.
6. Paymob HMAC verification and verification-before-processing order.
7. Invalid signature rejection.
8. Provider event identity and amount/currency comparison.
9. Guard against late failure callbacks downgrading terminal payment intents.
10. Verified backend payment processing RPC.
11. Digital-page idempotency claim before provider request and in-progress response.
12. Claim release on provider failure/unavailability.
13. Backend finalization of the provider intent.

## Evidence classification

- **Added to repository:** yes; source file committed on the S06 branch.
- **Executed locally in this session:** no. The connected GitHub API permits repository edits and CI inspection but does not provide a local Node/Deno execution environment here.
- **CI evidence:** run `38337350525` (`S06 Payment Integrity Regressions`) passed on the earlier PR merge revision `e6afe56d249f28785427d9859fa1a0969391da5c`. Its disposable PostgreSQL job created temporary roles, loaded `rc431_digital_page_payment_fixture.sql`, applied RC431 to that disposable database, and executed the then-current SQL regression file successfully (`S06 payment-integrity adversarial regressions: PASS`).
- **Latest extension status:** additional replay/conflicting-status/late-failure assertions were committed afterward in `0b0e16f1181ca72abea3a7b693f71b6540dfefa6`; no CI run for that latest revision was returned at the last check. Do not treat the earlier pass as validation of the new assertions.
- **Runtime integration:** not tested. These are source-text regression checks, not execution of Edge Functions, SQL RPCs, concurrency races, or database transactions.
- **Provider sandbox:** not exercised. No provider request was sent.
- **Real payments/refunds/settlements:** none.
- **Production Supabase writes, migrations, Edge Function deployments, merges:** none.

## Limited source fix staged

The normal Paymob failure callback now updates a payment intent only when its current status is `PENDING`, preventing a late failure callback from blindly overwriting a terminal status. A regression assertion was added. This is a source-level mitigation only; atomic event/ledger handling and runtime behavior still require integration testing.

## Remaining high-value tests / evidence gaps

- Run these tests in CI and fix any assertion or syntax failures.
- Disposable PostgreSQL integration tests for unique idempotency constraints and concurrent duplicate requests.
- Re-run the S06 workflow for the latest SQL test commit, then verify webhook HMAC fixture tests with valid/invalid signatures, event replay, out-of-order success/failure events, and transactionally atomic event/ledger updates.
- Verify terminal-state guards prevent late failure events from downgrading successful payments.
- Verify ledger balance invariants and exactly-once posting under concurrent webhook deliveries.
- Exercise provider sandbox only when credentials and isolated test merchant configuration are available.
- Reconcile tracked source to the actual deployed Edge Function version; source checks alone do not establish production parity.

## Status

**S06: PARTIAL / NOT CERTIFIED.** Source-level test cases are staged. Do not claim test pass until CI reports success for the exact test commit. Real provider lifecycle, concurrent database execution, ledger reconciliation, and production parity remain unverified.
