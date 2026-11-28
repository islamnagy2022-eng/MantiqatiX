# DEMO Admin Compatibility Recheck — 2026-11-28

## Current branch additions — PR #1216

- The compatibility migration now adds the missing `bizcatalog_platform_settings` table with RLS, no browser grants, and a service-role-only policy.
- It adds the existing history-protected `mnty_platform_admin_delete_business` RPC as `SECURITY INVOKER`, with empty `search_path` and `service_role` EXECUTE only. Its referenced tables/columns and service-role privileges were checked through read-only DEMO catalog queries.
- `catalog-platform-admin` now rejects direct `activityModuleOverrides` writes with HTTP 409 before touching the settings table. This remains disabled until an atomic settings+audit backend is verified; the UI read-only guard is not treated as the only security boundary.
- These additions remain source-only in the Draft PR. They have not been applied to DEMO and no Edge Function has been deployed.
- The compatibility migration now begins with a hard preflight: it refuses to run unless the shared platform-admin helper is registry-backed, SECURITY DEFINER with empty `search_path`, and `private.platform_admins` has RLS plus FORCE RLS. The current DEMO baseline does not satisfy this preflight, so direct application stops before any DDL.

## Scope and isolation

- Repository: `islamnagy2022-eng/MantiqatiX`
- Development project: `MantiqatiX-DEMO` (`lkijdgqanbqjudiducjt`)
- Branch: `dev/demo-admin-compat-20261128`
- Production project and GitHub Pages production configuration were not changed.
- No DEMO schema, data, Auth, RLS, grants, Storage, or Edge Function mutation was performed in this checkpoint.

## Live DEMO read-back

Project status is `ACTIVE_HEALTHY` (PostgreSQL 17.11.0.003).

Migration ledger contains eight DEMO-specific versions. The current Edge inventory lists ten active functions:
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

Two different platform-root contracts are present in the current source: the shared Edge/RLS gate `mnty_can_platform_admin()` still reads the legacy active `MNTY-PLATFORM` membership, while the new control-center RPCs query `private.platform_admins`. Their authority must be converged through the coordinated RC464/RC469/RC471/RC484/RC485 chain and tested together. Never provision a privileged user by copying a Production identity.

## Supabase Advisor snapshot

Security notices include:
- two RLS-enabled tables with no policies (`digital_page_payment_events`, `mantigo_payment_provider_events`); this is fail-closed and must not be "fixed" with broad policies.
- one anon-executable SECURITY DEFINER ad RPC, which appears to be the deliberately bounded public targeted-ad read contract and needs source/behavior verification, not blanket revocation.
- six authenticated-executable SECURITY DEFINER RPC warnings, requiring call-path and scope review.
- leaked-password protection disabled (managed Auth configuration task).

Performance notices include unindexed foreign keys and multiple permissive policies. These are not blockers to building the isolated admin schema but must be triaged independently; no broad policy rewrite is justified.

## Next safe implementation sequence

1. Keep the newly prepared control-center compatibility migration isolated in its Draft PR. It is source-only and is not yet safe to apply by itself.
2. Include RC472 (`20261118010000_rc472_directory_claim_review_atomicity.sql`) in the chronological prerequisite chain. It installs the null-safe `ux_user_memberships_user_business_branch_nullsafe` index and also changes directory claim-review atomicity; validate its duplicate preflight and complete behavior rather than extracting only its index. Keep RC117 image/default changes out of this slice.
3. Rehearse the platform-root authority chain RC464 → RC469 → RC471 → RC484 → RC485 together, including the eight shared helper callers and five dependent RLS policies. In chronological replay, RC472 sits between RC471 and RC484 and must be included before the new control-center migration.
4. Replay the resulting chronological migration set on disposable PostgreSQL 17 from the exact DEMO schema baseline, then run the added SQL ACL/RLS contract and targeted positive/negative authorization tests.
5. Only after replay passes, use a trusted operator bootstrap to create a synthetic DEMO-only platform-admin identity and synthetic tenant/business/branch fixtures. Do not copy Production user or customer data.
6. Deploy compatible `catalog-admin` and `catalog-platform-admin` bundles to DEMO only after verifying imports, secret contracts, `verify_jwt`, and handler authentication.
7. Run HTTP and browser tests for anonymous denial, authenticated non-admin denial, registry-admin success/revocation, tenant/business/branch isolation, employee suspension, permission ceilings, and audit creation. Do not claim admin readiness before these gates pass.

