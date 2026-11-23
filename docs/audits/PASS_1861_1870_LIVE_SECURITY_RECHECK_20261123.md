# PASS 1861–1870 — Live Supabase security recheck

**Date:** 2026-11-23  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Evidence:** read-only Supabase metadata, privilege inspection and Security Advisor snapshot.  
**Production impact:** NONE. No DDL/DML, grants, policies, migrations, Auth settings, Storage, Edge deployment, payments, wallet, settlement or customer-data mutation/read.

## Live baseline

- Migration ledger: **310** entries; latest version **20261110150618**.
- Public SECURITY DEFINER functions executable by `anon`: **1**.
- Public SECURITY DEFINER functions executable by `authenticated`: **65**.
- RLS-enabled public tables with no policies per Advisor: **9**.
- A separate privilege query found **0** of those nine tables with effective anon/authenticated SELECT/INSERT/UPDATE/DELETE table privileges.

## Advisor interpretation

- 9 `rls_enabled_no_policy` INFO findings.
- 65 authenticated-callable SECURITY DEFINER WARN findings.
- 1 anon-callable SECURITY DEFINER WARN finding: `get_mnty_targeted_advertisements(...)`.
- Leaked-password protection disabled: WARN.
- Anonymous Auth warning category requires per-table/per-command analysis; Advisor output must not be interpreted as a count of exposed tables.

The anon-callable ad RPC is the public ad-discovery contract. Its live definition uses an empty `search_path`, returns approved active advertisements with location-match metadata, and clamps the result limit to 1–50. Source RC451 intentionally preserves public execution while hardening search_path. Do not blanket-revoke it without redesigning the public ads contract and running public-catalog tests.

The 65 authenticated-callable SECURITY DEFINER functions are not automatically vulnerabilities solely because they are executable by authenticated users. Review each for caller identity binding, tenant/business/branch scope, argument trust, idempotency, search_path and data access. No blanket revoke is authorized.

## Nine no-policy tables

- `public.business_employees`
- `public.business_job_positions`
- `public.commission_rule_audit`
- `public.digital_page_payment_events`
- `public.directory_listing_claim_requests`
- `public.directory_source_permission_evidence`
- `public.platform_custom_roles`
- `public.platform_role_assignments`
- `public.public_directory_listings`

The effective API-role table-privilege query returned zero exposed tables in this set. Keep INFO findings visible; do not add broad policies just to silence Advisor.

## P0/P1 blockers reconfirmed

- Live `is_platform_admin()` still derives global authority from active tenant membership roles, not the protected registry.
- Live `mnty_can_platform_admin()` still delegates to `mnty_can('admin',NULL,NULL,NULL)`.
- The migration ledger remains behind current source; merged migrations are not proof of deployed parity.
- Actual encrypted off-site database/Storage backup, Vault recovery, independent PostgreSQL 17 restore/rollback and measured RPO/RTO remain NOT VERIFIED.
- Public directory listings remain fail-closed pending consent migration and coordinated Edge release.
- Leaked-password protection remains an owner/plan dependency; no Auth setting was changed.

## Decision

**FULL PRODUCTION: BLOCKED / NOT CERTIFIED.**

Next safe source-side work: classify the 65 authenticated SECURITY DEFINER functions and build the exact anonymous-auth policy matrix. Production changes remain gated on operator-owned backup/restore evidence, chronological migration reconciliation, coordinated Edge parity and explicit release approval.
