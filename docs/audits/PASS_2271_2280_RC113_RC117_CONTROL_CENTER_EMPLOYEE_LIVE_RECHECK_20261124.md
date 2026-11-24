# PASS 2271–2280 — RC113–RC117 control-center, employee and default-image live recheck

**Checkpoint:** 2026-11-24
**Production:** MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu
**Mode:** Source review plus read-only PostgreSQL catalog, policy, RLS, index, function owner/search_path and effective ACL queries. No business rows, user data, secrets or financial payloads were read. No Production writes.

## Migration-by-migration result

| Source migration | Expected effect | Current live read-back | Disposition |
|---|---|---|---|
| RC113 — control-center foundation (20261027030000) | platform_custom_roles, platform_role_assignments, two indexes, three registry-backed admin RPCs | Both tables present with RLS and FORCE RLS; zero policies and no direct anon/authenticated table grants. Both indexes present/valid. Three admin RPCs are SECURITY DEFINER, empty search_path, anon EXECUTE=false/authenticated=true and read private.platform_admins. | **PARTIAL / BLOCKED** — RC113's later NULL-safe membership index is absent. |
| RC114 — business employee hiring system (20261027040000) | business_employees, business_job_positions, four indexes and employee list/upsert RPCs | Both tables present with RLS+FORCE; zero policies and no direct anon/authenticated table grants. Four indexes present/valid. Three employee RPCs are SECURITY DEFINER, empty search_path, anon EXECUTE=false/authenticated=true. | **PASS for sampled schema/ACL contract** — behavior and tenant/branch runtime matrix remain separate. |
| RC115 — control-center integration (20261027050000) | scoped permission resolver, audit/people/role-assignment listings and employee list | Expected sampled functions exist as SECURITY DEFINER, empty search_path, anon EXECUTE=false/authenticated=true; global admin functions directly read private.platform_admins. | **PASS for sampled metadata contract** — caller matrix and data-scope behavior still require separate tests. |
| RC116 — business subscriber administration (20261027060000) | list/manage business and membership admin RPCs | Three expected RPCs exist as SECURITY DEFINER, empty search_path, anon EXECUTE=false/authenticated=true and direct private.platform_admins checks. | **PASS for sampled metadata contract** — runtime mutation and audit behavior remain separate. |
| RC117 — default images and activity admin (20261027070000) | five default-image columns, three triggers, mnty_default_image_url() and image-aware activity/service administration | Five expected columns absent; three triggers absent; default-image helper absent. | **BLOCKED — default-image automation is not installed.** |
| RC113 forward idempotency repair (20261027090000) | unique NULL-safe index ux_user_memberships_user_business_branch_nullsafe | Index absent in live Production. | **BLOCKED — business-wide membership idempotency invariant is not installed.** |

## Security interpretation

- RC113 custom-role tables are protected by RLS+FORCE with no direct client table grants; API access is through narrowly granted SECURITY DEFINER RPCs with empty search_path. The global-admin RPCs read the protected private registry directly rather than trusting tenant role labels.
- RC114 employee tables are similarly closed to direct client table grants and expose the expected scoped RPC surface. The presence/ACL check does not substitute for tenant/business/branch adversarial tests.
- RC115/RC116 global administration RPCs are on empty search_path and check private.platform_admins. This is narrower than the legacy is_platform_admin() helper, which remains separately blocked for other policy/caller paths.
- RC117's default-image helper/columns/triggers are absent; do not claim the default-image automation is deployed from source alone.
- The RC113 NULL-safe membership index is absent; duplicate preflight and idempotency behavior remain unverified in Production.

## Release disposition

- RC113 foundation and RC114–RC116 sampled metadata contracts are present; do not overstate this as complete functional certification.
- RC113 forward idempotency repair and RC117 default-image automation remain blocked.
- The live migration ledger remains 310 rows through 20261110150618; exact source-version identity gaps still require full per-effect mapping.
- No Production DDL/DML, ACL, RLS, Auth, Storage, Edge, payment or business-data mutation occurred.

**Production mutation:** NONE.