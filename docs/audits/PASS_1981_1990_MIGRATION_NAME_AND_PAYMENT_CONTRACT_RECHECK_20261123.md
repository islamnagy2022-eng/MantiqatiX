# Pass 1981–1990 — Live migration-name reconciliation and payment/finance contract recheck — 2026-11-23

## Migration history reconciliation correction
- [x] 1981 — Rechecked all 310 live migration rows against the 76 required source migration filenames in `scripts/production/verify-production.mjs`.
- [x] 1982 — Exact required version-number matches: 0/76. Exact source migration-name matches in the live `name` column: 0/76.
- [x] 1983 — This does **not** mean all 76 effects are absent. The live ledger contains earlier/renamed predecessor migrations in the same domains (for example `phase11_payment_intents`, `rc424_atomic_digital_page_payment_webhook`, `rc159_financial_journal_backend`, `mnty_platform_admin_authority`, and `add_qadam_alsaad_homewares_store_and_catalog`). Names alone do not prove semantic equivalence.
- [x] 1984 — Object-level checks remain the deciding evidence: the current atomic MantiGO/provider/subscription RPCs and subscription claim RPCs are absent; only the legacy four-argument digital-page finalizer exists; the service-role journal EXECUTE grant is absent; the SMM admin service-role table ACL is absent.

## Live payment/finance contract checks
- [x] 1985 — Unique indexes exist for payment-intent tenant/idempotency and provider/order correlation, digital-page order idempotency/provider-intent/provider-order, and MantiGO ledger ride/idempotency/provider-intent. No unique active-payment-per-order index was observed on `payment_intents` in the queried unique-index inventory.
- [x] 1986 — Missing: `process_verified_mantigo_payment_backend`, `process_verified_provider_payment_failure`, `process_verified_subscription_payment_backend`, `process_verified_subscription_payment_failure`, subscription provider-intent claim/release RPCs, and the five-argument provider-order-bound digital-page finalizer.
- [x] 1987 — Present but not sufficient: legacy four-argument digital-page finalizer; existing provider-order uniqueness indexes; legacy provider/subscription payment processors.
- [x] 1988 — `post_financial_journal_backend(uuid,jsonb,jsonb)` currently grants EXECUTE to neither anon, authenticated nor service_role in the live ACL check; current Edge bundle must not be deployed until RC449A/RC450 and exact service-role contract are applied.
- [x] 1989 — `smm_admins` currently grants no SELECT/INSERT/UPDATE/DELETE to service_role; SMM gateway remains hard-gated deferred. RC456/RC487 ACL/bootstrap work remains unapplied.
- [x] 1990 — No webhook replay, provider call, order/payment/ledger write, migration, grant, Edge deployment or Production mutation occurred.

## Correct interpretation
- Report exact version and exact filename absence separately from semantic/effect presence.
- Reconcile each source migration against live schema objects, function bodies, policies, grants, constraints and triggers; map proven equivalent predecessor/forward-repair effects explicitly.
- Do not claim the full 76 migration set is missing, and do not assume equivalent effects exist from similar migration names.
- Do not blindly replay migrations or deploy payment/finance Edge functions independently.

**Production remains BLOCKED / NOT CERTIFIED.** No Production changes.
