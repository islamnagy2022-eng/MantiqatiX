# BizCatalog Manager (6) — Isolated Preview

Status: **SANITIZED SOURCE PACKAGE PREPARED — NOT YET IMPORTED INTO THIS BRANCH — NOT DEPLOYED**

Preview branch: `preview/bizcatalog-manager-6-isolated`

## Exact source package

Source of truth: the owner-supplied `bizcatalog-manager (6).zip`. This is not RC40 and is not the existing production branch.

Sanitized package: `bizcatalog-manager-6-preview-clean.zip`
SHA-256: `8e407165706aa6b70257420ce77e389f1caaab3a0c2181bf3fc8f9680fc4409a`
117 files; 13,221,402 bytes. Archive inventory verified to exclude `.data/`, `.data-preview/`, `.aistudio/`, `.env.local`, and `.env.production`.

## Changes prepared in the sanitized source

- Server storage uses `.data-preview/` only when `PREVIEW_MODE=true`; it does not read or migrate production `.data/`.
- Preview starts with the source package's activities and product catalogue only; subscriber identity is synthetic; sales, transactions, contact messages, subscriptions, ads requests, wallets, payment intents, backup records, and messages start empty.
- Browser Local Storage keys are namespaced under `mantiqatix_preview::`.
- Browser wallet balances, credit limits, deposit totals and ad grant values are forced to zero, including any earlier values saved under the Preview namespace.
- Browser sales and wallet transaction fixtures are suppressed in Preview mode.
- Activity records are labeled unverified pending separate review; preview does not claim 100% production certification.
- Public Preview API is read-only: only GET `/api/health`, `/api/businesses`, and `/api/products` are allowed. Other API routes and all API mutations return 503.
- Payment, billing, WhatsApp, backup and token endpoints remain disabled.
- A visible Arabic Preview notice states changes stay local to the browser and are not saved to the server.
- Service Worker registration is disabled in Preview mode to avoid cache overlap.
- Docker image serves Vite `dist` through Express and includes a health check.
- Two guarded import hardening scripts are committed on this branch and are run by the importer.

## Checks completed

- Archive SHA-256 calculated and recorded.
- Archive inventory: 117 files, no production database, backup folder, AI Studio artifact folder, or local secret environment file.
- 84 TypeScript/TSX source files passed TypeScript syntax transpilation with zero syntax diagnostics (83 under `src/` plus `server.ts`).
- `bash -n` passed for the import helper.
- Python hardening script syntax validation passed.
- Full npm install, TypeScript typecheck, unit tests, Vite build and Docker build remain **NOT VERIFIED**: the current execution container cannot resolve the npm registry and does not have Docker installed.

## Cloud Run deployment workflow

- Added `.github/workflows/r6-preview-cloud-run.yml` for isolated deployment after source import.
- Added `docs/R6_PREVIEW_CLOUD_RUN_SETUP.md` with the required GitHub Environment secrets and least-privilege setup.
- The workflow uses Workload Identity Federation; it does not store a service-account JSON key.
- The workflow is intentionally gated on the presence of the imported app Dockerfile and required GCP secrets.

## Remaining blockers to a public URL

1. The GitHub connector available in this session can write UTF-8 file/blob content but does not expose a binary archive upload or Git push action. The sanitized 13.2 MB ZIP therefore cannot be committed to the branch by this session's available write actions. The exact archive is attached in this conversation and the branch importer is ready to accept it.
2. After the source files are imported, GitHub Actions must pass install, typecheck, tests, build, Preview isolation checks and Docker build.
3. A separate Node.js/Docker hosting target is required to serve the Express backend. GitHub Pages alone cannot run Express and cannot be represented as a complete application deployment.
4. No Cloud Run, Render, Railway, or other host connection/deployment credentials are configured in the available tools, so a live URL cannot be created from this session yet.

Production `main` and the current live website have not been changed.


## Owner decision — clean R6 baseline (2026-11-09)

The owner has clarified that R6 is to become the sole application baseline, not a patched copy of legacy applications. Older sources may be mined only for individually reviewed missing capabilities (Google OAuth/Supabase Auth, compatible backend contracts, RLS/RBAC, schema migrations, and mobile source kept separately). Do not merge old UI shells or duplicate modules.

All old operational/demo records must be absent from R6: customer/user fixtures, leads, subscriptions, orders, sales, invoices, payments, wallets, balances, messages, support history, analytics counters, and backups. Only explicitly reviewed public directory/catalog seed records may remain, labeled unverified until checked. See [R6 Clean Baseline Decision](docs/R6_CLEAN_BASELINE_DECISION.md).

The existing active Supabase project was discovered, but it contains an established production schema and records. It must not be reset or used as public Preview storage. A clean isolated Preview database must be provisioned from reviewed compatible migrations. Production data deletion or destructive schema changes require a separate explicit approval. Never commit service-role keys, OAuth client secrets, production tokens, database dumps, or password hashes.

Current gates remain unchanged: ZIP not imported to this branch; application build not verified; Cloud Run deployment not completed; no live Preview URL yet.
