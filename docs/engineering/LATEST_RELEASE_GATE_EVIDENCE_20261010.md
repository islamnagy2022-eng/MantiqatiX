# MantiqatiX — Latest Release Gate Evidence

**Checked:** 2026-10-10 22:11 UTC (2026-10-11 01:11 Africa/Cairo)  
**Release decision:** **NOT CERTIFIED — production release remains blocked.**

## Current repository and static web status

- Current `main`: `36986b45f12591f975637264fce64513a50abdad` — `docs: reconcile current staged PRs and full migration chain`.
- Main-head CI is green: [Module Professionalization](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38090100037), [Production Health Monitor](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38090099975), [MantiGO Open Ride Privacy](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38090099990), [Backend-only Module Boundary](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38090099940), and [Deploy MantiqatiX Web](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38090100044) all completed successfully.
- This verifies the static web deployment and repository checks only. It does not certify production database migrations, RLS/grants, Edge Function parity, authentication, payments, or financial workflows.

## Material gate changes since the previous review

### RC443 / matrimony

- PR #141 (`437d95966adc430645eaa746d51385f1f1b35f69`) is **closed without merge**. Its exact-head CI included a failed disposable PostgreSQL matrimony test and failed cross-open-PR migration-collision guard; the old branch must not be revived.
- The former collision between PRs #129 and #130 on migration prefix `20261010130000` is cleared: both PRs are now closed without merge, and that migration prefix/file is absent from current `main` and no longer represented by an open PR pair.
- Issue #151 is **closed**. The ambiguous `RETURNING unlocked_at` is superseded by merged PR #160 / RC448, whose exact-head disposable PostgreSQL request-lifecycle test passed. This closes the old RC443-specific blocker only; RC448 remains unapplied in production.
- PR #154 / RC447 and PR #160 / RC448 are merged as source. Draft UI PR #158 (`15cd03a329ca9159ddb057c02390c8bad9aba0cc`) has 10/10 exact-head checks successful, but its branch is 21 commits behind current `main` and still requires a current-main refresh plus authenticated browser acceptance after the approved backend rollout.

### RC444 / CRM business scope

- PR #143 is merged as source at squash commit `e9d44f90c80b543ce1109ad469f1b27bf77bc95f`, which is present in current `main`.
- Its exact-head CRM business-scope PostgreSQL integration and source-contract checks passed. The Pages deploy job was skipped for the PR; the later main-head web deployment passed.
- The RC444 migration is still **source-only** and has not been applied to production.

### SMM trusted-read rollout

- PR #145 (`32bfaa39b4d204f10aefa79cefc043f4b805cb8a`) is **closed without merge**; do not revive its stale branch.
- PR #188 merged RC456 source, including the narrow service-role ACL migration and trusted `catalog`/`my_data` gateway actions. RC456 is not applied to production.
- Current replacement PR #189 (`92fb167390ea150f8972de8d9e89b083608321d2`) has 17 successful exact-head checks and one skipped deploy job, but its branch is 2 commits behind current `main`. It remains draft. Refresh it to current `main` and rerun CI before considering merge.
- A live read-only Supabase check confirmed `smm-gateway` is still deployed at version 6, whose source lacks the new `catalog` and `my_data` actions and still has the prior broad role-based admin check. Do not publish the matching UI before an explicitly approved full rollout, updated gateway deployment, and authenticated smoke tests.

### Selected membership / business profile

- PR #148 (`4226a0df6bb96d5226c0a562092a7e00101b7728`) is **closed without merge**.
- Replacement PR #175 (`ec0a4b39231e0dc52eaca69ac28dca61bce06066`) has 13 successful exact-head checks and one skipped deploy job, but is 9 commits behind current `main`. Two-business staging E2E has not been evidenced. Refresh and rerun CI, then prove switching between two businesses does not leak or mislabel profile/activity data.

## Current issue state

- Issue #150 (main branch protection / required release checks): **open**. The latest read attempt for branch-protection settings returned GitHub API 403 (integration permission denied), so current settings could not be independently re-read. The last known audit found `main` unprotected; this still needs authorized repository-admin verification and enforcement.
- Issue #151 (RC443 SQL ambiguity): **closed**, superseded by RC448 source and passing disposable PostgreSQL evidence.
- Issue #152 (finance/ERP business and branch scope): **open**. The authorization contract and same-tenant cross-business/cross-branch negative tests remain outstanding.

## Migration collisions and live production ledger

- Current live Supabase migration inventory: **283 entries**, latest version `20261008222845` / `rc424_atomic_digital_page_payment_webhook`.
- The source filename for RC424 is `20261009010000_rc424_atomic_digital_page_payment_webhook.sql`, so the source/production-ledger mismatch remains unresolved. Do not rename, replay, or rewrite migration history blindly.
- Five legacy duplicate timestamp-prefix groups remain in the repository's existing migration tree:
  - `20260928020000`: RC101 G6 RLS hardening; RC102 G8 CRM/notification support RLS hardening.
  - `20260928060000`: RC109 order/support tenant boundaries; registration-request DML grants restoration.
  - `20260928190000`: RC162 MantiGO trip state machine; RC200 cross-tenant customer payment authorization.
  - `20260928200000`: RC164 MantiGO direct-delete lockdown; RC164 legacy MantiGO mutator retirement; RC206 geographic ad targeting.
  - `20260928210000`: RC172 medical booking contract; RC207 official global cover ads.
- These are pre-existing mainline collisions, not new files from the just-closed RC443 pair. The passing current CI does not resolve historical production-ledger ambiguity. Reconcile every version against the live ledger before planning any release batch.
- Open draft PR #84 remains a stale broad payment-hardening stack with RC424–RC441 source and must not be merged as-is. RC425–RC431 and other dependencies are not safely represented by applying only the newer feature subset.

## Remaining release blockers

1. **Complete chronological migration reconciliation:** the live ledger stops at RC424; reconcile RC425–RC431 and all later prerequisites, existing filename/version collisions, and the live ledger before any production plan.
2. **Payment runtime parity and recovery:** deployed payment RPC/Edge Function behavior, RC439 encrypted checkout recovery, signed Paymob sandbox E2E (replay, tampering, concurrency, ambiguous outcomes), and rollback evidence remain unverified.
3. **Source-only security migrations:** RC444, RC447, RC448, RC449, RC449A, RC450, RC453, and RC456 are in source but not confirmed applied to production. Do not apply them individually or out of order.
4. **SMM runtime parity:** deployed `smm-gateway` remains version 6; RC456 migration and updated gateway/UI rollout require explicit approval and coordinated smoke tests.
5. **Finance/ERP scope:** issue #152's branch/business contract and positive/negative cross-scope tests remain open.
6. **Governance and recovery evidence:** issue #150, authenticated multi-tenant E2E, backup/restore rehearsal, and rollback verification remain required.

## Safety boundary

This review used read-only GitHub and Supabase inspection plus disposable CI evidence. No production migration, RLS/grant/Auth change, Edge Function deployment, wallet/financial mutation, real payment, or customer-data write was performed. Passing source CI or Pages deployment is not production certification.
