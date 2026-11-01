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

## Release verification

The evidence registry migration and the directory ingestion action have been merged and deployed. The table is already present in Production. Do not re-apply this migration or run `supabase db push` until the migration-ledger version discrepancy described below has been reconciled.

CI now performs Deno type-checking, a static integration contract, and executable behavior tests for evidence validity, scope, revocation, expiry, hostname matching, listing-status rules, and protected metadata. These tests validate the pure decision helpers used by the Edge Function; they do not replace authenticated end-to-end POST tests against a disposable Supabase environment.

Authenticated smoke tests with synthetic records are still required for evidence registration, second-person approval, host/name mismatch rejection, expiry/revocation rejection, insert, update/deduplication, draft-without-phone, claim-state preservation, and unauthorized rejection. No synthetic doctor row or permission evidence is created in Production by this release.


## Production snapshot checked 2026-11-01

Read-only verification found 568 published doctor-type listings across all 27 governorates. All 568 have a source URL and a valid primary or secondary phone; a normalized cross-check of primary and secondary phone fields found no duplicates. 511 records explicitly state that coordinates were not supplied by their source; none is marked with coordinates as verified by this audit. This demonstrates one or more records in every governorate, not a complete census of doctors or verified clinic geolocation. Existing records were not modified by this verification.

The production Edge Function and admin import/evidence UI have been deployed. The write actions have not yet been exercised through authenticated live POST smoke tests. The read-only audit did not modify any existing listing.


## Private source-permission evidence registry (deployed to Production)

- Table: `public.directory_source_permission_evidence`; FORCE RLS, no direct grants to `anon` or `authenticated`, service-role-only access through the existing platform-Super-Admin-guarded Edge Function.
- Supported actions: list evidence; register pending evidence; approve pending evidence; revoke pending/approved evidence.
- Approval requires a second distinct platform Super Admin and an explicit confirmation that the referenced document was reviewed.
- Import rows must carry `sourcePermissionEvidenceId`; source name and normalized hostname must match exactly; evidence must be approved, unrevoked, in date, and grant both doctor-profile and commercial republication scope.
- Important limitation: the Edge Function validates registry state and the operator's review action, but it cannot independently decide whether a contract is legally sufficient. A human reviewer must inspect the private evidence document, and the legal/data owner must approve the intended commercial use.
- Production has the table and the deployed Edge Function actions. The evidence table currently contains zero rows. An isolated authenticated Edge Function runtime test remains outstanding.


## Scope controls added before publication

- Permission evidence registration requires two explicit, unchecked-by-default attestations: the document must allow republication of doctor profiles in a public directory, and it must allow commercial republication by MantiqatiX. The backend rejects registration unless both are explicitly true; it no longer silently grants either scope.
- The second-person approval prompt asks the reviewer to inspect the original document and confirm both scopes. The registry displays the saved scope flags.
- Phone de-duplication compares both incoming numbers against both stored phone columns, avoiding cross-column misses.
- Explicit HIDDEN status is retained even when a row has no phone; the no-phone publication guard only converts an otherwise-PUBLISHED listing to DRAFT.
- Row-level results distinguish PUBLISHED, DRAFT, and HIDDEN instead of reporting HIDDEN as DRAFT.

## Production publication and current operational state — 2026-11-01

- PR #640 merged the incremental ingestion and source-permission registry implementation into `main` (merge commit `7f30f2636afe516eacd550562efc686a232da84e`).
- PR #642 added behavior tests and extracted the pure validation helpers used by the production Edge Function; it merged as `4153dc82edee8bd869d97049b91161817317a20c`.
- Production Edge Function `directory-listings` is ACTIVE at version 12. The deployed `index.ts`, `doctor-import-contract.mjs`, and `pagination-filter.mjs` were each fetched from Production and compared byte-for-byte with `main`; all three matched. The pre-existing `verify_jwt=false` setting was retained; the function performs its own bearer-token and platform Super Admin checks for POST actions.
- Production database verification: 568 published doctor listings remain present across all 27 governorates; `directory_source_permission_evidence` contains zero rows; RLS and FORCE RLS are enabled; direct SELECT is denied to `anon` and `authenticated`, while `service_role` has SELECT.
- No doctor listings were inserted, updated, or deleted by these deployments. A source URL is still not a licence, and the existing 568 listings have not been retroactively cleared for republication rights.
- The dedicated Doctor Incremental Import Contract workflow passed Deno type-check, static integration checks, and all seven executable Node behavior tests. This validates helper logic and integration references; authenticated Edge Function write operations have not yet been smoke-tested with a disposable synthetic record.

