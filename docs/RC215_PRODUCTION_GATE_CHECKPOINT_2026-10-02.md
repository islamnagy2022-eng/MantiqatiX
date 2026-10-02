# RC215 — Production Gate Checkpoint — 2026-10-02

## Scope
Controlled continuation after the public homepage launch-shell completion. This checkpoint records evidence available from the current production repository and Supabase Security Advisor. It does not certify Go-Live.

## Web release evidence
- Main release commit: `41dbd0e28b461e0fba49e126cfdfa23901870e57`
- Homepage launch shell: Header + live catalog search + mobile navigation + footer.
- Search source remains the published `marketing_services` and `marketing_provider_profiles` catalog.
- No fabricated catalog records were introduced.
- CI run: `36957923086`
- CI validate job: PASS
- JavaScript syntax/static/security/public-web-secret/release-preflight guards: PASS
- Required web files: PASS
- GitHub Pages deployment: PASS
- Deployed-site HTTP smoke/asset verification: PASS

## Security Advisor — live checkpoint
Observed 2026-10-02:
- `anon_security_definer_function_executable`: 1 finding for `public.get_mnty_targeted_advertisements(...)`.
  - This is an intentional public sanitized delivery RPC used by the public homepage.
  - Historical production migrations explicitly grant its execution to anon/authenticated.
  - It must not be revoked merely to silence the advisor while the public-ad-delivery contract depends on it.
- `authenticated_security_definer_function_executable`: 6 findings:
  - `admin_create_global_ad`
  - `create_job_backend`
  - `create_medical_appointment_backend`
  - `create_payment_intent_backend`
  - `get_mnty_targeted_advertisements`
  - `update_medical_appointment_status_backend`
  - These require workflow-specific authorization review; the current source history documents explicit in-function authorization for the reviewed backend paths.
- Anonymous-policy warnings exist on multiple legacy/operational tables and require access-path review rather than broad policy creation.
- `auth_leaked_password_protection`: WARN / disabled.

## Security decisions
1. No broad RLS policies were added to silence advisor findings.
2. No client privileges were widened.
3. No payment, settlement, authentication, tenant-isolation, or production business logic was changed in this checkpoint.
4. The leaked-password setting remains an external Auth configuration gate; source/database changes alone are not evidence of enablement.
5. Real multi-user/multi-tenant E2E, Storage isolation E2E, Paymob signed E2E, backup/restore, observability drill, rollback rehearsal, and Android release evidence remain open according to the production release program.

## Release status
**NOT PRODUCTION CERTIFIED.**

The public web deployment is verified, but final Go-Live remains blocked until the mandatory external/runtime security and recovery evidence is completed.

## Next execution order
1. Enable leaked-password protection in the Supabase Auth security configuration and re-run Security Advisor.
2. Execute approved two-user/two-tenant authorization E2E.
3. Execute Storage isolation E2E.
4. Execute approved Paymob E2E including signature/replay/idempotency.
5. Execute isolated backup/restore drill with measured RPO/RTO.
6. Execute observability and rollback drills.
7. Re-run final regression and assemble RC98/RC99 evidence pack.
