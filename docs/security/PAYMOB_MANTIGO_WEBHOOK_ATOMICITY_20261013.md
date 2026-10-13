# MantiGO Paymob Webhook Atomicity — 2026-10-13

## Status

**P0 confirmed in deployed source; candidate remediation under test.** No production migration or Edge Function deployment was performed.

## Live evidence (read-only)

- Supabase reports `paymob-webhook` ACTIVE, version 8, entrypoint SHA-256 `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca`.
- The deployed `index.ts` is byte-for-byte identical after newline normalization to `supabase/functions/paymob-webhook/index.ts` on `main` (11,538 characters).
- The MantiGO branch in that deployed source performs two independent requests: first insert into `payment_provider_events`, then update `mantigo_financial_ledger`. A failure between these requests leaves an event persisted while the ledger remains pending; a retry sees the existing event and returns idempotent success before reconciling the ledger.
- The same branch writes `mantigo_financial_ledger.id` into `payment_provider_events.payment_intent_id`, whose verified production foreign key references `payment_intents(id)`. This is the wrong correlation field and may cause event persistence to fail unless an unrelated payment-intent row shares that identifier.
- Read-only catalog evidence: `payment_provider_events(provider, external_event_id)` is unique; `financial_ledger_id` did not exist before this candidate migration; `mantigo_financial_ledger.payment_status` permits `PENDING`, `PAID`, `FAILED`, and other documented states.

## Candidate changes in this PR

- Add nullable `payment_provider_events.financial_ledger_id` with a foreign key to `mantigo_financial_ledger(id)`.
- Add `process_verified_mantigo_payment_backend`, a service-role-only SECURITY DEFINER RPC that locks the ledger row, validates signature-verification flag/amount/currency, handles unique provider event identity, and updates event + ledger in the same PostgreSQL transaction.
- Recover the narrowly identified legacy event shape only when the event is signature-verified, has the MantiGO event type, matches the ledger id through the old field, has status PAID/FAILED, and passes amount/currency validation.
- Change the Edge Function to call the atomic RPC rather than issue split writes.
- Add a dedicated disposable PostgreSQL CI workflow covering success, exact replay, amount mismatch, cross-ledger event-key conflict, rollback when the ledger update fails, service-role restriction, and legacy event repair.

## Verification status

- Static source contract: passed in the dedicated workflow before database setup.
- Isolated PostgreSQL migration/test: **IN PROGRESS** at run [38354852342](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38354852342) as of this report.
- Full application migration replay: independently blocked on missing historical schema/function sources; this candidate does not resolve that separate issue.
- Production release: **BLOCKED / NOT CERTIFIED**.

## Guardrails

- Do not deploy the Edge Function or apply this migration to production without separate explicit approval and a reviewed release plan.
- Do not use a real payment or wallet mutation to test this fix.
- Do not interpret a successful isolated RPC test as proof of Paymob end-to-end settlement, refund, notification delivery, or production rollout.
