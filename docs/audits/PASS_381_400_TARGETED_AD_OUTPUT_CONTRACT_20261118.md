# Pass 381–400 — Public targeted-ad output boundary regression

Date: 2026-11-18  
Scope: isolated PostgreSQL test coverage only.

## Why
The live `get_mnty_targeted_advertisements` RPC is intentionally callable by `anon` and `authenticated`. Its live definition uses empty search_path, schema-qualified application tables, exposes seven fields, filters active/approved/in-window ads and clamps the limit to 1–50. The prior RC451 test verified search_path and ACL but its fixture returned no rows, so it did not exercise those output rules.

## Change
- Replaced the no-row stub with synthetic tables for regular advertisements, target locations, geography and global advertisements.
- Added synthetic valid and invalid ads for status, approval, start/end time and placement checks.
- Added duplicate geographic target rows to verify one result per ad and best-match ordering.
- Added global approved ads and 51 limit-test rows.
- Expanded integration assertions for exact output columns, ACTIVE/APPROVED/date-valid projection, placement filtering, center-level match priority, deduplication, global fallback and limit clamping (max 50, min 1, default 3).
- Preserved the existing empty search_path, intended anon/authenticated grants and no PUBLIC execute checks.

## Verification
- Exact-head GitHub Actions PostgreSQL workflow: pending at PR creation.
- Test data is synthetic and isolated; no Production data is read or written.
- No Production function body, ACL, migration, RLS, Auth or Edge deployment changed.

**Status:** implementation committed to branch; awaiting exact-head PostgreSQL CI.
