# MantiqaTiX — Continuation Gate Evidence
**Captured:** 2026-10-15  
**Scope:** Read-only release triage; no production writes, migrations, deploys, or merges performed.

## Current release decision
**BLOCKED / NOT CERTIFIED.** This document records observations and does not authorize deployment.

## Repository review
- PR #248 (recovery branch): https://github.com/islamnagy2022-eng/MantiqatiX/pull/248 — open, draft, unmerged.
- PR #249 (production schema baseline): https://github.com/islamnagy2022-eng/MantiqatiX/pull/249 — open, unmerged; baseline manifest remains `PENDING_REVIEW`.
- RC462 malformed-permission tests exist in the recovery branch and exact-head CI had passed in the recorded review. Do not treat old comments claiming the tests are missing as current.

## Read-only Supabase advisor observations
Observed 2026-10-15 05:32–05:33 UTC:
- Security advisor: 1 `anon_security_definer_function_executable` finding, for `public.get_mnty_targeted_advertisements(...)`.
- Security advisor: 40 `authenticated_security_definer_function_executable` findings. These are review findings, not proof each function is exploitable; verify each function's intended caller, body authorization, grants, and data exposure.
- Security advisor: `public.digital_page_payment_events` has RLS enabled and no policies. Do not add a broad client policy; review table grants and server-side access together.
- Performance advisor: 105 unindexed foreign-key findings and 28 multiple-permissive-policy findings. Treat these as optimization/complexity leads, not an instruction to add indexes or merge policies blindly. Confirm workload, existing indexes, and query plans before changes.

## Confirmed source candidates — NOT DEPLOYED
- RC462: malformed JSON permission values fail closed; explicit JSON containment requires `{"scope":"PLATFORM","full_control":true}`.
- RC526: restricts shared `marketing_services` mutations to active platform SUPER_ADMIN with explicit full-control scope.
- RC527: hardens marketing CRM manager/provider visibility with tenant/business scope and JSON boolean authorization.
These source files are candidates only. They must pass ordered migration-chain validation, isolated replay, and relevant integration/security tests before any release decision.

## Mandatory gates before release
1. Independently verify baseline provenance, snapshot SHA-256, and migration-ledger checkpoint; keep manifest `PENDING_REVIEW` until reviewed.
2. Replay baseline plus forward migrations in a disposable isolated database only. Never apply the snapshot to production.
3. Run negative/positive tests for platform-admin JSON permissions (boolean true vs string "true", false, malformed values), cross-tenant CRM reads/writes, payment webhook binding/idempotency, and MantiGO admin/settlement/expiry RPCs.
4. Review every externally callable SECURITY DEFINER function, including the single anon-callable function, and least-privilege grants. Re-run security advisors after approved changes.
5. Triage foreign-key index findings with query plans and workload data; review multiple permissive policies for correctness before optimization.
6. Verify CI at the exact final commit, backup/restore readiness, rollback plan, and explicit release approval.

## Guardrails
- Preserve Supabase email OTP sign-in/verification.
- No guessed historical DDL, fake migration history, broad RLS policies, or blanket grant changes.
- No production migration, edge deployment, secrets/auth changes, or merge without explicit approval and completed gates.
