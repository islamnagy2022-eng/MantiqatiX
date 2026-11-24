# PASS 2381–2390 — Live Edge ↔ RPC ↔ migration dependency recheck

**Repository checkpoint:** main @ c802c01c639c9d64919c2cb90c64815843cac089  
**Production:** MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu, PostgreSQL 17.6.1.155  
**Method:** deployed Edge source read-back, current-main RPC call inspection, read-only pg_proc/function-definition/effective-ACL/schema-column/migration-ledger queries. No SQL writes or customer/business rows were read.

## 1. Current Production state

The live migration ledger remains 310 rows through 20261110150618. All 17 required source migration versions below are absent from the live ledger:

| Contract | Source migration | Version | Live ledger |
|---|---|---:|---|
| Digital-page Paymob initial correlation | RC426 | 20261009130000 | ABSENT |
| One active payment intent per order | RC427 | 20261009140000 | ABSENT |
| Atomic standard Paymob webhook base | RC428 | 20261009150000 | ABSENT |
| Atomic subscription failure processor | RC429 | 20261009160000 | ABSENT |
| Atomic subscription success processor | RC430 | 20261009170000 | ABSENT |
| Digital-page event/order binding | RC431 | 20261009180000 | ABSENT |
| Atomic ERP purchase receipt (base) | RC434 | 20261009200000 | ABSENT |
| Subscription provider-creation claim | RC435 | 20261009210000 | ABSENT |
| Purchase-order line receive limits | RC437 | 20261009230000 | ABSENT |
| Purchase-order creation with lines | RC438 | 20261009240000 | ABSENT |
| Encrypted subscription checkout recovery | RC439 | 20261010010000 | ABSENT |
| Journal schema prerequisites | RC449A | 20261010175000 | ABSENT |
| Financial-journal service-role boundary | RC450 | 20261010180000 | ABSENT |
| Digital-page provider-order scope | RC468 | 20261115030000 | ABSENT |
| Digital-page provider-order guard | RC470 | 20261117020000 | ABSENT |
| Paymob atomic webhook forward repair | RC475 | 20261118040000 | ABSENT |
| Settlement business-scope hardening | RC494 | 20261120290000 | ABSENT |

This is a source-ledger fact, not proof that every physical object/effect is absent. The exact object and function read-back below is the additional check.

## 2. Exact RPC/ACL and schema read-back

| Contract / RPC | Production result | Main Edge contract | Disposition |
|---|---|---|---|
| create_payment_intent_backend | Present; SECURITY DEFINER, search_path=public, pg_temp; anon EXECUTE false, authenticated true, service_role true. | Main payment-intent calls through authenticated user context. | ACL compatible; deployed v8 still lacks latest amount-cent and signed provider-order correlation checks. |
| Digital-page claim/release/finalize RPCs | Claim/release/finalize present; claim and release are authenticated-only; finalize is four-argument (order_id,user_id,claim_token,provider_intent_id). | Current main finalizer passes provider order ID as an additional argument. | **BLOCKED** — five-argument current-source contract is not deployed to Production. |
| process_verified_digital_page_payment_backend | Present with p_provider_order_id parameter and service_role EXECUTE. The live body writes the supplied provider order ID with coalesce(...) but does not compare it to the order's previously stored provider_order_id before processing. | Main webhook checks the stored order ID equals the HMAC-signed Paymob order.id before calling the processor. | **BLOCKED** — Edge v10 is missing that pre-RPC comparison; DB parameter alone is not an equality guard. |
| process_verified_provider_payment | Present; service_role EXECUTE; its signature has no provider_order_id parameter and its body does not enforce the current-main reconciliation guard. | Main webhook compares stored payment-intent provider_order_id to signed order.id; it uses an atomic failure RPC for unsuccessful events. | **BLOCKED** — exact new pre-RPC Edge and RC475 database contracts are not live. |
| process_verified_provider_payment_failure | Absent. | Called by current main Paymob webhook for failed standard payments. | **BLOCKED** — failure webhook path cannot be deployed. |
| Subscription payment intent creation | Legacy create_subscription_payment_intent_backend exists with service_role EXECUTE. New create_subscription_payment_intent_claimable_backend and claim_subscription_provider_intent_creation_backend are absent. | Main subscription Edge uses the two new claimable/atomic RPCs. | **BLOCKED** — RC435 absent. |
| Subscription checkout columns | provider_creation_state, provider_creation_claimed_at, client_secret_ciphertext, client_secret_iv, client_secret_key_version all absent. | Main Edge uses claim state and encrypted checkout-secret recovery. | **BLOCKED** — RC435/RC439 absent. |
| Subscription webhook processors | Legacy process_verified_subscription_payment exists with service_role EXECUTE but has no provider-order parameter. process_verified_subscription_payment_backend and process_verified_subscription_payment_failure are absent. | Main webhook calls the new success/failure RPCs and validates stored provider_order_id against signed order.id. | **BLOCKED** — RC429/RC430/RC475 absent. |
| Journal schema | Missing journal_entries.entry_number, total_debit, total_credit, posted_at; missing journal_entry_lines.line_number. | Current main expects RC449A/RC450 schema. | **BLOCKED** — schema preflight fails. |
| post_financial_journal and post_financial_journal_backend | Both exist as SECURITY DEFINER, search_path=public; anon/authenticated/service_role EXECUTE all false (postgres owner only). | Main financial-journal invokes post_financial_journal_backend using its service-role client. | **BLOCKED** — Edge RPC call cannot execute with current service_role ACL; RC450 is required. |
| create_order_backend | Present; SECURITY DEFINER, service_role EXECUTE true, anon/authenticated false. | Main order Edge invokes through service-role client. | ACL compatible; deployed v8 entrypoint lacks the current source's bounded body parsing and explicit finite-total guard. |
| create_settlement_and_post_journal | Present; SECURITY DEFINER, search_path=pg_catalog, public; service_role EXECUTE true, authenticated/anon false. | Main settlement Edge invokes through service client and performs authority/business checks. | **PARTIAL** — RPC ACL matches service path; RC494 business scope column/FK/index are absent and global root helper remains legacy. |
| receive_purchase_stock_with_order_line_backend | Absent; erp_purchase_order_lines table absent. | Current main ERP Edge calls this service-role RPC. | **BLOCKED** — RC437 line-aware receive contract is not live. |
| receive_purchase_stock_atomic_backend | Absent. | RC434 base atomic receive source. | **BLOCKED** — RC434 not live; do not replace RC437 line-aware model with the older base RPC. |

