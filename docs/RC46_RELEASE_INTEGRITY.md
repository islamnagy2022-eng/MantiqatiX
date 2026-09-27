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
