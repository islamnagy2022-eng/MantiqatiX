# RC87 — Push Dispatch Security Audit

Date: 2026-09-28

## Verified production state

- Production database status: ACTIVE_HEALTHY.
- Public tables: 113.
- Public tables with RLS: 113/113.
- Public tables with FORCE RLS: 100/113.
- Migration history: 166 records.
- Latest production migration: 20260928042554.
- `pg_net` is installed at version 0.20.4.
- `push_subscriptions` has RLS enabled and four owner-bound policies:
  - select own: `user_id = auth.uid()`
  - insert own: `user_id = auth.uid()`
  - update own: `user_id = auth.uid()` in USING and WITH CHECK
  - delete own: `user_id = auth.uid()`
- The `get_mnty_push_secrets()` database function is executable by `service_role` only; anon and authenticated execution are denied.
- Production Edge Function `mnty-push-dispatch` is ACTIVE, version 1, with JWT verification disabled by design for server-to-server dispatch. It requires the private `x-mnty-push-secret` header before reading push subscriptions or sending notifications.
- The dispatcher uses the service-role client server-side and removes subscriptions only for provider responses 404/410.

## Current CI evidence

The push implementation sequence reached a successful GitHub Actions run #416 on commit:

`5eac57b79f0823a89ecb93b1d5f3c1bf9db600bc`

The preceding order-event notification commit also passed run #414.

## Security assessment

The database ownership boundary for browser-managed push subscriptions is explicit and owner-scoped. Secret retrieval is service-role-only.

The dispatcher remains an externally callable endpoint with JWT verification disabled because it is intended for server-side dispatch. Its authorization boundary is the private webhook secret rather than a user JWT.

The current dispatcher source uses wildcard CORS (`Access-Control-Allow-Origin: *`). Because the dispatch endpoint is protected by a private secret and is intended for server-side invocation, this is not treated as evidence of anonymous data access. However, it remains a hardening item: browser-origin access should not be necessary for this endpoint.

## Release classification

- Push database boundary: VERIFIED.
- Push secret execution boundary: VERIFIED.
- Push implementation CI: VERIFIED.
- Real browser/device delivery: NOT VERIFIED.
- Dispatcher CORS hardening: REVIEW.
- Final Production Ready certification: NOT CERTIFIED.

No push subscription, notification, or production identity was fabricated to close this audit.
