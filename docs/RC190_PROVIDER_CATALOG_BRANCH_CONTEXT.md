# RC190 — Provider Catalog Branch Context

## Implemented
- Customer catalog price resolution no longer uses the customer's active membership branch.
- Price selection now uses the branch context returned by the provider catalog API.
- This keeps customer-side catalog display and order initiation aligned with the provider business/tenant catalog context.
- No new data model or parallel pricing source was introduced.

## Verification
- Source committed.
- Browser order E2E remains OPEN.
- CI/deployment convergence remains OPEN.
