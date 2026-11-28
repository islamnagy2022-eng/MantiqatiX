# DEMO Admin Compatibility Recheck — 2026-11-28

## Scope and isolation

- Repository: `islamnagy2022-eng/MantiqatiX`
- Development project: `MantiqatiX-DEMO` (`lkijdgqanbqjudiducjt`)
- Branch: `dev/demo-admin-compat-20261128`
- Production project and GitHub Pages production configuration were not changed.
- No DEMO schema, data, Auth, RLS, grants, Storage, or Edge Function mutation was performed in this checkpoint.

## Live DEMO read-back

Project status is `ACTIVE_HEALTHY` (PostgreSQL 17.11.0.003).

Migration ledger contains eight DEMO-specific versions. Edge inventory contains eight active functions:
- `demo-membership-manage`
- `demo-appointment-create`
- `demo-order-create`
- `demo-order-status-update`
- `demo-register-customer`
- `demo-business-create`
- `demo-catalog-write`
- `demo-public-catalog`
- `public-catalog`
- `public-catalog-directory`

The live schema preflight confirmed:
- Present: `private.platform_admins`, `public.user_memberships`, `public.businesses`, `public.branches`, `public.audit_logs`, `public.mnty_can_platform_admin()`.
- Missing: `public.platform_custom_roles`, `public.platform_role_assignments`, `public.business_job_positions`, `public.business_employees`, `public.bizcatalog_platform_settings`, `public.mnty_platform_has_permission(text, varchar, uuid, varchar)`, platform people/custom-role/business administration RPCs.
- Missing the null-safe user/business/branch membership uniqueness index referenced by the control-center forward repair.

## Compatibility findings

The existing source migrations RC113–RC116 contain the core role registry, employee/hiring workspace, permission resolver, people/assignment/audit RPCs, and subscriber business/membership administration. RC117 contains additional default-image behavior and must not be pulled into this first admin compatibility slice.

The `20261029041815_professional_dashboard_dependencies_forward_repair.sql` migration consolidates RC113/RC114/RC115 and later permission-ceiling corrections, but it is a large mixed migration (83 KB), has a separate dependency on the membership scope uniqueness fix, and does not create `bizcatalog_platform_settings` or the activity-module settings audit table. It is not safe to apply as a whole to DEMO without splitting and replaying its dependency graph.

The current control-center source uses `mnty_can_platform_admin()` for the platform Edge gate, while the role/employee SQL source uses the `private.platform_admins` registry. Keep those authorities aligned and test non-admin denial explicitly; never seed a platform admin by copying a production identity.

## Supabase Advisor snapshot

Security notices include:
- two RLS-enabled tables with no policies (`digital_page_payment_events`, `mantigo_payment_provider_events`); this is fail-closed and must not be "fixed" with broad policies.
- one anon-executable SECURITY DEFINER ad RPC, which appears to be the deliberately bounded public targeted-ad read contract and needs source/behavior verification, not blanket revocation.
- six authenticated-executable SECURITY DEFINER RPC warnings, requiring call-path and scope review.
- leaked-password protection disabled (managed Auth configuration task).

Performance notices include unindexed foreign keys and multiple permissive policies. These are not blockers to building the isolated admin schema but must be triaged independently; no broad policy rewrite is justified.

## Next safe implementation sequence

1. Build an additive, DEMO-only admin compatibility migration. Start with RC113/RC114/RC115/RC116 source objects, exclude RC117 image alterations, and split the null-safe membership index as an explicit prerequisite.
2. Reconcile migration dependencies and all referenced columns/types against actual DEMO schema before applying.
3. Apply migration only to DEMO. Verify RLS enabled and forced on privileged tables, no direct browser table grants, SECURITY DEFINER functions have empty search_path, anon EXECUTE is revoked, and authenticated EXECUTE is limited to guarded RPCs.
4. Create only synthetic fixture identities and demo tenant/business/branch rows. Do not copy or expose production accounts or customer data.
5. Deploy compatible `catalog-admin` and `catalog-platform-admin` bundles to DEMO only after verifying each imported dependency and secret contract. Keep `verify_jwt` and handler authentication aligned with the source.
6. Run positive and negative API tests: unauthenticated denial, non-platform-admin denial, tenant/business/branch isolation, role revocation, employee suspension, audit creation, and catalog-only scope.
7. Do not claim full admin readiness until runtime HTTP tests and the above authorization tests pass.

## Verified in this checkpoint

- [x] Repository and default branch confirmed.
- [x] Dedicated development branch created.
- [x] PR #1215 is merged.
- [x] DEMO status, migration ledger, Edge inventory, Advisor snapshot retrieved.
- [x] Exact admin object preflight run read-only against DEMO.
- [ ] Admin compatibility migration implemented and applied.
- [ ] Admin Edge Functions deployed to DEMO.
- [ ] Synthetic admin fixtures and negative authorization tests complete.

## Follow-up static ACL audit

A second static pass found an important deployment blocker in the generated migration: it defines 19 unique function names, but only 15 function names have an explicit `REVOKE ... FROM PUBLIC, anon` statement. Several mutating/permission-related RPCs are not covered by the explicit ACL statements in this migration. PostgreSQL's default function EXECUTE grant can be PUBLIC unless revoked, so counting SECURITY DEFINER functions with an empty search_path is not sufficient.

- [x] Identified ACL coverage gap in the migration source.
- [ ] Enumerate every exact function signature and define least-privilege EXECUTE grants.
- [ ] Run ACL verification in disposable PostgreSQL 17 replay.
- [ ] Do not apply this migration to DEMO until the ACL gap is closed and tests pass.

The previous static check statement in the PR description should be read as a search_path check only, not proof that function EXECUTE privileges are safe. This migration remains unapproved and unapplied.
