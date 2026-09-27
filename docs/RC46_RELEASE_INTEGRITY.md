# RC46 Release Integrity Closure

Date: 2026-09-27

## CI hardening

The GitHub Pages release workflow now requires the tracked source for these production-critical Edge Functions:

- api
- order-create
- order-status-update
- mnty-registration-review
- payment-intent
- settlement-create

The workflow also checks critical implementation markers including the atomic registration-review RPC and backend order/status functions.

## Verification

Current syntax checks:
- web/app.js: OK
- web/home.js: OK
- web/smm.js: OK
- web/android-parity-catalog.js: OK

Workflow invariant scan: PASS.

## Scope

This change only strengthens release-time source integrity. It does not grant database privileges, change RLS, or redeploy financial functions.


## RC48 security evidence

- Public tables with RLS: 112/112.
- Public tables with FORCE RLS: 100/112.
- Direct anonymous privileges on sensitive financial/order tables: none for SELECT/INSERT/UPDATE/DELETE.
- Security Advisor still reports seven RLS-enabled/no-policy informational findings; these were not converted into blanket policies because direct grants are absent and some tables are intentionally server-only.
- Security Advisor still reports leaked-password protection disabled; this requires Supabase Auth configuration and is not represented as completed.
- Cash confirmation RPC intentionally authorizes ADMIN/MANAGER/CASHIER/STAFF/OWNER or PAYMENT_CONFIRM_CASH and excludes CUSTOMER; SUPER_ADMIN is also not included by the authoritative RPC, so the API was not widened independently of the RPC.
- Public website HTTP smoke remains externally pending because the current verification environment returned a cache miss.
