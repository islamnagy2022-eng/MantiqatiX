# Pass 2251–2260 — RC463–RC478 Platform Admin, order scope, directory and payment live recheck

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Mainline migration source review plus read-only PostgreSQL catalog, ACL, policy and routine-body inspection. No Production writes.

## Migration-by-migration result

| Migration | Source contract | Live Production evidence | Status |
|---|---|---|---|
| RC463 trigger-only SECURITY DEFINER ACL | Both expected trigger functions remain attached to their expected triggers, have no direct anon/authenticated EXECUTE, and hardened function search paths | Both functions/triggers exist; `capture_commission_rule_audit()` has empty path; `assign_default_owner_to_unowned_business()` still has `search_path=public, auth`. Both deny anon/authenticated EXECUTE. | **PARTIAL — one trigger function retains non-empty path** |
| RC464 platform-admin registry | `private.platform_admins` is canonical; `mnty_can_platform_admin()` must read the registry, owned by the registry owner, not tenant membership roles | Helper exists as SECURITY DEFINER, owner `postgres`, but live body is `public.mnty_can('admin',null,null,null)`; no direct registry reference; path is `public, pg_temp`. The registry exists with RLS enabled, no client table SELECT, owner `postgres`; FORCE RLS is checked separately under RC484. | **BLOCKED — old null-scope authorization body is still live** |
| RC465 orders/history read scope | Read predicates must match parent order business/branch; history read and insert must match parent order scope | RLS remains enabled, but `orders_member_select` and `order_status_history_member_read` use tenant membership only. Provider policy checks business but not assigned branch. History manager INSERT checks tenant/role/actor but not matching parent order business/branch. | **POLICY DRIFT — tenant-only access remains** |
| RC466 business/branch/inventory hierarchy | Reads and writes inherit exact tenant/business/branch scope and parent warehouse relationships | `businesses_member_select`, `branches_member_read`, department/warehouse/stock/inventory read policies remain tenant-only. Manager write predicates for branches/warehouses/inventory do not enforce exact business/branch hierarchy. | **POLICY DRIFT — branch-level isolation is incomplete** |
| RC467 commission scope | Commission administration only through canonical platform-admin guard; operational preview limited to tenant-wide or exact-business finance scope; branch finance is denied | Four exact RPCs exist. Three commission-admin routines have empty search_path; `preview_commission_backend(...)` remains `search_path=public`. All four deny anon and allow authenticated. The required RC464 registry-backed admin guard is not live, so the platform-only boundary cannot be certified. | **PARTIAL / BLOCKED** |
| RC468 digital-page payment claim hardening | Strict claim token, provider-order binding, three exact claim/release/finalize RPCs, empty search_path | Claim and release RPCs exist but use `search_path=public, pg_temp`; finalizer exact signature absent. Current webhook routine also has old path/body. | **PARTIAL / BLOCKED** |
| RC469 shared platform-admin callers | Four helper-dependent SECURITY DEFINER entrypoints move to empty search_path without widening grants | All four exact functions exist; anon EXECUTE=false and authenticated EXECUTE=true, but all four still use `public` or `public, pg_temp`. | **SEARCH_PATH DRIFT** |
| RC470 digital-page webhook repair | Hardened exact webhook processor, empty path, advisory lock, provider-order/transaction/replay-status guards; service_role-only | Event table exists, all six required event columns exist, and a unique external-event index exists. Exact webhook function exists as SECURITY DEFINER/service_role-only, but path remains `public, pg_temp` and all three source postcondition guard markers are absent from the live body. | **PARTIAL — schema present, hardened processor body not present** |
| RC471 MantiGO platform-admin forward hardening | Replace five MantiGO global functions with registry-backed guard; harden four additional caller RPCs | All nine function identities exist, but the helper still calls legacy `mnty_can('admin',NULL,NULL,NULL)`; the five admin functions and four additional callers retain non-empty paths. | **BLOCKED — forward hardening not live** |
| RC472 directory claim review atomicity | Null-safe membership unique index and atomic claim-review RPC | `ux_user_memberships_user_business_branch_nullsafe` absent; `review_directory_listing_claim_atomic(uuid,text,uuid,text,uuid,boolean,boolean)` absent. | **BLOCKED** |
| RC473 directory contact consent | Consent table, active-scope uniqueness, listing index, RLS + FORCE RLS, no client base-table access | `directory_listing_contact_consents` table is absent; required indexes are consequently absent. | **BLOCKED — no consent-backed disclosure record** |
| RC474 payment-intent business/branch scope | Non-customer actor must hold allowed financial membership in the exact business and applicable branch | `create_payment_intent_backend(...)` exists, SECURITY DEFINER, path `public, pg_temp`, anon=false, authenticated/service_role=true. Live function body mentions business scope but has no branch-scope predicate. | **PARTIAL — branch authorization not enforced by live body** |
| RC475 Paymob atomic webhook forward repair | Restore three missing failure/subscription processors and harden the provider-payment processor; service_role boundary | Provider-failure, subscription-failure and subscription-success exact RPCs remain absent. `process_verified_provider_payment(...)` exists and is service_role-only but still has `search_path=public`. | **PARTIAL / BLOCKED** |
| RC476 MantiGO captain earnings | Canonical ledger aggregation with actor ownership, empty search_path | Exact function exists, anon=false/authenticated=true, but path remains `public`. | **SEARCH_PATH DRIFT** |
| RC477 MantiGO customer bid-contact privacy | Serialize bids without contact/vehicle identifiers until bid status is ACCEPTED | Exact function exists and checks the customer's actor ID, but live body aggregates `to_jsonb(b)` for the full bid row. It contains no phone/plate redaction or ACCEPTED gate. Path remains `public`. | **PRIVACY BLOCKER — full bid object is still serialized** |
| RC478 MantiGO open-ride privacy | Require non-anonymous Auth session, active verified/available captain, and matching vehicle category before revealing open ride locations | Exact function exists, but live body has category filtering only; no `is_anonymous`, verification-status or availability-status gate. Path remains `public`; anon EXECUTE=false/authenticated=true. | **PRIVACY BLOCKER — eligibility/anonymous guards missing** |

