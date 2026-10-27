# MantiqatiX — Current-Production-Schema Rehearsal Plan

**Status: BLOCKED / PLAN ONLY. No Production changes are authorized by this document.**

## 1. Live baseline captured read-only

- Supabase project: `moyhiluyhjsujhwlyeuu`.
- Live migration ledger: 292 rows; latest recorded version `20261027041549` at the last recorded audit.
- Distinct release-required migrations: **41**, of which **0/41** are recorded in the live ledger.
- Atomic release object contracts: **60** (27 core payment/finance/ERP/MantiGo + 33 RC113–RC117 feature contracts). Read-only name/signature catalog check found **7 present and 53 absent**. **0/60 are fully certified** because name presence alone does not prove exact overload, function body, grants, `SECURITY DEFINER` search path, RLS, or runtime behavior.
- Migration-source aliases: **0/2** reconciled in the live ledger. They are not part of the 41 distinct effects and must not be executed as additional SQL migrations.
- Qadam catalog: 15 active items and 12 matching active price rows; 3 contact-for-price items have no active price; stock tracking is disabled. The owner membership is still `INACTIVE`, so `20261027093000_add_qadam_alsaad_homewares_store.sql` remains a distinct required effect.
- Existing independent blockers: RC451 targeted-ad search-path mismatch, RC449A/RC450 journal schema and EXECUTE boundary, five critical Edge Function source drifts, end-to-end payment/finance tests, backup/restore evidence, Auth/device/monitoring, and rollback.

## 2. Why a clean replay is not enough

A fresh Supabase development branch starts without Production data. A successful replay there is useful for syntax and clean-install ordering, but it cannot establish compatibility with the current Production schema or data. The rehearsal must use an isolated database restored from a current Production backup (or a schema-and-data clone with equivalent constraints and catalog state), then prove restore integrity before applying any pending migration source.

Do not use `supabase db push` on Production as a diagnostic. Do not apply any migration in this plan directly to Production.

## 3. High-risk migration effects requiring explicit preflight

| Migration(s) | Risk to rehearse | Required evidence before approval |
|---|---|---|
| RC425 | Creates `mantigo_payment_provider_events`, forces RLS, adds service-role-only payment backend; writes payment events, ledger, notifications at runtime. | Table/constraint/RLS parity; idempotency replay tests; duplicate provider-event test; service-role-only ACL proof; no real payment calls. |
| RC426 / RC431 | Replaces payment RPC signatures and privilege boundaries; current live catalog has an older finalize signature and `search_path` drift. | Exact old/new signatures and grants before/after; body diff; call-path compatibility test; anonymous/authenticated negative tests. |
| RC427 / RC432 / RC448 / RC453 / RC113 / RC114 / RC113 membership-scope index | Unique indexes may fail or change accepted writes if duplicate rows already exist. RC432 explicitly drops/recreates a wallet index. | Run duplicate-detection queries on the restored copy; record zero conflicts or an approved data remediation; verify index definition and validity after apply. |
| RC434 / RC437 / RC438 | ERP receiving RPCs, purchase-order lines, line-aware receiving, policy changes, and revocation of direct use of the old receive RPC. | Rehearse purchase orders with zero/one/many lines, partial and repeated receiving, stock ledger consistency, tenant/branch scope, and authenticated/service-role negative tests. |
| RC435 | Adds claim/lease logic for subscription provider-intent creation. | Concurrent duplicate-claim test; stale lease recovery; idempotent retry; no duplicate provider intents. |
| RC436 / RC449A / RC450 | Financial-journal functions, unique indexes, schema prerequisites/backfills, trigger replacement, and service-role EXECUTE boundary. RC449A updates existing journal rows. | Count rows affected by every backfill on the clone; reconcile debit/credit totals before/after; verify balanced journals and ledger rows; exact trigger/function body and ACL; service-role positive and client-role negative tests. |
| RC440 | Dynamic DO block alters `search_path` for exposed `SECURITY DEFINER` functions found at execution time. Since Production already contains later migrations, applying this historical file now could affect functions that did not exist when it originally ran. | Capture exact before/after function list and search paths on the clone; compare each changed function to an explicit allowlist; reject any unintended later function change; re-verify RC451 and all other search paths afterward. |
| RC441 / RC449 | Replaces MantiGo platform-admin functions and grants authenticated execution. | Full body parity; role/tenant/business scope tests; verify each RPC is intentionally callable by authenticated users and cannot cross tenant boundaries. |
| RC442 / RC444 / RC447 / RC452 / RC525 | Drops/replaces approval, CRM, matrimony, and digital-page-product policies/triggers. | Snapshot policy definitions before/after; prove intended users retain required access and cross-tenant/private data access is denied; regression tests for profile verification and CRM assignments. |
| RC453 | Creates marketing campaign and participant tables, indexes, RLS, and user-callable backend RPCs. | Confirm no existing partial objects; exact index names; tenant/business/provider isolation; invite/accept/decline/retry tests; function ACL and empty search path. |
| RC456 / RC102 / RC103–RC106 | SMM table grants and order/provider-service access/function changes; some source functions use `search_path=public`. | Confirm RLS protects every newly granted table operation; exact ACL diff; order idempotency/branch-scope tests; explicit security approval for every non-empty search path. |
| RC449A | Adds/backfills journal columns and running-balance lookup index. | Record source and destination row counts, null counts, affected rows, debit/credit totals and running-balance invariants on the restored clone. |
| RC117 | Adds default-image columns/functions/triggers, drops/recreates triggers, and updates existing businesses/catalog items/marketing services. | Before/after row counts and changed-row counts; ensure only missing/default image fields change; prove no real image URLs are overwritten; validate trigger idempotency. |
| RC113–RC116 | Adds platform custom roles, employee hiring, control-center integration, and business/subscriber administration. | RLS/forced-RLS checks, tenant and branch scope tests, least-privilege ACLs, audit trail assertions, employee/member lifecycle tests. |
| `20261027093000` Qadam follow-up | Updates the seeded owner membership to `ACTIVE` while preserving store, branch, 15 items, and 12 prices. | Exact before/after membership status and identity; item/price counts and values unchanged; no duplicate business/branch/catalog/price rows; no stock or fake orders. |

