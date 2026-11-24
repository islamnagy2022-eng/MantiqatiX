# Pass 2271–2280 — RC485–RC496 catalog, Auth-session, Storage, finance and MantiGO state recheck

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Migration-source review and read-only PostgreSQL catalog, RLS, policy, ACL and function-body inspection. No Production writes.

## Migration-by-migration result

| Migration | Source contract | Live Production evidence | Status |
|---|---|---|---|
| RC485 catalog RPC registry root | Seven catalog SECURITY DEFINER RPCs use the registry-backed `public.is_platform_admin()` for platform authority and retain tenant-local business/branch checks; helper must be SECURITY DEFINER with empty path and registry body | All seven exact RPCs exist, SECURITY DEFINER, anon EXECUTE=false/authenticated=true, but all remain `search_path=public` and none calls `is_platform_admin()`. The live helper remains membership-derived. | **BLOCKED — old catalog RPC bodies remain** |
| RC486 catalog price-version serialization | Unique null-safe item/branch/version index plus advisory transaction lock in price-version allocation | `catalog_item_prices_item_branch_version_uidx` absent; live price RPC remains `search_path=public` and contains no advisory lock. | **BLOCKED — concurrent version allocation remains unprotected** |
| RC487 remove SMM first-user bootstrap | Drop `smm_bootstrap_first_admin()` and auth.users trigger; service_role may SELECT explicit allowlist but cannot mutate it | Function and `trg_smm_bootstrap_admin` trigger both remain. Function still inserts `new.id` into `smm_admins` when the table is empty. service_role SELECT on allowlist is false. | **P0 SECURITY BLOCKER — first Auth signup can still bootstrap SMM admin** |
| RC488 Storage anonymous Auth write guard | Three restrictive Storage INSERT/UPDATE/DELETE policies require explicit `is_anonymous=false`; missing/null must be denied | All three `storage_objects_confirmed_auth_*` policies absent. Existing owner/profile upload predicates do not replace the table-wide restrictive guard. | **BLOCKED — anonymous Auth Storage writes not globally fenced** |
| RC489 financial anonymous Auth read guard | Add restrictive confirmed-session SELECT policy to 15 private financial/payment tables | All 15 tables exist with RLS enabled and FORCE RLS enabled; each has a permissive authenticated read policy, but the named `mnty_confirmed_auth_financial_read` restrictive policy is absent on all 15. | **BLOCKED — anonymous Auth read boundary missing despite RLS/FORCE RLS** |
| RC490 medical anonymous Auth read guard | Restrictive confirmed-session SELECT on medical appointments | Table RLS and FORCE RLS are true; `mnty_confirmed_auth_medical_read` policy is absent. | **BLOCKED** |
| RC491 support anonymous Auth boundary | Restrictive confirmed-session SELECT on support tickets | Table RLS and FORCE RLS are true; `mnty_confirmed_auth_support_select` policy is absent. | **BLOCKED** |
| RC492 InDrive anonymous Auth write/read guard | Restrictive confirmed-session INSERT/UPDATE/DELETE on requests and SELECT on bids | `indrive_requests` and `indrive_bids` have RLS and FORCE RLS enabled, but all four `mnty_confirmed_auth_indrive_*` restrictive policies are absent. | **BLOCKED** |
| RC493 private CRM/project/notification read guard | Restrictive confirmed-session SELECT on marketing leads, projects and notifications | All three tables have RLS and FORCE RLS enabled, but `rc493_confirmed_auth_select_guard` is absent on all three. | **BLOCKED** |
| RC494 settlement financial registry scope | Add business scope to settlement rows and enforce explicit tenant/business scope; MNTY-PLATFORM requires `private.platform_admins`; no widening of service-only EXECUTE | Settlement function exists as SECURITY DEFINER/service_role-only, path `pg_catalog, public`, but live body uses tenant-wide `user_memberships` role selection and does not call `is_platform_admin()` or query `private.platform_admins`. | **PRESENT, CONTRACT-BLOCKED — old tenant-only settlement body** |
| RC495 Storage filename/root repair | Correct filename suffix regexes; platform-brand writes must use canonical registry-backed platform admin; owner media policies require confirmed Auth | Five named Storage policies remain on old definitions: branding checks active `user_memberships.role='SUPER_ADMIN'` rather than `mnty_can_platform_admin()`; filename expressions remain old escaped forms. The root helper itself is not registry-backed. | **POLICY DRIFT / BLOCKED** |
| RC496 MantiGO bid acceptance state invariant | One accepted bid per ride, selected bid must be OFFERED, same-winning-bid retry idempotent, per-ride row lock, and revoke legacy client acceptance paths | Unique `mantigo_bids_one_accepted_per_ride_idx` absent. Live accept RPC has a ride row lock and legacy client RPCs have no authenticated EXECUTE, but it does not load/check the selected bid's status is OFFERED before setting it ACCEPTED. Its path remains `public`. | **PARTIAL — row serialization exists, winner-state invariant incomplete** |

## Detailed security interpretation

### SMM first-user bootstrap
The live SECURITY DEFINER trigger function still checks whether `public.smm_admins` is empty and inserts the new Auth user ID when it is. The trigger is attached to `auth.users`. This is the exact first-user-wins privilege bootstrap RC487 removes. Do not treat the absence of direct client INSERT grants as sufficient protection: the trigger executes inside the trusted database context.

### RLS versus confirmed Auth
For RC489–RC493, the relevant tables already have RLS and FORCE RLS enabled. The missing item is the restrictive policy that denies a JWT where `is_anonymous` is true, false is missing, or the claim is NULL. A permissive authenticated policy plus RLS does not itself distinguish anonymous Auth identities.

### Storage
RC488's three restrictive guards are absent. RC495's branding policies still derive global authority from a `SUPER_ADMIN` row in `user_memberships` and do not delegate to a protected root registry. This is unsafe while `mnty_can_platform_admin()` and `is_platform_admin()` are still membership-derived.

### Settlement
The live writer is still service_role-only, so this report does not claim direct authenticated RPC access. The problem is authorization semantics inside the trusted writer: its body uses a tenant membership role lookup rather than the source's registry-only platform check and explicit business scope. Service-role-only ACL does not repair an overbroad internal actor check.

### MantiGO bid acceptance
The live function does take a row lock on the ride, and the legacy direct accept/submit RPCs are not executable by authenticated. However, it does not select the target bid status into a variable and reject any state other than OFFERED. It can therefore transition a non-OFFERED target bid to ACCEPTED if the ride itself remains open. The source adds this selected-bid state check and a unique one-accepted-per-ride index; the index is absent.

## Release disposition

- Keep SMM admin onboarding, catalog platform actions, Storage writes, private financial/medical/support/CRM/notification reads, settlement and MantiGO bid acceptance **BLOCKED / NOT CERTIFIED** until the source contracts and exact-head adversarial tests pass.
- RLS and FORCE RLS presence is not counted as a confirmed-session PASS without the restrictive policy.
- Do not remove intentional public Storage reads or grant table-level service-role access as a shortcut.
- Production ledger remains 310 rows through `20261110150618`; no migration, policy, grant, Auth, Storage object, payment, settlement or business-data mutation occurred.

**Production mutation:** NONE.
