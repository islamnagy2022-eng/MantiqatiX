# Audit of uploaded BizCatalog Manager V6 archive — 2026-11-08

## Decision

The uploaded file `bizcatalog-manager (6).zip` is adopted as the **new UI/feature reference for the next integration pass**, but it is **not approved for direct publication or production-root replacement**.

- Archive SHA-256: `c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`
- Source inventory: 83 files under `src/`, 48 React components, 12 test files.
- Mobile UI components are present under `src/components/mobile/`; preserve them.
- The archive does not contain the existing native Android/Kotlin application. Keep the Android project in the prior repository/source history; do not delete or replace it.
- This archive is different from the canonical r5 archive already used by the current PR #685 source pack. The two must not be silently treated as identical.

## Confirmed blockers in the uploaded archive

### P0 — must be removed/replaced before any public release

1. **Local JSON is presented as production state.** `server.ts` initializes and persists `.data/production-live-db.json`, and `/api/health` reports `isOfficialProduction: true`. A local JSON file is not the live Supabase database.
2. **Unauthenticated full-state disclosure and overwrite.** `GET /api/production-state` returns the full snapshot and `POST /api/production-state` accepts a replacement payload without server-side authentication/authorization middleware in the route.
3. **Unauthenticated CRUD surface.** The Express app defines 63 `/api/*` handlers. The business, product, subscriber, wallet, ads, subscription, contact and message routes have no visible verified Supabase identity + resource permission guard in the route layer.
4. **Privilege minting.** `POST /api/auth/session-token` accepts `userId` and `role` from the request body and defaults the role to `super_admin`; the route does not first verify an existing trusted identity or authorization decision.
5. **Unauthenticated backup controls.** Backup creation, download and restore handlers are exposed without a visible verified admin guard. The download response contains a full JSON snapshot.
6. **Hard-coded credentials and demo identities.** `seedData.ts` embeds a default admin password and plaintext subscriber credentials; `AppContext.tsx` compares them in the browser. Treat these as demo-only and rotate any real credential that was ever reused.
7. **Predictable secret fallbacks.** `server.ts` falls back to fixed JWT and Paymob HMAC secret strings when environment values are absent; `.env.example` repeats fixed defaults. Startup must fail closed when secrets are missing.
8. **Seeded production claims.** Startup seed normalization marks seeded businesses verified/paid and fabricates wallet/transaction baseline records. These values must never be imported into the live project as real production facts.
9. **LocalStorage is authoritative for sensitive client state.** `AppContext.tsx` persists auth role, subscribers, settings, sales, ads and other state in browser localStorage. Client-held role state cannot authorize server actions.
10. **Hosting mismatch.** This archive's `server.ts` is an Express backend. GitHub Pages only serves static build output; publishing the Vite bundle would not deploy these API routes and would leave the app non-functional or in local/demo mode.

### P1 — required before merging the UI

- Install the archive's exact dependencies from its lockfile in CI; then run `npm run lint`, `npm run build`, and the 12 existing test files under a real test runner. The archive has no `test` script.
- Verify that all mobile routes/components remain present and pass a 390px viewport regression.
- Replace mock/demo persistence with existing Supabase tables, RLS policies and Edge Functions; no new production tables or migrations until the source-schema and migration reconciliation gate passes.
- Keep merchant/admin/wallet/checkout/realtime/backup controls out of the public bundle until backed by server-verified Auth, membership, business scope and authorization.
- Ensure PWA cache/service-worker paths use the real deployed base path and do not cache authenticated or private API responses.

## Mapping to the existing platform

| Uploaded module | Existing platform capability to reuse | Integration rule |
|---|---|---|
| Public directory, medical directory, business profile and catalog | Public catalog frontend + `public-catalog-directory` | Read-only public adapter; only published/verified data |
| Admin and merchant dashboards | Existing Auth, membership, RBAC and per-activity permission contracts | Do not use browser role flags or seeded logins |
| Orders, wallet, Paymob and billing | Existing order/payment/ledger/Paymob Edge Functions and finance contracts | Keep closed until coupled payment/finance E2E and production schema/ACL gates pass |
| MantyGo | Existing MantiGO module and privacy/payment boundaries | Reuse current server-side contracts; no local JSON sync |
| Marketing, commissions and sponsored content | Existing SMM, commission-draft and approved-ad contracts | Public only from approved/active server results |
| Mobile navigation and PWA | Uploaded mobile UI plus existing PWA assets | Preserve mobile UI; separately retain native Android/Kotlin project |
| AI helper/image generation | Server-side AI integration with secret manager | No API key in browser bundle; budget/rate limit and audit server side |

## Immediate implementation sequence

1. Keep PR #685 and its validated r5 public Preview branch as the integration base; do not merge it blindly or replace main.
2. Keep this uploaded archive as an immutable local reference; do not commit `.data/`, backups, `.env`, browser credentials or temporary AI Studio artifacts.
3. Extract and port public visual modules into the isolated V6 public Preview, starting with its home shell, sector discovery, map, product/service strips and mobile layout.
4. Route public content through the existing read-only public Supabase adapter. Publicize only published records with verified ownership, availability, price visibility and approved ad state.
5. Port authenticated dashboards separately after wiring Supabase Auth/membership/RBAC and tenant-bound server operations.
6. Run exact-head build, typecheck, unit, browser E2E, accessibility, bundle-leak, mobile and PWA checks.
7. Only after a successful deployed Preview review, perform the explicitly approved root cutover with a tested rollback. Full finance/payment/backup certification remains a separate release gate.

## Current publication status

- PR #685: OPEN / DRAFT / NOT MERGED.
- Its latest recorded Preview/Pages validation run: workflow validation PASS; `validate_public_only` and `deploy` SKIPPED because the run was triggered from a PR branch.
- Therefore neither that Preview nor this uploaded archive is confirmed live at the public URL.
- Main remains at `46b128f06ce640fe91d993c19a36b85e95ae1ddc`.
- Do not describe the uploaded archive as deployed, production-connected, or fully operational.
- Production schema, Auth/RLS/ACL, payment/finance, six critical Edge Function parity and genuine data/Storage/Auth restore gaps remain release blockers as documented in the existing production rechecks.

## Non-negotiable preservation rule

The mobile UI inside the uploaded archive and the native Android/Kotlin project from prior versions are protected assets. Do not delete them, rename them away, or replace them with a responsive web page. Preserve both and validate them independently.


## 2026-11-08 — Publication status reconciliation after root cutover

The earlier publication-status section above is a historical snapshot and is superseded by the later V6 launch event:

- V6 public application is now the deployed GitHub Pages root after PR [#686](https://github.com/islamnagy2022-eng/MantiqatiX/pull/686); Pages run [42502614593](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/42502614593) completed successfully.
- The previous catalog/workspace is preserved at `/legacy/`, the V6 Preview alias remains at `/v6-preview/`, and deployed-origin tests verified the root, mobile viewport and legacy dashboard/mobile/QR routes.
- **The R6 archive itself was not deployed or substituted for the V6 root.** It remains an immutable UI/feature reference pending module-by-module adoption.
- Keep every P0 finding in this audit active until its relevant server-side replacement is implemented and tested. In particular: no local JSON as production state, no unauthenticated snapshot/CRUD/backup endpoints, no request-supplied role minting, no browser-authoritative permissions, and no fallback secrets.
- Preserve both the R6 mobile UI assets and the separate native Android/Kotlin project. The current web deployment did not replace either.
- Full platform certification remains `BLOCKED / NOT CERTIFIED`; the web-root cutover does not clear Auth/RLS/ACL, production schema/Edge parity, payment/finance, or restore evidence.

