# Pass 2311 — RC446 / RC478 MantiGO open-ride location disclosure

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Source/live function-body inspection only. No ride/customer rows queried.

## Source progression

- **RC446** requires `auth.uid() = p_user_id` and an active, verified, available `mantigo_captain_profiles` row before revealing open pickup/destination locations.
- **RC478** is a later forward repair which keeps the captain profile gate, explicitly rejects anonymous Auth sessions, and limits results to the captain's vehicle category.

## Live Production

The exact `list_open_mantigo_rides_backend(uuid)` function exists as SECURITY DEFINER, but:
- `search_path=public` rather than RC446's `pg_catalog` and RC478's hardened path.
- The body checks only `p_user_id = auth.uid()`.
- No active captain profile check.
- No VERIFIED status check.
- No AVAILABLE status check.
- No explicit `is_anonymous` check.
- No vehicle-category filter.
- anon EXECUTE=false; authenticated EXECUTE=true.

The live body returns open ride pickup and destination columns to any authenticated caller that can supply their own user ID, without proving they are an eligible MantiGO captain.

## Disposition

**P0 LOCATION-DISCLOSURE BLOCKER.** RC446 and its RC478 repair are both not reflected in the live function body. Do not enable open-ride discovery or treat captain verification/availability as enforced until the exact hardened function is deployed and adversarially tested.

No rides or customer records were selected and no Production function, grant, policy or data was changed.
