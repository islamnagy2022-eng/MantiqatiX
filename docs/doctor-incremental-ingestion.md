# Incremental Doctor Directory Ingestion

## Purpose
Persist collected doctor records in small batches so the directory can grow progressively instead of waiting for a nationwide collection run to finish.

## Endpoint
Supabase Edge Function: `directory-listings`

POST action: `IMPORT_DOCTOR_BATCH`

The action is available only after the existing platform Super Admin authorization check. It accepts 1–20 records per request and processes them sequentially, returning per-row outcomes. The platform admin directory screen now includes a JSON batch-import panel that calls this action through the authenticated client helper.

Every row must include a source name, an exact HTTP(S) source URL, and `sourcePermissionStatus`. Allowed values are:
- `LICENSED`: written republication licence/permission has been obtained.
- `OWNER_PROVIDED`: the doctor/clinic supplied the information.
- `PUBLIC_PERMISSION_CONFIRMED`: the specific source explicitly permits republication.

A public webpage by itself is not proof of republication permission. Do not scrape or re-publish directories whose terms prohibit automated extraction or commercial republication without written permission.


### Important limitation: permission status is an operator declaration

The importer validates that the platform administrator selects one of the allowed permission-basis values, but it does **not** independently verify or store the underlying contract, consent, or licence document. Therefore, `LICENSED`, `OWNER_PROVIDED`, and `PUBLIC_PERMISSION_CONFIRMED` are operator declarations, not proof that republication rights have been verified. Do not use these values as a substitute for reviewing the actual evidence. Before accepting a batch, the responsible reviewer must confirm the applicable consent/licence outside the public listing record. A private, auditable evidence registry is a required hardening task before autonomous nationwide ingestion or high-volume batch operations.

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
- Required provenance: `sourceName`, `sourceUrl`, and `sourcePermissionStatus` (see allowed values above).
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
      "sourcePermissionStatus": "OWNER_PROVIDED"
    }
  ]
}
```

## Release gate
This branch adds the ingestion action but does not deploy it to production. Before deployment, run Edge Function type/lint checks and an authenticated smoke test with a disposable test listing; verify insert, update/deduplication, draft-without-phone, and unauthorized rejection. Then merge and deploy the function together with its pagination helper.


## Production snapshot checked 2026-11-01

Read-only verification found 568 published doctor-type listings across all 27 governorates. All 568 have a source URL and a valid primary or secondary phone; a normalized cross-check of primary and secondary phone fields found no duplicates. 511 records explicitly state that coordinates were not supplied by their source; none is marked with coordinates as verified by this audit. This demonstrates one or more records in every governorate, not a complete census of doctors or verified clinic geolocation. Existing records were not modified by this verification.

Current production function remains unchanged until this PR passes runtime tests and is deployed. The import endpoint and UI in this branch are not yet active in production.