## Important interpretation

### Platform Admin
The live helper body remains the old null-scope membership check. Merely having a `private.platform_admins` table and a SECURITY DEFINER wrapper does not make it registry-backed. RC464/RC471 preconditions and the later RC484 root-boundary requirements remain unsatisfied.

### Orders and inventory
The base tables have RLS enabled, but permissive policies OR together. The current tenant-only predicates are wider than RC465/RC466's exact parent business/branch requirements. RLS enabled alone is not proof of correct tenant isolation.

### Digital-page payments
RC470 has useful schema prerequisites: event table, six columns and unique external-event index are present. The remaining gap is in the function body and search_path. The three marker checks required by the source postcondition do not match the live body. Do not certify Paymob webhook replay protection from the table/index alone.

### Directory consent
The missing RC472 membership uniqueness invariant and missing RC473 consent ledger mean the public directory has no deployed owner-granted phone/address/precise-location consent mechanism required by these sources.

### MantiGO contact privacy
The live customer-rides function serializes full bid rows using `to_jsonb(b)`; the RC477 source explicitly strips `captain_phone` and `vehicle_plate` unless the bid is ACCEPTED. The live open-rides function also lacks the RC478 non-anonymous, verified and available captain gates. No ride/customer rows were queried.

## Release disposition

- Keep platform-root, order/business/branch scope, digital-page payment finalization, directory contact consent and MantiGO privacy paths **BLOCKED / NOT CERTIFIED**.
- Do not patch individual live policies or functions, and do not apply historical migrations out of order.
- Production ledger remains 310 rows through `20261110150618`; the source release remains 82 migrations with no exact live version-identity matches.
- No Production schema, RLS, grant, Auth, Storage, Edge, payment, wallet, directory, ride, or customer-data change occurred.

**Production mutation:** NONE.
