# MantiqaTix — Team 01 Architecture & Integration Register
**Date:** 2026-11-05  
**Request ID:** `TEAM01-20261105-01`  
**Owner:** Team 01 — Master Architecture & Project Management  
**Status:** `IN PROGRESS` — documentation candidate on `docs/team-01-architecture-register-20261105`  
**Repository:** `islamnagy2022-eng/MantiqaTix`  
**Verified base:** `main @ 218d4c768021fbc94d21ffd442b3fcdacd16e4f8`

## 1. Purpose and authority

This register is the Team 01 architecture/coordination view. It supplements — and does not replace — the canonical execution records:

- Master request ledger: [GitHub Issue #599](https://github.com/islamnagy2022-eng/MantiqaTix/issues/599).
- Task register: [`docs/MASTER_PRODUCTION_TODO.md`](../MASTER_PRODUCTION_TODO.md).
- Current handoff: [`docs/PROJECT_CONTINUITY.md`](../PROJECT_CONTINUITY.md).
- Append-only history: [`docs/SESSION_LOG.md`](../SESSION_LOG.md).
- Cross-session intake and closeout rules: [`docs/CROSS_SESSION_TODO_PROTOCOL.md`](../CROSS_SESSION_TODO_PROTOCOL.md).

### Source-of-truth order

1. Exact current `main` source SHA and repository tree.
2. Tests/workflows run against that exact SHA, including the environment and job outcome.
3. Latest read-only production schema, migration, Edge, Auth and security evidence.
4. Open PR branches as candidates only; a green result on an old head is not proof for current `main`.
5. Older status reports, copied prompts and candidate-package claims as historical context only.

The deployed website baseline is `apps/catalog-frontend`. The root-level standalone AI Studio V6 candidate is a separate source candidate and is not the deployed website. The legacy `web/` tree remains in the repository for compatibility/reference and is not the current Pages production artifact.

## 2. Verified baseline — 2026-11-05

| Item | Verified state |
|---|---|
| Repository default branch | `main` |
| Main HEAD | `218d4c768021fbc94d21ffd442b3fcdacd16e4f8` |
| HEAD commit | `docs(audit): record read-only Production recheck 2026-11-05` |
| Production UI source | `apps/catalog-frontend` |
| Public deployment | GitHub Pages, root `/MantiqatiX/` |
| Catalog pilot | `CATALOG_PILOT_GATE=PASS` |
| Full platform | `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` |

### Exact-head workflow evidence

All five listed workflows completed successfully against `218d4c768021fbc94d21ffd442b3fcdacd16e4f8`:

- [Module Professionalization Validation — 41970849066](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41970849066)
- [Backend-only Module Boundary — 41970849035](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41970849035)
- [Production Health Monitor — 41970849152](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41970849152)
- [MantiGO Open Ride Privacy Boundary — 41970849167](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41970849167)
- [Deploy MantiqatiX Web — 41970849104](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41970849104)

For the Pages run, both the `validate` and `deploy` jobs completed successfully. The deploy job published the composed site and ran deployed-origin Playwright checks for dashboard routes, mobile layout, membership scopes and permanent QR links. This verifies the scoped website release on that SHA; it does not certify the whole platform.

## 3. Current architecture map

| Layer | Canonical location | Boundary / rule |
|---|---|---|
| Public website and app shell | `apps/catalog-frontend/` | Only current production UI source. Build artifact is published through the Pages workflow. Preserve current routes, visual identity and real business/catalog data. |
| Frontend composition | `apps/catalog-frontend/src/App.tsx`, `components/`, `context/`, `modules/` | UI and state orchestration only. UI visibility is not authorization. |
| Frontend contracts | `src/lib/`, `src/data/`, `src/types/`, `src/utils/` | Centralize API/data adaptation; reuse existing contracts rather than adding parallel clients or duplicate entities. |
| Frontend quality | `apps/catalog-frontend/tests/`, `scripts/validate-*.mjs` | Contract validators and browser tests must be tied to an exact commit and environment. |
| Backend/API | `supabase/functions/*` | Edge Functions own privileged mutations and server-side authorization. Public-read contracts must be separated from authenticated write paths. Verify deployed function versions and source parity before rollout. |
| Database/migrations | `supabase/migrations/` | Forward-only, dependency-ordered source. Repository presence does not prove application to Production. Never rewrite historical migrations or fabricate migration-ledger rows. |
| Database security/integration tests | `supabase/tests/`, `scripts/production/` | Disposable PostgreSQL fixtures, migration replay, ACL and tenant-boundary assertions. Production changes require a separately approved rollout. |
| Identity and access | Supabase Auth, RLS, grants, RPC/Edge role checks | Tenant/business/branch scoping is enforced server-side. Do not infer authority from client state, local storage or hidden tabs. |
| CI/CD and operations | `.github/workflows/`, Pages workflows, health monitor | Separate validation from deployment; deployment success is scoped to the published artifact and its tested journeys. |
| Legacy/reference surface | `web/`, `web/preview/` | Reuse only after comparing with current source/contracts. Not the current production Pages artifact. |
| Standalone V6 candidate | Supplied AI Studio package/source archive | Separate candidate. Do not overwrite or replace the deployed application until source archive, build, Auth/write contracts, parity, security and recovery have been verified. |

### Platform invariants

- The functional directory taxonomy has exactly ten top-level groups, with up to five primary activity categories per group; specialties remain children of activities. This taxonomy is separate from the ten engineering teams below.
- Module activation is not implied by taxonomy placement. Each module needs stable identity/version, route, role/scope matrix, authoritative write boundary, workflow/state model, events, settings/flags, audit/reporting, migrations/rollback, tests and release gate.
- Reuse current web/backend contracts. Do not copy Android Room persistence, expose direct browser writes, or create parallel financial ledgers, location engines or legacy APIs.
- Lists should use bounded pagination. The current canonical directory pattern is 20 items per page with progressive loading.
- Never replace current UI or real catalogue data with DEMO, seeded, fabricated or localStorage-backed production state.

## 4. Proposed ownership map for the ten engineering teams

The user-defined team count is ten; detailed team names/assignment rosters were not supplied. The following is a proposed domain ownership/RACI map for coordination, not a claim that GitHub teams or named assignees have already been configured.

| Team | Proposed ownership | Main repository boundaries | Required partners |
|---|---|---|---|
| **T01 — Architecture & Project Management** | System map, baseline authority, Master TODO, integration register, dependency sequencing, PR conflict triage and release decision records. Does not take over other teams' implementation files. | `docs/engineering/`, coordination changes in canonical TODO/handoff/log | All teams |
| **T02 — Web Frontend & Experience** | Website shell, catalog/directory, dashboards, route behavior, responsive UI, accessibility and PWA presentation. | `apps/catalog-frontend/src/`, frontend tests | T03, T05, T09 |
| **T03 — Backend & API** | Edge Functions, API contracts, server-side workflows, validation, idempotency, stable error/response shapes. | `supabase/functions/`, API contract validators | T04, T05, T07, T09 |
| **T04 — Data Platform & Migrations** | Schema ownership, indexes, constraints, migration lineage, disposable replay, snapshot and data reconciliation. | `supabase/migrations/`, migration scripts/fixtures, schema runbooks | T03, T05, T07, T10 |
| **T05 — Identity, Security & Privacy** | Auth/session, RLS/ACL, SECURITY DEFINER, tenant isolation, secret boundaries, privacy, audit and adversarial authorization. | Security migrations/tests, Auth/RLS/ACL source contracts | T02, T03, T04, T09 |
| **T06 — Core Domains & Modules** | Directory/catalog, providers, booking, CRM, orders/operations, ERP and sector workflows; module lifecycle and entitlements. | Domain modules, Edge contracts, module specifications | T02, T03, T04, T05, T09 |
| **T07 — Payments & Finance** | Payment intents/webhooks, subscription checkout, journal, wallet, commission, settlements/refunds and reconciliation. | Payment/finance Edge Functions, migrations, runbooks and tests | T03, T04, T05, T09, T10 |
| **T08 — Mobile & External Integrations** | Android/PWA parity, offline/sync contracts, geo, Google/Facebook and external provider integrations. Consumes the same secure server contracts; no parallel source of truth. | Mobile source where present, PWA adapters, integration connectors | T02, T03, T05, T09 |
| **T09 — Quality Engineering & Verification** | Unit/contract/integration/browser/E2E, negative and adversarial tests, accessibility, performance and exact-head evidence. | `tests/`, `supabase/tests/`, `scripts/validate-*.mjs`, CI assertions | All implementation teams |
| **T10 — Platform Engineering, SRE & Release** | CI/CD, deployment composition, runtime configuration, secrets, observability, health, backup/restore, rollback, DR and capacity tests. | `.github/workflows/`, operational scripts/runbooks, release evidence | T01, T03, T04, T05, T09 |

### Ownership rules

- A team is the change owner for its domain; consumer teams are reviewers when contracts or behavior change.
- Shared files require explicit owner review from every affected domain.
- T01 coordinates and records decisions; it must not silently rewrite another team's code or approve its own security/production changes.
- Financial, identity, migration and production-release changes are multi-team changes by default.

## 5. Cross-team integration contract

Every cross-team change must register:

1. Request ID, originating team, owner, consumer/reviewer teams and priority.
2. Exact base SHA, working branch, PR and files changed.
3. Public/internal API or Edge contract touched, version and backward-compatibility plan.
4. Schema/migration version, dependencies, migration order and rollback/restore path.
5. Authentication requirement and exact role × tenant × business × branch scope.
6. Feature flag and default-deny/rollback behavior.
7. Tests executed, exact tested SHA, environment and workflow/run IDs.
8. Deployment sequence, post-deploy smoke checks and evidence owner.
9. Status using `TODO / IN PROGRESS / WAIT / BLOCKED / IMPLEMENTED / VERIFIED`.

**IMPLEMENTED is not VERIFIED.** A task becomes VERIFIED only after its acceptance checks pass on the relevant target. Fixtures do not prove live Production behavior. A deployment job must be distinguished from validation-only jobs and skipped deploy jobs.

## 6. Open PR integration map — snapshot at 2026-11-05

The comparisons below are against the exact `main` HEAD `218d4c768021fbc94d21ffd442b3fcdacd16e4f8`. Ahead/behind counts are branch topology indicators, not code-quality evidence; refresh them before every merge decision.

| PR | Workstream | Current coordination finding | Next safe action |
|---|---|---|---|
| [#666](https://github.com/islamnagy2022-eng/MantiQatiX/pull/666) | V4 documentation reconciliation | Draft; branch diverged (5 ahead / 3 behind). Documentation-only and contains V4 parity notes not yet reconciled into current main. | Rebase/reconcile unique notes; do not merge stale branch as-is. |
| [#661](https://github.com/islamnagy2022-eng/MantiQatiX/pull/661) | Doctor import contracts | Draft/open; 10 ahead / 8 behind. Touches `directory-listings` helper, validator and source specification. | Rebase, rerun exact-head tests, add isolated authenticated Edge tests and source-owner/legal evidence before any deployment review. |
| [#618](https://github.com/islamnagy2022-eng/MantiQatiX/pull/618) | Subscriber account portal | Draft/open; 27 ahead / 82 behind. Changes shared account/navigation/context/catalog-admin files. | Reconcile against current V4 UI and backend v20 contract; do not enable membership switching without exact membership authorization proof. |
| [#610](https://github.com/islamnagy2022-eng/MantiQatiX/pull/610) | Unified dashboard + billing/wallet/ads | Draft/open; 173 ahead / 83 behind. Overlaps #618 in App, Navbar, AppContext, production adapter, catalog-admin and browser tests; also includes finance/ads specs and dependencies. | Treat #610/#618 as one shared-file integration group; compare and port only reviewed slices on current main. Keep wallet/payment/ads writes blocked until their backend, ACL, accounting and booking contracts pass. |
| [#615](https://github.com/islamnagy2022-eng/MantiQatiX/pull/615) | Platform-admin bootstrap/root lifecycle | Draft/open; 15 ahead / 83 behind. Adds new lifecycle Edge Function, migration and PostgreSQL tests. | Independent security review; exact disposable migration/role tests; coordinate with #602 and #598; never invoke bootstrap or mutate Production from this PR. |
| [#602](https://github.com/islamnagy2022-eng/MantiQatiX/pull/602) | RC463 trigger-only SECURITY DEFINER ACL | Draft/open; 47 ahead / 87 behind. Adds RC463 ACL migration and integration fixtures; touches shared migration/manifest/CI contracts. | Rebase and test trigger execution plus direct-call denial; sequence with migration-source reconciliation and independent security review. No manual Production grant changes. |
| [#598](https://github.com/islamnagy2022-eng/MantiQatiX/pull/598) | RC42 source recovery | Draft/open; 18 ahead / 89 behind. Restores historical migration source and migration parity checks. | Verify exact source identity and chronological replay; do not edit historical migration content or fabricate ledger entries. |
| [#540](https://github.com/islamnagy2022-eng/MantiQatiX/pull/540) | Taxonomy admin / audit / RC459–RC461 | Draft/open; 119 ahead / 174 behind; large overlap with DirectoryView, AdminDashboard, AppContext, catalog-platform-admin and migration/function code. | Treat as high-risk stale candidate; reconcile current V4 contract and live `catalog-platform-admin` drift before considering any code. |
| [#490](https://github.com/islamnagy2022-eng/MantiQatiX/pull/490) | Retired catalog domain cleanup | Open; 1 ahead / 280 behind; edits `directory-listings`. | Resolve overlap with #661 and current deployed Edge v16 boundary; do not merge independently. |
| [#551], [#535], [#516], [#508], [#488] | Provider guard, anonymous session, release/security evidence, dashboard status | Older open documentation/CI candidates with substantial divergence from current main. | Revalidate whether each adds a unique current control; close/retire only after confirming no unique unported work. |

### Explicit conflict groups

- **Dashboard/account:** #610 and #618 modify the same frontend and Edge surfaces. One reconciled integration stack is required.
- **Directory/doctor import:** #661 and #490 both touch `directory-listings`; merge order and live version parity must be resolved first.
- **Migration/security:** #598, #602 and #615 have distinct migration scopes but share release sequencing, migration guards and platform-admin authority assumptions. Independent reviewers and disposable replay are required.
- **Taxonomy admin:** #540 is an older, broad branch with UI, Edge and migration changes. Do not cherry-pick without reconciling current V4 and live Edge v23 drift.
- **V4 docs:** #666 is stale relative to subsequent main merges; carry forward only unique facts and update exact references.

## 7. Release blockers and priority order

### P0 — Production safety / integrity

1. **Restorable current-schema baseline:** obtain a verified, restorable snapshot of current Production schema, roles/ACLs and required operational metadata; record retention and restore proof. Never expose private production snapshots in the public repo or build.
2. **Migration identity and effect reconciliation:** reconcile all 42 required exact release IDs against the 309-row live ledger and physical objects. Identify aliases/forward bundles using exact SQL/blob evidence; do not rerun aliases or synthesize ledger rows.
3. **Disposable chronological replay:** replay the approved source chain against a restorable isolated database matching the current Production checkpoint; verify object contracts, data-preserving effects, role grants and rollback.
4. **Finance dependency chain:** RC449A schema prerequisites → RC450 journal RPC/ACL boundary → matching Edge source parity → signed Paymob sandbox E2E, idempotency, refunds, settlements and journal reconciliation. No individual finance Edge deployment.
5. **Security/Auth:** function-by-function SECURITY DEFINER ACL/search-path review; RC463 trigger-only ACL review; real tenant/business/branch negative tests; managed Auth hardening including Leaked Password Protection. No blanket grants/policy changes.
6. **Recovery and release:** prove backup retention, restore, measured RPO/RTO, rollback and monitoring/alert paths before global release.

### P1 — Functional integration

- Complete the Super Admin and account/dashboard gaps only where the backend persistence/authorization contracts exist.
- Keep Member Messages, custom links and manual finance/sale-entry writes unavailable until durable server-side persistence, scope checks, audit and tests are complete.
- Reconcile open branches against current main before feature merges; run exact-head and deployed-origin tests where applicable.
- Finish doctor-source ingestion only after isolated runtime verification and documented source-owner/legal permission; no bulk public republishing by default.

### P2 — Capacity and optimization

- Benchmark Arabic/English directory search against an isolated million-row fixture; current free-text multi-column `ILIKE` plan used a sequential scan at current data scale.
- Capture raw load-test and controlled device performance data before claiming 500k VU, 100M users, 99.95% availability, RPO or RTO targets.
- Keep SMM deferred until its backend/ACL contract and negative runtime evidence are complete.

## 8. Current production evidence — read-only snapshot

The 2026-11-05 report [PRODUCTION_READ_ONLY_RECHECK_20261105.md](../audits/PRODUCTION_READ_ONLY_RECHECK_20261105.md) records:

- PostgreSQL 17.6.1.155, project ACTIVE_HEALTHY; no Production application rows were read or changed by that audit.
- Migration ledger: 309 rows through `20261101140105`; 0/42 exact required release IDs. This is an identity/effect reconciliation blocker, not proof that every SQL effect is absent.
- Seven RC449A journal schema fields are absent; both journal posting RPCs lack `service_role EXECUTE` and currently have `search_path=public`.
- Two trigger-only SECURITY DEFINER functions remain directly executable by anon/authenticated roles; both have triggers attached. Review and test the exact RC463 migration rather than changing grants ad hoc.
- Security Advisor categories: 9 RLS-enabled/no-policy, 3 anon-executable SECURITY DEFINER, 67 authenticated-executable SECURITY DEFINER, 90 anonymous-access policy findings, and Leaked Password Protection disabled. These are findings for triage, not confirmed exploit counts.
- Six critical payment/order/finance Edge source mismatches remain listed in the November 4 production audit. Payment/finance runtime E2E, Auth hardening, adversarial tenant tests, backup/restore and measured RPO/RTO remain open.

No statement in this register authorizes Production DDL/DML, migration apply/repair, GRANT/REVOKE, Auth/RLS changes, Edge deployment, payments, settlement or public-site cutover.

## 9. Team 01 session delivery record

| Deliverable | State |
|---|---|
| Current repository/default branch and HEAD checked | `VERIFIED` |
| Continuity / Master TODO / cross-session protocol reviewed | `VERIFIED` |
| Current exact-head workflow and Pages deploy jobs reviewed | `VERIFIED` |
| Open PR overlap/dependency snapshot prepared | `IMPLEMENTED` in this register |
| Task registered in Issue #599 | `IMPLEMENTED` — comment 6651234591 |
| Team 01 register added | `IMPLEMENTED` — [Draft PR #672](https://github.com/islamnagy2022-eng/MantiqaTix/pull/672); exact-head CI pending |
| Master TODO / continuity / session log updates | `IMPLEMENTED` on the review branch |
| Production mutation / full-platform certification | `NOT AUTHORIZED / BLOCKED` |

### Files intended to change in this documentation-only batch

- `docs/engineering/TEAM_01_ARCHITECTURE_AND_INTEGRATION_REGISTER_20261105.md` — new.
- `docs/MASTER_PRODUCTION_TODO.md` — add task pointer, dependencies and status.
- `docs/PROJECT_CONTINUITY.md` — prepend latest Team 01 handoff.
- `docs/SESSION_LOG.md` — append-only session closeout.

No application source, migration, Edge Function, production data, Auth/RLS/GRANT, payment or deployment configuration is in scope.

## 10. Next actions

1. Review [Draft PR #672](https://github.com/islamnagy2022-eng/MantiqaTix/pull/672), including exact-head CI and documentation accuracy.
2. Refresh branch comparisons and dependency map immediately before considering any PR merge.
3. Start the first P0 engineering sequence with current-schema restoration and migration identity/effect reconciliation; use disposable environments only.
4. Keep `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` until every independent release gate is supported by current evidence.

---

**Team 01 disposition:** architecture/coordination register is prepared for review. The deployed catalog baseline is preserved. Full enterprise production readiness is not certified.


## 11. 2026-11-05 — P0 current-schema baseline preflight

### Fresh read-only Production metadata

The project was rechecked directly through Supabase read-only metadata queries on 2026-11-05:

| Item | Current observation |
|---|---|
| Project state | `ACTIVE_HEALTHY` |
| PostgreSQL | `17.6.1.155` |
| Migration rows | `309` |
| Latest migration version | `20261101140105` |
| Exact release versions expected by the tracked contract | `42` |
| Exact source-version IDs present | `0 / 42` |
| Disposable Supabase development branches listed | None; only the default `main` branch was returned |

A targeted read-only SQL query independently confirmed the seven RC449A journal columns remain absent; neither journal-posting RPC grants EXECUTE to `service_role`; and both trigger-only SECURITY DEFINER functions still expose direct EXECUTE to PUBLIC/anon/authenticated/service_role while retaining one attached trigger each. `assign_default_owner_to_unowned_business()` still has `search_path=public, auth`; `capture_commission_rule_audit()` has an empty search path. Do not apply ad-hoc grants or revokes.

### Existing schema baseline is not a current restorable backup

The tracked file `supabase/tests/baselines/production_schema_snapshot.manifest.json` records:

- Capture: `2026-10-17T02:10:22.329Z`, source commit `0af55bf0054f0c464ed3a998bb4c85e13b2540ae`.
- Checkpoint: `20261008222845`, 283 migration versions.
- Capture scope: schema-only; no application rows and no custom roles.
- `review_status=PENDING_REVIEW`, `deployment_approved=false`.

The live ledger now has 309 records through `20261101140105`. Therefore the October 17 snapshot is 26 migration records behind the current ledger and does not include the current role/ACL state or data needed for a restorable current-schema rehearsal. The successful prior 76-migration replay recorded in `docs/audits/PRODUCTION_RECHECK_20261104.md` is a useful isolated source-chain test, but it starts from the older checkpoint and does not close this gap.

The existing `.github/workflows/forward-migration-chain-replay.yml` pins Supabase CLI `2.122.0`; retain that pin until a separately tested CLI v3 migration updates the commands to its new local-by-default/explicit-`--remote` behavior. Do not casually upgrade the migration workflow.

### P0 execution state

| Task | Status | Next action / dependency |
|---|---|---|
| Obtain current Production schema + roles/ACL snapshot with a verified restore path | `BLOCKED` | Use an approved provider backup or cost-approved disposable branch; keep private data and credentials out of the public repository. |
| Reconcile exact migration IDs to SQL/source effects and recorded forward bundles | `IN PROGRESS` | Keep both known aliases immutable; match exact SQL/blob content, not timestamps or RC labels alone. |
| Replay the full chronological chain against a current-schema checkpoint | `WAIT` | Start only after snapshot restoration and role/ACL capture pass. |
| Prove rollback/restore and release sequencing | `WAIT` | Requires the current restored checkpoint and independent review. |
| Reconcile the catalog sub-TODO's PR #641 item | `WAIT — TEAM 02` | PR #641 is closed/merged, while the opening item in `TODO_PRODUCTION.md` still says IN PROGRESS; T02 must verify deployed behavior before changing it to VERIFIED. |

### Coordination corrections

- PR #672 is still Draft/open, based on main `218d4c768021fbc94d21ffd442b3fcdacd16e4f8`; its earlier exact-head validation on `001c75ea33382604221f5c63d0ca0f806731b01c` passed the Module Professionalization, Backend-only Module Boundary, RC425, MantiGO privacy and Pages validation jobs. Pages deployment was skipped for the PR event. Any added documentation below must be revalidated on the new final head.
- PR #669 (Team 03 catalog/directory status documentation) and PR #671 (Team 02 navigation keyboard-accessibility fix) are also open against the same main baseline. They remain separate team-owned work; do not duplicate or overwrite their files.
- The Team 01 register remains a coordination artifact. No production mutation, migration, grant/Auth change, Edge deployment, payment/finance operation, merge or site deployment is authorized by this preflight.

**Disposition:** current-schema restoration remains `BLOCKED`; release state remains `CATALOG_PILOT_GATE=PASS`, `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.



## 12. 2026-11-05 — Exact migration-alias source/ledger comparison

A second read-only reconciliation batch retrieved the exact recorded SQL statement bodies from `supabase_migrations.schema_migrations.statements[1]` and compared them character-for-character with the current `main` source files:

| Alias source | Recorded ledger target | Source file SHA | Comparison |
|---|---|---|---|
| `20261009010000_rc424_atomic_digital_page_payment_webhook.sql` | `20261008222845` | `49f46e3e159e6306534adbf61f626901c2d73488` | Exact match; 7,208 characters |
| `20261027100000_mantiqatix_marketing_contact_details.sql` | `20261027041411` | `1b85c341c0c9329e71f4fdbf36f2f852687994aa` | Exact match; 1,114 characters |

The marketing alias file and the already-recorded `20261027041411` source file have the same blob SHA and byte length. The live migration ledger stores the matching statement body under `20261027041411`.

The release reconciliation manifest already marks both source effects as verified, but `migration_alias_resolution_check` remains `PENDING_CONTROLLED_REPAIR`, with `resolved_aliases=0` and `ledger_repair_applied=false` for both. Its documented procedure explicitly requires a reviewed current-schema replay, backup/restore and rollout approval before a **Production migration-history-only write**.

**Decision:** record exact source/effect parity as VERIFIED for these two aliases; keep the migration-history repair BLOCKED/WAIT. Do not execute either SQL alias, add synthetic ledger rows, edit historical migrations, or update the production manifest to imply a repair has occurred. The 42 required source identifiers remain 0/42 in the exact-ID comparison; exact aliases only reconcile two effects and do not satisfy the wider release gate.



## 13. 2026-11-05 — Team 02 cover-image TODO reconciliation

The detailed catalog supplement `TODO_PRODUCTION.md` still describes PR #641 as not merged and its merge/deployment checks as pending. GitHub shows PR #641 was merged as `6e107164647453f7f8644b52db034f474f17f2cf`. Its PR-head Pages workflow `41286373956` passed validation, but its PR-event deploy job was skipped. The subsequent current-main Pages workflow `41970849104` on `218d4c768021fbc94d21ffd442b3fcdacd16e4f8` executed deployment and deployed-origin browser checks successfully. This confirms the current deployed source includes the PR, but not that its specific image URLs loaded or the fallback behavior was exercised.

A read-only source review of current-main `apps/catalog-frontend/src/components/DirectoryView.tsx` (blob `9cbcfdb49236088b06dd2d2cc28c4134886be131`) found:
- `directoryCoverImage()` returns external Google thumbnail / Google Play image URLs for unverified pharmacy/doctor activities.
- On the first image error, `onError` recomputes `directoryCoverImage({...biz, coverUrl: ''})`, which returns the same external URL for those categories and retries it.
- On the second error, the handler falls back to the generic `business-placeholder.svg`, not a bundled category-specific cover.
- Current automated browser tests cover verified-storefront cover semantics and accessibility, but no explicit doctor/pharmacy default-cover load/failure assertion was found in the inspected E2E source.

**TEAM02-DIR-COVER-20261105-01 — IN PROGRESS / NOT VERIFIED**
- Confirm the intended default image assets and rights/source.
- Replace or supplement unstable external defaults with bundled category-safe doctor/pharmacy covers.
- On image error, move directly to a distinct local category-aware fallback (no retry of the same URL), then use generic placeholder only as final fallback.
- Add browser tests for successful default load, failed external image, single fallback transition, no repeated network loop, and verified real-cover preservation.
- Perform deployed-origin visual/network verification before marking the task VERIFIED.

This is a Team 02 implementation dependency. Team 01 corrected the project records only; no frontend source or public assets were changed.
