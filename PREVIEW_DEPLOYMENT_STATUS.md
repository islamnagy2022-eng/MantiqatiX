# BizCatalog Manager (6) — Isolated Preview

Status: **SANITIZED PACKAGE PREPARED — SOURCE NOT YET IMPORTED INTO THIS BRANCH — NOT DEPLOYED**

Preview branch: `preview/bizcatalog-manager-6-isolated`

## Exact source package

The preview source is the owner-supplied `bizcatalog-manager (6).zip`, not RC40 and not the existing production branch.

Sanitized archive: `bizcatalog-manager-6-preview-clean.zip`
SHA-256: `a5d765120363747b46432d482f159e9f3dce9e2e809d818b58dd495bcdf0e4d5`
117 source files in the initial sanitized package; excludes `.data/`, `.data-preview/`, `.aistudio/`, and local environment secrets.

## Work prepared

- Isolated storage root `.data-preview/` selected only by `PREVIEW_MODE=true`.
- No production database snapshot or backup import.
- Historical finance, sales, wallets, payment intentions, subscriber identities, messages and contact data are reset in the preview database.
- Browser Local Storage keys are namespaced under `mantiqatix_preview::`.
- Payment, billing, WhatsApp and backup endpoints are disabled.
- Additional hardening script adds a global Preview API allowlist: only GET `/api/health`, `/api/businesses`, and `/api/products` are available. All other API endpoints and all API writes are denied. It also adds no-index/security headers, response no-store, and per-IP rate limiting.
- Preview activity entries are shown as unverified until independently reviewed.
- Unsupported "100% production ready" claims are removed from preview status copy.
- A visible warning banner explains that browser changes are local only.
- Dockerfile serves the built React application through Express and includes a health check.
- GitHub Actions workflow is configured for install, typecheck, unit tests, Vite build, API-isolation checks and Docker build.

## Verification

- Sanitized archive SHA-256 computed and checked.
- No `.data/`, `.data-preview/`, `.aistudio/`, `.env.local`, or `.env.production` entries inside the archive.
- 85 TypeScript/TSX files previously passed syntax transpilation with no syntax diagnostics.
- Full dependency installation, typecheck, unit tests, frontend build and Docker image build are **NOT VERIFIED** in this runtime because the npm registry was unreachable and Docker is not installed here.
- CI checks are ready to execute after the archive source is imported into this branch.

## Remaining blockers

1. The exact 13 MB sanitized application archive cannot be transferred as a binary payload by the connected GitHub file-write actions available in this session. The GitHub connector exposes text/blob content operations but no binary archive upload or repository push operation.
2. The committed importer verifies the archive checksum, rejects unsafe data files, applies the hardening script, and commits the app under `apps/bizcatalog-manager-6-preview/`.
3. A successful GitHub Actions run is required after import.
4. A separate Node.js/Docker hosting target is required to serve the Express API. GitHub Pages alone cannot run the backend and is not a complete deployment.
5. No Cloud Run or other hosting credentials/target have been configured in the available project connections, so a deployment URL cannot yet be issued.

The production `main` branch and live website are unchanged.
