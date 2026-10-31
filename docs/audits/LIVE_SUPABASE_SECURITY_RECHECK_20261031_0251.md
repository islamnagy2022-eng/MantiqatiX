# Live Supabase security recheck — 2026-10-31 02:51 UTC

## Scope and safety

Read-only Supabase Security Advisor and Performance Advisor snapshots, plus read-only PostgreSQL catalog/privilege queries against the existing Production project. No business rows were read. No SQL mutation, migration, grant, policy, Auth setting, Edge Function, payment, or ledger change was performed.

Project: moyhiluyhjsujhwlyeuu (status observed ACTIVE_HEALTHY, PostgreSQL 17.6.1.155, region us-east-2).

## Advisor snapshot

Observed at 2026-10-31T02:51:13.132Z:

### Security

| Finding | Count | Level |
|---|---:|---|
| RLS enabled, no policy | 8 | INFO |
| anon-executable SECURITY DEFINER | 3 | WARN |
| authenticated-executable SECURITY DEFINER | 67 | WARN |
| Anonymous-sign-in-related policy findings | 90 | WARN |
| Leaked password protection disabled | 1 | WARN |

The 90 anonymous-sign-in-related findings are not evidence of 90 direct anon table grants. Treat them as Advisor findings associated with anonymous sign-in mode and policy roles; do not bulk-rewrite policies from the count alone.

### Performance

| Finding | Count | Level |
|---|---:|---|
| Unindexed foreign keys | 129 | INFO |
| Auth/RLS init-plan findings | 375 | WARN |
| Unused indexes | 73 | INFO |
| Multiple permissive policy groups | 28 | WARN |

These counts are triage signals, not authorization to add/drop indexes or rewrite policies without query-plan, workload, and caller evidence.

## Eight RLS-enabled/no-policy tables — direct privilege check

The following eight tables were checked individually through PostgreSQL catalog metadata. All have RLS enabled and zero policies. None grants SELECT, INSERT, UPDATE, or DELETE directly to anon or authenticated.

| Table | RLS | FORCE RLS | anon/authenticated direct DML | service_role direct SELECT/INSERT/UPDATE/DELETE |
|---|---|---|---|---|
| business_employees | on | on | none | none |
| business_job_positions | on | on | none | none |
| commission_rule_audit | on | on | none | none |
| digital_page_payment_events | on | **off** | none | none |
| directory_listing_claim_requests | on | on | none | all four |
| platform_custom_roles | on | on | none | none |
| platform_role_assignments | on | on | none | none |
| public_directory_listings | on | on | none | all four |

service_role has TRUNCATE on all eight tables. This is a privileged backend role and must remain secret; this snapshot does not authorize granting it to any client. digital_page_payment_events is the only table in this set without FORCE RLS. Because the three client roles checked have no direct DML privileges, this is recorded as a configuration variance requiring owner/trigger-path review, not as proof of an exposed client path.

The two service-role-only DML tables are consistent with a backend-mediated design in this check. Do not add client policies or grants as a blanket fix.

## Three anon-executable SECURITY DEFINER functions

All three also report authenticated EXECUTE. Read-only metadata showed:

| Function | Return type | Owner | anon/authenticated EXECUTE | Trigger bindings | search_path |
|---|---|---|---|---:|---|
| assign_default_owner_to_unowned_business() | trigger | postgres | yes | 1 | public, auth |
| capture_commission_rule_audit() | trigger | postgres | yes | 1 | empty |
| get_mnty_targeted_advertisements(...) | table | postgres | yes | 0 | empty |

The first two are trigger-returning functions with one trigger binding each; they are not ordinary RPC return types. The targeted-ad function is the only one of these three with a table result and no trigger binding. Its public execution is an intentional read path that still requires its function-body/argument/output review.

The assign_default_owner_to_unowned_business trigger helper retains search_path=public, auth. The repository contains an isolated PostgreSQL test showing that empty search_path plus revoking direct EXECUTE from PUBLIC/anon/authenticated/service_role can preserve trigger execution, but that test is not evidence that Production has been changed. Review and rehearse the exact forward-only migration with trigger regression tests before any production change.

## Required actions

1. Keep all eight no-policy tables deny-by-default; do not add broad policies or grants.
2. Review the one FORCE RLS variance on digital_page_payment_events against its exact trigger/SECURITY DEFINER writer contract.
3. Rehearse the trigger-only helper hardening (including assign_default_owner_to_unowned_business) on a restorable, schema-faithful isolated database before proposing Production ACL/search_path changes.
4. Review the 67 authenticated-executable SECURITY DEFINER functions individually, prioritizing actor binding, tenant scope, search_path, and caller exposure. No bulk revocation.
5. Obtain owner-side confirmation for Leaked Password Protection and anonymous sign-in product requirements before changing managed Auth settings.
6. Triage performance findings by actual query plans and workload; do not mass-create or drop indexes.

## Conclusion

No direct anon/authenticated DML privileges were found on the eight no-policy tables in this read-only check. One trigger-only SECURITY DEFINER function still uses search_path=public, auth, and one table in the no-policy set does not have FORCE RLS. These are tracked as targeted review items, not silently altered. Overall Production Gate remains BLOCKED / NOT CERTIFIED.
