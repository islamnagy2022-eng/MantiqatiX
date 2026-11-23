# Pass 1891–1900 — Critical Edge Function source/deployed parity and payment contract recheck — 2026-11-23

## Exact source/deployed comparisons
- [x] 1891 — Compared deployed Edge entrypoint source with current `main` for 13 high-impact functions.
- [x] 1892 — Exact entrypoint matches confirmed: `public-catalog` v9, `public-catalog-directory` v19, `payment-webhook` v3, `mantigo-payment-intent` v5, `api` v17, `order-status-update` v4, `post-financial-journal` v3, `settlement-create` v5, `subscription-start-trial` v3. These entrypoint matches do not certify every imported module or runtime secret.
- [x] 1893 — Confirmed deployed `paymob-webhook` v10 differs from current main. Deployed code lacks current provider-order binding and uses older direct ledger/payment-intent paths; current main routes MantiGO and payment failures through atomic RPCs and binds Paymob provider order IDs.
- [x] 1894 — Confirmed deployed `payment-intent` v8 differs from current main. Current main adds Paymob amount precision and provider-intention correlation, safer handling of uncertain provider outcomes, and status-guarded persistence.
- [x] 1895 — Confirmed deployed `subscription-payment-intent` v4 differs materially from current main. Current main uses claimable provider-intent creation, encrypted checkout-secret persistence/recovery, amount precision and provider-intention correlation. Required DB claim RPCs and encrypted-state columns are absent live.
- [x] 1896 — Confirmed deployed `digital-page-payment-intent` v5 differs from current main. Current main validates provider intention correlation and calls a five-argument provider-order-bound finalizer; live DB has only the old four-argument finalizer.
- [x] 1897 — Confirmed deployed `settlement-financial-atomic` v4 differs from current main, which adds explicit CORS handling, bounded input/role/scope checks and a dedicated settlement authorization helper.
- [x] 1898 — Confirmed deployed `financial-journal` v3 differs from current main. Current main calls RC450 actor-bound `post_financial_journal_backend`; live ACL still grants EXECUTE only to postgres. RC449A/RC450 prerequisites and exact service_role contract remain unapplied.
- [x] 1899 — Confirmed deployed `order-create` v8 differs from current main: current main adds request-size limits, stricter input/metadata validation, exact branch membership scope and duplicate selected-option rejection.
- [x] 1900 — Confirmed additional deliberate/known drift: `directory-listings` v18 is fail-closed (keep it disabled); `catalog-admin` v20 lacks current registry guard; `mnty-push-dispatch` v4 lacks current constant-time secret comparison and bounded JSON parser; `health` v3 only returns a static health response while main has authenticated database probe. `erp-purchase-receive` v3 also differs from main.

## Live database contract checks
- Missing live RPCs required by current Paymob webhook: `process_verified_mantigo_payment_backend`, `process_verified_provider_payment_failure`, `process_verified_subscription_payment_backend`, `process_verified_subscription_payment_failure`.
- Present: legacy `process_verified_provider_payment`, legacy `process_verified_subscription_payment`, and `process_verified_digital_page_payment_backend`.
- Missing subscription-intent claim RPCs: `create_subscription_payment_intent_claimable_backend`, `claim_subscription_provider_intent_creation_backend`.
- Missing subscription-intent columns: `provider_creation_state`, `provider_creation_claimed_at`, `client_secret_ciphertext`, `client_secret_iv`, `client_secret_key_version`.
- Digital-page finalizer exists only as four-argument `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)`; current source requires the five-argument provider-order-bound contract.
- Live `post_financial_journal_backend(uuid,jsonb,jsonb)` exists but grants EXECUTE only to postgres; service_role EXECUTE is false. RC449A → RC450 remains required before the matching Edge function can be deployed.
- Live `payment_intents` and `digital_page_orders` already contain provider-order IDs, but the required atomic RPCs and coordinated schema contracts are incomplete.

## Release disposition
- Do not deploy any one of the mismatched payment/finance Edge functions independently. Deploy only after the matching ordered database migrations, exact RPC signatures/ACLs, encrypted secret columns, and disposable PostgreSQL 17 adversarial/payment replay tests pass.
- Preserve the fail-closed `directory-listings` v18 state until RC472/RC473 consent and source-rights gates are complete.
- Keep SMM deferred; keep Paymob live flows blocked from release until signed sandbox callbacks, duplicate/replay, mismatch and failure paths are verified.
- No Edge deployment, provider call, webhook replay, payment, wallet, settlement, order, Auth, RLS, grant, schema or user-data mutation occurred.
- **Full Production remains BLOCKED / NOT CERTIFIED.**

## Source references
- `docs/audits/PASS_1781_1790_LIVE_PAYMENT_RPC_AND_EDGE_CONTRACT_DRIFT_20261122.md`
- `docs/audits/PASS_1220_1229_EDGE_PAYMENT_PRODUCTION_PARITY_20261120.md`
- `docs/runbooks/RC450_FINANCIAL_JOURNAL_ROLLOUT.md`
- `scripts/validate-finance-boundaries.mjs`
- `scripts/validate-payment-migration-wiring.mjs`
