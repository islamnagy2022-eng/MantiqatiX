# RC196 — Order Path Convergence Review

## Finding
The repository currently contains two order-creation paths:

1. `supabase/functions/order-create/index.ts` — current marketplace booking path. It validates the authenticated user, resolves the target business, derives/validates tenant context, reads active catalog/pricing/options, calculates authoritative totals, then calls `create_order_backend`.
2. `supabase/functions/api/index.ts` `POST /api/v1/orders` — legacy API path. It validates business/tenant/provider/customer authorization but passes zero subtotal/tax/total to `create_order_backend` and relies on the backend RPC for final authority.

## Security assessment
No evidence was found that the legacy path directly bypasses the backend authority. However, two materially different contracts increase regression and operational risk.

## Release decision
Do not use the legacy `POST /api/v1/orders` route as the primary booking path. The production booking contract is `order-create` until a dedicated convergence change is implemented and verified.

## Required follow-up
- Trace all web/app callers of `/api/v1/orders`.
- If unused, deprecate/remove the legacy route only after impact analysis.
- If still used by a supported client, align it with the same catalog/pricing contract before release.
- Verify the authoritative `create_order_backend` contract in production before E2E.

## Current state
OPEN — no destructive removal performed.
