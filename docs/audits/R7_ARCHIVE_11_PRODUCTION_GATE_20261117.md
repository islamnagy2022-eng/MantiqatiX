# R7 archive (11) — production safety and backend parity gate

**Audit date:** 2026-11-17  
**Input:** `bizcatalog-manager (11).zip`  
**SHA-256:** `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`  
**Companion directive:** `الامر-التقني.txt` — SHA-256 `b51078e5aa164067c46347fd327c7230c5968f3cd36df5a354691504a3364ee2`  
**ZIP integrity:** PASS; 270 entries.  
**Decision:** `BLOCKED / NOT SAFE TO IMPORT OR DEPLOY AS-IS`.

This is a source inspection of the newly uploaded archive. It is not evidence that these routes are deployed, nor a live penetration test. The currently deployed GitHub Pages application was not changed.

## 1. Blocking source findings

| Severity | Evidence in archive | Finding | Required correction |
|---|---|---|---|
| P0 | `server.ts:2576-2610` | `POST /api/auth/session-token` signs a token using caller-supplied `userId`, `role`, and `businessId`; no preceding authentication/authorization guard is present in the route. | Remove this public token-minting path. Resolve actor, role, tenant, business and branch exclusively from verified Supabase Auth + active membership on the server. |
| P0 | `server.ts:3298-3332` | `POST /api/auth/refresh` accepts caller-supplied role/business fallback and issues a new signed token when the supplied token is invalid or absent. | Refresh only a verified, revocable server/managed Auth session; reject missing/invalid tokens. |
| P0 | `server.ts:2995-3026` | Admin login accepts hard-coded `admin` and `01010171770` in addition to the configured password; successful path mints `super_admin`. | Remove all hard-coded credential bypasses. Use Supabase Auth plus platform-admin membership/permission checks. |
| P0 | `server.ts:1202-1235`, `1238+`, and read routes including `1189+` | Production snapshot and bulk commit endpoints accept and return whole application state without a route-level authentication/authorization check. Related CRUD routes such as business/product/subscriber endpoints also lack route-level actor checks in the inspected handlers. | Do not expose these endpoints. Replace with narrow, schema-validated, authenticated Edge/RPC operations enforcing tenant/business/branch scope and audit. |
| P0 | `server.ts:91-97`, `478-505` | Runtime database is a local `.data/production-live-db.json`; first-start path creates a seeded local database. Supabase sync is a separate operation, not the sole authority. | Supabase must be the only source of truth for production identity, memberships, permissions and business data. Keep fixtures isolated to tests/previews. |
| P0 | `server.ts:95-97` | Predictable fallback secrets are hard-coded for Paymob HMAC, session signing and backup encryption. | Fail closed when secrets are absent; use managed secret storage, key rotation and independent key material. |
| P0 | `src/context/AppContext.tsx:945-953, 1024-1043` | Auth role/session is restored from and written to `localStorage`; UI login state is set before the server login request is checked. | Treat browser state as presentation-only. Rehydrate identity and membership from Supabase Auth and server-authorized membership APIs. |
| P0 | `server.ts:3149-3179`, `3202+`, `3227+` | Registration marks email verified, returns the verification code, assigns a default wallet balance, and recovery path accepts direct new-password input without a demonstrated verified recovery challenge. | Replace with Supabase Auth OTP/recovery and server-side profile creation; no code or password may be returned to the client. |
| P0 | `src/context/AppContext.tsx:1340-1360` | New business creation defaults `paymentStatus` to `paid` and `paymentConfirmedByAdmin` to `true` when no explicit values are supplied, and stamps a payment date. This can represent an unverified business as paid. | Default to a non-paid/pending state; payment confirmation must come only from an audited server-side payment/admin workflow using authoritative subscription/payment records. |
| P1 | `package.json` | No `test` or `release:check` script exists; `lint` is only `tsc --noEmit`. This does not support the accompanying claim of 99 automated tests passing from this package's declared scripts. | Add reproducible test/build/security/browser scripts and CI evidence tied to this exact archive hash. |
| P1 | `RELEASE_REPORT.md`, `TEST_REPORT.md`, `RELEASE_MANIFEST_R7.json` | The release docs claim a certified production release, but the source-level P0 findings above contradict that claim. | Mark the archive a development candidate until each gate is independently evidenced. |

### Additional architectural mismatch

The archive includes `server.ts` and an Android WebView wrapper, but the existing public website is GitHub Pages static hosting. GitHub Pages does not run the Express server. The archive cannot be treated as a drop-in replacement for the deployed static site: its API, authentication, persistence, secrets and Android deep links require a supported hosted backend and explicit route/base-path integration.

The archive also contains `.aistudio/` temporary media. Do not publish this workspace metadata or temporary captures as public assets. Preserve the Android wrapper and mobile components, but audit their origins, permissions, network policy, signing and build independently.

## 2. Current Production Supabase read-only checkpoint

