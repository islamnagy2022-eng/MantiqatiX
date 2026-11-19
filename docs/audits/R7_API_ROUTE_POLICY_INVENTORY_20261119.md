# R7 API Route Policy Inventory — 2026-11-19

**Archive SHA-256:** `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`  
**`server.ts` SHA-256:** `daf019af9dd5ba9e875b8891ff5ac1e599b98d5fe22e3da49bb5abebc8b2ee78`  
**Disposition:** source-only proposed classification; R7 remains **BLOCKED / NOT DEPLOYABLE**.

## Evidence and limits

- 113 distinct `/api/*` route declarations: 40 GET and 73 mutating (55 POST, 11 PUT, 7 DELETE).
- Earlier static scan found 54 of the 73 mutating handlers without recognizable route-local session/authorization. This is a screening signal, not proof of exploitation.
- The policy column is a proposed required boundary, not proof that the current handler enforces it. Runtime enforcement is **NOT PROVEN** for every route.
- Policies for business/customer/branch workflows are provisional pending exact ownership and response-field review. Every route remains blocked from R7 release.

## Policy counts

| Policy | Routes |
|---|---:|
| `AUTHENTICATED_USER` | 16 |
| `BUSINESS_BRANCH_SCOPED` | 30 |
| `DISABLED` | 11 |
| `PLATFORM_ADMIN` | 30 |
| `PUBLIC_INGRESS` | 11 |
| `SERVICE_TO_SERVICE` | 5 |
| `TENANT_MEMBER` | 10 |

## Complete route inventory

