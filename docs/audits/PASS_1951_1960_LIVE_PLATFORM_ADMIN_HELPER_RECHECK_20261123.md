# Pass 1951–1960 — Live platform-admin helper and RLS blast-radius recheck — 2026-11-23

## Live Production evidence (read-only)
- [x] 1951 — Re-read live `public.mnty_can_platform_admin()`: SECURITY DEFINER, `search_path=public, pg_temp`, authenticated EXECUTE true, anon EXECUTE false. Its body delegates to `public.mnty_can('admin',NULL,NULL,NULL)`; it does not query `private.platform_admins`.
- [x] 1952 — Re-read live `mnty_can(text,tenant,business,branch)`: SECURITY DEFINER, `search_path=public, pg_temp`, authenticated EXECUTE true, anon EXECUTE false. Its global SUPER_ADMIN path accepts membership permission JSON with `scope=PLATFORM` and `full_control=true`; null tenant/business/branch makes the helper a global scope check.
- [x] 1953 — Re-read live `mnty_active_membership(...)`: SECURITY DEFINER, `search_path=public, pg_temp`, authenticated EXECUTE true; selects active rows for `auth.uid()` and permits null scope parameters.
- [x] 1954 — Re-read live `public.is_platform_admin()`: SECURITY INVOKER SQL function, `search_path=public`, authenticated EXECUTE true, anon EXECUTE false. Its body grants true for any active membership role ADMIN or SUPER_ADMIN, without a private-registry check.
- [x] 1955 — Exact live RLS policy counts: 57 policies across 24 tables still reference `is_platform_admin()`; 5 policies across 3 tables reference `mnty_can_platform_admin()`.
- [x] 1956 — Current-main RC464 replaces `mnty_can_platform_admin()` with a registry-only `private.platform_admins` check and coordinates four global MantiGO RPCs plus dependent policy preflights. RC484 replaces `is_platform_admin()` with a registry-only check and preflights the 57-policy/24-table blast radius.
- [x] 1957 — Confirmed the live helper definitions remain the legacy bodies; RC464 and RC484 are source migrations, not live fixes. Live migration ledger still ends at `20261110150618`.
- [x] 1958 — Broader catalog: 149 public SECURITY DEFINER functions; 65 executable by authenticated, 1 executable by anon; 120 have `public` in their configured search_path, 29 have another explicit path, 0 are missing an explicit search_path. Search-path presence alone does not certify each function's authorization or object qualification.
- [x] 1959 — Reconfirmed no broad grant revocation is appropriate: only one anon-callable function is the previously reviewed bounded targeted-ad public read; 65 authenticated-callable functions require per-function review rather than blanket changes.
- [x] 1960 — No SQL mutation, migration, GRANT, RLS policy, user membership, registry row, Auth setting or Edge deployment occurred.

## Release disposition
**P0 authorization blocker remains open.** Both live global helper paths still derive platform authority from tenant membership rather than the protected platform-admin registry. This affects at least 62 policies across 27 tables plus global RPC callers. Do not deploy an Edge function that expects registry-only semantics until RC464/RC484 and all dependent callers/policies are released as one reconciled chain.

Required sequence:
1. Exact statement/effect reconciliation for the 310-row live migration history and the 76-version release contract.
2. Rehearse RC464 + RC484 and all dependent forward migrations in isolated PostgreSQL 17 using a true schema/data restore.
3. Adversarial tests: registry root positive; tenant SUPER_ADMIN with platform-looking permission JSON negative; tenant ADMIN/OWNER/MANAGER negative; inactive membership negative; anonymous Auth negative; all 57 legacy and 5 shared-helper policy paths.
4. Coordinated database + Edge release, then read-only verification of live helper definitions and policy inventory.

**Production remains BLOCKED / NOT CERTIFIED.** No Production changes.
