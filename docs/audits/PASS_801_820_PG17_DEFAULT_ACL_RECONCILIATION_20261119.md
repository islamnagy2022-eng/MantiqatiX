# Pass 801–820 — PostgreSQL 17 default ACL reconciliation (2026-11-19)

**Current main after integration:** `44fc352b7082625fee1165f9779fa05f50a678c1`  
**PR #819:** merged as `44fc352b7082625fee1165f9779fa05f50a678c1`.  
**Production:** read-only; no SQL, ACL, Auth, RLS, Edge, payment or data mutation.

## 1. Source integration and CI

- PR #819 added `supabase/tests/pg17_default_acl_owner_scope_regression.sql` and `.github/workflows/pg17-default-acl-owner-scope.yml`.
- The isolated PostgreSQL 17 fixture reproduces separate `postgres` and `supabase_admin` defaults, tests the narrow candidate revoke for the `postgres` owner only, confirms pre-existing relation ACLs remain unchanged, and confirms the separate `supabase_admin` defaults remain unchanged.
- Exact-head workflow run [44422319909](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44422319909): **PASS**.
- Same-head validation also passed: RC479 provider profile, RC480 digital-page anonymous columns, RC481 legal Edge service-role ACL, RC482 legal platform-admin registry, RC483 legal CMS atomic create/audit, RC471 platform-admin PostgreSQL, targeted-ad search path, matrimony privacy, MantiGO open-ride privacy, Paymob atomicity, financial journal RC450, approval-action audit, and static validation.
- The Pages PR validation passed but the PR deploy job was correctly skipped. This PR did not deploy the site.
- PR #819 is merged; main now contains the test and workflow. No production migration was created.

## 2. Fresh read-only Production snapshot

Project: `moyhiluyhjsujhwlyeuu`; PostgreSQL 17.6.

- Migration ledger: 310 rows; latest recorded version `20261110150618`.
- Public ordinary/partitioned relations: 137; all 137 are owned by `postgres` in this snapshot.
- `pg_default_acl` for `postgres` / `public` / tables: grants `MAINTAIN`, `REFERENCES`, `TRIGGER`, and `TRUNCATE` to `anon`, `authenticated`, and `service_role`. The grantor shown by `aclexplode` is `postgres`.
- `pg_default_acl` for `supabase_admin` / `public` / tables: grants all table privileges to `anon`, `authenticated`, `postgres`, and `service_role`. The grantor shown is `supabase_admin`.
- `supabase_admin` is a superuser/login role in the inspected catalog. The inspected role-membership rows show no direct membership edge involving `supabase_admin`; this is not evidence of the historical origin or intended lifecycle of its default ACL.
- Because all 137 existing public relations are owned by `postgres`, the `supabase_admin` default ACL does not explain the current owner of those existing relations. It remains a separate future-object/managed-role contract and must not be changed without Supabase-specific confirmation.
- Default ACL grantor identity matches the owner role. PostgreSQL catalogs do not establish when, by whom operationally, or why these defaults were originally configured. Provenance remains **unresolved**.

### Refreshed effective privileges

Counts below are current catalog privilege checks across 137 public relations. The previous issue snapshot showed 91 anon and 108 authenticated MAINTAIN relations; the refreshed read returned 90 and 107 respectively. Do not treat older counts as current.

| Role | MAINTAIN | REFERENCES | TRIGGER | TRUNCATE | SELECT | INSERT | UPDATE | DELETE |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| anon | 90 | 5 | 5 | 5 | 8 | 0 | 0 | 0 |
| authenticated | 107 | 6 | 6 | 6 | 77 | 23 | 22 | 17 |
| service_role | 137 | 137 | 137 | 137 | 63 | 45 | 44 | 48 |

The five relations with anon REFERENCES/TRIGGER/TRUNCATE are `digital_page_products`, `mantigo_captain_profiles`, `mantigo_financial_ledger`, `medical_appointments`, and `platform_brand_assets`. Authenticated has the same five plus `digital_page_orders`.

Anon SELECT is present on eight relations: `digital_page_sections`, `digital_pages`, `legal_document_versions`, `legal_documents`, `marketing_provider_profiles`, `marketing_provider_services`, `marketing_services`, and `platform_geo_areas`. This is a privilege inventory, not proof that every row is readable; RLS policy behavior remains a separate gate.

## 3. Interpretation and guardrails

- The observed PostgreSQL table privileges are not, by themselves, proof of an exploitable path through the Supabase Data API. PostgREST does not expose arbitrary SQL utility commands such as `TRUNCATE`, `CREATE TRIGGER`, `ALTER TABLE`, or `VACUUM` as ordinary table REST operations.
- The effective privileges still violate least-privilege expectations and must be reconciled with exact API/RPC call paths, RLS/FORCE RLS, SECURITY DEFINER ownership, and managed Supabase role behavior.
- Do not blanket-revoke authenticated DML, service-role access, or the separate `supabase_admin` defaults.
- Do not apply `ALTER DEFAULT PRIVILEGES`, relation `REVOKE`, or any production ACL mutation ad hoc.
- The narrow `postgres` owner repair in the test is a candidate semantics check only. It is not approved as a Production migration until owner/provisioning provenance and Supabase compatibility are independently confirmed.
- The fixture does not yet prove a complete PostgREST/RPC call-path matrix for all 137 relations. That remains open.

## 4. Remaining work

1. Obtain authoritative Supabase confirmation for the intended `postgres` and `supabase_admin` default ACL contracts and migration execution role.
2. Reconcile the five anon non-DML grants, six authenticated non-DML grants, all MAINTAIN grants, and service-role operational privileges against exact call paths and policy coverage.
3. Add disposable tests for PostgREST-invocable RPC boundaries, RLS/FORCE RLS, service-role maintenance flows, and future-table creation under each owner.
4. Keep reconciling the full ordered migration chain against the 310-row live ledger.
5. Obtain encrypted off-site backup and isolated restore rehearsal with measured RPO/RTO before any production rollout.
6. Continue the SECURITY DEFINER direct-auth, tenant/business/branch authorization, and live Edge parity reviews.

**Disposition:** PR #819 MERGED; PostgreSQL 17 owner-specific default ACL regression PASS; Production ACL repair NOT APPROVED; full Production release remains **BLOCKED / NOT CERTIFIED**.
