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


## 2026-10-15 — SESSION-002 — Read-only baseline capture connection diagnosis

- **Verified:** GitHub Actions run [38629754240](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38629754240) reaches the configured Supabase Session Pooler host `aws-0-us-east-2.pooler.supabase.com:5432`; the capture step fails with PostgreSQL `FATAL: (ENOTIDENTIFIER) no tenant identifier provided`. Later schema dump/validation/PR steps were skipped; no baseline artifact was created.
- **Verified:** The repository secret `SUPABASE_DB_URL` exists and is non-empty at workflow runtime; the earlier assumption that the secret was absent is superseded. The secret value itself is masked and was not inspected or shared in chat.
- **Inference, not yet verified:** The pooler error is consistent with a pooler username/tenant format mismatch (expected project-qualified pooler username such as `postgres.moyhiluyhjsujhwlyeuu`) or a malformed connection URI. Do not assume this is the only issue until the connection is tested safely.
- **Verified:** User shared a template direct URI containing `[YOUR-PASSWORD]`; this is a placeholder and is not a usable credential. Do not put it into GitHub Secrets.
- **Action performed:** Reviewed current workflow and job logs. Confirmed capture queries are read-only and subsequent steps are skipped on failure. No workflow rerun was started.
- **Not performed:** No production DDL/data change, GRANT/REVOKE/ALTER ROLE, password reset, Edge Function deployment, PR merge, migration execution, or release certification.
- **Next safe action:** Use Supabase Connect to copy the correct URI for the intended connection mode; validate that the username matches that mode. Before using the limited reader role, resolve its missing `supabase_migrations` USAGE/SELECT permissions and ensure its effective privileges are read-only (current PUBLIC grants on `net._http_response` and `net.http_request_queue` make it unsuitable for automation until assessed). Do not expose passwords in chat.
- **Release state:** **BLOCKED / NOT CERTIFIED**.


## 2026-10-15 — SESSION-003 — Connection URI preflight

- **Action performed:** Added a fail-closed URI shape preflight to the schema-baseline capture workflow. It validates URI protocol, host/database presence, project-qualified Session Pooler username suffix, and the obvious password placeholder without printing credentials.
- **Commit:** `801bacc69eac9a20ac6b37b0b97113fcce6a024e` on recovery branch.
- **Not verified:** The new workflow step has not run yet. This is static workflow hardening only, not proof that the secret is corrected or the database connection succeeds.
- **Not performed:** No production database mutation, role changes, password reset, migration, deployment, or merge.
- **Next step:** Correct the masked GitHub secret locally using the exact Supabase Connect URI for the selected connection mode, then manually dispatch the capture workflow with the confirmation checkbox. Review output for safe preflight pass before proceeding.
- **Release state:** BLOCKED / NOT CERTIFIED.


## 2026-10-15 — SESSION-004 — Supabase CLI installer rate limit

- **Verified:** Replay workflow run [38663014381](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38663014381) stopped at `supabase/setup-cli@v1` with `Failed to resolve latest Supabase CLI release: rate limit exceeded`. Baseline validation and replay did not run.
- **Action performed:** Changed the capture and forward-replay recovery workflows to `supabase/setup-cli@v3`, which uses npm-based CLI installation and supports `latest` per the action release notes.
- **Commits:** replay `d6a4792e11e5b2d0c6d1901b0a6393b1960e7c05`; capture `0cef596e85c5880f4c5fecb447fd7df73c07514c`.
- **Not verified:** no new run has yet proved the v3 action succeeds in this repository. No production database mutation, secret edit, migration, deployment, or merge occurred.
- **Next step:** inspect the new CI runs; then resume baseline connection correction only after CLI installation succeeds.
- **Release state:** BLOCKED / NOT CERTIFIED.


## 2026-10-17 — RC462 malformed platform-admin permission regression PASS

- **PASS:** Module Professionalization Validation [run 38992884229](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38992884229) completed successfully on exact code head `8ca3130985f15401138cfd063c26e1cc38a7851f`.
- All four jobs passed: source validation, matrimony privacy PostgreSQL, targeted-ad search-path PostgreSQL, and the new `mantigo-platform-admin-rc462-postgres` job.
- The RC462 job applied the RC449 disposable fixture, RC449 platform-scope migration, RC462 forward-only guard, and malformed-permission regression. It verifies malformed `full_control`, JSON false, and JSON string `"true"` are denied without throwing; valid explicit JSON Boolean true remains allowed; the guarded global RPCs reject invalid permission claims.
- The workflow path mismatch was corrected to use `20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql` and `supabase/tests/rc449_mantigo_platform_admin_fixture.sql`; the regression now runs through the existing core workflow.
- This is focused disposable PostgreSQL evidence, not a full chronological migration replay or live deployment. PR #248 remains draft/unmerged; production remains untouched and the release gate remains **BLOCKED / NOT CERTIFIED**.
