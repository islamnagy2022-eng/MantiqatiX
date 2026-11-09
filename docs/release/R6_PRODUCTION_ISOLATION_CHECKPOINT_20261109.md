# R6 Production Isolation Checkpoint — 2026-11-09

**Status:** LOCAL SOURCE HARDENING VERIFIED; APPLICATION SOURCE NOT YET IMPORTED INTO THIS REPOSITORY. This checkpoint is documentation-only and does not approve a deployment or root cutover.

## Source and artifact identity
- User-approved source remains `bizcatalog-manager (6).zip`, original SHA-256: `c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`.
- Latest local hardened package: `MantiqaTix-R6-production-isolation.zip`.
- Package SHA-256: `aafef2a95a5089a35dbb9fecdf2cf786747c0d554e37cfa14e899d1af1080182`.
- ZIP integrity: PASS.
- Private local snapshots, backup directories, `.aistudio`, populated `.env` and `node_modules` remain excluded.
- R6 mobile web UI is retained. Native Android/Kotlin remains a separate preserved source and is not claimed to be part of this archive.

## Production hardening completed in local cleanroom
- Public directory and item mapping uses the approved read-only Supabase directory projection; public verification is derived only from the provider's explicit verification flag.
- Public product mapping requires active/available state and explicit price visibility. Branch price precedes global price. Quote-only services are marked `requiresQuote`, not treated as free purchasable items.
- Production business/product state comes from the public read adapter, not browser localStorage/demo seeds.
- Production subscriber, sales, requests, wallets/ledger, campaigns, inbox/messages, bookings, free-admin grants, signage, pixel events and business-stage state starts empty and is not hydrated/persisted as browser demo data.
- Browser-restored roles/default admin credentials and fallback signing secrets remain removed; production login stays disabled until Supabase Auth plus server-verified ACTIVE membership/RBAC are integrated.
- Production synthetic sales, wallet transactions, campaign creation, bookings, business-stage activation, fake load-test telemetry, local inbox/message persistence, and unbacked activity-registration submission fail closed.
- No public write, finance, payment, wallet, booking or messaging flow is represented as complete without a trusted server adapter.

## Verification evidence
- Existing R6 unit tests: **81/81 PASS** across 13 test files.
- `scripts/verify-r6-security-boundary.mjs`: PASS.
- TypeScript/TSX syntax transpilation: **84 files, 0 syntax errors**. This is a syntax check only, not semantic type-check.
- Full TypeScript check: NOT VERIFIED; dependency/type tree absent (`vite/client` missing).
- Vite build: NOT VERIFIED; Vite package absent in this runtime.
- Browser E2E, accessibility, PWA lifecycle and deployed R6 Preview: NOT VERIFIED.
- No Supabase Production schema/Auth/RLS/GRANT/Edge/payment/finance writes were made.

## Repository and deployment boundary
- This checkpoint records source-only local progress. It does **not** import the R6 source tree into `main`.
- The deployed GitHub Pages root remains V6; `/legacy/` remains retained. No R6 code has been published to the live site in this checkpoint.
- Next required work: import the complete sanitized R6 source tree into a dedicated app directory on a fresh branch, add the exact source-to-Supabase field/API map, install from the lockfile, complete semantic type/build/browser tests, and release through Preview before root cutover.
- `FULL_PLATFORM_GATE = BLOCKED / NOT CERTIFIED`.
