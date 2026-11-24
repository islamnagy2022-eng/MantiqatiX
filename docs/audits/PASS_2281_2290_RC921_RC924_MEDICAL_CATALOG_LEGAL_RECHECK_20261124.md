# Pass 2281–2290 — RC921–RC924 Medical state machine, catalog anonymous guard and Legal agreement reads

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Exact source comparison and read-only PostgreSQL routine/policy inspection. No Production writes.

## Migration-by-migration result

| Migration | Source contract | Live Production result | Status |
|---|---|---|---|
| RC921 medical provider state machine | Lock appointment; patient may self-cancel without staff membership; assigned provider or authorized business staff may apply only forward transitions BOOKED → CONFIRMED/CANCELLED and CONFIRMED → COMPLETED/NO_SHOW/CANCELLED | Live RPC is an older SECURITY DEFINER body with `search_path=public, pg_temp`. It requires an active tenant membership before handling a patient cancellation; no independent patient path; no explicit transition matrix; no assigned-provider check. | **BLOCKED — source state machine not deployed** |
| RC922 tenant-wide provider exception | Tenant-wide SERVICE_PROVIDER membership is allowed only if it maps to the user's own active provider profile for the appointment's exact business; ownership/status checked before provider transition | Live routine only checks active membership in the appointment tenant and allows `business_id IS NULL OR business_id = appointment.business_id`. It does not verify `doctor_id` against a provider profile owned by the actor, nor check the profile is ACTIVE. | **BLOCKED — provider assignment boundary missing** |
| RC923 catalog anonymous Auth guard | Registry-backed platform helper is a prerequisite; replace three RC485 RPCs with empty search_path, explicit anonymous claim guard and authenticated-only ACL; preserve RC486 serialized price allocator | All three exact RPCs exist but remain `search_path=public`, do not call `public.is_platform_admin()`, and contain no `is_anonymous` guard. Price routine also has no advisory lock; unique version index is absent. The live platform helper itself remains membership-derived, so RC923 preflight is not satisfied. | **BLOCKED — preconditions and replacements absent** |
| RC924 agreement participant read scope | Requires RC482 UUID-only registry-backed Legal Admin helper; restrictive explicit confirmed-auth SELECT guard; participant correlation must be `agreement_participants.agreement_id = agreements.id` | `private.legal_is_admin(uuid)` still references `public.user_memberships`; zero-argument overload remains. `agreements_confirmed_auth_select` policy is absent. Existing participant policy compares `ap.agreement_id = ap.id` (self-comparison) rather than the parent `agreements.id`. Existing non-anonymous restrictions use COALESCE semantics that allow a missing claim. | **BLOCKED — participant predicate and identity guard are wrong** |

## Detailed evidence

### RC921 / RC922 medical appointment transitions

The live function currently:
- Locks the appointment row with `FOR UPDATE` (this is retained and is a positive concurrency control).
- Requires the actor to have an active membership in the appointment tenant.
- Allows any active matching tenant/business membership role from the old role set.
- Uses `business_id IS NULL OR business_id = appointment.business_id` for membership selection.
- Does not look up the assigned provider profile using `doctor_id`, `owner_user_id=auth.uid()`, and profile ACTIVE status.
- Does not implement the source's explicit forward-only transition matrix.
- Does not permit patient self-cancellation independently of staff membership.

The live function remains `SECURITY DEFINER` with `search_path=public, pg_temp`; anon EXECUTE is false and authenticated EXECUTE is true. The read-only audit did not query medical appointment rows.

### RC923 catalog guard

The current catalog state is the same pre-RC923 state observed in the RC923/RC925 reports:
- `upsert_catalog_item_backend`, `upsert_catalog_price_backend`, and `update_catalog_item_status_backend` are present as SECURITY DEFINER, but still have `search_path=public`.
- None calls `public.is_platform_admin()` and none has an anonymous-Auth claim guard.
- `upsert_catalog_price_backend` still allocates `MAX(version)+1` without `pg_advisory_xact_lock`; the unique item/branch/version index is absent.
- `public.is_platform_admin()` is still SECURITY INVOKER, `search_path=public`, and membership-derived rather than registry-backed.

RC923's preflight explicitly requires a registry-backed helper and the hardened RC485 contract. Its source cannot safely be cherry-picked or deployed out of order. RC925's source/test success is not Production evidence.

### RC924 agreement participant read

The agreements table has RLS and FORCE RLS enabled. However, the current live policy set is not the RC924 set:
- `agreements_participant_read` uses `ap.agreement_id = ap.id` rather than `ap.agreement_id = agreements.id`. This breaks the intended parent-row join for participants.
- `agreements_confirmed_auth_select` is absent.
- `private.legal_is_admin(uuid)` and `private.legal_is_admin()` both exist. The UUID implementation references `public.user_memberships`, not `private.platform_admins`.
- Existing `mnt_non_anonymous_boundary` and `non_anonymous_authenticated_guard` use legacy COALESCE expressions, so a missing `is_anonymous` claim is not denied by the strict RC924 expression.

The current Legal helper and agreement participant policy cannot be certified as registry-backed global administration or correct participant-to-parent visibility.

## Release disposition

- Keep medical status mutation, catalog price/item writes and agreement reads blocked pending ordered source repair and adversarial tests.
- RC923 remains dependent on RC484 registry-root and RC485 catalog-source contracts; RC924 depends on RC482 registry-backed Legal authority.
- Do not apply RC921–RC924 individually against the current Production state.
- Live migration ledger remains 310 rows through `20261110150618`; these source identities remain outside the live ledger.
- No medical, catalog, agreement, legal, Auth, RLS, policy, or business-data change occurred.

**Production mutation:** NONE.
