# Pass 1480–1489 — RC479 anonymous Auth-session residual read

**Date:** 2026-11-20  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Scope:** read-only live ACL/RLS inspection plus disposable PostgreSQL test-contract implementation.  
**Disposition:** source-level residual authorization gap confirmed; no Production change.

## 1. Live Production evidence

The current live `public.marketing_provider_profiles` contract is:

- `anon` has table-level SELECT before RC479 rollout.
- `authenticated` retains table-level SELECT.
- The policy `Public can view active marketing providers` targets both `anon` and `authenticated` and uses only `status='ACTIVE'`.
- The table has 19 columns, including `owner_user_id` and `settings`; effective anon column SELECT was confirmed for all 19 before RC479 is applied.
- The RC479 source migration contains only `REVOKE SELECT ON TABLE public.marketing_provider_profiles FROM anon;`. It does not add an `is_anonymous` restrictive SELECT policy.
- The live `Owners manage their marketing provider profile` ALL policy already requires `is_anonymous <> true` and `auth.uid() = owner_user_id` in both USING and WITH CHECK. The remaining gap is the public-active SELECT policy, not owner DML.
- RC479's current integration test simulates `SET ROLE anon` and verifies raw-anon denial. It does not simulate an anonymous Auth JWT where the database role is `authenticated` and the JWT has `is_anonymous=true`.

Supabase anonymous Auth sessions use the `authenticated` database role. Therefore, if anonymous Auth sessions are permitted by project Auth configuration, they still satisfy the existing active-provider SELECT policy and retain the `authenticated` table grant. That path can read active profile rows and private columns such as `owner_user_id` and `settings` despite the raw-`anon` RC479 revoke.

The current reconciliation snapshot reports zero existing anonymous Auth users, but this does not prove anonymous sign-in is disabled or remove the policy path. No profile values or application rows were selected in this review.

## 2. Existing source/test gap

The historical RC479 migration must remain immutable and single-purpose. Its raw-anon privilege test is useful but incomplete for anonymous Auth sessions.

The current public catalog's curated Edge Functions use explicit public projections, but that does not close direct PostgREST access for an anonymous Auth session with the `authenticated` role.

## 3. Disposable regression contract added

Added `supabase/tests/rc479_anonymous_auth_session_boundary_integration.sql` and a dedicated workflow.

The disposable test sequence:

1. Applies the existing synthetic provider-profile fixture and RC479 revoke.
2. Runs the existing raw-`anon` integration test.
3. Simulates an anonymous Auth JWT using role `authenticated` and `is_anonymous=true`.
4. Reproduces the residual read of synthetic active profile `owner_user_id`/`settings` columns (only counts are asserted; values are never printed).
5. Applies a clearly labelled **test-only restrictive policy overlay** denying anonymous Auth sessions.
6. Verifies anonymous Auth sessions see zero rows after the overlay.
7. Verifies confirmed authenticated users still read the intended active public profile.

The overlay is a test contract only. It is not a Production migration and must never be applied to Production. The actual forward-only migration still needs to be generated with Supabase CLI in an authorized CLI-enabled source workspace and tested against the exact chronological chain.

## 4. Required production correction

- Add a forward-only **RESTRICTIVE FOR SELECT** policy for `authenticated` sessions requiring `coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false` in USING. Keep the existing owner ALL policy and its DML checks unchanged.
- Preserve the existing active-profile public SELECT behavior for confirmed authenticated users and curated public Edge projections.
- Preserve the existing owner-scoped ALL policy for insert/update/delete; it already rejects anonymous JWTs and binds `auth.uid()` to `owner_user_id`. Verify owner CRUD in the forward-migration regression.
- Add adversarial tests for raw anon, anonymous Auth, confirmed authenticated, wrong-owner, and service-role/Edge projection behavior.
- Re-run the complete chronological migration replay and full Edge/source contract before coordinated release.

Do not revoke SELECT from `authenticated` wholesale: the owner/provider workflow still relies on authenticated table access. Do not change the historical RC479 migration.

## 5. Verification and non-actions

- Read-only live grants and `pg_policies` inspected.
- No live anonymous Auth token created or used.
- No provider profile values or application rows selected.
- No Production DDL/DML, grants, RLS, Auth, Storage, Edge, payment, or deployment mutation.
- No Supabase migration filename invented; CLI is not installed in the current execution container.

**Result:** RC479 raw-anon boundary is incomplete for anonymous Auth sessions. Disposable reproduction and target-behavior test source are prepared; actual forward migration and exact-head CI are pending. Production remains **BLOCKED / NOT CERTIFIED**.


## 6. Scope limitation — confirmed authenticated base-table reads

This correction only addresses anonymous Auth sessions. The current RC479 compatibility contract intentionally preserves `authenticated` table SELECT and the public-active policy, so confirmed authenticated users still have direct SELECT to the full table projection, including `owner_user_id` and `settings`. The existing RC479 integration explicitly expects authenticated active-profile reads to continue.

If the product intends those columns to be private from ordinary confirmed users too, that requires a separate data-minimization decision: for example, revoke direct base-table SELECT from ordinary authenticated users, retain narrowly scoped owner/CRM access, and keep public discovery on curated Edge projections. Do not silently change that contract in this anonymous-session fix.


## 7. Disposable CI verification — 2026-11-20

The new regression passed in GitHub Actions:

- Dedicated RC479 anonymous Auth session workflow **44794969322** — job `rc479-anonymous-auth-postgres`: **SUCCESS**. Static contract validation, PostgreSQL 16 baseline reproduction, RC479 raw-anon integration, and test-only restrictive SELECT overlay all completed successfully.
- Combined existing RC464 workflow **44794969419** — `rc464-platform-admin-postgres`: **SUCCESS**; `rc479-anonymous-auth-postgres`: **SUCCESS**.
- The tested code head was `77e782e651f0c73f4481d50495f06a55dd7260da`. The later `aff22504149e562686ec85800994acb91fa5072e` commit changed only this audit's scope-limitation documentation; no test or workflow source changed after the passing run.
- Local Node syntax/static contract check also passed.

These are disposable tests only. They do not apply a Production migration or prove live anonymous sign-in configuration. The actual forward-only SELECT guard migration remains pending Supabase CLI generation and chronological replay.
