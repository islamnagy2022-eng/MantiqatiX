# BizCatalog Manager (6) — Isolated Preview

Status: **SANITIZED SOURCE PACKAGE VERIFIED — SOURCE NOT IMPORTED INTO THIS BRANCH — NOT BUILT — NOT DEPLOYED**

Preview branch: `preview/bizcatalog-manager-6-isolated`

## Exact source package

Source of truth: the owner-supplied `bizcatalog-manager (6).zip`. It is the sole R6 application baseline; it is not RC40 and is not the current production branch.

Sanitized package: `bizcatalog-manager-6-preview-clean.zip`
SHA-256: `a87bfc9e80a155277e1f35d8fb29ccff159eba9c31a6f00ffc35eee555e36241`
Compressed size: 13,211,088 bytes.
Archive inventory: 117 files; uncompressed file payload: 15,591,628 bytes.

The archive SHA-256 and inventory were independently rechecked in the working environment on 2026-11-09. The archive inventory excludes `.data/`, `.data-preview/`, `.aistudio/`, `.env`, `.env.local`, and `.env.production`.

## Clean R6 baseline policy

- R6 owns the UI, routes, components, workflows, and product behavior.
- Older sources are references only. Reuse only a specifically audited missing capability after compatibility, security, data impact, and test review.
- Do not merge old application shells, duplicate dashboards, legacy state stores, or unrelated modules.
- Do not import historical operational/demo records: users, subscribers, customers, leads, orders, sales, invoices, payments, wallets, balances, messages, support history, analytics counters, or backups.
- Only explicitly reviewed public directory/catalog seed records may remain, labeled unverified until checked. New operational data starts empty.
- Keep Android/mobile source separate and untouched.
- Do not reset, truncate, or otherwise modify the existing production Supabase project. Preview must use a separately provisioned isolated backend and reviewed compatible migrations.
- Never commit service-role keys, OAuth client secrets, production tokens, database dumps, or password hashes.

## Preview isolation prepared in the sanitized package

- Server storage is isolated under `.data-preview/` only when `PREVIEW_MODE=true`; it must not read or migrate production `.data/`.
- Browser Local Storage keys are namespaced under `mantiqatix_preview::`.
- Subscriber identity is synthetic; sales, transactions, contact messages, subscriptions, ad requests, wallets, payment intents, backup records, and messages start empty.
- Wallet balances, credit limits, deposit totals, and ad grant values are zeroed in Preview.
- Activity records are labeled unverified pending review.
- Public Preview API is read-only: only GET `/api/health`, `/api/businesses`, and `/api/products` are allowed. Other API routes and mutations return 503.
- Payment, billing, WhatsApp, backup, and token endpoints remain disabled.
- Preview notice states that changes remain local to the browser and are not saved to the server.
- Service Worker registration is disabled in Preview to avoid cache overlap.
- Dockerfile serves the Vite build through Express and includes a health check.

## Checks completed

- SHA-256 and ZIP inventory verified.
- 84 TypeScript/TSX files passed syntax transpilation with zero syntax diagnostics.
- Import helper shell syntax and Python hardening scripts passed syntax validation.
- Full dependency installation, TypeScript typecheck, unit tests, Vite production build, and Docker build are **NOT VERIFIED**. The working container could not resolve the npm registry and does not have Docker installed.
- No end-to-end Google OAuth or isolated Supabase Preview verification has been completed.

## Repository and CI state

- The isolated branch exists and contains the guarded importer at `scripts/import-r6-preview.sh`.
- The importer checks the exact SHA-256 above, rejects unsafe data/secret paths, refuses to overwrite an existing R6 destination, applies Preview hardening, and commits the imported app under `apps/bizcatalog-manager-6-preview/`.
- The importer expects the archive file to be available in a local checkout on the isolated branch. It is not an upload endpoint.
- The R6 app directory is not yet present in this branch. CI intentionally stops until the app is imported.
- The GitHub connector available in this session exposes text/blob operations but no binary archive upload or authenticated Git push from the working container. The source ZIP therefore remains attached to the conversation and has not been committed to this branch.

## Cloud Run deployment

- `.github/workflows/r6-preview-cloud-run.yml` is prepared for a separately isolated Cloud Run service using Workload Identity Federation.
- Required GitHub Environment secrets: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, and `GCP_DEPLOYER_SERVICE_ACCOUNT`.
- Optional Environment variables: `GCP_REGION` and `CLOUD_RUN_PREVIEW_SERVICE`.
- No deployment is possible until the app is imported, CI gates pass, and the separate GCP environment is configured.
- GitHub Pages alone cannot run the Express backend.

## Current release gates

1. Import the exact ZIP and verify the checksum.
2. Install dependencies from a committed lockfile; run typecheck and tests.
3. Build the frontend and Docker image.
4. Provision an isolated Preview backend; reconcile and apply only reviewed R6-compatible schema migrations.
5. Verify Google OAuth, callback handling, session refresh, logout, RLS, RBAC, and tenant isolation.
6. Verify operational datasets are empty and directory seed records are explicitly reviewed.
7. Deploy the Preview service and pass deployed-origin health/smoke checks.
8. Keep production `main` and production Supabase unchanged until separate explicit cutover approval.

**No live Preview URL exists yet. No claim of successful application build or deployment is made.**
