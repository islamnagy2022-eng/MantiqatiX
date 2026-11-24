# PASS 2081–2090 — Anonymous Auth Advisor and SECURITY DEFINER Recheck
**Date:** 2026-11-24  
**Production project:** MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu  
**Repository source baseline:** main @ 9e6b8e3e21cd338ce130bc2d6ee9de5051888ece  
**Method:** Supabase Security Advisor plus read-only PostgreSQL catalog, RLS policy, function ACL/search_path and table privilege queries. No row content, user identifiers, secrets or payment data was retrieved.  
**Disposition:** partial matrix advanced; the 90-table anonymous-session reconciliation remains open under Issue #928.

## 1. Fresh Supabase Security Advisor snapshot

| Finding | Result | Interpretation |
|---|---:|---|
| auth_allow_anonymous_sign_ins table/relation warnings | 90 | Advisor warning inventory, not 90 proven leaks. Keep each table's role grants and policy composition in scope. |
| rls_enabled_no_policy | 9 | RLS default-denies all client rows unless explicit policies exist; inspect ACLs before classifying. |
| authenticated_security_definer_function_executable | 65 | Expected for some RPCs; verify each function's guards, EXECUTE grants and search_path. |
| anon_security_definer_function_executable | 1 | Only get_mnty_targeted_advertisements; reviewed below and appears intentionally public. |
| auth_leaked_password_protection | 1 | Leaked-password protection remains disabled; no Auth-setting write performed. |

## 2. The nine RLS-enabled tables without policies

| Relation | anon/authenticated direct access | service_role SELECT/INSERT | Result |
|---|---|---|---|
| public.business_employees | none | none | client-denied |
| public.business_job_positions | none | none | client-denied |
| public.commission_rule_audit | none | none | client-denied |
| public.digital_page_payment_events | none | none | client-denied |
| public.directory_listing_claim_requests | none | yes | backend-only |
| public.directory_source_permission_evidence | none | yes | backend-only |
| public.platform_custom_roles | none | none | client-denied |
| public.platform_role_assignments | none | none | client-denied |
| public.public_directory_listings | none | yes | backend-only |

The 9-table RLS-no-policy INFO finding does not indicate public exposure in this snapshot. All nine deny direct anon and authenticated table privileges; three have backend service_role privileges.

## 3. Exposed SECURITY DEFINER functions

Read-only pg_proc / effective EXECUTE checks found 65 public SECURITY DEFINER functions callable by authenticated:

| search_path classification | Count |
|---|---:|
| Explicit empty path (search_path='') | 18 |
| Other pinned path (public or public, pg_temp) | 47 |
| Unset path | 0 |

No exposed function in this 65-function set had an unset search_path. The 47 non-empty paths remain a hardening/review queue, not 47 proven exploit paths. Source review must confirm object names are schema-qualified, dynamic SQL is safe, caller identity and tenant/business/branch authorization are enforced, and any temp-object risk is excluded before changing the path to empty.

Only one exposed SECURITY DEFINER function is executable by raw anon: get_mnty_targeted_advertisements. It has search_path='' and reads only active, approved advertisement rows, applies geographic/ad-space matching, caps output at 50, and returns public creative/target fields. This is an intentional public ad-discovery RPC in the current contract; do not revoke it without a replacement public route.

## 4. Effective anonymous-policy composition: representative checks

- PostgreSQL combines permissive policies with OR and restrictive policies with AND. A permissive self-owner policy without its own anonymous predicate is not sufficient to conclude a bypass exists or is blocked; the complete command-specific policy set must be evaluated.
- school_profiles and teacher_profiles have permissive owner CRUD policies, but the live snapshot also has three restrictive ALL policies per table that reject is_anonymous=true. The effective restrictive boundary blocks anonymous Auth sessions even though each owner policy does not repeat the guard.
- Finance/payment read policies such as credit_accounts, payment_intents, wallet_accounts and settlement_transactions depend on an active user membership and remain in the negative-test queue. Their presence in the Advisor warning set is not proof that an anonymous session can satisfy the predicate.
- Public discovery tables and ad reads must remain intentionally public where the product contract requires it. A blanket revoke or blanket anonymous guard would break intended catalog, geography and published-page functionality.

## 5. Required next checks

1. Continue Issue #928: reconcile all 90 relations by table, command, effective grants, permissive OR and restrictive AND composition.
2. Execute disposable PostgreSQL 17/JWT negative tests for raw anon, anonymous Auth, confirmed user and owner/member, especially for sensitive writes and finance/payment reads.
3. Review the 47 non-empty SECURITY DEFINER search paths by dependency and source body; prioritize platform-root, catalog, payment, order, MantiGO and settlement RPCs. Do not perform a mass search_path rewrite.
4. Preserve the intentional public targeted-ad RPC and public read surfaces.
5. Keep leaked-password protection as an owner-controlled Auth security task; current connectors did not provide a safe Auth-setting mutation route.

**Safety:** no Production DDL/DML, RLS, grants, Auth settings, Storage, Edge, payment, settlement, directory publication or business data changed. **Production remains BLOCKED / NOT CERTIFIED.**
