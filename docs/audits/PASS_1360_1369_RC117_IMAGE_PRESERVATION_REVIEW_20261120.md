# Pass 1360–1369 — RC117 default-image preservation review

**Date:** 2026-11-20  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Production actions:** none. Source inspection and previously refreshed catalog manifest only.

## Scope inspected

- Historical source migration: `supabase/migrations/20261027070000_rc117_default_images_and_activity_admin.sql`.
- RC117 SQL contract: `supabase/tests/rc117_default_images_and_activity_admin_contract.sql`.
- Current frontend local fallback engine: `apps/catalog-frontend/src/utils/defaultImages.ts`.
- Current shared Edge default-image helper: `supabase/functions/_shared/default-images.ts`.
- Current category-aware image validator: `scripts/validate-category-aware-default-catalog-images.mjs`.
- Canonical Production physical-object reconciliation: `docs/release/production-migration-reconciliation.json`.

## Confirmed source defect

The RC117 migration's normal marketing-service trigger preserves a non-empty image URL when `image_source` is blank by normalizing the source to `owner`. However, its existing-row bulk backfill is inconsistent:

```sql
UPDATE public.marketing_services
SET image_url = public.mnty_default_image_url(...),
    image_source = 'auto'
WHERE coalesce(image_url,'')='' OR coalesce(image_source,'')='';
```

A non-empty owner-selected `image_url` with a NULL/blank `image_source` satisfies the WHERE clause and is replaced with a default. The migration's comment says custom supplied URLs are preserved, but this marketing-service predicate does not preserve that case.

The current RC117 SQL contract checks that existing marketing services have non-empty images, but does not test preservation of a custom URL when provenance is blank. The frontend category-aware validator covers owner logo/cover preservation and local fallbacks, but does not cover this historical database backfill.

## Production impact

The current canonical physical-object inventory reports all nine RC117 image-related contracts absent in Production, including:
- business/catalog image-source columns,
- marketing service `image_url` and `image_source`,
- the default-image helper and three trigger functions.

Thus the reviewed historical backfill is a source defect to repair before any RC117 forward rollout. There is no evidence that this backfill has run in Production. No application rows were queried to investigate existing images.

Issue **#906** tracks the required forward-only repair and acceptance tests.

## Required forward-only correction

- Preserve non-empty existing `image_url` values regardless of blank provenance.
- For non-empty URLs with unknown provenance, set provenance to `owner`, unless an exact legacy-auto-placeholder allowlist proves replacement is safe.
- Generate a default and mark `auto` only when the URL is actually blank, or when a reviewed legacy auto-placeholder is explicitly identified.
- Preserve explicit `owner` and AI-generated provenance.
- Add disposable PostgreSQL integration tests for custom URL + blank source, blank URL, auto default, owner URL, AI URL, and idempotent re-run.
- Keep the historical migration immutable. Create a new forward-only migration with the Supabase CLI and test it in chronological disposable replay.
- Do not apply it to Production until backup/restore and full release gates pass.

## Tooling constraint and disposition

The current execution container has Node.js but no installed Supabase CLI binary. An `npx --no-install supabase --version` probe did not complete, so no CLI-generated migration was created. Do not bypass the migration workflow by inventing a timestamped migration file.

**Status:** source defect confirmed; Production not affected based on current object inventory; forward migration pending. Production remains **BLOCKED / NOT CERTIFIED**.
