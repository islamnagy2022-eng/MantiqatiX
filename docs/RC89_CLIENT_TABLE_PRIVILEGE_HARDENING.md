# RC89 — Client Table Privilege Hardening

Date: 2026-09-28

## Production change
Applied migration `revoke_client_non_dml_table_privileges` to production Supabase project `moyhiluyhjsujhwlyeuu`.

Change:
- Revoked `REFERENCES`, `TRIGGER`, and `TRUNCATE` table privileges from `anon` and `authenticated` on all tables in the `public` schema.

## Verification
- Post-change query returned zero `anon`/`authenticated` grants for these three privilege classes.
- No production data rows were created, modified, or deleted.
- This change does not alter RLS policies or application DML grants.

## Security interpretation
The client roles retain only privileges required by the existing application/RLS design. Non-DML schema/table privileges are no longer exposed to client roles.

## Remaining release gates
This hardening does not close the remaining production certification gates: leaked-password protection, fresh two-user/two-tenant authorization E2E, storage E2E, signed payment E2E, Android release/signing/device verification, backup/restore rehearsal, observability drill, full Edge Function/source convergence, migration convergence, rollback rehearsal, and real push/browser-device delivery verification.
