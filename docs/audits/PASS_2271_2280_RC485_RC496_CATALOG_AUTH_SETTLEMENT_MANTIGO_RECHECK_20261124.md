# Pass 2271–2280 — RC485–RC496 catalog, auth boundaries, settlement, storage and MantiGO recheck

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Source review and read-only PostgreSQL function body, ACL, RLS, policy and index checks. No Production mutations.

## Migration-by-migration result

| Migration | Required source contract | Live Production result | Status |
|---|---|---|---|
| RC485 catalog RPC registry root | Seven catalog write RPCs must use the registry-backed `is_platform_admin()` root for global authority while retaining tenant-local scope; source pins hardened function configuration | All seven exact function families exist, SECURITY DEFINER, anon EXECUTE=false, authenticated EXECUTE=true. All still use `search_path=public`; none references `is_platform_admin()` or `private.platform_admins`. The live price RPC body still treats an active SUPER_ADMIN membership with PLATFORM/full_control metadata as a platform override. | **BLOCKED — registry-root source contract not live** |
| RC486 catalog price version serialization | Unique `catalog_item_prices_item_branch_version_uidx`, advisory transaction lock, serialized `MAX(version)+1` allocation | Unique index absent. Live RPC uses `MAX(version)+1` with neither advisory lock nor row lock; path remains `public`. Concurrent price writers can allocate the same version. | **P0 CONCURRENCY BLOCKER** |
| RC487 SMM first-user bootstrap removal | Drop `auth.users` bootstrap trigger and function; preserve allowlist rows; service_role SELECT only | `public.smm_bootstrap_first_admin()` and `trg_smm_bootstrap_admin` remain. Live trigger body inserts `NEW.id` into `smm_admins` when the table is empty. No API role has SMM admin table SELECT/DML grants; expected service_role SELECT is also absent. | **P0 PRIVILEGE-BOOTSTRAP BLOCKER** |
| RC488 Storage confirmed-auth write guard | Restrictive INSERT/UPDATE/DELETE policies require explicit `is_anonymous=false`; public profile-media reads are retained | All three restrictive policy names are absent. `storage.objects` has RLS enabled, FORCE RLS off. Existing owner/platform-brand policies remain the only write predicates; missing/null claim is not closed by RC488's intended restrictive layer. | **BLOCKED — anonymous Auth write boundary not installed** |
| RC489 Financial confirmed-auth reads | Restrictive SELECT guard on 15 financial/payment tables | All 15 tables exist with RLS and FORCE RLS enabled; all 15 have an authenticated permissive read policy; 0/15 have the RC489 restrictive confirmed-auth guard. | **BLOCKED — anonymous Auth financial-read boundary missing** |
| RC490 Medical confirmed-auth reads | Restrictive confirmed-auth SELECT guard on medical appointments | Table RLS/FORCE RLS are enabled; required restrictive policy absent. | **BLOCKED** |
| RC491 Support confirmed-auth reads | Restrictive confirmed-auth SELECT guard on support tickets | Table RLS/FORCE RLS are enabled; required restrictive policy absent. | **BLOCKED** |
| RC492 InDrive confirmed-auth boundary | Restrictive confirmed-auth guards for request INSERT/UPDATE/DELETE and bid SELECT | All four source policy names are absent. Existing permissive policies use legacy COALESCE semantics that treat a missing anonymous claim as false/ordinary authenticated session; RLS and FORCE RLS are enabled. | **BLOCKED — missing/null claim not denied by restrictive guard** |
| RC493 CRM/project/notification confirmed-auth reads | Restrictive confirmed-auth SELECT guards on marketing leads, marketing projects and notifications | All three required restrictive policy instances are absent. Tables have RLS/FORCE RLS enabled; permissive owner/requester/project-membership/own-notification policies remain. | **BLOCKED** |
| RC494 settlement registry scope | Add `settlement_transactions.business_id` and index; settlement writer must use explicit platform registry authority, preserve service-role-only EXECUTE and scope business into settlement row | Both business_id column and index are absent. Exact function exists SECURITY DEFINER with `search_path=pg_catalog, public`, service_role-only, but its body uses tenant membership roles (ADMIN/SUPER_ADMIN/OWNER/FINANCE) rather than the platform registry. Its INSERT/UPDATE does not set settlement_transactions.business_id. | **BLOCKED — settlement tenant/business/root contract absent** |
| RC495 Storage filename and Platform Admin policy repair | Correct filename suffix pattern and bind platform branding to canonical registry guard | Five expected storage policies exist, but the three platform brand policies still check active SUPER_ADMIN membership rather than the canonical registry helper. Current `mnty_can_platform_admin()` remains the legacy null-scope membership helper. | **POLICY DRIFT — root authority not canonical** |
| RC496 MantiGO accepted-bid state invariant | Only OFFERED target bid can be accepted; one winner per ride with unique partial index; legacy client acceptance RPCs stay revoked | Backend RPC exists, SECURITY DEFINER, anon=false/authenticated=true. It locks the ride row `FOR UPDATE`, but does not check that the target bid itself is OFFERED before setting it ACCEPTED. Unique `mantigo_bids_one_accepted_per_ride_idx` absent. Legacy accept/submit RPCs are revoked from authenticated. | **PARTIAL / P0 STATE-INVARIANT BLOCKER** |

