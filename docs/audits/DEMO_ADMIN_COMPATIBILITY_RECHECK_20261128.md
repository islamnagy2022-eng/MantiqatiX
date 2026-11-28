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

## Follow-up exact-signature ACL and root-authority audit

### Function ACL result

The first name-only scan overstated the gap. A signature-level pass found **19 CREATE/REPLACE FUNCTION occurrences and 16 distinct function signatures**; two employee RPCs are replaced later in the migration and the employee-list RPC is defined twice. Of the 16 signatures:

- **14 client-callable administrative RPCs** have exact `REVOKE ALL ... FROM PUBLIC, anon` statements followed by explicit `GRANT EXECUTE ... TO authenticated`.
- **2 internal helpers** were missing a client-side revoke:
  - `mnty_business_employee_permission_ceiling_allows(jsonb, varchar, uuid, varchar)`
  - `mnty_business_employee_permissions_subset(jsonb, jsonb)`

Both helper revokes are now appended to this DEMO migration and revoke execution from `PUBLIC`, `anon`, and `authenticated`. Neither helper is granted to a browser role. This follows the ACL contract in the original RC457 source migration. No broad schema-wide grant/revoke was introduced.

### Live DEMO root-authority mismatch

A new read-only catalog check confirms:

- `private.platform_admins` exists, is owned by `postgres`, has RLS enabled but **FORCE RLS is disabled**. No direct table grants are present for `anon` or `authenticated`; the recorded table ACL retains `service_role` access.
- The registry currently contains **0 rows**; the active `MNTY-PLATFORM` / `SUPER_ADMIN` / `scope=PLATFORM` / `full_control=true` membership count is also **0**.
- DEMO's current `mnty_can_platform_admin()` still authorizes through that legacy platform membership predicate, while the new control-center RPCs authorize through `private.platform_admins`.
- **Eight SECURITY DEFINER routines** call the legacy helper, and **five RLS policies** use it across `digital_pages`, `mantigo_financial_config`, and `mantigo_rate_limit_config`.
- Four shared helper callers have non-empty `search_path=public, pg_temp`; changing the helper alone would alter multiple RLS and RPC authorization paths without completing their hardened dependency chain.

The canonical source sequence is RC464 → RC469 → RC471 → RC484 → RC485, with its migration prerequisites and positive/negative policy and caller regression tests. This sequence must be rehearsed together against the exact DEMO baseline before deployment. Do not hot-patch the helper independently, do not manufacture a privileged identity, and do not copy a Production identity into DEMO. A verified DEMO Auth user must be provisioned through an explicitly trusted operator bootstrap after the rehearsal.

### Verification and deployment state

- [x] Exact SQL signatures enumerated.
- [x] Two missing internal-helper client revokes added to the migration source.
- [x] Live DEMO root-helper implementation, registry counts, table ACL, helper callers, and dependent RLS policies read back without mutation.
- [x] Static validation source added for RPC ACLs, internal-helper ACLs, forced RLS, and absence of a seeded platform administrator.
- [ ] Run the static validation command in a checked-out repository/CI environment.
- [ ] Replay the full migration against a disposable PostgreSQL 17 database initialized from the exact DEMO schema baseline.
- [ ] Run positive and negative authorization tests for anon, authenticated non-admin, registry-admin, tenant/business/branch boundaries, and employee permission ceilings.
- [ ] Reconcile and rehearse the ordered RC464/RC469/RC471/RC484/RC485 authority chain with dependent caller/policy tests.
- [ ] Deploy compatible admin Edge Functions to DEMO only, then run HTTP and browser smoke tests.

No migration was applied, no Edge Function was deployed, and no DEMO or Production data/configuration was mutated in this checkpoint. PR #1216 remains Draft and must not be merged or applied until the replay, authority-bootstrap, and runtime gates pass.
