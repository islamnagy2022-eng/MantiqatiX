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


## 2026-10-12 — SESSION-002 — P0 SMM deferral hardening (candidate branch only)

- **Decision basis:** issue #212 states that the separate SMM storefront, provider ordering, wallet/refunds, and provider administration are deferred until after initial core launch. The internal Marketing & Advertising module remains in scope.
- **Branch:** `fix/p0-defer-smm-before-core-launch-20261012`, based on `8a56358d505d2c12878440037f7f24ba65d2ea10`.
- **Implemented:** `supabase/functions/smm-gateway/index.ts` now rejects all non-OPTIONS requests with `SMM_DEFERRED`/503 unless `MNTY_SMM_ENABLED` is exactly `true`, before user authentication or any action routing.
- **Implemented:** `web/smm.html` is now a static holding page with no `smm.js`, Supabase browser SDK, or config script. `web/app.js` no longer embeds the SMM storefront; desktop/mobile navigation labels SMM as coming soon; internal Marketing & Advertising remains.
- **Testing:** `scripts/validate-smm-deferred-gate.mjs` added to the Pages workflow. Validator passed against current source; `web/home.js` and `web/app.js` parse checks passed. CI on the final candidate commit is still required.
- **Production impact:** none. No live Edge Function deploy, environment setting change, merge, database migration, provider call, or wallet transaction. The live production SMM gateway has NOT been verified disabled; issue #212 stays OPEN until deployment and negative tests are explicitly authorized and completed.
- **Release state:** BLOCKED / NOT CERTIFIED. Do not merge/deploy without release approval and required gates. Do not set `MNTY_SMM_ENABLED=true` for the initial launch.
- **Next action:** run CI on the completed candidate branch, inspect the exact run results, then prepare a reviewable PR. After explicit authorization, deploy only the default-deny gateway and perform anonymous/authenticated negative tests against the live endpoint.


## 2026-10-12 — SESSION-003 — Unify SMM deferred-launch flag contract

- **Verified:** PR #216 source used `SMM_LAUNCH_ENABLED`, while adjacent SMM candidate PRs #214/#215 used `MNTY_SMM_ENABLED`; this created a deployment/configuration contract mismatch across draft branches.
- **Action:** standardized the P0 deferred gateway, its source validator, and continuity/TODO/log references on the exact server-side flag `MNTY_SMM_ENABLED === "true"`, matching the existing adjacent candidate contract. Default remains disabled unless explicitly set to exact string `true`.
- **Scope:** source branch only; no production environment variable was changed, no Edge Function was deployed, no PR was merged, and no database or wallet operation occurred.
- **Verification pending:** rerun GitHub Actions on the new head, inspect the exact checks, and verify no remaining conflicting flag names in the changed source/docs. Live SMM disablement is still NOT VERIFIED.
- **Release state:** BLOCKED / NOT CERTIFIED.


## 2026-10-12 — SESSION-004 — Read-only production ACL verification

- **Query:** read-only PostgreSQL inspection using `has_table_privilege`, `pg_class.relacl`, and RLS flags for SMM tables plus `public.digital_page_payment_events`.
- **Observed:** sampled SMM tables (`smm_orders`, `smm_wallets`, `smm_wallet_transactions`, `smm_order_events`, `smm_providers`, `smm_services`) show `service_role` ACL `Dxtm` only; SELECT/INSERT/UPDATE are absent. Sampled anon/authenticated direct SELECT/INSERT privileges are absent.
- **Observed:** `digital_page_payment_events` has RLS enabled, no direct `service_role` SELECT/INSERT/UPDATE/DELETE privilege, and ACL `{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}`. This remains a verification item, not a confirmed defect, until the deployed payment Edge Function/RPC access path is traced.
- **Cross-check:** candidate RC456 migration provides narrow grants for SMM table access and keeps provider credentials/wallet ledger RPC-only, but RC456 is not present in the previously verified production migration ledger through RC424. Do not apply it separately from full migration reconciliation.
- **Not performed:** no production DDL, ACL grant/revoke, Edge Function deployment, wallet action, or PR merge.
- **Next:** inspect the deployed digital-page payment function and RPC contract; continue exact migration provenance recovery. Full release remains BLOCKED / NOT CERTIFIED.


## 2026-10-12 — SESSION-005 — Payment-event RPC boundary follow-up

- **Verified fact:** the live function catalog reports `public.process_verified_digital_page_payment_backend` as SECURITY DEFINER, with `search_path=public, pg_temp`; EXECUTE is granted to `service_role` only; catalog metadata indicates its definition references `digital_page_payment_events`.
- **Interpretation:** direct `service_role` table grants are not necessarily required for this event table because the backend RPC mediates access. Do not add direct grants based on the table ACL alone.
- **Limitation:** the attempt to retrieve the complete function definition was blocked by safety controls; atomicity/body review and end-to-end webhook verification remain NOT VERIFIED.
- **Production impact:** none; read-only catalog metadata only.
- **Release state:** BLOCKED / NOT CERTIFIED.
