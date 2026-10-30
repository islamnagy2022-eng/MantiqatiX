# MantiqaTix — RLS, Anonymous JWT and SECURITY DEFINER Review

**Observed:** 2026-10-30, 05:18–05:22 UTC  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only Supabase Security Advisor, pg_policies, pg_class/ACL, pg_proc and pg_trigger inspection.  
**Production writes:** none.

## Executive summary

The latest Supabase Security Advisor snapshot reports:
- 90 `auth_allow_anonymous_sign_ins` findings across tables/storage policies.
- 67 SECURITY DEFINER functions executable by `authenticated`.
- 3 SECURITY DEFINER functions executable by `anon`.
- 8 RLS-enabled tables with no policies (INFO).
- Leaked Password Protection disabled (WARN).

These findings require policy/function review, but they are not 160 confirmed vulnerabilities. Supabase anonymous Auth sessions use the `authenticated` Postgres role, so the advisor flags any policy that permits this role even if the policy also requires an owned row, a verified `auth.uid()`, or an active tenant membership. No broad policy revocation or mass ACL change is justified from advisor counts alone.

## 1. RLS and anonymous JWT inventory

Read-only policy inventory:
- 483 policies target `authenticated`.
- 283 explicitly reference `is_anonymous` in `qual` or `with_check`.
- 200 do not textually reference `is_anonymous`.
- 215 policies reference `auth.uid()`.
- 103 policies reference `user_memberships`.
- 10 policies contain an explicit `false` condition.

These categories overlap and are text-level indicators, not proofs of authorization correctness. Policies that omit `is_anonymous` may still be safe because they bind a row to `auth.uid()`, require an active membership, or explicitly deny access through another restrictive policy. Conversely, the mere presence of `auth.uid()` is not enough to certify a sensitive policy.

### Highest-priority anonymous-JWT test surfaces

The advisor's 90 table findings include financial and high-sensitivity domains such as:
- `payment_intents`, `payment_events`, `payment_provider_events`, `payment_financial_reconciliations`;
- `journal_entries`, `journal_entry_lines`, `general_ledger`;
- `wallet_accounts`, `wallet_transactions`, `settlement_attempts`, `settlement_transactions`, `refund_transactions`;
- `subscription_payment_intents`, `business_subscriptions`;
- `notifications`, `support_tickets`, `ticket_messages`, `marketing_leads`, `matrimony_profiles`, `medical_appointments`.

The presence of a finding only means a policy targets `authenticated`; it does not establish that an anonymous session can satisfy the row predicate. Each sensitive policy must be tested with a real anonymous JWT in an isolated database.

### Eight RLS-enabled tables without policies

The Advisor reports:
1. `business_employees`
2. `business_job_positions`
3. `commission_rule_audit`
4. `digital_page_payment_events`
5. `directory_listing_claim_requests`
6. `platform_custom_roles`
7. `platform_role_assignments`
8. `public_directory_listings`

The live ACL inventory showed:
- None of the eight grants direct SELECT/INSERT/UPDATE/DELETE to `anon` or `authenticated`.
- Six also have no direct table privileges for `service_role`.
- `directory_listing_claim_requests` and `public_directory_listings` grant table privileges to `service_role` only; both have FORCE RLS and service-role bypass semantics.
- `digital_page_payment_events` does not FORCE RLS, but no API role has direct table privileges.
- The no-policy condition therefore appears consistent with backend-only access for the observed ACLs; confirm all intended service-role/SECURITY DEFINER call paths and do not add broad client policies merely to silence INFO findings.

## 2. SECURITY DEFINER functions

### Anonymous-executable functions (3)

- `assign_default_owner_to_unowned_business()`: a trigger function attached to an AFTER INSERT constraint trigger on `businesses`. The live `businesses` table denies INSERT to both `anon` and `authenticated`; the function returns `trigger` and is not a normal RPC callable as a standalone function. The advisor warning is a trigger-function false positive for direct RPC reachability in the observed grants. Keep the trigger behavior under review because it runs with definer privileges.
- `capture_commission_rule_audit()`: a trigger function attached to the `commission_rules` audit trigger; it is not a normal standalone RPC. Treat the advisor warning as a trigger-function false positive for direct RPC reachability, while reviewing trigger ownership and audit integrity.
- `get_mnty_targeted_advertisements(...)`: an intentionally public, read-only advertisement lookup. Its function body selects only active/approved ads, clamps the requested limit to 1–50, and uses an empty search_path with schema-qualified objects. This is the only one of the three that is an ordinary public callable function; confirm its public response fields are intended.

