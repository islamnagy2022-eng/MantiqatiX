# Pass 761–780 — PostgreSQL 17 public-schema default ACL audit

Date: 2026-11-18  
Production project: `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
PostgreSQL: 17.6  
Method: read-only catalog and privilege queries only

## Findings

### Effective API-role table ACLs

Current effective ACL snapshot for public relations (`r/p/v/m`):

| Role | Privilege | Relation count |
|---|---|---:|
| anon | MAINTAIN | 91 |
| anon | REFERENCES | 5 |
| anon | TRIGGER | 5 |
| anon | TRUNCATE | 5 |
| anon | SELECT | 8 |
| authenticated | MAINTAIN | 108 |
| authenticated | REFERENCES | 6 |
| authenticated | TRIGGER | 6 |
| authenticated | TRUNCATE | 6 |
| authenticated | DELETE | 17 |
| authenticated | INSERT | 23 |
| authenticated | SELECT | 77 |
| authenticated | UPDATE | 22 |

These are privilege counts, not counts of exploitable endpoints. PostgREST does not expose arbitrary SQL utility statements; this catalog evidence alone does not prove that an anonymous caller can execute `TRUNCATE`, `MAINTAIN`, or `TRIGGER` operations through the Data API.

The five relations where `anon` currently has `TRUNCATE`, `TRIGGER`, and `REFERENCES` are:

- `public.digital_page_products`
- `public.mantigo_captain_profiles`
- `public.mantigo_financial_ledger`
- `public.medical_appointments`
- `public.platform_brand_assets`

For these five, the read-only check showed anon has no SELECT, INSERT, UPDATE, or DELETE. RLS is enabled on all five; FORCE RLS is enabled on `medical_appointments` only. These non-DML privileges are still unnecessary for ordinary anonymous API clients and need provenance/compatibility review.

### Default ACLs for future public tables

The `pg_default_acl` catalog currently contains table defaults (`defaclobjtype='r'`) for:

- Owner role `postgres`, schema `public`: `anon`, `authenticated`, and `service_role` receive `MAINTAIN`, `REFERENCES`, `TRIGGER`, and `TRUNCATE` by default.
- Owner role `supabase_admin`, schema `public`: `anon`, `authenticated`, `postgres`, and `service_role` receive all table privileges by default.

All 138 inspected public relations are currently owned by `postgres`. The provenance of the `supabase_admin` defaults and the operational paths that create tables under each owner still require verification. Do not assume every future migration uses the same role.

### Relation to RC479

RC479's single statement `REVOKE SELECT ON TABLE public.marketing_provider_profiles FROM anon;` is appropriately narrow for the confirmed provider-profile SELECT exposure. It does not remediate unrelated `MAINTAIN`/DDL-related privileges or default ACLs. Do not broaden RC479 without a separate migration and compatibility review.

## Required remediation sequence

1. Establish provenance and intended semantics of both owner roles' default ACLs, including actual migration/DDL execution roles.
2. Identify whether each non-DML privilege is required by Supabase-managed tooling or any approved backend path.
3. Build a disposable PostgreSQL 17 fixture that reproduces both default ACL owners and the five existing relation grants.
4. Test new table creation, existing table ACLs, RLS/FORCE RLS, PostgREST-visible operations, RPC execution, and service-role/owner maintenance.
5. Prepare only a narrow forward-only default-privilege repair for the verified migration owner; do not revoke SELECT/DML indiscriminately.
6. Add CI checks that fail when newly created public tables grant unnecessary privileges to API roles.
7. Verify exact effective privileges after migration in a disposable environment before considering the chronological Production release.

## Safety boundary

Read-only Production inspection only. No SQL write, migration, grant, RLS, Auth, Edge, payment, wallet, settlement, or Pages deployment occurred. No application rows or private profile values were selected. Issue: [#811](https://github.com/islamnagy2022-eng/MantiqaTix/issues/811).

Production remains **BLOCKED / NOT CERTIFIED** pending the complete migration reconciliation, encrypted backup/restore rehearsal, security validation, and release approval.
