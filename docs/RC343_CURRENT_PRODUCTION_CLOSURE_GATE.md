# RC343 — Current Production Closure Gate

Date: 2026-10-04

## Purpose

This record is the current evidence boundary for the MNTY / MantiqatiX production release. It does not replace runtime evidence with source existence.

Project baseline:
- Repository: islamnagy2022-eng/MantiqatiX
- Branch: main
- Current main commit: b2029281b6019a6f11c42dfd53947dcfd2b4f234
- Supabase project: moyhiluyhjsujhwlyeuu
- Final Production Gate: OPEN

## CI evidence

GitHub Actions run 37169476834 (run #1529) executed for the exact current main commit b2029281b6019a6f11c42dfd53947dcfd2b4f234.

Result:
- event: push
- workflow: Deploy MantiqatiX Web
- conclusion: SUCCESS
- RC342 1000-stage structural gate therefore has CI evidence on current main.

The immediately preceding run 37169468119 was CANCELLED because a newer push superseded it. It is not treated as a failure.

## 1000-stage structural gate

RC342 validates:
- the plan contains 1000 numbered stages;
- the numbered sequence is contiguous;
- stages 353–1000 are represented;
- required continuity/release documentation exists;
- critical MNTY web/PWA source contracts exist.

Classification: STRUCTURAL CONTRACTS PASS.

This does not certify the external/runtime stages.

## Live Supabase security boundary

The current Security Advisor still reports intentional/known categories:
- public.digital_page_payment_events: RLS enabled with no policies; direct anon/authenticated access remains absent and the table is intentionally fail-closed as a backend-only event ledger.
- get_mnty_targeted_advertisements(...): intentional public SECURITY DEFINER advertisement-serving RPC.
- nine authenticated-callable SECURITY DEFINER RPC boundaries remain; these were hardened with search_path=public, pg_temp and retain authenticated execution where their server-side contract requires it.
- contextual anonymous-policy warnings remain.
- leaked-password protection remains a managed Auth setting and is NOT VERIFIED as enabled.

No broad policy or privilege change is made solely to silence Advisor findings.

## Performance boundary

The live Performance Advisor currently reports:
- multiple permissive policies: 25 findings;
- many unused indexes / workload-dependent findings.

The multiple-policy set includes several exact duplicate guard policies (for example authenticated session/non-anonymous guards). These are candidates for controlled cleanup only after confirming policy equivalence and authorization behavior. No blanket RLS rewrite or mass index deletion/addition is authorized by this record.

## Release blockers

The following remain OPEN and prevent Production Certified status:

1. Leaked Password Protection — WAITING FOR USER / Auth managed setting.
2. Two-user/two-tenant adversarial E2E — NOT VERIFIED.
3. Customer → Provider → Order → Status → Notification E2E — NOT VERIFIED.
4. Real Paymob production payment E2E — WAITING FOR credential/provider authorization.
5. Refund → Settlement → General Ledger E2E — WAITING/NOT VERIFIED.
6. Browser/PWA/push real-device E2E — NOT VERIFIED.
7. Backup/restore/rollback rehearsal — NOT VERIFIED.
8. Android signed release artifact and real-device evidence — BLOCKED / WAITING.
9. Final regression across the production release surface — NOT VERIFIED.

## Safe closure rule

A gate can move to VERIFIED only when direct evidence exists for that gate.

Source code, migrations, CI success, database schema inspection, or Security Advisor output alone cannot substitute for:
- real authenticated identities;
- real payment provider authorization;
- real device/browser behavior;
- restore/rollback rehearsal;
- managed Auth settings;
- signed Android artifacts.

## Decision

**MNTY / MantiqatiX is NOT PRODUCTION CERTIFIED YET.**

The current main branch is structurally CI-verified and the 1000-stage execution contract is machine-checked, but the Final Production Gate remains OPEN until the external/runtime P0 evidence above is completed.

## Next executable sequence

1. User enables Supabase Auth Leaked Password Protection.
2. Re-run Security Advisor and record the result.
3. Execute controlled two-user/two-tenant adversarial E2E.
4. Execute customer/provider/order/status/notification E2E.
5. Obtain Paymob production test authorization and execute payment/replay/idempotency evidence.
6. Execute refund/settlement/GL evidence.
7. Execute browser/PWA/push device smoke.
8. Execute backup/restore/rollback rehearsal in a controlled recovery environment.
9. Reconcile and build/sign Android only after source compatibility is proven.
10. Run final regression and issue the final release evidence package.
