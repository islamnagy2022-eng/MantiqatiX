# Pass 1861–1870 — Auth advisor and deny-by-default table recheck — 2026-11-23

## Live Production evidence
- [x] 1861 — Refreshed Supabase Security Advisor. Findings remain: 9 RLS-enabled/no-policy INFO; 65 authenticated-callable SECURITY DEFINER WARN; 1 anon-callable SECURITY DEFINER WARN; anonymous Auth sign-in enabled warning; leaked-password protection disabled warning.
- [x] 1862 — Rechecked all 9 RLS-enabled/no-policy tables for direct table privileges. `anon` has no SELECT/INSERT; `authenticated` has no SELECT/INSERT/UPDATE/DELETE on any of the nine. These are currently deny-by-default via ACL, not confirmed data leaks. Do not add blanket policies to silence the INFO findings.
- [x] 1863 — Identified the one anon-callable SECURITY DEFINER function as `get_mnty_targeted_advertisements(...)`. Its live definition returns only approved, active, in-window advertisement metadata, applies geographic/ad-space matching, uses an empty search_path, and clamps the result limit to 1–50 (default 3). This appears to be an intentional public ad-discovery read contract; preserve pending ongoing function-specific review rather than blanket revocation.
- [x] 1864 — Rechecked current-main code search for `signInAnonymously`; no matches returned. This does not prove no external consumer depends on anonymous Auth.
- [x] 1865 — Anonymous Auth warning is not equivalent to 90 direct `anon` grants or 90 proven leaks. Anonymous Auth users carry the `authenticated` Postgres role and must be explicitly rejected in sensitive RPC/Edge/RLS paths using the JWT `is_anonymous` claim.
- [x] 1866 — Leaked-password protection remains disabled in live Auth Advisor. This is an Auth project setting, not a SQL migration. No Auth configuration change was made.
- [x] 1867 — Identified owner-operated hardening action: enable Supabase Auth leaked-password protection after checking current signup/password-login requirements; test existing sign-in, password reset and signup flows afterward.
- [x] 1868 — Identified separate owner-operated decision: disable anonymous Auth sign-ins only after confirming no external mobile/client integration depends on them. Current main's public browsing does not require an anonymous Auth identity.
- [x] 1869 — No RLS policies or grants were added to the nine deny-by-default tables.
- [x] 1870 — No Auth setting, SQL schema, RLS, grant, Edge Function, payment, wallet, settlement, or user data was changed.

## Remaining actions
- [ ] Project owner: enable leaked-password protection in Supabase Auth settings; run signup/password-reset regression tests.
- [ ] Project owner: confirm external integrations do not depend on anonymous Auth; then disable anonymous sign-ins if not required.
- [ ] Engineering: maintain explicit `is_anonymous` denial for privileged RPCs and Edge Functions; do not treat advisor warning count as direct access proof.
- [ ] Continue individual review of the 65 authenticated-callable SECURITY DEFINER functions; keep the four global MantiGO RPCs as P0 until RC464/RC471 is applied through the reconciled release chain.

**Release status:** no Production changes occurred. Full Production remains **BLOCKED / NOT CERTIFIED**.
