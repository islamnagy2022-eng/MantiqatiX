# Pass 821–840 — MantiGO live authorization and exact Production release reconciliation (2026-11-19)

**Current main:** `02a2c5688e53ff023f086c5d3c66c4a72deb59fe` (PR #821 merged).  
**Production project:** `moyhiluyhjsujhwlyeuu`, PostgreSQL 17.6.  
**Production disposition:** **BLOCKED / NOT CERTIFIED**.  
**Mutation boundary:** all Production checks in this pass were read-only. No SQL/DDL, ACL, Auth, RLS, Edge, payment, wallet, settlement or user-data mutation.

## 1. Source/CI work completed

- PR #821 merged as `02a2c5688e53ff023f086c5d3c66c4a72deb59fe`.
- Updated `.github/workflows/mantigo-platform-admin-scope.yml` from PostgreSQL 16 to PostgreSQL 17, matching the Production major version; added a manual workflow-dispatch trigger and candidate-branch push path.
- Exact-head dedicated workflow [44423269037](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/44423269037): PASS. Static RC471/RC476/high-risk SECURITY DEFINER checks and disposable RC449 → RC462 → RC471 → RC476 migrations plus behavior tests passed.
- PR #821 exact-head aggregate CI: 28 successful checks, 2 expected skips (deployment and public-only job). No PR deployment was performed.
- Post-merge main: MantiGO Platform Admin Scope Hardening [44423691940](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/44423691940) PASS; Module Professionalization [44423691911](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/44423691911) PASS; MantiGO Open Ride Privacy [44423692137](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/44423692137) PASS; Backend-only Module Boundary [44423691971](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/44423691971) PASS; Production Health Monitor [44423691996](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/44423691996) PASS.
- Main Pages deployment run [44423691917](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/44423691917) was pending at the time of this checkpoint. Do not infer deployed-origin success from CI or health-monitor success.

## 2. Fresh live MantiGO authorization recheck

A read-only PostgreSQL catalog inspection confirmed the following four global MantiGO RPCs remain SECURITY DEFINER, executable by `authenticated`, and do not call `mnty_can_platform_admin()` in Production:

| RPC | Live search_path | Authenticated EXECUTE | Uses canonical platform-admin guard |
|---|---|---:|---:|
| `get_mantigo_admin_dashboard_backend(uuid)` | `public` | yes | no |
| `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)` | `public` | yes | no |
| `settle_mantigo_captain_backend(uuid,text,text)` | `public` | yes | no |
| `expire_stale_mantigo_rides_backend(uuid,integer)` | `public` | yes | no |

Additional live evidence:

- `mnty_can_platform_admin()` still delegates to `mnty_can('admin',NULL,NULL,NULL)` and uses `search_path=public, pg_temp`, not the canonical registry-only helper.
- The live RPC predicates contain broad tenant membership role checks including `BUSINESS_OWNER`.
- Aggregate-only membership query: one platform-admin registry row; five distinct active BUSINESS_OWNER users; four of those users are not in the platform-admin registry. No user IDs or profile values were selected.
- The live financial report still references legacy ledger fields `amount` and `captain_amount`; the live ledger uses `gross_amount`, `commission_amount`, and `captain_net_amount`.
- The source migration RC471 already contains the forward-only registry-authority fix, empty search_path on all five replaced SECURITY DEFINER functions, and canonical financial ledger fields. RC476 independently repairs captain earnings to canonical live ledger fields. Their disposable PostgreSQL tests pass; neither migration is applied to Production.
- No global MantiGO RPC was invoked during this audit.

**Security impact:** tenant-scoped business owners can satisfy the old membership predicate for platform-wide ride/financial operations. This is a confirmed authorization-boundary defect in the live function definitions, not a claim that a particular user accessed the data. Keep the four global operations blocked from release until the ordered RC464/RC471/RC476 migration chain is applied under the full release gate and verified with adversarial post-deploy tests.

## 3. Exact Production migration ledger reconciliation

The current main source contract contains **62 distinct required release migration versions**, from RC425 through RC483, as defined in `scripts/production/live-reconciliation-contract.mjs`.

A fresh read-only query compared those exact 62 version IDs against `supabase_migrations.schema_migrations`:

| Measure | Result |
|---|---:|
| Live migration rows | 310 |
| Latest live migration | `20261110150618` |
| Required release versions | 62 |
| Required versions found live | 0 |
| Required versions missing live | 62 |

The exact 62/62 absence is confirmed by the live query. Do not create ledger rows manually, replay individual historical migrations out of order, or apply only RC471. The required changes are coupled to schema, grants, RPCs, Edge Functions and payment contracts and must be replayed in timestamp order.

## 4. Release and recovery gates

- Encrypted off-site backup and isolated restore rehearsal with measured RPO/RTO: **not evidenced**.
- Full 62-version chronological migration release: **not applied**.
- Coordinated critical Edge Function parity and post-deploy smoke tests: **not certified**.
- Leaked-password protection: previously reported disabled; still requires owner-operated Auth configuration and independent recheck.
- Production Health Monitor PASS only covers its configured read probes, site/runtime reachability and assets; it is not evidence of database backup, restore, migration parity, payment correctness or full transaction health.
- Main Pages deploy run 44423691917 was pending at checkpoint; deployed-origin success is not claimed.

## 5. Next work

1. Obtain encrypted off-site database backup plus isolated restore proof and measured RPO/RTO using the owner-controlled Supabase recovery process.
2. Reconcile all 62 required migrations against the exact 310-row ledger and captured schema baseline; retain the existing ordered forward-replay and rollback evidence.
3. Perform the approved chronological DB rollout, then deploy matching Edge Functions in the documented dependency order.
4. Recheck the four global MantiGO RPC definitions, grants, empty search_path, registry-only guard and legacy ledger-column references after deployment.
5. Run adversarial tenant-owner/business-owner/branch-owner denial tests and registered platform-root success tests against the deployed database.
6. Complete post-deploy site, Android/mobile, payment, privacy and restore smoke tests before certifying launch.

**Disposition:** PR #821 MERGED; PostgreSQL 17 MantiGO regression PASS; live MantiGO authorization gap remains open because RC471/RC476 are source-only; exact migration ledger is 0/62; Production release remains **BLOCKED / NOT CERTIFIED**.
