# V6 → Primary Catalog Integration Map
**Date:** 2026-11-05  
**Repository:** `islamnagy2022-eng/MantiqaTix`  
**Target branch:** `feat/v6-canonical-integration-phase1-20261105`  
**Status:** Architecture review only; no application replacement or production change.

## Decision

Do **not** replace `apps/catalog-frontend/src/components/DirectoryView.tsx` with the V6 directory component. The existing primary catalog directory already contains production-specific behavior and backend contracts that are not represented by the V6 component. Integration must be additive and component-by-component.

## Verified capabilities already present in the primary catalog

The current `apps/catalog-frontend/src/components/DirectoryView.tsx` imports and uses:

- `DirectoryListingsView` and `fetchPublicDirectoryListingPage` for the public directory-listings contract.
- `ActivityModuleView` for the activity → specialty experience.
- `DEFAULT_FUNCTIONAL_GROUPS` and `resolveCanonicalSpecialty` for canonical taxonomy.
- Egypt governorate/district/shiyakha discovery data and `resolveEgyptAdministrativeLocation`.
- A first-visit location-consent flow; only administrative choices are persisted, while precise GPS coordinates remain in memory.
- A default page size of 20, cursor-based continuation, request-generation guards, and duplicate-safe append behavior.
- Direct URL state for `activity`, `listing`, and `group`.
- Verified/published business filtering before public featured cards are shown.

These are existing behaviors to preserve, not rebuild.

## V6 component review and integration decisions

| V6 source | Dependency / behavior found | Decision |
|---|---|---|
| `src/components/DirectoryView.tsx` | 1,553-line page tied to V6 AppContext, seeded business state, V6 taxonomy and modal state | Do not transplant as a replacement. Extract only isolated UI patterns after adapting them to current types and data contracts. |
| `src/components/common/NonCompetingSponsoredAdsStrip.tsx` | Requires `adRequests`, `subscribers`, V6 ad-selection rules and navigation/modal actions; includes hard-coded regional fallback slides, including sample business IDs and payment claims | Block from production integration until all ad inventory comes from approved persisted records and claims are verified. Do not use its fallback demo slides. |
| `src/components/common/AnimatedProductsMarqueeStrip.tsx` | Consumes V6 product/business structures and presentation callbacks | Candidate for later isolated UI extraction, after data source and empty-state behavior are defined. |
| `src/utils/marqueeProductsGenerator.ts` | Contains hard-coded sample product names, prices, discounts, and image URLs | Do not port generated sample products into the real directory or storefront. |
| `src/components/common/SmartPlatformSearchBar.tsx` | Depends on V6 context/search contracts | Re-evaluate as a visual-only component after checking keyboard, accessibility, and current directory filter semantics. |
| `src/components/common/InteractiveGovernoratesMap.tsx` | V6 location/taxonomy integration | Compare against existing Egypt geo discovery before reuse; avoid a second competing location model. |
| `src/components/admin/AdminQuickActionModal.tsx` | Requires V6-specific modal and context state | Do not import until each action is mapped to an existing authorized backend operation. |

## Backend and security boundary

The primary catalog currently uses the existing Supabase client and Edge Function contracts through `src/lib/production.ts`, including:

- `public-catalog-directory`
- `public-catalog`
- `catalog-admin`
- `catalog-platform-admin`
- `ai-gemini-proxy` (image generation action)

V6 localStorage snapshots, file-backed `/api/production-state`, demo seed records, hard-coded credentials, or direct browser-side payment state must not be connected to production. New frontend behavior must call existing documented contracts and must fail closed when authorization or persistence is unavailable.

## Next vertical-slice sequence

1. **Directory visual shell:** compare V6 layout against the existing directory and port only presentational elements that do not replace filters, pagination, URL state, geolocation consent, or canonical taxonomy.
2. **Search presentation:** adapt the V6 search visual treatment to the existing directory query/filter state; no new search API or duplicate geo state.
3. **Real featured content:** use only existing published/verified business records and approved ad records; no seeded fallback businesses or invented metrics.
4. **Product highlights:** source products from the current public catalog response and enforce the owning business's publication/availability rules; never use `marqueeProductsGenerator.ts`.
5. **Admin shortcuts:** expose only actions already backed by current admin Edge Function contracts and role checks.

Each slice must be a separate reviewable change with focused tests and a production build. Do not enable deployment as part of these integration commits.

## Verification snapshot

For commit `58d564cc99356cd268a270c37c0fa39191063500`:

- Primary Catalog Frontend Validation: all three jobs completed successfully:
  - build
  - professional dashboard employee RBAC PostgreSQL tests
  - professional dashboard browser E2E
- Deploy workflow validation job completed successfully.
- Public-only validation and deployment jobs were **skipped** because this was a pull request event. No deployment occurred.
- V6 source audit and private-data boundary workflows completed successfully for the candidate checks.
- These results do not certify the V6 app build, do not mean V6 has been transplanted into `apps/catalog-frontend`, and do not certify the full platform.

## Release decision

`FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`

No production database, Auth, RLS, grants, Edge Functions, payment configuration, or deployed site was changed by this review.
