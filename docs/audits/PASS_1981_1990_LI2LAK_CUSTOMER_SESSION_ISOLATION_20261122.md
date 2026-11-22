# Pass 1981–1990 — Li2Lak customer session isolation

**Date:** 2026-11-22  
**Area:** Customer order history and verified-review submission  
**Branch:** `feat/li2lak-verified-business-reviews-rebased-20261122`

## Finding
A customer order-history request could remain in flight while the signed-in user changed or signed out. Although the query already filtered by `customer_id`, an older response could resolve after the new identity rendered and overwrite the new session's component state. The same stale-session risk applied to review-submission notices and draft state.

## Change made
- Added a monotonically increasing request generation to each customer-history load.
- Mirrored the currently rendered `userId` and authenticated state in a ref so stale async work is rejected immediately after an identity render.
- Guarded the order fetch, each five-order review-status batch, error handling and loading-state finalization against stale generations.
- Invalidated in-flight loads during effect cleanup and on identity change.
- Cleared orders, review drafts, submission state, notices and errors when the identity changes or the user signs out.
- Prevented a review submission started in an old identity from writing success/error/loading state into the new identity's UI.
- Extended `scripts/validate-rc497-business-reviews.mjs` with regression assertions for the identity and generation guards.

## Verification
- Re-fetched both committed files from the branch.
- Source-level checks passed for the generation token, render-time identity, three stale-response guards, effect cleanup invalidation, draft reset and review-submit identity guard.
- Validator-source assertions for these guards are present.
- The existing direct `customer_id = userId` query filter remains intact.
- **Not yet verified:** TypeScript build, browser E2E, Node validator execution and PostgreSQL integration. These require the exact-head CI jobs; no pass is claimed before those results.

## Scope and release
- Documentation and source commits only on the Li2Lak PR branch.
- No Production database, Auth, RLS, GRANT, Storage, Edge Function, payment, wallet, customer data or public deployment changes.
- PR remains unmerged. **PRODUCTION BLOCKED / NOT CERTIFIED.**
