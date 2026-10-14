# MantiqaTix — Production Audit Register
**Snapshot:** 2026-10-14 | **State:** BLOCKED / NOT CERTIFIED  
This is a living evidence register. Findings below are limited to observations obtained in this session.

## Evidence captured
| ID | Area | Observation | Status |
|---|---|---|---|
| AUD-001 | Git baseline | GitHub commit search identifies main head as `8a56358d505d2c12878440037f7f24ba65d2ea10` | PASS |
| AUD-002 | Documentation continuity | Existing continuity documents still cite `735f0451...` as current HEAD | PARTIAL — correction appended |
| AUD-003 | Supabase availability | Project reports `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.155, us-east-2 | PASS (health metadata only) |
| AUD-004 | Migration ledger | 283 entries; latest `20261008222845` / RC424 | PASS (ledger observation only) |
| AUD-005 | Migration reconciliation | Source migration chain versus live ledger/schema has not been replay-verified in this audit | NOT VERIFIED |
| AUD-006 | RLS | Advisor reports `public.digital_page_payment_events` has RLS enabled and no policies | OPEN REVIEW |
| AUD-007 | SECURITY DEFINER | Advisor reports one anon-executable targeted-ad RPC and 40 authenticated-executable SECURITY DEFINER findings | OPEN REVIEW |
| AUD-008 | Auth protection | Leaked-password protection previously recorded disabled; must be rechecked in Supabase Auth settings by authorized owner | WAIT / NOT RECHECKED HERE |
| AUD-009 | User/tenant E2E | Multi-user, multi-tenant and IDOR regression evidence remains unverified | NOT VERIFIED |
| AUD-010 | Payments/finance | Real Paymob, refund and settlement E2E remains unverified; no real transaction was run | NOT VERIFIED |
| AUD-011 | Web/Android | Interactive browser, offline/PWA, signed Android artifact and device evidence remain incomplete per current TODO | PARTIAL / WAIT |

## Required next evidence
1. Reconcile every production migration version to exactly one authoritative source migration; investigate missing, duplicate, conflicting or out-of-order versions before any migration is applied.
2. Capture current public base-table count, RLS state, policy count and grants read-only.
3. Review every SECURITY DEFINER function by caller contract and authorization checks; test in disposable fixtures before changing grants.
4. Verify leaked-password protection with the authorized Supabase owner and rerun Security Advisor.
5. Run E2E only in approved test/staging contexts; use real-money production tests only with explicit authorization and controlled procedures.
6. Confirm latest release-gate workflow result and whether deployment was blocked or succeeded; do not infer from repository commit alone.

## Safety rules
- No blanket grant revocations, broad RLS policies, production DDL, fake payments, secret exposure, or direct deployment to make a checklist look green.
- Preserve historical records and append corrections when evidence supersedes them.
- A green project-health status is not production-readiness evidence.
