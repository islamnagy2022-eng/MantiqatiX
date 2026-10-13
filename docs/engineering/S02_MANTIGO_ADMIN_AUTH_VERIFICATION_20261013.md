# S02 — MantiGO Admin Authorization: Migration & Verification Notes
Date: 2026-10-13
Branch: `agent/s02-mantigo-admin-auth`
Related release PR: #218 (Draft; unmerged)
Supabase project: `moyhiluyhjsujhwlyeuu`

## Decision / status
**BLOCKED / NOT CERTIFIED for production.** This branch adds regression assertions only. It does not apply a migration or change production state.

## Evidence observed before editing (read-only production catalog)
The four target functions were observed as `SECURITY DEFINER`, `search_path=public`, with EXECUTE granted to `authenticated`. Their current definitions do not invoke `mnty_can_platform_admin()`. The live helper delegates to `mnty_can('admin', NULL, NULL, NULL)`; that permission helper includes tenant role/permission paths, so it is not proof of platform-wide authority. Client parameter `p_admin_user_id` is not an authority source; it can only be checked against server-derived `auth.uid()`.

The PR candidate RC449 defines a strict platform guard using the current authenticated identity's active membership with tenant `MNTY-PLATFORM`, role `SUPER_ADMIN`, and explicit platform/full-control permissions; the four RPCs call that guard, use an empty `search_path`, and retain the expected `authenticated` entrypoints while revoking `PUBLIC`/anon. RC462 replaces unsafe boolean text casting with JSON containment so malformed `full_control` fails closed. These source files are proposed candidates, not evidence of production remediation.

## Test additions in this S02 branch
Extended `supabase/tests/rc449_mantigo_platform_admin_integration.sql` to assert that:
- No JWT subject (anonymous/unauthenticated context) cannot call any of the four privileged RPCs even when passing the UUID of the valid platform admin.
- A tenant owner's authenticated identity cannot impersonate the platform admin by passing that other UUID as `p_admin_user_id`.
- Rejected spoof/unauthenticated settlement and expiration calls do not mutate the fixture ledger/ride state.
- Existing integration cases continue to test tenant OWNER/ADMIN/OPERATIONS_MANAGER and tenant-scoped SUPER_ADMIN denial, explicit platform SUPER_ADMIN access, response JSON keys, settlement replay safety, expiry bounds, and intended grants.

The static validator now requires these new cases to be present. The existing workflow already selects the changed test and validator paths and runs the fixture/migrations/behavioral SQL in a disposable PostgreSQL 16 service.

## Compatibility and response contract
The candidate functions retain their existing RPC signatures and JSON response shape:
- Dashboard: existing KPI keys including `rides_total`, `open_requests`, `revenue`, `commission`, `captain_earnings`, `paid`, `unsettled`.
- Financial report: `ledger_count`, `gross`, `commission`, `captain_amount`, `paid_count`, `paid_amount`, `settled_count`, `settled_amount`, `unsettled_count`, `unsettled_amount`, `from`, `to`.
- Settlement: `ride_id`, `settlement_status`, `settlement_reference`, `provider_result`, `idempotent`.
- Expiration: `expired_count`, `age_minutes`.
Authorization failures intentionally raise existing explicit error identifiers such as `USER_CONTEXT_MISMATCH`, `AUTH_REQUIRED`, and `PLATFORM_ADMIN_REQUIRED`; callers should treat them as errors, not success payloads.

## Safe migration / rollout plan
1. Reconcile candidate migration order with the production ledger first. At the last observed read-only check, production had 283 ledger rows ending at `20261008222845 / rc424_atomic_digital_page_payment_webhook`; RC449, RC462, RC522, and RC523 were not recorded as applied. Do not apply a candidate based only on source presence.
2. Run the exact ordered RC449 → RC462 → RC523 disposable PostgreSQL workflow and all relevant migration-chain checks on the final code SHA. Verify malformed permissions, anonymous access, forged IDs, tenant isolation, JSON contract, and no side effects on denied mutation calls.
3. Review production catalog/ACL and the full migration chain; obtain explicit approval through the normal release process before any live application. Apply forward-only in a controlled window, then run read-only catalog checks and authenticated/anonymous runtime probes without invoking settlement/expiry against real data.
4. Keep settlement and expiry operationally disabled/withheld until the auth guard is confirmed in the applied production definitions.

