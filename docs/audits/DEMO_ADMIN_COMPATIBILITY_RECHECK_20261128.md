# MantiqatiX-DEMO — Admin Control Center Delivery & Security Recheck

**Checkpoint:** 2026-11-28 12:45 UTC  
**Project:** `MantiqatiX-DEMO` — `lkijdgqanbqjudiducjt`  
**Repository:** `islamnagy2022-eng/MantiqatiX`  
**Branch:** `dev/demo-admin-compat-20261128`  
**Checked head:** `12a55ce05d3f6cbf358a95021f1360a2b30f8d1c`  
**Pull request:** [#1216 — isolated admin control-center compatibility](https://github.com/islamnagy2022-eng/MantiqatiX/pull/1216) (Draft)

## Applied migrations in DEMO

The live DEMO migration ledger contains these three applied versions. The PR also contains `20261128112652_demo_permission_helper_execute_acl.sql`; this migration passed the clean forward replay but is not recorded in the live DEMO ledger.

| Ledger version | Migration file | Purpose |
|---|---|---|
| `20261128112058` | `20261128112058_demo_platform_root_authority_convergence.sql` | Registry-backed root authority, FORCE RLS, and coordinated platform authorization/catalog protections. |
| `20261128112119` | `20261128112119_demo_admin_control_center_compatibility.sql` | Custom platform roles and assignments, people/audit/business RPCs, employee positions/employees, BizCatalog settings, guarded business deletion. |
| `20261128112653` | `20261128112653_demo_mnty_permission_helper_empty_search_path.sql` | Empty search_path on legacy `mnty_active_membership` and `mnty_can` helpers. |

Do not edit the three applied migration files.

## Migration history reconciliation — one operator action remains

Read-only inspection of the live DEMO functions confirms that the SQL effect of source migration `20261128112652` already exists:
- Both helper ACLs are exactly `{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}`.
- `PUBLIC` and `anon` do not have EXECUTE; `authenticated` does.
- Both helpers have `search_path=""`.
- The live migration ledger still does not contain version `20261128112652`.

The source migration is therefore a history-alignment item, not a missing live ACL change. No repair command has been run from this execution environment. From an authorized terminal, sign in and link the checkout to **DEMO only**, confirming the project ref before any repair:

```bash
supabase --version
supabase login
supabase link --project-ref lkijdgqanbqjudiducjt
```

For current Supabase CLI v3, database commands are local-first. Specify the hosted target explicitly, inspect the remote history, and include `--yes` for the intentional hosted history write:

```bash
supabase migration list --remote=lkijdgqanbqjudiducjt
supabase migration repair 20261128112652 --status applied --remote=lkijdgqanbqjudiducjt --yes
supabase migration list --remote=lkijdgqanbqjudiducjt
```

For the repository-pinned Supabase CLI v2.122.0, use the linked-target form instead:

```bash
supabase migration list --linked
supabase migration repair 20261128112652 --status applied --linked
supabase migration list --linked
```

Proceed only after confirming the project is exactly `lkijdgqanbqjudiducjt`, the version is absent before repair, and the ACL effects described above remain present. The repair inserts the missing migration-history record; it does **not** execute the migration SQL. Afterward, verify that remote history contains `20261128112652` and still contains `20261128112653`. Do not use `db push`, `migration up`, `db reset`, or direct SQL writes to `supabase_migrations.schema_migrations` for this reconciliation. Never run the repair against Production. The v3 remote-target and confirmation behavior is described in the [CLI v2-to-v3 migration guide](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3); the [migration repair CLI reference](https://supabase.com/docs/reference/cli/supabase-migration-repair) confirms the command records history as applied without executing SQL.

## Verified DEMO schema and authorization state

Read-after-apply and current read-only checks confirm:
- `mnty_can_platform_admin()` and `is_platform_admin()` consult `private.platform_admins`.
- `private.platform_admins` has RLS and FORCE RLS enabled; browser roles cannot read the registry directly.
- The registry row count remains **0**; no identity was promoted.
- The two legacy helpers have no PUBLIC/anon EXECUTE, retain authenticated EXECUTE, and have empty search_path.
- The four admin/employee tables (`platform_custom_roles`, `platform_role_assignments`, `business_job_positions`, `business_employees`) remain fail-closed with RLS enabled and no browser table grants.
- `bizcatalog_platform_settings` is service-role-only with RLS.
- `mnty_platform_admin_delete_business(text,uuid,uuid)` remains SECURITY INVOKER, has empty search_path, and is service_role-only; it protects historical records and writes an audit event.
- Employee RPC permission ceilings and override-subset checks remain preserved.

## Edge Function deployment

`catalog-platform-admin` is deployed to MantiqatiX-DEMO only:
- Status: ACTIVE; version: 1.
- Gateway `verify_jwt=false` permits CORS OPTIONS to reach the handler.
- The handler performs its own Bearer-token validation, Auth user validation, rejects anonymous users, and checks `mnty_can_platform_admin()` before platform actions.
- Shared activity-module sanitization and subscriber-membership deduplication modules are included.
- A fresh read-back compared the deployed `index.ts` content with branch source `supabase/functions/catalog-platform-admin/index.ts`: the contents match byte-for-byte (68,536 characters); both shared modules are present in the deployed bundle. This establishes DEMO Edge source parity for this function, not HTTP behavior.

Direct live-origin smoke tests remain incomplete. Attempts against both the GitHub Pages catalog URL and the DEMO Supabase Edge URL failed before establishing an HTTP connection because this execution environment could not resolve the hostnames (`curl: (6) Could not resolve host`). Requests did not reach GitHub Pages or the Edge Function; do not treat CORS, unauthenticated rejection, or page rendering as network-verified.

## Operator bootstrap still required

The platform-admin registry contains zero identities. No privileged user is seeded automatically. An authorized project operator must select and confirm a separate Auth account inside DEMO, verify its confirmed email and exact Auth UUID, then follow [the bootstrap runbook](../runbooks/DEMO_PLATFORM_ADMIN_BOOTSTRAP_20261128.md). Never copy a Production identity, session, or credential into DEMO.

Until that explicit operator action is completed, the admin UI correctly denies platform-root access. A tenant OWNER, ADMIN, or SUPER_ADMIN membership is not a substitute for the protected platform registry.

## Deliberately disabled function

The activity-module override editor remains fail-closed at the server boundary. A direct `activityModuleOverrides` write returns HTTP 409 (`ACTIVITY_MODULE_SETTINGS_NOT_READY`) until settings persistence and audit insertion can be committed atomically. This is intentional.

## PostgreSQL rehearsal and latest CI evidence

The exact DEMO-schema transaction rehearsal passed and was rolled back; a read-after-rollback confirmed no rehearsal schema or data remained. It covered registry-only root behavior, tenant ADMIN/SUPER_ADMIN denial, admin RPC ACLs, internal helper denial, FORCE RLS, policy inventory, RC472 index preflight, BizCatalog service-role settings/history-protected deletion, employee RBAC and RC457 ceilings, and RC485/RC486/RC925 catalog contracts.

On checked head `12a55ce05d3f6cbf358a95021f1360a2b30f8d1c`: 
- The full chronological PostgreSQL 17 forward migration replay passed: workflow run `46143565888`.
- Migration uniqueness, migration-history immutability, collision guard, module boundaries, consent, audit atomicity, payment atomicity, and platform contract checks passed.
- Primary catalog frontend validation and Module Professionalization validation passed.
- The Pages workflow validation passed; the deployed-origin redirect regression passed all 3 checks on the already-published GitHub Pages origin.
- The V6 preview browser E2E passed in the isolated composed build, including desktop/mobile pagination (20 initial / 25 total), directory search, activity/specialty filter, image loading, and accessibility scan with 0 critical violations.
- Production smoke checks in CI passed for Google OAuth initiation, selected existing Edge Function CORS preflights, the public targeted-ads RPC (4 sanitized rows), and the public directory/Qadam response (10 businesses / 15 Qadam items). These tests do not exercise `catalog-platform-admin` on DEMO.
- The PR Pages `deploy` job was **skipped** because this is a pull-request branch. The redirect test only checked the already-deployed origin; no GitHub Pages publication was performed from this Draft PR.

## Production release gate — still BLOCKED

The same production verification report explicitly returns `PRODUCTION_GATE=BLOCKED`; only the scoped catalog pilot gate passes. The blockers include:
- The required release migration ledger check reports 89 expected versions and 0 recorded in the live Production ledger.
- Payment/finance end-to-end readiness is not verified; several required database columns, processors, provider binding, and journal ACL contracts are absent or incomplete.
- Backup/restore is not verified: no full Production database/Storage export, off-site restore, measured RPO/RTO, or rollback rehearsal was evidenced.
- Multiple high-impact deployed Edge Functions still differ from source and require coordinated DB-contract review before any deployment.
- SMM parity remains partial/deferred.
- Auth security settings remain unverified; leaked-password protection is disabled and anonymous Auth sign-ins require an owner decision.

Passing CI is not Production release approval. Do not merge or deploy the full platform until these Production blockers are reconciled and reverified. The catalog pilot scope must remain separate from financial, payments, SMM, and MantiGO deployment scope.

## Current security advisor findings in DEMO

Latest read of the Supabase Security Advisor reports:
- 6 RLS-enabled tables without policies: the four admin/employee tables above plus the pre-existing `digital_page_payment_events` and `mantigo_payment_provider_events`. Direct browser grants remain denied.
- 1 anon-executable SECURITY DEFINER function: `get_mnty_targeted_advertisements`, the intentionally public targeted-advertising endpoint. Keep its input/output contract under review.
- 36 authenticated-executable SECURITY DEFINER functions. These require continued targeted review of their own authorization checks; do not indiscriminately remove required user RPC grants.
- Performance Advisor baseline findings remain outside this scoped change.

## Environment boundaries and remaining closure items

- Only the three listed migrations and the `catalog-platform-admin` Edge Function changes were applied to MantiqatiX-DEMO; no Production schema/data/Auth/Edge Function was changed.
- The ACL helper preflight migration `20261128112652` is in source and passed chronological replay; its live DEMO history record remains to be repaired with Supabase CLI as documented above.
- No GitHub Pages production publication occurred from this Draft PR.
- No Auth identity or platform-admin registry row was created.
- PR #1216 remains Draft. Remaining work: reconcile the single DEMO migration-history entry, perform direct DEMO HTTP/CORS/auth smoke tests from a network that can reach Supabase, obtain explicit approval for a DEMO-only platform-admin identity, and close the separate Production release blockers before any full release.