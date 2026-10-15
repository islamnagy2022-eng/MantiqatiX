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