### Authenticated-executable functions (67)

A source-level inventory of the 67 Advisor functions found:
- 60 reference `auth.uid()` directly.
- 27 reference `user_memberships` directly.
- 23 explicitly compare a caller-supplied actor/admin ID with `auth.uid()`.
- 37 set an empty search_path or an explicit path ending in `pg_temp` (one trigger helper uses `public, auth`).
- 30 set `search_path=public` only.

These counts overlap. Several functions delegate authorization to reviewed helpers, including:
- `mnty_can` → `mnty_active_membership` (the helper binds membership to `auth.uid()`);
- `mnty_business_employee_list` → `mnty_business_employee_list_scoped` (the scoped function rejects anonymous sessions and checks business/branch role scope);
- `preview_commission_backend` → `assert_financial_membership` (requires authenticated finance-capable tenant membership);
- `upsert_catalog_item_and_price_backend` → item/price functions that validate `auth.uid()` and active scoped membership.

A static pass over the 30 `search_path=public` functions found no unqualified references to public table names in their function bodies. The `public` schema has no CREATE privilege for `anon` or `authenticated`; both roles do have TEMP privilege. This lowers one attack path but does not replace a function-by-function review of unqualified types/functions and temp-object shadowing. Treat the 30 functions as a hardening/review queue, not as confirmed exploits.

### Required SECURITY DEFINER review

For every function, record:
- exact caller(s) and why `authenticated` needs EXECUTE;
- whether actor identity is taken from `auth.uid()` or safely verified by an Edge Function;
- tenant/business/branch/organization membership checks;
- function owner, ACL, `SECURITY DEFINER`, and `search_path`;
- whether every relation/function/type reference is schema-qualified or protected from temp shadowing;
- whether the function is a trigger helper rather than a callable RPC;
- adversarial tests for wrong actor, wrong tenant, wrong business/branch, anonymous JWT, and replay.

Do not revoke EXECUTE across all 67 functions. First trace every frontend/Edge/RPC caller and run regression tests, then apply narrowly scoped ACL/search_path fixes.

## 3. Authentication hardening

The Advisor reports Leaked Password Protection disabled. Enable it through the approved Supabase Auth configuration process, then test signup, password change/reset and login flows. No Auth setting was changed during this audit.

## 4. Required isolated tests

1. Use a restorable isolated database with the current production schema and sanitized data.
2. Create an anonymous Auth user/JWT in that isolated environment only.
3. Attempt SELECT/INSERT/UPDATE/DELETE on the sensitive tables above; verify anonymous users cannot read/write other users' or tenant data.
4. Repeat with authenticated users lacking membership, with membership in another tenant, another business, and another branch.
5. Exercise the three anon-executable SECURITY DEFINER functions, including proving trigger-only functions cannot be invoked as RPCs and that business creation is denied to anon/authenticated.
6. Test SECURITY DEFINER search-path hardening with temp-object shadow attempts for every function that uses `search_path=public`.
7. Verify backend-only tables remain inaccessible through direct REST while their intended server-side workflows still work.
8. Re-run Security Advisor and record remaining intentional findings with owner, rationale and expiry/review date.

## 5. Release decision and non-actions

**Security gate: BLOCKED / NOT CERTIFIED.**

The current inventory did not prove an anonymous data leak. It did identify a broad set of policies and privileged functions that require adversarial tests before certification. No RLS policy, table grant, function ACL, function body, Auth configuration, migration, secret, or production data was changed.

## Official remediation references

- RLS enabled without policies: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Anonymous SECURITY DEFINER execution: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Authenticated SECURITY DEFINER execution: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Anonymous Auth/RLS policies: https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins
- Leaked Password Protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection


### Table-level cross-check

A second catalog query found 126 public tables with at least one policy targeting `authenticated`. Of these, 71 have a RESTRICTIVE policy that explicitly checks `is_anonymous`; 55 do not have that particular table-wide restrictive guard. This is not a count of vulnerable tables: a number of the latter tables have explicit anonymous checks in their own permissive policy predicates, while others bind access to `auth.uid()` or active tenant membership. For example, payment and ledger read policies require an active membership with a finance-capable role; owner-read policies bind the row to the session UID; public catalog/read policies intentionally expose only active/published content. These still require isolated JWT tests, especially because policy composition and helper functions affect the final decision.
