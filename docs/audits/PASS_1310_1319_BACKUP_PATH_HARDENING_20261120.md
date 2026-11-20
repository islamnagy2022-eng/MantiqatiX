# PASS 1310–1319 — Backup verifier canonical path boundary hardening — 2026-11-20

## Implementation

- Identified that the off-site backup verifier's repository-boundary checks relied on lexical paths and could be bypassed by a symlinked parent directory.
- Updated `scripts/backup/verify-offsite-backup-manifest.mjs` to canonicalize the repository root, manifest directory, artifact paths and recovery identity before boundary checks.
- Artifact real paths must remain inside the canonical backup directory. The recovery identity must resolve outside both the repository and backup directory.
- Added two adversarial regression tests: manifest directory symlink into the repository; recovery identity symlinked parent into the repository.
- Corrected both test harness invocations to execute the verifier script and pass the manifest as its argument.

## Exact-head CI evidence

PR #899 merged as `ef152fbb351db6a52a64c4913140394a9c29eca7`.

- Encrypted Backup Manifest and Restore Evidence Gate run [44761709639](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/44761709639): **14/14 PASS, 0 failures, 0 skipped**.
- Module Professionalization Validation run [44761709703](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/44761709703): all 9 jobs PASS, including RC479, RC480, RC481, RC482, RC483, RC471, targeted ads and matrimony integration.
- Backend-only Module Boundary run [44761709863](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/44761709863): all 3 jobs PASS, including RC450 and approval-action audit.
- RC425 MantiGO Paymob Atomicity run [44761709778]: PASS.
- MantiGO Open Ride Privacy Boundary run [44761709645]: PASS.
- Deploy MantiqatiX Web run [44761709664]: validation, V6 desktop/mobile browser tests and screenshot/composed-site artifact steps PASS; actual deployment job was SKIPPED as expected for a PR.

## Production impact and remaining gate

- Documentation and verifier/test source only. No UI changes.
- No Production database, Auth, RLS, GRANT, Storage, Edge, payment, wallet, settlement or customer-data mutation.
- This change validates operator-supplied backup/restore evidence; it does not create a real Production backup, recover Vault keys, restore a separate PostgreSQL 17 project, or measure RPO/RTO.
- Production remains **BLOCKED / NOT CERTIFIED** pending operator-run encrypted DB + Storage export, off-site retrieval, Vault recovery, independent restore/rollback, measured RPO/RTO, chronological migration reconciliation and coordinated DB/Edge release.

## Next

Continue with the operator-controlled backup and independent restore rehearsal. Keep all Production migrations, Edge deployments and permission changes blocked until the complete release gate is evidenced.
