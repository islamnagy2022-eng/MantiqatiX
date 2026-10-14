# MantiqaTix — Production Baseline
**Snapshot date:** 2026-10-14  
**Purpose:** Evidence-led baseline for sequential domain closure. This document records observations, not release approval.

## Repository baseline
- Repository: `islamnagy2022-eng/MantiqaTix`
- Default branch: `main`
- Latest commit independently returned by GitHub commit search: [`8a56358d505d2c12878440037f7f24ba65d2ea10`](https://github.com/islamnagy2022-eng/MantiqaTix/commit/8a56358d505d2c12878440037f7f24ba65d2ea10) — `docs: link mandatory project continuity records`, created 2026-10-11T03:47:11Z.
- Working documentation branch for this audit: `docs/production-baseline-recovery-2026-10-14`.
- Current deployment URL: https://islamnagy2022-eng.github.io/MantiqaTix/
- Production release state: **BLOCKED / NOT CERTIFIED** until all mandatory gates are evidenced.
- No application code, production schema, production data, secrets, deployed functions, or release configuration were changed as part of this baseline capture.

## Supabase production snapshot
- Project ref: `moyhiluyhjsujhwlyeuu`
- Status: `ACTIVE_HEALTHY`
- PostgreSQL: `17.6.1.155`, region `us-east-2`.
- Read-only migration ledger query: **283** records; first version `20260808000000`; latest version `20261008222845` (`rc424_atomic_digital_page_payment_webhook`).
- The ledger result is a production observation; it does **not** prove that every repository migration is present, ordered, replayable, or equivalent to production schema.
- Security Advisor snapshot observed 2026-10-14T01:47:56.708Z:
  - 1 INFO: RLS enabled without policies on `public.digital_page_payment_events`.
  - 1 WARN: anon can execute SECURITY DEFINER function `public.get_mnty_targeted_advertisements(...)`.
  - 40 WARN findings for authenticated-executable SECURITY DEFINER functions.
  - These are review findings, not automatic proof of exploitable vulnerabilities. Each caller contract must be reviewed; do not blanket-revoke or add broad policies.

## Stale-record reconciliation
- `docs/PROJECT_CONTINUITY.md` and `docs/SESSION_LOG.md` previously named `735f0451...` as current main. The current main commit returned by GitHub commit search is `8a56358d...`; the documentation is therefore stale on the precise HEAD reference.
- `docs/MASTER_PRODUCTION_TODO.md` contains older dated evidence and still-open gates. Preserve historical records; use this snapshot as the newer evidence layer, not as a rewrite of history.
- `docs/PRODUCTION_BASELINE.md`, `docs/PRODUCTION_AUDIT.md`, and `docs/SCHEMA_RECONCILIATION.md` did not exist on `main` at the time of this audit; these are being introduced in this documentation-only review branch.

## Domain closure method
Each requirement must have:
1. A stable ID and expected behavior.
2. Implementation evidence (file/function/migration/commit).
3. Test evidence and exact run/result.
4. Security and tenant-boundary review where applicable.
5. External dependency or owner action recorded explicitly.
6. Status kept separate across implementation, verification, and release eligibility.

Allowed statuses: `PASS`, `IMPLEMENTED`, `PARTIAL`, `TODO`, `BLOCKED`, `WAIT`, `NOT VERIFIED`.
Do not convert unknowns to PASS. A domain is not closed solely because code exists or CI is green.

## First domain result
**Domain 1 — Baseline and requirements register: PARTIAL.**
Verified: current main reference, production project health, migration ledger count/latest version, current Security Advisor categories, and stale continuity HEAD references.
Open: migration source-to-ledger reconciliation; current full schema/RLS inventory; complete per-function SECURITY DEFINER review; current CI/release gate result; independent requirement-by-requirement evidence matrix.
Next domain: schema/migration reconciliation and safe release/security boundaries, with no production mutation.
