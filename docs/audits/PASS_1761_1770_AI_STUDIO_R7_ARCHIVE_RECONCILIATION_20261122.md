# Pass 1761–1770 — Uploaded AI Studio R7 archive reconciliation

Date: 2026-11-22  
Archive: `bizcatalog-manager (11).zip`  
AI Studio app ID: `e1f944a4-772e-480a-b554-0777f7e9bc47`  
Archive-internal manifest: `R7-v7.0.0`, build timestamp `2026-11-10T19:20:00Z`  
Method: local static inspection of the uploaded archive only. No archive code was executed, deployed or merged.

## Source authority decision

This is a historical AI Studio R7 snapshot, not the current runtime source. Its internal architecture declares **Dual-Engine (Local Authoritative JSON + Supabase PostgreSQL)** and its server writes to `.data/production-live-db.json`. The canonical MantiqatiX repository and live Supabase contracts are newer and must remain authoritative. Do not replace current main with this archive or copy its SQL migration wholesale.

The archive has 233 files and 45 MiB extracted. It contains useful UI/UX, product and mobile reference material, but its release/security claims are not independently substantiated by the archive's own code.

## P0 security and architecture findings in the archive

1. **Client Supabase key selection is unsafe by construction.** `src/lib/supabaseClient.ts:13-16` explicitly considers `process.env.SUPABASE_SERVICE_ROLE_KEY` in a module imported by the browser app. The archive's Vite config does not define this variable, so actual key emission into a production bundle is not proven by this inspection. Nevertheless, a service-role secret must never be referenced by browser code. The client module must use only the public anon/publishable key; privileged access belongs in a server-only module.
2. **Hardcoded production-secret fallbacks.** `server.ts:95-97` falls back to fixed Paymob HMAC, session JWT and backup-encryption secrets when environment values are absent. Production startup must fail closed if required secrets are missing; deterministic fallback secrets are not acceptable.
3. **Local JSON is declared authoritative.** `server.ts:93, 484-506` reads and writes `.data/production-live-db.json`, while the release manifest calls the architecture a dual engine with local JSON authoritative. This contradicts the unified project directive that Supabase is the authoritative identity, authorization and data source. Local JSON may be a disposable cache/export only, never the production source of truth.
4. **Browser-persisted role/session state.** `src/context/AppContext.tsx:945-953, 1041-1043` hydrates and persists the UI `authSession` role in localStorage. This is acceptable only as untrusted presentation state; it must not authorize backend operations. The archive migration policies also rely on JWT role claims and subscriber ownership identifiers; those contracts do not match the current live registry-backed authorization architecture.
5. **Fail-open business defaults.** The archive SQL `20261110_mantiqatix_master_production_schema.sql` sets `is_verified DEFAULT TRUE`, `verification_status DEFAULT 'verified'`, and `payment_status DEFAULT 'paid'`. New business records should not default to verified or paid without authoritative review/payment evidence.
6. **Schema divergence.** Archive uses text IDs, legacy `businesses/products/wallets/live_orders` and subscriber ownership, while current production has canonical UUID/tenant/business contracts and separate order/payment/ledger services. The archive's migration is not safe to apply to the live database.
7. **Unsupported release certification.** `RELEASE_MANIFEST_R7.json` asserts secrets isolated and `MANTIQATIX_IMPLEMENTATION_STATUS.md` marks 13 phases complete, but the inspected client/server/SQL contradict several of those claims. These are historical assertions, not verified launch evidence.

## Safe reuse candidates

- Product/UX references: Marketplace cards, merchant dashboard layouts, location form screenshots, mobile navigation concepts, promotional story strips and business-tool suite.
- Existing Android WebView wrapper files must be preserved as reference only; they are not automatically release-ready.
- Images and design assets can be selectively reused after checking ownership, quality, file size, licensing and consistency with current brand assets.
- Feature logic must be reimplemented against current canonical React/Supabase contracts, not copied with the archive's local JSON/auth/commission assumptions.

## Required remediation if any archive-derived feature is adopted

- Remove all service-role references from browser source and add a bundle scan that fails on privileged-key patterns.
- Require strong, unique production secrets at server startup; reject default/fallback secrets.
- Keep Supabase as the sole authoritative store; any local cache/export must be rebuildable and explicitly non-authoritative.
- Resolve identity and authorization exclusively through Supabase Auth + current membership/tenant/registry contracts; localStorage only controls presentation.
- New businesses must default to pending/unverified; payment status must derive from verified provider events.
- Port one feature at a time with current-main contracts, tests and accessibility/browser verification.

## Disposition

**Archive status: REFERENCE ONLY / NOT RELEASE-READY.**  
No source from this archive was copied into application code. No Production DB, Auth, RLS, GRANT, Storage, Edge, payment, wallet or deployment changes occurred. Production remains **BLOCKED / NOT CERTIFIED**.
