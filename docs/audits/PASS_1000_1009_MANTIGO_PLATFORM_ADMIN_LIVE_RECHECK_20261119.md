# MantiGO Platform-Admin Live Recheck — Pass 1000–1009 (2026-11-19)

**Canonical Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Git main checkpoint:** `88ad677a81272bf66c32e2ecacca1a9338b8e570`  
**Evidence mode:** read-only Production SQL/catalog inspection plus source migration and CI review  
**Production mutations:** NONE

## 1. Live membership versus protected platform-admin registry

A read-only aggregate query returned:

| Metric | Live value |
|---|---:|
| Active BUSINESS_OWNER memberships | 9 |
| Distinct users holding active BUSINESS_OWNER memberships | 5 |
| Distinct active BUSINESS_OWNER users absent from `private.platform_admins` | **4** |
| Rows in `private.platform_admins` | 1 |
| Distinct users with any active membership | 15 |

The four non-registry users must not gain platform-wide authority from a tenant-scoped BUSINESS_OWNER role. No user identities were included in this aggregate report.

## 2. Live SECURITY DEFINER authorization state

The following five function contracts were re-read from `pg_proc`:

| Function | SECURITY DEFINER | search_path | anon EXECUTE | authenticated EXECUTE | Finding |
|---|---:|---|---:|---:|---|
| `get_mantigo_admin_dashboard_backend(uuid)` | yes | `public` | no | yes | Still not bound to protected registry helper |
| `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)` | yes | `public` | no | yes | Still not bound to protected registry helper |
| `settle_mantigo_captain_backend(uuid,text,text)` | yes | `public` | no | yes | Still not bound to protected registry helper |
| `expire_stale_mantigo_rides_backend(uuid,integer)` | yes | `public` | no | yes | Still not bound to protected registry helper |
| `mnty_can_platform_admin()` | yes | `public, pg_temp` | no | yes | Delegates to generic `mnty_can('admin',NULL,NULL,NULL)` |

The four global RPCs still reference tenant/business owner authority in their live source and remain a P0 authorization gap. The shared helper still delegates to the generic membership helper rather than checking `private.platform_admins`.

## 3. Financial report schema mismatch — directly revalidated

The live `public.mantigo_financial_ledger` columns include:
- `gross_amount numeric`
- `commission_amount numeric`
- `captain_net_amount numeric`

The live `get_mantigo_admin_financial_report_backend` definition:
- references legacy `amount` and `captain_amount` tokens;
- references `commission_amount`;
- does **not** reference canonical `gross_amount` or `captain_net_amount`.

This is an observed source/schema mismatch. Do not invoke global settlement or expiration operations as a workaround.

## 4. Source-side forward repairs and isolated test evidence

The repository contains forward-only repair candidates:
- RC464 `20261113214500`: canonical registry-backed `mnty_can_platform_admin()`, RLS/ACL/owner preflight, and replacements for the four global MantiGO RPCs.
- RC471 `20261117190000`: reasserts registry-only platform authority, empty search_path, verified actor binding, and canonical ledger columns; preflights four additional helper-dependent global RPC callers.
- RC476 `20261118050000`: repairs captain earnings aggregation to use `gross_amount`, `commission_amount`, and `captain_net_amount`, bound to `auth.uid()`.

Source tests cover tenant OWNER, BUSINESS_OWNER, ADMIN, OPERATIONS_MANAGER, tenant-scoped SUPER_ADMIN, MNTY-PLATFORM membership without registry membership, and registry-only platform administrators. They also test global helper-dependent RPCs, empty search_path, anon ACL denial, settlement idempotency, audit/notification behavior and stale-ride expiration boundaries.

GitHub PR #842's exact-head CI included the `rc471-platform-admin-postgres` check and completed with 28 successful checks and 2 expected skips. This is disposable PostgreSQL/source evidence only; it is **not** evidence that the live Production database has been repaired.

## 5. Release dependency and decision

- RC464, RC471 and RC476 are still absent from the live migration ledger; all 62 required release versions remain missing.
- The source fixes must not be applied independently or out of order.
- Required prerequisites remain: encrypted offsite backup, isolated restore rehearsal, exact migration-alias evidence, chronological 62-version reconciliation, rollback plan, post-migration ACL/function-definition checks and adversarial live verification.
- Do not add the four tenant owners to the platform-admin registry merely to silence the finding. Registry membership is an explicit platform authority decision, not a side effect of tenant ownership.

**Disposition:** MantiGO global admin/finance remains **BLOCKED** in Production. No SQL/DDL/DML, Auth, RLS, GRANT, Edge, payment, wallet, settlement or user data was changed in this pass.
