# PASS 2131–2140 — RC479 / RC488 / RC489 live Production recheck

**Date:** 2026-11-24, approximately 19:15 UTC  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Method:** read-only `pg_policies`, `pg_class`, effective privilege checks and Security Advisor snapshot. No application rows, profile values, financial rows, payment data or Storage object keys were read. No Production mutation was performed.

## 1. Public provider-profile base-table boundary (RC479)

| Property | Live result |
|---|---|
| `public.marketing_provider_profiles` RLS | Enabled |
| FORCE RLS | Enabled |
| Effective `anon SELECT` | **Granted** |
| Effective `authenticated SELECT` | Granted |
| RC479 restrictive policy `marketing_provider_profiles_confirmed_auth_select` | **Absent** |
| Permissive public policy | `Public can view active marketing providers`, roles `anon, authenticated`, condition `status='ACTIVE'` |

The current policy is a direct base-table SELECT policy, not an allowlisted public projection. Because it applies to the whole row, it is materially broader than exposing only a public provider card. The owner-management policy also treats a missing `is_anonymous` claim as non-anonymous through a COALESCE expression.

**Classification:** direct anon SELECT is confirmed by effective table ACL + permissive anon policy; the RC479 restrictive confirmed-identity guard is absent. Public discovery should remain available through approved projections; do not revoke public read routes as a blanket fix. Apply the coordinated RC479 base-table revoke + restrictive policy after source/Edge compatibility testing.

## 2. Storage write boundaries (RC488)

`storage.objects` has RLS enabled; FORCE RLS is disabled. The following RC488 restrictive policies are all absent:

- `storage_objects_confirmed_auth_insert`
- `storage_objects_confirmed_auth_update`
- `storage_objects_confirmed_auth_delete`

The current `mantiqatix-media` INSERT/UPDATE/DELETE policies are permissive and assigned to `authenticated`. Their claim predicates use `COALESCE(auth.jwt()->>'is_anonymous','false') <> 'true'`, so a missing claim passes that predicate. The current profile-media owner INSERT uses `COALESCE((auth.jwt()->>'is_anonymous')::boolean,false)=false`, which also permits a missing claim. Owner UPDATE/DELETE and platform branding write policies do not consistently include an explicit confirmed-identity guard.

The public-read policy on `mantiqatix-profile-media` is intentionally bucket-scoped. Preserve it for approved profile logo/cover display. Legal documents, identity documents and other confidential files must not be stored in this public bucket.

**Classification:** restrictive RC488 write guards are absent; existing permissive writes are not uniformly fail-closed for missing identity claims. This is a source-to-Production gap. It does not, by itself, prove a successful unauthorized upload; the effective row/path and role predicates remain part of the authorization path.

## 3. Financial and payment read boundaries (RC489)

All 15 target tables exist. The restrictive policy `mnty_confirmed_auth_financial_read` is absent from **all 15**.

| Table | anon SELECT | authenticated SELECT | RC489 guard |
|---|---:|---:|---:|
| commission_rules | No | Yes | Absent |
| commission_transactions | No | Yes | Absent |
| general_ledger | No | Yes | Absent |
| journal_entries | No | Yes | Absent |
| journal_entry_lines | No | Yes | Absent |
| payment_events | No | No | Absent |
| payment_financial_reconciliations | No | Yes | Absent |
| payment_intents | No | Yes | Absent |
| payment_provider_events | No | Yes | Absent |
| refund_transactions | No | No | Absent |
| settlement_attempts | No | No | Absent |
| settlement_transactions | No | Yes | Absent |
| subscription_payment_intents | No | Yes | Absent |
| wallet_accounts | No | Yes | Absent |
| wallet_transactions | No | Yes | Absent |

**Classification:** raw `anon` SELECT is denied by ACL on all 15 in this snapshot. Twelve grant SELECT to `authenticated` and have existing permissive finance/membership policy paths; without RC489's restrictive confirmed-identity guard, an Anonymous Auth identity that can satisfy a permissive membership predicate may enter the authenticated role path. Three tables additionally deny authenticated SELECT at the ACL boundary in the current snapshot. This is an exposure path requiring a real identity test in the isolated fixture, not evidence that unauthorized financial rows were read in Production.

## 4. Security Advisor context

The fresh 2026-11-24 Security Advisor snapshot reports:
- 9 RLS-enabled tables with no policies (INFO);
- 1 anon-executable SECURITY DEFINER function (public targeted-ad discovery RPC);
- 65 authenticated-executable SECURITY DEFINER functions;
- multiple anonymous-session policy findings;
- leaked-password protection disabled (WARN).

The anon-executable targeted-ad RPC has an empty search_path and an input limit according to the read-only function snapshot. Its public visibility is an intentional discovery surface requiring its own bounded-input/content review, not a reason for blanket EXECUTE revocation.

Remediation references:
- [Supabase RLS database linter](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [SECURITY DEFINER accessible to anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [SECURITY DEFINER accessible to authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)

## 5. Source/CI versus Production

- RC479, RC488 and RC489 source migrations and isolated test contracts are present in the ordered release chain.
- The exact 81-version gate and 117-migration chronological PostgreSQL 17 replay passed in isolated run `45466369023`.
- These tests do not prove application in Production: the corresponding policy names are absent from the live catalogs.
- Preserve the public provider/catalog projection and profile-media public read; do not apply a blanket revoke or change the public bucket to private as a workaround.

## 6. Next actions

1. Keep Production read-only and retain the current fail-closed directory endpoint.
2. Include RC479 and RC488 → RC489 within the 81-ID coordinated security bundle.
3. Reconcile the exact table/column grants, policy expressions, bucket rules and Storage MIME/path constraints against current frontend and Edge consumers.
4. Test raw anon, Anonymous Auth, missing claim, confirmed user, owner, provider and cross-tenant actors in disposable PostgreSQL/Supabase integration.
5. Before a controlled release: encrypted database + separate Storage export, integrity/hash retrieval, Auth/Vault recovery, independent PostgreSQL 17 restore/rollback, measured RPO/RTO and release-owner approval.
6. After approval, verify deployed-origin negative and positive cases. Preserve public catalog projections and profile image reads only.

**Production impact:** read-only inspection only. No DDL, DML, RLS, GRANT, Auth, Storage, Edge, financial, payment, wallet or customer-data mutation. Full platform remains **BLOCKED / NOT CERTIFIED**.
