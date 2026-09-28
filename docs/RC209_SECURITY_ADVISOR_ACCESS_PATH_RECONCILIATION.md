# RC209 — Security Advisor Access-Path Reconciliation

## Objective
Review the current Supabase Security Advisor findings for RLS-without-policy and SECURITY DEFINER execution against the actual MNTY access model, without adding broad policies or revoking intentional public delivery RPCs merely to silence an advisor.

## Live verification — 2026-09-29

### Backend-only tables
The following tables have RLS enabled and currently have no policies:
- private.platform_admins
- public.erp_purchase_orders
- public.erp_purchase_receipts
- public.erp_stock_transfers
- public.smm_admins
- public.smm_provider_credentials
- public.smm_providers

For these seven tables:
- direct table grants to anon/authenticated: NONE
- owner: postgres
- user-facing mutation/read paths are implemented through backend SECURITY DEFINER functions or trusted server-side paths
- no broad client policy was added

### Additional backend-only / delivery tables flagged by Advisor
The current Advisor also reports no-policy findings for:
- public.advertisement_target_locations
- public.platform_geo_areas
- public.platform_global_advertisements

These are intentionally protected behind RLS and sanitized delivery/admin RPCs. Direct anon/authenticated table grants remain revoked for the geographic targeting tables.

### SECURITY DEFINER review
The current Advisor flags several callable SECURITY DEFINER functions. The reviewed model distinguishes:
1. Public read-only delivery functions whose output is intentionally sanitized:
   - get_mnty_targeted_advertisements
   - find_mnty_nearby_provider_businesses
2. Authenticated admin/backend functions that perform their own authorization checks:
   - admin_create_global_ad
   - create_job_backend
   - create_medical_appointment_backend
   - create_payment_intent_backend
   - update_medical_appointment_status_backend
3. Backend-only functions with client EXECUTE revoked:
   - create_purchase_order_backend
   - create_stock_transfer_backend
   - receive_purchase_stock_backend
   - receive_stock_transfer_backend
   - update_purchase_order_status_backend
   - update_stock_transfer_status_backend
   - smm_get_provider_secret
   - smm_set_provider_secret

For the backend-only functions, live privilege checks confirmed anon/authenticated EXECUTE = false.

## Security conclusion
The RLS-without-policy findings reviewed here are fail-closed access paths, not evidence that these tables are publicly readable/writable. Supabase documents that grants and RLS are separate controls; a missing grant blocks access before policy evaluation. Therefore, adding permissive policies solely to remove the Advisor finding would weaken the intended boundary.

The remaining Advisor warnings require workflow-specific review and are not automatically defects. In particular, public ad/provider discovery RPCs are intentionally exposed as sanitized read surfaces, while admin/backend RPCs must remain authorization-checked.

## Remaining P0
- Enable Supabase leaked-password protection from the Auth security configuration; this cannot be safely completed through the database layer alone.
- Re-run Security Advisor after the Auth setting change.
- Complete E2E authorization tests for every user-facing SECURITY DEFINER workflow.
- Keep production Go-Live gate OPEN until the remaining P0 evidence exists.

## Evidence
- Supabase Security Advisor live scan on 2026-09-29.
- Live pg_class/pg_policies check for the seven core backend-only tables.
- Live information_schema.role_table_grants check: no anon/authenticated table grants for those seven tables.
- Live function privilege check: backend-only SECURITY DEFINER functions are not executable by anon/authenticated.

## Status
IMPLEMENTED / VERIFIED for the reviewed access-path reconciliation.
NOT CLOSED for overall Security Advisor because leaked-password protection and user-facing E2E evidence remain open.
