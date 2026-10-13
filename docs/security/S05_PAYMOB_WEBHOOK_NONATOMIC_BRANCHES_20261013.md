# S05 — Paymob webhook non-atomic branches follow-up
Date: 2026-10-13
Scope: source review only, branch `security/s05-tenant-isolation-review-20261013`.

## Status
**OPEN — source-level findings only.** This note does not assert that the code has been executed, that a payment failure has occurred in production, or that any runtime test passed. No production database or provider transaction was changed.

## Evidence reviewed
- `supabase/functions/paymob-webhook/index.ts` at branch source reviewed on 2026-10-13:
  https://github.com/islamnagy2022-eng/MantiqatiX/blob/security/s05-tenant-isolation-review-20261013/supabase/functions/paymob-webhook/index.ts
- The MantiGO success/failure path now delegates event persistence and ledger transition to `process_verified_mantigo_payment_backend`. That is a source-level atomicity improvement, pending isolated schema and behavioral validation.
- `payment_provider_events` is documented elsewhere as having a unique `(provider, external_event_id)` constraint, but this review did not locate the original table-creation migration. The new MantiGO migration's column-type and constraint assumptions remain unverified until the actual schema is inspected in an isolated database.

## Findings

### S05-PW-01 — Subscription failure path now routes through atomic RPCs (source correction made; runtime unverified)
The webhook now calls `process_verified_subscription_payment_failure` for signed FAILED callbacks and `process_verified_subscription_payment_backend` for signed success callbacks. Both calls pass the signed Paymob order ID and raw callback payload to the database function. The early shared-event-table idempotency pre-check and direct Edge Function update were removed so replay binding and event/intent state transitions are decided by the transactional RPC.

Source references:
- Failure function: `supabase/migrations/20261009160000_rc429_atomic_subscription_failure_webhook.sql`
- Success function: `supabase/migrations/20261009170000_rc430_atomic_subscription_success_webhook.sql`
- Updated handler: `supabase/functions/paymob-webhook/index.ts`

Impact/status:
- Source-level split-write concern addressed for the subscription branch.
- Not executed against an isolated database; RPC signature/schema compatibility, duplicate/concurrent callback behavior, and terminal-state semantics remain unverified.

Recommended next step:
- Run migration replay and behavioral tests in a disposable database before any release decision.

### S05-PW-02 — General payment FAILED callback uses separate writes
In the general `payment_intents` branch, the failure path inserts `payment_provider_events`, then updates `payment_intents` separately. The update result is not checked before returning HTTP 200.

Impact:
- The event insert can succeed while the intent update fails or affects zero rows, leaving inconsistent state.
- A later retry may be treated as idempotent based on the existing event and return before repairing the intent.
- This is the same class of split-write failure that the MantiGO atomic RPC was introduced to prevent.

Recommended safe next step:
- Route FAILED and SUCCEEDED callbacks through one database transaction boundary per payment intent.
- Check row count and existing-event consistency; reject conflicting terminal-state callbacks.
- Test rollback injection, duplicate delivery, concurrent delivery, wrong order, amount/currency mismatch, and event/intent inconsistency in isolation.

### S05-PW-03 — Original provider-event schema not yet evidenced
The S05 static contract checks expected columns and a text-like `payment_intent_id`, plus a unique event index, but that contract has not been run. Repository search surfaced documentation for the unique key, not the original `CREATE TABLE` definition.

Impact:
- The new MantiGO SQL migration cannot be considered schema-compatible from source inspection alone.
- Column type, nullability, check constraints, foreign keys, triggers, and uniqueness must be checked before execution.

Recommended safe next step:
- Locate the authoritative table-creation/alter migrations and compare them to the function's insert and comparison semantics.
- Run the contract and migration against a disposable database initialized from the intended migration chain; record exact command/output and database revision.
- Do not apply the migration to production as part of this review.

## Verification matrix
| Item | Current status |
|---|---|
| Source branch reviewed | Yes |
| MantiGO atomic RPC source exists | Yes |
| Subscription callbacks routed to atomic RPCs | Source corrected; runtime unverified |
| General payment failure branch atomicity | Open / source issue |
| Original event-table DDL located | Not yet |
| Static SQL contract executed | No |
| Migration applied in disposable DB | No evidence |
| Replay/concurrency/rollback behavioral tests | Not run |
| Production change, merge, or deployment | None performed |

## Release gate
S05 remains **BLOCKED / NOT CERTIFIED** until the source/schema compatibility is proven in isolation, the non-atomic failure paths are addressed and tested, tenant isolation behavior is tested with synthetic identities, and CI/runtime evidence is available. This report alone does not authorize deployment.
