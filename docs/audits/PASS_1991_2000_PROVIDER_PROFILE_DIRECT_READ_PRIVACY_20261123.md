# Pass 1991–2000 — Live provider-profile direct-read privacy boundary — 2026-11-23

## Live Production evidence (read-only)
- [x] 1991 — `public.marketing_provider_profiles` has RLS and FORCE RLS enabled, but direct table SELECT is granted to both `anon` and `authenticated`; authenticated also has INSERT/UPDATE/DELETE table grants.
- [x] 1992 — Live policy `Public can view active marketing providers` is permissive SELECT for roles `anon,authenticated` with predicate only `status='ACTIVE'`. It does not require a confirmed Auth identity, owner consent, tenant, business or platform-registry membership.
- [x] 1993 — Live policy `CRM managers view marketing providers` is permissive SELECT for authenticated and checks only whether the caller has any ACTIVE membership in SUPER_ADMIN/ADMIN/OWNER/MANAGER/BUSINESS_OWNER. It has no tenant/business join or scope predicate.
- [x] 1994 — Live owner ALL policy does explicitly reject `is_anonymous=true` and binds `owner_user_id=auth.uid()`; this protects owner DML but does not restrict the two permissive SELECT policies.
- [x] 1995 — Table contains 19 columns, including `owner_user_id`, `settings`, `profile_image_path`, specialties, service areas and portfolio. No row values were selected. RLS is row-level and does not hide sensitive columns from a row that a SELECT policy exposes.
- [x] 1996 — Anonymous Auth user count is currently zero, but anonymous sign-ins are enabled according to Security Advisor. A future anonymous Auth session uses Postgres role `authenticated` and is covered by the public-active policy.
- [x] 1997 — Current main has two RC479 migrations: `20261118190000_rc479_revoke_anon_provider_profile_base_read.sql` revokes raw anon SELECT; `20261120193000_rc479_restrict_anonymous_auth_provider_profile_select.sql` adds a RESTRICTIVE SELECT predicate requiring `is_anonymous=false` for authenticated JWTs. Neither migration is applied live; the live policy list still has only the three legacy permissive policies.
- [x] 1998 — Current-main RC444/RC452 source contains tenant/business-scoped CRM policies, but the live CRM policy is still the older unscoped role-only version. RC452's source platform-root branch still uses direct `MNTY-PLATFORM` membership metadata rather than the private registry; it requires further registry-bound forward hardening.
- [x] 1999 — Curated public catalog Edge functions are the intended public discovery boundary. Do not expose the base profile table directly; verify owner/admin workflows through narrow backend projections before removing authenticated direct SELECT.
- [x] 2000 — No provider profile row, owner identifier, settings value, contact field or customer data was read. No grant, policy, Auth setting, migration or Edge Function was changed.

## Required fix (source-only until release)
1. Apply the existing two RC479 migrations only through the reconciled release chain; verify raw anon and anonymous Auth JWT reads are denied.
2. Add a separate forward-only fix for confirmed-authenticated direct base-table reads: the current RC479 forward repair deliberately preserves confirmed-user SELECT, so the permissive public-active policy still exposes every column to any confirmed user. Move public discovery to curated Edge projections and preserve owner reads through a narrow owner-scoped backend path.
3. Replace the live unscoped CRM manager policy with tenant/business scope and registry-only platform-root authority; RC452 source tenant scope is not live and its platform-root predicate still uses membership metadata.
4. Keep public discovery through `public-catalog` / `public-catalog-directory` curated field allowlists only.
5. Add PostgreSQL 17 adversarial tests: anon role, anonymous Auth JWT, confirmed unrelated customer, tenant manager from another tenant, same-tenant manager, owner, registry platform admin, inactive member, revoked consent, and column-level access.
6. Reconcile migration ordering and run a full independent restore/replay before Production release.

**P0 privacy/tenant-boundary blocker remains OPEN.** Full Production remains **BLOCKED / NOT CERTIFIED**. No Production changes.
