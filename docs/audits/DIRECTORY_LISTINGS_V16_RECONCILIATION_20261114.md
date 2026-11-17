# Directory listings v16 source reconciliation — 2026-11-14

## Why this branch exists

The deployed Supabase `directory-listings` Edge Function is v16 and its `index.ts` differs from the current `main` entrypoint. The two helper files (`pagination-filter.mjs` and `doctor-import-contract.mjs`) match `main` exactly. The deployed v16 entrypoint was preserved in the production-audit branch at `docs/audits/snapshots/directory-listings-v16-live-index.ts.txt`.

## Findings from the deployed v16 source

- The public response includes a metadata allowlist/sanitizer, which is useful and is retained in this branch.
- The live `BULK_IMPORT` path checks approved source evidence but can honor a requested `PUBLISHED` status instead of forcing imported rows to DRAFT.
- The direct `UPSERT_LISTING` path can publish a doctor listing with a valid phone and without checking current source-permission evidence. This bypasses the stronger publication rule already present in `main`.
- The source-permission evidence table itself enforces approval completeness and two-person separation (`approved_by` must differ from `created_by`).
- The live entrypoint adds Vite development CORS origins (`localhost:5173` and `127.0.0.1:5173`); this branch keeps the repository's existing allowlist and adds a regression assertion against those origins.
- Live v16 derives `is_verified` from `verified_by`. The database sets `verified_by` during the owner-claim flow, not professional-registration verification. This branch intentionally does not expose that ambiguous badge; it keeps the public `claim_status` field and strips verifier/claim identities.

## Changes in this candidate

1. Keep `main`'s staging-only bulk import and source-evidence gate for new doctor publication, draft-to-public transitions and source changes.
2. Add an explicit public metadata allowlist and sanitizer for all three public GET response paths.
3. Strip `verified_by`, `is_verified`, `claimed_user_id`, and `claimed_business_id` from public listing objects.
4. Preserve public `claim_status`; do not imply that an owner claim is professional registration verification.
5. Keep the canonical CORS allowlist and reject the extra Vite development origins.
6. Add behavior tests and static checks for metadata filtering, identity stripping, public response coverage and publication-gate preservation.

## Verification and release boundary

- The helper tests and static validators are wired into the existing doctor incremental-import workflow.
- The primary catalog workflow now also runs when `supabase/functions/directory-listings/**` changes.
- No Supabase Edge Function was deployed. This branch is a review candidate only; production rollout remains blocked by the wider migration, payment, backup/restore, Auth and Edge Function parity gates.
