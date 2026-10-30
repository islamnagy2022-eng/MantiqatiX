# Digital-page payment RPC search-path hardening — RC458
Date: 2026-10-30
Status: Source change and disposable PostgreSQL regression suite prepared; full isolated Supabase replay and production rollout remain pending.

## Scope and live evidence

Read-only query against Production project `moyhiluyhjsujhwlyeuu` inspected:

- `public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text)`
- `public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text)`
- `public.fulfill_digital_page_publish(uuid,uuid,uuid)`

Observed for all three:

- Owner: `postgres`.
- `SECURITY DEFINER = true`.
- Function setting: `search_path=public, pg_temp`.
- ACL: postgres and authenticated EXECUTE; no anon EXECUTE.
- The claim and release procedures bind `p_user_id` to `auth.uid()`; claim also verifies order ownership, idempotency key, payment state and claim token.
- The publication procedure binds `p_actor_user_id` to `auth.uid()`, calls `public.mnty_can_platform_admin()`, checks paid order, page owner/type/business binding, and writes an audit record.

Existing callers are authenticated user-scoped requests. The authenticated EXECUTE grants are intentional and must not be revoked as a generic hardening action.

## RC458 change

Added forward-only migration:

`supabase/migrations/20261030120000_rc458_digital_page_payment_rpc_empty_search_path.sql`

It sets an empty `search_path` on the three named procedures. For the claim RPC, `CREATE OR REPLACE` also qualifies the `digital_page_orders` references with an `o` alias. The first disposable test exposed an actual PL/pgSQL ambiguity: `RETURNS TABLE` defines an output variable named `id`, which conflicted with the unqualified `WHERE id = p_order_id`. The forward fix uses `o.id` in both the row-locking SELECT and UPDATE. `CREATE OR REPLACE` preserves the existing owner and ACL; the other two procedures receive configuration-only changes. PostgreSQL built-ins remain available through implicit `pg_catalog`.

## Regression coverage

Added disposable fixture and integration suite:

- `supabase/tests/rc458_digital_page_payment_rpc_fixture.sql`
- `supabase/tests/rc458_digital_page_payment_rpc_integration.sql`
- `.github/workflows/rc458-digital-page-payment-rpc-search-path.yml`

The suite checks:
1. All three functions are still SECURITY DEFINER and have an empty function search_path.
2. The claim RPC keeps qualified table aliases to avoid the discovered output-column ambiguity.
2. Authenticated EXECUTE remains; anon, service_role and PUBLIC execution remain absent.
3. The caller/order-owner checks in the claim RPC remain present and cross-user claim/release attempts fail.
4. A same-named temporary table cannot shadow the public order data.
5. The publication RPC still binds the actor to `auth.uid()`, rejects a non-platform-admin and rejects a mismatched actor.
6. A valid platform-admin publication is idempotent and creates exactly one audit event.

## Safety and remaining gates

- No Production database, function, grant, Auth setting, payment, page or financial data was changed.
- The workflow uses a disposable PostgreSQL 16 service and is not a substitute for replay against a restorable isolated Supabase branch. The first run caught the ambiguous `id` reference and failed as intended; the migration and fixture were corrected. The first full-chain replay attempt also hit GitHub release API throttling and public ECR image-pull rate limits; the Supabase CLI dependency is now pinned to v2.122.0 to remove the latest-release lookup.
- After CI passes, perform full isolated Supabase migration replay and caller regression against the current schema; inspect resulting function ACL/config/body; only then propose a production rollout with rollback evidence.
- Production rollout is not authorized by this change. Do not apply RC458 directly to Production.
- Issue [#269](https://github.com/islamnagy2022-eng/MantiqatiX/issues/269) remains open until isolated Supabase evidence is attached.
- Issue [#422](https://github.com/islamnagy2022-eng/MantiqatiX/issues/422) is separate: Leaked Password Protection still requires an authorized Supabase Auth dashboard change and a fresh Advisor check.
- Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.
