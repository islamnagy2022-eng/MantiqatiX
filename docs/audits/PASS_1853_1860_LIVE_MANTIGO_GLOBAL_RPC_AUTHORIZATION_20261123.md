# Pass 1853–1860 — Live MantiGO global RPC authorization recheck — 2026-11-23

## Live Production evidence (read-only)
- [x] 1853 — Retrieved live definitions for the four global MantiGO RPCs. All are `SECURITY DEFINER`, executable by `authenticated`, not executable by `anon`, and still pin `search_path=public`.
- [x] 1854 — `get_mantigo_admin_dashboard_backend(uuid)` accepts any active membership role from `ADMIN`, `SUPER_ADMIN`, `OWNER`, `BUSINESS_OWNER`, `MANAGER`, `OPERATIONS`, or `OPERATIONS_MANAGER` after binding supplied actor ID to `auth.uid()`. It returns platform-wide ride counts and financial aggregates without tenant scope.
- [x] 1855 — `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)` uses a similarly broad active-membership role check and aggregates the platform-wide MantiGO financial ledger. Live definition also retains legacy column names `amount` and `captain_amount`, while live ledger canonical fields are `gross_amount`, `commission_amount`, `captain_net_amount`; the report path is not certified functional.
- [x] 1856 — `settle_mantigo_captain_backend(uuid,text,text)` and `expire_stale_mantigo_rides_backend(uuid,integer)` remain `SECURITY DEFINER` functions executable by `authenticated`; prior source/live reviews document broad tenant-role authorization for platform-wide mutation. Do not invoke them during this audit.
- [x] 1857 — Fresh aggregate-only membership check: 5 distinct users currently have active memberships in the role set accepted by the legacy global RPC predicates; 4 of those users are not present in `private.platform_admins`. No user identifiers or row-level personal data were selected.
- [x] 1858 — Confirmed all four functions deny `anon EXECUTE` but grant `authenticated EXECUTE`; anonymous grant removal alone would not close the authorization issue.
- [x] 1859 — Inspected current-main RC471 forward migration source. It replaces dashboard, financial report, settlement and expiration RPCs with strict `mnty_can_platform_admin()` checks, empty `search_path`, canonical financial columns and transactional preflight. RC464 contains an earlier coordinated registry-backed replacement and validates shared helper callers.
- [x] 1860 — Confirmed live migration ledger still ends at `20261110150618`; the newer registry/forward migrations are not applied. Current source fix is not a live Production fix.

## Release disposition
- **P0:** Four global MantiGO RPCs remain accessible to authenticated users with broad tenant roles; 4 active users currently meet the legacy role predicate without platform-registry membership. This is a concrete cross-tenant/platform-scope exposure and mutation risk. No RPC was invoked.
- The current-main source already contains RC464/RC471 corrections and adversarial tests; the blocker is source-to-Production migration parity and coordinated migration ordering, not a need to create another duplicate migration.
- Do not apply RC464 or RC471 alone, do not fabricate migration ledger rows, and do not hot-edit individual RPCs in Production. Reconcile the exact migration chain in isolated PostgreSQL 17, verify all dependencies and the full 57-policy platform-admin blast radius, then use the controlled release process.
- No Production DDL/DML, migration, Auth/RLS/GRANT, Storage, Edge deployment, payment, wallet, settlement, ride mutation, or personal-data write occurred.
- **Full Production remains BLOCKED / NOT CERTIFIED.**

## Source references
- `supabase/migrations/20261113214500_rc464_platform_admin_live_registry_hardening.sql`
- `supabase/migrations/20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql`
- `supabase/migrations/20261119040000_rc484_registry_backed_is_platform_admin.sql`
- `scripts/validate-rc464-platform-admin-live-hardening.mjs`
- `scripts/validate-mantigo-high-risk-definers.mjs`
- Earlier scope audit: `docs/audits/PLATFORM_ADMIN_LIVE_AUTHORIZATION_GAP_20261113.md`
