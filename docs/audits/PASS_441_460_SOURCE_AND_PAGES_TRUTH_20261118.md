# Pass 441–460 — source and Pages production-root reconciliation

Date: 2026-11-18  
Main commit after PR #774: `777884bd76c75d792d9e7a565da26fc7e8fca4b7`.

## Pages deployment truth

The authoritative deployment workflow is `.github/workflows/pages.yml`, and the completed deployment run `44224482241` records:

- `MANTIQATIX_LEGACY_PRIMARY_ROOT_DEPLOY=PASS`
- `MANTIQATIX_LEGACY_CATALOG_DEPLOY=PASS`
- `MANTIQATIX_V6_PREVIEW_ALIAS_DEPLOY=PASS`
- `MANTIQATIX_DEMO_AND_SMM_ROUTES=NOT_PUBLISHED`

Therefore the actual published paths are:

| Path | Current content |
|---|---|
| `/MantiqatiX/` | Legacy catalog application — production root |
| `/MantiqatiX/legacy/` | Rollback copy of the catalog application |
| `/MantiqatiX/v6-preview/` | V6 preview alias — not the production root |

The README and older audit wording that described V6 as the production root was incorrect and has been corrected. No Pages root cutover was performed. The current deployment policy intentionally retains the catalog root while the full platform production gate is blocked.

The post-PR #772 main deployment run `44226150407` completed the Pages deploy and root verification steps; its deployed-origin Playwright setup was still running at the time of this audit. The previous fully completed deployment run `44224482241` passed deployed-origin browser verification. PR #774 changes backend source/migrations and documentation, not the public frontend composition.

## Latest R7 archive intake

- Latest uploaded file: `bizcatalog-manager (11).zip`, SHA-256 `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`, 46,114,882 bytes.
- ZIP integrity: PASS; 270 entries; 118 `src/` files; Android wrapper source retained; 0 WebP assets.
- The exact upload differs from earlier R7 archives by hash and source-file count. It has its own intake audit: `docs/audits/R7_ARCHIVE_11_INTAKE_20261118.md`.
- P0 findings: hard-coded server fallback secrets, demo login credentials/role switchers, browser-stored role/session state, local JSON declared authoritative, wrong Supabase project reference in manifest, missing claimed production data/release artifacts.
- The R7 archive remains a UI/behavior reference candidate, not the production implementation. Do not overwrite current main or delete the Android wrapper.

## Governing operating directive

The user's uploaded `الامر-التقني.txt` is now preserved as `docs/MASTER_SOURCE_OF_TRUTH.md`. It supersedes older conflicting continuity prompts and defines the autonomous execution cycle, P0–P6 priority order, merge rules, evidence-based progress and production boundaries.

## Disposition

No source archive was imported wholesale, no production root changed, and no Supabase migration/Edge deployment/payment/settlement was executed in this pass. The current root remains the catalog application; V6 is preview; R7 remains unapproved for direct deployment.
