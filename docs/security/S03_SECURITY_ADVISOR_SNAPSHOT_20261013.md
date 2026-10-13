# MANTIQATIX Security Advisor Snapshot — 2026-10-13

Source: fresh read-only Supabase Security Advisor response for project `moyhiluyhjsujhwlyeuu`. This is a lint inventory; counts are not equivalent to confirmed exploitable vulnerabilities.

## Current findings returned

- 1 `anon_security_definer_function_executable` warning: `public.get_mnty_targeted_advertisements(...)` is callable by the `anon` role through PostgREST RPC. Review the exact public field contract and retain anonymous execution only if explicitly intended.
- 40 `authenticated_security_definer_function_executable` warnings: inventory requiring authorization review, not 40 confirmed vulnerabilities.
- 90 `auth_allow_anonymous_sign_ins` warnings: verify the project-level anonymous sign-in setting and identify which product flows depend on anonymous Auth users. Do not disable it blindly; first map dependencies and test impact in a non-production environment.
- 1 `auth_leaked_password_protection` warning: the advisor reports compromised-password checking is not enabled. Evaluate enabling it through a separately approved Auth-settings change and validate sign-in/recovery flows first.
- 1 INFO `rls_enabled_no_policy`: `public.digital_page_payment_events` has RLS enabled and no policies. This can be a deliberate deny-by-default boundary; verify intended access before adding policies.

## Safety interpretation

The advisor response contained 94 lint entries with 133 aggregate reported findings because some entries report multiple objects. Counts overlap by category and should not be added as if they were distinct vulnerabilities.

No Auth settings, database grants, RLS policies, migrations, or production data were changed. No advisor item is marked resolved by this snapshot. Release remains **BLOCKED — NOT CERTIFIED** pending scope review, isolated role tests, and approved remediation.