## Rollback / recovery
Do **not** roll back to the old vulnerable function bodies or restore tenant-role authorization for platform-wide RPCs. If a staged rollout fails, stop further rollout and use a forward-fix migration that restores the last reviewed safe implementation. For immediate containment, an approved operator may temporarily revoke EXECUTE from `authenticated` for only the four exact signatures; this is an outage/containment option requiring separate authorization and is not performed by this branch. Preserve the migration ledger; do not rewrite applied history.

## Risks / open gates
- `SECURITY DEFINER` remains intentional for these RPCs and must be paired with the strict in-function platform guard and empty `search_path`; it does not by itself establish authorization.
- The live production helper and four RPC definitions remain vulnerable until the approved migration is applied and verified.
- The integration fixture uses a test-only journal writer; it verifies authorization and local state transitions, not real accounting, bank transfers, external payment settlement, production RLS behavior, or live tenant isolation.
- A successful CI run proves only disposable PostgreSQL behavior for the tested commit. Full chronological migration replay, exact production parity, runtime E2E, backup/restore, and release gates remain separate.
- Do not perform settlement/expiry RPC calls against production as tests.

## Evidence status
- Scope registration committed before implementation edits.
- Production inspection: read-only, completed.
- Regression test/validator changes: committed on the S02 branch.
- PostgreSQL execution for the new tests: **PENDING CI / NOT VERIFIED** until a completed run for the exact S02 code commit is observed.
- Production migration, grant/RLS/Auth changes, merge, deployment, and financial/operational mutations: **NOT PERFORMED**.

## Follow-up after CI attempts (2026-10-13)
- CI run `38336820460`: static contract passed; PostgreSQL integration failed at the authorized settlement call with `PLATFORM_ADMIN_REQUIRED`.
- CI run `38336966802`: static contract passed (23/23); the same PostgreSQL failure persisted. The integration test changes `request.jwt.claim.sub` several times inside one top-level DO block, while the disposable fixture's `auth.uid()` was marked STABLE; this did not faithfully model distinct HTTP requests.
- The disposable fixture's `auth.uid()` was changed to VOLATILE. This is test-only and does not alter production Auth.
- The next attempt still needed a guard correction: RC462 now marks `mnty_can_platform_admin()` VOLATILE as well, so the request-scoped identity is re-evaluated on every call in the multi-identity test session. RC462 also uses JSON containment to fail closed for malformed permission values rather than casting arbitrary text to boolean.
- Static contract validation last passed 24/24 checks. This is static evidence only, not a behavioral pass.
- Exact code commit under test: `98d54666a463847500ca65fa45b74652bf7e7fc7`. Workflow run [38337855864](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38337855864) is still `queued`; its job `platform-admin-postgres` has no steps/logs yet. No PostgreSQL behavioral result is available, and no pass is claimed.
- PR #219 remains open and draft. Its latest metadata reports `mergeable=false`; the base branch advanced after the recorded merge base, so do not merge until branch synchronization/conflict state is resolved and rechecked.
- Production remains **BLOCKED / NOT CERTIFIED**. The live catalog recheck in PR #218 found the four deployed platform-wide RPC definitions do not invoke `mnty_can_platform_admin()` or raise `PLATFORM_ADMIN_REQUIRED`. No production migration, grants/RLS/Auth changes, settlement/expiry operations, merge, or deployment has been performed.
- Next gates: obtain a completed focused CI run for the exact code commit; resolve PR base divergence without rewriting production migration history; run the full chronological clean replay and migration-uniqueness audit; only then pursue separately approved production remediation and read-only post-release verification.
- Follow-up workflow wiring correction committed as `e5c845879f322583537f083abe7a0359cffc3857`: the RC523 canonical financial-report migration is now also included in the workflow's `push` path filters, matching its existing pull-request filter. The new PR-triggered workflow run `38338507340` is queued at the latest check; no job steps or behavioral result have been observed yet. The older run `38337855864` also remains queued. This wiring change does not establish test success or production remediation.
- Workflow run `38337855864` has now completed: static contract passed **25/25**, and the RC462 malformed-permissions regression passed, but the main PostgreSQL integration failed at the authorized settlement call with `PLATFORM_ADMIN_REQUIRED`. This is a behavioral failure, not a release pass.
- Follow-up test-fixture correction: the disposable `auth.uid()` helper was changed from SQL VOLATILE to PL/pgSQL VOLATILE to prevent SQL-function inlining while the test simulates multiple JWT subjects inside one DO block. The static validator was updated to assert this property. Commits: `c8547b4eba46310ffe090db4d4316a00fdc53e47` and `0e2b54dcd104adcef98cc2156838bf1c092e7ec4`. This is a hypothesis-driven test-fixture fix only; it is **not verified** until a new PostgreSQL run completes.
- Workflow run `38338507340` remains queued at the latest observation and was created before the fixture correction. Do not treat it as verification of the newest commits. PR #219 remains draft and mergeability is false; no merge or production mutation was performed.
- After the fixture correction, pull-request workflow runs were created for successive heads: `38338985945` (fixture change), `38338994894` (validator change), and `38339004814` (latest documentation/head `58be6adcc7936d89acd856ce4850f5bc0dd7b171`). All three are queued at this observation; none verifies the corrected fixture yet. The earlier run `38338507340` also remains queued on an older head. Track only a completed run whose checkout includes the PL/pgSQL fixture and validator commits before deciding whether the fix worked.

