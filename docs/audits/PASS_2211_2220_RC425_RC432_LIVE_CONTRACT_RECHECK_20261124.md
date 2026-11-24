# Pass 2211–2220 — RC425–RC432 payment and wallet source-to-live contract recheck

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Source review plus read-only PostgreSQL catalog queries. No Production DDL, ACL, Auth, Storage, Edge, payment, wallet or customer-data writes.

## Scope

Compared the exact mainline migration sources:

- `20261009120000_rc425_atomic_mantigo_paymob_payment.sql`
- `20261009130000_rc426_digital_page_provider_order_binding.sql`
- `20261009140000_rc427_one_active_payment_intent_per_order.sql`
- `20261009150000_rc428_atomic_provider_failure_webhook.sql`
- `20261009160000_rc429_atomic_subscription_failure_webhook.sql`
- `20261009170000_rc430_atomic_subscription_success_webhook.sql`
- `20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql`
- `20261009190000_rc432_smm_wallet_transaction_idempotency.sql`

The live checks used `to_regclass`, `to_regprocedure`, `pg_proc.proconfig/prosecdef`, effective role privileges, `pg_index`, and `information_schema.columns`. No business rows or payment payloads were queried.

## Migration-by-migration result

| Migration | Required source effect | Live Production result | Disposition |
|---|---|---|---|
| RC425 | `public.mantigo_payment_provider_events` with RLS + FORCE RLS, plus `process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb)` | Table absent; exact RPC signature absent | **BLOCKED — atomic MantiGo Paymob path not present** |
| RC426 | Five-argument claim-token finalizer `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)` | Exact overload absent. `payment_intents.provider_order_id` and `digital_page_orders.provider_order_id` columns are present | **BLOCKED — columns alone do not satisfy claim/finalization contract** |
| RC427 | Partial unique index `uq_payment_intents_one_active_per_order` | Index absent | **BLOCKED — concurrent active-intent invariant not installed** |
| RC428 | `process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)` | Exact RPC absent | **BLOCKED — provider failure webhook processor not present** |
| RC429 | `process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)` | Exact RPC absent | **BLOCKED — subscription failure processor not present** |
| RC430 | `process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)` | Exact RPC absent | **BLOCKED — atomic subscription success processor not present** |
| RC431 | Harden the digital-page payment processor with empty `search_path` and restricted service boundary | Exact function exists as SECURITY DEFINER, owner `postgres`, but `search_path=public, pg_temp`; anon EXECUTE=false, authenticated EXECUTE=false, service_role EXECUTE=true | **BLOCKED — live search_path does not meet source contract** |
| RC432 | Partial unique index `smm_wallet_transactions_reference_type_uidx`; idempotent debit/refund/admin-credit wallet RPCs with empty `search_path` | Index absent. `smm_debit_wallet(uuid,numeric,uuid)` and `smm_refund_wallet(uuid,numeric,uuid,text)` exist as SECURITY DEFINER, but both use `search_path=public`; anon=false, authenticated=false, service_role=true. Exact `smm_admin_credit_wallet(uuid,uuid,numeric,text,uuid)` is absent | **BLOCKED — legacy wallet routines do not satisfy full RC432 contract** |

## Important interpretation

- RC426's two provider-order columns are present, but this does not prove the five-argument finalizer, claim-token checks, or signed-provider correlation are deployed.
- RC431's function name and exact signature exist; its non-empty `search_path` is a security-contract mismatch, not a successful deployment.
- RC432's debit and refund routines exist, but the required unique idempotency index and admin-credit routine are absent, and the existing routines do not have the empty search path required by the source.
- All missing signatures and objects remain unapplied. Do not fabricate migration-ledger rows or replay these migrations individually.
- RC425–RC432 are part of the current 82-version source release contract. Production's live migration ledger remains 310 rows through `20261110150618`; exact source version identities are still 0/82.

## Release disposition

**Payment, subscription checkout, MantiGo payment and SMM wallet paths remain BLOCKED / NOT CERTIFIED.**

Continue source-to-live reconciliation through RC434–RC439 and their dependencies, then the remaining 82-version effect map. Only consider a coordinated DB + Edge release after exact-head CI, physical-object/alias reconciliation, owner-controlled encrypted database + Storage backup, independent restore/rollback, Auth/Vault recovery, measured RPO/RTO and explicit release approval.

**Production mutation:** NONE.
