# AI Studio V6 candidate — source and production boundary review
**Review date:** 2026-11-05  
**Candidate authority stated by supplied documents:** `bizcatalog-manager (5).zip`  
**Archive SHA-256 stated in the supplied baseline report:** `ff5dae607ea876888068c7b66131bf12a1f1be0fd8a749f7690d311ce9cfe965`

## Executive finding

The supplied files describe a **separate root-level React 19 / TypeScript / Vite 8 candidate**, not the currently deployed GitHub Pages application. The current repository's Pages workflow builds `apps/catalog-frontend`. The candidate ZIP itself was not among the files attached in this continuation; only documentation and its `index.html` were supplied. Therefore this review is grounded in the supplied documentation and HTML, not a fresh source/ZIP inspection.

Do not overwrite the current site, copy the old repository over the candidate, or claim that the candidate is merged/deployed. Port individual behavior only after source inspection, field mapping, authorization design and regression tests.

## Candidate facts recorded in supplied material

- Root source paths are described as `src/App.tsx`, `src/main.tsx`, `src/context/AppContext.tsx`, `src/utils/rules.ts` and `src/types/index.ts`.
- Main surfaces listed include directory, storefront, cart, merchant/admin/unified dashboards, medical directory and MantyGo preview.
- The source retains supplied business/product catalog entries and AI Studio/PWA assets.
- The baseline report says a private `.data/production-live-db.json` held 26 businesses, 112 products and 6 subscribers plus sensitive operational data at the time of its inventory. Treat this as a private snapshot, not current production truth; never add it to a public repository/build.
- The reports describe local browser `localStorage` as the primary state mechanism, an Express snapshot route, and in-memory notifications. The Express route was judged unauthenticated in the inspected source and the server was restricted to local development in the later status report.
- The later implementation-status update records a read-only public-directory adapter, 20-row keyset paging, and catalog enrichment for only the visible page's slugs. This supersedes the earlier sentence saying no adapter exists. It does **not** establish shared writes, account sessions or backend persistence.
- The candidate status records password-based admin/merchant login disabled, Paymob disabled, no embedded AI/payment credentials, no fake wallet/ledger/message/campaign hydration, WhatsApp handoff-only request forms, medical auto-registration disabled, and a static-shell-only PWA cache.

## Current deployed website is a separate baseline

- Current repository `main` at review: `f2fa0dd8fc04a1c0eabd4f67f0f8d901c20eaf11`.
- V4 catalog presentation PR #662 is merged. Its UI merge is `12cd89a96b42868cdf6ff20ecba83f6f7840cf48`; post-merge catalog mapper correction is `fe9e9f57b780b01c49940349dccf3bbac67efaae`.
- Main build/browser/RBAC validation [41916803905](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41916803905), Pages deploy [41916804007](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41916804007) and Health Monitor [41916803979](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41916803979) passed for the **scoped catalog pilot**, not the standalone V6 source.
- The supplied `DEPLOYMENT_STATUS_AR.md` statements that main was at `36a98b...` and PR #662 was still Draft are superseded by the later GitHub state above.
- Do not conflate candidate Edge snapshots (`directory-listings` v16 and `public-catalog-directory` v15, as written in the supplied candidate status) with the later V4 audit's separately named live public endpoints. Re-read exact live function slugs, versions and source hashes before any future deployment.

## Findings requiring correction or evidence

