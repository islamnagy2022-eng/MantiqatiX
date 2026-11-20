# Pass 1470–1479 — SMM first-user admin bootstrap trigger review

**Date:** 2026-11-20  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only `auth.users` trigger, function definition/owner/search_path/ACL, table RLS/grant metadata, and aggregate `smm_admins` existence/count query. No identities or application rows selected. No function invoked. No Production mutation.

## 1. Live Auth-user triggers

The Production `auth.users` table has two relevant triggers:

1. `on_mnty_auth_user_created_customer_membership` calls `private.handle_auth_user_customer_membership()`. Its body explicitly returns early when `NEW.is_anonymous=true`; this customer-membership trigger rejects anonymous sessions before provisioning membership.
2. `trg_smm_bootstrap_admin` calls `public.smm_bootstrap_first_admin()`. Its body is:

```sql
begin
  if not exists(select 1 from public.smm_admins) then
    insert into public.smm_admins(user_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end;
```

Unlike the customer-membership trigger, it does not check `NEW.is_anonymous` and does not require a pre-authorized bootstrap identity.

## 2. Function and table security metadata

- `public.smm_bootstrap_first_admin()` is a trigger-returning function, owned by `postgres`, `SECURITY DEFINER`, configured with `search_path=public`.
- Effective EXECUTE for `anon`, `authenticated`, and `service_role` is false; it is trigger-only in the observed ACL.
- The function is not found by current-main source search under its exact name; the live trigger/function therefore needs source/ledger provenance reconciliation.
- `public.smm_admins` has RLS enabled, FORCE RLS disabled, owner `postgres`, and no direct SELECT grants to `anon`, `authenticated`, or `service_role`.
- An aggregate-only query found one row in `smm_admins`. No user ID or row data was selected.

## 3. Risk and current mitigation

The trigger is dormant while the table contains an SMM admin row. If the table becomes empty, the next Auth user inserted becomes the SMM admin, regardless of whether the new account is anonymous or an ordinary public signup. If anonymous Auth is enabled, an anonymous account may be inserted into the SMM admin allowlist and could potentially retain that user ID when it links a permanent identity. The live SMM gateway currently has an explicit deferred-launch gate and rejects anonymous users, which is a compensating control but not a justification for first-user-wins bootstrap.

This is a conditional privilege-bootstrap flaw, not evidence of current unauthorized SMM administration or exploitation. The observed one-row state means the trigger's first-user branch is not currently active.

The function also uses `search_path=public` and an unqualified table reference. Harden to an empty search path and fully qualified names as part of the forward repair.

## 4. Required forward-only correction

P1 Issue **#933** tracks this finding.

- Remove the implicit first-Auth-user-wins admin bootstrap.
- Require a one-time trusted server-held bootstrap secret or an explicitly pre-authorized user ID, not public signup order.
- Explicitly reject `NEW.is_anonymous`.
- Use `SECURITY DEFINER SET search_path=''` and schema-qualify `public.smm_admins`.
- Keep trigger-only execution and no direct client table grants.
- Add disposable PostgreSQL tests:
  - first anonymous Auth user does not enter `smm_admins`;
  - first ordinary public signup does not enter `smm_admins`;
  - explicitly authorized bootstrap succeeds exactly once;
  - subsequent Auth users cannot become SMM admin;
  - a linked anonymous identity does not inherit platform/SMM admin;
  - existing SMM admin access and RC456 least-privilege service-role contract remain intact.
- Reconcile the exact live function against source and migration history before deployment.

## 5. Safety and disposition

No user IDs, emails, phone numbers, memberships, SMM provider credentials, wallet rows or order data were selected. No trigger/function was invoked. No Production DDL/DML, GRANT, RLS, Auth, Storage, Edge, payment, wallet or deployment mutation occurred.

**Status:** source/live trigger risk confirmed; currently dormant while one SMM admin row exists; forward repair pending. Production remains **BLOCKED / NOT CERTIFIED**.
