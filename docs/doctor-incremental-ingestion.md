# Incremental Doctor Directory Ingestion

## Purpose
Persist collected doctor records in small batches so the directory can grow progressively instead of waiting for a nationwide collection run to finish.

## Endpoint
Supabase Edge Function: `directory-listings`

POST action: `IMPORT_DOCTOR_BATCH`

The action is available only after the existing platform Super Admin authorization check. It accepts 1–20 records per request and processes them sequentially, returning per-row outcomes. The platform admin directory screen now includes a JSON batch-import panel that calls this action through the authenticated client helper.

Every row must include a source name, an exact HTTP(S) source URL, and `sourcePermissionEvidenceId`. The ID must refer to an entry in the private `directory_source_permission_evidence` registry.

The registry records the exact source host, source name, permission basis, private evidence reference, optional SHA-256, scope, validity dates, reviewer, and revocation state. New evidence starts as `PENDING`; a different platform Super Admin must review the actual contract/consent/licence and approve it. Self-approval is rejected both in the Edge Function and by a database constraint. The importer accepts only evidence that is `APPROVED`, not revoked, currently valid, and explicitly covers doctor-profile plus commercial republication. Source host and source name must match the evidence record exactly (with a leading `www.` normalized).

A public webpage by itself is not proof of republication permission. Do not scrape or re-publish directories whose terms prohibit automated extraction or commercial republication without written permission. The evidence reference must point to a private-storage object key or internal contract/consent reference; it must not be a public link. The current registry requires a human reviewer to inspect the referenced evidence; it does not independently authenticate the content of the file.

## Required row fields
- `displayName`: doctor's public name
- `specialty`: specialty label
- `governorate`: confirmed governorate
- `district`: confirmed city/center
- `taxonomyCategoryId`: a medical taxonomy category ID (or `cat_custom_...`)

## Optional row fields
- `phone`, `secondaryPhone`
- `address`, `village`
- `taxonomySpecialty`
- Required provenance: `sourceName`, `sourceUrl`, and an approved `sourcePermissionEvidenceId` whose host and source name match the row.
- `sourceCheckedAt`
- `listingStatus` (`PUBLISHED`, `DRAFT`, or `HIDDEN`; new rows default to PUBLISHED with a valid phone, otherwise DRAFT; on existing rows, an omitted status preserves the existing state).
- `metadata`

## Persistence rules
- Match an existing doctor by primary phone, secondary phone, or exact name + governorate + district before inserting.
- Update matching records rather than creating another row.
- Publish new rows only when at least one valid phone number is present, preserving the existing directory publication rule.
- If the phone is missing, save the record as DRAFT for follow-up; never invent contact details.
- Do not downgrade an already-published record because a later source snapshot omits its phone.
- Do not change an existing slug, DRAFT/HIDDEN/PUBLISHED state, claim/ownership state, or source-check timestamp unless the incoming row explicitly supplies the corresponding change.
- Do not allow imported metadata to set phone verification, owner confirmation, professional-registration verification, or geocoordinate verification flags. New imported rows remain explicitly unverified.
- Return row-level success/failure and aggregate inserted, updated, drafted, and failed counts.

## Example request
```json
{
  "action": "IMPORT_DOCTOR_BATCH",
  "rows": [
    {
      "displayName": "اسم الطبيب",
      "specialty": "طب الأطفال",
      "governorate": "المنوفية",
      "district": "شبين الكوم",
      "village": "",
      "phone": "01000000000",
      "taxonomyCategoryId": "cat_medical_health_...",
      "sourceName": "مصدر الدليل",
      "sourceUrl": "https://example.com/profile",
      "sourcePermissionEvidenceId": "UUID-FROM-APPROVED-EVIDENCE-REGISTRY"
    }
  ]
}
```

## Release gate
This branch adds the evidence registry and ingestion action but does not deploy either the migration or Edge Function to production. Before deployment, apply the migration in an isolated database, run Deno/type/build and browser E2E, and run authenticated smoke tests with synthetic records for evidence registration, second-person approval, host/name mismatch rejection, expiry/revocation rejection, insert, update/deduplication, draft-without-phone, claim-state preservation, and unauthorized rejection. Then merge and deploy the migration and Edge Function together.


## Production snapshot checked 2026-11-01

Read-only verification found 568 published doctor-type listings across all 27 governorates. All 568 have a source URL and a valid primary or secondary phone; a normalized cross-check of primary and secondary phone fields found no duplicates. 511 records explicitly state that coordinates were not supplied by their source; none is marked with coordinates as verified by this audit. This demonstrates one or more records in every governorate, not a complete census of doctors or verified clinic geolocation. Existing records were not modified by this verification.

Current production function remains unchanged until this PR passes runtime tests and is deployed. The import endpoint and UI in this branch are not yet active in production.


## Private source-permission evidence registry (added on the feature branch)

- Table: `public.directory_source_permission_evidence`; FORCE RLS, no direct grants to `anon` or `authenticated`, service-role-only access through the existing platform-Super-Admin-guarded Edge Function.
- Supported actions: list evidence; register pending evidence; approve pending evidence; revoke pending/approved evidence.
- Approval requires a second distinct platform Super Admin and an explicit confirmation that the referenced document was reviewed.
- Import rows must carry `sourcePermissionEvidenceId`; source name and normalized hostname must match exactly; evidence must be approved, unrevoked, in date, and grant both doctor-profile and commercial republication scope.
- Important limitation: the Edge Function validates registry state and the operator's review action, but it cannot independently decide whether a contract is legally sufficient. A human reviewer must inspect the private evidence document, and the legal/data owner must approve the intended commercial use.
- Migration and UI are feature-branch changes only. They have not been applied to Production. An isolated migration replay and authenticated Edge Function runtime tests remain mandatory.


## Scope controls added before publication

- Permission evidence registration requires two explicit, unchecked-by-default attestations: the document must allow republication of doctor profiles in a public directory, and it must allow commercial republication by MantiqatiX. The backend rejects registration unless both are explicitly true; it no longer silently grants either scope.
- The second-person approval prompt asks the reviewer to inspect the original document and confirm both scopes. The registry displays the saved scope flags.
- Phone de-duplication compares both incoming numbers against both stored phone columns, avoiding cross-column misses.
- Explicit HIDDEN status is retained even when a row has no phone; the no-phone publication guard only converts an otherwise-PUBLISHED listing to DRAFT.
- Row-level results distinguish PUBLISHED, DRAFT, and HIDDEN instead of reporting HIDDEN as DRAFT.
