# Pass 1460–1469 — R7 archive source-integrity and security review

**Date:** 2026-11-20  
**Reviewed artifact:** uploaded `bizcatalog-manager (11).zip` (270 archive entries; approximately 46.06 MB uncompressed)  
**Companion instruction:** uploaded `الامر-التقني.txt`  
**Disposition:** reference-only source; not production-certified; do not replace current `main` or deploy this archive as-is.

## 1. Source authority and instruction alignment

The companion instruction establishes the operating sequence `DISCOVER → IMPLEMENT → TEST → FIX → VERIFY → INTEGRATE → NEXT TASK`, requires the current repository and live Supabase state to remain authoritative, prohibits localStorage as a trusted permission source, and explicitly treats R6/R7 as reference sources rather than a reason to replace the current site.

The archive's own `RELEASE_MANIFEST_R7.json` declares:
- version `R7-v7.0.0`, build timestamp 2026-11-10;
- architecture `Dual-Engine (Local Authoritative JSON + Supabase PostgreSQL)`;
- `secretsIsolated: true` and `rlsEnabled: true`.

Those claims do not match several inspected source patterns below. The manifest and report status labels are not proof of deployed security or production readiness.

## 2. Confirmed source findings

### P0 — Client-side auth state is treated as authority

Files:
- `src/context/AppContext.tsx` around the Auth Session State and authentication handlers.
- `src/App.tsx` dashboard role-switcher controls.
- `src/data/seedData.ts` default admin and demo account fixtures.

Evidence:
- The client initializes `authSession` by parsing `localStorage`.
- A React effect persists the complete `authSession` object back to `localStorage`.
- `loginAsCustomer`, `loginAsSubscriber`, and `loginAsAdmin` validate against client-side fixture/state and set the local role session immediately.
- The API login request is started asynchronously and its response is not awaited or validated before the UI treats login as successful.
- The dashboard includes direct customer/subscriber/admin role-switcher controls with fixed demo credentials.
- Seed fixtures include a default admin password and multiple fixed subscriber/customer credentials.

Impact: browser storage and client-side checks can be modified by the user. These must never authorize privileged UI/API/DB operations. A successful local state transition is not an authenticated Supabase session.

Required handling:
- Remove demo role-switchers and fixture-password login from production builds; gate any demo mode behind an explicit non-production build flag and synthetic isolated data.
- Use Supabase Auth as the identity authority and server-verified session claims for UI routing.
- Revalidate every privileged server action using verified JWT identity and DB-side authorization; ignore role/business IDs supplied by the browser.
- Do not migrate client-stored roles into trusted server roles.

### P0 — Service-role environment fallback exists in browser client source

File: `src/lib/supabaseClient.ts`.

The client-side key resolver checks `process.env.SUPABASE_SERVICE_ROLE_KEY` before anon-key variables, despite this module being imported by the React application. Vite normally does not expose arbitrary `process.env` variables by default, so this source finding alone does not prove the service key was emitted in a deployed bundle. However, any build-time process-env replacement or polyfill could expose it.

Required handling:
- Delete all service-role references from browser/client modules.
- Browser client may receive only the Supabase anon/publishable key.
- Keep service-role access exclusively in server/Edge secrets and never return it through diagnostics or API responses.
- Add a production bundle scan that fails if service-role key names or configured secret values appear in emitted assets.

### P1 — Hard-coded credential-like AI configuration in frontend seed data

File: `src/data/seedData.ts`, `aiStudioApiKey` field.

The frontend seed data contains a hard-coded API-key-shaped Gemini value. The archive does not establish that this value is a valid live credential; treat it as potentially exposed until confirmed invalid/revoked. Do not reuse it as a production secret.

Required handling:
- Remove API keys from seed data and browser settings.
- Route Gemini requests through a server-side endpoint or Edge Function using a managed secret.
- Rotate/revoke the value if it was ever a real credential.
- Add secret scanning and emitted-bundle checks.

### P0 — Local JSON is explicitly declared authoritative alongside Supabase

Files:
- `RELEASE_MANIFEST_R7.json`
- `.env.example`
- `server.ts` (local `.data/production-live-db.json` read/write path and Supabase pull/push routes).

The manifest explicitly declares Local Authoritative JSON + Supabase PostgreSQL. The server loads and persists a local JSON production DB and provides separate Supabase pull/push synchronization endpoints. This creates competing sources of truth and reconciliation/rollback risks, contrary to the project instruction that Supabase is authoritative for identity, permissions, and production data.

Required handling:
- Do not merge the dual-authority design.
- Preserve only non-authoritative caches/queues where explicitly designed and reconciled.
- Supabase PostgreSQL remains authoritative for business data, membership, financial records, and authorization.
- Any offline/mobile queue must use idempotent server reconciliation and must not store authoritative permissions or balances locally.

### P1 — Release claims are unsupported by the inspected artifact

Files:
- `TODO.md`
- `MANTIQATIX_MASTER_FINAL_REPORT.md`
- `RELEASE_MANIFEST_R7.json`.

The archive marks all 23 release gates and the project status as 100%/VERIFIED while its own manifest declares local JSON authoritative and the inspected client uses local demo credentials/session roles. The archive alone does not contain independently reproducible evidence for live backup restoration, external payment E2E, production authorization, or deployment status.

Required handling:
- Do not import R7's percentage or VERIFIED statuses into canonical TODO.
- Recompute readiness from current-main CI, live Supabase reconciliation, Edge parity, and independently verified backup/restore/payment tests.

## 3. Non-destructive comparison decision

- Keep current canonical repository `main` and live Supabase as the authority.
- Use R7 only for selective UI/features/assets after mapping each item to current source and checking its API/DB contract.
- Preserve Android wrapper assets; do not delete or replace them based on archive comparison.
- Do not bulk-copy `src/`, `server.ts`, `supabase/`, environment files, or release claims from R7.
- No application data, Supabase schema, Auth, grants, RLS, Edge Functions, payments, or live deployment were changed during this review.

## 4. Validation performed and not performed

Performed:
- Opened and read the uploaded operating instruction.
- Enumerated the ZIP and inspected its package metadata, release manifest, TODO, security reports, `src/App.tsx`, `src/context/AppContext.tsx`, `src/lib/supabaseClient.ts`, `src/data/seedData.ts`, `server.ts`, and `.gitignore`.
- Confirmed that `.data/` and `.env*` are ignored by the archive's Git ignore rules, with `.env.example` explicitly retained.

Not performed:
- No dependency installation, Vite production build, emitted-bundle inspection, automated test run, browser E2E, or server execution.
- No validation that the API-key-shaped string is a valid credential.
- No proof that the service-role environment value is currently exposed in an actual deployed bundle.

**Result:** R7 is a feature/reference archive, not an approved production baseline. P0 identity/session and dual-authority design issues must be resolved before any of its backend/auth patterns are adopted.
