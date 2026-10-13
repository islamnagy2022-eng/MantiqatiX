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


## 2026-10-13 — SESSION-003 — Exact-head replay blocker traced to missing historical policy

### Exact evidence checked
- PR #207 candidate branch: `reconcile/rc425-458-current-main-20261011`, head `e7762ba79a544a6e6ece1308868649889794ec1c`.
- Disposable replay run: [38415180492](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38415180492), failed; replay checkout merge commit `e98be206a520334b9a69b93ea86fbbae4998448b`.
- Failure location: migration `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql`, statement 61; `ALTER POLICY wallet_accounts_finance_read ON public.wallet_accounts TO authenticated` failed with SQLSTATE 42704 because the policy was absent in the replay database.
- Read-only Supabase catalog inspection confirmed `public.wallet_accounts` exists with RLS enabled and forced. The current live policy is SELECT to authenticated; its USING predicate requires an active same-tenant membership and role OWNER, ADMIN, MANAGER, FINANCE, ACCOUNTANT, or FINANCE_MANAGER. The query read metadata only; no row data or production mutations.
- GitHub source search found the policy name only in the historical ALTER migration, not in an earlier committed CREATE POLICY migration. The original historical provenance is unresolved.
- The replay preflight and temporary-baseline provenance/untracked checks passed. The full replay did not pass.

### Other checks on the same PR #207 head
- Migration Version Uniqueness: [38415183077](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38415183077) — PASS.
- Open PR Migration Collision Guard: [38415181890](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38415181890) — PASS.
- Migration History Immutability: [38415180384](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38415180384) — PASS.
- These targeted passes do not override the failed full replay.

### Decision and next action
- Do not change production, do not fabricate a historical CREATE POLICY migration, and do not claim historical replay fidelity.
- Search RC40/recovered source and other authoritative historical artifacts for the original policy definition.
- If no authoritative source is available, keep replay blocked pending explicit approval for a test-only live-derived compatibility fixture, clearly marked as non-historical and never applied to production.
- Production release state remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — RC40 source provenance check

### Work performed
- Inspected the supplied `source_RC40.zip` and read `docs/RC40_SCHEMA_RECONCILIATION.md`.
- Searched all SQL migrations within that archive for `wallet_accounts_finance_read` and `marketing_project_participants`; no source hits were found.
- Confirmed the RC40 reconciliation note explicitly disclaims full historical migration-graph equivalence with the current live schema.
- Earlier read-only live catalog evidence for `wallet_accounts` showed RLS enabled and forced, an authenticated SELECT policy with active same-tenant finance-role checks, and service_role grants including DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, and UPDATE. This was metadata-only; no wallet rows were read or changed. Do not revoke these live privileges as part of this source investigation.

### Result
- The missing original policy definition has not been recovered from the provided RC40 archive or repository search. This is not authorization to invent a historical migration or silently normalize production state.
- Full replay remains BLOCKED at `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` because `wallet_accounts_finance_read` is missing from the disposable replay database at the point the migration alters it.
- No production change, merge, deploy, live ACL mutation, or financial transaction was performed.

### Next action
1. Seek authoritative historical source/backup for the original `wallet_accounts_finance_read` policy and the marketing participant table.
2. If unavailable, request explicit approval for a test-only, live-derived compatibility fixture in disposable CI only, with provenance limitations stated in the artifact and TODO.
3. Rerun full replay only after resolving the source gap; never label synthetic-baseline replay as historical fidelity.
4. Release remains **BLOCKED / NOT CERTIFIED**.
