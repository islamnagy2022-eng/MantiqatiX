# RC104 — G10 Unified Runtime Baseline

## Scope
G10 reviewed the public website entry point, authenticated app bootstrap, Supabase client configuration, PWA shell, service worker, and shared API/function invocation path.

## Verified architecture
- Public entry loads the MNTY landing page when no authenticated session exists.
- Authenticated session is verified with Supabase before entering the operational application.
- Operational function calls require the current Supabase access token.
- API calls use the same authenticated session token.
- Website and authenticated application share the same Supabase project/configuration.
- Service worker is scoped to the web application and handles offline shell fallback plus Web Push.
- Public discovery reads published data from Supabase rather than embedding fake providers.
- Provider/customer separation is enforced by the backend/RLS layers reviewed in earlier gates.

## G10 hardening
The browser previously loaded:
`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`

This was changed to the explicit production version:
`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2`

This removes automatic minor/patch runtime drift from the public entry point.

GitHub commit:
`d2ede557b7c1d48004d377a505ce38b1bf9afe48`

## Verification
- Repository source confirms the pinned runtime URL.
- No workflow run was returned for this commit at verification time; CI is therefore **NOT VERIFIED** for this G10 commit.

## Remaining external/runtime verification
- Browser smoke on the deployed public URL.
- Mobile/responsive/accessibility smoke.
- OTP login/session expiry/logout.
- Authenticated customer and provider browser journeys.
- PWA install/update and service-worker cache upgrade.
- Push subscription and notification click-through.
- Full route/import/runtime smoke.
- Final production release gate and rollback rehearsal.

## Release status
**G10 source hardening: COMPLETE.**
**G10 external/browser verification: NOT VERIFIED.**
