# Pass 1220–1229 — Production Edge, payment and database contract recheck

**Date:** 2026-11-20  
**Main commit:** `57862b714c0b049419204b6143b966c149682906`  
**Supabase Production:** `moyhiluyhjsujhwlyeuu`  
**Method:** exact live Edge `index.ts` retrieval vs current-main source, read-only PostgreSQL catalog/column/index/aggregate queries, and exact migration-version comparison.  
**Production mutations:** NONE.  
**Disposition:** **FULL PLATFORM BLOCKED / NOT CERTIFIED**.

## 1. Critical Edge source parity — 11 inspected

Exact normalized UTF-8 entrypoint comparison returned **4/11 exact matches** and **7/11 mismatches**.

| Function | Production | verify_jwt | Live bytes | Main bytes | Exact match |
|---|---:|---|---:|---:|---|
| `api` | v17 ACTIVE | false | 16,432 | 16,432 | PASS |
| `order-create` | v8 ACTIVE | true | 10,083 | 13,988 | BLOCKED |
| `order-status-update` | v4 ACTIVE | true | 1,986 | 1,986 | PASS |
| `payment-intent` | v8 ACTIVE | true | 8,114 | 10,146 | BLOCKED |
| `payment-webhook` | v3 ACTIVE | false | 3,356 | 3,356 | PASS |
| `paymob-webhook` | v10 ACTIVE | false | 11,538 | 12,376 | BLOCKED |
| `digital-page-payment-intent` | v5 ACTIVE | true | 5,345 | 6,532 | BLOCKED |
| `subscription-payment-intent` | v4 ACTIVE | true | 5,196 | 11,100 | BLOCKED |
| `financial-journal` | v3 ACTIVE | true | 1,591 | 3,387 | BLOCKED |
| `smm-gateway` | v13 ACTIVE | true | 20,040 | 20,040 | PASS — deferred |
| `directory-listings` | v16 ACTIVE | false | 46,907 | 51,305 | BLOCKED |

Live bundle hashes for the seven mismatches:

- `order-create`: `16f9b8bb687c33afeca14d85cb4c43af9948bd8b3ef3178990cc76ca1abea782`
- `payment-intent`: `d6b8faee1582c73ead440614cbe983114d1e7f31aa50f69795522fb20e737f54`
- `paymob-webhook`: `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca`
- `digital-page-payment-intent`: `8aa3d2e9c025e7b74d4d1847e8a6744bc84a9ded7cfc0c721f9604efd177af4b`
- `subscription-payment-intent`: `4466345787ea6b10a29b1dd63e9f0ab3cae640e9bb4d8ecb6d09445809e077e5`
- `financial-journal`: `79ee18d0544e7cab8fe33fe84c27a5017d1163f411eb5b9e07b99fd79e16e366`
- `directory-listings`: `13f83fcf2faec148af34c08a006ab7bd8f9aa5946bc8af971ebf3e58a9120de0`

This is an exact entrypoint-parity finding. A byte difference alone does not mean every differing function is wholly unsafe; the semantic blockers below are independently supported by source and database checks.

## 2. Database dependencies physically absent or contractually behind

Read-only catalog results:

| Dependency | Production observation | Required behavior |
|---|---|---|
| RC425 MantiGO provider-event table | `public.mantigo_payment_provider_events` absent | Atomic MantiGO payment event + ledger transition |
| RC427 active payment intent index | `uq_payment_intents_one_active_per_order` absent | One `CREATED/PENDING/SUCCEEDED` intent per order |
| Subscription claim state | `provider_creation_state`, `provider_creation_claimed_at` absent | Atomic provider creation claim / unknown-outcome handling |
| Checkout secret recovery | `client_secret_ciphertext`, `client_secret_iv`, `client_secret_key_version` absent | Versioned encrypted checkout-secret storage |
| Standard payment failure processor | `process_verified_provider_payment_failure` absent | Atomic event + intent failure transition |
| Subscription success/failure processors | `process_verified_subscription_payment_backend`, `process_verified_subscription_payment_failure` absent | Provider-order-bound atomic subscription transition |
| Subscription creation claims | `create_subscription_payment_intent_claimable_backend`, `claim_subscription_provider_intent_creation_backend` absent | Serialize one provider intention attempt |
| MantiGO atomic payment processor | `process_verified_mantigo_payment_backend` absent | Atomic provider event + financial-ledger transition |
| Financial journal Edge RPC ACL | `post_financial_journal_backend(uuid,jsonb,jsonb)` exists but EXECUTE is granted to postgres only; no service_role EXECUTE | RC450 service-role-only actor-bound Edge call |
| Digital-page processor search_path | Existing SECURITY DEFINER function uses `search_path=public, pg_temp`; service_role EXECUTE exists | RC468/forward hardened empty search_path contract |
| Order creation RPC | Old SECURITY DEFINER function is `search_path=public`; previous read-only body review found unconditional `auth.uid() = p_customer_id` guard | RC105 permits only a verified service_role claim while preserving actor binding |

The live source RPC inventory also includes legacy signatures: `process_verified_provider_payment(...)` without provider-order argument and `process_verified_subscription_payment(text,text,uuid,text,numeric,text,boolean)` without provider-order binding. Current main uses the newer failure/claim/atomic processor names above.

The legacy database presence of an RPC or column is not proof the current Edge contract is supported. The live `payment_intents.provider_order_id` column exists but the deployed v8 `payment-intent` does not persist the provider-order binding. The live `digital_page_orders.provider_order_id` column exists, but the deployed webhook still needs the explicit signed-order comparison in main.

