# RC186 — Order Scope Counters

## Implemented
- The Orders counter now follows the active role scope.
- CUSTOMER counts own orders by customer_id.
- SERVICE_PROVIDER and BUSINESS_OWNER count orders by active business_id.
- The existing order list already applies the same provider/business versus customer scope.

## Verification
- Source committed in web/app.js.
- No CI workflow run was returned for the commit; CI remains NOT VERIFIED.
- Cross-user/browser E2E remains OPEN.
