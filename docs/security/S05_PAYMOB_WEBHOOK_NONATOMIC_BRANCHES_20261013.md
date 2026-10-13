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

### S05-PW-01 — Subscription FAILED callback lacks durable provider-event insertion
In the subscription branch, after checking for an existing provider event, the failure path updates `subscription_payment_intents.status` to `FAILED` and returns success without inserting the matching row into `payment_provider_events`.

Impact:
- The provider callback is not durably represented in the shared event ledger for this failure branch.
- Re-delivery may revisit the same branch because the event-ledger idempotency marker was not written.
- The update is filtered to `status = 'PENDING'`; an already-final row can result in a zero-row update while the handler still returns HTTP 200.

Recommended safe next step:
- Add a database-side verified failure-processing RPC that atomically locks and validates the subscription intent, enforces terminal-state policy, inserts the provider event, and transitions the intent.
- Define whether repeated matching FAILED callbacks are idempotent and whether conflicting FAILED/PAID callbacks are rejected.
- Validate using disposable database fixtures and concurrent/replay tests before any release decision.

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
| Subscription failure branch atomicity | Open / source issue |
| General payment failure branch atomicity | Open / source issue |
| Original event-table DDL located | Not yet |
| Static SQL contract executed | No |
| Migration applied in disposable DB | No evidence |
| Replay/concurrency/rollback behavioral tests | Not run |
| Production change, merge, or deployment | None performed |

## Release gate
S05 remains **BLOCKED / NOT CERTIFIED** until the source/schema compatibility is proven in isolation, the non-atomic failure paths are addressed and tested, tenant isolation behavior is tested with synthetic identities, and CI/runtime evidence is available. This report alone does not authorize deployment.
