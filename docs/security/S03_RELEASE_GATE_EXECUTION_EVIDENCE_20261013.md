# S03 / RC40 Release Gate Execution Evidence — 2026-10-13

## Decision

**Release state: BLOCKED — NOT CERTIFIED.** This record separates checks that actually ran from static review, missing environment, and unresolved evidence. A checked box is not a test result.

## 1. S03 SECURITY DEFINER on isolated PostgreSQL

**Status: BLOCKED — NOT RUN.**

- Contract script: `supabase/tests/security/s03_security_definer_contract.sql`.
- Diagnostic script: `supabase/tests/security/s03_security_definer_diagnostics.sql`.
- Both files are committed on `security/s03-audit-isolated-20261013`; they are not proof of execution.
- The Supabase project currently has only the `main` database branch. No isolated Supabase branch has been created, and the local execution environment available in this session has no `psql`, PostgreSQL server, Docker, or Deno binary.
- A Supabase development branch was quoted at **US$0.01344/hour**. Creation is pending explicit cost confirmation; production was not used for these tests.
- The customer-ride output contract currently flags full-row serialization patterns `to_jsonb(b)` / `to_jsonb(f)`; this is an expected regression assertion, not a passing test.

## 2. Payment concurrency and late callbacks

**Status: PARTIAL — isolated SQL regression evidence passed; runtime/concurrency edge cases remain open.**

- [S06 Payment Integrity Regressions run](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38340039810): **PASS** on PR #220 head `00579d0138f1e135dd4da9d400128afc16b879f8`. The job created disposable PostgreSQL roles, loaded the RC431 fixture, applied RC431, and ran `supabase/tests/s06_payment_integrity_regression.sql`.
- [Recovered Migration Focused Integration run](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38340039894): **PASS**; its isolated jobs included RC425 MantiGo/Paymob atomicity, RC431 payment binding, RC435 subscription intent, and other focused DB integrations.
- [SMM Service Role Access Boundary run](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38340039923): **PASS**; source validation, Deno type-check/tests, and disposable PostgreSQL ACL integration passed.
- These results do **not** establish that the live Edge Functions were invoked under concurrent requests. Generic Paymob late-failure ordering, subscription failure event persistence, zero-row update handling, storage failure after provider intent creation, and request-body limits still require explicit adversarial coverage.
- The S06 run is scoped to the commit above; do not infer provider-sandbox or real-payment validation from it.

## 3. SMM source parity and release path

**Status: SOURCE PARITY PASS; RELEASE GATE REMAINS CLOSED.**

- Live `smm-gateway`: ACTIVE version 10, `verify_jwt=true`, bundle SHA-256 `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`.
- All seven deployed source files were compared byte-for-byte with `test/s06-payment-integrity-20261013`: `index.ts`, `launch-gate.ts`, `provider-transport.ts`, `order-status.ts`, `catalog-normalization.ts`, `order-validation.ts`, and `request-validation.ts`. **All seven matched.**
- The [SMM access-boundary CI run](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38340039923) passed on the same PR head.
- The branch is PR #220, still a draft and not merged. The source is not yet on `main`.
- The hard-coded `SMM_INITIAL_LAUNCH_DEFERRED=true` gate remains active; SMM actions return `503 SMM_DEFERRED`. This is a deliberate safety gate. No deployment or gate change was made.

## 4. Role and tenant isolation

**Status: PARTIAL — focused integration evidence passed; full matrix not yet proven.**

- [SMM Service Role Access Boundary](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38340039923): PASS.
- [MantiGO Open Ride Privacy Boundary](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38340040005): PASS.
- The focused migration integration suite also passed its platform-admin, payment binding, MantiGO atomicity, and ERP branch-scope jobs in [run 38340039894](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38340039894).
- This is not a full proof for every combination of anonymous, ordinary authenticated user, tenant A/B, provider, and platform administrator across all exposed RPCs/tables. The S03 live-catalog contract remains unexecuted pending isolated DB setup.

## 5. Backup/restore and monitoring

**Status: RESTORE NOT PROVEN; MONITORING REVIEW FOUND ITEMS TO INVESTIGATE.**

- No restore was initiated. The available connected Supabase actions do not provide a safe, isolated restore-from-backup verification path; restoring the production project would be unsafe. A controlled restore test must target a separate disposable project/environment and verify schema, row counts/checksums, auth/storage requirements, and application smoke tests.
- Read-only unified-log query returned 884 entries in the available window across edge, connection-pool, database, storage, auth, PostgREST, and function sources.
- Message-level triage found nine occurrences of `Warp server error: Thread killed by timeout manager`, and one PostgreSQL `syntax error at or near "with"` occurrence. These are log-message counts, not confirmed incidents or a full alert audit; correlate timestamps, endpoints, and query plans before classifying.
- Backup schedule/retention, PITR eligibility, restore-point selection, alert delivery, on-call ownership, and recovery-time/recovery-point objectives have not been independently evidenced here.

## Clean migration replay gate

[S04 Migration Chain Clean Replay run](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38340039976): **FAIL / BLOCKED**. The source audit found five duplicate migration-version groups: `20260928020000`, `20260928060000`, `20260928190000`, `20260928200000` (three files), and `20260928210000`. It found no missing entries from its explicit required-source list; RC433 is marked `NOT_FOUND_NOT_VERIFIED_GAP`, not proven to be a missing deployed migration. Separately, `supabase start` failed because pulls from `public.ecr.aws/supabase/*` were rate-limited (`toomanyrequests: Rate exceeded`), so `clean_replay_exit=NOT_RUN`. A read-only production ledger query returned 283 recorded migrations with latest version `20261008222845`; none of the five duplicate version values appeared in the queried ledger. Do not rename/resequence source migrations until the complete migration-source/ledger reconciliation establishes the correct mapping. This run did not prove a clean full-chain replay.

## Safety boundary

No production migrations, grants/revokes, data writes, live webhook calls, real payment/provider calls, SMM deployment, PR merge, or production restore were performed as part of this evidence update.

## Required next gates

1. Obtain explicit approval for the quoted Supabase development-branch cost, create the isolated branch, and run both S03 SQL scripts there; preserve raw CI output and classify expected regression failures separately from environment failures.
2. Add/run adversarial payment tests for concurrent duplicate events, late failure after success, subscription replay, storage failure, and zero-row conditional updates; distinguish SQL fixture tests from Edge Function/runtime tests.
3. Keep SMM deferred until PR review, merge, deployment parity, and post-deployment smoke tests are independently approved.
4. Expand the role/tenant matrix to anon, user, cross-tenant user, provider, and platform admin for every sensitive RPC/table.
5. Fix S04 source-audit/startup blockers and achieve a clean migration replay.
6. Run a documented restore drill in an isolated project and verify recovery evidence; inspect timeout logs and alert delivery before release certification.
