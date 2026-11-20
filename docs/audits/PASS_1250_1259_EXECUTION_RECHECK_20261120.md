# Pass 1250–1259 — Execution recheck and release gate — 2026-11-20

**Repository baseline:** `main` at `75da70cbeb0ff8876562f4d780df9eaa50f2dc4a`  
**Production project:** `moyhiluyhjsujhwlyweuu`  
**Disposition:** `BLOCKED / NOT CERTIFIED`  
**Production writes in this pass:** NONE

## 1. Source archive verification

- Reopened the exact user-uploaded `bizcatalog-manager (11).zip`.
- SHA-256: `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`.
- ZIP integrity: PASS.
- Archive is the R7 React/Vite/Express candidate, not the currently deployed catalog source tree. Preserve it as a reference and do not wholesale replace the current `apps/catalog-frontend/**` source.
- R7 uses a dual local-JSON/Supabase architecture and stores businesses, products, subscriber/customer accounts, orders, wallets and other state through `localStorage` in `src/context/AppContext.tsx`. This is not an acceptable production authority for identity, authorization, tenant data or financial records.
- `src/lib/supabaseClient.ts` selects `process.env.SUPABASE_SERVICE_ROLE_KEY` before public keys in a shared client module. The production bundle was not built in this pass, so actual secret inclusion is **not proven**; treat this as a release-blocking source boundary requiring a server-only split and a built-artifact secret scan before any R7 deployment.
- The archive contains 15 `*.test.*` files, but `package.json` defines no test script. Dependency installation timed out; build/typecheck/lint and tests could not be run in this environment.
- Android wrapper source is preserved and contains three files only; this is not evidence of a complete native Android build/release.

## 2. Fresh read-only Production inventory

- Supabase project status: `ACTIVE_HEALTHY`.
- Migration ledger: 310 rows, latest `20261110150618`; required release contract: 64 identifiers, 0 exact IDs recorded.
- Public tables: 137; all 137 report RLS enabled. RLS-enabled/no-policy tables remain fail-closed by default and need ACL/role interpretation, not blanket policy creation.
- Active Edge Functions: 42.
- Critical Edge entrypoint parity: 4/11 exact; 7/11 mismatches. Do not deploy mismatched order, payment, subscription, finance or directory functions individually.
- Security Advisor findings include 9 RLS-enabled/no-policy informational items, one anon-executable SECURITY DEFINER RPC, 65 authenticated-executable SECURITY DEFINER functions, and leaked-password protection disabled. These counts are review inventories, not a claim that every item is exploitable.
- Performance Advisor snapshot: 132 unindexed foreign keys, 375 Auth/RLS initplan warnings, 70 unused indexes and 28 multiple-permissive-policy warnings. No production index/policy changes were made.

## 3. Confirmed release blockers

1. `public.mnty_can_platform_admin()` still delegates to `public.mnty_can('admin', NULL, NULL, NULL)`; the registry-backed RC464/RC471/RC484 repairs are source-side and not applied in Production.
2. `anon` retains direct SELECT on `public.marketing_provider_profiles`, including `owner_user_id` and `settings`; RC479 exists in source but is not applied.
3. Public and private directory contact-consent registries are absent. Live `directory-listings` v16 remains anonymous and does not match the consent-aware main bundle. Do not deploy that bundle without its ordered database prerequisites.
4. Payment/finance dependencies remain incomplete or incompatible: MantiGO provider-event table and atomic payment RPCs absent; active-order uniqueness absent; subscription claim/encrypted-checkout columns and RPCs absent; journal service-role EXECUTE contract incomplete.
5. Live/source Edge parity remains 4/11. Seven mismatched critical functions are blocked from standalone deployment.
6. Encrypted off-site database **and Storage** backup, Vault recovery, separate PostgreSQL 17 restore, measured RPO/RTO, rollback rehearsal and independent review remain unverified.

## 4. Work completed versus blocked

- Rechecked source archive integrity/hash and inspected its security/architecture boundaries.
- Re-read Production migration/table/Edge inventories and Security/Performance Advisor state using read-only operations.
- Reconfirmed that RC484 disposable PostgreSQL 17 adversarial tests and the 99-migration chronological replay are existing source/CI evidence only; neither is a real Production backup restore.
- Confirmed PR #889 is merged (test coverage only) and stale PR #890 is already closed.
- Attempted dependency installation for the uploaded R7 candidate; it timed out. No successful build or test claim is made.
- No production migration, DDL/DML, grant, RLS, Auth, Storage, Edge deployment, payment, wallet, settlement, journal or customer-data mutation was made.

## 5. Exact next actions and prerequisites

**Owner/operator prerequisite:** create encrypted off-site database and Storage exports using the private connection details and storage credentials in the owner's controlled environment; recover and escrow required Vault secrets; produce checksums and retrieval evidence. These credentials and export capabilities are not available in this session. Do not paste secrets into chat or commit them.

After evidence is available:
1. Restore the backup to a separate PostgreSQL 17 target and verify schema, roles/ACLs, RLS, storage objects and application-critical data.
2. Measure actual RPO/RTO and rehearse rollback.
3. Replay the exact chronological release chain on the disposable restore; reconcile all 64 identifiers and physical object/ACL contracts.
4. Release the database chain and compatible Edge bundles together in an approved window.
5. Run Paymob sandbox signature, amount/currency, provider-order mismatch, idempotency, replay, failure/refund and journal tests; run directory consent grant/revoke/expiry and anonymous field-suppression tests; run adversarial tenant/platform-admin authorization tests.
6. Re-read live migration ledger, grants, policies, RPC definitions and Edge versions/hashes; only then consider production certification and site cutover.

**No release certification is granted by this pass.**