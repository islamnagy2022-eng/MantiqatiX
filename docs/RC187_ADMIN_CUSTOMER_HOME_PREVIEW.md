# RC187 — Admin Customer Homepage Preview

## Implemented
- When an ADMIN/OWNER/SUPER_ADMIN/MANAGER switches to an active CUSTOMER membership, the UI opens the same MNTY public homepage used by customers instead of the internal workspace.
- The selected role remains CUSTOMER for the preview session; no backend permissions are elevated or changed.
- A temporary local return marker is stored so the privileged operator can return to the previous administrative membership.
- The public homepage shows `لوحة الإدارة` only when that temporary admin-preview marker exists; ordinary customers do not receive the control.
- Returning to the previous membership clears the temporary marker.

## Verification
- Source commits created for app.js and home.js.
- Browser E2E is NOT VERIFIED.
- CI is NOT VERIFIED for these commits until a workflow run is returned.
