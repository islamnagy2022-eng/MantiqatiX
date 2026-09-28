# RC190 — Admin Return Persistence

## Implemented
- Public homepage now restores the stored administrative return membership from localStorage when the page is refreshed.
- The `لوحة الإدارة` action remains visible for an authenticated customer-preview session after refresh.
- Runtime state is synchronized from the persisted return membership before rendering the homepage header.

## Security
- This does not grant permissions; it only preserves the previously selected membership identifier for the existing switchMembership path.
- Backend authorization remains authoritative.

## Verification
- Source committed.
- Browser deployed E2E and CI/deployment convergence remain OPEN.
