# RC197 — Legacy Order API Usage Audit

## Scope
Reviewed the current repository sources for consumers of `POST /api/v1/orders` and the current marketplace booking implementation.

## Evidence
- `web/app.js` uses the direct `order-create` Edge Function for marketplace booking.
- `web/restaurant-module.js` also uses the direct `order-create` Edge Function.
- Repository search did not return a consumer reference for `/api/v1/orders`.

## Conclusion
No current repository consumer was identified for the legacy `POST /api/v1/orders` creation route.

This does NOT prove that no external client uses the endpoint. Therefore it must not be deleted solely from repository search.

## Safe next action
Treat `/api/v1/orders` as a legacy compatibility endpoint. Keep it available until external-client dependency is ruled out or a deprecation window is completed. The documented primary booking path remains `order-create`.

## Release status
Booking path remains OPEN for production E2E and deployment verification.
