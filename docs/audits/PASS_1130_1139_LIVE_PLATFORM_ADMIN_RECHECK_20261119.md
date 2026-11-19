# Pass 1130–1139 — Live platform-admin helper and dependent RLS recheck

**Date:** 2026-11-19  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only catalog/ACL inspection and aggregate role/registry counts.  
**Production mutations:** none.

## 1. Shared helper — current live definition

The live definition remains:

```sql
CREATE OR REPLACE FUNCTION public.mnty_can_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.mnty_can('admin',null,null,null)
$function$;
```

Effective EXECUTE:
- `anon`: false
- `authenticated`: true
- `service_role`: false

This remains a global authorization boundary because the helper delegates platform-wide scope to a generic null-scope tenant permission helper.

## 2. Direct SECURITY DEFINER callers

| Function | SECURITY DEFINER | search_path | anon EXECUTE | authenticated EXECUTE |
|---|---:|---|---:|---:|
| `admin_create_global_ad(varchar,text,text,timestamptz,timestamptz)` | Yes | `public, pg_temp` | No | Yes |
| `fulfill_digital_page_publish(uuid,uuid,uuid)` | Yes | `public, pg_temp` | No | Yes |
| `review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)` | Yes | `public` | No | Yes |
| `set_mantigo_financial_config_backend(uuid,numeric,text)` | Yes | `public` | No | Yes |

## 3. Dependent RLS policies

Five policies still reference the helper:

| Table | Policy | Command |
|---|---|---|
| `public.digital_pages` | `digital_pages_admin_manage` | ALL |
| `public.mantigo_financial_config` | `mantigo_financial_config_admin_select` | SELECT |
| `public.mantigo_financial_config` | `mantigo_financial_config_admin_update` | UPDATE |
| `public.mantigo_rate_limit_config` | `mantigo_rate_limit_config_admin_select` | SELECT |
| `public.mantigo_rate_limit_config` | `mantigo_rate_limit_config_admin_update` | UPDATE |

## 4. Aggregate-only active role/registry count refresh

| Role | Active membership rows | Distinct active users | Distinct active users absent from platform registry |
|---|---:|---:|---:|
| ADMIN | 1 | 1 | 0 |
| BUSINESS_OWNER | 9 | 5 | 4 |
| OWNER | 3 | 1 | 0 |
| SUPER_ADMIN | 1 | 1 | 0 |

This supersedes the earlier PR #772 snapshot of 3 non-registry BUSINESS_OWNER users across 6 active rows. The current query found 4 distinct non-registry BUSINESS_OWNER users across 9 active rows. The one active OWNER is present in the registry; no non-registry OWNER or ADMIN appeared in this aggregate. No user identifiers were selected. These counts do not prove invocation or abuse.

## 5. Source-side test evidence — not a Production rollout

- RC464 dedicated PostgreSQL workflow run `43596176271`: SUCCESS.
- RC471 dedicated PostgreSQL workflow run `44213092970`: SUCCESS.
- PR #772 exact head `a0c0f50d936678babea96320ff739e6d22c8653e`: 23 SUCCESS, 2 expected SKIPPED (deploy/public-only), 0 failures. Tests include synthetic BUSINESS_OWNER denial for the four global MantiGO RPCs and all four direct shared-helper callers.

The migrations and tests exist in source and pass disposable PostgreSQL coverage. The Production helper is still unchanged, so those CI results are not evidence of live remediation.

## 6. Required next steps

1. Preserve the 63-version migration identities and finish exact dependency/effect reconciliation.
2. Obtain an encrypted off-site backup and complete an isolated restore rehearsal with measured RPO/RTO and rollback evidence.
3. Replay the full chronological migration chain in disposable PostgreSQL 17 and rerun RC464/RC471, tenant-isolation, payment and finance contracts.
4. Apply RC464/RC471 only through the approved coordinated release.
5. Re-read the live helper, four direct callers, five policies, ACLs and `search_path`.
6. Adversarially verify tenant OWNER/BUSINESS_OWNER/ADMIN/OPERATIONS_MANAGER and membership-only SUPER_ADMIN are denied; registry-only platform admins succeed.
7. Keep platform-wide admin, MantiGO financial operations and digital-page fulfillment blocked until the live post-migration evidence passes.

**Status:** P0 remains open in Issue #852. Full platform remains **BLOCKED / NOT CERTIFIED**.
