# Public Catalog Price Visibility Review — 2026-11-11

## Decision

**Finding: fail-closed enforcement is required before the public catalog can be considered safe.** This review used read-only inspection of the active Supabase project and read-only source inspection. No database rows, schema, Auth settings, RLS policies, grants, payment settings, or Edge Functions were modified in Supabase.

## Evidence from the live data model

A read-only aggregate query joined ACTIVE catalog items to ACTIVE published businesses and ACTIVE provider profiles, and counted only items explicitly marked publicly available.

| Measure | Count |
|---|---:|
| Eligible ACTIVE public catalog items | 47 |
| Items with `catalog_public.show_price = true` | 12 |
| Items with `catalog_public.show_price = false` | 19 |
| Items with no explicit `show_price` permission | 16 |
| Effective ACTIVE price rows linked to items without explicit permission | 16 |
| ACTIVE option rows linked to items without explicit permission | 0 |

The active public projection therefore contains 16 items for which a numeric price exists in the database but public price permission is absent. A follow-up read-only audit also found **2** otherwise eligible items with a non-empty `catalog_public.compare_price` while `show_price` is absent or false. Static source inspection confirmed that both public endpoints were serializing this compare-price metadata independently of the price-row filter. The permission contract in `docs/release/R6_SUPABASE_CONTRACT_BASELINE_20261108.md` and `docs/integration/R6_SUPABASE_FIELD_MAPPING_20261109.md` requires `show_price === true`, not merely `show_price !== false`.

## Code-path finding

- The deployed `public-catalog` function (listed as v7 at inspection) and the source on `main` classified only `show_price === false` as quote-only, so a missing/null/non-boolean value was not denied by that condition.
- The deployed `public-catalog-directory` function (listed as v17 at inspection) used the same false-only exclusion. The current `main` source had already moved this directory path to the stricter `show_price !== true` condition, so deployed/source parity was incomplete.
- Both sources also serialized `compare_price` without requiring `show_price === true`; for services, the storefront `requiresQuote` flag was only set for explicit `false`, not missing/null/non-boolean values.
- The direct `public-catalog` endpoint also returned ACTIVE items with missing/false `is_available` metadata and treated missing availability as available. The contract requires `is_available === true`; the correction now fails closed like `public-catalog-directory`.
- Based on the current query results and these source paths, the endpoints could serialize active numeric price rows for the 16 items without explicit public-price permission. An external HTTP response-level exploit/reproduction was not performed in this review; this is a confirmed source/data-contract exposure path, not a claim that a particular visitor received a price.

## Proposed correction on a review branch

Branch: `fix/public-price-visibility-explicit-opt-in-20261111`

- Added `supabase/functions/_shared/public-price-visibility.mjs` to allow price rows only where the corresponding item has the strict boolean `metadata.catalog_public.show_price === true`.
- Applied the same helper to public directory prices, public storefront prices, and option price deltas. Extended shared helpers so `compare_price` is emitted only with strict opt-in and services without explicit opt-in receive `requiresQuote: true`.
- Made direct `public-catalog` item selection require strict `metadata.catalog_public.is_available === true`, matching the directory endpoint and source contract.
- Extended `scripts/validate-production-catalog-real-state.mjs` with positive and negative fixtures for true, false, missing, null, and string-valued flags, and with assertions that both endpoints use the helper.

## Required release checks

1. The Pull Request validation must pass on the exact head, especially `node scripts/validate-production-catalog-real-state.mjs`.
2. Verify the Edge Function source after deployment matches the approved branch for both `public-catalog-directory` and `public-catalog`.
3. Verify both `public-catalog` and `public-catalog-directory` exclude items with missing/false/non-boolean `is_available`.
4. Run public endpoint smoke tests for:
   - `show_price=true`: numeric price may be returned.
   - `show_price=false`: numeric price and option deltas must be absent.
   - missing, null, and non-boolean `show_price`: numeric price and option deltas must be absent.
5. Verify that `compare_price` is absent for `show_price=false`, missing, null, and non-boolean values, and that services without strict opt-in return `requiresQuote=true`.
6. Do not bulk-edit the 16 production metadata rows to set `show_price=true`. That flag is a public disclosure decision and requires an explicit owner/admin-approved source value.
7. Keep orders, wallet, payment, and settlement writes outside this read-only endpoint correction.

## Boundary

At the time this review was written, the correction existed only on the GitHub review branch. It had not been merged, and no Supabase Edge Function had been deployed from it. Therefore the live runtime must still be treated as potentially exposing prices without explicit consent until the fix is deployed and verified.