## 3. Confirmed Edge source differences with operational consequence

- subscription-payment-intent v4 calls only the legacy creation RPC; main now calls claimable intent creation and provider-creation claim RPCs. The new RPCs and five supporting columns are absent from Production.
- financial-journal v3 calls legacy post_financial_journal and uses wildcard CORS. Current main uses post_financial_journal_backend and a fixed application origin, but the live service_role EXECUTE grant and required journal columns are still absent. Do not deploy the current main Edge file alone.
- erp-purchase-receive v3 is an older direct-write implementation; current main calls the line-aware atomic RPC. The target RPC and purchase-order-line table are not present in Production.
- payment-intent v8 is missing exact-cent validation and strict Paymob intention/provider-order correlation present in main.
- paymob-webhook v10 validates HMAC-SHA512, but resolves an intent/order using unsigned merchant_order_id and does not compare the selected row's stored provider_order_id with the signed order.id before processor execution. Current main performs this check for standard, digital-page and subscription intents; it also uses atomic failure RPCs.
- For digital-page payment, the live processor accepts a provider-order ID argument but writes it after selecting the order; it does not itself assert stored ID equality. The live Edge's missing pre-RPC check is therefore material. The current-main preflight comparison is a mandatory dependency, not redundant validation.
- The current-main forward migration RC475 adds the standard failure processor and the new subscription processors, and strengthens the standard success path with a matching-reconciliation postcondition. The live success processor body lacks PAYMENT_INTENT_EVENT_WITHOUT_MATCHING_RECONCILIATION and PAYMENT_INTENT_ALREADY_FINAL_WITHOUT_MATCHING_RECONCILIATION guards. RC475 is absent from the live ledger.

No payment, subscription, digital-page, journal or ERP data rows were selected. Previous live row-count snapshots reported zero rows in affected transaction tables; this audit does not infer exploitation or customer impact.

## 4. Release order and safety boundary

1. Reconcile the entire ordered migration source list and physical effects; preserve immutable history.
2. Restore verified owner-controlled encrypted backups of database, Auth, Storage objects/metadata, Vault/configuration into disposable PostgreSQL 17 and rehearse rollback.
3. Apply/test missing schema and RPC contracts in the isolated environment only: RC426–RC431, RC434–RC439, RC449A/RC450, RC468/RC470, RC475, RC494 in canonical timestamp order, together with prerequisites and other source versions in the approved 82-source chain.
4. Verify each RPC signature, owner, SECURITY DEFINER, strict search_path, ACL, provider-order/event binding and all negative/positive tenant/branch/actor cases.
5. Deploy Edge only as a coordinated database+Edge release slice after full bundle/import-map/secret dependency parity and deployed-origin sandbox webhook tests. Keep directory-listings fail-closed until privacy migrations and Edge consent gates are live.
6. Obtain explicit Production release authorization only after backup/restore, full E2E and rollback evidence is complete.

**No Production migration, SQL write, RLS/GRANT, Edge deployment, payment, settlement, journal, ERP, Storage, Auth or website deployment was performed.** Full platform remains **BLOCKED / NOT CERTIFIED**.
