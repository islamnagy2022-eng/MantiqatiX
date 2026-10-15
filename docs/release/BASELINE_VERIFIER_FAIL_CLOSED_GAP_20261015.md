# Baseline Verification Fail-Closed Gap — 2026-10-15

## Status

**Finding confirmed by source inspection.** This is a validation/evidence gap, not proof of a production compromise. The production release remains **BLOCKED / NOT CERTIFIED**.

## Evidence

Files reviewed on `recovery/verified-rc425-441-sources-20261014`:

- `scripts/validate-production-schema-baseline.mjs`
- `scripts/tests/validate-production-schema-baseline.test.mjs`
- `.github/workflows/production-baseline-forward-replay.yml`
- `scripts/replay-from-production-schema-baseline.sh`

The validator declares `ledgerPath` as `BASELINE_LEDGER_VERSIONS_FILE` or `/tmp/mantiqatix-ledger-versions.txt`. In `--verify`, it validates manifest fields and the snapshot SHA-256, but only validates the checkpoint, count, and ordered-version hash against the ledger export inside `if (fs.existsSync(ledgerPath))`. If that file is absent, verification can still print `BASELINE_VERIFY=PASS`.

The replay workflow runs the validator without setting `BASELINE_LEDGER_VERSIONS_FILE` and does not create that export in the replay job. It also checks out the migration PR's branch, while the reviewed snapshot and manifest currently live in separate PR #249. Therefore the observed run fails earlier with `BASELINE_BLOCKED: snapshot or provenance manifest is missing`, and never reaches the missing-ledger-evidence condition.

Current validator tests use a present ledger fixture in all four cases; they do not test absent ledger export, duplicate/out-of-order versions, wrong count/hash/checkpoint, or external-ledger disagreement.

## Required safe remediation

1. For the **approved disposable replay path**, require the ledger-version evidence file to exist. Fail closed if missing; do not silently skip the comparison.
2. Prefer embedding the complete ordered ledger-version list in the reviewed manifest or providing a separately captured, hashed evidence file. Verify ordering, uniqueness, count, last checkpoint, and SHA-256 against the declared evidence.
3. Pin the snapshot and manifest to an immutable reviewed commit SHA. Verify their SHA-256 values before placing them in a temporary workspace; do not fetch from a moving branch name.
4. Keep the snapshot `PENDING_REVIEW` until a human has reviewed RLS, grants, triggers, SECURITY DEFINER functions, provenance, and sensitive schema details. Do not mark it approved merely to make CI pass.
5. Add tests for: missing ledger evidence; duplicate versions; unordered versions; malformed version; incorrect checkpoint/count/hash; and external evidence mismatch.
6. Re-run validator tests and isolated forward replay. Preserve exact run URL and uploaded report. Do not run this script against production and do not apply the snapshot as a migration.

## Acceptance criteria

- Missing or malformed ledger evidence fails closed.
- Snapshot and manifest are fetched from a pinned, reviewed commit and their hashes match.
- Manifest ledger checkpoint/count/hash are independently checked against complete ordered version evidence.
- Isolated replay applies only forward migrations newer than the verified checkpoint and produces a non-vacuous report.
- Release gate remains blocked until all other required security, tenant-isolation, payment/finance, backup/restore, and runtime checks are evidenced.

## Existing evidence

- Failed forward replay run: https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38687517648
- Baseline review PR (keep draft): https://github.com/islamnagy2022-eng/MantiqaTiX/pull/249
- Source validator: https://github.com/islamnagy2022-eng/MantiqaTiX/blob/recovery/verified-rc425-441-sources-20261014/scripts/validate-production-schema-baseline.mjs
- Validator tests: https://github.com/islamnagy2022-eng/MantiqaTiX/blob/recovery/verified-rc425-441-sources-20261014/scripts/tests/validate-production-schema-baseline.test.mjs

No production database, migrations, grants, RLS policies, secrets, or deployment settings were changed as part of this review.