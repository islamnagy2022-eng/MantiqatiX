# Pass 2331–2340 — RC102–RC106 order/provider-service contracts and RC117 current image-column recheck

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Exact source review and read-only PostgreSQL privilege/function/column checks. No order, provider-service, business or product rows were read.

## Migration-by-migration result

| Migration | Source contract | Live Production result | Status |
|---|---|---|---|
| RC102 provider-service owner write grants | Authenticated INSERT/UPDATE/DELETE grants on `marketing_provider_services`; existing owner-scoped RLS remains the authorization layer | All three effective authenticated write privileges are false; anon and service_role INSERT are also false. | **BLOCKED — owner UI writes cannot pass table privilege gate** |
| RC103 order-status branch scope | Tenant-wide OWNER/ADMIN only when both business_id and branch_id are NULL; other staff must match exact order business and branch; customer own cancellation preserved | Live `update_order_status_backend` chooses an active membership by tenant, treats OWNER/ADMIN as always scope-valid, and checks business_id for other staff but does not compare membership branch_id to order branch_id. It does not require OWNER/ADMIN membership to be fully unscoped. | **P0 SCOPE DRIFT** |
| RC104 order idempotency scope | Replaying a client idempotency key must be bound to the same customer and seller/business/branch scope | Live `create_order_backend` finds by `tenant_id + client_idempotency_key`, row-locks the result, and returns it without checking existing customer_id, business_id or branch_id against the new request. | **P0 REPLAY SCOPE GAP** |
| RC105 order-create service-role identity | Verified Edge bearer token may call backend through service_role after `auth.getUser(token)`; non-service callers must still bind auth.uid() to p_customer_id | Live function is executable by service_role only but body requires `auth.uid() = p_customer_id` unconditionally; RC105's `auth.role()='service_role'` exception is absent. | **BLOCKED — source Edge identity branch not live** |
| RC106 order-status service-role identity | Same verified Edge service-role path for order status; all other callers remain actor-bound to auth.uid() | Live status RPC is service_role-executable only but unconditionally requires `p_user_id = auth.uid()`; RC106's service-role branch is absent. | **BLOCKED — source Edge identity branch not live** |
| RC117 default-image current schema | `marketing_services.image_url`, `image_source`, default-image helper, trigger functions and triggers | `public.marketing_services` exists, but a fresh 2026-11-24 query finds neither image column; helper and all three trigger functions/triggers are also absent. | **BLOCKED — current complete RC117 effect not present** |

## Exact order-processing interpretation

### RC103
The live routine still row-locks the order and preserves the paid-order cancellation check. The authorization predicate is weaker than the source:
- OWNER/ADMIN are treated as tenant-wide without requiring `business_id IS NULL AND branch_id IS NULL`.
- Other staff are checked against order business, but the membership branch is not checked against order branch.
- The membership selection itself is tenant-based and only sorts a matching business ahead of other tenant memberships.

### RC104
The live idempotency query is tenant + key only and returns the existing order identity/status/amount/currency/pricing snapshot. A caller who passes their own authenticated customer ID but reuses a key already used by a different customer/business/branch is not rejected by an explicit replay-scope mismatch guard. The existing row lock prevents a race on that found row; it does not prove replay ownership.

### RC105 / RC106
Both live RPCs have service_role EXECUTE and deny anon/authenticated EXECUTE. That ACL is consistent with a backend-only surface. The body mismatch is separate: the live code still requires a non-null user JWT identity match and has no explicit service_role branch as in the source. A service-role-only Edge call without the forwarded user identity will be rejected by the live body. Do not fix this by granting authenticated EXECUTE directly; keep the trusted Edge boundary.

## RC117 historical/current discrepancy

An earlier dated evidence record on 2026-11-14 recorded `marketing_services.image_url` as present while `image_source` and the helper/trigger chain were still missing. The fresh 2026-11-24 direct `information_schema.columns` and `pg_attribute` checks now return neither `image_url` nor `image_source`. This report records the current state and flags the earlier image_url presence as historical evidence requiring drift explanation; it does not infer when or why the column disappeared.

## Release disposition

- Keep provider-service editing and order create/status flows gated until RC102–RC106 are applied through the ordered release and runtime tests prove owner/branch/replay/service-role behavior.
- Do not widen raw client grants to work around the Edge identity mismatch.
- Keep default-image functionality blocked until both columns, helper functions and trigger bindings are all present and tested.
- Production migration ledger remains 310 rows through `20261110150618`.
- No Production privilege, function, schema, policy, order, business, provider-service or catalog data changed.

**Production mutation:** NONE.
