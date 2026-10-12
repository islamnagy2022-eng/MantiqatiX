# SMM live deny-gate verification (post-deployment only)

This procedure is a runtime release gate for the deferred SMM feature. It is **not** evidence of containment until it is run against the live endpoint after an explicitly approved deployment.

## Preconditions

- A reviewed gateway build with the `MNTY_SMM_ENABLED` fail-closed gate is deployed through the approved release process.
- Deployment metadata is recorded separately: function version, source SHA-256, timestamp, and approver.
- A dedicated ordinary non-admin test user exists. Do not use an administrator token.
- `SUPABASE_ANON_KEY` and the ordinary user's access token are supplied through the shell/CI secret store. Never commit them or print them.
- Coordinate the run with the release owner. The probe is deliberately fail-fast: if the first unauthenticated request does not return the expected deny response, it stops without continuing through the action list.

## Run

```sh
export SMM_GATEWAY_URL="https://YOUR_PROJECT_REF.supabase.co/functions/v1/smm-gateway"
export SUPABASE_ANON_KEY="(supply through a secret manager)"
export SMM_ORDINARY_USER_ACCESS_TOKEN="(supply through a secret manager)"
node scripts/test-smm-live-deny-gate.mjs
```

Do not place real tokens in shell history, issue comments, logs, or repository files. Prefer an ephemeral shell and secret injection from the approved secret manager.

## Required observed result

Every action tested for unauthenticated and ordinary-authenticated requests must return HTTP `503` with JSON error `SMM_POST_LAUNCH_DEFERRED`. Any other status or body fails the run immediately. Save the test log in the controlled release evidence store, not in a public repository if it contains environment details.

## What this probe does not prove

- It does not itself read or hash deployed source. Record function version/hash separately using the authorized management-plane inspection.
- It does not independently inspect database rows or provider telemetry. After the HTTP gate passes, corroborate that order rows, wallet transactions, refunds, and provider calls were not created using approved read-only telemetry or before/after snapshots.
- It does not authorize deployment, enable SMM, modify production data, or replace the full order/wallet/provider idempotency test suite.

**Do not run against an endpoint believed to be enabled.** If the fail-fast probe does not observe the exact deny response, stop and escalate; do not continue testing mutations against production.
