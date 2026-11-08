# Production Edge Function contract review — 2026-11-06

## Scope and method

Read-only comparison of the six critical production Edge Function `index.ts` files against `main` / the current PR source, followed by targeted read-only PostgreSQL catalog inspection of the referenced RPC signatures and effective EXECUTE privileges.

All six deployed files differ byte-for-byte from current source. Current `main` and the V6 feature branch source files are identical for these six functions. This report records selected contract-level differences, not a full security review or an approval to deploy.

| Function | Live version | Live bytes | Current source bytes | RPC/contract status |
|---|---:|---:|---:|---|
| `order-create` | 8 | 10,083 | 13,988 | Same `create_order_backend` RPC; current source adds a finite-server-total guard. |
| `payment-intent` | 8 | 8,114 | 10,366 | Same `create_payment_intent_backend` RPC; current source adds amount-cent precision and Paymob-intention correlation/outcome handling. |
| `paymob-webhook` | 10 | 11,538 | 12,665 | Major RPC set drift: subscription/provider failure processors and MantiGO processor are source-only. |
| `digital-page-payment-intent` | 5 | 5,345 | 6,532 | Live calls the 4-argument finalize RPC; current source requires the 5-argument provider-order-bound form. |
| `subscription-payment-intent` | 4 | 5,196 | 11,100 | Live uses legacy creation RPC; current source requires claimable-create and provider-claim RPCs. |
| `financial-journal` | 3 | 1,591 | 3,387 | Live calls legacy journal RPC and uses wildcard CORS; source calls backend RPC and constrains origin. |

## Contract-level observations

### 1) order-create

Both live and current source call `create_order_backend` and retain tenant-scoped catalogue/price selection, an idempotency key and server-computed totals. Current source additionally rejects a non-finite computed server total before RPC invocation (`INVALID_SERVER_TOTAL`). The RPC itself exists in Production with `service_role` EXECUTE and no `anon` or `authenticated` EXECUTE. This is a source drift, but not evidence that this RPC contract is absent.

### 2) payment-intent

Both live and source call `create_payment_intent_backend`. Current source imports Paymob correlation helpers and adds:
- strict amount-to-cents precision validation;
- explicit expected intent state validation before provider creation;
- provider intent/client-secret/provider-order ID shape validation;
- explicit `PAYMENT_PROVIDER_OUTCOME_UNKNOWN` handling where the provider outcome cannot safely be classified.

The live function version does not contain those current source checks. Production has `create_payment_intent_backend`; targeted catalog evidence shows `authenticated` and `service_role` EXECUTE true, `anon` false. The current-source changes still require isolated provider sandbox, ambiguous-response, replay and rollback tests before a coupled deployment decision.

### 3) paymob-webhook

Live v10 uses:
- `process_verified_subscription_payment`;
- `process_verified_provider_payment`;
- the digital-page processor.

Current source additionally requires:
- `process_verified_subscription_payment_backend`;
- `process_verified_subscription_payment_failure`;
- `process_verified_provider_payment_failure`;
- `process_verified_mantigo_payment_backend`;
- explicit provider-order binding for subscription and digital-page callbacks, alongside amount/currency binding.

Current Production catalog inspection found the old `process_verified_subscription_payment` and `process_verified_provider_payment` functions, but did not find the four new backend/failure/MantiGO RPC names above. The old subscription-failure branch in live v10 directly updates the subscription intent rather than using the source's dedicated failure processor. The new failure/MantiGO RPCs are not deployable until their schema, ACL and atomic state-transition contracts are present and independently verified.

### 4) digital-page-payment-intent

Live v5 and current source both claim and release digital-page payment-intent creation. The live function finalizes with:
`finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)`.

Current source passes provider order ID as a fifth argument:
`finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)`.

Production contains only the old four-argument signature; the required five-argument signature is absent. The current source also strengthens amount-cent precision and handles indeterminate Paymob provider outcomes without treating them as ordinary provider rejections. Do not update this Edge Function until the new RPC is rehearsed with claim/release/finalize concurrency and retry tests in an isolated DB.

### 5) subscription-payment-intent

Live v4 creates through `create_subscription_payment_intent_backend`, then submits the provider intent and persists provider IDs.

Current source changes to:
- `create_subscription_payment_intent_claimable_backend`;
- `claim_subscription_provider_intent_creation_backend`;
- provider-creation claim state and explicit `RECONCILIATION_REQUIRED` handling for unknown outcomes;
- amount-cent validation and safer provider response handling.

Production contains `create_subscription_payment_intent_backend`, but targeted catalog inspection did not find the two claimable/claim RPCs required by current source. The source must not be deployed until both RPCs, supporting columns, encryption/secret lifecycle, concurrency and webhook callback contracts have passed isolated replay and E2E.

### 6) financial-journal

Live v3:
- calls `post_financial_journal(p_entry,p_lines)`;
- permits wildcard CORS (`Access-Control-Allow-Origin: *`).

Current source:
- calls `post_financial_journal_backend(p_user_id,p_entry,p_lines)`;
- resolves tenant scope explicitly;
- restricts browser origin to the approved Pages origin and sets no-store/Vary headers.

Production contains both function signatures, but the effective privileges query reports `service_role` EXECUTE false for both, and also false for `anon` and `authenticated`. The five required journal columns remain absent, RC449A/RC450 remain unapplied, and the production finance contract is blocked. No function should be deployed independently of the schema/RPC/ACL correction and full finance journal E2E.

## Targeted Production RPC catalog result

The read-only PostgreSQL query returned:
- Present: `create_order_backend`, `create_payment_intent_backend`, `process_verified_provider_payment`, `process_verified_subscription_payment`, old four-argument `finalize_digital_page_payment_intent_backend`, old `create_subscription_payment_intent_backend`, existing digital-page claim/release RPCs, legacy `post_financial_journal`, and `post_financial_journal_backend`.
- Not found: `process_verified_provider_payment_failure`, `process_verified_subscription_payment_backend`, `process_verified_subscription_payment_failure`, `process_verified_mantigo_payment_backend`, five-argument `finalize_digital_page_payment_intent_backend`, `create_subscription_payment_intent_claimable_backend`, and `claim_subscription_provider_intent_creation_backend`.
- `post_financial_journal_backend` and `post_financial_journal` both currently have no EXECUTE privilege for `service_role`.

This inventory is targeted to the six reviewed functions; it is not a complete list of all project RPCs or all grants.

## Release decision and safety

- Treat the six functions as one coupled release unit, with per-function sequencing only after their dependencies are installed and tested in an isolated database.
- Required tests: amount/currency/intent/provider-order binding, signed callback verification, positive and negative callback paths, idempotency and replay, concurrent creation/claim/finalization, unknown provider outcome, tenant isolation, journal balance and authorization, and rollback.
- Do not deploy one of the six functions alone to Production from this state.
- Production remains **BLOCKED / NOT CERTIFIED**.
- This review was read-only. No migration, schema/data/Auth/RLS/GRANT change, Edge deployment, payment or finance operation was performed.
