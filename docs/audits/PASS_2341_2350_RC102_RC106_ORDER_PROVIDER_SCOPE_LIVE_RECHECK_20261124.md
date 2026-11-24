# PASS 2341–2350 — RC102–RC106 provider-service grants and order identity/scope live recheck

**Date:** 2026-11-24
**Production:** MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu
**Method:** exact source review and read-only table privilege, RLS policy, function identity, body marker, search_path and effective EXECUTE checks. No order/customer/payment rows were selected or modified.

| Migration | Required source contract | Live read-back | Disposition |
|---|---|---|---|
| RC102 provider-service owner writes | Grant authenticated INSERT/UPDATE/DELETE on marketing_provider_services while retaining owner_manage RLS; no anon/public/service_role broadening. | owner_manage policy exists, but authenticated INSERT/UPDATE/DELETE are all false; anon and service_role INSERT are false. | **BLOCKED — grant absent; provider-service owner UI writes cannot execute.** |
| RC103 order status branch scope | update_order_status_backend must preserve customer cancellation/payment guards and require exact business + branch match for scoped staff. | Exact signature exists, SECURITY DEFINER/search_path=public. Live body selects membership business only and does not compare membership branch to order branch; tenant-wide OWNER/ADMIN branch is broader than source. | **BLOCKED — branch-scope repair absent.** |
| RC104 order idempotency scope | create_order_backend replay must bind idempotency key to same customer, business and branch; mismatched reuse raises IDEMPOTENCY_KEY_CONFLICT. | Exact signature exists, search_path=public. Live body returns matching key result without the source conflict guard and lacks exact branch scope. | **BLOCKED — idempotency replay boundary absent.** |
| RC105 order-create service identity | Preserve customer auth.uid binding for normal callers while allowing verified service_role Edge path after token verification. | service_role EXECUTE=true, but live body still unconditionally requires auth.uid()=p_customer_id and contains no service_role bypass. | **BLOCKED — service-role Edge order-create path cannot pass actor binding.** |
| RC106 order-status service identity | Same verified service_role Edge path for order-status while preserving actor binding for non-service-role callers and RC103 branch scope. | service_role EXECUTE=true, but live body still unconditionally requires auth.uid()=p_user_id; no service_role branch and no exact branch check. | **BLOCKED — service-role Edge status path and branch scope absent.** |

## Safety and release

- Existing owner RLS policy is not a substitute for table grants; without effective authenticated DML privileges the intended owner workflow is closed.
- Service-role EXECUTE alone is not proof of a usable Edge path: the current function body still requires auth.uid(), which is not the identity model of the verified service-role invocation.
- Do not grant or patch these privileges/functions individually in Production. Keep order creation/status and provider-service writes blocked until the coordinated migration/Edge bundle and deployed-origin tests pass.
- Live migration ledger remains 310 rows through 20261110150618; no Production write occurred.

**Production mutation:** NONE.