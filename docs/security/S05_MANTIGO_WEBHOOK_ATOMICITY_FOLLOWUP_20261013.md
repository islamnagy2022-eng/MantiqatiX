# S05 Follow-up — MantiGO Paymob webhook atomicity

Date: 2026-10-13
Branch: `security/s05-tenant-isolation-review-20261013`
Status: **BLOCKED — source-level finding; runtime impact not tested**

## Finding

The MantiGO branch in `supabase/functions/paymob-webhook/index.ts` validates the provider signature, the exact signed Paymob intention order ID, provider identity, amount, and currency before changing state. However, it then performs two separate database operations:

1. Insert a `payment_provider_events` row for `MANTIGO_RIDE_PAYMENT`.
2. Update `mantigo_financial_ledger.payment_status` from `PENDING` to `PAID` or `FAILED`.

If step 1 commits and step 2 fails, a retry can find the event and return `{ok:true,idempotent:true}` before reconciling the ledger. The webhook can therefore acknowledge an event while the ledger remains pending. This is a source-level failure scenario, not a reproduced runtime exploit.

A concurrent duplicate callback may also race between the event existence check and insert. A unique provider-event constraint may reject one insert, but the handler must treat the conflict as a replay only after confirming the corresponding ledger transition is complete. Do not assume a check-then-insert is atomic.

## Required remediation design

Move MantiGO event idempotency and ledger transition into one database transaction, preferably a narrowly scoped `SECURITY DEFINER` RPC with a fixed safe `search_path`, service-role-only EXECUTE, and strict input validation. The transaction should:

- Lock the target ledger row (`FOR UPDATE`).
- Confirm the stored provider is PAYMOB and the stored intention order ID equals the verified signed callback order ID.
- Validate expected amount/currency and permissible current payment status.
- Insert the provider event with a unique key for `(provider, external_event_id)`.
- Update the ledger state in the same transaction.
- On duplicate event, verify that the same event is bound to the same ledger entry and that the ledger transition is already consistent; otherwise return a retryable error, not success.
- Prevent a FAILED/PAID terminal state from being silently overwritten by a conflicting callback.
- Return an explicit outcome: applied, already-applied, retryable failure, or rejected.

Do not apply a migration or change production state as part of this review. Implement only in the isolated review branch after schema/function conventions are confirmed.

## Required isolated tests

Use disposable database state and synthetic fixtures only:

1. Valid signed callback changes PENDING to PAID and creates one event.
2. Valid signed failure callback changes PENDING to FAILED and creates one event.
3. Exact duplicate callback returns already-applied and does not duplicate events.
4. Two concurrent identical callbacks result in one transition and a consistent final ledger state.
5. Injected ledger-update failure rolls back event insertion; retry succeeds normally.
6. Existing event with a still-PENDING ledger returns retryable/inconsistent, never success.
7. Reusing an event ID for a different ledger row is rejected.
8. Missing/mismatched intention order ID, provider, amount, or currency is rejected without mutation.
9. Conflicting PAID then FAILED callbacks do not reverse a terminal state.
10. The existing Paymob signature verification gate remains before every payment-state RPC.

## Evidence boundary

- Source review only; no Deno runtime test or database integration test was run here.
- GitHub combined status query returned no status entries for the reviewed commit; this is not a pass.
- No production database mutation, real payment, merge, or deployment was performed.
- S05 remains **BLOCKED / NOT CERTIFIED** until the atomic path and the broader two-tenant RLS behavioral suite pass in an isolated environment and deployment parity is verified.

## Follow-up implementation on the S05 branch

A source-level remediation draft has now been committed for review:

- Migration: `supabase/migrations/20261013040000_s05_atomic_mantigo_paymob_webhook.sql`
- Webhook delegates MantiGO event persistence and ledger transition to the transactional RPC rather than issuing separate writes: `supabase/functions/paymob-webhook/index.ts`
- Static catalog contract: `supabase/tests/S05_mantigo_atomic_payment_contract.sql`
- Static source release gate: `scripts/validate-digital-pages-boundaries.mjs`

These are **unapplied, unexecuted source changes**. No claim is made that the SQL compiles or that transaction behavior passes. The migration must first be validated against the exact `payment_provider_events` schema and the target PostgreSQL/Supabase version in an isolated disposable environment. Then run SQL parsing/migration tests, the static contract, and behavioral fault-injection/concurrency tests. A static source-marker check is not a substitute for those tests.

The atomic function uses a row lock and puts event insertion plus ledger update in one transaction. Existing-event handling rejects event/ledger/status inconsistencies instead of acknowledging them as successful replays. Notification delivery remains outside the payment transaction and is best-effort; if durable notification delivery is required, add an outbox or retryable notification job separately.

## Updated gate

**Still BLOCKED / NOT CERTIFIED.** No CI result was found for the latest source commits; no isolated database behavior test was run; no migration was applied; no production changes, merge, deployment, or real payment occurred.

### Additional schema compatibility gate

The static SQL contract was strengthened to check that `payment_provider_events` contains all columns referenced by the new function, that `payment_intent_id` can store the text-valued MantiGO ledger ID, and that a unique `(provider, external_event_id)` index exists. This is a preflight guard, not proof that the current live schema matches the branch migration. The contract remains unexecuted until a disposable database is available.