Project ref: `moyhiluyhjsujhwlyeuu`.

- Migration ledger: **310 records**, latest version `20261110150618` (`revoke_public_execute_from_trigger_functions`).
- Edge Functions: **42 ACTIVE**.
- Security Advisor: 9 RLS-enabled/no-policy tables; 1 anon-executable SECURITY DEFINER function; 65 authenticated-executable SECURITY DEFINER functions; leaked-password protection warning remains. Performance Advisor reports 132 unindexed foreign keys, 375 auth RLS init-plan warnings, and 28 multiple-permissive-policy warnings.
- These are separate warnings/findings; they do not all imply an exploitable vulnerability. No broad grants or RLS changes were made.

### Critical deployed Edge Function parity

Live deployed entrypoints were retrieved and compared byte-for-byte with `main` on 2026-11-17. All six critical functions differ:

| Function | Live version | Difference observed in deployed source |
|---|---:|---|
| `order-create` | v8 | Missing main's bounded streaming body parser and additional body/JSON, branch-scope, duplicate-option and item-option relationship checks. |
| `payment-intent` | v8 | Missing Paymob intent-correlation helper and exact amount/cents/provider-intent correlation checks. |
| `paymob-webhook` | v10 | Missing finite amount guard and stricter subscription provider-order binding present in main. |
| `digital-page-payment-intent` | v5 | Missing Paymob correlation helper present in main. |
| `subscription-payment-intent` | v4 | Missing Paymob correlation and encrypted checkout-secret protections present in main. |
| `financial-journal` | v3 | Deployed source uses wildcard CORS and legacy `post_financial_journal`; main uses allow-listed CORS and `post_financial_journal_backend`. |

**Do not deploy these six functions one by one.** They are coupled to database migrations, RPC signatures, grants, and payment state transitions. Reconcile the matching schema and ACLs, replay/test on a disposable current-schema database, then run real Paymob sandbox success/failure/replay/idempotency and financial journal reconciliation before any coordinated production rollout.

### Direct live schema preflight (2026-11-17)

A read-only SQL query confirmed:

- Absent: `mantigo_payment_provider_events`, `uq_payment_intents_one_active_per_order`, `smm_wallet_transactions_reference_type_uidx`, `erp_purchase_order_lines`, `journal_entry_lines_entry_line_uidx`, `journal_entries_tenant_entry_number_uidx`, `erp_purchase_orders_business_order_number_uidx`.
- Present: `platform_custom_roles`, `platform_role_assignments`, `business_job_positions`, `business_employees`.
- Missing from the journal schema: `journal_entries.entry_number`, `total_debit`, `total_credit`, `posted_at`, and `journal_entry_lines.line_number`.
- `post_financial_journal_backend(uuid,jsonb,jsonb)` has no EXECUTE for `anon`, `authenticated`, or `service_role` in the current live ACL snapshot.

This is a partial physical preflight, not a complete 60-object reconciliation. Do not infer that all required objects are absent from this smaller query.

## 3. Migration source/ledger reconciliation

The existing release reconciliation manifest on `main` is stale: it records a 309-row ledger ending at `20261101140105`, whereas the live read-only inventory now has 310 rows ending at `20261110150618`. The source file `supabase/migrations/20261110150618_revoke_public_execute_from_trigger_functions.sql` was absent from current `main`, but its exact SQL was recovered read-only from `supabase_migrations.schema_migrations.statements` and restored on this audit branch.

Do not fabricate a migration row or replay this migration blindly. Recover the exact deployed migration source from its authoritative PR/artifact, compare its SQL and checksum with the live physical state, and restore the immutable source file under the correct version before marking source/ledger parity complete.

The old manifest's 42 required release-version check and object inventory remain blocked. The 310-row count does not prove the 42 required source migrations or their physical effects are reconciled.

## 4. Safe next execution order

1. Recover and reconcile the missing `20261110150618` migration source and update the ledger snapshot with a timestamped, read-only inventory.
2. Build a complete live-vs-main migration/object/RPC/ACL reconciliation for the 42 release migrations and all required objects. Use exact signatures and explicit alias evidence; never insert fabricated ledger entries.
3. Resolve the six Edge Function diffs as one dependency-ordered payment/order/finance release stack; first run disposable database replay and positive/negative tenant tests.
4. Run Paymob sandbox E2E (success, failure, duplicate webhook, amount/currency/order mismatch, retries and journal posting) and verify idempotent financial balances.
5. Complete backup/restore rehearsal from a real Production backup in an isolated target, with measured RPO/RTO and rollback evidence.
6. Continue Auth, RLS, SECURITY DEFINER and cross-tenant adversarial testing. Keep owner-controlled Auth settings (including leaked-password protection) as an explicit external gate.
7. Only after these gates pass, integrate R7 UI in an isolated Preview by mapping it to existing Supabase contracts. Do not import its local JSON snapshot, client-held roles, default credentials, local Express persistence or demo/seed records.

