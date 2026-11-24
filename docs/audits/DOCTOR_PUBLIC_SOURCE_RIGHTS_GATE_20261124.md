# Doctor directory public republication gate — 2026-11-24

## Decision

Doctor profiles are a distinct publication category. A public URL, prior PUBLISHED status, a phone/address consent grant, or a claimed profile does not establish permission to republish the doctor profile commercially. Public discovery is allowed only when a source-evidence row is currently APPROVED and exactly matches both normalized source host and source name, with explicit doctor-profile and commercial republication scopes, a current validity window, and no revocation.

The existing private evidence workflow supports `LICENSED`, `OWNER_PROVIDED`, and `PUBLIC_PERMISSION_CONFIRMED` bases. An owner-provided record is accepted only through that same private, two-person review; merely claiming an existing third-party sourced listing does not change its source attribution or bypass the gate. If an owner later supplies a new profile, the provenance must be deliberately changed through an authorized and auditable owner workflow, and evidence must cover the new source before the doctor profile is published.

Non-doctor listings retain their separate publication contract through an explicit current allowlist: `business`, `clinic`, `pharmacy`, `medical_center`, `hospital`, `laboratory`, and `health_provider`. Unknown or missing listing types fail closed rather than accidentally bypassing the rights gate. The doctor-only rule does not imply that every business listing has a doctor republication license requirement. Contact fields remain independently subject to the directory contact-consent rules.

## Implementation candidate

- A bounded read-only source-evidence inventory is loaded before GET responses. Registry errors or an inventory that reaches the 1,000-row scan cap deny doctor rows by supplying no evidence to the doctor predicate; explicitly allowlisted non-doctor categories remain available. Unknown listing types still fail closed.
- Slug GET checks doctor evidence before serializing a row.
- Legacy list GET filters doctor rows without qualifying evidence.
- Keyset pagination scans ordered raw batches until it finds `limit + 1` eligible rows. The continuation cursor is the last delivered eligible row, not the last scanned row; therefore denied records cannot silently consume a page or cause an eligible record to be skipped. A 2,000-row scan cap returns an explicit 503 instead of a partial/incomplete page.
- Registry evidence references, approver identities, hashes and internal notes are not selected for public responses.
- No database migration is needed for this source-only candidate because the private registry and its source evidence fields already exist in Production. This does not mean it has approved rows; the live registry currently contains zero records.
- The endpoint remains behind the existing explicit `DIRECTORY_LISTINGS_ENABLED` release gate. No Production Edge deployment or environment flag change is included.

## Tests

Pure behavioral tests cover exact approved match, wrong host/source, pending/revoked/expired/not-yet-valid records, missing evidence/provenance, claimed-vs-unclaimed behavior, the explicit non-doctor type allowlist, rejection of unknown/missing types, mixed rows, cursor scanning, scan-limit failure, database read failure, and registry outage isolation (doctor rows denied while non-doctor categories remain available). Static validation proves slug, legacy list and keyset paths all enforce the contract. PostgreSQL/Edge source parity and deployed-origin tests remain required before release.

## Production evidence

At the 2026-11-24 read-only checkpoint:
- 568 PUBLISHED doctor rows exist (567 UNCLAIMED and one CLAIM_PENDING).
- All 568 have source URLs.
- `directory_source_permission_evidence` has zero rows (0 approved).
- This endpoint's deployed version v18 remains the intentional fail-closed stub. No row-level doctor/contact data was accessed in the aggregate query.

This candidate does not remove or rewrite existing records, populate legal evidence, or certify any profile for republication. Keep public directory discovery disabled until the full release gates pass, including backup/restore, migration reconciliation, coordinated Edge bundle review, contact-consent coverage and adversarial runtime testing.
