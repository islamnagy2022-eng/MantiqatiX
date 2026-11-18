# Pass 401–420 — MantiGO settlement authorization population audit

Date: 2026-11-18  
Project: `moyhiluyhjsujhwlyeuu` (`MANTIQATIX FINAL`)  
Scope: read-only Production inspection and disposable negative-regression coverage.

## Confirmed live Production facts

- `public.settle_mantigo_captain_backend(uuid,text,text)` is SECURITY DEFINER with `search_path=public`.
- The function is executable by `authenticated`; it is not executable by `anon` or `PUBLIC`.
- Its live body checks `p_admin_user_id = auth.uid()`, then accepts any active membership whose role is one of `ADMIN`, `SUPER_ADMIN`, `OWNER`, `BUSINESS_OWNER`, `ACCOUNTANT`, `FINANCE_MANAGER`, or `FINANCE`. It does not require the canonical platform-admin registry and does not scope the membership to `MNTY-PLATFORM`.
- Read-only role population query found **3 distinct non-registry users** with active business-wide `BUSINESS_OWNER` memberships (6 membership rows). No non-registry business-wide OWNER or ADMIN users were present in the corresponding role groups.
- These accounts therefore satisfy the live role predicate and have authenticated EXECUTE permission. This is a confirmed authorization exposure path; no evidence was retrieved that any account actually invoked settlement.
- No settlement RPC was called. No ride, ledger, journal, payment, audit or notification data was modified.

## Source remediation already present

- RC464/RC471 replace the settlement RPC guard with `public.mnty_can_platform_admin()`, which consults only `private.platform_admins`.
- The replacement pins an empty search_path, keeps the authenticated RPC entrypoint, and rejects business-scoped roles even when their tenant permissions contain admin-like labels.
- RC471 is a forward-only migration that follows RC464. Live Production is still at migration `20261110150618`; RC464, RC471, RC472 and RC473 are not applied.
- The live `directory-listings` Edge Function remains v16. No Production migration, function, grant, role, payment or settlement mutation occurred.

## Regression changes in this branch

- Add a synthetic tenant `BUSINESS_OWNER` principal to the RC449 disposable fixture/integration sequence.
- Assert that this principal is rejected by all four global MantiGO RPCs, including settlement, financial report, dashboard and stale-ride expiration.
- Assert that the same principal is rejected by all four additional SECURITY DEFINER callers that depend on the shared platform-admin helper.
- Extend the static source validator so future removal of the BUSINESS_OWNER negative case fails CI.

The test invokes only the disposable PostgreSQL fixture; it does not call or mutate Production.

## Release disposition

**P0 — confirmed Production authorization exposure; source fix exists but is not live.**  
Do not apply RC464/RC471 or deploy dependent functions until an off-site logical backup and restore are verified. Required backend order remains RC464 → RC471 → RC472 → RC473 after backup/restore proof, with coordinated Edge deployments and post-release negative tests.

Supabase organization is on the Free plan; no connected evidence of an off-site backup/restore artifact or non-production branch is currently available. No backup artifact or credential was committed.

