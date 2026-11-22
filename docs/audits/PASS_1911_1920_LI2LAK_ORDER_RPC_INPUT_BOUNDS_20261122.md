# Pass 1911–1920 — Li2Lak authoritative order RPC input bounds

Date: 2026-11-22  
PR: [#971](https://github.com/islamnagy2022-eng/MantiqatiX/pull/971)

## Finding

RC498 grants authenticated clients direct EXECUTE on `create_order_backend`. Therefore Edge Function input validation alone is insufficient: a customer can invoke the RPC directly with their own JWT and bypass the Edge layer's body, item-count, quantity and option-count checks. Server-side pricing remains authoritative, but the RPC must independently enforce the input bounds.

## Changes

- Maximum 100 order items at the RPC boundary.
- Integer quantity from 1 through 1,000.
- Item object shape and catalog item token length at most 100.
- `selectedOptionIds` must be an array of at most 20 non-empty string identifiers, each at most 100 characters.
- Idempotency key length 8–200.
- Customer name, phone, address and notes are bounded at the RPC boundary.
- Metadata must be JSON object-shaped when provided.
- Integration suite negative cases cover fractional quantity, 21 selected options and 101 order items through `SET ROLE authenticated`.
- Static validator asserts the SQL bounds and integration test markers.

## Verification boundary

- Updated RC498 migration, integration SQL and validator were retrieved from the active PR branch.
- Static inspection confirms the checks and negative cases are present.
- No local PostgreSQL/container runtime is available in this execution environment; SQL execution is not claimed.
- PostgreSQL 17 order integration and full migration replay remain pending exact-head CI.

## Release safety

No Production database, Auth, RLS, GRANT, Edge Function, Storage, payment, wallet, customer-data or public deployment mutation occurred. Do not merge/deploy until exact-head CI and complete release gates pass.

**PRODUCTION BLOCKED / NOT CERTIFIED.**
