# RC257 Security Definer Access Review

Date: 2026-10-02

## Live Production evidence

Direct PostgreSQL inspection of public SECURITY DEFINER functions found:

- No SECURITY DEFINER function without an explicit `search_path` configuration.
- The authenticated-executable exceptions are limited to workflow-specific functions and are not anonymous-executable, except the intentionally public advertisement delivery function.
- Sensitive backend/financial/refund/settlement functions inspected in the live ACL snapshot are not executable by `anon`.
- `get_mnty_targeted_advertisements` is executable by `anon` and `authenticated` by design for public advertisement delivery.
- `create_payment_intent_backend` is executable by `authenticated` by design for the user-scoped payment path; its authorization and authoritative pricing checks are implemented at the database/Edge Function boundary.
- Functions using an explicitly empty quoted search_path are present in the live database for selected legal/subscription/Mantigo/payment workflows. They are not missing a search_path setting.

## Database baseline

- public base tables: 123
- RLS enabled: 123/123
- RLS disabled: 0
- tables without primary key: 0

## Decision

No blanket ACL revocation or SECURITY DEFINER rewrite is justified by this inspection. Changes to these functions must preserve their documented caller contract and must be followed by a fresh privilege inspection.
