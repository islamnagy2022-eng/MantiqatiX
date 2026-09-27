# RC41 Production Status

## Scope
MantiqatiX / Mantiqati X production hardening checkpoint.

## Verified
- Web JavaScript syntax checked with V8 compilation for:
  - `web/app.js`
  - `web/home.js`
  - `web/smm.js`
  - `web/android-parity-catalog.js`
- Authenticated Edge Function client added to the web app.
- Order status changes use `order-status-update`; no direct browser update to `orders`.
- Live catalog access uses authenticated `api` Edge Function; browser does not query catalog tables directly.
- `api` production version 6 is ACTIVE with `verify_jwt=true`.
- GitHub `supabase/functions/api/index.ts` exactly matches the deployed production `api` source.
- GitHub `supabase/functions/order-create/index.ts` exactly matches the deployed production `order-create` source.
- GitHub `supabase/functions/order-status-update/index.ts` exactly matches the deployed production `order-status-update` source.
- Public database currently reports 112/112 public tables with RLS enabled and 100/112 with FORCE RLS.
- No production test accounts or fake transaction data were created.

## Current Functional Path
Customer -> authenticated live provider catalog -> server-authoritative order creation -> order status updates through secured Edge Function/RPC.

## Release Gates Still Requiring External Verification
These are not claimed as passed:
- Supabase Auth leaked-password protection must be enabled and rechecked in the Auth configuration UI; the available project API does not expose a safe mutation for this setting.
- Signed Android release/AAB and real physical-device regression.
- Paymob signed production end-to-end traffic with production credentials.
- Backup restore verification.
- Full two-user/two-tenant E2E.
- Production CI/Pages run result for the latest main commit is not exposed by the available GitHub workflow-run connector, so it is not claimed as passed.
- External HTTP smoke test from this execution environment was blocked by DNS and is not claimed as passed.

## Security Note
Supabase Security Advisor currently reports anonymous-policy warnings and seven RLS-without-policy informational findings. These were not mass-modified because the current database privilege/RLS design requires table-by-table authorization review; broad policy deletion or blanket privilege changes would be unsafe.

## Latest Repository Commit
`a218b4f72142ba975c1c4e2d3597d340ecd24603`

## Production API
`api` version 6, ACTIVE, JWT verification enabled.