- Latest log extraction confirms the failure is raised at line 11 of `settle_mantigo_captain_backend` as `PLATFORM_ADMIN_REQUIRED`; the guard had returned true earlier in the same integration block. The cause is still unresolved. Commit `91fad5914abb8ea4ec688b38aa00c95fe9c221ca` adds disposable-test-only assertions immediately before the authorized settlement call to distinguish identity drift from a guard/membership mismatch and emit focused diagnostic context. This is diagnostic instrumentation, not a production fix; await an exact-head completed PostgreSQL run.


## Follow-up after diagnostic workflow — 2026-10-13

The latest diagnostic PostgreSQL runs (38339850312 and 38339857225) still fail at the authorized settlement call with PLATFORM_ADMIN_REQUIRED. The new pre-call assertions did not fail: the disposable session identity and the direct call to mnty_can_platform_admin() pass immediately before the nested SECURITY DEFINER RPC. This narrows the failure to a difference during nested RPC execution or its resolved function context; it does not yet identify the root cause.

A bounded candidate change was made to RC462: the request-context guard now uses a VOLATILE PL/pgSQL body instead of a SQL-language function, to prevent any SQL-function inlining and make the identity lookup explicit inside the function body. The static validator was updated to require this exact contract. This is a hypothesis to test, not a verified fix.

- No production migration was applied.
- No live role, grant, RLS policy, auth setting, or financial row was changed.
- The candidate migration must pass malformed-permission tests and the full PostgreSQL integration test at the new head before it can be considered.
- Production remains BLOCKED / NOT CERTIFIED.


## Follow-up checkpoint — missing JWT subject fails closed explicitly

A disposable PostgreSQL run with temporary diagnostic detail established that the earlier failure occurred on the unauthenticated settlement path: `auth.uid()` was empty, and the condition `p_admin_user_id <> auth.uid()` did not reject it because SQL comparisons with `NULL` evaluate to unknown. The call then reached the platform-admin guard and returned `PLATFORM_ADMIN_REQUIRED` instead of the expected identity-context rejection.

Corrective candidate change:
- `settle_mantigo_captain_backend` now explicitly rejects `auth.uid() IS NULL` before comparing the supplied actor ID.
- `expire_stale_mantigo_rides_backend` has the same explicit null-identity rejection.
- The temporary diagnostic detail was removed from the candidate migration before the next test run.
- Static validation now includes a check requiring both null-identity guards.

This change is isolated to the draft migration branch. No production migration was applied. The PostgreSQL integration run for commit `78392b149b25b9d72ebfdb6aae378f0441da9925` was still running at report time; the fix is not certified until the complete behavioral test passes on the final head.


### Additional correction — canonical report migration override

A follow-up inspection found that RC523 replaces the financial-report RPC after RC449/RC462 in the disposable workflow. Therefore, fixing only the earlier RC449 definition would not fix the final function under test. The candidate RC523 definition has now also been changed to assign `v_auth := auth.uid()` at function execution time and explicitly reject a null actor ID. RC449's dashboard/report identity reads are likewise assigned at execution time, and the static validator now checks the RC523 override.

Relevant candidate commits:
- RC449 null identity and runtime identity assignment: `78392b149b25b9d72ebfdb6aae378f0441da9925` and `c2ba10570405f36d6f816a9eb0bd90454509c194`.
- RC523 canonical report runtime identity: `d7a9b141b3dc01b5e2d8d6ce4e36d10054572f2c`.
- Static validation of the RC523 override: `30e479e42627f6e79aef463081fe1d173a699eb1`.

The final-head PostgreSQL integration result is still pending; no production migration has been applied.
