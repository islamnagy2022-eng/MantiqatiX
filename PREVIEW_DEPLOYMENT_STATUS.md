# BizCatalog Manager (6) — Isolated Preview

Status: **R6 CLEAN-BASELINE IMPORT PIPELINE READY — APPLICATION ZIP NOT YET IMPORTED INTO THIS BRANCH — NOT BUILT — NOT DEPLOYED**

Preview branch: `preview/bizcatalog-manager-6-isolated`

## Sole application baseline

The owner-supplied `bizcatalog-manager (6).zip` is the only application source of truth for the new build. Do not merge the RC40 or old catalog UI, routes, components, state stores, or dashboards into it. Older files are reference-only for a separately reviewed capability proven to be missing from R6.

Sanitized package: `bizcatalog-manager-6-preview-clean.zip`
SHA-256: `a87bfc9e80a155277e1f35d8fb29ccff159eba9c31a6f00ffc35eee555e36241`
Compressed size: 13,211,088 bytes.
Archive inventory: 117 files; uncompressed file payload: 15,591,628 bytes.
The archive inventory excludes `.data/`, `.data-preview/`, `.aistudio/`, `.env`, `.env.local`, and `.env.production`.

## Clean baseline policy and import pipeline

The branch importer executes four ordered hardening stages on the extracted R6 source:

1. `scripts/harden_r6_preview.py`: read-only Preview API, security response headers, rate limit, unverified directory labels, Preview notice and server isolation.
2. `scripts/finish_r6_preview_isolation.py`: browser-side financial isolation, Preview wallet handling and service-worker separation.
3. `scripts/finish_r6_preview_core.py`: clear built-in subscriber/demo accounts, disable local password login, force guest-only Preview session, hide test-role controls, and replace both fresh database builders with clean catalogue-only builders.
4. `scripts/finish_r6_preview_cleanups.py`: zero all wallet/grant values, clear sample campaigns/signage/pixel events, disable tracking defaults, clear test telemetry and prevent stale catalogue/directory browser snapshots from being restored.

The fresh database builders now retain only the R6 directory/business records and product catalogue. Records are labeled unverified; owner email/phone/WhatsApp, staff names, owner-subscriber links, subscription/billing metadata, payment configuration, financial balances, credit, commissions and operational KPIs are blank, defaulted or zero. New operational collections start empty: subscribers, sales, ad requests, contact messages, subscription requests, wallets, transactions, campaigns, direct messages, requests, payment intents, media assets, WhatsApp dispatches, security logs and backups.

The pipeline removes the old demo subscriber/customer identities and the embedded local admin password. Preview is public, guest-only and read-only. Only GET `/api/health`, `/api/businesses`, and `/api/products` are allowed; all other API routes and mutations return 503. Payment, billing, WhatsApp, backup and token endpoints remain disabled. Meta Pixel is off, with no embedded third-party ID or test conversion code. Preview local storage uses the separate `mantiqatix_preview::` namespace.

## Authentication and backend boundary

Google OAuth/Supabase Auth are not enabled in the public Preview. A working reusable Google OAuth flow and valid client credentials have not been established from the reviewed sources. Do not invent client IDs or secrets. Integrate Auth only after a secure provider configuration is available and then verify callback handling, session refresh, logout, RBAC and RLS.

Do not point Preview at the existing active production Supabase project or modify its data/schema. A separate Preview backend and reviewed R6-compatible migrations remain required. Keep Android/mobile source separate and untouched. Never copy production secrets, passwords, database dumps or operational data.

## Local source checks

- ZIP SHA-256 and archive inventory verified.
- The four sanitation scripts passed Python syntax validation and completed successfully against a fresh extraction of the sanitized source. Public listing records also have owner/staff identity and subscriber-link metadata removed.
- The final clean pass found no bundled subscriber/demo account markers, password fixtures, fake transaction/message IDs, default Pixel identifiers, test event codes, seeded ad-grant IDs or similar active-source markers.
- 85 TypeScript/TSX files passed syntax transpilation with zero syntax diagnostics.
- **Not verified:** package install, full TypeScript typecheck, unit tests, Vite production build, Docker build, end-to-end auth, Supabase schema/RLS/RBAC, or deployed-origin smoke tests. The local environment previously could not resolve the npm registry and has no Docker installed.

