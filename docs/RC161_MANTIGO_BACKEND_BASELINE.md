# RC161 — MantiGO Backend Workflow Baseline

Implemented production backend contracts for the existing `mantigo_rides` / `mantigo_bids` model:

- create ride
- create captain bid
- customer accepts a bid
- identity must match `auth.uid()`
- ride creation validates route and positive proposed price
- bid creation requires an open ride and positive offer
- bid acceptance locks the ride row and validates ownership/bid relationship
- client roles receive no direct EXECUTE grant on the new backend functions

Web runtime wiring:
- MNTY Trips workspace exposes ride creation.
- Runtime calls the guarded RPC rather than inserting directly for ride creation.

Production verification:
- migration applied successfully
- UI source commits recorded
- browser E2E, captain/customer multi-user E2E, notification/payment completion and CI remain NOT VERIFIED
- no real ride or bid was created during implementation