## 5. Change boundary and result

- Read-only Production inspection only. No database write, migration, data mutation, Auth setting, grant, RLS policy, Edge deployment, payment, or Pages deployment occurred.
- R7 archive (11) is preserved as the current user-supplied UI/behavior candidate, but is **not** approved for import/deployment as-is.
- Current deployed V6 root and retained `/legacy/` remain unchanged.
- `FULL_PLATFORM_GATE = BLOCKED / NOT CERTIFIED`.


## 6. Addendum — trigger-only SECURITY DEFINER migration parity (2026-11-17)

A follow-up read-only query checked the two trigger-only SECURITY DEFINER functions covered by RC463:

- `public.assign_default_owner_to_unowned_business()`: SECURITY DEFINER; expected trigger enabled; no direct EXECUTE for anon, authenticated or service_role; ACL contains only `postgres=X/postgres`; **search_path remains `public, auth`**.
- `public.capture_commission_rule_audit()`: SECURITY DEFINER; expected trigger enabled; no direct EXECUTE for anon, authenticated or service_role; ACL contains only `postgres=X/postgres`; search_path is empty.

Current `main` does contain the immutable RC463 source `supabase/migrations/20261031100000_rc463_trigger_only_security_definer_acl.sql` (blob `83e9650c5be5bedbfe6ee113cb799abb96867031`). Its contract sets an empty search_path for both functions and revokes direct EXECUTE. The current physical state therefore shows the direct-EXECUTE revocation but does **not** fully match RC463's empty-search-path contract for `assign_default_owner_to_unowned_business()`.

The live 310-row ledger does not contain RC463 version `20261031100000`, although its source file exists on `main`. It does contain the later version `20261110150618_revoke_public_execute_from_trigger_functions`, whose source file is missing from `main`. Do not assume the later version is an alias of RC463: the observed live function configuration is not fully equivalent to RC463. Recover the exact deployed SQL/PR artifact and inspect any intervening ALTER FUNCTION statement before deciding whether a forward-only repair is required. Do not replay RC463 out of chronological order.

A cross-session history check adds an important exclusion: PR #722's RC candidate was explicitly **not** applied to Production. The prior conversation history contains no exact SQL, deployment source, branch/commit, or execution evidence for live migration `20261110150618`. Therefore, do not infer that the migration came from PR #722 or reconstruct its contents from the migration name. The exact source remains an external recovery blocker.

### Exact source recovery verification

The stored migration row contains one SQL statement (374 characters), no rollback entry, and its database-side SHA-256 is `b462abcd9205345901c389102992d9ee31aa6d293a5e7bb5e9f6114f0f43afed`. The restored file was independently hashed locally and produced the same SHA-256. Its contents are therefore byte-identical to the stored migration statement. The file restoration is source-only; the Production migration was not executed again.

## 7. R7 default catalog imagery — source verified and focused tests passed

The requested default imagery behavior is already present in the exact R7 archive; no additional image resolver rewrite is required for this baseline:

- `src/data/imageAssets.ts` defines **15 functional-sector packs**, each with 3 logo variants, 3 cover variants and 6 product/service variants (180 curated sector defaults).
- `src/utils/aiImageCompletionEngine.ts` assigns sector-aware logo/cover defaults for a newly created business and sector-aware product/service images when the supplied URL is empty or a known placeholder/broken URL.
- `src/context/AppContext.tsx` calls the business resolver during `addBusiness` and the product resolver during `addProduct`; this is assignment at creation time, not only a visual onError fallback.
- Five local AI-generated image files referenced by the resolver exist under `public/assets/ai-generated/`, including the maintenance/appliance repair asset.
- Existing `aiImageCompletionEngine.test.ts`: **4/4 PASS**. The test was compiled with the available global TypeScript 5.8.3 using temporary Node test type shims, then executed with Node 22.16.0. The package's declared test script is still missing, so this is focused source-level evidence, not the project's standard CI.
- Additional executable checks against the compiled actual R7 resolver: **15/15 sector packs** passed logo/cover/product fallback checks; all five local AI assets existed; maintenance business and appliance-repair product defaults passed; generated SVG text sanitization passed.

**Disposition:** default imagery is implemented in the R7 candidate. It is not deployed because R7 remains blocked by the independent P0 Auth, persistence, server API and secret-management findings above. The old V6 maintenance-image PR #739 is a separate retained-`/legacy/` improvement and does not substitute for R7 integration.

### Additional R7 financial bootstrap check

A focused source assertion passed 7/7 checks confirming the new-business default-paid/admin-confirmed path and the registration defaults. The registration handler also creates a `walletBalance: 1000`, marks `emailVerified: true`, returns `verificationCode`, and defaults a missing password to `customer123`. These are source-level facts; no endpoint was invoked. Treat these as P0 until the R7 candidate is mapped to Supabase Auth, authoritative subscription state and a ledger-backed wallet contract.