| Line | Method | Route | Required policy |
|---:|---|---|---|
| 704 | `GET` | `/api/health` | `PUBLIC_INGRESS` |
| 719 | `GET` | `/api/supabase/status` | `PLATFORM_ADMIN` |
| 791 | `GET` | `/api/supabase/schema-mapping` | `PLATFORM_ADMIN` |
| 884 | `GET` | `/api/supabase/schema` | `PLATFORM_ADMIN` |
| 895 | `POST` | `/api/supabase/sync` | `SERVICE_TO_SERVICE` |
| 1047 | `POST` | `/api/supabase/pull` | `SERVICE_TO_SERVICE` |
| 1189 | `GET` | `/api/production-state` | `DISABLED` |
| 1202 | `POST` | `/api/production-state` | `DISABLED` |
| 1238 | `POST` | `/api/production/commit-all` | `DISABLED` |
| 1290 | `GET` | `/api/businesses` | `PUBLIC_INGRESS` |
| 1318 | `POST` | `/api/businesses` | `TENANT_MEMBER` |
| 1336 | `PUT` | `/api/businesses/:id` | `TENANT_MEMBER` |
| 1356 | `DELETE` | `/api/businesses/:id` | `TENANT_MEMBER` |
| 1367 | `GET` | `/api/products` | `BUSINESS_BRANCH_SCOPED` |
| 1397 | `POST` | `/api/products` | `BUSINESS_BRANCH_SCOPED` |
| 1412 | `PUT` | `/api/products/:id` | `BUSINESS_BRANCH_SCOPED` |
| 1430 | `DELETE` | `/api/products/:id` | `BUSINESS_BRANCH_SCOPED` |
| 1440 | `GET` | `/api/subscribers` | `BUSINESS_BRANCH_SCOPED` |
| 1445 | `POST` | `/api/subscribers` | `BUSINESS_BRANCH_SCOPED` |
| 1457 | `PUT` | `/api/subscribers/:id` | `BUSINESS_BRANCH_SCOPED` |
| 1466 | `DELETE` | `/api/subscribers/:id` | `BUSINESS_BRANCH_SCOPED` |
| 1476 | `GET` | `/api/sales` | `BUSINESS_BRANCH_SCOPED` |
| 1481 | `POST` | `/api/sales` | `BUSINESS_BRANCH_SCOPED` |
| 1499 | `GET` | `/api/orders` | `BUSINESS_BRANCH_SCOPED` |
| 1516 | `POST` | `/api/orders` | `AUTHENTICATED_USER` |
| 1621 | `PUT` | `/api/orders/:id/status` | `BUSINESS_BRANCH_SCOPED` |
| 1643 | `GET` | `/api/readiness` | `PLATFORM_ADMIN` |
| 1657 | `GET` | `/api/mantygo` | `AUTHENTICATED_USER` |
| 1667 | `POST` | `/api/mantygo/sync` | `SERVICE_TO_SERVICE` |
| 1685 | `GET` | `/api/wallets` | `DISABLED` |
| 1694 | `POST` | `/api/wallets/transaction` | `DISABLED` |
| 1709 | `GET` | `/api/ads` | `BUSINESS_BRANCH_SCOPED` |
| 1714 | `POST` | `/api/ads` | `BUSINESS_BRANCH_SCOPED` |
| 1728 | `PUT` | `/api/ads/:id` | `BUSINESS_BRANCH_SCOPED` |
| 1737 | `DELETE` | `/api/ads/:id` | `BUSINESS_BRANCH_SCOPED` |
| 1747 | `GET` | `/api/subscriptions` | `BUSINESS_BRANCH_SCOPED` |
| 1752 | `POST` | `/api/subscriptions` | `BUSINESS_BRANCH_SCOPED` |
| 1768 | `PUT` | `/api/subscriptions/:id` | `BUSINESS_BRANCH_SCOPED` |
| 1789 | `GET` | `/api/contact` | `PLATFORM_ADMIN` |
| 1794 | `POST` | `/api/contact` | `PUBLIC_INGRESS` |
| 1807 | `PUT` | `/api/contact/:id` | `PLATFORM_ADMIN` |
| 1816 | `DELETE` | `/api/contact/:id` | `PLATFORM_ADMIN` |
| 1826 | `GET` | `/api/messages` | `PLATFORM_ADMIN` |
| 1831 | `POST` | `/api/messages` | `PUBLIC_INGRESS` |
| 1843 | `PUT` | `/api/messages/:id` | `PLATFORM_ADMIN` |
| 1852 | `DELETE` | `/api/messages/:id` | `PLATFORM_ADMIN` |
| 1862 | `POST` | `/api/generate-image` | `TENANT_MEMBER` |
| 1920 | `GET` | `/api/notifications` | `AUTHENTICATED_USER` |
| 1924 | `POST` | `/api/notifications` | `AUTHENTICATED_USER` |
| 1941 | `POST` | `/api/ai-studio-assist` | `TENANT_MEMBER` |
| 1978 | `POST` | `/api/ai-autopilot/execute` | `TENANT_MEMBER` |
| 2035 | `GET` | `/api/payments/history` | `AUTHENTICATED_USER` |
| 2061 | `POST` | `/api/payments/paymob/intention` | `AUTHENTICATED_USER` |
| 2136 | `POST` | `/api/payments/paymob/webhook` | `SERVICE_TO_SERVICE` |
| 2218 | `GET` | `/api/billing/status` | `AUTHENTICATED_USER` |
| 2249 | `POST` | `/api/billing/run-sweep` | `SERVICE_TO_SERVICE` |
| 2296 | `POST` | `/api/billing/toggle-autorenew` | `AUTHENTICATED_USER` |
| 2317 | `POST` | `/api/billing/pay-subscription` | `AUTHENTICATED_USER` |
| 2394 | `GET` | `/api/realtime/stream` | `AUTHENTICATED_USER` |
| 2419 | `GET` | `/api/uploads` | `AUTHENTICATED_USER` |
| 2427 | `POST` | `/api/uploads` | `AUTHENTICATED_USER` |
| 2490 | `GET` | `/api/whatsapp/logs` | `PLATFORM_ADMIN` |
| 2501 | `POST` | `/api/whatsapp/dispatch` | `PLATFORM_ADMIN` |
| 2576 | `POST` | `/api/auth/session-token` | `DISABLED` |
| 2612 | `POST` | `/api/auth/verify-token` | `AUTHENTICATED_USER` |
| 2621 | `GET` | `/api/security/audit-logs` | `PLATFORM_ADMIN` |
| 2629 | `POST` | `/api/security/run-scan` | `PLATFORM_ADMIN` |
| 2666 | `GET` | `/api/backups` | `PLATFORM_ADMIN` |
| 2674 | `POST` | `/api/backups/create` | `PLATFORM_ADMIN` |
| 2725 | `GET` | `/api/backups/:id/download` | `PLATFORM_ADMIN` |
| 2759 | `POST` | `/api/backups/restore` | `PLATFORM_ADMIN` |
| 2833 | `POST` | `/api/backups/import` | `PLATFORM_ADMIN` |
| 2908 | `GET` | `/api/production/phases-status` | `PLATFORM_ADMIN` |
| 2930 | `GET` | `/api/customers` | `TENANT_MEMBER` |
| 2939 | `POST` | `/api/customers` | `AUTHENTICATED_USER` |
| 2974 | `PUT` | `/api/customers/:id` | `TENANT_MEMBER` |
| 2995 | `POST` | `/api/auth/login` | `PUBLIC_INGRESS` |
| 3149 | `POST` | `/api/auth/register` | `PUBLIC_INGRESS` |
| 3202 | `POST` | `/api/auth/verify-email` | `PUBLIC_INGRESS` |
| 3227 | `POST` | `/api/auth/recover` | `PUBLIC_INGRESS` |
| 3298 | `POST` | `/api/auth/refresh` | `PUBLIC_INGRESS` |
| 3335 | `POST` | `/api/auth/logout` | `AUTHENTICATED_USER` |
| 3357 | `GET` | `/api/settings` | `PLATFORM_ADMIN` |
| 3365 | `PUT` | `/api/settings` | `PLATFORM_ADMIN` |
| 3380 | `GET` | `/api/campaigns` | `BUSINESS_BRANCH_SCOPED` |
| 3388 | `POST` | `/api/campaigns` | `BUSINESS_BRANCH_SCOPED` |
| 3407 | `GET` | `/api/signage` | `BUSINESS_BRANCH_SCOPED` |
| 3415 | `POST` | `/api/signage` | `BUSINESS_BRANCH_SCOPED` |
| 3432 | `DELETE` | `/api/signage/:id` | `BUSINESS_BRANCH_SCOPED` |
| 3445 | `GET` | `/api/bookings` | `BUSINESS_BRANCH_SCOPED` |
| 3453 | `POST` | `/api/bookings` | `AUTHENTICATED_USER` |
| 3472 | `GET` | `/api/stages` | `PLATFORM_ADMIN` |
| 3480 | `POST` | `/api/stages` | `PLATFORM_ADMIN` |
| 3503 | `GET` | `/api/grants` | `PLATFORM_ADMIN` |
| 3511 | `POST` | `/api/grants` | `PLATFORM_ADMIN` |
| 3529 | `GET` | `/api/merchant-hub` | `BUSINESS_BRANCH_SCOPED` |
| 3545 | `POST` | `/api/merchant-hub/ledger` | `DISABLED` |
| 3562 | `POST` | `/api/merchant-hub/loyalty` | `BUSINESS_BRANCH_SCOPED` |
| 3586 | `GET` | `/api/telemetry-config` | `PLATFORM_ADMIN` |
| 3596 | `PUT` | `/api/telemetry-config` | `PLATFORM_ADMIN` |
| 3619 | `POST` | `/api/meta-pixel/events` | `PUBLIC_INGRESS` |
| 3637 | `POST` | `/api/ai/complete-missing-images` | `TENANT_MEMBER` |
| 3679 | `POST` | `/api/ai/generate-entity-image` | `TENANT_MEMBER` |
| 3749 | `POST` | `/api/security/evaluate-rls` | `DISABLED` |
| 3792 | `POST` | `/api/finance/audited-transaction` | `DISABLED` |
| 3847 | `GET` | `/api/crm/funnel` | `BUSINESS_BRANCH_SCOPED` |
| 3864 | `POST` | `/api/crm/leads` | `PUBLIC_INGRESS` |
| 3888 | `POST` | `/api/data/import-csv` | `BUSINESS_BRANCH_SCOPED` |
| 3951 | `POST` | `/api/production/backups/verify-restore` | `DISABLED` |
| 3972 | `POST` | `/api/production/rollback` | `DISABLED` |
| 4014 | `GET` | `/api/data/export-csv` | `BUSINESS_BRANCH_SCOPED` |
| 4041 | `GET` | `/api/monitoring/metrics` | `PLATFORM_ADMIN` |
| 4069 | `GET` | `/api/production/master-gate` | `PLATFORM_ADMIN` |

