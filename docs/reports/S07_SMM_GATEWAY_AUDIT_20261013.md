# S07 — SMM Gateway audit (2026-10-13)

## Status

**BLOCKED / NOT CERTIFIED.** SMM must remain deferred. No production deployment, migration, provider request, campaign submission, wallet mutation, secret change, merge, or paid action was performed.

## Production observations (read-only)

- Supabase project: `moyhiluyhjsujhwlyeuu`.
- Edge Function `smm-gateway`: `ACTIVE`, version `10`, `verify_jwt=true`.
- Function SHA-256 reported by Supabase: `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`.
- Live source imports `getSmmLaunchDecision`, sets `SMM_INITIAL_LAUNCH_DEFERRED=true`, and returns HTTP 503 with `SMM_DEFERRED` before authentication/action dispatch unless the hardcoded defer is removed in a reviewed release. This audit did not remove it.
- Recent available Edge logs only showed v8 events on 2026-10-12: OPTIONS 200 and POST 403. No v10 request/log evidence was returned; therefore runtime 503 behavior on v10 is **not independently smoke-tested**.
- Read-only `information_schema.role_table_grants` inspection returned no SELECT/INSERT/UPDATE/DELETE grants for `service_role` on the inspected SMM tables; only REFERENCES/TRIGGER/TRUNCATE were listed. This is a material runtime blocker for the direct table operations in the inspected gateway path unless the privilege view omits an applicable inherited grant. Reconcile before enabling SMM; no grants were changed.
- Current `main` source `supabase/functions/smm-gateway/index.ts` did not include the launch gate and was not source-identical to deployed v10. The isolated S07 branch adds the fail-closed gate to the tracked source, but this does **not** establish full source parity with deployed v10 or resolve the other behavioral differences.

## Isolated changes

Branch: `agent/s07-smm-gateway`

Draft PR: https://github.com/islamnagy2022-eng/MantiqatiX/pull/221

Head at report time: `eabd227fe9cabce5a6979b2852d71ab89404bb62`

Files added/changed:
- `supabase/functions/smm-gateway/launch-gate.ts` — exact-string dual-flag helper, fail-closed by default.
- `supabase/functions/smm-gateway/launch-gate.test.ts` — unique tests S07_GATE_001–005.
- `supabase/functions/smm-gateway/index.ts` — hardcoded deferred constant and 503 guard before authenticated actions.
- `scripts/validate-s07-smm-gateway.mjs` — static source contract checks.
- `.github/workflows/s07-smm-gateway-contract.yml` — isolated CI workflow.

## Test evidence

- Local tool-orchestrated contract checks: **8 PASS / 0 FAIL** for helper truth-table cases, source wiring, and unique test IDs. These were static/runtime logic checks performed in the orchestration environment, not a Deno CLI run.
- GitHub Actions: no workflow run/status evidence was returned at the time of audit. CI status is **PENDING / NOT VERIFIED**.
- Live HTTP smoke test for 503: **NOT RUN**; available tooling provided read-only logs and function metadata, not a controlled authenticated POST test.
- Campaign creation, status transitions, retries, notifications, event persistence, provider timeout/SSRF behavior, spend ceilings, concurrent wallet debit, refund idempotency, and cross-tenant/client-vs-provider authorization: **NOT EXECUTED**. The hard launch gate was preserved; no real provider call was attempted.

## Release blockers

1. Do not enable SMM: hardcoded deferred gate is intentional.
2. Reconcile missing/unclear `service_role` table privileges and the complete production migration dependency chain through an approved disposable-database replay; do not apply ad-hoc grants.
3. Compare all deployed v10 files and helper dependencies byte-for-byte against a reviewed source candidate, not only `index.ts`.
4. Run CI and disposable integration tests for user/tenant/provider/admin boundaries, secret non-disclosure, spend-limit enforcement, concurrent debit/idempotency, provider timeouts and ambiguous outcomes, safe retry/refund handling, terminal-state transitions, and event/notification persistence.
5. Obtain isolated authenticated test identities and test provider credentials before any controlled runtime smoke test. No real paid campaign.
6. Keep PR #221 draft; do not merge or deploy without explicit release approval and completed gates.
