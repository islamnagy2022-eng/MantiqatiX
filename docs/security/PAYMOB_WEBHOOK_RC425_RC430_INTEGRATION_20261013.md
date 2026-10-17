# Paymob Webhook Integration with RC425–RC430 — 2026-10-13

## Goal

Wire the deployed `paymob-webhook` Edge Function to the already-reviewed candidate database RPCs in PR #218 rather than introduce a second, competing set of payment RPCs.

## Evidence and design decision

- Read-only retrieval confirmed the active `paymob-webhook` source was identical to the old `main` source. That source had split event/ledger writes for MantiGO, split event/payment-intent writes for ordinary payment failures, and a direct subscription-intent update for subscription failures.
- PR #218 already contains stronger candidate database implementations:
  - RC425: `process_verified_mantigo_payment_backend`, a dedicated RLS-protected MantiGO event table, locked-ledger validation, payload/order binding, and atomic event + ledger + notification.
  - RC428: `process_verified_provider_payment_failure`, atomic normal-order failure event + intent transition with provider-order and pricing binding.
  - RC429: `process_verified_subscription_payment_failure`, atomic subscription failure event + intent transition with explicit provider-order binding.
  - RC430: `process_verified_subscription_payment_backend`, atomic subscription success processing with event binding and replay checks.
- This branch intentionally depends on PR #218's migration candidates. It does **not** add duplicate migrations or alternate RPC signatures.

## Edge Function changes

- MantiGO callbacks now call RC425 with a flattened, provider-bound payload (provider, transaction ID, merchant reference, provider order ID, amount cents, currency, success) required by the database RPC.
- Ordinary order failures now call RC428 rather than writing the event and intent in separate requests.
- Subscription failures call RC429 rather than directly updating the intent.
- Subscription successes call RC430 with provider order ID and raw payload.
- Removed early generic event-existence shortcuts from these paths so each atomic RPC performs identity binding and replay handling.
- MantiGO notifications are no longer inserted separately by the Edge Function; RC425 owns that mutation inside the same transaction.

## Verification

The dedicated workflow in this PR runs:
1. Static Edge-to-RPC argument-contract validation.
2. Deno type-check of `supabase/functions/paymob-webhook/index.ts`.
3. Isolated PostgreSQL setup with the RC425/RC428/RC429/RC430 candidate migrations.
4. Existing RC425 integration tests plus new RC428/RC429/RC430 tests for duplicate replay, mismatched amount/order, cross-intent event reuse, rollback after forced write failure, and service-role-only grants.

Until that workflow passes, the new integration remains **NOT VERIFIED**. Even after a pass, real Paymob E2E, production rollout, and full chronological migration replay remain separate release gates.

## Safety

Draft only. No production migration, Edge Function deployment, wallet mutation, or real payment was performed. Production release remains **BLOCKED / NOT CERTIFIED**.
