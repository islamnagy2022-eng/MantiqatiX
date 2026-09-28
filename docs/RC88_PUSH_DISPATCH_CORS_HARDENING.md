# RC88 — Push Dispatcher CORS Hardening

Date: 2026-09-28

## Production change

The production Edge Function `mnty-push-dispatch` was reviewed and hardened.

Before:
- ACTIVE version 1.
- JWT verification disabled by design because the function uses a server-to-server secret.
- CORS allowed `*`.

Change:
- Deployed version 2.
- CORS is now restricted to the MantiqatiX GitHub Pages origin:
  `https://islamnagy2022-eng.github.io`.
- JWT verification remains disabled because the function retains custom authentication using `x-mnty-push-secret`.
- The private secret is checked before subscription lookup or dispatch.
- The function continues to use the service-role client only inside the server-side function.

Production verification:
- Function status: ACTIVE.
- Version: 2.
- SHA256: `3a3cb93a869e11bce2ab12eca2171434e6809cc63babcdf4ff8a5864d2c4aaa9`.
- Source inspection confirmed the restricted origin and custom secret check remain present.

## Evidence classification

- CORS hardening: VERIFIED in production.
- Push subscription RLS: VERIFIED.
- Secret RPC boundary: VERIFIED.
- CI source evidence: existing push sequence has successful runs #414 and #416; this live deployment is not represented as a new GitHub source commit.
- Real browser/device notification delivery: NOT VERIFIED.
- Final production certification: NOT CERTIFIED.

No production data rows were created, modified, or deleted by this hardening change.
