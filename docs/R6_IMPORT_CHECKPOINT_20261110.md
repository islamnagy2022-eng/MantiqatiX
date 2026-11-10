# R6 Import Checkpoint — 2026-11-10

## Source of truth

The only approved application source remains `/MANTIQATIX/bizcatalog-manager (6).zip`, with the previously recorded SHA-256:

`c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`

The exact Library item is present in metadata (37,305,478 bytes; editor access), but its raw-byte materialization was denied in this runtime and a text read failed internally. Therefore the archive was not extracted, rehashed, or imported. `bizcatalog-manager (7).zip` is a separate conversation attachment and was not substituted for R6.

## Work completed in this checkpoint

- Added `scripts/import-r6-cleanroom.py` to the isolated branch.
- Added `docs/R6_CLEANROOM_IMPORT_RUNBOOK.md`.
- The importer pins the approved R6 SHA-256, checks ZIP CRC, rejects path traversal, duplicate paths, symlinks, suspicious compression ratios and oversized archives, and refuses a pre-existing target.
- It excludes local/private/generated state such as `.data/`, `.aistudio/`, `.env*`, local DB/backup files, dependency/build caches, and the local root `server.ts`.
- It requires the R6 `src/components/mobile/` files to be present and records medical-scope candidate paths for explicit public-scope review.
- It stages source only at `apps/aistudio-v6`; no account, business, catalogue, subscription, wallet, payment, transaction or other operational data is migrated. It does not deploy or change production.

## Verification performed

- Python syntax compilation: PASS.
- Positive synthetic ZIP staging test: PASS.
- Mobile source retention in fixture: PASS.
- Exclusion of local data and environment files in fixture: PASS.
- Hard-coded secret detection/refusal test: PASS.
- Zip-slip/path-traversal refusal test: PASS.
- SHA-256 mismatch refusal test: PASS.
- Existing-target refusal is implemented; must be confirmed against the real R6 archive during staging.

These are importer fixture tests only. They are not R6 application tests, not a real R6 import, and not Production certification.

## Next required action

Upload the exact `bizcatalog-manager (6).zip` bytes into the Codespaces workspace on `preview/bizcatalog-manager-6-isolated`. Run the audit-only command in the runbook, review the JSON report and exclusions, then run the staging command. Do not rename or substitute another archive. After staging, review the generated manifest, preserve the mobile UI, keep the dedicated medical directory out of the public website build, and begin the R6-to-Supabase contract mapping before backend integration.

## Production state

The deployed website has not changed. No Production database, Auth, RLS, grants, Edge Functions, payments, finance or customer data were changed. R6 remains not imported and the full platform gate remains `BLOCKED / NOT CERTIFIED`.