## Detailed interpretation

### Catalog price versioning
The live writer reads `coalesce(max(version),0)+1` for the item/branch key and immediately inserts. Neither a transaction advisory lock nor a unique constraint/index protects that key. Concurrent requests may therefore calculate and insert the same version. RC486 is not a cosmetic index; it is the concurrency invariant the allocator relies on.

### SMM administrator bootstrap
The current Auth trigger function is SECURITY DEFINER and executes:
- If `public.smm_admins` is empty, insert the new Auth user ID.
- Return the new Auth row.

Thus the first public signup while the allowlist is empty can still become the first SMM administrator. RC487 explicitly removes this first-user-wins privilege bootstrap. The trigger remains active and must be treated as a P0 security blocker until a controlled forward repair is deployed and verified.

### Anonymous Auth controls
For RC489, the live facts are precise: 15/15 tables already have RLS and FORCE RLS, and 15/15 have an authenticated permissive SELECT policy; none has the restrictive confirmed-auth guard. RC490/RC491 also have RLS/FORCE RLS on but lack the guard. RC492/RC493 guards are absent. Do not report these as safe merely because RLS is enabled or anonymous database role `anon` lacks direct table privileges: Supabase anonymous Auth users operate under `authenticated`, and the missing/null claim case is exactly what these restrictive policies were designed to reject.

### Settlement business scope
The RC494 source adds a business scope column, backfills it from the linked journal entry, creates a lookup index, and replaces the service-role-only writer. Live Production has neither the column nor index. The existing writer reads a tenant membership role, creates journal rows, and inserts/updates settlement transactions without writing a business_id. It has no registry helper or direct private-registry check. The function's name and service-role ACL do not establish RC494 parity.

### MantiGO bid acceptance
The live function does lock the ride row, so same-ride calls serialize through that row lock. That is a positive control and is recorded as such. However, it reads the bid by ID without selecting/checking its current status, then updates the target row to ACCEPTED unconditionally. The target bid could be REJECTED/withdrawn and still be accepted while the ride is open. The unique one-accepted-per-ride index is also absent. RC496 is therefore not complete.

## Release disposition

- Keep catalog price publishing, SMM admin onboarding, anonymous Auth write/read boundaries, settlement, Storage branding and MantiGO bid acceptance **BLOCKED / NOT CERTIFIED**.
- Do not manually remove the SMM trigger or patch production ACL/policies; implement a reviewed forward repair with a recovery plan and explicit owner authorization.
- Keep the full release blocked until the complete 82-version physical-effect/alias map, dependency graph, exact-head tests, encrypted backup/restore, and coordinated DB/Edge release gates pass.
- Live migration ledger remains 310 rows through `20261110150618`.
- No Production schema, function, policy, privilege, Auth, Storage, settlement, SMM, catalog or ride data was changed.

**Production mutation:** NONE.
