# Production database monitor — read-path preflight (2026-10-31)

## Scope

Read-only catalog metadata verification for the relation used by the hourly Production Health Monitor:

`public.marketing_provider_profiles`

No business/profile records were selected. No schema, data, privilege, policy, Auth, Edge Function, secret, or payment mutation was performed.

## Query

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select_granted,
  coalesce((
    select string_agg(
      p.policyname || ':' || p.roles::text || ':' || p.cmd,
      '; ' order by p.policyname
    )
    from pg_policies p
    where p.schemaname=n.nspname and p.tablename=c.relname
  ), '') as policies
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname='marketing_provider_profiles'
  and c.relkind in ('r','p','v','m');
```

## Result

| Check | Result |
|---|---|
| Relation exists | PASS |
| RLS enabled | true |
| FORCE RLS enabled | true |
| anon SELECT privilege | true |
| Public SELECT policy for anon/authenticated | Present |

The inspected policies were:
- `Public can view active marketing providers` — roles anon/authenticated, command SELECT.
- `CRM managers view marketing providers` — authenticated, SELECT.
- `Owners manage their marketing provider profile` — authenticated, ALL.

## Interpretation

The relation's PostgreSQL ACL and RLS policy support the workflow's read-only anon query. This is a DB-side contract check only. It does not prove the deployed PostgREST HTTP request returns 200, that GitHub scheduled jobs are delivered on time, or that failure notifications reach the repository owner.

The monitor uses only the public anon key already present in the frontend config, selects one identifier column with `limit=1`, discards the response body, and issues GET only.

## Remaining verification

- [ ] Observe the first post-merge Production Health Monitor HTTP probe and verify its success.
- [ ] Verify GitHub Actions failure notification delivery.
- [ ] Complete an authorized local backup and disposable restore rehearsal.
- [ ] Measure RPO/RTO.

**Production effect: NONE.** Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.