## Implementation contract

1. Verify bearer/session tokens through Supabase Auth `getUser`; derive actor identity only from the verified session.
2. Resolve active memberships and tenant/business/branch scope from server-side database state. Never trust caller-supplied roles, actor IDs, tenant IDs, business IDs, branch IDs, or localStorage.
3. Require the protected `private.platform_admins` registry for platform-wide operations. Tenant OWNER/BUSINESS_OWNER/ADMIN and finance roles do not imply platform authority.
4. Public ingress and service-to-service routes need explicit request schemas, narrow outputs, rate/abuse controls, replay/idempotency protection, and provider signature verification where applicable.
5. `DISABLED` routes must return a hard denial/404/410 until replaced by reviewed backend contracts. Do not keep them as convenience write endpoints.
6. Every mutation must enforce tenant/branch scope in the database and record an atomic audit event. Keep finance/wallet mutation disabled until ledger and settlement invariants pass.
7. Add negative tests for anonymous callers, forged role/actor, cross-tenant and cross-branch IDs, inactive membership, non-registry platform admins, replay, and audit rollback.

## Verification boundary

This inventory was generated from the exact frozen archive route declarations plus prior static-review evidence. It is not a penetration test, runtime proof, RLS/ACL audit, or confirmation that the proposed policy is implemented. No R7 source or Production resource was changed.