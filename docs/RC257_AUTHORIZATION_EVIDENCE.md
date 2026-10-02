# RC257 Authorization Evidence

## Release state
- GitHub Pages workflow run #1303 completed successfully on 2026-10-02.
- Centralized browser RBAC contract is loaded by the main workspace.
- RBAC regression validation is part of the deployment validation job.

## SECURITY DEFINER review
The live production database was checked for SECURITY DEFINER functions and EXECUTE grants.

Expected public surface:
- `get_mnty_targeted_advertisements`: anon EXECUTE = true by design because it serves public advertisement discovery.
- Authenticated EXECUTE = true for the public advertisement discovery function.

Backend-only authenticated functions:
- `admin_create_global_ad`
- `create_job_backend`
- `create_medical_appointment_backend`
- `create_payment_intent_backend`
- `update_medical_appointment_status_backend`

For these backend functions:
- anon EXECUTE = false.
- authenticated EXECUTE = true.
- Source review confirmed caller identity checks and tenant/business membership checks where applicable.
- `create_payment_intent_backend` additionally validates payable order state, tenant binding, customer/finance access, pricing snapshot, amount/currency, and idempotency.
- `create_job_backend` requires the supplied user ID to equal `auth.uid()` and an active allowed business membership.
- `create_medical_appointment_backend` requires `p_user_id = auth.uid()`, an active provider, and an active tenant membership.
- `update_medical_appointment_status_backend` requires `p_user_id = auth.uid()` and an active appointment-tenant membership with provider/owner/admin/manager rules.
- `admin_create_global_ad` requires an active SUPER_ADMIN/ADMIN/OWNER membership.

## Verification script
`scripts/verify-rc257-security-definer-grants.sql` is a read-only contract for repeating the grant check.

## Important limitation
This is authorization-source/grant evidence, not a substitute for adversarial multi-user runtime E2E. The production tenant-isolation E2E remains blocked because there is no independent platform-only identity available for the read-only test.