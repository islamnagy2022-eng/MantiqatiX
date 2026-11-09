# BizCatalog Manager (6) — Isolated Preview

Status: **R6 SOURCE PREPARED AND IMPORT AUTOMATION HARDENED — APPLICATION ZIP NOT YET IMPORTED INTO THIS BRANCH — NOT BUILT — NOT DEPLOYED**

Preview branch: `preview/bizcatalog-manager-6-isolated`

## Sole application baseline

The owner-supplied `bizcatalog-manager (6).zip` is the only application source of truth for the new build. Do not merge the RC40 or old catalog UI, routes, components, state stores, or dashboards into it. Older files are reference-only for a separately reviewed capability that is proven to be missing from R6.

Sanitized package: `bizcatalog-manager-6-preview-clean.zip`
SHA-256: `a87bfc9e80a155277e1f35d8fb29ccff159eba9c31a6f00ffc35eee555e36241`
Compressed size: 13,211,088 bytes.
Archive inventory: 117 files; uncompressed file payload: 15,591,628 bytes.
The archive inventory excludes `.data/`, `.data-preview/`, `.aistudio/`, `.env`, `.env.local`, and `.env.production`.

## Data reset and Preview isolation

The import pipeline now runs both:
- `scripts/finish_r6_preview_isolation.py`
- `scripts/finish_r6_preview_cleanups.py`

The final cleanup keeps only the R6 public directory/catalogue seed records (26 activities/businesses plus catalogue products) as unverified display content pending owner review. It removes or starts empty:
- subscribers, demo customer accounts, password fixtures, local admin credentials and authenticated Preview sessions;
- sales, bookings, wallet transactions, grant history, payment intents, subscriptions, messages and support/contact histories;
- wallet balances, pending balances, credit facilities, ad grants and fabricated financial metrics;
- generated campaigns, sample advertising signboards/coupons, fake conversion events and synthetic load-test telemetry;
- prior Preview browser snapshots for the catalogue and directory are ignored at initialization;
- Meta Pixel starts disabled, without a hard-coded third-party Pixel ID or test event code.

Preview API remains read-only. Only GET `/api/health`, `/api/businesses`, and `/api/products` are allowed; all other API routes and mutations return 503. Payment, billing, WhatsApp, backup and token endpoints remain unavailable. The visible notice identifies the environment as Preview.

Authentication is intentionally disabled in this public read-only Preview until a real Supabase/Google OAuth implementation is integrated and verified. Review of the currently available R6 and RC40 frontend sources did not establish a reusable, working Google OAuth flow or production OAuth credentials. Do not invent client IDs or secrets.

Keep Android/mobile source separate and untouched. Do not copy old operational data or production secrets. Do not reset, truncate, or point the Preview at the existing production Supabase project. A separately provisioned isolated Preview backend and reviewed compatible migrations are still required.

## Checks completed locally

- ZIP SHA-256 and archive inventory verified.
- 85 TypeScript/TSX files passed syntax transpilation with zero syntax diagnostics after the final cleanup pass.
- The final cleanup script's invariant checks passed, including empty subscribers/demo accounts, zero wallet seed values, disabled login, unverified directory records, empty sample campaigns/pixel events and no embedded demo credentials.
- Import helper shell syntax and Python syntax checks passed.
- **Not verified:** dependency installation, full TypeScript typecheck, test suite, Vite production build, Docker build, end-to-end auth, RLS/RBAC, Supabase schema parity or deployed-origin smoke tests. The local environment previously failed to reach the npm registry and has no Bun or Docker installed.

## GitHub import and deployment state

- The isolated branch exists and is separate from production `main`.
- The importer now verifies the exact source archive checksum, rejects secret/data paths, refuses overwrites, hardens the Preview API, applies the clean-data pass and commits the extracted source under `apps/bizcatalog-manager-6-preview/`.
- The importer expects the ZIP on a local authenticated Git checkout. It is not a binary upload endpoint.
- The GitHub connector available to this session has no authenticated binary archive upload or Git push operation. Therefore the 13.2 MB ZIP remains attached to the conversation and is **not yet committed** to this branch.
- CI intentionally stops until that application directory exists.
- Cloud Run deployment still requires an isolated GCP project and GitHub Environment secrets: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, and `GCP_DEPLOYER_SERVICE_ACCOUNT`.
- GitHub Pages cannot run the Express backend.

## Release gates

1. Import the exact ZIP and verify its checksum.
2. Install from the committed lockfile; run full typecheck and tests.
3. Build the frontend and Docker image.
4. Provision an isolated Preview backend and apply only reviewed R6-compatible migrations.
5. Implement and verify Google OAuth, callback handling, session refresh, logout, RLS, RBAC and tenant isolation.
6. Validate the empty operational-data baseline and review all directory seed records.
7. Deploy the Preview service and pass health/smoke checks.
8. Keep production `main` and production Supabase unchanged until a separate explicit production-cutover approval.

**No live Preview URL exists. No successful application build or deployment is claimed.**
