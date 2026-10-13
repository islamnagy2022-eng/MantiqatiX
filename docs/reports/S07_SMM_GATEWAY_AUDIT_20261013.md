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


## Follow-up checkpoint — helper-level safety tests added

Date: 2026-10-13

Added isolated Deno test files for the helper modules already matching deployed v10:
- `provider-transport.test.ts`: provider hostname allowlist, HTTPS/credentials/port/private-host rejection, response status/content type, invalid/oversized JSON, and balance normalization.
- `order-validation.test.ts`: idempotency-key requirement, unsafe target URLs, invalid quantities, non-positive margin, and money bounds/precision.
- `order-status.test.ts`: terminal-state preservation, known provider status normalization, and unknown-state preservation.
- `catalog-normalization.test.ts`: new services stay inactive/zero-priced, existing reviewed prices are retained only with margin, malformed rows are rejected, and arbitrary provider metadata is not persisted.

Updated `.github/workflows/s07-smm-gateway-contract.yml` to run `deno test --no-check supabase/functions/smm-gateway/*.test.ts`, so these helper tests run alongside the seven launch-gate tests. The workflow then still runs the source-parity validator. **The helper tests have been committed but have not yet been confirmed by a completed CI run.** Even if they pass, they do not cover gateway integration, real database transactionality, wallet/provider ambiguity, or prove the branch entrypoint matches v10.

The active production function and database remain unchanged. Keep the hard defer gate and PR #221 draft; do not merge or deploy until the entrypoint parity gap and isolated integration-test blockers are resolved.


## Follow-up — isolated integration matrix

Added [`S07_SMM_INTEGRATION_TEST_MATRIX_20261013.md`](./S07_SMM_INTEGRATION_TEST_MATRIX_20261013.md) to define 18 deterministic cases covering the deferred gate, auth/tenant boundaries, catalog and order validation, idempotency/concurrent wallet spending, ambiguous provider/debit outcomes, refunds, SSRF/redirects, status transitions, event persistence, redaction, and spend ceilings. This is a test plan, not execution evidence. Every integration case remains unrun until a disposable environment and mock provider are available. The entrypoint parity gap remains a blocker; PR #221 stays Draft and production remains unchanged.


## Latest CI checkpoint — 2026-10-13

- Draft PR #221 remains open, unmerged, and Draft.
- S07 workflow run [38341031755](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38341031755) was observed in **queued** state for commit `9778eb800beeab47573fec73c777652f1666b25e`; its job was also queued when checked. No test result is available yet.
- Other repository workflows observed on the same commit were also queued. No deployment or production change is inferred from a queued workflow.
- The integration matrix is documentation only; none of its 18 cases should be counted as executed.


## Follow-up checkpoint — bounded request parser tests added

Date: 2026-10-13

Added `supabase/functions/smm-gateway/request-validation.test.ts` (commit `1f269b2e6859daf34912d5451a7093db9a8bb191`) with five uniquely named cases:
- accepts JSON object bodies and vendor `+json` media types;
- rejects missing/unsupported content types;
- enforces declared and streamed byte limits and rejects malformed content-length;
- rejects malformed JSON, invalid UTF-8, arrays, and primitive JSON values;
- rejects missing request bodies.

This test file is included by the existing `deno test --no-check supabase/functions/smm-gateway/*.test.ts` workflow glob. It has **not** been run locally or confirmed by completed CI.

## CI status rechecked

At this checkpoint, workflow run [38341065311](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38341065311), associated with PR head `6e24a9e4a0c5971fe7cf18a924d1dbbfe2ef5a50`, and its S07 job were still **queued**. This run predates the new request parser test commit, so it cannot validate that test. Do not count any of the newly added helper tests as passing until a completed run on a commit containing them is inspected.

The source-parity validator remains intentionally fail-closed: current `index.ts` lacks imports for the v10 safety helpers and retains the legacy automatic refund path. No validator relaxation, entrypoint overwrite, merge, deployment, secret update, migration, provider call, campaign submission, or wallet mutation was performed. PR #221 remains Draft and **BLOCKED / NOT CERTIFIED**.


## CI run for request parser test commit

The S07 contract workflow run [38341127397](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38341127397), associated with commit `1f269b2e6859daf34912d5451a7093db9a8bb191` (the new request parser tests), was returned as **queued** on recheck. No test or validator outcome is available yet. The documentation-only commit after it does not itself trigger the workflow because the workflow path filter excludes this report. Wait for a completed run on the test commit or a later code commit before recording test results.


## Additional helper boundary tests — pending CI

Two existing helper test files were expanded on the S07 branch:
- `catalog-normalization.test.ts`: invalid/negative provider costs, invalid min/max quantity bounds, maximum quantity cap, and bounded/cleaned service text.
- `order-validation.test.ts`: malformed/oversized idempotency keys, oversized service identifiers, rounded-to-zero charge, and pricing overflow.

The changes are committed as `da2a1168210a55c810b24aab58ff57329aef8a69` and `30d65a6492e8dccbe2ce037e67104072fe592d2e`. These tests have not been executed locally. A workflow run for the latest test commit was not returned by the commit-run lookup at this checkpoint; do not infer success or failure from the missing result. Previously observed S07 run `38341127397` was queued and predates these additional test cases.

The source-parity blocker remains unchanged. Do not treat more unit tests as a substitute for reconciling `index.ts`, or for disposable integration tests of DB transactions, concurrent idempotency, wallet/provider ambiguity, and authorization.


## Test-fixture correction — provider allowlist positive case

Reviewing the queued test suite uncovered a fixture bug in `provider-transport.test.ts`: its positive allowlist case used `api.provider.example`, but the helper intentionally rejects reserved `.example` hostnames. That would make the supposed valid-host test fail for the reserved suffix rather than exercise the allowlist success path. The fixture now uses `api.provider.com` for the positive HTTPS host in commit `af236d64ed4a4ba3fac04542a6c5eb5bdf41b3a4`. Reserved-host rejection cases remain unchanged. This is a test fixture correction, not a change to provider URL policy. CI is still required to verify the suite.
