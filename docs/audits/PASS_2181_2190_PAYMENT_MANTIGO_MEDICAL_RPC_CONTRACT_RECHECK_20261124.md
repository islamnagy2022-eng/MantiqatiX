# PASS 2181–2190 — Payment, MantiGO and medical RPC contract recheck

**Date:** 2026-11-24, approximately 20:05 UTC  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Repository main:** `e5cb0c7644d63d3a1f12bd73a1f3258457ef4b53`  
**Method:** read-only `pg_proc`, `pg_get_functiondef`, signature, `proconfig`, effective EXECUTE ACL and source-migration inspection. No payment, order, ride, medical appointment or customer rows were read. No Production mutation was performed.

## 1. RC468 digital-page payment claims

Source `20261115030000_rc468_digital_page_payment_claim_hardening.sql` requires empty `search_path` for:
- `claim_digital_page_payment_intent_backend(uuid,uuid,text,text)`
- `release_digital_page_payment_intent_claim_backend(uuid,uuid,text)`
- `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)`

Live state:
- Claim and release functions exist at the expected signatures, but both still use `search_path=public, pg_temp`.
- Finalize has only the legacy four-argument overload `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)`, with `search_path=public, pg_temp`; the required five-argument overload is absent.
- All three live functions deny anon EXECUTE and grant authenticated EXECUTE; service_role EXECUTE is false.

**Classification:** the claim family exists physically, but the search-path and finalizer-signature contract is **NOT APPLIED / CONTRACT-BLOCKED**.

## 2. RC474 payment intent business/branch scope

Source `20261118030000_rc474_payment_intent_business_branch_scope.sql` replaces `create_payment_intent_backend(...)` with an empty-search-path SECURITY DEFINER function and authenticated boundary checks.

Live state:
- Exact seven-argument signature exists.
- SECURITY DEFINER; `search_path=public, pg_temp`.
- anon EXECUTE false; authenticated EXECUTE true; service_role EXECUTE true.
- Function definition still references `public.user_memberships`; exact body/tenant-business-branch scope parity is not certified.

**Classification:** baseline RPC exists, but the exact RC474 hardened function contract is **NOT VERIFIED / SEARCH_PATH DRIFT**.

## 3. RC475 Paymob atomic provider path

Source `20261118040000_rc475_paymob_atomic_webhook_forward_repair.sql` defines empty-search-path SECURITY DEFINER functions and service-role-only execution for the atomic provider/subscription flow.

Live state:
- `process_verified_provider_payment(character varying,...,numeric)` exact ten-argument family exists, SECURITY DEFINER, `search_path=public`, anon EXECUTE false, service_role EXECUTE true, authenticated EXECUTE false.
- Its live function body contains `EXTERNAL_EVENT_REPLAY_MISMATCH`, but does not contain `PAYMENT_INTENT_EVENT_WITHOUT_MATCHING_RECONCILIATION` marker from the required forward source.
- `process_verified_provider_payment_failure(...)` is absent.
- `process_verified_subscription_payment_backend(...)` is absent.
- `process_verified_subscription_payment_failure(...)` is absent.
- Legacy `process_verified_subscription_payment(...)` exists with empty search_path and service_role EXECUTE, but this is not the newer atomic backend/failure contract.

**Classification:** provider success baseline is present but contract-drifted; failure and subscription atomic forward functions are **ABSENT**. Keep Paymob and subscription webhook processing fail-closed until complete dependency closure passes.

## 4. RC471 platform-admin shared callers

Source `20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql` requires the shared SECURITY DEFINER callers to use the protected `mnty_can_platform_admin()` guard with empty search_path.

Live caller configuration:
| Function | Live search_path | Live registry helper call |
|---|---|---:|
| `admin_create_global_ad(...)` | `public, pg_temp` | Yes |
| `fulfill_digital_page_publish(uuid,uuid,uuid)` | `public, pg_temp` | Yes |
| `review_mantigo_captain_application(...)` | `public` | Yes |
| `set_mantigo_financial_config_backend(uuid,numeric,text)` | `public` | Yes |

