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


## 2026-10-17 — SESSION-REMEDIATION — RC565 MantiGO financial report source fix (review required)

- **Live evidence:** Supabase project `moyhiluyhjsujhwlyeuu` reported 283 applied migrations through `20261008222845` (RC424). Do not infer later migrations are applied.
- **Live schema evidence:** `public.mantigo_financial_ledger` contains `gross_amount`, `commission_amount`, and `captain_net_amount`; the deployed `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)` references nonexistent `amount` and `captain_amount`.
- **Live authorization evidence:** deployed report RPC authorizes broad tenant roles and does not require platform scope. The existing RC449 source has a platform-admin predicate but still contains the bad amount-column references.
- **Change authored on branch:** `fix/mantigo-financial-report-columns-20261017`. Added forward migration `20261017100000_rc565_mantigo_financial_report_column_scope_fix.sql`, which uses the live ledger columns, requires `public.mnty_can_platform_admin()`, rejects invalid time windows, sets an empty search_path, and explicitly grants EXECUTE only to authenticated after revoking PUBLIC/anon.
- **CI source contract:** added `scripts/validate-mantigo-financial-report.mjs` and wired it into `.github/workflows/pages.yml`. This checks source markers only; it is not proof of PostgreSQL execution.
- **Commit sequence:** `0b7e3c10f5ff5c54f6cec4aea636a833f525df0a` (migration), `bc29518478a75c4e90c5b328c33075d05901a29a` (contract test), `92e4dba1e604523ad9389ea33b3545cda82c50eb` (workflow).
- **Not performed:** no migration was applied to Supabase production; no live function was replaced; no payment or settlement was created; no PR was merged; no production deployment was approved.
- **Still required:** execute the new source-contract test in CI; run migration on isolated PostgreSQL against a representative schema and test authorized/unauthorized actors and empty/boundary date windows; validate all migration-chain dependencies; then open/update a reviewed PR. Production gate remains **BLOCKED / NOT CERTIFIED**.

- **Local source-contract test:** ran the fetched RC565 migration and validator in a scratch Node.js environment; result: `RC565 MantiGO financial report source contract: PASS`. This is static/source evidence only, not PostgreSQL execution.
- **Draft PR opened:** [#282](https://github.com/islamnagy2022-eng/MantiqatiX/pull/282), head branch `fix/mantigo-financial-report-columns-20261017`, head SHA at PR creation `75c1f5ad3abf90a0c51cfe10c890c5194ea41743`. The PR includes 16 recovered historical migration sources and RC565; keep draft because the RC434 authoritative-source collision and full replay remain unresolved.
- **GitHub checks:** no status checks/workflow runs were returned for head SHA at the time of this check. Do not treat CI as passed.
