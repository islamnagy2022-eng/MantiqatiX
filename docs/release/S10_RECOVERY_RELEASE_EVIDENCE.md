# S10 — Disaster Recovery, Monitoring & Release Gate Evidence

**Observed:** 2026-10-13 (UTC)  
**Session:** S10  
**Repository:** `islamnagy2022-eng/MantiqatiX`  
**Reference PR:** [#218](https://github.com/islamnagy2022-eng/MantiqatiX/pull/218)  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Decision:** **BLOCKED / NOT CERTIFIED**

> This is an evidence checkpoint, not a production certification. Checks below distinguish direct observations from older documentation and unverified requirements. No production writes, migrations, settings changes, deployments, restores, merges, or financial mutations were performed.

## 1. Repository and release status

- PR #218 was observed **OPEN, DRAFT, and not merged**.
- The PR head observed during this inspection was `ac5948580af69b97a17ef8b5e90c1e67f0b006e2`; base `main` was `8a56358d505d2c12878440037f7f24ba65d2ea10`.
- Exact-head Actions lookup returned multiple CI runs in **QUEUED** state, including S04 migration-chain clean replay, focused recovered-migration integration, MantiGO platform-admin scope, migration immutability/uniqueness, SMM boundary, and other release gates. These are pending, not passed.
- [Deploy MantiqatiX Web run 38337580710](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38337580710) completed with conclusion **cancelled** for the observed head. This is not a successful deployment.
- Earlier green runs on other commits are historical branch evidence only and are not promoted to evidence for this head.

## 2. Direct read-only production observations

### Supabase project health
- Project status: `ACTIVE_HEALTHY`.
- PostgreSQL version reported by project metadata: `17.6.1.155`.
- This establishes service-level health at inspection time only. It does not establish application readiness, data correctness, backup recoverability, or release readiness.

### Migration inventory
- Supabase migration inventory returned **283** entries.
- Latest returned migration: `20261008222845 / rc424_atomic_digital_page_payment_webhook`.
- RC449, RC462, RC522, and RC523 are not recorded in the prior live-ledger evidence and were not confirmed applied by this inspection. Reconcile each candidate with the current authoritative migration inventory before any release action.
- No production migration was applied as part of this S10 run.

### Edge Function inventory
Selected deployed functions were reported ACTIVE:
- `smm-gateway`: version 10, `verify_jwt=true`.
- `payment-intent`: version 6, `verify_jwt=true`.
- `payment-webhook`: version 1, `verify_jwt=false`.
- `paymob-webhook`: version 8, `verify_jwt=false`.
- `order-create`: version 6, `verify_jwt=true`.

For webhook endpoints where platform JWT verification is disabled, release acceptance must include evidence that the handler validates the provider's signature/authenticity, rejects invalid/replayed events, and is idempotent. This inventory alone does not prove those properties or runtime behavior.

Earlier source inspection documented `smm-gateway` as fail-closed with `SMM_INITIAL_LAUNCH_DEFERRED=true` and returning `503 SMM_DEFERRED` before user/provider/wallet/order actions. Recheck the current deployed source and a safe runtime test before changing this status; do not enable paid actions as part of S10.

## 3. Logs and monitoring evidence

The read-only unified-log query discovered these source groups in the recent window:
- `edge_logs`: 510 rows
- `pgbouncer_logs`: 279 rows
- `postgres_logs`: 115 rows
- `storage_logs`: 52 rows
- `postgrest_logs`: 24 rows
- `auth_logs`: 20 rows
- `auth_audit_logs`: 14 rows
- `function_logs`: 8 rows
- `function_edge_logs`: 4 rows

A keyword-based query matching terms such as error, timeout, permission denied, invalid regular expression, or not unique returned 64 PostgreSQL log rows, 31 PgBouncer rows, and 24 PostgREST rows. These are **matching log rows, not a deduplicated incident count**; the query is not enough to infer severity or root cause.

Representative messages observed included:
- `permission denied for table smm_orders`, with an associated HTTP 403 request in the inspected log sample.
- `invalid regular expression: parentheses () not balanced`.
- `operator is not unique: text || "char"`.
- PostgREST `Warp server error: Thread killed by timeout manager`.

These observations require owner-assigned triage and correlation to request IDs, query/function names, and expected policy behavior. A 403 can be an intended denial or a broken product flow; do not relax permissions until the contract is established. The S10 session did not change grants or policies.

The log API returned recent samples and aggregate counts; it did not provide evidence of configured alerts, alert delivery, on-call response, or a completed incident drill.

## 4. Backup, restore, RPO/RTO, and rollback

**Status: NOT TESTED / BLOCKING GATE.**

Existing repository contracts explicitly state that a runbook or backup configuration is not proof of recoverability:
- [Production Recovery Verification Contract](../PRODUCTION_RECOVERY_VERIFICATION_CONTRACT.md)
- [RC262 Backup / Recovery / Rollback Evidence](../RC262_BACKUP_RECOVERY_ROLLBACK_EVIDENCE.md)
- [RC59 Backup/Recovery & Release Evidence Checkpoint](../RC59_BACKUP_RECOVERY_RELEASE_EVIDENCE.md)

These records identify the following as unverified: a real restore rehearsal in an isolated target, measured RPO/RTO, storage/media recovery, release-artifact rollback, migration rollback, and an incident/monitoring drill.

The currently available S10 tool surface exposes read-only project metadata, migration inventory, logs, and function inventory, but did not expose a backup artifact listing or a controlled restore-rehearsal action. No backup artifact, restore, RPO, or RTO is therefore claimed. Do not reset or restore the production project to test this.

Required recovery evidence:
1. Identify an approved backup/PITR point and the authorized recovery target.
2. Restore into an isolated environment, never over production.
3. Record restore start/end timestamps, recoverable transaction cutoff, measured RTO/RPO, and target identifier.
4. Validate schema, critical constraints, RLS/RBAC, tenant isolation, storage references, function/config dependencies, and financial-ledger/settlement consistency.
5. Run application smoke and security tests against the restored target.
6. Perform a controlled release-artifact rollback and a migration rollback/forward-recovery rehearsal appropriate to each migration's semantics.
7. Preserve sanitized logs and signed-off evidence.

## 5. Release gate matrix

| Gate | Status | Evidence / closure requirement |
|---|---|---|
| Supabase service health | VERIFIED (service only) | Project metadata reports ACTIVE_HEALTHY; does not imply app readiness |
| PR state | VERIFIED — BLOCKED | PR #218 is open/draft/unmerged |
| Exact-head CI | NOT TESTED to completion | Multiple exact-head runs queued; wait for final conclusions and inspect failed jobs |
| Web deployment | BLOCKED | Exact-head Pages deploy run cancelled; successful deployment must be independently authorized and verified |
| Live MantiGO admin authorization | BLOCKED — P0 | Prior direct live evidence shows four SECURITY DEFINER admin RPCs executable by authenticated without the required platform-admin guard; must be fixed via approved, reconciled forward migration and independently rechecked |
| Security Advisor / SECURITY DEFINER inventory | BLOCKED for release | Prior advisor evidence: 40 authenticated-executable SECURITY DEFINER functions and one anon-executable SECURITY DEFINER function; contract-by-contract review required |
| Payment event RLS | BLOCKED pending design/verification | Prior live evidence: `public.digital_page_payment_events` has RLS enabled but no policies; define intended access and test safely |
| Migration replay | WAITING_DEPENDENCY / NOT VERIFIED | Exact-head S04 replay run was queued; earlier source/lineage evidence identified unresolved creation lineage for `credit_policies`, `credit_accounts`, and `credit_periods`; inspect latest S04 report and final run |
| Orders/payment/webhooks | NOT TESTED end-to-end here | Require sandbox end-to-end, signature verification, idempotency, financial reconciliation, and exact-head evidence |
| SMM | BLOCKED / DEFERRED | Deployed inventory says ACTIVE v10 with JWT verification; prior source evidence says hard deferred 503; no paid action/runtime request was sent |
| Monitoring/alerts | NOT TESTED | Prove alert configuration, delivery, actionable thresholds, and incident response drill |
| Backup/restore | NOT TESTED — BLOCKING | Real isolated restore and measured RPO/RTO required |
| Release/migration rollback | NOT TESTED — BLOCKING | Controlled rehearsal and recorded recovery evidence required |
| Production certification | BLOCKED / NOT CERTIFIED | Do not announce release readiness until all P0 and mandatory recovery/runtime gates are VERIFIED |

## 6. Required owners and next actions

1. **S02 + release owner:** prepare and review the approved forward-only fix for the four live MantiGO admin RPCs. Production application requires explicit authorization.
2. **S03 + S05:** close contract-specific SECURITY DEFINER and tenant/RLS findings, including the payment-event table, without blanket revokes or policies.
3. **S04:** resolve migration lineage/replay blockers and provide a final exact-head replay report; do not rewrite the applied production migration history.
4. **S06:** provide sandbox evidence for request/payment/webhook/idempotency and ledger reconciliation.
5. **S07:** confirm current deployed SMM source/hash and retain the deferred fail-closed behavior until authorized readiness tests pass.
6. **S10 / operations owner:** arrange an approved isolated recovery target and execute a real restore/rollback rehearsal. If a Supabase branch or other environment incurs cost, obtain the required cost approval first.
7. **S01 / release owner:** re-poll the latest PR head after all sessions finish; ensure CI results correspond to that exact commit, then evaluate the release gate. No merge/deploy without explicit approval.

## 7. S10 disposition

- **DONE:** read-only project status, migration inventory, selected Edge Function inventory, recent log-source inventory and error-keyword aggregation, PR/CI state, and existing recovery-contract review.
- **VERIFIED:** Supabase reports ACTIVE_HEALTHY; 283 migration entries returned ending at `20261008222845`; selected function states/versions recorded; PR #218 observed open/draft/unmerged; exact-head web deploy run observed cancelled.
- **BLOCKED:** live admin authorization defect, unresolved security/RLS findings, exact-head CI not complete, and web deployment not successful.
- **NOT TESTED:** actual backup restore, RPO/RTO, storage recovery, release rollback, migration rollback, monitoring/alert delivery, and complete production E2E.
- **Final decision:** **BLOCKED / NOT CERTIFIED**.

No production changes were made by this S10 evidence pass.
