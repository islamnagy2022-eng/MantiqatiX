# Professional Dashboard — Controlled Production Rollout Runbook

**Status: PREPARED ONLY — NOT AUTHORIZED/APPLIED TO PRODUCTION**

## Verified state (2026-10-29)

- Dashboard source is merged to `main` at `bbd8e6f5c881f3b4744d5e783bb52874406c7600`.
- [Primary Catalog Frontend Validation](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40814976708) passed TypeScript/build, Chromium dashboard E2E, and isolated PostgreSQL employee RBAC integration.
- [Main deployment workflow](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40814976763) failed closed before publish because the live dependency check failed. No production migration or schema/data write occurred.
- Read-only Supabase recheck at `2026-10-29T04:04:51Z` found all 11 required dashboard objects absent. The live migration ledger has 303 entries and latest version `20261028112112`; the user/business/branch duplicate-scope preflight found 0 duplicate groups.
- The broader production gate remains `BLOCKED / NOT CERTIFIED`: 41 required source versions are unreconciled, migration aliases need controlled repair, and unrelated payment/finance/Edge Function/backup-restore gaps remain.

## Exact source files related to the dashboard dependency gate

1. `20261027030000_rc113_super_admin_control_center_foundation.sql` — platform custom roles and role assignments.
2. `20261027040000_rc114_business_employee_hiring_system.sql` — business positions and employee records.
3. `20261027050000_rc115_control_center_integration.sql` — permission resolver and control-center/employee RPC integration.
4. `20261027090000_rc113_user_membership_business_scope_idempotency.sql` — null-safe user/business/branch uniqueness. The latest read-only preflight found zero duplicate groups, but still repeat the check immediately before rollout.
5. `20261028225000_rc457_business_employee_permission_ceiling.sql` — branch-aware roster RPC and permission-ceiling enforcement.

RC116/RC117 and other missing release versions are not silently included in this dashboard-only dependency list. They remain part of broader release reconciliation and require their own scope decision.

## Required sequence before any production write

1. **Freeze and inventory.** Capture the current production migration ledger, exact object inventory, current function definitions for any same-signature functions, relevant table columns/constraints/indexes, grants, RLS flags/policies, and active membership counts. Compare each result to the exact source migration and the existing `docs/release/production-migration-reconciliation.json`.
2. **Reconcile the 41-version drift first.** The dashboard source migration timestamps precede the current live ledger tip. Determine, migration by migration, whether an effect is absent, already present under a different recorded version, or a verified exact alias. Do not infer “not applied” from the ledger alone, and do not infer “applied” from a similar object name.
3. **Backup and rehearsal.** Obtain a restorable backup and document recovery owner, recovery point, rollback criteria, and maintenance window. Rehearse the exact proposed order on a disposable database restored from a current production schema/data checkpoint, not only from the older `20261008222845` checkpoint.
4. **Preflight the membership index.** Re-run the duplicate query for `(user_id, business_id, coalesce(branch_id,''))`. If duplicates exist, stop and resolve them through an approved, audited plan; do not delete or merge memberships automatically.
5. **Apply only through the approved migration workflow.** Preserve source migration version identity and chronological/dependency order. Do not run the SQL through an ad-hoc RPC that records a new unrelated migration version. Do not use `migration repair --status applied` unless the exact effect is already present and verified; ledger repair is not a substitute for running missing SQL.
6. **Post-migration read-only verification.** Confirm all 11 required tables/functions, exact function signatures and definitions, `SECURITY DEFINER` search paths, grants/revokes, RLS enabled/forced on employee tables, indexes/constraints, and membership/branch isolation. Update the dependency manifest only from those fresh results.
7. **Re-run behavioral tests.** Run employee RBAC/permission-ceiling tests, tenant/business/branch isolation, anonymous/unauthorized denial, and the browser suite against a staging deployment using real authenticated test identities.
8. **Retry the guarded main deployment.** The main workflow must pass the live dependency gate naturally. Do not disable the guard, fake manifest evidence, publish an artifact manually, or claim deployment from a successful build alone.
9. **Post-deploy verification.** Confirm the dashboard on the authenticated production origin, test mobile/tablet and keyboard accessibility, verify old catalog/storefront routes, and test QR/permanent links.

## Read-only verification query (after rollout)

Use this to check the named objects without changing production:

```sql
with required_objects(name, kind) as (
  values
    ('public.platform_custom_roles','relation'),
    ('public.platform_role_assignments','relation'),
    ('public.business_job_positions','relation'),
    ('public.business_employees','relation'),
    ('public.mnty_platform_has_permission','function'),
    ('public.mnty_business_employee_list','function'),
    ('public.mnty_business_employee_list_scoped','function'),
    ('public.mnty_business_employee_position_upsert','function'),
    ('public.mnty_business_employee_upsert','function'),
    ('public.mnty_business_employee_permission_ceiling_allows','function'),
    ('public.mnty_business_employee_permissions_subset','function')
)
select name, kind,
  case when kind='relation' then to_regclass(name) is not null
       when kind='function' then exists (
         select 1 from pg_proc p
         join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname=split_part(name,'.',2)
       )
       else false end as exists_now
from required_objects
order by name;
```

This presence check is necessary but not sufficient: verify exact function definitions, privileges, RLS, and the exact migration ledger separately.

## Stop conditions

Stop without deploying if the source/ledger mapping is ambiguous, the backup cannot be restored, the membership preflight fails, any required signature/privilege differs from source, or any tenant/branch test fails. The overall platform gate remains `BLOCKED / NOT CERTIFIED` until all release blockers have independent evidence.
