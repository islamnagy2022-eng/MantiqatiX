# PASS 2141–2150 — RC472 / RC473 directory consent live recheck

**Date:** 2026-11-24, approximately 19:30 UTC  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Method:** read-only `to_regclass`, `to_regprocedure`, safe row-count query on the evidence registry, deployed Edge Function metadata and source inspection. No listing/contact data or personal records were read. No Production mutation was performed.

## 1. Database state

| Object | Live state |
|---|---|
| `public.directory_listing_contact_consents` | **Absent** |
| `public.directory_source_permission_evidence` | Exists; **0 rows** |
| `public.directory_listing_claim_requests` | Exists |
| `public.review_directory_listing_claim(uuid,uuid,text)` | Absent |
| `public.grant_directory_listing_contact_consent(uuid,uuid,text[])` | Absent |
| `public.revoke_directory_listing_contact_consent(uuid,uuid,text[])` | Absent |

The presence of the claim-request table alone does not provide a review workflow or permission to republish data. The evidence registry has no source-rights entries.

## 2. Deployed Edge Functions are distinct

### Legacy/unclaimed directory endpoint

- Function: `directory-listings`
- Live version: **18**
- Status: ACTIVE
- `verify_jwt`: false
- Deployed bundle hash: `bb65d74325f8bdf08f060f7ae2517bb30901630635d1de4f35523d7cef6afe48`
- The deployed `index.ts` is a deliberate fail-closed stub:
  - GET returns HTTP 200, `listings: []`, `pageSize: 0`, `hasMore: false`, `nextCursor: null`, `directoryDisabled: true`.
  - POST returns HTTP 503 with `DIRECTORY_LISTINGS_DISABLED_FOR_V1`.
  - OPTIONS rejects unapproved origins.

This keeps the legacy listing route from exposing unconsented records while maintaining the current frontend response shape.

### Public catalog directory endpoint

- Function: `public-catalog-directory`
- Live version: **19**
- Status: ACTIVE
- `verify_jwt`: false
- Its deployed source uses an explicit public-contact projection. The helper `getExplicitPublicContact` returns empty contact fields unless both `public_contact_enabled === true` and `public_contact_consent_audit_verified === true`.
- The endpoint selects a narrow public provider projection, not the complete provider base-table row, and constrains businesses, branches, catalog items and prices to public/active conditions.
- Public catalog availability is distinct from the disabled unclaimed-directory claim workflow. It is not evidence that the source-rights registry is complete.

## 3. Source and CI disposition

- RC472 is the source foundation for atomic directory claim review.
- RC473 adds field-scoped contact-consent storage and owner grant/revoke/expiry behavior.
- Existing disposable CI exercises no-consent, revoked-consent and explicitly consented field-by-field projections. These tests do not create the missing Production tables/RPCs.
- Do not enable `directory-listings` or republish the 965 legacy listing records based on the existence of claim-request rows. The separate source-rights evidence must be recorded and reviewed first.

## 4. Required next steps

1. Keep `directory-listings` fail-closed and preserve `public-catalog-directory`'s explicit contact-field projection.
2. Complete legal/source-rights evidence for each listing and contact scope.
3. Reconcile RC472/RC473 table, index, function, RLS, grant and audit effects against Production.
4. Include RC472 → RC473 in the ordered DB bundle only after the 81-ID physical-effect map, encrypted backup/restore, Auth/Vault recovery and release-owner approval.
5. After release, test owner claim, reviewer approval/rejection, grant, scope-limited read, revoke, expiry, no-consent, cross-tenant access and deployed-origin behavior.

**Production impact:** read-only inspection only. No DDL, DML, migration, RLS, GRANT, Storage, Auth, Edge, listing or contact-data write. Directory claim/publication remains **BLOCKED / DISABLED**.
