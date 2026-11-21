# PASS 1516–1525 — live release and uploaded R7 archive recheck — 2026-11-21

## Scope

Read-only recheck of Production Supabase project `moyhiluyhjsujhwlyeuu`, canonical GitHub `main` source for the public directory, Security Advisor, and uploaded `bizcatalog-manager (11).zip` (R7 archive). No Production SQL, migration, RLS/GRANT, Auth, Storage, Edge deployment, payment, or customer-data mutation was performed.

## 1. Live Production migration ledger

- Production project is ACTIVE_HEALTHY on PostgreSQL 17.6.
- Live migration ledger contains 310 rows.
- Latest applied migration is `20261110150618` / `revoke_public_execute_from_trigger_functions`.
- RC472 and RC473 are not present in the live ledger.
- The current release remains BLOCKED / NOT CERTIFIED. A successful disposable replay is not a Production migration or a verified backup restore.

## 2. Public directory Edge privacy boundary — confirmed blocker

Live `directory-listings`:
- ACTIVE version 16; `verify_jwt=false`.
- Bundle SHA-256: `13f83fcf2faec148af34c08a006ab7bd8f9aa5946bc8af971ebf3e58a9120de0`.
- Deployed bundle contains only `index.ts`, `pagination-filter.mjs`, and `doctor-import-contract.mjs`.
- Public GET selects `phone`, `secondary_phone`, and `address`.
- Deployed entrypoint does not import/call `sanitizePublicDirectoryListing` and does not include the contact/address consent pagination helpers.
- Current `main` contains the sanitizer and dedicated field-scope tests, but the complete compatible bundle and RC472/RC473 schema are not deployed.

Required handling:
- Do not deploy the current `main` Edge entrypoint alone.
- Do not apply RC472/RC473 in isolation.
- Keep migration replay, full Edge bundle parity, backup/restore, and deployed-origin consent tests in one coordinated release gate.

Fresh evidence was added to issue #876 on 2026-11-21. No individual listing, phone, address, or owner values were queried.

## 3. Fresh Supabase Security Advisor snapshot

94 security lint rows across five finding types:
- 90 `auth_allow_anonymous_sign_ins` warnings.
- 9 `rls_enabled_no_policy` findings.
- 1 `anon_security_definer_function_executable` finding.
- 65 `authenticated_security_definer_function_executable` findings.
- 1 `auth_leaked_password_protection` warning (disabled).

These are findings requiring policy/grant/command-level reconciliation, not proof of 90 independent data leaks. No blanket policy changes were made. Fresh evidence was added to issue #928.

## 4. Uploaded R7 archive disposition

The uploaded archive is the R7 source package dated 2026-11-10. Its `TODO.md` claims 23/23 gates and 100% production readiness, but those claims are not supported by the inspected source and must not override the canonical repository or live Supabase state.

Concrete source findings in the archive:
- `src/lib/supabaseClient.ts:13-16` includes `SUPABASE_SERVICE_ROLE_KEY` as a fallback in a client module. If supplied to a client build, this creates a secret-exposure risk.
- `server.ts:95-97` contains hard-coded fallback values for the session JWT secret, Paymob HMAC secret, and backup salt.
- `server.ts:2995-3026` accepts fixed administrator password alternatives and issues a Super Admin session.
- `src/context/AppContext.tsx:946-953,1041-1043` restores and persists the role-bearing auth session in localStorage.
- `server.ts:91-94` and the archive's architecture declare `.data/production-live-db.json` as the authoritative local data store, while Supabase is presented as a secondary sync path.

Disposition: R7 remains reference-only. Do not wholesale merge or deploy it. No secrets were extracted or printed; no claim is made that any fallback secret was deployed or exploited. Preserve Android/mobile assets and only port an individual feature after mapping it to current-main Supabase/Auth/RLS/API contracts and passing isolated tests.

## 5. Current release status

