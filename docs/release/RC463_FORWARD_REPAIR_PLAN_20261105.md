# RC463 forward-only Production alignment — 2026-11-05

## Live evidence
A read-only check on 2026-11-05 confirmed:
- `public.assign_default_owner_to_unowned_business()` is SECURITY DEFINER, has an enabled trigger on `public.businesses`, and inherits PUBLIC/anon/authenticated/service_role EXECUTE.
- `public.capture_commission_rule_audit()` is SECURITY DEFINER, has an enabled trigger on `public.commission_rules`, and inherits PUBLIC/anon/authenticated/service_role EXECUTE.
- The first function has `search_path=public, auth`; the second already has an empty search_path.
- The intentionally public `get_mnty_targeted_advertisements(...)` has an empty search_path and is explicitly outside this fix.

## Candidate remedy
The historical RC463 migration is already exercised in disposable PostgreSQL CI, but its timestamp predates the latest live migration ledger version (20261101140105). Do not replay that older version directly against Production.

A new monotonic forward-only migration is staged separately as `20261105100000_rc463_trigger_acl_live_forward_repair.sql`. It:
- Requires both existing trigger functions and their exact enabled triggers.
- Pins both functions to an empty search_path.
- Revokes direct EXECUTE from PUBLIC, anon, authenticated, and service_role.
- Verifies the two triggers remain attached/enabled and the API roles cannot execute the functions.

## Release boundary
- No Production schema, ACL, Auth, data, Edge Function, or payment change has been applied by this candidate.
- The candidate must pass the exact migration replay and trigger behavior integration before merge.
- It must be applied only through the approved forward migration plan, after a restorable backup and rollback rehearsal.
- This repair closes only the two trigger-function ACL findings. It does not certify the other RLS, payment, finance, Auth, or disaster-recovery gates.
