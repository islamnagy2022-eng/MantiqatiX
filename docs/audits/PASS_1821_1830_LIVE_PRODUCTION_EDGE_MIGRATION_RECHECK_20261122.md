# Pass 1821–1830 — live Production migration and selected Edge parity recheck

**Date:** 2026-11-22  
**Main baseline:** `54e433d54ace06a154d438ea672da4a781990730`  
**Production status:** **BLOCKED / NOT CERTIFIED**. Website deployment is verified separately from Supabase release readiness.

## Verified website and open feature work

- PR #975 and PR #976 are merged. PR #976 requires explicit `catalog_public.show_price === true` before numeric public price disclosure.
- Post-PR976 Pages deployment [45071129013](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45071129013) and Primary Catalog validation [45071128944](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45071128944) passed.
- PR #977 documentation-only continuity update was merged as `976b69ca5b062cfc89109b9f71ce4e22915e49b1`; PR #981 later added the live directory-disabled mitigation record and advanced main to `54e433d54ace06a154d438ea672da4a781990730`.
- PR [#978](https://github.com/islamnagy2022-eng/MantiqatiX/pull/978) remains DRAFT at head `96a6946e248c7abac24a02e93dd3b392819ee44a`. Exact-head CI passed: **28 success, 2 skipped, 0 failures**, including build, employee RBAC PostgreSQL and browser E2E. It implements one fixed cover and a separate gallery of up to 10 public HTTPS image URLs. It does not upload local files. Keep it draft because live catalog Edge functions lack the corresponding writer/reader projections and contact-consent parity.
- PR [#982](https://github.com/islamnagy2022-eng/MantiqatiX/pull/982) merged into main as dbf40f6b9f8087fd5a274749c4a4db3ceb7c7564 after exact-head CI: **28 success, 2 skipped, 0 failures**. Its default-closed guard requires exact server flag DIRECTORY_LISTINGS_ENABLED=true and a reachable contact-consent registry before GET/POST logic proceeds. No production flag was set and no Edge function was deployed.

## Fresh read-only Production checks

All checks below were read-only. No migrations, database writes, Storage changes or Edge deployment occurred.

### Migration ledger

- `supabase_migrations.schema_migrations`: **310 rows**.
- Latest live version: `20261110150618`.
- Compared all 76 exact required migration versions in the current release manifest: **0/76 present**; all 76 exact identifiers are absent from the live ledger.
- `public.directory_listing_contact_consents` is absent.
- `public.migration_release_registry` is absent.
- Disposable chronological replay is not a substitute for Production ledger reconciliation or a genuine backup restore.

### Selected deployed Edge source parity

The exact deployed `index.ts` source was compared with current main for four functions. All four differ.

| Function | Live version | Last updated (UTC) | Deployed entrypoint SHA-256 | Key finding |
|---|---:|---|---|---|
| `directory-listings` | 18 | 2026-11-22 04:38:53 | `bb65d74325f8bdf08f060f7ae2517bb30901630635d1de4f35523d7cef6afe48` | Intentionally disabled: GET returns empty results, POST returns 503. |
| `catalog-admin` | 20 | 2026-10-29 04:59:07 | `7732207160cf91176d4478d101f85be8789b9eb1ce1b9cd56499994b0cf9ea2c` | Deployed source lacks the main-source public-contact audit writer/verification flow. |
| `public-catalog-directory` | 19 | 2026-11-22 04:27:34 | `9eec1b65e5f85f0ac640ee44ace2e50abb7106da97bbfe52b8a2fb5ee449b9c6` | Deployed source lacks main's consent-aware public contact projection and promotional gallery projection. |
| `public-catalog` | 9 | 2026-11-22 04:26:19 | `e12cb7794c4083617924ccf6fb8aae5e572985c2e111e7df7e898dd4be824800` | Deployed source lacks main's consent-aware public contact projection and promotional gallery projection. |

The current live `directory-listings` v18 behavior is a protective disablement, not a completed public directory. Its GET response includes `listings=[]`, `pageSize=0`, `hasMore=false`, `nextCursor=null`, `directoryDisabled=true`; POST returns `DIRECTORY_LISTINGS_DISABLED_FOR_V1`/503. Preserve this behavior until the consent schema, source-rights gate and complete Edge bundle are ready.

The current main source for `catalog-admin` includes an owner-consent audit writer; the deployed v20 does not. Current main public readers require consent/audit verification; deployed v19/v9 are not at that source parity. Do not deploy any of the selected functions independently. A coordinated release must include the ordered schema migrations, authorization dependencies, audit writer, all matching public readers, storage/claim requirements and adversarial tests.

## Next work sequence

1. Complete PR #982 exact-head checks. If all required checks pass, merge the source-level default-closed guard, but do not deploy the Edge function or set the feature flag.
2. Keep PR #978 in draft until the matching catalog Edge/schema release exists. Its HTTPS-URL approach is not a file upload system; any later upload requires a reviewed owner-scoped Storage/Edge contract.
3. Obtain operator-owned encrypted off-site database and Storage backups, verify Vault recovery, perform independent PostgreSQL 17 restore/rollback, and record measured RPO/RTO.
4. Reconcile the 76 exact release migrations and required physical objects/ACLs; apply only as a reviewed ordered release after restore evidence.
5. Deploy RC472/RC473 contact-consent registry, owner audit writer, public reader projection and authorization dependencies together. Keep the national directory disabled until anonymous and owner grant/revoke/outage tests pass.
6. Resume Paymob/financial-journal E2E only after their schema/RPC/ACL contracts are reconciled. Monthly subscriptions and the medical directory remain deferred.

## Post-merge verification — PR #982

- PR982 merged as `dbf40f6b9f8087fd5a274749c4a4db3ceb7c7564`; exact-head CI 28 success, 2 skipped, 0 failed.
- Main Pages deployment run `45074571318` was pending when this note was updated. Do not claim post-merge website deployment until it succeeds.
- No Supabase Edge Function deployment and no Production environment flag change occurred.

## Change boundary

- Read-only live checks: Supabase Edge inventory/source retrieval; SELECT against migration ledger; presence checks for two control tables.
- Documentation updates only in the open documentation PR.
- No Production DDL/DML, migration, RLS/GRANT, Auth, Storage, Edge deployment, payments, wallet, settlement or customer-data mutation.
- **Production remains BLOCKED / NOT CERTIFIED.**
