# RC96 — G2 Authentication, Membership & RBAC Security Baseline

Date: 2026-09-28

## Source implementation verified

### Authentication
- Production web authentication uses Supabase Email OTP.
- OTP verification creates/validates a session before entering the application.
- The application checks the current authenticated user before loading operational data.
- Explicit logout clears local membership/role state and signs out the Supabase session.
- The auth validation script rejects password-auth usage in the SMM path and rejects automatic sign-out during boot.

### Membership authority
- The website reads active memberships from `user_memberships` for the authenticated user.
- The UI does not directly INSERT, UPDATE, or DELETE `user_memberships`.
- Active role switching is limited to memberships actually returned for the authenticated user.
- The selected membership supplies tenant/business/branch context to the UI.
- The owner role-switch migration creates operational contexts but intentionally excludes `SUPER_ADMIN`.

### Registration authority
- Self-registration accepts only `CUSTOMER` and `SERVICE_PROVIDER`.
- Registration creates a PENDING request rather than directly granting operational membership.
- Duplicate pending/approved requests are checked.
- Registration review is performed through the `mnty-registration-review` Edge Function.
- The UI limits review actions to `SUPER_ADMIN`, `ADMIN`, and `OWNER`.

## Production database evidence

Current policies inspected on 2026-09-28:
- `user_memberships`: authenticated users have a self-select policy only.
- `account_registration_requests`: self-insert is restricted to the authenticated user's own `user_id` and PENDING status.
- Registration review SELECT is restricted to active SUPER_ADMIN/OWNER/ADMIN memberships.
- No direct membership mutation policy was found in the inspected policies.

## Security findings still open

These are not silently marked fixed:
- Supabase Auth leaked-password protection remains disabled.
- Supabase advisor reports `pg_net` in the public schema.
- One SECURITY DEFINER payment RPC is executable by authenticated users; its current design contains server-side identity/ownership/tenant/state checks, but the advisor warning remains open.
- Several legacy RLS policies permit anonymous role evaluation; each requires contextual review before changing because some are deliberate/public-read paths.
- Real two-user/two-tenant E2E authorization is still NOT VERIFIED.
- External browser OTP/session/expiry/logout testing is still NOT VERIFIED.

## G2 status

Implementation baseline: **DONE**
Security source review: **DONE**
Database policy review: **DONE**
External E2E verification: **NOT VERIFIED**

Therefore G2 is **NOT VERIFIED** yet.
