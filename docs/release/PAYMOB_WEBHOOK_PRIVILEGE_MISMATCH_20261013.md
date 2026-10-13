# Paymob webhook privilege mismatch — read-only evidence (2026-10-13)

**Status: P0 / BLOCKED / NOT CERTIFIED. No production permissions or functions were changed.**

## Evidence sources
- Supabase project: `moyhiluyhjsujhwlyeuu`.
- Live Edge Function `paymob-webhook`, deployed version 8, read-only source inspection.
- Read-only PostgreSQL ACL/privilege queries against the live catalog. No rows, webhook payloads, payment IDs, secrets, or customer data were selected.
- Repository branch: `reconcile/rc425-458-current-main-20261011`.

## Live webhook behavior observed
Deployed version 8 creates a service-role Supabase client and directly:
- reads `payment_provider_events` to detect duplicate provider events;
- inserts failed event rows into `payment_provider_events`;
- reads and updates `subscription_payment_intents`;
- reads `digital_page_orders`;
- reads and updates `mantigo_financial_ledger`;
- reads `payment_intents`;
- inserts notifications in some branches;
- invokes server-side payment-processing RPCs for success paths.

This source must be treated as the deployed observation, not as proof that every path currently succeeds. There was no real payment attempt or synthetic financial write in this audit.

## Read-only ACL evidence

| Table | service_role SELECT | INSERT | UPDATE | DELETE | RLS | FORCE RLS |
|---|---:|---:|---:|---:|---:|---:|
| `payment_provider_events` | no | no | no | no | yes | yes |
| `subscription_payment_intents` | no | no | no | no | yes | yes |
| `digital_page_orders` | no | no | no | no | yes | no |
| `mantigo_financial_ledger` | no | no | no | no | yes | no |
| `notifications` | no | no | no | no | yes | yes |
| `payment_intents` | yes | yes | yes | yes | yes | yes |

For the first five tables, observed ACLs grant service_role only non-DML privileges (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN as represented by PostgreSQL ACL letters); `has_table_privilege` returned false for the listed DML rights. This is a potential direct runtime failure in deployed version 8. It is not proof of a specific production incident; the audit did not query or reproduce a real webhook transaction.

## Why no direct grant was added
A broad grant on these financial and order tables to the global `service_role` would enlarge the capabilities of every server-side function using that key and bypasses table-level separation as a fix strategy. The safer correction is to establish the intended supported server-side RPC path and align/deprecate the stale direct-table webhook source, with narrowly scoped function execute permissions and isolated integration tests. Any deployment or production privilege change is outside this execution's authority.

## Required next work
1. Compare deployed `paymob-webhook` v8 with tracked `supabase/functions/paymob-webhook/index.ts` and `payment-webhook`; establish which callback route is live and intended.
2. Inspect existing `process_verified_provider_payment`, `process_verified_subscription_payment`, and failure/idempotency RPC contracts before designing changes.
3. Add isolated tests for duplicate events, invalid signatures, missing event rows, failed payments, subscription failures, tenant/provider/order correlation, and RPC authorization.
4. Prefer a service-only RPC or a reviewed server-only function path over broad direct table grants.
5. Do not apply grants, deploy functions, mutate production rows, or run a real payment without the separately required authorization.

## Release decision
This finding remains open P0. Release remains **BLOCKED / NOT CERTIFIED**.
