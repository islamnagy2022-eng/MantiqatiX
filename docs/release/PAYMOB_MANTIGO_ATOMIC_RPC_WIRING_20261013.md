# Paymob MantiGO Atomic RPC Wiring — 2026-10-13

## Finding

The deployed `paymob-webhook` v8 entrypoint matched the tracked source at the PR #218 candidate head, but the MantiGO callback branch did not call the already-present RC425 atomic processor. Instead it:
1. checked `payment_provider_events` for the provider event;
2. inserted the MantiGO ledger ID into `payment_provider_events.payment_intent_id`;
3. updated `mantigo_financial_ledger` in a separate request;
4. inserted the customer notification in another request.

Read-only production catalog evidence confirms `payment_provider_events.payment_intent_id` has a foreign key to `payment_intents(id)`, not `mantigo_financial_ledger(id)`. The branch therefore uses the wrong event relation for a MantiGO ledger identifier. It also split event, ledger, and notification changes across independent HTTP/database operations, so a partial failure could leave the event recorded without the corresponding ledger transition.

## Source-only correction

- Route MantiGO Paymob callbacks through the existing `process_verified_mantigo_payment_backend` RC425 RPC.
- Pass only the normalized, signature-verified fields required by the RPC's server-side ledger/order/amount/currency binding; do not persist unnecessary card/source data.
- Let the RPC own event uniqueness, ledger row locking, state transition, replay binding, and notification in one database transaction.
- Do not change generic payment-intent, subscription, or digital-page callback branches.
- Extend `scripts/validate-finance-boundaries.mjs` to fail if the MantiGO callback reintroduces direct event/ledger/notification writes or loses the atomic RPC call.
- Add a focused workflow that runs the finance-boundary validator and existing RC425 PostgreSQL integration test for stacked PRs as well as main.

## Verification and limits

- Read-only source parity: deployed `paymob-webhook` v8 `index.ts` exactly matched the PR #218 candidate source before this patch.
- Production constraint evidence: `payment_provider_events_payment_intent_id_fkey` references `payment_intents(id)`.
- Existing RC425 SQL integration covers atomic event/ledger/notification success, exact replay, conflicting status replay, cross-ledger replay, signature rejection, order binding, amount/currency binding, and failure-to-success recovery.
- New workflow execution is pending at PR creation; do not call the fix verified until the exact-head static and disposable PostgreSQL jobs pass.
- No production deployment, migration, real payment, wallet operation, or production data mutation was performed.

## Release status

This candidate addresses the webhook-to-RPC wiring gap only. Full release remains **BLOCKED / NOT CERTIFIED** until chronological migration replay, live RPC authorization remediation, payment provider E2E, and the other release gates pass.
