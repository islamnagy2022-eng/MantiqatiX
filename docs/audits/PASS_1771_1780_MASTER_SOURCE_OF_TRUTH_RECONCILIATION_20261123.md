# PASS 1771–1780 — Master source-of-truth adoption and live release-gate reconciliation

**Date:** 2026-11-23  
**Request:** Adopt the uploaded `الامر-التقني.txt` as the mandatory operating protocol; continue from current verified sources without restarting or weakening production gates.  
**Status:** SOURCE RECONCILIATION COMPLETE; P0 production blockers remain OPEN / WAIT.

## 1. Source map

| Source | Observed identity | Classification | Operating decision |
|---|---|---|---|
| `docs/MASTER_SOURCE_OF_TRUTH.md` | Existing main-branch canonical document; its content matches the uploaded operating directive | Canonical operating protocol | Follow it for every continuation |
| `apps/catalog-frontend/**` | Current website build source | Canonical website runtime | All website work targets this tree |
| Supabase project `moyhiluyhjsujhwlyeuu` — MANTIQATIX FINAL | ACTIVE_HEALTHY; PostgreSQL 17.6.1.155; organization plan Free | Production backend | Source of truth for Auth, permissions and live data; read-only inspection only in this pass |
| Supabase project `lkijdgqanbqjudiducjt` — MantiqatiX-DEMO | INACTIVE | Demo / non-production | Never substitute for Production |
| `bizcatalog-manager (11).zip` | R7-v7.0.0, built 2026-11-10; 233 files / 37 directory entries; includes Android WebView wrapper | Historical AI Studio R7 reference | Preserve; do not replace current runtime or copy its backend/security design |
| `web/**` | Compatibility/legacy relay tree; not the canonical Pages build | Legacy / redirect compatibility | Do not place current frontend fixes here |
| `android-webview-wrapper/**` in R7 archive | Android wrapper source retained in archive | Preserved mobile source | Do not delete; port only after current runtime contracts and Android build are verified |
| Open PR #994 | Current website capability/SEO/support work on isolated feature branch | In progress | Do not merge until exact-head CI and deployment safety checks pass |
| PR #978 | One cover + up to 10 promotional images | Draft / dependent | Keep draft until matching backend writer/reader/schema release |
| PR #971 | Li2Lak reviews/order tracking | Open | Continue only after reviewing exact current-base checks and dependencies |

## 2. R7 archive integrity and security findings

- Uploaded archive SHA-256: `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`.
- Release manifest claims `R7-v7.0.0`, `Final Commercial Production`, a dual-engine architecture with local authoritative JSON + Supabase, and a security-compliance declaration. These are archive claims, not verified production facts.
- Manifest project reference/URL contains a mismatch from the connected Production project reference. Do not use the archive's embedded project reference to connect or deploy.
- Static source inspection found hard-coded fallback HMAC/JWT secrets in `server.ts` and client-side billing/session helper code; references to `SUPABASE_SERVICE_ROLE_KEY` in browser-side source; local JSON/localStorage persistence for business, product, subscriber and session data; seed/default records initialized as verified/paid; and defaults that can promote missing verification/payment status to trusted values.
- These observations contradict the manifest's broad `secretsIsolated=true` declaration. Treat the archive as **REFERENCE ONLY / NOT SAFE TO DEPLOY**. Do not copy its secrets, local-authority model, auth/session logic, payment defaults or role decisions into the canonical application.
- Android wrapper files are present and remain preserved. No mobile file was deleted or changed.

## 3. Fresh read-only Production snapshot

Observed through the connected Supabase project at approximately 2026-11-23 00:32–00:34 UTC:

- Production project: `MANTIQATIX FINAL`, ACTIVE_HEALTHY, PostgreSQL 17.6.1.155, Free plan.
- Migration ledger: **310** rows; latest version `20261110150618` (`revoke_public_execute_from_trigger_functions`). This does not reconcile the complete source migration inventory or close the required release chain.
- Edge Functions: **42** listed ACTIVE. Observed versions include `order-create v8`, `payment-intent v8`, `paymob-webhook v10`, `digital-page-payment-intent v5`, `subscription-payment-intent v4`, `financial-journal v3`, `directory-listings v18`, `catalog-admin v20`, `catalog-platform-admin v23`, `public-catalog-directory v19`, `public-catalog v9`, and `ai-gemini-proxy v5`. Version numbers alone do not prove source parity.
- Auth users: 8 total; 7 confirmed non-anonymous email users; 1 unconfirmed email user; 0 anonymous Auth users observed at query time.
- Security Advisor: 9 RLS-enabled/no-policy INFO findings; 1 anon-callable SECURITY DEFINER WARN; 65 authenticated-callable SECURITY DEFINER WARN; 90 anonymous-sign-in policy warnings across named tables; leaked-password protection disabled WARN.
- The 9 RLS-enabled/no-policy tables were separately checked for direct `anon` and `authenticated` SELECT/INSERT privileges: all checked privileges were false. These findings are currently safe-deny, not evidence to add broad policies.
- Sampled financial/support policies show multiple overlapping non-anonymous guards and membership/tenant predicates. Do not mass-revoke EXECUTE, rewrite policies or change Auth configuration based only on aggregate Advisor counts. Review each function/policy and prove negative cross-tenant and anonymous-session behavior in isolated tests.

