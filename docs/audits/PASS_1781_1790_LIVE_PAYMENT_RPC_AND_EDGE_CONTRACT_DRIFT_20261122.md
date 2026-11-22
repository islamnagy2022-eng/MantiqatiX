# Pass 1781–1790 — Live payment RPC and Edge contract drift

Date: 2026-11-22  
Project: `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`)  
Method: read-only live `pg_proc` signature/config/EXECUTE privilege inspection and source RPC-call inventory. No payment, webhook, order, wallet, journal or settlement operation was invoked.

## 1. Critical Edge version/source mismatch

Seven critical deployed Edge Functions were retrieved and compared byte-for-byte against current `main` entrypoints:

| Function | Live version | verify_jwt | Live index chars | Main index chars | Exact match |
|---|---:|---:|---:|---:|---|
| `order-create` | 8 | true | 10,083 | 13,988 | No |
| `payment-intent` | 8 | true | 8,114 | 10,146 | No |
| `paymob-webhook` | 10 | false | 11,538 | 12,376 | No |
| `digital-page-payment-intent` | 5 | true | 5,345 | 6,532 | No |
| `subscription-payment-intent` | 4 | true | 5,196 | 11,100 | No |
| `financial-journal` | 3 | true | 1,591 | 3,387 | No |
| `directory-listings` | 16 | false | 46,907 | 50,906 | No |

This is source drift, not proof that every live function is exploitable. Do not deploy one function at a time; their RPC and schema dependencies are coordinated.

## 2. Current source RPC call inventory vs live PostgreSQL

Current source Edge functions call these backend contracts:

- Order: `create_order_backend`
- Standard payment intent: `create_payment_intent_backend`
- Paymob webhook: `process_verified_provider_payment_failure`, `process_verified_subscription_payment_failure`, `process_verified_subscription_payment_backend`, `process_verified_digital_page_payment_backend`, `process_verified_mantigo_payment_backend`, `process_verified_provider_payment`
- Digital-page payment: `claim_digital_page_payment_intent_backend`, `release_digital_page_payment_intent_claim_backend`, five-argument `finalize_digital_page_payment_intent_backend`
- Subscription payment: `create_subscription_payment_intent_claimable_backend`, `claim_subscription_provider_intent_creation_backend`
- Finance: `post_financial_journal_backend`

Live catalog query confirms the following required contracts are absent:
- `process_verified_provider_payment_failure`
- `process_verified_subscription_payment_failure`
- `process_verified_subscription_payment_backend`
- `process_verified_mantigo_payment_backend`
- `create_subscription_payment_intent_claimable_backend`
- `claim_subscription_provider_intent_creation_backend`

Present legacy or incomplete contracts:
- `process_verified_subscription_payment(text,text,uuid,text,numeric,text,boolean)` exists, but is the old seven-argument signature; current source calls the provider-order-bound nine-argument atomic success/failure contracts.
- `create_subscription_payment_intent_backend(uuid,text,text,text,text,uuid)` exists, but current source calls the claimable creation RPC plus a separate provider-creation claim/recovery RPC.
- `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)` exists, but current source requires the five-argument provider-order-bound signature.

## 3. Live EXECUTE ACL blockers

| RPC | Live state |
|---|---|
| `create_order_backend(...)` | SECURITY DEFINER; `search_path=public`; service_role EXECUTE true |
| `create_payment_intent_backend(...)` | SECURITY DEFINER; `search_path=public, pg_temp`; authenticated + service_role EXECUTE true |
| `claim_digital_page_payment_intent_backend(uuid,uuid,text,text)` | authenticated EXECUTE true; service_role false |
| `release_digital_page_payment_intent_claim_backend(uuid,uuid,text)` | authenticated EXECUTE true; service_role false |
| old four-argument `finalize_digital_page_payment_intent_backend(...)` | authenticated EXECUTE true; service_role false |
| `process_verified_digital_page_payment_backend(...)` | service_role EXECUTE true |
| `post_financial_journal_backend(uuid,jsonb,jsonb)` | SECURITY DEFINER; `search_path=public`; anon/authenticated/service_role EXECUTE all false |
| old `post_financial_journal(jsonb,jsonb)` | SECURITY DEFINER; `search_path=public`; anon/authenticated/service_role EXECUTE all false |

The current financial-journal Edge source uses the backend RPC, but the live service_role ACL denies execution. Do not quick-fix by granting service_role on the legacy journal function; use the actor-bound RC450 contract and its exact schema prerequisites.

## 4. Release interpretation

- Current source migrations already define the missing RC425–RC435 / RC450 / RC475 / RC468+ forward contracts. This is a source/live rollout gap, not a reason to invent duplicate SQL.
- Live migration ledger remains 310 through `20261110150618`; source migrations are not applied in Production.
- A disposable chronological migration replay is not equivalent to safely applying the missing historical chain onto the live Production schema, especially where later live objects already exist.
- Before any rollout: encrypted off-site DB + Storage backup, Vault/key recovery, independent PostgreSQL 17 restore/rollback, measured RPO/RTO, complete physical schema/object/ACL reconciliation, exact Edge bundle review, Paymob sandbox and negative replay/correlation tests, journal balanced-entry and tenant-scope tests.
- Deploy the matching database migrations and Edge bundle only as one coordinated approved release. No individual payment/webhook Edge deployment.

## Disposition

**P0/P1 PAYMENT + FINANCE RELEASE BLOCKER CONFIRMED.** No live payments, provider callbacks, orders, journal entries, wallet balances or settlements were changed or invoked. No Production DDL, ACL, Auth, RLS, Edge, Storage or deployment mutation occurred. Production remains **BLOCKED / NOT CERTIFIED**.
