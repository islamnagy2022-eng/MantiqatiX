# RC188 — Admin → Customer Homepage Switch

## Final behavior
- When an active ADMIN, SUPER_ADMIN, OWNER, or MANAGER membership switches to an active CUSTOMER membership, the authenticated session remains intact while the UI opens the public MNTY homepage.
- The public homepage is the same marketplace landing experience used by customers, not the internal administrative/customer dashboard.
- The previous administrative membership is stored as a return target.
- The public homepage exposes a `لوحة الإدارة` action when that return target exists.
- Returning to the stored administrative membership restores the administrative workspace through the normal membership switch path.
- Added a safe fallback to the legacy landing view if the public homepage module has not loaded.

## Security boundary
This is a UI/membership-context change only. It does not grant CUSTOMER permissions to an ADMIN membership or bypass backend authorization. Backend/RLS permissions remain authoritative.

## Verification status
- Source committed.
- Browser E2E is still required to verify the visual transition and return path on the deployed site.
- CI/deployment convergence is not claimed until a workflow/deployment result exists.
