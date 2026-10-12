# MantiqatiX — Append-only Session Log

This is the chronological handoff ledger for material project decisions and execution across ChatGPT sessions. The latest state is summarized in `docs/PROJECT_CONTINUITY.md`; the open work list is `docs/MASTER_PRODUCTION_TODO.md`.

## 2026-10-11 — SESSION-001 — Establish cross-session continuity and capture release blockers

- **User requirement:** Every material thing agreed or done across sessions must be referenced in project files so a new session can resume in sequence without re-asking or repeating work.
- **Repository baseline verified:** `main` at `735f0451bf6dae9ed8cf681f83c4856a4b029041`.
- **Verified:** production gate run [38108142127](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38108142127) failed closed; release remains blocked.
- **Verified:** production migration ledger contains 283 migrations through `20261008222845` (RC424); RC425–432 and RC434–441 source files are absent from main and not applied in production.
- **Verified:** PR #202 and PR #84 disagree on RC434 migration `20261009200000_rc434_atomic_erp_purchase_receiving.sql`; collision guard must remain enabled. PR #202 has missing-script CI failures for `scripts/validate-smm-payment-safety.mjs` and `scripts/test-checkout-secret-crypto.mjs`.
- **Verified source parity:** live payment-intent v6, paymob-webhook v8, digital-page-payment-intent v3, subscription-payment-intent v2 match main/PR #202, not PR #84; erp-purchase-receive v1 matches neither PR; smm-gateway v6 matches none of the compared sources.
- **Verified:** live subscription payment flow does not use RC439 encrypted checkout recovery; required columns are not in the live table schema and RC439 is not applied.
- **Verified from live SMM source:** unsafe global-admin fallback via tenant membership roles; no explicit provider-call timeout; ambiguous provider failures can trigger automatic refund; some persistence outcomes are unchecked; status updates lack a terminal-state guard.
- **Verified advisor snapshot:** 94 mixed-severity lints; leaked-password protection disabled; SECURITY DEFINER and policy findings require scoped review, not blanket changes.
- **Action performed:** this continuity protocol and session log are being committed to the repository. Documentation is not a software fix and does not change production.
- **Not performed:** no production DDL/data mutation, no function deployment, no PR merge, no release approval.
- **Next action:** reconcile RC434 variants and the missing migration chain; fix missing CI scripts from authoritative contracts; isolated full replay; then close SMM/payment/security gaps with tests.
- **Release state:** **BLOCKED / NOT CERTIFIED**.

## Logging convention for future sessions

Append a new dated section. Never rewrite or delete historical entries; if a fact is superseded, add a later correction that links to the earlier entry and explains the new evidence. Each session entry should include user decisions, exact code/commit/PR/run references, tests/results, production impact, unresolved risks, and the next executable action.


## 2026-10-13 — SESSION-002 — Auth/membership recovery and RPC convergence

- **User direction:** Continue automatically; work toward a secure production release, but do not claim completion without evidence.
- **Verified baseline:** PR #217 is open and remains draft; base/main SHA `8a56358d505d2c12878440037f7f24ba65d2ea10`; branch head `90f9ac4c9d49502d1ffe7249e936445fa6743615`.
- **Implemented on review branch:** Google OAuth client uses `flowType:'pkce'`; membership-recovery UI calls the authenticated `mnty-customer-registration` Edge Function, verifies the returned auth identity, reloads membership data, and confirms an active CUSTOMER membership before declaring success.
- **Source convergence fix:** Live Edge Function `mnty-customer-registration` calls `private.ensure_customer_membership_for_user`; branch source was aligned to this RPC and the validator/release preflight now guard the canonical RPC and PKCE/membership-recovery contract.
- **Production read-only evidence:** Supabase project `moyhiluyhjsujhwlyeuu` is ACTIVE_HEALTHY. Edge Function is ACTIVE with JWT verification enabled. The canonical RPC and auth-user membership trigger exist. The canonical RPC is not directly executable by anon/authenticated and is granted to service_role.
- **Membership count audit:** 6 permanent Auth users; 0 permanent Auth users without an active membership; 10 distinct user IDs with active memberships; 4 active CUSTOMER memberships in MNTY-PLATFORM reference user IDs absent from auth.users; no duplicate active CUSTOMER memberships per user in MNTY-PLATFORM. The four rows date from 2026-09-29 through 2026-09-30. No membership was deleted or changed; cause and retention policy remain unresolved.
- **CI evidence at branch head:** Pages validation run [38318510837](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38318510837) succeeded; deploy was skipped because the PR is draft. Module Professionalization [38318510864](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38318510864), Backend-only Module Boundary [38318510823](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38318510823), and MantiGO Open Ride Privacy Boundary [38318510972](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38318510972) completed successfully.
- **Not verified:** Interactive Google OAuth round trip, membership recovery using a controlled test identity, expired/mismatched session negative tests, concurrent idempotency E2E, and independent cross-tenant/RLS denial.
- **Production impact:** No production DDL, data mutation, RLS/Auth config change, Edge Function deployment, PR merge, Pages production deploy, or financial transaction. No role grants.
- **Release state:** **BLOCKED / NOT CERTIFIED**. The code/CI evidence is not a substitute for E2E or final release approval.
- **Next action:** Continue safe review-branch work; establish a controlled non-production auth fixture and test membership recovery/idempotency, then review orphan membership provenance without deleting rows. Do not bypass protected gates or create production test accounts.


### 2026-10-13 — SESSION-002 follow-up — Disposable PostgreSQL membership integration

