# MantiqatiX — Coordinated Production Release Bundle and Read-back Checklist
**Status:** PREPARED — **Production backend release remains BLOCKED / NOT CERTIFIED**  
**Main checkpoint:** `751367f7ea6a7290e5c62bbff5f1979ee456dc20`  
**Security release PR:** [#1043 — RC923 Anonymous Auth catalog RPC guard](https://github.com/islamnagy2022-eng/MantiqatiX/pull/1043) — merged  
**Production project:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Cost boundary:** No paid Supabase branch or new paid test service was created. Isolated PostgreSQL 17 testing used GitHub Actions.

## 1. What is verified
- RC923 is merged on `main` as `20261124121348_rc923_catalog_rpc_anonymous_auth_guard.sql`.
- The exact 80-version release contract is recorded in `docs/release/production-migration-reconciliation.json`, `scripts/production/live-reconciliation-contract.mjs`, and the Production verifier.
- Mainline PostgreSQL 17 forward replay passed: [run 45393984396](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45393984396). It applied 116 later migrations in the disposable replay environment.
- RC485/RC923 registry-root, FORCE RLS and Anonymous Auth denial integration passed for all seven catalog RPCs.
- RC486 price-version advisory lock and unique-index contract passed. RC923 preserves the RC486 lock-before-`MAX(version)` invariant.
- RC921/RC922 appointment state-machine and concurrency tests passed.
- Migration history immutability, migration-version uniqueness, strict 80-version release gate and encrypted-backup manifest contract passed.
- Primary catalog build and browser E2E passed: [run 45393984315](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45393984315).
- Production Pages deployment and deployed-origin route tests passed: [run 45393984388](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45393984388). Root, `/legacy/`, and `/v6-preview/` were verified; the browser suite covered direct routes, mobile/desktop, GPS/manual search, pagination, QR links, consent states and RBAC.
- No Production database migration, Auth/RLS/GRANT, Storage, Edge Function, payment, wallet, settlement or customer-data mutation was performed.

## 2. Live Production facts — read-only snapshot after RC923 merge
The latest read-only query against `MANTIQATIX FINAL` confirmed:
- Migration ledger: 310 rows through `20261110150618`.
- RC923 is **not applied**.
- `private.platform_admins`: RLS enabled, but FORCE RLS is false.
- Live `public.is_platform_admin()` is not yet registry-backed.
- Live `upsert_catalog_item_backend` does not yet contain the RC923 anonymous-session guard.
- The previous live audit also found `mnty_can_platform_admin()` still delegates through tenant membership.
- The exact 80 required release identifiers are not recorded in the live ledger. This is not proof that every intended physical effect is absent; physical schema/function/ACL/RLS reconciliation is still required.
- Directory consent registry and source/republication-rights evidence remain absent. `directory-listings` v18 remains fail-closed.
- Critical Edge bundle drift remains; 42 Edge Functions were active at the latest audit checkpoint.
- Paymob and financial settlement remain fail-closed.

## 3. Coordinated migration bundle — do not cherry-pick
The 80 required migration IDs in the canonical manifest are the complete release contract. The following are security-critical anchors, not a substitute for the full chronological chain:

| Migration | Purpose / release dependency |
|---|---|
| RC464 | Canonical private platform-admin registry hardening |
| RC471 | Forward hardening for `mnty_can_platform_admin()` and its callers |
| RC484 | Registry-backed `is_platform_admin()`, registry FORCE RLS and owner/ACL invariants |
| RC485 | Registry-root authorization for the seven catalog SECURITY DEFINER RPCs |
| RC486 | Transaction-scoped catalog price-version serialization and unique index |
| RC923 | Anonymous Auth-session rejection for the three RC485 RPCs that previously only checked `auth.uid()`; preserves RC486 serialization |

Other required migrations — including directory consent, anonymous-session/profile boundaries, order/payment/finance and appointment contracts — remain part of the same 80-version chronological release contract. Do not apply only the anchor migrations.

## 4. Final Production preflight — last gate before the first Production write
1. **Encrypted backup:** export the Production database and Storage object bytes to an existing owner-controlled encrypted destination; record hashes and prove retrieval/decryption. Do not add a paid storage subscription without approval.
2. **Coverage:** verify Auth users/identities, Storage metadata and object bytes, project configuration, Edge settings, extensions and Vault/key recovery coverage.
3. **Independent restore:** restore the backup into a disposable PostgreSQL 17 environment, test rollback/recovery, and record measured RPO/RTO plus reviewer. This is the final recovery gate requested by the owner.
4. **Physical migration reconciliation:** classify each of the 80 IDs as exact-present, equivalent physical effect under an alias, safe-to-replay, superseded/forward-fixed or blocked. Compare functions, policies, grants, RLS, triggers, constraints and indexes. Never infer absence from a missing ledger row.
5. **Edge dependency closure:** hash the 42 active Edge bundles and compare transitive imports, SQL/RPC/table/ACL dependencies and JWT settings with the exact release source. Prepare coordinated DB + Edge bundles; no one-file hot deployment.
6. **Keep restricted surfaces closed:** no directory publication without source/republication rights and owner contact consent; keep Paymob, wallet payouts and settlement fail-closed until their own sandbox and reconciliation gates pass.
7. **Release approval:** only after steps 1–6 pass, obtain explicit release-window approval for the coordinated Production migration and Edge deployment.

## 5. Controlled apply and postflight read-back
During an approved window:
- Use the repository-pinned Supabase CLI version `v2.122.0` and the reconciled chronological migration plan. Do not blindly run `db push` or fabricate migration ledger rows.
- Apply only the reconciled, approved set in ordered batches with pre/post checks and a stop condition after any mismatch.
- Deploy the matching Edge bundle only after its database/RPC/ACL prerequisites are verified.
- Re-read the live migration ledger and prove each intended physical effect.

Required postflight checks:
- `private.platform_admins` has RLS + FORCE RLS enabled; owner/BYPASSRLS and helper ownership match the tested contract.
- `is_platform_admin()` and `mnty_can_platform_admin()` are registry-backed; verify the 57 + 5 policy dependency sets.
- All seven catalog RPCs remain SECURITY DEFINER with empty `search_path`, use registry-root authorization, allow authenticated execution only, deny anon execution, and reject `auth.jwt()->>'is_anonymous' = 'true'`.
- `upsert_catalog_price_backend` retains the transaction advisory lock before `MAX(version)` and the unique version index.
- Edge bundle hashes/versions match the approved source and SQL contracts.
- Public directory projections disclose no phone/address/precise location without the exact consent scope; the directory remains disabled until source rights and owner consent are proven.
- Run deployed-origin smoke tests for root, `/legacy/`, V6 preview, OAuth, catalog search, activity routes, dashboard, QR and RBAC.

## 6. Abort and recovery rules
- Stop the release on any preflight, migration, ACL, RLS, Edge parity or postflight mismatch.
- Do not use destructive down-migrations as a default rollback. Prefer a reviewed forward corrective migration for schema changes.
- Revert an Edge bundle only when the prior version is proven compatible with the current database schema.
- Restore Production only from the verified encrypted backup under the approved recovery procedure.
- Keep directory, Paymob and financial settlement endpoints fail-closed throughout any partial release.

**Acceptance:** Production may be marked ready only after the final backup/restore gate, physical migration reconciliation, coordinated DB/Edge release, deployed-origin adversarial tests and postflight read-back all pass. Until then: **FULL PLATFORM BLOCKED / NOT CERTIFIED**.
