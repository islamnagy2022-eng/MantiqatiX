# RC90 — Role Context UI Hardening and CI Closure

Date: 2026-09-28

## Scope
Harden the web role-switching UI without changing authorization authority.

## Changes
- Role selector now exposes only ACTIVE memberships.
- Duplicate role/context options are collapsed by role + tenant + business + branch.
- Role labels use the real membership role and avoid displaying raw tenant IDs as the primary label.
- Removed the obsolete customer-return control.
- Added rollback of the in-memory/localStorage role context if rendering the selected context fails.
- Updated the auth-flow invariant validator to match the real role-switching contract.

## Security boundary
The browser does not gain membership mutation authority from this change.
Production user_memberships was verified to have:
- authenticated: SELECT only.
- service_role: INSERT/UPDATE/DELETE/SELECT and infrastructure privileges.
- RLS policy memberships_select_self: authenticated users may SELECT only rows where auth.uid() = user_id and anonymous sessions are excluded.

No production membership rows were inserted, updated, or deleted by this release work.

## CI evidence
GitHub Actions run #423 for commit 9182f5a9ca8c36725eaf1abf95aab8e53d5c9cca completed SUCCESS.
- validate: SUCCESS
- deploy: SUCCESS
- GitHub Pages deployment verification: SUCCESS

Earlier runs #420 and #421 failed because the validator still expected the removed customer-return control / previous role-switch marker. Those failures were corrected in the validator and role-switch implementation; #423 is the first green run after the correction.

## Release status
This closes the web role-switcher CI regression only. It does not certify the complete production release. Previously identified external gates remain, including fresh two-user/two-tenant authorization E2E, storage E2E, signed payment E2E, Android release/signing/device validation, backup/restore rehearsal, production observability drill, Edge Function source convergence, migration/source convergence, rollback rehearsal, and real push/browser-device delivery.
