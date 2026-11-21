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
