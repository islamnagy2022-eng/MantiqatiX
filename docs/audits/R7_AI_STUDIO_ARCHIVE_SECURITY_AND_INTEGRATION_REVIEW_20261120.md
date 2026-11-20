# R7 AI Studio Archive — Source Review and Integration Decision
Date: 2026-11-20
Reviewed artifact: `bizcatalog-manager (11).zip`
Companion directive: `الامر-التقني.txt`

## Decision
**Do not replace the current production catalog or merge this archive as a backend release.** Preserve it as the AI Studio R7 visual/feature reference and selectively port verified UI capabilities only after contract mapping. The archive's self-reported `VERIFIED`, `23/23`, and `99/99` claims are not production evidence for the live MantiqaTix repository or Supabase project.

## What the archive contains
- React 19 / Vite 8 client source under `src/`.
- Express backend entry point `server.ts`.
- Local JSON persistence path `.data/production-live-db.json`.
- Supabase schema file `supabase/migrations/20261110_mantiqatix_master_production_schema.sql`.
- Android WebView wrapper under `android-webview-wrapper/`.
- R7 manifest and several release, security, recovery, TODO and test reports.
- UI components for catalog, merchant/admin dashboards, MantyGo, marketing, CRM, wallet and mobile navigation.

## Confirmed source-level blockers

### P0 — Unauthenticated state and financial mutation surface
The Express app installs JSON parsing and security-header/rate-limit middleware, but the reviewed route sections show no global authentication/authorization middleware. The following handlers mutate or disclose the local production state without a visible per-route authorization check in their handler:
- `GET /api/production-state` returns the full snapshot.
- `POST /api/production-state` replaces/merges the state.
- `POST /api/production/commit-all` commits arbitrary incoming state and writes a backup.
- `POST /api/businesses`, `PUT /api/businesses/:id`, `DELETE /api/businesses/:id`.
- `GET /api/wallets` returns wallets and transaction history.
- `POST /api/wallets/transaction` accepts a client-supplied updated wallet and transaction.
- `POST /api/finance/audited-transaction` accepts caller-supplied actor identifiers/roles and applies a financial mutation.
These routes require server-enforced authentication, role and tenant checks, and server-derived actor identity before any deployment. This is a source review finding; no live server was probed or exploited.

### P0 — Hard-coded fallback secrets
`server.ts` assigns fixed fallback values when environment secrets are absent:
- `PAYMOB_HMAC_SECRET`
- `SESSION_JWT_SECRET`
- `BACKUP_ENCRYPTION_SALT`
A production process must fail closed at startup when required high-entropy secrets are missing. A fixed source-visible fallback is not acceptable for session signing, webhook authentication or backup encryption.

### P1 — Local JSON is presented as authoritative production storage
`server.ts` persists state to `.data/production-live-db.json` and can initialize a fresh database from `INITIAL_BUSINESSES` and other seed collections when the file is absent or unreadable. This conflicts with the approved project rule that Supabase is authoritative and DEMO/seed data must never silently become production state. The local file may be used only as a controlled cache/export or explicitly isolated development fixture, never as the production source of truth.

### P1 — Weak rate-limit trust boundary
The rate limiter trusts the raw `x-forwarded-for` header as its key, stores counters in process memory, and uses one 300/minute threshold. Client-controlled forwarding headers can be spoofed unless a trusted proxy boundary is explicitly configured; in-memory counters do not coordinate across replicas and are lost on restart. Replace with trusted-proxy-aware identity and shared edge/API rate limiting.

### P1 — Dual-engine authority and synchronization ambiguity
The archive describes both local JSON and Supabase as production engines and uses optional Supabase credentials with fallback to anon keys for sync/pull operations. This creates split-brain and privilege ambiguity. Define one authoritative write path (Supabase), use narrowly scoped service-side credentials only on the server, and make offline behavior an explicit outbox/reconciliation protocol.

### P1 — Schema is not a compatible production migration
The archive migration creates a separate simplified schema (e.g. `wallets`, `live_orders`, `financial_audit_logs`) and policies that do not match the current production contract. It must not be applied to the live project or concatenated into the canonical migration chain. In particular, broad `USING (TRUE)` reads and caller-controlled JWT role assumptions need independent review.

### Build/test evidence limitation
The archive claims 99 tests passing, but the ZIP's package manifest does not define a test script and the current review environment had no `node_modules`. Dependency installation timed out, so no fresh build, lint or unit-test execution could be completed. The archive's historical test report is treated as an unverified claim, not a current pass.

### Configuration/documentation inconsistency
The archive's `RELEASE_REPORT.md` lists project ref `moyhiluyhjsujhwlyweuu`, while the verified production project ref is `moyhiluyhjsujhwlyeuu`. Do not copy configuration values from the report without verification. The R7 manifest and architecture text contain the latter correct ref.

## Reconciliation with current platform
The current GitHub production repository remains the source for the published catalog. The R7 ZIP is a separately exported AI Studio app with a different Express/local-JSON backend and simplified Supabase schema. Treat it as a feature/UI reference, not as a replacement source or a deployable backend. Preserve the Android wrapper and visual assets while mapping components to the canonical frontend/backend contracts.

## Safe next steps
1. Keep the existing published site and canonical Supabase schema unchanged.
2. Create a component-by-component UI inventory from R7 and map only missing, useful features to current React components.
3. For any UI port, use existing canonical Edge Function/RPC contracts and add browser tests; do not port Express endpoints.
4. Design a security remediation branch for the R7 backend only if that backend is explicitly selected for a future architecture; require default-deny auth, no fallback secrets, tenant-safe server-derived actors, and Supabase-authoritative persistence.
5. Do not apply the R7 SQL migration to production.
6. Re-run package installation/build/tests in a network-enabled CI environment before making any claims about the archive's build status.

## Review status
Archive inspected; no files from the ZIP were copied into the production repository, no Supabase writes were performed, and no production deployment was triggered.