- **Added:** `supabase/tests/rc215_customer_membership_fixture.sql` and `supabase/tests/rc215_customer_membership_integration.sql` plus the `customer-membership-rc215-integration` job in `.github/workflows/module-professionalization.yml`.
- **Test coverage:** actual RC215 migration is applied to a disposable PostgreSQL 16 container; permanent Auth user gets one active CUSTOMER membership; repeated activation is idempotent; anonymous Auth user gets no permanent membership; `anon` and `authenticated` cannot execute the private RPC directly; `service_role` can execute it.
- **CI verified:** workflow run [38318855957](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38318855957) — validator PASS and the new `customer-membership-rc215-integration` job PASS. Existing targeted-ads integration in the same workflow also PASS. Pages validation [38318856044](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38318856044) PASS with deployment skipped because the PR remains draft. Backend-only validation run [38318855947](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38318855947) validator and financial journal integration PASS; approval audit integration was still in progress at the last check. MantiGO privacy integration [38318855975](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38318855975) PASS.
- **Additional audit evidence:** all 4 orphan active CUSTOMER memberships have audit references; grouped actions show 3 `CUSTOMER_MEMBERSHIP_AUTO_ACTIVATED` successes and 1 `CUSTOMER_REGISTRATION_ACTIVATED` success, dated 2026-09-29 to 2026-09-30. This indicates the memberships were intentionally created by the application paths, but it does not explain why the Auth identities are absent now. Preserve all rows; investigate deletion/history and retention policy before any remediation.
- **No production mutation/deployment/merge.** The new PostgreSQL test is isolated CI coverage, not proof of live browser OAuth or multi-tenant E2E.


### 2026-10-13 — SESSION-002 test correction — Final RC215 integration PASS

- The first run after adding the inactive-tenant assertion failed because dollar-quoted DO block delimiters in the generated SQL file were malformed. The job log identified the exact syntax error; this was not hidden or counted as a pass.
- Corrected the test to use explicit `$rc215_test$` delimiters and reran the complete workflow.
- **Final verified result:** [Module Professionalization Validation run 38319097500](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38319097500) — `validate` PASS, `targeted-ads-search-path-integration` PASS, and `customer-membership-rc215-integration` PASS. The RC215 integration now verifies the auth-user trigger, exactly one active CUSTOMER membership, repeat-activation idempotency, anonymous-user exclusion, inactive-tenant denial, and service_role-only RPC grants.
- [Pages validation run 38319097546](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38319097546) PASS; deploy skipped because PR #217 remains draft. [Backend-only Module Boundary run 38319097571](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38319097571) validator and approval-action-audit integration PASS; financial-journal integration was still running at last check. [MantiGO privacy run 38319097534](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38319097534) was still running at last check.
- Live browser OAuth and multi-tenant runtime E2E remain NOT VERIFIED. No production data/schema/auth changes or deployment were made.


### 2026-10-13 — Live membership RLS/grants verification

- **Read-only live policy check:** `public.user_memberships` has RLS enabled and FORCE RLS enabled.
- **Live SELECT policy:** `memberships_select_self`, targeted to `authenticated`, requires a non-anonymous JWT and `auth.uid() = user_id`.
- **Live table privileges:** authenticated can SELECT, but cannot INSERT, UPDATE, or DELETE `public.user_memberships`; anon has no SELECT privilege. This confirms the browser recovery path cannot directly mutate membership rows and must use the protected server function.
- **Status:** PASS for this specific RLS/grant boundary. This is not cross-tenant adversarial E2E and does not close the overall Auth/release gate.


### 2026-10-13 — P0 security gate: platform-admin scope mismatch

- **Live read-only finding:** production `public.mnty_can_platform_admin()` still delegates to `public.mnty_can('admin', NULL, NULL, NULL)`. The live `mnty_can` implementation grants `admin` to tenant OWNER/ADMIN roles (and a permission JSON flag) when broad/null scope is used. This is not an acceptable platform boundary for future tenant users.
- **Blast radius from live catalog:** 5 SECURITY DEFINER functions reference `mnty_can_platform_admin()` (including global ad creation, digital-page fulfillment, captain application review, financial config, and the guard itself); 5 live RLS policies use the helper across `digital_pages`, `mantigo_financial_config`, and `mantigo_rate_limit_config`.
- **Current account population check:** 0 active user IDs currently have OWNER/ADMIN or an explicit `admin=true` membership path without also having an active `MNTY-PLATFORM` SUPER_ADMIN with `scope=PLATFORM` and `full_control=true`. This reduces evidence of current-user exposure but does not remove the latent authorization flaw.
- **Candidate remediation evidence:** RC449/RC462 hardening exists in draft PR #207's candidate branch. Its disposable PostgreSQL platform-admin integration passed in [Module Professionalization Validation run 38315402754](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38315402754).
- **Deployment blocker:** full disposable migration replay for PR #207 fails closed in [run 38315402728](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38315402728) because no approved isolated historical baselines exist for `public.credit_policies`, `public.credit_accounts`, and `public.credit_periods` before migration `20260920155456_harden_credit_status_authorization.sql`. Do not invent those baselines, skip the migration, or apply RC449 independently of the approved ordered migration chain.
- **Action:** keep production unchanged; track platform-admin scope as a P0 release blocker until authoritative credit schema provenance/ordered replay is resolved and the candidate guard is applied and verified through the approved release process.


### 2026-10-13 — Live RLS runtime probe (read-only transaction)

- Ran a transaction-local authenticated-context probe against live Supabase, selected an existing permanent Auth identity without exposing its ID, set JWT claims locally, switched to the `authenticated` role, queried `user_memberships`, and rolled back.
- **Observed:** 38 own membership rows visible to that identity and 0 rows for other user IDs. The transaction performed no persistent writes. This is a positive check of self-row visibility and other-user denial for that one identity; it does not establish full two-tenant/role-switch E2E.