| Area | Supplied claim / state | Required evidence before production |
|---|---|---|
| Authentication | Admin/merchant login intentionally disabled | Auth provider integration, verified session lifecycle, membership resolution, server-side role checks, logout/revocation, real-account E2E |
| Shared persistence | Browser `localStorage` remains the candidate's main store | Repository-wide persistence adapter; per-entity read/write contracts; RLS/RPC/Edge authorization; cross-device and cross-tenant E2E |
| Express APIs | Local-only restriction recorded; old snapshot route previously unauthenticated | Confirm production bundle cannot start/expose Express; prove snapshot and AI endpoints are not deployed; authenticated/rate-limited/audited server routes if retained |
| Financial and payment | Paymob disabled; no simulated success | Keep disabled until ledger, idempotency, webhook signature/replay, settlement/refund, reconciliation, role/tenant scope and sandbox E2E are proven |
| Doctor/medical data | Auto-registration disabled | Source provenance, lawful republication rights, draft-only ingestion, separate approval/publication gate |
| AI services | Gemini/server configuration referenced | Server-side secret handling, authenticated caller, quotas, rate limits, audit and storage validation; no browser key |
| PWA | Static shell only; API/auth bypass | Verify production SW scope, cache allowlist, logout behavior and offline behavior on supported devices |
| Data migration | Private JSON snapshot identified | Dry-run reconciliation, duplicate/relationship report, field mapping, backup/restore and owner sign-off before any import |
| Build quality | `verify:release` PASS, 50/50 Node tests and syntax transpile recorded; install timed out | Re-run install, lint, full TypeScript check, build and browser suite on one immutable candidate commit |
| 100M capacity | Capacity and load tables contain large targets/results | Reproducible scripts, tested commit, provider/region sizing, traffic model, dataset, raw logs, error budgets and independent rerun |

## Internal inconsistencies and non-claims

1. The supplied implementation status first says no adapter exists, then a later November 4 update says the read-only public-directory adapter is implemented. Treat the dated later update as the candidate's current documented state: **public reads only; no writes/Auth**.
2. The security plan lists Argon2id in the credential-stuffing mitigation table but bcrypt cost 12 in the password-policy section. This is an unresolved design choice, not an implementation fact. Candidate login is currently documented as disabled.
3. The load report claims 500,000 VUs and 310,000 req/s, while the capacity plan's year-five target lists 500,000 VUs and 125,000 peak RPS. Neither report includes the underlying run IDs, raw k6/Locust output, environment topology, dataset, script revision or tested application commit. Treat all benchmark figures as **unverified claims**, not passed release evidence.
4. The load scenario includes writes such as subscriber product updates and admin verification reviews, while the candidate status says backend writes and login are blocked. The tested workload and candidate's available behavior must be reconciled.
5. The DR plan sets 99.95% availability, RPO under 5 minutes and RTO under 30 minutes and describes multi-zone/region replicas, WAL/PITR and automatic failover. The deployment status and current production audit say backup/restore rehearsal and measured RPO/RTO are NOT VERIFIED. These are targets/architecture proposals, not deployed guarantees.
6. The supplied `index.html` metadata advertises several capabilities (including commission handling) more broadly than the candidate's verified status supports. Revalidate each public SEO/social description against actual enabled behavior before cutover.
7. The capacity plan's 100M-user / 1.5M-business / 90M-product values are sizing assumptions. They are not a benchmark or certification. The later production audit's observed live free-text directory query used a sequential scan over 965 rows (~34.4 ms) and noted no `pg_trgm` extension; this is useful current evidence but does not validate the candidate or 100M scale.

## Next implementation sequence

1. Obtain and inspect the actual candidate ZIP/source tree (not just its reports); verify its SHA-256 and ZIP contents against the supplied baseline record.
2. Run the candidate's pinned install, release verifier, test suite, type check, lint and build on one immutable commit. Preserve all original application, PWA and AI Studio assets.
3. Build an entity/field mapping from candidate types to the current Supabase schema; produce a read/write capability matrix. Do not create duplicate tables before exact schema review.
4. Complete the shared persistence/auth boundary before enabling any owner/admin writes. Keep payment, wallet, finance, doctor publication, Member Messages and campaign actions disabled until their own gates pass.
5. Reconcile the private JSON snapshot in dry-run only, with secret/PII removal and duplicate/reference reporting. Do not upload raw snapshot data to GitHub or public artifacts.
6. Run browser, responsive, PWA, RBAC, cross-tenant and API negative tests. Then create an isolated preview deployment; do not replace the current public root.
7. Treat DR and capacity docs as target specifications. Build reproducible restore/load evidence before adopting their SLOs.

## Release decision

`V6_CANDIDATE=SAFE_DEVELOPMENT_CANDIDATE / NOT CERTIFIED`  
`CATALOG_PILOT_GATE=PASS`  
`FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`

No production migration, Auth/RLS/GRANT change, payment/finance write or site cutover was performed by this review.
