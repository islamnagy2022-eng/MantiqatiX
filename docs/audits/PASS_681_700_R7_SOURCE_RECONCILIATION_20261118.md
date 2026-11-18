# Pass 681–700 — R7 source reconciliation and authority decision

Date: 2026-11-18  
Current Supabase project verified through the connected project record: `moyhiluyhjsujhwlyeuu` (`MANTIQATIX FINAL`, `us-east-2`, PostgreSQL 17.6.1).

## Source map

| Source | Classification | Decision |
|---|---|---|
| GitHub `main` | Current deployable application source | Authoritative for the live web application |
| Supabase project `moyhiluyhjsujhwlyeuu` | Live identity, schema, data and backend state | Authoritative for production contracts and data |
| Uploaded `bizcatalog-manager (11).zip` | AI Studio R7 snapshot dated 2026-11-11 | Historical reference for UI/mobile assets and feature comparison; not a replacement source |
| Uploaded `الامر-التقني.txt` | User's current operating directive | Canonical development and continuation policy; copied to `docs/MASTER_SOURCE_OF_TRUTH.md` |

## Confirmed R7 mismatches

1. **Wrong Supabase project reference in the archive.** `RELEASE_MANIFEST_R7.json`, `.env.example`, `ARCHITECTURE.md`, and `server.ts` use `moyhiluyhjsujhwlyweuu`. The connected live project record confirms the real reference is `moyhiluyhjsujhwlyeuu`. The archived URL and reference therefore do not identify the current production project.
2. **Conflicting data authority.** R7 describes a dual engine with local authoritative JSON at `.data/production-live-db.json` and Supabase synchronization. The current project directive requires Supabase to remain authoritative for identity, authorization and data. The R7 local-JSON authority must not be imported into the current application.
3. **Incompatible migration types.** The archived `supabase/migrations/20261110_mantiqatix_master_production_schema.sql` declares `businesses.id TEXT` and `products.business_id TEXT`. Live Production has `public.businesses.id UUID` and `public.user_memberships.business_id UUID`. The archived migration is not a compatible forward migration for the current database; applying it or using it as a schema baseline risks FK/type conflicts.
4. **Inconsistent release assertions.** R7 TODO/manifest/release documents report 24 tables, 11 tables, and 100%/23-of-23 release gates in different places. These are archive-authored claims, not current live verification evidence.
5. **Retained mobile value.** The archive contains Android WebView source and mobile UI assets. Preserve them as reference and compare file-by-file; do not delete or replace the current mobile project.
6. **Unsafe default business state.** The archived schema sets `businesses.is_verified DEFAULT TRUE` and `businesses.payment_status DEFAULT 'paid'`. Those defaults would mark newly inserted records verified and paid if adopted as a fresh schema, bypassing the current verification and paid-subscription activation gates.
7. **Different authorization model.** The archived RLS policies rely on JWT `role` and `sub` claims for admin/owner decisions. The current platform uses membership- and business/branch-scoped authorization. Do not copy those policies into the live project.

## Work completed in this audit

- Inspected the uploaded archive manifest, package, TODO, master TODO, architecture, release report, security report, continuation checkpoint, environment example, server persistence declarations and archived migration.
- Queried the live Supabase project metadata and live column types read-only.
- Confirmed the archive's project reference mismatch and its businesses primary-key type mismatch against live Production.
- No archived SQL was applied. No production schema, data, Auth, RLS, GRANT, Edge Function, payment, wallet or settlement state was changed.

## Operational decision

Continue from GitHub `main` and the live Supabase contracts. Use R7 only as a feature/UI/mobile reference. Port an individual R7 feature only after its contract is reconciled with current Supabase tables, RPCs, Edge Functions, RLS and existing frontend behavior, with isolated tests. Never bulk-import the R7 backend or migration.

## Current release gate

Production remains `BLOCKED / NOT CERTIFIED`: RC472–RC478 are not present in the live 310-row migration ledger; `directory-listings` remains v16; and an encrypted off-site backup plus isolated restore rehearsal with measured RPO/RTO remains unverified.
