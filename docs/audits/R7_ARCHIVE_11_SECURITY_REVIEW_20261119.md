# R7 archive (11) — security and release admissibility review

**Review date:** 2026-11-19  
**Artifact:** `bizcatalog-manager (11).zip`  
**SHA-256:** `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`  
**Declared release:** R7 v7.0.0, build timestamp 2026-11-10  
**Disposition:** **NOT ADMISSIBLE FOR PRODUCTION DEPLOYMENT OR WHOLESALE MERGE**

Source-only review of the uploaded archive; it was not executed or deployed and Production was not changed. The archive's own `SECURITY_REPORT.md` and `TODO.md` claims of full verification are contradicted by these findings.

## P0 — release blockers

1. **No global API authentication boundary.** The only global Express middleware in `server.ts` (around lines 654–702) adds headers and IP rate limiting; it does not authenticate or authorize callers.
2. **Unauthenticated full-state disclosure and overwrite.** `GET /api/production-state` returns the complete snapshot (around line 1189); `POST /api/production-state` merges arbitrary request JSON into production state (around line 1202); `POST /api/production/commit-all` accepts arbitrary state and records a fixed super-admin actor label (around line 1238).
3. **Unauthenticated privileged Supabase bridge.** `POST /api/supabase/sync` and `POST /api/supabase/pull` (around lines 895 and 1047) lack caller authorization and select `SUPABASE_SERVICE_ROLE_KEY` when configured.
4. **Arbitrary signed-role token issuance.** `POST /api/auth/session-token` (around line 2576) signs caller-supplied `userId`, `role`, and `businessId`, defaulting to `super_admin`, without authenticating the actor. `POST /api/auth/refresh` (around line 3298) mints a token from caller-supplied identity/role when a valid token is absent.
5. **Admin credential bypasses and client-authoritative role.** `POST /api/auth/login` (around line 2995) accepts hard-coded alternatives in addition to a stored password. `loginAsAdmin` in `src/context/AppContext.tsx` (around lines 1198–1215) checks a client-held password, sets local admin role immediately, and sends the server request asynchronously without awaiting/consuming its token. Auth state is persisted in localStorage (around lines 946 and 1042).
6. **Registration/verification bypass.** `POST /api/auth/register` (around line 3149) defaults a password, marks the account verified immediately, returns the verification code, and assigns a nonzero wallet balance. `POST /api/auth/verify-email` (around line 3202) returns success without validating the supplied code.
7. **Predictable fallback secrets.** `server.ts` lines 95–97 contain hard-coded fallbacks for Paymob HMAC, session signing, and backup encryption. Production must fail closed if required secrets are absent.
8. **Unauthenticated wallet and CRUD mutations.** `GET /api/wallets` and `POST /api/wallets/transaction` (around lines 1685–1708) expose wallet data and accept client-supplied wallet/transaction records. Business and subscriber CRUD (around lines 1290–1466), plus orders, billing, backups and other admin routes, also require per-route authorization review.

## Additional release gaps

- `src/context/AppContext.tsx` persists businesses, products, subscribers, settings, orders, sales, requests and auth state in localStorage. This conflicts with the governing rule that Supabase is authoritative for identity, permissions and production data.
- `src/lib/supabaseClient.ts` gives `SUPABASE_SERVICE_ROLE_KEY` precedence in a client-imported module (lines 9–18). No service-role secret may be exposed to a browser build.
- `package.json` defines `lint` as `tsc --noEmit` and has no test script, despite the report claiming 99 passing tests.
- The archive contains only one SQL migration under `supabase/migrations/`, not the current 62-version release chain.
- The manifest claims Android WebView integration, but no `android-webview-wrapper/` directory was present in this archive listing. Preserve the separately maintained Android source; do not infer it is included here.

## Required disposition

- Do **not** deploy or wholesale-merge this archive, its `server.ts`, local JSON database, or auth/payment/wallet endpoints.
- Use UI, visual assets and feature layouts as reference only; port selected improvements into current GitHub `main` while retaining Supabase-backed contracts.
- Rebuild privileged operations around Supabase Auth, server-verified identity, registry-backed platform-admin checks, tenant/business/branch authorization, RLS and narrowly scoped RPC/Edge operations.
- Remove client-supplied role token minting, localStorage authorization, public privileged sync endpoints, hard-coded secret fallbacks, default-paid/default-wallet registration paths and unauthenticated financial mutations.
- Add adversarial tests for anonymous access, tenant isolation, role escalation, wallet tampering, registration verification, replay/idempotency and payment correlation.

**Conclusion:** R7 archive (11) is a UI/feature reference, not a production-ready release candidate. Its self-reported 100%/23-gate status is not supported by the inspected source.
