# PASS 1861–1870 — Li2Lak public offer price eligibility — 2026-11-23

**Scope:** Marketplace Home public product/service offer eligibility and discount presentation.
**Base:** current `main`; implementation branch `fix/marketplace-public-offer-eligibility-20261123`.
**Production impact:** NONE — frontend source and CI contract only; no Supabase data, migration, Auth/RLS/GRANT, Storage, Edge, payment, wallet or public deployment mutation.

## Finding

Marketplace Home already derives offers from the public catalog and verified active businesses. The shared public catalog mapper enforces explicit `catalog_public.show_price === true` and converts unpriced services to `requiresQuote=true`, with zero display price and no compare price. The existing Marketplace discount predicate relied only on compare price greater than current price. That left the presentation predicate less defensive than the source data contract if malformed or future adapter data ever supplied a compare price on a quote-only or zero-price item.

## Implemented

- Product and service offer lists now require:
  - a verified, eligible business (existing behavior);
  - item availability (existing behavior);
  - `requiresQuote !== true`;
  - finite, strictly positive current price;
  - finite numeric compare price strictly greater than current price.
- Discount badges and crossed-out compare prices use the same defensive eligibility predicate.
- Extended `scripts/validate-production-catalog-real-state.mjs` with source-contract assertions for product offers, service offers and discount badge presentation.
- Existing public catalog mapper and server price permission rules were not changed.

## Validation

- Source inspection confirms all three guards are present.
- Confirmed `.github/workflows/pages.yml` invokes `validate-production-catalog-real-state.mjs`.
- Exact-head CI is pending; no CI pass is claimed until GitHub Actions completes.

## Release boundary

This is a Marketplace frontend integrity hardening change. It does not add new offers, invent discounts, alter catalog data, relax public price consent, introduce GPS targeting, or affect the national directory privacy gate.

**Status:** SOURCE CHANGE READY FOR EXACT-HEAD CI. PRODUCTION remains **BLOCKED / NOT CERTIFIED**.
