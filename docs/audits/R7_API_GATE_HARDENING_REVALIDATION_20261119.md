# R7 API Gate Hardening Revalidation — 2026-11-19

**Source:** isolated working copy from the R7 upload  
**Original archive SHA-256:** `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`  
**Current `server.ts` SHA-256:** `eaa100ba9bf166e404e3318cf271625a0fdb632391a7f53cc3ace9d448f6ae2a`  
**Disposition:** containment only — **R7 BLOCKED / NOT DEPLOYABLE**.

## Implemented in isolated working copy

- Centralized API decision gate runs before all API routes.
- Production: every `/api/*` route returns 503 except GET health; health itself returns 503 BLOCKED_NOT_CERTIFIED.
- All-environment privileged-prefix deny list covers auth, backups, finance, grants, merchant hub, monitoring, production controls/state, readiness, security, settings, stages, Supabase admin/integration, telemetry, wallets and WhatsApp.
- Path normalization handles case, percent encoding and repeated slashes; malformed encodings fail closed.
- Express proxy trust false; rate limits use socket-derived `req.ip`, ignore X-Forwarded-For and bound storage to 10,000 buckets.
- Development server binds to loopback; production binds to 0.0.0.0 while API stays blocked.

## Verification

- Six `npm run test:security` scripts PASS, including API gate behavioral tests for production denial, health exception, privileged prefixes and bypass variants.
- TypeScript/TSX syntax-only transpilation: 95 files, 0 parse errors. Not a full type-check.
- Full npm install, type-check, Vite build, dependency-backed tests, browser E2E, live Paymob and Android Gradle build remain NOT RUN / UNVERIFIED.

## Release boundary

This does not implement Supabase Auth or route-level tenant/branch/platform authorization. Non-privileged API handlers remain untrusted; do not enable the production API release switch. Do not deploy R7 as the live application or apply its SQL/payment/wallet changes. Preserve the canonical catalog deployment separately.

**No Production DB/Auth/RLS/GRANT/Edge/payment/wallet/settlement or deployed catalog change was made.**