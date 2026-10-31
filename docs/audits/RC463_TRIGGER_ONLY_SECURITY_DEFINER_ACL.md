# RC463 — Trigger-only SECURITY DEFINER ACL hardening

**Status:** implementation candidate; exact-head isolated PostgreSQL and forward-chain CI passed on the current PR head.  \
**Production rollout:** not authorized by this change.

## Scope

RC463 targets two trigger-only SECURITY DEFINER functions observed in live Production:

- `public.assign_default_owner_to_unowned_business()` — deferred AFTER INSERT trigger on `public.businesses`.
- `public.capture_commission_rule_audit()` — AFTER INSERT/UPDATE/DELETE trigger on `public.commission_rules`.

Both functions return PostgreSQL's `trigger` type and are attached to triggers. They are not ordinary PostgREST RPC endpoints; the Security Advisor EXECUTE findings reflect default function ACLs, not proof that an anonymous client can invoke them as a normal function. RC463 is a least-privilege hardening change. The intentionally public read-only `get_mnty_targeted_advertisements(...)` RPC is explicitly out of scope.

The older captured schema-only checkpoint (2026-10-17, through `20261008222845`) does not contain the default-owner function/trigger. RC463 therefore:
- Hardens a function only when its matching expected trigger exists and is enabled.
- Skips a function/trigger pair only when both are fully absent from the older checkpoint.
- Fails closed on partial, disabled, or mismatched function/trigger state.

No function source, default-owner behavior, trigger definition, or business data is created or replaced by RC463.

## Change

For each present function, the migration:

1. Verifies it is a SECURITY DEFINER trigger function.
2. Verifies the expected trigger is attached to the expected table and enabled.
3. Pins `search_path` to the empty path. The live function bodies use schema-qualified application objects; PostgreSQL implicitly searches `pg_catalog` for built-ins even when the explicit path is empty.
4. Revokes direct EXECUTE from PUBLIC, anon, authenticated and service_role.
5. Verifies no effective API-role/PUBLIC EXECUTE remains and the empty search_path is active.

## Verification

Current PR head: `7b109df1d4c250c9178aa9afd0adedbaabf6f99c`.

The disposable PostgreSQL 16 integration fixture creates synthetic trigger functions and triggers using a synthetic `.example.test` owner identity, applies the exact RC463 migration, then verifies:

- PUBLIC/anon/authenticated/service_role no longer have effective EXECUTE on either trigger function.
- Both functions remain SECURITY DEFINER with empty search_path.
- Both expected triggers remain enabled.
- A service_role business insert still creates the fixture default-owner membership (deferred trigger forced within the test transaction).
- A service_role commission-rule INSERT, UPDATE and DELETE each write an audit row with the expected action and old/new payloads.
- Service-role fixture table privileges mirror the read/write privileges observed in the live Production catalog.

The integration passed in [Trigger-only SECURITY DEFINER ACL Integration run 41233206112](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41233206112). The commission audit test initially exposed an incomplete fixture grant: live Production grants service_role SELECT as well as INSERT/UPDATE/DELETE on commission_rules. The fixture was corrected to match those observed privileges, and the exact-head rerun passed all three operations.

The integration runs inside a transaction and rolls back its fixture data. The synthetic functions and identities exist only in the disposable test fixture; they are not production migration source.

### Exact-head supporting validation

- Forward migration chain replay from the older schema checkpoint: PASS, [run 41233206156](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41233206156). The run applied 75 later migrations in timestamp order, including RC463, and passed the owner-profile, RC455/RC456 commission-preview, and synthetic two-tenant checks.
- Primary Catalog Frontend build, RBAC PostgreSQL and Playwright browser E2E: PASS, [run 41233206140](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41233206140).
- Backend-only boundary, RC449A/RC450 financial-journal integration and approval-audit atomicity: PASS, [run 41233206155](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41233206155).
- Migration history immutability: PASS, [run 41233206192](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41233206192).
- Migration version uniqueness: PASS, [run 41233206107](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41233206107).
- Open-PR migration collision guard: PASS, [run 41233206121](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41233206121).
- Module professionalization, MantiGO privacy, RC425 Paymob atomicity and other exact-head supporting workflows: PASS.
- Pages validation succeeded, but deployment was skipped because this was a pull-request run. No production deployment occurred.

## Live Production evidence and boundary

A fresh read-only Supabase inspection on 2026-10-31 confirms:
- Live migration ledger: 308 rows through `20261029083845`; RC463 version `20261031100000` is not recorded.
- Both named functions return `trigger`, are SECURITY DEFINER, and remain attached to enabled triggers.
- `assign_default_owner_to_unowned_business()` has `search_path=public, auth`; `capture_commission_rule_audit()` already has an empty path.
- Both functions have default ACL (`proacl IS NULL`), which gives PUBLIC EXECUTE; effective EXECUTE is also true for anon, authenticated and service_role.
- These are trigger-returning functions, not ordinary callable RPCs. Do not describe the Advisor warning as a confirmed anonymous RPC exploit.
- No production schema/ACL/function/trigger/data change was performed.

The captured schema-only checkpoint is older than the live Production catalog and is not a current Production restore. A passing historical-checkpoint replay does not certify a current-Oct-31 Production backup/restore rehearsal.

## Release boundary

- Do not apply RC463 to Production from this PR.
- Keep the PR in Draft pending independent review and production-provenance/rollout review.
- Before any Production rollout, reconcile the full migration ledger and physical objects, capture/restore a current credential-scrubbed schema, rehearse rollback, and obtain explicit approval.
- The 42 required release migration IDs are still 0/42 in the live ledger; six critical payment/order/finance Edge Functions still have source drift; subscription and finance schema/ACL prerequisites, Auth, payment/finance E2E, and backup/restore remain open.
- This change does not certify payment, finance, Auth, RLS or platform-wide Production readiness.
