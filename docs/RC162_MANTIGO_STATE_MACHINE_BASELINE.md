# RC162 — MantiGO Trip State Machine Baseline

Implemented and applied a backend-only trip transition contract aligned with the project source workflow:

Request → Validation → Matching/Assignment → Acceptance → Arrival → Start → In Progress → Completed.

Exceptional outcomes supported by the contract include Failed, Show-No, Expired and Cancelled where the actor and previous state permit the transition.

Security:
- authenticated user must equal the supplied actor id;
- customer transitions are limited to customer-owned lifecycle stages;
- driver transitions are limited to the accepted bid captain;
- row locking is used while reading the current trip state;
- direct EXECUTE is revoked from public/anon/authenticated roles.

Production verification:
- function exists in production with the expected signature;
- migration source recorded in GitHub;
- UI wiring for state buttons remains OPEN because repository security validation blocked the attempted app.js patch;
- concurrency, two-user E2E, payment/settlement, notification and physical-device verification remain OPEN.
