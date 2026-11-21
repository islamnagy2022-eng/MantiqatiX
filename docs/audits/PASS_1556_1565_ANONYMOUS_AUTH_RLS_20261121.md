# Pass 1556–1565 — Anonymous Auth boundary and RC492 live-grant correction

Date: 2026-11-21  
Repository: `islamnagy2022-eng/MantiqaTix`  
PR: [#959](https://github.com/islamnagy2022-eng/MantiqatiX/pull/959)  
Status: source/CI candidate only; exact-head CI queued at checkpoint.

## 1. Production facts rechecked read-only

- Supabase Production project is active and healthy.
- Migration ledger: 310 rows, latest `20261110150618`.
- Exact required release versions: 73; recorded in live ledger: 0.
- RC472 and RC473 remain absent from the live ledger.
- `indrive_requests`: authenticated direct INSERT=false, UPDATE=false, DELETE=true. Existing permissive INSERT/UPDATE/DELETE policies are present.
- `indrive_bids`: authenticated direct SELECT=true.
- The RC492 candidate was adjusted to avoid creating or requiring grants. It adds restrictive confirmed-Auth checks for request DELETE and bid SELECT; it does not widen privileges.
- No application rows, customer details or personal identifiers were selected for these privilege checks.

## 2. RC488–RC493 source candidate

The current-main PR adds restrictive RLS policies for authenticated-role JWTs to ensure that anonymous Auth sessions and tokens missing the `is_anonymous` claim fail closed.

| Migration | Scope |
|---|---|
| RC488 | Storage object writes |
| RC489 | Private financial reads |
| RC490 | Medical appointment reads |
| RC491 | Support ticket reads |
| RC492 | InDrive request deletion and bid reads |
| RC493 | Private CRM, project and notification reads |

Existing permissive tenant/owner policies are preserved. No direct table grants are added or revoked by these candidates.

## 3. RC492 integration design

The disposable PostgreSQL 16 fixture mirrors the observed Production privilege boundary:
- Requests: authenticated DELETE only.
- Bids: authenticated SELECT only.
- RLS is enabled and forced.
- Existing owner/provider permissive policies are represented.

The integration test checks:
- Anonymous Auth request DELETE affects zero rows.
- Anonymous Auth bid SELECT returns zero rows.
- Missing `is_anonymous` claim fails closed for bid reads.
- Confirmed owner DELETE remains functional.
- Confirmed provider retains existing visibility of their own bid.

The test deliberately does not call INSERT or UPDATE as authenticated, because Production does not grant those privileges. A privilege-denied operation must not be misreported as proof that an RLS policy works.

## 4. SECURITY DEFINER inventory

A read-only catalog inventory found:
- 65 public SECURITY DEFINER functions executable by authenticated.
- 0 without a configured `search_path`.
- 47 configured with `search_path=public`.
- 18 configured with an empty search path.
- 17 include `pg_temp` in their configured path.
- 1 is also executable by anon: `get_mnty_targeted_advertisements`, configured with an empty search path and constrained to active, approved and time-valid advertisements.

This is an inventory, not a blanket vulnerability finding. No blanket GRANT revocation or search-path rewrite was made. Continue reviewing function bodies, object qualification and effective privileges individually.

## 5. CI and release status

- A dedicated RC492 PostgreSQL 16 workflow was added.
- PR #959 triggers RC488, RC492, RC493, forward migration replay, migration collision/uniqueness/immutability, frontend and related integration workflows.
- At the checkpoint, the exact-head workflows were queued. No new-head CI success is claimed.
- PR #956 was closed without merge; the source changes were ported onto current main and are proposed in PR #959.
- No Production migration, DDL/DML, RLS/GRANT, Auth, Storage, Edge, payment, wallet or customer-data mutation occurred.

## 6. Remaining release blockers

1. Complete exact-head CI for PR #959 and resolve all failures before merge.
2. Obtain and verify operator-owned encrypted database and Storage backups, off-site retrieval, Vault recovery, independent PostgreSQL 17 restore/rollback and measured RPO/RTO.
3. Reconcile the 73 source migration identities against the live 310-row ledger and inspect physical schema/function/ACL/RLS contracts; do not fabricate ledger rows or blindly replay.
4. Coordinate RC472/RC473 with the complete `directory-listings` Edge bundle and consent end-to-end tests.
5. Verify directory source/republication rights and all remaining P0 security controls.

**Production gate: BLOCKED / NOT CERTIFIED.**