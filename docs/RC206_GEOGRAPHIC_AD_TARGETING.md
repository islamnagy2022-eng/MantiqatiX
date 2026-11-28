# RC206 — Geographic Advertisement Targeting

## Scope
MNTY advertisements support hierarchical targeting by country, governorate, and center. A single advertisement can target multiple geographic areas.

## Delivery precedence
1. Exact center.
2. Governorate.
3. Country-wide.
4. Nearest configured target with coordinates when no higher-priority match exists.

The delivery function deduplicates advertisements that target multiple areas and selects one best match tier before returning results.

## Location privacy
The web homepage reuses the existing on-demand location adapter. It requests browser location only when needed and does not introduce continuous tracking.

## Production implementation
- platform_geo_areas
- advertisement_target_locations
- get_mnty_targeted_advertisements(...)
- HOME_SPONSORED
- HOME_HERO

## Security
- Geographic configuration tables are FORCE RLS.
- Direct anon/authenticated table access is revoked.
- Public advertisement delivery is restricted to the sanitized RPC output.
- Only ACTIVE + APPROVED + date-valid advertisements are eligible.

## Verification status
Implemented in Production and source. Full behavioral verification remains partial because Production currently has no real advertisements and the authoritative Egypt governorate/center master dataset has not yet been loaded. No synthetic Production advertisements were created.


## 2026-11-28 — Read-only Production and catalog integration refresh

- Production `public.platform_geo_areas` currently contains **1 active Egypt country row, 27 active governorates, and 165 active center (Markaz) rows**.
- Read-only sample verification matched `EG1702` to مركز شبين الكوم / المنوفية, `EG1706` to مركز بركة السبع / المنوفية, and `EG1603` to مركز طنطا / الغربية.
- The frontend resolves a center code only when the selected name is an exact `مركز ...` directory entry and the governorate also matches. Other administrative units deliberately fall back to governorate targeting. The seed migration `20261001200000_provider_location_markaz_baseline.sql` still documents that its source must be reconciled against the CAPMAS Administrative Units Directory before treating it as the authoritative national master; this UI does not make that stronger claim.
- Current Production aggregate counts for the public cover placement: **0 normal ad rows, 0 advertisement target-location rows, 0 active approved normal `HOME_HERO` rows, and 0 active approved global `HOME_HERO` rows**. No campaign or target-location row was created.
- Until a real campaign is created and approved, the cover uses the three first-party platform service promos and published business fallback. The platform promo subtitle and WhatsApp request link now reflect the visitor's selected governorate and, where available, center.
- No Production SQL writes, migrations, ad creation, Storage changes, grants, Edge deployment, payment or customer-data mutation were performed. This refresh consisted of read-only aggregate/sample queries and source changes on the frontend/test branch.

## Additional RPC fallback finding — 2026-11-28

A read-only inspection of the Production definition of `public.get_mnty_targeted_advertisements(...)` found that the `raw` CTE includes every active target-location row in Egypt. If a normal `advertisements` row matches neither the selected center, selected governorate, nor country, its `match_rank=5` is returned as `match_level='GLOBAL'`. This can mislabel a center-specific or governorate-specific campaign as Egypt-wide. The actual global table uses IDs prefixed with `GLOBAL-`.

Frontend mitigation in this branch:
- Accept `match_level='GLOBAL'` only when `advertisement_id` begins with the RPC's `GLOBAL-` identity prefix.
- Reject a `GLOBAL-` identity if the RPC reports a non-global match level.
- Keep other verified levels (`CENTER`, `GOVERNORATE`, `COUNTRY`, `NEAREST`) for the corresponding geographic presentation.
- Add a regression test proving a normal region-targeted row mislabeled as global is dropped, while an actual platform-global row remains visible.

This is a **client-side fail-closed mitigation**, not a repair to the Production SQL function. The server function still needs a separate forward migration that filters normal target-location rows to actual center/governorate/country matches or consented-coordinate nearest results before assigning rank. Do not treat this documentation or frontend guard as evidence that the Production function has been repaired. No live ads currently exist in `HOME_HERO`; no SQL write, migration, ad creation, or deployment was performed.
