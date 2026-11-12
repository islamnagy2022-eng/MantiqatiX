# MANTIQATIX MASTER TODO — 2026-10-13

> This file restores the exact requested root-level tracking path. It is a dated status ledger, not a release certificate. Update it only with evidence from the exact tested commit and retain prior checkpoints.

## Release decision

**BLOCKED / NOT CERTIFIED**

No production migration, deployment, merge, wallet/payment mutation, production grant/RLS/Auth change, or production data mutation is authorized by this file.

## Verified status at this checkpoint

| Area | State | Evidence / caveat |
|---|---|---|
| SMM source security contract | PASS on tested code revision | Draft PR #225, workflow [#38351175629](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38351175629): static contract, service-role ACL validator, Deno type-check and unit/negative-input tests passed. The code keeps the initial SMM launch hard-disabled. The current branch has subsequent documentation-only checkpoints; rerun on the latest exact head before using as current-head evidence. |
| Live SMM deployment parity | PASS for source parity only | Read-only Supabase Edge Function source reported active version 10 and matched the SMM gateway source at PR #218 head 77012649e41fe22077538c39cd8593bf696ab33e after newline normalization. The deployed handler is hard-disabled and returns 503 SMM_DEFERRED before identity lookup/body parsing/provider/order/wallet paths. This does not prove the post-launch paths work. |
| Migration replay | IN PROGRESS / NOT VERIFIED | PR #207 current observed head at time of this file: 1b85a440a647f29428d2183f392b0ad0c63b7607. Exact-head run [#38351761328](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38351761328) was pending. Previous run [#38351334323](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38351334323) failed at missing historical policy approval_requests_scoped_read; a catalog-derived test-only policy baseline has since been added by the migration workstream. |
| Migration source provenance | BLOCKED | The replay uses clearly labeled disposable-only compatibility baselines for missing historical schema/function/policy dependencies. These fixtures help expose later migration failures; they are not recovered canonical historical DDL and do not prove production ledger/source parity. |
| MantiGO platform-wide RPC authorization | FAIL / P0 | Read-only production catalog shows get_mantigo_admin_dashboard_backend, get_mantigo_admin_financial_report_backend, settle_mantigo_captain_backend, and expire_stale_mantigo_rides_backend remain SECURITY DEFINER, use search_path=public, are executable by authenticated, and accept broad tenant roles without mnty_can_platform_admin(). Candidate hardening exists in RC449/RC462, but is not reflected in live definitions. |
| Payment callback atomicity candidate | PASS in isolated tests only | Draft PR #227 workflow [#38351020381](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38351020381) passed static-boundary and disposable PostgreSQL tests for the RC425 atomic RPC path. No live signed Paymob sandbox E2E or production rollout is certified. |
| Master todo source | RESTORED AS FILE IN THIS BRANCH | Earlier inspection did not find this exact root path. This new file is intended to become the canonical handoff after normal review; it has not been merged. |

## P0 — Security and financial integrity

- [ ] Reconcile and approve the complete post-RC424 migration batch; do not apply a feature-only subset.
- [ ] Replay the entire chronological migration history on a clean disposable Supabase/PostgreSQL environment, preserving the exact tested commit SHA and logs.
- [ ] Recover authoritative source/provenance for every missing historical table, function, and policy. Clearly labeled test-only baselines may be used only as isolated compatibility scaffolding and must not be represented as canonical migration history.
- [ ] Ensure RC449/RC462 platform-admin guards are included in the reviewed release batch; validate that all four MantiGO global RPCs call the strict platform-admin guard and use hardened search_path.
- [ ] After separately approved rollout, run the read-only verification in docs/runbooks/VERIFY_RC449_MANTIGO_PLATFORM_ADMIN_SCOPE.sql and capture live catalog evidence.
- [ ] Complete Paymob callback sandbox E2E with valid/invalid signatures, duplicate webhook delivery, event/intent association, and atomic ledger/idempotency assertions.
- [ ] Review all high-risk SECURITY DEFINER functions individually; do not bulk-revoke grants or alter public discovery RPCs blindly.

## P1 — Migration history and database

- [ ] Resolve duplicate migration timestamps and missing RC433/canonical historical source gaps without rewriting already-applied migration filenames or deleting history.
- [ ] Reconcile migration source with the read-only live ledger; previous evidence placed the ledger at RC424 version 20261008222845. Refresh this evidence before any rollout.
- [ ] Verify disposable-only baseline types against catalog evidence. The settlement_attempts baseline requires exact amount numeric(14,4) and currency varchar(8) parity; do not claim parity until validated.
- [ ] Keep test-only compatibility files out of production migration history and ensure replay CI proves exact-copy/untracked/no-data/no-grant conditions.

## P2 — SMM and marketing

- [ ] Keep SMM launch disabled until a separate reviewed post-launch release is approved.
- [ ] Add isolated HTTP-handler/runtime tests proving deferred responses do not reach auth, DB, provider, order, or wallet side effects.
- [ ] Complete mocked provider failure/timeout/redirect/ambiguous-outcome tests and verify reconciliation without automatic refunds.
- [ ] Run SMM regression workflow on the exact latest code SHA before considering the source branch accepted.
- [ ] Validate campaign, partner, CRM and marketing tenant isolation against adversarial cross-tenant test cases.

## P3 — Application quality

- [ ] Re-run user/role/tenant isolation and membership-count acceptance tests on a clean disposable environment.
- [ ] Complete end-to-end order, inventory, accounting, reporting, notification and mobile/PWA tests.
- [ ] Ensure dashboards use canonical financial ledger columns and that reports match independent SQL totals.

## P4 — Release and disaster recovery

- [ ] Run full build, type checks, unit/integration/E2E/security tests on the exact release candidate.
- [ ] Prove backup restore, recovery-point/recovery-time objectives, rollback and migration recovery in isolated infrastructure.
- [ ] Prepare a single approved chronological production rollout plan with stop/rollback conditions.
- [ ] Do not merge, deploy, apply production migrations, alter production grants/Auth/RLS, or mutate financial data without separate explicit authorization.

## Exact next actions

1. Check latest replay run #38351761328 for the current PR #207 head; record the first failure or full-replay pass.
2. Continue fixing only the first evidenced dependency in PR #207, preserving owner boundaries and not weakening the migration statements.
3. Re-run SMM regression on the exact latest code SHA; preserve its hard-disabled state.
4. Keep MantiGO P0 live authorization findings blocking release until a separately approved migration rollout and read-only post-rollout verification are complete.
5. Update this file and docs/engineering/AUTONOMOUS_CONTINUATION_20261013.md after each verified milestone.

## Safety note

A successful source check, a green PR workflow, a synthetic-baseline-assisted replay, or a migration file in Git is not proof that production is secure or migrated. Until every critical gate is evidenced on the actual release candidate and approved production state, the only valid release status is **BLOCKED / NOT CERTIFIED**.
