# Incremental Doctor Directory Ingestion

## Purpose
Persist collected doctor records in small batches so the directory can grow progressively instead of waiting for a nationwide collection run to finish.

## Endpoint
Supabase Edge Function: `directory-listings`

POST action: `IMPORT_DOCTOR_BATCH`

The action is available only after the existing platform Super Admin authorization check. It accepts 1–20 records per request and processes them sequentially, returning per-row outcomes. The platform admin directory screen now includes a JSON batch-import panel that calls this action through the authenticated client helper.

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
- `sourceName`, `sourceUrl`, `sourceCheckedAt`
- `listingStatus` (defaults to PUBLISHED when a valid phone exists)
- `metadata`

## Persistence rules
- Match an existing doctor by primary phone, secondary phone, or exact name + governorate + district before inserting.
- Update matching records rather than creating another row.
- Publish new rows only when at least one valid phone number is present, preserving the existing directory publication rule.
- If the phone is missing, save the record as DRAFT for follow-up; never invent contact details.
- Do not downgrade an already-published record because a later source snapshot omits its phone.
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
      "sourceUrl": "https://example.com/profile"
    }
  ]
}
```

## Release gate
This branch adds the ingestion action but does not deploy it to production. Before deployment, run Edge Function type/lint checks and an authenticated smoke test with a disposable test listing; verify insert, update/deduplication, draft-without-phone, and unauthorized rejection. Then merge and deploy the function together with its pagination helper.
