# Pass 1440–1449 — Edge authentication boundaries and anonymous-policy review

**Date:** 2026-11-20  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only Supabase Edge Function source inspection, Security Advisor and PostgreSQL catalog/policy/grant inspection. No Edge function invoked, no application rows selected, no Production mutation.

## 1. Deployed Edge functions with verify_jwt=false

The live project has 42 ACTIVE Edge Functions; 10 have `verify_jwt=false`. Each was inspected:

| Function / version | Boundary observed | Disposition |
|---|---|---|
| `catalog-admin` v20 | Manual bearer validation via `auth.getUser`; rejects missing/anonymous users; service-role backend | Manual auth present; **legacy SUPER_ADMIN membership predicate** for platform-wide scope; added to P0 #867 |
| `directory-listings` v16 | Public GET; POST manually validates bearer via `auth.getUser` and rejects anonymous users | Public read contract is intentional; admin POST uses **legacy SUPER_ADMIN membership predicate**; added to P0 #867 |
| `mantigo-payment-intent` v5 | Manual bearer validation; rejects anonymous; ledger query bound to customer_id = user.id | Authenticated payment-intent boundary present |
| `mnty-push-dispatch` v4 | Requires server-stored `x-mnty-push-secret` before service-role dispatch | Secret-gated internal webhook; no browser JWT expected |
| `paymob-webhook` v10 | Validates provider HMAC-SHA512 over provider payload; constant-time comparison; records idempotent provider events and routes verified payment processing | Public webhook endpoint with signature validation |
| `public-catalog` v8 | GET/OPTIONS only; service-role read; business/branch input validation and explicit public-price filtering | Intentional public read endpoint |
| `health` v3 | Returns static health status/timestamp only | Intentional public health endpoint |
| `public-catalog-directory` v18 | GET/OPTIONS only; service-role read; filters active production tenants and sanitizes public metadata | Intentional public read endpoint |
| `payment-webhook` v3 | HMAC-SHA256 over timestamp + raw body; timestamp window ±300 seconds; constant-time comparison; required event fields | Public signed webhook endpoint |
| `api` v17 | Manual bearer validation via `auth.getUser`; rejects anonymous users; user-scoped `/me` route | Manual authenticated API boundary present |

`verify_jwt=false` is not itself treated as a vulnerability: these endpoints either manually verify the user token, validate a private/provider signature, or are intentionally public read/health endpoints.

## 2. Global platform-root inconsistency in Edge admin routes

- `catalog-admin` v20 defines `isPlatformAdmin(membership)` as SUPER_ADMIN + null business/branch + PLATFORM/full_control. The function manually verifies the user token and rejects anonymous users, but its global-root decision does not query `private.platform_admins`.
- `directory-listings` v16 defines the same legacy `platformAdmin(membership)` predicate. Its POST admin actions manually verify the user token and reject anonymous users, but global directory administration still relies on legacy membership flags.
- These Edge functions are now included in P0 Issue **#867**, together with seven catalog SECURITY DEFINER RPCs using the same legacy global-root membership bypass.

No membership rows were selected; the review does not assert that a non-registry legacy SUPER_ADMIN account currently exists. This is a source-level authorization inconsistency requiring registry-backed correction while preserving manual JWT checks and public GET behavior.

## 3. Supabase Security Advisor and anonymous-policy focused review

Fresh Security Advisor snapshot:
- 9 RLS-enabled tables with no policies.
- 1 anon-callable SECURITY DEFINER function: targeted-ad public discovery RPC, reviewed as an intentional constrained public read.
- 65 authenticated-callable SECURITY DEFINER functions; manual review is complete in Pass 1380–1439.
- 90 `auth_allow_anonymous_sign_ins` warnings.
- 1 `auth_leaked_password_protection` warning: compromised-password protection disabled.

Read-only policy/grant aggregation:
- 495 policies include the `authenticated` role.
- 289 have an explicit anonymous marker in their predicate; 206 do not.
- Focused high-risk table review found no direct `anon` SELECT/INSERT grants on MantiGO rides/bids/financial ledger, medical appointments, digital-page orders, notifications, push subscriptions, user memberships, businesses or tenants.
- Authenticated direct table grants are limited by RLS. MantiGO ride/bid reads are owner/captain scoped plus the weak `is_platform_admin()` RLS bypass tracked in P0 #867. Financial ledger and medical appointment tables have no authenticated SELECT/INSERT grants in the inspected set. Notifications are self-scoped by `user_id=auth.uid()`.
- Several policies without an explicit anonymous marker are intentional public read policies for published/active businesses, digital pages/products/sections, active providers/services, platform brand assets and active Egypt geo areas. Other policies are self-scoped or hard-deny (`false`). Therefore the 90 Advisor warnings require policy-by-policy reconciliation; the raw count alone is not a confirmed 90-table data leak.
- The separate `is_platform_admin()` predicate appears in multiple RLS policies and remains weak in live Production until RC484 is deployed.

P1 Issue **#924** opened to enable leaked-password protection if supported by the current Supabase plan and verify sign-up/password-change/reset behavior. No Auth setting was changed.

## 4. Disposition and next work

- Manual authentication is present on the unverified-JWT admin/payment/API endpoints; public/webhook endpoints have explicit public-read or signature/secret contracts.
- Replace legacy platform membership root checks in `catalog-admin` and `directory-listings` with a trusted registry-backed check under P0 #867.
- Reconcile the 90 anonymous-policy Advisor warnings against exact RLS predicates and effective grants; do not blindly add blanket deny-anonymous policies that break intentional public reads or owner-scoped anonymous flows.
- Enable leaked-password protection if supported; otherwise document the plan limitation and compensating controls (#924).
- Production remains **BLOCKED / NOT CERTIFIED** pending the migration/Edge, backup/restore, Vault, payment/privacy and post-deployment gates.

No Edge function was invoked, no user/membership/patient/payment/customer data rows were selected, and no Production DDL/DML, GRANT, RLS, Auth, Storage, Edge deployment, payment or settlement mutation occurred.
