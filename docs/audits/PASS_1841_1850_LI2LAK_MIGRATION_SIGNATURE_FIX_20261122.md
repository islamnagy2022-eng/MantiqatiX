# Pass 1841–1850 — Li2Lak migration signature defect repair

Date: 2026-11-22  
PR: [#971](https://github.com/islamnagy2022-eng/MantiqaTix)  
Branch: `feat/li2lak-verified-business-reviews-rebased-20261122`

## Defect

The RC497 migration declared:

- Function: `get_platform_business_review_moderation_queue(integer, integer)`
- COMMENT statement before repair: `COMMENT ON FUNCTION ... (integer)`

PostgreSQL resolves COMMENT ON FUNCTION by exact function identity. The one-argument signature did not identify the declared two-argument function and would cause the migration to fail.

## Repair

- Corrected the COMMENT signature to `(integer, integer)`.
- Added a static validator assertion for the exact two-argument COMMENT signature.
- Re-scanned all six RC497 function definitions/comments and the RC498 18-argument order RPC comment; no further argument-count mismatches were found.

## Verification boundary

This is a source-level correction and static consistency check. A real PostgreSQL 17 migration replay and the full RC497/RC498 integration tests remain required. Existing CI status is not a substitute for exact-head results.

No Production database migration, Auth/RLS/GRANT change, Storage, Edge Function, payment, wallet or customer-data mutation occurred.

**Production status: BLOCKED / NOT CERTIFIED.**
