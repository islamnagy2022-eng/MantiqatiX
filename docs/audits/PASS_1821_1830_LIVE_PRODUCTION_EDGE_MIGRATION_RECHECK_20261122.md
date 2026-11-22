# Pass 1821–1830 — live Production migration and Edge recheck

**Date:** 2026-11-22  
**Main baseline:** `976b69ca5b062cfc89109b9f71ce4e22915e49b1`  
**Production status:** **BLOCKED / NOT CERTIFIED**. The GitHub Pages web deployment is verified, but the coordinated Supabase release remains incomplete.

## Verified website and current feature PR

- PR [#975](https://github.com/islamnagy2022-eng/MantiqatiX/pull/975) and PR [#976](https://github.com/islamnagy2022-eng/MantiqatiX/pull/976) are merged. PR #976 makes public numeric price display require explicit `catalog_public.show_price === true`.
- Post-PR976 main Pages deployment [run 45071129013](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45071129013) and Primary Catalog validation [run 45071128944](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45071128944) passed. PR #977 is documentation-only and was merged as `976b69ca5b062cfc89109b9f71ce4e22915e49b1`.
- PR [#978](https://github.com/islamnagy2022-eng/MantiqatiX/pull/978) is a draft at exact head `96a6946e248c7abac24a02e93dd3b392819ee44a`. It separates one fixed storefront cover from an owner-managed promotional image gallery of up to 10 URLs; the merchant editor accepts public HTTPS URLs, not file uploads. Exact-head check snapshot: 26 successful, 3 in progress, 1 skipped, 0 failures. Do not merge or deploy its Edge code as a standalone rollout: deployed catalog Edge functions currently lack the gallery fields and public-contact consent projection. The user-facing UI, admin writer and both public readers must be released together after production release gates are satisfied.

## Fresh read-only Supabase findings

All checks below were read-only. No migrations or Production data-plane writes were made.

### Migration ledger

- `supabase_migrations.schema_migrations`: **310 rows**.
- Latest recorded live version: `20261110150618`.
- The exact 76 release migration versions from `required_release_migration_ledger_check.required_versions` were compared with the live ledger: **0/76 found**; all 76 are absent.
- `public.migration_release_registry` is absent.
- `public.directory_listing_contact_consents` is absent.

A successful chronological replay in disposable PostgreSQL remains a test artifact, not proof of production migration application or a genuine backup restore.

### Selected live Edge Function parity

Exact deployed `index.ts` contents for four selected functions were compared with their current `main` source files. All four differ.

| Function | Live version | Last updated (UTC) | Current observed difference |
|---|---:|---|---|
| `directory-listings` | 18 | 2026-11-22 04:38:53 | Intentionally disabled: GET returns an empty listing; POST mutations return 503. This is a protective disablement, not a live public directory. |
| `catalog-admin` | 20 | 2026-10-29 04:59:07 | Deployed entrypoint lacks the main-source public contact audit writer/verification flow. |
| `public-catalog-directory` | 19 | 2026-11-22 04:27:34 | Deployed entrypoint lacks the main-source contact-consent-aware public projection. |
| `public-catalog` | 9 | 2026-11-22 04:26:19 | Deployed entrypoint lacks the main-source contact-consent-aware public projection. |

- The deployed `directory-listings` v18 response is deliberately empty (`listings=[]`, `pageSize=0`, `hasMore=false`, `directoryDisabled=true`). Keep this restriction in place.
- The live consent table is absent, so public phone/address disclosure must not be re-enabled.
- The current main sources for `catalog-admin`, `public-catalog-directory` and `public-catalog` contain the audit-consent contracts that their deployed versions do not. Do not push only one of these functions. The release must include the required schema, function bundle, authorization dependencies and tests as one coordinated unit.
- Live public gallery projection is not deployed in `public-catalog-directory` v19 or `public-catalog` v9. PR #978 therefore remains a draft pending coordinated Edge release.

## Next actions

1. Finish PR #978 exact-head browser E2E and all required workflows. Keep it in draft until the matched Supabase release can be scheduled.
2. Recover/verify operator-owned encrypted off-site database and Storage backups, Vault recovery and independent PostgreSQL 17 restore/rollback evidence.
3. Reconcile and apply only the ordered 76-version migration release after the genuine Production backup and the release runbook gates pass.
4. Release the contact-consent schema, owner audit writer, public reader projections, authorization dependency repair and tests together; keep `directory-listings` disabled until this completes.
5. Only after the coordinated Edge and migration release, add promotional-gallery projection and safe media-upload/storage policy work. The current PR supports HTTPS image links only; direct browser file upload is not implemented.
6. Resume Paymob and financial-journal sandbox E2E only after their production schema/RPC/ACL contracts are reconciled. Monthly subscriptions and the medical directory remain deferred.

## Change boundary

- Reads performed: Supabase Edge function inventory/source, SELECT on the migration ledger and presence of two release-control tables; GitHub source comparison.
- Writes performed: documentation-only source changes in the open documentation PR.
- No Production DDL/DML, migration, GRANT/RLS, Auth, Storage, Edge deploy, payments, wallet, settlement or customer-data write.
- **Production remains BLOCKED / NOT CERTIFIED.**