- Source/test work and isolated PostgreSQL evidence do not certify Production.
- Production migration ledger and public-directory consent boundary remain incomplete.
- Backup export, off-site retention, isolated PostgreSQL 17 restore, Vault recovery, measured RPO/RTO, and rollback rehearsal remain NOT VERIFIED.
- Security Advisor findings remain open for itemized review.
- No Production mutation or deployment occurred in this pass.

## Next dependency-ordered actions

1. Finish the exact-head RC488–RC493 CI and migration-collision review; preserve fail-closed handling for true, false, and missing `is_anonymous` claims.
2. Reconcile the ordered migration chain against the 310-row Production ledger and replay it in an isolated PostgreSQL 17 environment.
3. Complete the directory consent migration + full Edge bundle integration and negative/positive consent tests.
4. Complete real encrypted backup/restore and rollback evidence.
5. Reconcile the Security Advisor matrix item by item; do not apply blanket policy changes.
6. Keep Production blocked until coordinated release approval and post-deployment live verification.

**Status: BLOCKED / NOT CERTIFIED.**

---

## PASS 1526–1535 — exact-head RC493 and live parity recheck — 2026-11-21

### Verified GitHub Actions evidence

The RC493 head `5a475124cb6076f21940a64334ea94f5751f6395` on the private CRM/notification guard workstream was checked directly.

- Workflow run [44823050590](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44823050590) — RC493 private-read PostgreSQL integration: **SUCCESS**. Static contract, isolated fixture, and forward migration steps passed.
- Workflow run [44823050369](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44823050369) — forward migration chain replay: **SUCCESS**. The workflow restored its captured checkpoint and applied the candidate chain in timestamp order; its strict 67-version release-gate contract passed.
- Workflow run [44823050284](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44823050284) — open-PR migration collision guard: **SUCCESS**.
- Workflow run [44823050526](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44823050526) — migration version uniqueness: **SUCCESS**.
- Workflow run [44823050285](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44823050285) — migration history immutability: **SUCCESS**.
- Workflow run [44823050376](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44823050376) — web validation: **SUCCESS**; the `validate_public_only` and `deploy` jobs were **SKIPPED**. This is not a production deployment.

These results are exact-head CI evidence for the referenced commit/workflows only. They do not prove Production migration application, backup/restore, or full platform certification.

### Fresh live Supabase inventory

- Project `moyhiluyhjsujhwlyeuu`: ACTIVE_HEALTHY, PostgreSQL 17.6.1.
- Migration ledger: 310 rows; latest `20261110150618`. RC472/RC473 remain absent.
- Edge Functions: 42 deployed functions.
- `directory-listings`: ACTIVE v16, `verify_jwt=false`, deployed bundle SHA-256 `13f83fcf2faec148af34c08a006ab7bd8f9aa5946bc8af971ebf3e58a9120de0`.
- Current-main directory source imports consent-aware output sanitization and contact/address consent pagination modules; deployed v16 does not. This is a confirmed source/deployment mismatch and remains a P0 privacy release blocker.
- Security Advisor snapshot remains 90 anonymous-auth warnings, 9 RLS-enabled/no-policy findings, 1 anon-executable SECURITY DEFINER, 65 authenticated-executable SECURITY DEFINER findings, and leaked-password protection disabled. Findings require scoped semantic review; no blanket policy or grant changes were made.

### Production impact and next action

No Production DDL/DML, migration, RLS/GRANT, Auth, Storage, Edge deployment, payment, or customer-data mutation was performed.

Next: obtain and verify the operator-owned encrypted database and Storage backups, off-site retrieval, Vault recovery, independent PostgreSQL 17 restore/rollback, and measured RPO/RTO. Then rehearse the exact ordered migration chain with the complete compatible directory Edge bundle and consent regression tests. Keep the Production gate **BLOCKED / NOT CERTIFIED** until these gates and post-deployment checks are evidenced.
