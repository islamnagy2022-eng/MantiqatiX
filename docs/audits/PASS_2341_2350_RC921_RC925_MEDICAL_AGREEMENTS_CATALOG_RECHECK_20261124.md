# Pass 2341–2350 — RC921–RC925 medical state, agreement scope and catalog identity recheck

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Mainline migration source review and read-only PostgreSQL `pg_proc`, ACL, policy and migration-ledger checks. No Production writes.

## Migration-by-migration result

| Migration | Source contract | Live Production evidence | Status |
|---|---|---|---|
| RC921 medical appointment state machine | Patient may cancel only own BOOKED/CONFIRMED appointment without staff membership; provider/staff transitions require an assigned active provider and exact tenant/business scope; allowed forward-only transitions; SECURITY DEFINER empty path | Exact RPC exists but remains legacy body with `search_path=public, pg_temp`. It selects a generic tenant membership (business NULL or appointment business), does not bind the actor to the assigned provider profile, does not implement the explicit BOOKED/CONFIRMED transition matrix, and performs no independent patient cancellation path before membership is required. | **BLOCKED — legacy medical status authorization/state body** |
| RC922 tenant-wide provider scope follow-up | Tenant-wide SERVICE_PROVIDER role may act only if the caller owns the active provider profile associated with the appointment business; tenant-wide status is not blanket provider access | Same legacy RPC body remains live. It has no provider-profile ownership/active-state check and no explicit `verification_status` validation. Exact business/tenant path is not the RC922 conditional profile-bound tenant-wide scope. | **BLOCKED — provider identity is not tied to the appointment** |
| RC923 catalog anonymous Auth guard | Forward replacement of item, price and item-status RPCs; relies on registry-backed `is_platform_admin()`, empty path, existing RC485/RC486 predicates and confirmed-auth guard | All three exact RPCs exist but remain old RC485 bodies with `search_path=public`, no registry-helper call, and no source postconditions. | **BLOCKED — RC923 prerequisite/forward bodies not live** |
| RC924 agreement participant read scope | Drop old participant policy, install restrictive `is_anonymous=false` SELECT boundary, correlate `agreement_participants.agreement_id = agreements.id`, authorize only participant or registry-backed legal admin | The new `agreements_confirmed_auth_select` restrictive policy is absent. Existing restrictive policy uses `COALESCE(..., false)=false`, which allows a missing claim. Existing participant policy compares `ap.agreement_id = ap.id` rather than `ap.agreement_id = agreements.id`. Legal helper remains membership-derived and zero-argument overload remains. | **BLOCKED — participant relation and confirmed-session boundary are wrong** |
| RC925 catalog missing-claim fail-closed guard | All seven direct catalog RPCs must require `auth.jwt()->>'is_anonymous' IS DISTINCT FROM false`; missing/NULL/true all denied; require registry-backed platform root and empty path; preserve authenticated ACL | All seven exact RPCs exist as SECURITY DEFINER with `search_path=public`, anon EXECUTE=false/authenticated EXECUTE=true. None calls `public.is_platform_admin()`. Four still contain legacy COALESCE claim checks that deny explicit true but accept missing/null; three have no direct claim guard at all. No explicit false-only guard is present. | **BLOCKED — RC925 has not been applied to Production** |

## Detailed findings

### Medical appointment state

The live body for `update_medical_appointment_status_backend(uuid,text,text)`:
- requires a caller-supplied user ID matching `auth.uid()`;
- row-locks the appointment;
- chooses a membership by matching tenant and allowing `business_id IS NULL OR business_id = appointment.business_id`;
- allows broad role labels but does not prove the user is the appointment's assigned provider or owns the corresponding active provider profile;
- updates status directly after checking only that the target is one of CONFIRMED/CANCELLED/COMPLETED/NO_SHOW.

It does not implement the RC921/RC922 patient-first cancellation branch, exact provider identity rule, or forward-only transition matrix. Its live path is `public, pg_temp`, not empty. The report did not inspect patient or appointment rows.

### Agreement participant scope

Current live policy evidence includes:
- `agreements_admin_write`: permissive FOR ALL, delegated to `private.legal_is_admin(auth.uid())`;
- `agreements_participant_read`: permissive SELECT whose EXISTS clause is `ap.agreement_id = ap.id AND ap.user_id=auth.uid()`;
- old `mnt_non_anonymous_boundary` and `non_anonymous_authenticated_guard` restrictive policies, both based on COALESCE defaults rather than a positive confirmed-session claim.

The required RC924 restrictive policy `agreements_confirmed_auth_select` is missing. The participant correlation compares two columns on `agreement_participants` itself instead of connecting the participant row to the parent `agreements.id`. Separately, `private.legal_is_admin(uuid)` still returns true for active membership roles SUPER_ADMIN, ADMIN or LEGAL_ADMIN via `public.user_memberships`, does not read `private.platform_admins`, and the zero-argument overload remains. No agreement contents or participant rows were queried.

### Catalog RPC identity

All seven RC925 target signatures are present in Production, but all are old source bodies:
- 7/7 SECURITY DEFINER;
- 7/7 `search_path=public`;
- anon EXECUTE false and authenticated EXECUTE true for all seven;
- zero call the registry-backed `public.is_platform_admin()`;
- four definitions contain an older COALESCE-based `is_anonymous` guard, which permits a missing claim;
- three definitions contain no `is_anonymous` guard;
- zero contain the RC925 explicit fail-closed `IS DISTINCT FROM false` contract.

The live `public.is_platform_admin()` remains SECURITY INVOKER, `search_path=public`, and membership-derived. `private.platform_admins` still has FORCE RLS false. This means RC925's source-side PG17 tests and mainline merge do not establish a Production deployment.

## Source CI versus Production

Source history:
- RC923, RC924 and RC925 are merged in the current source chain.
- RC925 has passing negative tests for explicit anonymous/missing claim and positive compatibility coverage for `is_anonymous=false`; exact-head isolated PostgreSQL 17 and full 82-version chronological replay passed in CI.
- These source tests are not applied-production evidence.

Current read-only Production migration ledger:
- Rows: **310**
- Last version: `20261110150618`
- Required source release versions: 82
- Exact required-version matches: 0

## Release disposition

- Keep medical appointment provider transitions and agreement participant read authorization **BLOCKED / NOT CERTIFIED**.
- Keep the full catalog RPC group **BLOCKED** until RC484 registry-backed root, FORCE RLS, empty path and RC925 positive/negative JWT behavior are all verified together.
- Do not apply RC921–RC925 independently or mark them deployed from CI results.
- No Production migration, DDL/DML, ACL, RLS, Auth, Storage, Edge, appointment, agreement or catalog row was changed.

**Production mutation:** NONE.
