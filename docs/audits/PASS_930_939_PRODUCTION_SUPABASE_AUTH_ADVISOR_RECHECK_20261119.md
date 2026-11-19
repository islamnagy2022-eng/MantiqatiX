# Pass 930–939 — Production Supabase authorization and Advisor recheck

**Date:** 2026-11-19  
**Canonical Supabase project:** `moyhiluyhjsujhwlyeuu` (`MANTIQATIX FINAL`, ACTIVE_HEALTHY, PostgreSQL 17.6)  
**Evidence mode:** read-only database/catalog/advisor inspection plus GitHub CI status  
**Production mutations:** NONE

## 1. Release migration ledger — revalidated

The canonical source contract `scripts/production/live-reconciliation-contract.mjs` contains 62 unique required release migration versions. The live ledger contains 310 rows and its latest version remains `20261110150618`. The previously established comparison remains 0/62 required release versions found and 62/62 missing. No ledger row was inserted or migration applied.

## 2. MantiGO platform authorization — P0 remains open

Fresh `pg_get_functiondef`, ACL and function-configuration inspection reconfirmed the live Production state:

| Function | SECURITY DEFINER | search_path | anon EXECUTE | authenticated EXECUTE | Root authorization |
|---|---:|---|---:|---:|---|
| `get_mantigo_admin_dashboard_backend(uuid)` | yes | public | no | yes | broad active membership role check |
| `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)` | yes | public | no | yes | broad active membership role check |
| `settle_mantigo_captain_backend(uuid,text,text)` | yes | public | no | yes | broad finance/owner/admin membership role check |
| `expire_stale_mantigo_rides_backend(uuid,integer)` | yes | public | no | yes | broad operations/owner/admin membership role check |
| `mnty_can_platform_admin()` | yes | public, pg_temp | no | yes | delegates to `mnty_can('admin',NULL,NULL,NULL)` |

The live financial-report function still reads legacy `amount` and `captain_amount` fields; the live ledger schema uses `gross_amount`, `commission_amount`, and `captain_net_amount`. The source-side RC464/RC471/RC476 forward repairs are not live. Do not call the settlement/expiration RPCs or apply a migration individually. The existing 62-version chronological release, backup/restore, rollback and post-deploy adversarial gates remain mandatory.

## 3. Supabase Security Advisor — classified, not blindly changed

Fresh Security Advisor findings:

- 9 tables have RLS enabled with no policies. Read-only ACL inspection showed no direct anon/authenticated SELECT or INSERT grants on any of the nine. Three of the nine show service_role SELECT/INSERT grants; six do not. This is a deny-by-default surface, not proof of an exposure. Verify each table's intended service/RPC access path before changing policies or grants.
- 1 anon-executable SECURITY DEFINER function: `get_mnty_targeted_advertisements(...)`. Its live body returns only active, approved ads and public creative/target metadata, filters by geographic targeting, and caps results at 50. This appears to be an intentional public discovery endpoint, but its output/underlying table contract should remain explicitly reviewed. Do not revoke blindly because that could break public ad delivery.
- 65 authenticated-executable SECURITY DEFINER functions. This is a review population, not a vulnerability count. The MantiGO global functions above are confirmed P0; other functions need per-function identity binding, membership/scope checks, search_path and ACL review.
- Supabase Auth reports leaked-password protection disabled. This is an owner-operated Auth configuration action; no Auth setting was changed in this pass.
- Performance Advisor reports 132 unindexed foreign keys, 375 auth RLS initplan findings, 70 unused indexes, and 28 multiple-permissive-policy findings. These are prioritization signals; do not mass-create indexes or delete policies without workload and query-plan evidence.
- Repeated `auth_allow_anonymous_sign_ins` notices appeared in the Advisor payload; the duplication is not treated as multiple distinct findings.

## 4. R7 API inventory CI and catalog deployment

- PR #837 merged as `9bb68ea638477abd16b8460f4bc65403bd03b0a4`; exact-head checks: 28 success, 2 expected skips (deploy and public-only).
- Dedicated R7 API route policy inventory workflow run `44447440521`: PASS.
- Production Health Monitor run `44447440446`: PASS.
- Directory Claim Atomicity run `44447440608`: PASS.
- The Pages workflow for the same main SHA passed its validation job; the deploy job was still running deployed-origin Playwright checks at this checkpoint. Do not claim final deployed-origin E2E or a completed release until that run finishes successfully.
- PR #837 contains documentation/CI controls only. No R7 runtime source, Production DB/Auth/RLS/GRANT/Edge/payment/wallet/settlement, or catalog content was changed by the PR.

## 5. Next safe actions

1. Continue exact-head deployed-origin Playwright checks and record the final result.
2. Keep the 62-migration set blocked pending owner-controlled encrypted backup, isolated restore rehearsal, measured RPO/RTO, ordered replay and rollback proof.
3. Implement RC464/RC471/RC476 only through the coordinated release train; verify all five SECURITY DEFINER definitions, grants, empty search_path and financial column references after deployment.
4. Have the project owner enable leaked-password protection through Supabase Auth settings, then re-run the Advisor.
5. Review the 65 authenticated SECURITY DEFINER functions by call contract and risk, not by bulk revocation. Preserve intended public ad discovery only after confirming response fields and output policy.
6. Classify the nine RLS/no-policy tables by intended backend access path; keep deny-by-default until required grants/RPC paths are proven.
7. Prioritize performance findings using actual query plans and workload telemetry.

**Disposition:** scoped public catalog remains the only approved release surface. Full MantiqatiX Enterprise remains **BLOCKED / NOT CERTIFIED**. All Production inspections in this pass were read-only.