## GitHub import and deployment state

- The isolated branch and guarded importer exist; production `main` remains untouched.
- The importer checks the exact archive checksum, rejects data/secret paths, refuses an overwrite, applies the four hardening stages and commits the extracted app to `apps/bizcatalog-manager-6-preview/`.
- The importer requires the ZIP on a local authenticated Git checkout. It is not a binary upload endpoint.
- The GitHub connection available in this session has no authenticated binary archive upload or Git push operation. The 13.2 MB ZIP therefore remains attached to this conversation and is **not yet committed to this branch**.
- CI intentionally stops until the application directory exists.
- Cloud Run deployment requires an isolated GCP project and GitHub Environment secrets: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, and `GCP_DEPLOYER_SERVICE_ACCOUNT`.
- GitHub Pages cannot run the Express backend.

## Release gates

1. Import the exact ZIP and verify its checksum.
2. Install dependencies from a committed lockfile; run full typecheck and tests.
3. Build the frontend and Docker image.
4. Provision an isolated Preview backend and apply only reviewed R6-compatible migrations.
5. Implement and verify Google OAuth, callback handling, session refresh, logout, RLS, RBAC and tenant isolation.
6. Review the public directory records before describing them as verified.
7. Deploy the Preview service and pass health/smoke checks.
8. Keep production `main` and production Supabase unchanged until a separate explicit production cutover approval.

**No live Preview URL exists. No successful application build or deployment is claimed.**


Persistent execution board: `docs/R6_CONTINUOUS_TODO_AR.md` — current states, P0 blockers, and subsystem TODOs. Update this file whenever a task changes status; never mark a task PASS without evidence.

## Latest verified release audit — 2026-11-10

Arabic release audit committed:
`docs/R6_RELEASE_AUDIT_AR.md`

The audit confirms:
- Raw R6 contains local operational JSON and backup artifacts under `.data/`; do not import these into Git or Preview.
- Raw `server.ts` uses fixed fallback HMAC/JWT secrets and has no central authorization middleware around its API routes. The session-token issuer accepts a caller-supplied role (defaulting to `super_admin`) without server-side credential verification.
- R6 uses local JSON file persistence; no Supabase client or Google OAuth integration was found in the reviewed source.
- The clean package is Preview-only and read-only. This does not certify production authentication, authorization, persistence, or payments.
- Workflow run `42710989197` stopped at the missing application-directory check; dependency install, tests, frontend build, and container build were not run.

Do not mark this release gate complete until the clean archive is imported and CI has passed. Keep production `main` and production Supabase untouched.

## Deployment workflow hardening — 2026-11-10

The Cloud Run Preview workflow is manual-only and now has a mandatory pre-deploy verification job:
- It can run only when dispatched from `preview/bizcatalog-manager-6-isolated`.
- It queries GitHub Actions for a completed successful `R6 Preview Build` whose `head_sha` exactly matches the deployment workflow's `GITHUB_SHA`.
- Deployment depends on that verification job.
- Cloud Run still requires the isolated `r6-preview` environment secrets and does not target production.

This prevents a direct push or manual dispatch from bypassing the build/test gate. No deployment was triggered by this workflow-file change.


## Mobile-friendly source import path

- Codespaces project configuration: `.devcontainer/devcontainer.json`.
- Arabic browser upload/import instructions: `docs/R6_CODESPACES_IMPORT_AR.md`.
- The owner can upload the clean ZIP in the Codespaces Explorer without installing Git/Python locally, then run the repository importer and push only the Preview branch.
- CI now checks out `github.sha`, rather than a moving branch name.
- Cloud Run deployment is manual-only; its verification job requires a successful `R6 Preview Build` run for the exact dispatch SHA, and the deploy job checks out that same SHA.
- The application ZIP remains unimported. No CI success, live URL, or deployment is claimed.