### Migration-ledger reconciliation — outstanding

Production's `supabase_migrations.schema_migrations` ledger records `20261101140105 / directory_source_permission_evidence`, while the repository migration file is named `20261101150000_directory_source_permission_evidence.sql`. Live schema introspection confirmed that the table, columns, constraints, indexes, trigger, RLS, and grants match the repository migration. This is a migration-history mismatch, not evidence that the table is missing.

Do not change the historical migration file, manually edit `schema_migrations` with SQL, or run `supabase db push` until the mismatch is reconciled. Use the Supabase CLI's supported `supabase migration repair` workflow in a controlled environment, then compare `supabase migration list` local and remote output before any further push. Repairing migration history changes ledger records; it does not apply or reverse the table DDL. See the [Supabase CLI migration repair reference](https://supabase.com/docs/reference/cli/supabase-migration-repair).


## Monufia governorate doctor expansion — 2026-11-01

### Live production inventory (read-only)
- Current published `listing_type='doctor'` count for `governorate='المنوفية'`: **57**.
- All 57 are currently assigned to `district='بركة السبع'`; the other Monufia localities have **zero published doctor-type records** in the current canonical doctor listing type.
- All 57 have a primary phone number and are PUBLISHED. This does not prove the phone is current, owner-confirmed, or that the doctor is currently practicing at the recorded location.
- Current specialty distribution includes 8 obstetrics/gynecology, 7 general surgery, 6 pediatrics, 6 general dentistry, 5 internal medicine, and several smaller specialties; 8 rows have an unconfirmed/unspecified specialty label and need review.
- Existing records were not changed during this inventory.

### Geographic expansion targets
Track coverage independently for:
1. شبين الكوم
2. منوف
3. أشمون
4. قويسنا
5. الباجور
6. تلا
7. الشهداء
8. سرس الليان
9. مدينة السادات
10. بركة السبع (existing baseline; continue village-level gap review)

The third-party directory Dakatra Misr currently claims 420 general-practice listings across ten localities in Monufia (https://dakatramisr.com/general-practice/monufia-governorate). Treat this only as a discovery lead, not a verified census or an import source. Its public privacy/terms material does not grant MantiqatiX automated harvesting or commercial republication rights.

### Source and publication gate
- Menoufia University Faculty of Medicine publishes academic staff/department information and current institutional news (for example https://mu.menofia.edu.eg/med/StaffSearch/ar and https://mu.menofia.edu.eg/med/NewsDetails/170348/ar). These pages can support institutional affiliation and specialty leads, but do not provide a complete current private-clinic roster, direct clinic contact details, or an explicit commercial-republication licence.
- The Egyptian Medical Syndicate provides individual doctor-registration lookup and medical-facility discovery. The reviewed public material does not establish an open bulk export or a commercial-republication licence for doctor contact records.
- Do not scrape or bulk-copy private medical directories such as Dakatra Misr, Vudoctor, Vezeeta, or similar services without written permission covering both doctor-profile republication and commercial use.
- Do not turn university academic staff names into clinic listings unless an active clinical practice/location and a permitted publication basis are independently established.
- The production evidence registry currently has **zero approved permission records**. Therefore no new third-party-source doctor batch can be lawfully authorized through the current importer yet.
- Permitted next paths: a written data-sharing/republication agreement from a source owner; an applicable open licence that explicitly covers the personal/professional contact fields and commercial republication; or direct doctor/clinic-owner submission and consent captured in the private evidence registry.
- Once evidence is approved by a second distinct Super Admin, import in batches of 1–20, check global normalized name/primary+secondary phone duplicates first, preserve exact district/village, keep owner and professional-registration status unverified, and perform read-after-write verification.

### Current status
**IN PROGRESS — inventory established; geographic expansion blocked on an approved source/owner-consent basis.** No new Monufia doctor records were inserted or modified by this pass.
