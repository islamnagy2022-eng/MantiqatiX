# RC217 — Super Admin Platform Control

## Objective
Establish a secure, auditable SUPER_ADMIN context for the authoritative platform administrator so the platform can manage all active tenants without exposing service-role credentials to the browser.

## Implemented
- Uses the existing `private.platform_admins` registry as the authoritative identity source.
- Adds an idempotent ACTIVE `SUPER_ADMIN` membership for each ACTIVE tenant.
- Grants platform-scoped full-control metadata through `user_memberships.permissions`.
- Keeps tenant/business/branch IDs null on the SUPER_ADMIN context; operational scope is platform-wide.
- Does not create identities, passwords, or fake users.
- Does not disable RLS or expose `service_role` to the web client.

## Production verification performed
- Existing `private.platform_admins` contains one authoritative platform-admin identity.
- ACTIVE tenants currently receive one SUPER_ADMIN membership each.
- Test tenant `MNTY-TEST-B` now has a SUPER_ADMIN context.
- A test Business named `منطقتي` was created in `MNTY-TEST-B` through the backend-controlled approval path and approved by the authoritative platform administrator.
- Business activation returned success and the approval request is APPROVED.

## Important remaining work
SUPER_ADMIN membership is now established, but full platform administration must still be verified operation-by-operation through server-side authorization, RLS, Edge Functions, audit logging, and adversarial multi-tenant E2E. This change does not certify Production Ready by itself.