## Verified in this checkpoint

- [x] Repository and default branch confirmed.
- [x] Dedicated development branch created.
- [x] PR #1215 is merged.
- [x] DEMO status, migration ledger, Edge inventory, Advisor snapshot retrieved.
- [x] Exact admin object preflight run read-only against DEMO.
- [x] DEMO-only admin compatibility migration source prepared in Draft PR #1216; not applied.
- [ ] Ordered root-authority chain and membership uniqueness prerequisite rehearsed against exact DEMO schema.
- [ ] Admin Edge Functions deployed to DEMO.
- [ ] Trusted synthetic admin/business fixtures and negative authorization tests complete.

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

The core platform-root sequence is RC464 → RC469 → RC471 → RC484 → RC485, with migration prerequisites and positive/negative policy/caller regression tests. RC472 is chronologically between RC471 and RC484; it supplies the null-safe membership uniqueness index consumed by later logic and also includes directory claim-review atomicity changes. Replay and test RC472 as a complete migration, not as a hand-extracted index. The full ordered chain must be rehearsed against the exact DEMO baseline before deployment. Do not hot-patch the helper independently, do not manufacture a privileged identity, and do not copy a Production identity into DEMO. A verified DEMO Auth user must be provisioned through an explicitly trusted operator bootstrap after the rehearsal.

### Verification and deployment state

- [x] Exact SQL signatures enumerated.
- [x] Two missing internal-helper client revokes added to the migration source.
- [x] Live DEMO root-helper implementation, registry counts, table ACL, helper callers, and dependent RLS policies read back without mutation.
- [x] Static validation source added for RPC ACLs, internal-helper ACLs, forced RLS, and absence of a seeded platform administrator.
- [x] SQL integration contract added to the chronological PostgreSQL 17 replay workflow; it checks the RC472 null-safe membership index, admin RPC ACLs, all relevant SECURITY DEFINER search paths, registry ACL/RLS, privileged table grants, RC117 activity-name synchronization, and untruncated admin business listing.
- [x] Preserved the two later RC117 forward-repair implementations in the new migration after the first full replay exposed regression risk: `marketing_provider_profiles` name/description sync and removal of the 300-business cap.
- [x] Added the service-role-only BizCatalog settings table/policy and the history-protected business-delete RPC dependency required by `catalog-platform-admin`.
- [x] Added a server-side fail-closed guard for direct `activityModuleOverrides` requests until atomic settings+audit support is verified.
- [ ] Re-run the full chronological PostgreSQL 17 replay after the RC117 compatibility correction.
- [x] Source-level static contract checked in this session: 50/50 assertions passed.
- [ ] Run `npm run validate:demo-admin-compatibility` on the exact PR head in GitHub Actions; the step is wired into Pages PR validation.
- [ ] Complete the isolated PostgreSQL 17 forward replay from the captured Production schema checkpoint and its newly added admin ACL/RLS SQL contract; this is not an exact DEMO baseline replay.
- [ ] Replay against the exact DEMO schema baseline and run positive/negative authorization tests for anon, authenticated non-admin, registry-admin, tenant/business/branch boundaries, and employee permission ceilings.
- [ ] Reconcile and rehearse the ordered RC464/RC469/RC471/RC484/RC485 authority chain with dependent caller/policy tests.
- [ ] Deploy compatible admin Edge Functions to DEMO only, then run HTTP and browser smoke tests.

No migration was applied, no Edge Function was deployed, and no DEMO or Production data/configuration was mutated in this checkpoint. PR #1216 remains Draft and must not be merged or applied until the replay, authority-bootstrap, and runtime gates pass.