## 4. P0 execution order and gates

| Task | Status | Evidence / dependency |
|---|---|---|
| Adopt master directive and current-source map | DONE (documentation) | This audit; existing `docs/MASTER_SOURCE_OF_TRUTH.md` |
| Preserve R7 and Android archive | DONE (preservation only) | Uploaded ZIP hash and archive inventory |
| Encrypted Production DB export | WAIT — operator action | Free plan; trusted workstation, protected connection string, age recipient and off-site destination required |
| Export all Storage objects and verify inventory | WAIT — operator action | Supabase Storage S3 endpoint/key and independent off-site storage required |
| Vault key recovery / secret inventory | WAIT — operator action | Current official key recovery procedure; do not expose secrets in chat or repository |
| Independent PostgreSQL 17 restore / rollback and measured RPO/RTO | WAIT — operator action | Separate disposable target project, off-site artifacts and independent reviewer |
| Reconcile exact required migration set and live object drift | IN PROGRESS | Current ledger 310 rows; do not apply isolated Production migrations |
| SECURITY DEFINER / RLS / Auth review | IN PROGRESS | Review by function, caller, table and policy; no blanket privilege changes |
| Leaked-password protection | WAIT — privileged Auth setting | Advisor reports disabled; change only through authorized release/settings workflow |
| Edge source parity | IN PROGRESS | Compare each deployed bundle with current main; version labels are insufficient |
| Full platform release | BLOCKED / NOT CERTIFIED | Backup/restore, migration, Auth/RLS, Edge, payments and rollback evidence remain incomplete |

## 5. Website PR #994 guardrails

- Existing catalogue default limit of 150 items is a commercial entitlement; it has been preserved. Do not remove or increase it without reconciling subscription policy and server-side enforcement.
- Existing responsive viewport, dashboards, owner social/contact links and activity share/QR functions were already present; avoid duplicate implementations.
- Public contact disclosure remains consent-gated.
- AI support UI must remain disabled by default until the matching Edge Function version is deployed through the approved process and its auth/rate-limit/source-parity checks pass.
- SPA metadata is not a substitute for SSR/prerender and deployed-origin crawl verification.
- No Production database, Auth, RLS, GRANT, Storage, Edge deployment, payment, wallet, settlement or customer-data mutation was performed in this pass.

## 6. Next action

Continue source-only P0 security reconciliation while the operator-controlled backup/restore task is WAIT. Prioritize exact deployed Edge source comparison and anonymous-session negative tests; do not weaken current fail-closed directory/contact boundaries. Update the same TODO and continuity record after every exact-head CI, merge, deployment or live verification event.

**Global status: FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED.**

## 7. Exact deployed Edge source comparison — 2026-11-23

A byte-for-byte comparison was performed between the live Production `index.ts` bundle and current-main source for the six payment/finance-critical functions:

| Function | Live version | Live bytes | Main bytes | Exact match |
|---|---:|---:|---:|---|
| `order-create` | v8 | 10,083 | 13,988 | NO |
| `payment-intent` | v8 | 8,114 | 10,146 | NO |
| `paymob-webhook` | v10 | 11,538 | 12,376 | NO |
| `digital-page-payment-intent` | v5 | 5,345 | 6,532 | NO |
| `subscription-payment-intent` | v4 | 5,196 | 11,100 | NO |
| `financial-journal` | v3 | 1,591 | 3,387 | NO |

Additional live/main comparisons:

| Function | Live version | Live bytes | Main bytes | Exact match |
|---|---:|---:|---:|---|
| `catalog-admin` | v20 | 37,862 | 44,115 | NO |
| `catalog-platform-admin` | v23 | 63,454 | 67,227 | NO |
| `directory-listings` | v18 | 2,054 | 52,098 | NO — deployed fail-closed stub; preserve until RC472/RC473 consent bundle is released |
| `ai-gemini-proxy` | v5 | 15,446 | 15,752 | NO; live v5 does not contain `technical_support` |

**Disposition:** These are source mismatches, not permission to deploy. Do not individually replace payment, finance, catalog-admin or directory Edge functions. Reconcile migration/schema/RPC/ACL dependencies and release coupled bundles only after backup/restore and explicit production release approval. Keep the directory fail-closed. Keep AI support UI hidden until its new Edge contract, server-side rate limiting, exact bundle parity and deployed-origin tests are complete.

The deployed `public-catalog` v9 and `public-catalog-directory` v19 were previously recorded as exact bundle matches in the 2026-11-22 continuity checkpoint; their live bundle files are stored under `source/index.ts` plus `_shared/**`, so do not infer a mismatch from comparing only a nonexistent root `index.ts` entry.