The presence of a call to `mnty_can_platform_admin()` is not a semantic pass: the live helper itself still delegates to the legacy unscoped membership predicate and is not registry-backed (see PASS 2121–2130). All four callers retain the non-empty `search_path` setting required to be emptied by RC471.

**Classification:** source caller intent is partly reflected in the body, but the registry helper and search-path hardening are **NOT APPLIED**.

## 5. RC496 MantiGO accepted-bid invariant

Source `20261121030000_rc496_mantigo_bid_accept_state_invariant.sql`:
- creates `mantigo_bids_one_accepted_per_ride_idx`;
- replaces create, lock-fare and accept RPCs with empty-search-path definitions;
- explicitly guards the offered-state transition and acceptance race.

Live state:
- `create_mantigo_bid_backend(...)`, `lock_mantigo_fare_backend(uuid,text)`, and `accept_mantigo_bid_backend(uuid,text,text)` exist.
- All three are SECURITY DEFINER with `search_path=public`; anon EXECUTE denied and authenticated EXECUTE granted.
- The accept function body does not contain the source guard markers `BID_NOT_OFFERED` or `BID_ACCEPTANCE_RACE_LOST`.
- `mantigo_bids_one_accepted_per_ride_idx` is absent.

**Classification:** legacy MantiGO RPCs exist, but the RC496 accepted-bid unique/state invariant is **ABSENT / CONTRACT-BLOCKED**.

## 6. RC921 / RC922 medical appointment provider state machine

Source `20261123010000_rc921_medical_appointment_provider_state_machine.sql` and `20261123221950_rc922_medical_appointment_tenant_wide_provider_scope.sql` both define `update_medical_appointment_status_backend(uuid,text,text)` with empty search_path, and require assigned-provider/profile binding before provider status transitions.

Live state:
- Exact three-argument signature exists, SECURITY DEFINER.
- `search_path=public, pg_temp`; anon EXECUTE false; authenticated EXECUTE true.
- Live body contains a `SERVICE_PROVIDER` role marker but lacks `ASSIGNED_PROVIDER_REQUIRED` marker from the forward source. The new own-profile-in-exact-business binding is not established by this marker or the current definition.
- Earlier read-only audit independently identified the legacy status implementation in Production.

**Classification:** function exists but remains **LEGACY / RC921–RC922 CONTRACT NOT APPLIED**.

## 7. Combined disposition

These findings add to, rather than replace, the object/column/index gaps in PASS 2161–2170:
- Payment: RC468/RC474/RC475 contracts are incomplete.
- Platform admin: RC471 shared callers retain unsafe path configuration and a stale helper.
- MantiGO: RC496 accepted-bid invariant is not present in live function/index state.
- Medical: RC921/RC922 assigned-provider state transition is not present in live function configuration/body.

All these are source-to-Production differences. Their disposable PostgreSQL tests do not prove live application.

## 8. Safe next steps

1. Keep Production write paths and payment/settlement/directory reactivation closed.
2. Include the above source changes in the coordinated 81-ID DB + Edge release bundle; do not hot-patch individual SECURITY DEFINER functions.
3. Complete exact body/signature, owner, search_path, ACL, constraints and index comparisons for every affected migration.
4. Complete encrypted DB and Storage backup retrieval, Auth/Vault recovery, independent PostgreSQL 17 restore/rollback, measured RPO/RTO and explicit release approval.
5. After approved release, rerun raw anon, Anonymous Auth, missing-claim, tenant/branch and race/concurrency tests against the deployed origin.

**Production impact:** read-only catalog/source checks only. No DDL/DML, RLS, GRANT, Auth, Storage, Edge, payment, settlement, ride or medical appointment data was changed. Full platform remains **BLOCKED / NOT CERTIFIED**.
