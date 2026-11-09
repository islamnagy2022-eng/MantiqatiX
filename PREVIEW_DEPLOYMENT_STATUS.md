# BizCatalog Manager (6) — Isolated Preview

Status: **SANITIZED PACKAGE PREPARED — SOURCE NOT YET IMPORTED TO THIS BRANCH — NOT DEPLOYED**

Preview branch:
`preview/bizcatalog-manager-6-isolated`

Canonical input:
`bizcatalog-manager (6).zip` provided by the project owner.

## Work completed against the exact archive

- Audited the 114-file application source and identified the React/Vite frontend plus Express API server.
- Prepared a clean archive excluding `.data/` (including `production-live-db.json` and backups), `.aistudio/`, and local environment files.
- Removed seeded customer/subscriber identities and historical sales, contact messages, subscription requests and ad request records; replaced the customer/provider demo accounts with synthetic Preview identities.
- Removed the embedded Paymob/Gemini sample keys and hard-coded JWT/HMAC fallback secrets.
- Added isolated `.data-preview/` storage selected only by `PREVIEW_MODE=true`.
- Namespaced browser Local Storage under `mantiqatix_preview::` when `VITE_PREVIEW_MODE=true`, preventing shared-origin data crossover with the main site.
- Added synthetic Preview-only customer/provider/admin credentials and disabled Paymob in the UI.
- Disabled payment, billing, WhatsApp, backup and session-token endpoints in Preview mode.
- Added a production static-file serving path for the built Vite frontend and a Dockerfile for a Node/Express runtime.
- Set the seed business metrics and visitor counters to zero rather than presenting fixture values as real results.

Sanitized package SHA-256:
`a87bfc9e80a155277e1f35d8fb29ccff159eba9c31a6f00ffc35eee555e36241`


## Validation performed on the sanitized package

- Parsed 85 TypeScript/TSX files with the TypeScript transpiler: no syntax diagnostics.
- Verified that the archive contains no `.data/` or `.aistudio/` path.
- Verified there are no unscoped Local Storage reads/writes outside the Preview storage wrapper.
- Verified the previously embedded example Paymob/Gemini/JWT secret strings are absent.
- Full dependency installation, typecheck and Vite build remain **NOT VERIFIED**: npm install in the current runtime could not reach the npm registry and the dependency cache was empty. The branch CI workflow is prepared to perform those checks after source import.


### Additional verification from the clean archive

- Confirmed archive SHA-256: `a87bfc9e80a155277e1f35d8fb29ccff159eba9c31a6f00ffc35eee555e36241`.
- Extracted clean archive contains 117 files; no `.data/`, `.data-preview/`, `.aistudio/`, `.env.local`, or `.env.production` entries.
- Transpiled all 85 TypeScript/TSX files using the available TypeScript transpiler: **0 syntax diagnostics**.
- Confirmed there are no direct `localStorage.getItem/setItem/removeItem` calls outside the Preview-aware storage wrapper.
- Confirmed known sample secret strings are absent from non-documentation source.
- Full `npm install`, `tsc --noEmit`, Vite build and Docker image build are still pending: the package registry was unreachable from the execution environment, and the application source has not yet been imported to this GitHub branch.

## Remaining blockers

1. The sanitized binary archive is prepared and checksum-pinned by the import helper, but its source files have not yet been committed under `apps/bizcatalog-manager-6-preview/`.
2. The local runtime has no authenticated binary-upload operation for transferring this 12.6 MiB archive directly into GitHub from this session. The import helper is committed in this branch so the exact sanitized package can be imported without copying old data.
3. After import, the R6 Preview Build workflow must complete successfully.
4. The app requires a Node.js/Express container runtime. GitHub Pages alone cannot run its API server and must not be used as a claim of a complete functional deployment.
5. Public deployment remains blocked until endpoint authorization, preview isolation and runtime behavior are verified.

## Import command

From a clone of this repository, while checked out on the preview branch:

```bash
bash scripts/import-r6-preview.sh /path/to/bizcatalog-manager-6-preview-clean.zip
git push origin preview/bizcatalog-manager-6-isolated
```

The helper rejects archives containing `.data/`, `.aistudio/`, or local production environment files and refuses to overwrite an existing app directory.

The production `main` branch and current live website remain unchanged.
