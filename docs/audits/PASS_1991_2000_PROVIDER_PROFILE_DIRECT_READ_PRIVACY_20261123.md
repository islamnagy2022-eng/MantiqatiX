# Pass 1991–2000 — Live provider-profile direct-read privacy boundary — 2026-11-23

## Live Production evidence (read-only)
- [x] 1991 — `public.marketing_provider_profiles` has RLS and FORCE RLS enabled, but direct table SELECT is granted to both `anon` and `authenticated`; authenticated also has INSERT/UPDATE/DELETE table grants.
- [x] 1992 — Live policy `Public can view active marketing providers` is permissive SELECT for roles `anon,authenticated` with predicate only `status='ACTIVE'`. It does not require a confirmed Auth identity, owner consent, tenant, business or platform-registry membership.
- [x] 1993 — Live policy `CRM managers view marketing providers` is permissive SELECT for authenticated and checks only whether the caller has any ACTIVE membership in SUPER_ADMIN/ADMIN/OWNER/MANAGER/BUSINESS_OWNER. It has no tenant/business join or scope predicate.
- [x] 1994 — Live owner ALL policy does explicitly reject `is_anonymous=true` and binds `owner_user_id=auth.uid()`; this protects owner DML but does not restrict the two permissive SELECT policies.
- [x] 1995 — Table contains 19 columns, including `owner_user_id`, `settings`, `profile_image_path`, specialties, service areas and portfolio. No row values were selected. RLS is row-level and does not hide sensitive columns from a row that a SELECT policy exposes.
- [x] 1996 — Anonymous Auth user count is currently zero, but anonymous sign-ins are enabled according to Security Advisor. A future anonymous Auth session uses Postgres role `authenticated` and is covered by the public-active policy.
- [x] 1997 — Current-main RC479 only revokes direct SELECT from `anon`; it intentionally preserves authenticated SELECT. It does not remove the public-active authenticated path or add a restrictive anonymous-session SELECT guard.
- [x] 1998 — Current-main RC444/RC452 source contains tenant/business-scoped CRM policies, but the live CRM policy is still the older unscoped role-only version. RC452's source platform-root branch still uses direct `MNTY-PLATFORM` membership metadata rather than the private registry; it requires further registry-bound forward hardening.
- [x] 1999 — Curated public catalog Edge functions are the intended public discovery boundary. Do not expose the base profile table directly; verify owner/admin workflows through narrow backend projections before removing authenticated direct SELECT.
- [x] 2000 — No provider profile row, owner identifier, settings value, contact field or customer data was read. No grant, policy, Auth setting, migration or Edge Function was changed.

## Required fix (source-only until release)
1. Add a forward-only migration that removes direct public/anonymous base-table SELECT and replaces the broad CRM read policy with exact tenant/business scope and registry-only platform-root authority.
2. Preserve owner management through an explicit owner-scoped backend/RPC path; do not blindly revoke authenticated SELECT until current frontend dependencies are moved and tested.
3. Add restrictive `is_anonymous=false` protection for any authenticated-only read path that remains.
4. Keep public discovery through `public-catalog` / `public-catalog-directory` curated field allowlists only.
5. Add PostgreSQL 17 adversarial tests: anon role, anonymous Auth JWT, confirmed unrelated customer, tenant manager from another tenant, same-tenant manager, owner, registry platform admin, inactive member, revoked consent.
6. Reconcile migration ordering and run a full independent restore/replay before Production release.

**P0 privacy/tenant-boundary blocker remains OPEN.** Full Production remains **BLOCKED / NOT CERTIFIED**. No Production changes.
