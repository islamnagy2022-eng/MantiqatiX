# V6 r5 exact-head validation and release boundary — 2026-11-06

## Scope and validated application head

- Repository: `islamnagy2022-eng/MantiqaTiX`
- Branch: `feat/v6-r5-preview-foundation-20261106`
- Validated application/source head: `0de8917431d2e2ecf5e4cd833cd08d4286e682e8`
- Pull request: [#685](https://github.com/islamnagy2022-eng/MantiqaTix/pull/685) — OPEN / DRAFT / NOT MERGED.
- Canonical source: AI Studio V6 r5, retained as an immutable source pack with SHA-256 provenance verification.
- Preview base: `/MantiqaTix/v6-preview/`.
- The existing electronic catalog remains the production root.

This record is a validation snapshot. It does not authorize merge, Pages deployment, root cutover, or production database/Auth/Edge/payment/finance changes.

## Exact-head CI — 0de89174

All eight workflow runs below report the exact same head SHA `0de8917431d2e2ecf5e4cd833cd08d4286e682e8`. Every executed job completed successfully.

| Workflow | Run | Result |
|---|---:|---|
| Primary Catalog Frontend Validation | [42238322177](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42238322177) | Build/typecheck, 32-journey browser E2E, employee/RBAC PostgreSQL — PASS |
| V6 Preview Source Validation | [42238322471](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42238322471) | Source preparation, public-context boundary, security/remediation tests and isolated Preview build — PASS |
| Pages validation | [42238322158](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42238322158) | V6 build, public-bundle blockers, module ownership audit, desktop/mobile E2E and axe — PASS; deploy SKIPPED |
| Backend-only Module Boundary | [42238322470](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42238322470) | Approval/audit PostgreSQL, RC450 integration and source validation — PASS |
| Module Professionalization Validation | [42238322282](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42238322282) | Matrimony privacy PostgreSQL, RC451 targeted-ads search-path and source validation — PASS |
| RC425 MantiGo Paymob Atomicity | [42238322184](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42238322184) | PASS |
| MantiGO Open Ride Privacy Boundary | [42238322356](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42238322356) | PASS |
| SMM Deferred Storefront Contract | [42238322377](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42238322377) | PASS |

## Public context and bundle separation — CLOSED FOR PREVIEW ARTIFACT

The canonical r5 archive remains unchanged. The preparation workflow now applies reviewed, deterministic overlays to the extracted worktree:

- Added a dedicated `PublicAppContext` for public directory reads, navigation, storefront selection and the existing Supabase OTP/membership authentication flow.
- Changed the V6 public entry and its directory, navigation, medical directory, contact, storefront and login components to use the dedicated public context.
- Extracted the public WhatsApp-contact and catalog filtering helpers from the broad legacy rules module into small public-safe modules.
- Extracted `DEFAULT_MEDICAL_SPECIALTIES` without changing its entries into `src/data/medicalSpecialties.ts`; the medical directory no longer imports the legacy `seedData.ts` graph.
- Added `scripts/test-v6-public-context-boundary.mjs` to reject imports of the monolithic context, legacy rules and seed data from public entry components.
- Added `scripts/test-v6-public-bundle-clean.mjs` as a blocking Pages build step. It rejects known private wallet/admin/demo-fixture markers in every V6 public JavaScript asset.
- The immutable r5 archive provenance check remains enforced before any overlay is applied.

### Exact-head audit result

The source-to-bundle graph audit on `0de89174` returned:

- Source files inspected: 73.
- Reachable source files from `src/main.tsx`: 25.
- Two source files still contain legacy-only markers, but both are unreachable from the public entry:
  - `src/context/AppContext.tsx` — `reachable=false`.
  - `src/utils/rules.ts` — `reachable=false`.
- Unresolved local imports: 0.
- Suspicious V6 built JS assets: 0.
- `V6_PUBLIC_BUNDLE_HYGIENE_STATUS=CLEAN`.
- Blocking regression test: `V6_PUBLIC_BUNDLE_CLEAN=PASS assets=1`.

The source review artifact [13511908148](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42238322158/artifacts/13511908148) was downloaded and inspected. It confirms that public components now use the isolated context and the medical directory imports the extracted specialty list; no public component under test imports `seedData.ts`, `AppContext.tsx`, or `utils/rules.ts`.

### Composed Preview artifact

- Pages run: [42238322158](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42238322158).
- Desktop/mobile browser E2E: `V6_PUBLIC_PREVIEW_BROWSER_E2E=PASS`.
- Axe: `critical=0`; zero non-critical violation groups.
- Artifact: [13511893117](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42238322158/artifacts/13511893117).
- Artifact SHA-256: `9a65362cd23ee18378c8f8c239c5fbd93f9073652b855d5e4a16fa751ca51563`.
- Downloaded ZIP integrity check passed. The archive has 65 entries, includes `v6-preview/index.html`, and contains one V6 JavaScript asset. Independent local inspection found none of the forbidden wallet/admin/demo markers in that asset.
- The Pages deploy job was SKIPPED for the pull-request event. The artifact is validated; the Preview is not live or publicly deployed.

## Primary catalog browser and RBAC results

The exact-head Primary Catalog Frontend Validation run [42238322177](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42238322177) completed all three jobs successfully:

- Build and TypeScript checks — PASS.
- Isolated employee/RBAC PostgreSQL behavior tests — PASS.
- `PRIMARY_CATALOG_BROWSER_E2E=PASS` across 32 named journeys, including progressive 20+20+remaining pagination, medical filters and specialty routes, verified-first storefront/catalog rendering, GPS consent and denial, activity admin, Super Admin navigation, owner/employee/branch scope, guest denial, public contact and responsive behavior.

These isolated tests do not certify every live production tenant or all production RLS behavior.

## Production gate — separate from V6 UI validation

The exact-head Pages artifact includes a source-contract verification report:

- 32 PASS, 0 FAIL, 0 PARTIAL, 1 BLOCKED, 0 NOT VERIFIED.
- `production_gate=BLOCKED`.
- The blocked item is live production migration/schema/Edge reconciliation; source presence and isolated replay do not prove production application.
- Exact release migration identity comparison: 42 required versions, 0 recorded in the live ledger under those exact version identifiers. Known aliases and physical effects remain separately reconciled; do not rewrite migration history.
- Payment/finance E2E and backup/restore rehearsal remain NOT VERIFIED.
- Six critical live Edge Function entrypoints differ from `main`: `order-create`, `payment-intent`, `paymob-webhook`, `digital-page-payment-intent`, `subscription-payment-intent`, and `financial-journal`.
- Financial-journal prerequisites RC449A/RC450, required columns, RPC signature and service-role execution remain unresolved in production.
- Auth leaked-password/security settings require owner-dashboard evidence.
- SMM gateway remains intentionally deferred until anonymous/authenticated negative runtime tests are recorded.
- RC424 was exactly reconciled by statement-byte comparison; preserve the applied ledger alias. The second source alias remains pending controlled resolution.

The detailed read-only evidence is in [PRODUCTION_READ_ONLY_RECHECK_20261106.md](PRODUCTION_READ_ONLY_RECHECK_20261106.md). No production writes were made. Do not apply migrations or deploy coupled payment/finance Edge Functions from this state.

## Remaining safe continuation

1. Perform a visual acceptance pass of the isolated Preview against the approved AI Studio r5 reference and record any concrete differences as a separate review list.
2. Keep V6 under `/MantiqaTix/v6-preview/` and preserve the existing catalog root until explicit release approval.
3. Refresh read-only production migration-ledger, physical-object, RPC/ACL and Edge Function evidence before planning any production repair.
4. Perform a disposable restore rehearsal and chronological forward-migration replay in an isolated environment.
5. Run payment/finance, webhook idempotency, wallet/settlement and rollback tests only in that isolated environment.
6. Obtain owner-dashboard evidence for Auth security settings and complete DR/restore validation.
7. Keep full production release BLOCKED until every required live check has current evidence.

## Release boundary

- PR #685 remains Draft and unmerged.
- No Pages deployment or root cutover was performed.
- No production Supabase migration, schema/data/Auth/RLS/GRANT, Edge Function, payment or finance mutation was performed.


## Fresh exact-head validation update — 2026-11-06 15:22 UTC

The branch head for this update was documentation-only commit `7788586cd2ac0e99db77bee40cfb2067095c3d76`; the validated application/source head remains `0de8917431d2e2ecf5e4cd833cd08d4286e682e8`.

All eight PR-triggered runs for `7788586cd2ac0e99db77bee40cfb2067095c3d76` completed successfully: Primary Catalog Frontend Validation [42242408931](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408931), V6 Preview Source Validation [42242408975](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408975), Pages [42242408959](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408959), Backend-only Module Boundary [42242408917](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408917), Module Professionalization [42242408999](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408999), RC425 MantiGo Paymob Atomicity [42242408979](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408979), MantiGO Open Ride Privacy Boundary [42242408949](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408949), and SMM Deferred Storefront Contract [42242409030](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242409030).

Primary Catalog build, employee/RBAC PostgreSQL and browser E2E all passed. Pages `validate` passed; `validate_public_only` and `deploy` were skipped for the PR event. The Preview therefore remains not deployed.

Latest composed artifact [13516086964](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408959/artifacts/13516086964) contains 65 files and has SHA-256 `11a86555154213d64ccabdb9724b53323a72852ac34f358d2d6954f075f85e53`. ZIP integrity, V6-only bundle marker scan, shared public config check and root-not-cut-over check passed. The V6 module audit [13516241550](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408959/artifacts/13516241550) reports 73 source files inspected, 25 reachable, the legacy marker-bearing modules unreachable, zero suspicious bundle assets, zero unresolved local imports, and `CLEAN`.

The current production read-only checkpoint is recorded in [PRODUCTION_READ_ONLY_RECHECK_20261106_1534UTC.md](PRODUCTION_READ_ONLY_RECHECK_20261106_1534UTC.md). This does not change the production gate: `BLOCKED / NOT CERTIFIED`.

PR #685 remains OPEN / DRAFT / NOT MERGED. No Pages deployment, production DB/Auth/RLS/GRANT/Edge/payment/finance change, or root cutover occurred.
