# PASS 1771–1780 — Live Production security recheck and release-blocker reconciliation

**Date:** 2026-11-23  
**Supabase project:** `moyhiluyhjsujhwlyeuu` — MANTIQATIX FINAL  
**Evidence type:** read-only Production metadata, privileges, policy definitions, advisor results, migration inventory and Edge Function inventory.  
**Production impact:** none. No application rows, identities, memberships, customer records, financial records, contact details, Storage object names or secret values were queried.

## Current live baseline

- Organization plan: **Free**.
- Database: PostgreSQL **17.6.1.155**, status ACTIVE_HEALTHY.
- Migration ledger: **310** rows; latest version **20261110150618**.
- Active Edge Functions: **42**.
- Selected deployed versions include `ai-gemini-proxy v5`, `catalog-admin v20`, `catalog-platform-admin v23`, `public-catalog-directory v19`, `public-catalog v9`, `directory-listings v18`, `payment-intent v8`, `paymob-webhook v10`, and `subscription-payment-intent v4`.
- Source main contains later security/release migrations beyond the live ledger. The existence of source files and CI results does not prove those migrations or Edge bundles are deployed.

## Fresh Security Advisor snapshot

- 9 `rls_enabled_no_policy` INFO findings.
- 65 authenticated-callable SECURITY DEFINER WARN findings.
- 1 anon-callable SECURITY DEFINER WARN finding: `get_mnty_targeted_advertisements(...)`; preserve its reviewed public read contract pending function-specific review rather than blanket-revoking it.
- 90 `auth_allow_anonymous_sign_ins` warnings.
- 1 leaked-password-protection-disabled WARN finding.

The 90 anonymous-auth warnings are not 90 confirmed leaks. Supabase anonymous Auth identities use the `authenticated` PostgreSQL role and must be distinguished by the JWT `is_anonymous` claim. Policy grants, permissive OR composition, restrictive AND composition and tenant/owner predicates all matter.

## Confirmed live critical findings

### P0 — Generic platform-admin helper remains in Production

Read-only `pg_get_functiondef('public.is_platform_admin()')` confirms the live helper still returns true for any ACTIVE `user_memberships` row whose role is `ADMIN` or `SUPER_ADMIN`; it does not query the private platform-admin registry.

A current read-only `pg_policies` aggregation found **57 policies across 24 tables** whose `USING` or `WITH CHECK` references `is_platform_admin()`. This remains tracked under issue **#867**. Current source contains the RC464+ registry-backed repair path, but it is not recorded in the live migration ledger. Keep the issue P0 / NOT VERIFIED in Production.

### P0 — Provider profile base-table read remains exposed

Fresh live metadata for `public.marketing_provider_profiles`:

- RLS enabled and FORCE RLS enabled.
- **19 columns** in the base table.
- Direct `anon SELECT` privilege: **true**.
- Direct `authenticated SELECT` privilege: **true**.
- Three permissive policies remain, including `Public can view active marketing providers` for `anon,authenticated`.
- No restrictive policy checking `is_anonymous` was found.

This confirms the base-table projection remains broader than the curated public Edge projection. Source repairs are present on current main:
- `20261118190000_rc479_revoke_anon_provider_profile_base_read.sql`: revoke direct anon SELECT.
- `20261120193000_rc479_restrict_anonymous_auth_provider_profile_select.sql`: add restrictive confirmed-auth SELECT guard.

Neither appears in the live migration ledger. Issue **#928** has been updated with the fresh evidence. Do not replace the public discovery Edge projection or expose additional base-table columns.

### P1 — Anonymous-auth policy reconciliation remains incomplete in Production

Current Advisor count remains 90. Historical current-main audits record 40 of those relations without a table-wide restrictive `is_anonymous` guard; they require per-command tests rather than a blanket deny policy. Source migrations RC488–RC493 cover selected Storage, finance, medical, support, InDrive and CRM/notification surfaces, but are not live.

Target next:
1. Reconcile the 90 relations by schema/table/command and actual table/column grants.
2. Verify anonymous Auth and confirmed-user JWT behavior in disposable PostgreSQL 17 tests.
3. Preserve intended public discovery, tenant-local flows, owner-self reads and service-role contracts.
4. Keep uncovered financial/payment, support, medical, digital-page, SMM and Storage commands open until tests prove the policy composition.

### P1 — Leaked password protection is blocked by current plan

The organization is on the Free plan. Current Supabase Auth documentation states leaked-password protection is available on Pro and above. This is a project-plan dependency, not an application-code fix. Keep the warning visible and mark **WAIT — plan upgrade/owner decision**; do not infer an upgrade or change plan without authorization.

## Release gate / safety disposition

- The live migration ledger is 310 rows through `20261110150618`; source main has later release migrations. The exact required release set and physical dependencies remain subject to the canonical migration-reconciliation runbook.
- Production backup/restore remains unverified. The canonical runbook requires encrypted off-site database and Storage exports, Vault recovery, a separate PostgreSQL 17 restore/rollback rehearsal, measured RPO/RTO and independent review.
- No Production DDL/DML, migration, Auth setting change, RLS policy, GRANT/REVOKE, Storage policy, Edge Function deployment, payment, wallet, settlement or customer-data mutation occurred.
- Full platform remains **BLOCKED / NOT CERTIFIED**.

## Next dependency-ordered actions

1. Preserve current Production behavior and keep the live privacy issue #928 and platform-admin issue #867 open.
2. Complete the operator-owned encrypted backup/Storage export and independent PostgreSQL 17 restore evidence.
3. Reconcile exact migration order and bundle RC464/RC471/RC479/RC482/RC484 plus relevant RC488–RC496 schema/ACL dependencies.
4. Run exact-head adversarial anonymous-vs-confirmed-user, tenant-scope and registry-only admin tests in disposable PostgreSQL.
5. Only after backup, restore, migration, Edge parity and release-owner approval, execute the coordinated Production release and re-read live policy, function and ACL evidence.

## Evidence boundaries

- Supabase MCP reads confirmed the metadata and definitions listed above.
- No end-user records or secret values were read.
- Advisor warnings are treated as review signals; only the explicitly measured provider-profile direct anon SELECT and generic helper definition are marked confirmed live exposure/authorization defects.
- No live fix is claimed. Source repairs remain source-only pending coordinated release.
