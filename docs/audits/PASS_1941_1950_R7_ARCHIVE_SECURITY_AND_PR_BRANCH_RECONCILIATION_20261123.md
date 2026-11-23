# Pass 1941–1950 — R7 archive security and active-branch reconciliation — 2026-11-23

## Source identity and canonical mapping
- [x] 1941 — SHA-256 of uploaded operating directive `الامر-التقني.txt`: `b51078e5aa164067c46347fd327c7230c5968f3cd36df5a354691504a3364ee2`. Inspected full content; current main `docs/MASTER_SOURCE_OF_TRUTH.md` matches the uploaded protocol.
- [x] 1942 — SHA-256 of uploaded `bizcatalog-manager (11).zip`: `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`; archive has 233 files and R7 manifest identifies `R7-v7.0.0`, built 2026-11-10.
- [x] 1943 — Canonical current website is `apps/catalog-frontend/**` on main. R7 archive instead has root `src/**` + `server.ts`; it has no `apps/catalog-frontend` directory and no `.github/workflows`. It is historical reference, not deployable current website source.
- [x] 1944 — R7 archive contains one Supabase migration, 113 Express API route registrations, 15 TypeScript test files, a `bun.lock`, no npm lockfile and no `test` script. `npm run build` could not start because Vite dependencies are not installed; `npm run lint` could not resolve `vite/client`. This is an environment/dependency limitation, not proof of a source compile defect.
- [x] 1945 — R7 `RELEASE_REPORT.md` and status documents claim all release gates/99 tests complete, but the archive itself contains no CI workflows, no executable test script and no `.data` production database. Those claims are not independently substantiated by the artifact.

## Confirmed R7 security/design blockers (archive only; not evidence these routes are deployed)
- [x] 1946 — `server.ts` lines 95–97 contains fixed fallback values for Paymob HMAC, session JWT signing and backup salt. `src/utils/productionEnterpriseEngine.ts` and `src/utils/billingEngine.ts` repeat fixed fallback secrets. Missing secrets therefore do not fail closed.
- [x] 1947 — `POST /api/supabase/sync` and `POST /api/supabase/pull` handlers contain no authentication/authorization guard. The sync handler selects `SUPABASE_SERVICE_ROLE_KEY` when present and performs upserts into businesses, products, wallets and security audit logs. If this archive were deployed with service-role credentials, an unauthenticated caller could trigger privileged writes. Do not deploy or expose these handlers.
- [x] 1948 — `ensureProductionDb()` creates/rewrites `.data/production-live-db.json` from `INITIAL_BUSINESSES` when the local file is absent or unreadable. The archive's documented dual-engine local-authoritative model conflicts with the canonical rule that Supabase owns identity, permissions and data. `.data` is gitignored and absent from the ZIP; first startup can initialize local seed state.
- [x] 1949 — The in-memory rate limiter keys requests directly from `X-Forwarded-For` without an observed trusted-proxy normalization; a caller may spoof the key if the deployment forwards arbitrary client headers. Treat as a secondary hardening issue, not as a verified live exploit.
- [x] 1950 — No R7 code was copied, no server started, no production endpoint called, and no Supabase/Auth/RLS/Storage/Edge/payment data changed.

## Active feature PR source map (current main compared to PR branches)
| PR | Scope | Branch divergence from main | Disposition |
|---|---|---:|---|
| #971 | Li2Lak verified reviews + authenticated order tracking | 283 ahead / 32 behind; 54 changed files | Open, non-mergeable; reconcile/rebase in small units and rerun exact-head PostgreSQL 17 + frontend/E2E checks |
| #978 | One fixed cover + separate 10-image promotional gallery | 18 ahead / 28 behind; 16 changed files | Draft, non-mergeable; backend writer/reader and consent dependencies remain coupled |
| #994 | Route-aware SEO + launch capability tracking + AI support panel | 73 ahead / 15 behind; 17 changed files | Open, non-mergeable; SSR/prerender, AI Edge contract/rate-limit and deployed-origin gates remain open |
- Workflow-run lookup for the three branch refs returned no PR-triggered runs through the available connector; exact-head CI is therefore **unverified**, not assumed passed.
- PR #1012 (Pass 1833–1940 documentation update) was merged successfully as `e3aef2853b3164903165a425050eaabeca77a271`; main was re-read after merge and contains the new audit/manifest entries.

## Next execution order
1. Keep the R7 archive preserved as reference-only; do not deploy it or transplant its local JSON/auth/finance patterns.
2. Continue P0 current-main source review and exact live Edge/database contract reconciliation.
3. Reconcile PR #971, #978 and #994 against current main before any merge; do not merge their diverged heads.
4. Keep Production blocked until the exact migration effects, backup/restore, platform-admin boundary, payment contracts and directory consent release are proven.
5. For R7 build/lint verification, install dependencies only in an isolated disposable workspace from its pinned lockfile using the matching Bun runtime; do not mutate the archive or main.

**Disposition:** R7 = REFERENCE ONLY / NOT SAFE TO DEPLOY. Current Production = BLOCKED / NOT CERTIFIED. No Production changes.
