# R6 Import Checkpoint — 2026-11-10

## Source of truth

The only approved application source remains `/MANTIQATIX/bizcatalog-manager (6).zip`, with the previously recorded SHA-256:

The original Library item is present in metadata (37,305,478 bytes; editor access), but raw-byte materialization is denied in this runtime. Do not treat a checksum that cannot be recomputed from the original bytes as verified. The repository's established import handoff instead uses the sanitized transfer archive `bizcatalog-manager-6-preview-clean.zip`, SHA-256 `a87bfc9e80a155277e1f35d8fb29ccff159eba9c31a6f00ffc35eee555e36241` (13,211,088 bytes, 117 files), uploaded by the owner to Codespaces.

The exact Library item is present in metadata (37,305,478 bytes; editor access), but its raw-byte materialization was denied in this runtime and a text read failed internally. Therefore the archive was not extracted, rehashed, or imported. `bizcatalog-manager (7).zip` is a separate conversation attachment and was not substituted for R6.

## Work completed in this checkpoint

- Reviewed the established five-stage Preview hardening/import pipeline already present on this branch (`scripts/import-r6-preview.sh` plus the five hardening scripts).
- Confirmed that it expects the sanitized transfer archive and commits only to `apps/bizcatalog-manager-6-preview` on the isolated Preview branch.
- Removed a newly-added duplicate importer and its CI hook after discovering the established pipeline; no duplicate import route is retained.
- Updated README to point to the existing Codespaces import guide.
- No account, business, catalogue, subscription, wallet, payment, transaction or other operational data is migrated by the documented import workflow. It does not deploy or change production.

## Verification performed

- Existing import script and five sanitation stages were reviewed from the repository source.
- The established runbook documents checksum validation, archive safety checks, branch guard, isolated target, and preview CI.
- The raw original Library archive could not be materialized in this runtime, so no new hash or real archive inspection is claimed.
- No R6 application build, real import, Preview deployment, backend integration, or Production certification was performed in this checkpoint.

## Next required action

Upload the exact owner-approved `bizcatalog-manager-6-preview-clean.zip` transfer archive into Codespaces on `preview/bizcatalog-manager-6-isolated`. Follow `docs/R6_CODESPACES_IMPORT_AR.md` and run `bash scripts/import-r6-preview.sh bizcatalog-manager-6-preview-clean.zip`. Do not rename another ZIP to impersonate this archive. After the import commit, push only the Preview branch, review the R6 Preview Build workflow, and proceed to isolated preview acceptance before any backend integration.

## Production state

The deployed website has not changed. No Production database, Auth, RLS, grants, Edge Functions, payments, finance or customer data were changed. R6 remains not imported and the full platform gate remains `BLOCKED / NOT CERTIFIED`.