## 4. Controlled rehearsal sequence

1. **Freeze source inputs.** Record the target `main` commit SHA and hashes of all 41 distinct migration files. Keep both duplicate aliases excluded from the executable migration list.
2. **Create a restorable isolated clone.** Restore current Production schema and data to a non-production project. Verify the clone's ledger count/version, table counts, constraints, RLS, policies, indexes, function signatures/bodies, triggers and grants against the captured read-only baseline. A clean branch with no Production data is not a substitute.
3. **Take a second clone snapshot.** Prove that backup restore works, record the restore point, and document a tested rollback procedure before migration rehearsal.
4. **Preflight all conflicts.** Detect duplicate keys for every pending unique index; existing objects with conflicting definitions; missing referenced columns/tables; policy/trigger name collisions; incompatible function overloads; invalid indexes; and rows affected by data backfills or seed updates. Do not auto-delete or normalize conflicting data.
5. **Apply pending distinct migrations only to the clone**, in the source timestamp order declared by the release verifier. Stop on the first unexpected DDL, data, RLS, ACL, or function-body difference. Because several old migrations are missing while later versions are already applied, inspect dynamic blocks and current-state mutations carefully; do not assume historical execution context.
6. **Checkpoint high-risk groups separately:** payment/webhooks; SMM wallet; ERP receiving/order lines; financial journal/backfills/trigger; security-definer search paths; approval/CRM/matrimony privacy; marketing campaigns; platform roles/hiring/subscriber administration; default images; Qadam owner activation.
7. **Run the full 60-object contract.** For every object, record existence, exact signature/definition, source-body parity, `SECURITY DEFINER`, `search_path`, EXECUTE/table ACL, RLS/policies and a positive/negative runtime test where applicable. `exists=true` alone is not PASS.
8. **Run end-to-end tests without external side effects:** fake/sandbox provider webhooks only; duplicate/replayed webhooks; subscription claim races; order create/status idempotency; stock receiving and purchase-order line limits; balanced journal and running balance; CRM/marketing tenant isolation; matrimony private-contact access; admin/hiring/subscriber workflows; image defaults; Qadam catalog browse and owner access. No real charges, wallet transfers, emails, or production notifications.
9. **Reconcile aliases separately.** RC424 source version `20261009010000` maps to the already-applied ledger version `20261008222845`; `20261027100000_mantiqatix_marketing_contact_details.sql` is an exact source-blob alias of recorded version `20261027041411`. After backup, replay, and review, prepare a separately approved migration-history repair that does not execute duplicate SQL. Verify ledger result with read-only queries.
10. **Review all diffs and restore again.** Compare schema, data invariants, RLS/policies, ACLs, search paths, functions and trigger behavior before/after. Rehearse rollback by restoring the snapshot and proving the clone returns to the baseline.
11. **Only then produce a production rollout plan** with a maintenance window, exact SQL/migration sequence, per-step assertions, abort conditions, rollback steps and named approval. Production execution is a separate authorized action; this plan does not authorize it.

## 5. Hard stop / go-no-go criteria

Do not request Production release approval unless all are true:

- [ ] All 41 distinct migration effects have been applied and verified in the restored clone without unresolved conflicts.
- [ ] Both aliases have a reviewed, separately approved ledger-repair plan and are not replayed as SQL.
- [ ] All 60 atomic object contracts pass exact definition, signature, ACL, RLS and runtime checks.
- [ ] RC440 changes only explicitly approved functions; RC451 and every other SECURITY DEFINER path is re-verified.
- [ ] RC449A/RC450 journal schema, backfill, trigger and service-role ACL checks pass with balanced totals and zero unexplained row changes.
- [ ] Qadam owner membership is ACTIVE after the distinct follow-up; catalog/product/price counts and values remain correct.
- [ ] All payment, finance, order, ERP, CRM, marketing, matrimony, platform-admin, hiring and privacy tests pass on the clone.
- [ ] Backup restore and rollback are demonstrated; monitoring and post-release verification are ready.
- [ ] Production migration ledger, grants/RLS/Auth, Edge Functions and website remain unchanged until a separate approval authorizes rollout.

## 6. Current decision

**NO-GO.** Current live evidence is insufficient to execute the 41 missing migrations on Production. The immediate next technical dependency is a restorable current-schema-and-data clone; only a clean-install replay is currently evidenced. No Production writes were performed while preparing this plan.
