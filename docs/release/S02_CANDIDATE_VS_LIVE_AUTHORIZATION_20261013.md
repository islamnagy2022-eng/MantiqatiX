# S02 — Candidate Remediation vs Live Production: MantiGO Admin RPCs

**Observed:** 2026-10-13 UTC  
**Repository:** `islamnagy2022-eng/MantiqatiX`  
**PR:** [#218](https://github.com/islamnagy2022-eng/MantiqatiX/pull/218), draft and unmerged at inspection  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Purpose:** document whether the existing candidate source addresses the live P0 finding. This is not approval to deploy.

## Executive finding

The PR source already contains a candidate authorization hardening in RC441 and two follow-up corrections (RC462 and RC523). However, the live production catalog still exposes the four RPCs with the older definitions. The candidate migrations are not proven applied in production, and the clean chronological migration replay is blocked earlier in the chain. Therefore **source presence is not a production fix** and this PR must remain uncertified.

## Source-to-live comparison

| Concern | Candidate branch source | Live production observation | Decision |
|---|---|---|---|
| Platform-admin guard | RC441 calls `public.mnty_can_platform_admin()` in dashboard, financial report, settlement, and expiry RPCs before platform-wide work | Guard and `PLATFORM_ADMIN_REQUIRED` marker absent from all four live function definitions | P0 remains open |
| Actor binding | RC441 checks `auth.uid()` against `p_admin_user_id` before sensitive work | Live query did not prove the complete body is safe; guard absence alone is sufficient to block certification | Reconcile full deployed bodies after approved release |
| Search path | RC441 definitions use `SET search_path = ''` and schema-qualified references | Live functions report `search_path=public` | Candidate is safer, but must be applied through reviewed migration pipeline |
| Malformed permission values | RC441 casts `permissions ->> 'full_control'` to boolean and may error for malformed strings; RC462 replaces this with JSON containment and fail-closed behavior | Do not assume RC462 is live; live migration ledger evidence has not confirmed it applied | RC462 regression must pass before release |
| Financial report schema | RC441 source reads legacy `amount` and `captain_amount` columns; RC523 replaces these with canonical `gross_amount` and `captain_net_amount` | Live function lacks the expected platform guard; live deployed column/response correctness must be verified independently | RC523 integration test and canonical schema check required |

## Migration / CI dependency

The S04 clean-replay report identifies the first source-chain failure as `20260927074200_harden_smm_table_api_privileges.sql`, which references `public.smm_provider_credentials` before any creation migration is present in the executable source chain. The read-only production migration-ledger search found this table referenced in the privilege-revocation migration and later explicit-deny-policy migration, but did not find a table-creation statement in the ledger's recorded statements.

The same S04 report identifies five duplicate 14-digit source version groups and material source-vs-ledger semantic differences (including RC172, RC206, and RC207). Do not resolve these by arbitrary filename renames or by rewriting production migration history. The full replay must become deterministic and pass in disposable PostgreSQL first.

Latest-head CI checks were queued at the last poll; no successful exact-head result is claimed here. The web deploy workflow was cancelled, not deployed.

## Safe closure sequence

1. Recover authoritative creation DDL/provenance for `public.smm_provider_credentials`. If historical DDL cannot be established, propose an explicitly reviewed **disposable-test-only baseline**; do not silently manufacture production history.
2. Reconcile duplicate source timestamps and all material source-vs-ledger SQL differences, preserving live migration history.
3. Run the full chronological clean replay and every required exact-head regression workflow to completion.
4. In disposable PostgreSQL, verify denial for unauthenticated, ordinary tenant owner/admin, tenant-scoped SUPER_ADMIN, malformed permissions, inactive/revoked platform membership; verify the explicit active platform SUPER_ADMIN path succeeds.
5. Assert rejected settlement/expiry requests cause no ride, ledger, journal, audit, or wallet side effects.
6. Obtain explicit production-release authorization. Apply only the reviewed forward-only migration sequence through the approved pipeline, then repeat read-only catalog inspection to prove all four deployed function definitions, privileges, search paths, and financial-report columns match the approved source.
7. Keep the PR draft and release blocked until backup/restore, RPO/RTO, rollback, webhook/payment E2E, monitoring, and remaining security gates are independently verified.

## Evidence boundary

- **Verified live:** four RPCs are SECURITY DEFINER, executable by `authenticated`, use `search_path=public`, and do not contain the expected platform-admin guard/error marker.
- **Verified source:** RC441 defines guarded versions of the four RPCs; RC462 hardens malformed permission handling; RC523 updates financial-report aggregation to canonical ledger columns.
- **Not verified:** any of these candidate changes being applied to production, full chronological replay, end-to-end payment/settlement behavior, or release certification.
- **Not performed:** production writes, migration application, privilege changes, function replacement, deployment, merge, or financial mutation.

**Decision: BLOCKED / NOT CERTIFIED.**