## 3. Payment data and duplicate-intent state

Read-only aggregate counts at the current checkpoint:

| Table | Rows |
|---|---:|
| `orders` | 0 |
| `payment_intents` | 0 |
| `payment_provider_events` | 0 |
| `subscription_payment_intents` | 0 |
| `digital_page_orders` | 0 |
| `digital_page_payment_events` | 0 |
| `mantigo_financial_ledger` | 0 |

No existing payment/intent/event rows were observed in these tables. This does not make the old callback contracts safe, and no Paymob call, event replay, refund, settlement, or journal posting was run.

## 4. Public directory contact-consent boundary

Fresh aggregate-only query of `public.public_directory_listings`:

- 965 total directory rows; 869 PUBLISHED.
- All 869 published rows contain a phone and an address.
- 178 published rows contain a secondary phone.
- `public.directory_listing_contact_consents` is absent.
- `private.directory_listing_contact_consents` is absent.
- The deployed `directory-listings` v16 is ACTIVE with `verify_jwt=false` and differs from current main.

Prior live-bundle review confirms its anonymous GET path returns phone/address without the consent-aware output sanitizer. The current-main RC473 consent boundary is not deployed. This is a public contact-disclosure contract gap; the aggregate query selected no phone, address, owner identity, or individual listing content. Do not deploy main `directory-listings` or apply RC472/RC473 alone: source rights, listing evidence, pagination helpers, database/RLS and full Edge bundle must be reconciled and tested together.

## 5. Migration ledger — 64 exact release identifiers

A fresh read-only SELECT compared current `REQUIRED_RELEASE_MIGRATION_VERSIONS` with `supabase_migrations.schema_migrations`:

- Live ledger: **310 rows**, latest version `20261110150618`.
- Exact required identifiers in the current 64-version release contract: **0/64 recorded**.
- All 64 exact source identifiers are absent from the ledger snapshot, including RC471, RC472–RC478, RC479–RC483 and RC484.

This is a migration-identity gap, not proof that every intended physical effect is absent. Several older physical objects exist with legacy definitions, while the explicit missing RC425 table, RC427 index, RC435/RC439 subscription state/secret columns, newer RPC signatures and RC450 service-role journal grant are independently confirmed. Do not fabricate migration ledger rows or replay missing SQL blindly against Production.

The RC484 source migration and its adversarial test/replay were merged and passed on isolated PostgreSQL 17; Production still reports the previous generic `is_platform_admin()` helper, no FORCE RLS on `private.platform_admins`, and 57 dependent policies across 24 tables. The RC484 source merge is not a Production deployment.

## 6. Backup/restore and controlled release

PR #875 is merged and its exact-head CI passed **12/12** encrypted-manifest/restore-evidence tests. This verifier checks operator-provided encrypted files and restore evidence; it does not export Production data, upload a backup, create a restore project, or execute the restore. No actual encrypted backup or restore rehearsal has been performed; measured RPO/RTO and rollback evidence remain NOT VERIFIED.

Required release sequence remains:

1. Operator-created off-site encrypted DB + Storage exports, checksums, Vault recovery evidence and second-environment retrieval.
2. Separate PostgreSQL 17 restore rehearsal, independent review, measured RPO/RTO and rollback proof.
3. Resolve 64-version migration/alias/schema identity reconciliation with exact dependency order and disposable replay.
4. Apply the database migration sequence in an approved release window, with a verified rollback plan.
5. Deploy the complete matching Edge bundles as one dependency-ordered release, verify exact version/hash/config/secrets and ACL contracts.
6. Run Paymob success/failure/duplicate/replay/order/amount/currency mismatch tests, journal reconciliation, directory consent negative/positive tests and tenant/business/branch authorization tests.
7. Keep payment activation and the full platform gate blocked until all evidence passes.

**Production changes:** NONE — no DDL/DML, migration, RLS, GRANT, Auth, Storage, Edge deployment, payment, wallet, settlement, or customer-data mutation.

**Next executable work:** keep P0 issues #857 and #867 open; track the RC473 directory public-contact gap separately; continue schema/Edge compatibility analysis and test coverage on source branches, but do not deploy the seven mismatched functions independently.


## 7. Release-gate hardening after physical contract recheck

The source release gate previously required many payment RPCs by generic function name; that could accept a legacy overload with the same name but a different callable contract. A follow-on source change adds `REQUIRED_PAYMENT_CONTRACT_OBJECTS` (14 exact object contracts) to the live reconciliation gate:

- Exact standard payment success/failure and subscription success/failure RPC signatures.
- Exact RC435 subscription claimable-create and provider-creation-claim RPC signatures.
- Exact RC425 MantiGO atomic payment processor signature.
- Provider-order persistence columns on standard payment intents and digital-page orders.
- Both provider-creation claim columns and all three RC439 encrypted checkout-secret columns on subscription intents.

The 2026-11-20 read-only physical evidence marks the exact legacy-compatible standard success RPC and the two provider-order columns present; it marks the other 11 required RPC/column objects absent. The manifest now records each observation explicitly as PASS or BLOCKED. The validator's complete synthetic fixture includes all 14 contracts and negative fixtures verify that missing claim RPCs/checkout columns block certification.

This is **source-side release-gate hardening only**. It does not create missing objects, apply RC435/RC439, or change Production. The exact PR-head CI/replay results are pending until the focused follow-up PR is opened and executed.
