# MantiqatiX DEMO — Google OAuth setup and launch gate

Date: 2026-10-26  
Scope: isolated project `lkijdgqanbqjudiducjt` only. Do not apply these settings or changes to LIVE except adding the same Google redirect URI to the OAuth client if the owner approves reuse of that client.

## Current verified blocker

The new non-mutating GitHub Actions probe calls the Supabase authorize endpoint with provider `google` and the exact application callback below, without following the redirect and without creating a user. Current live response:

`400 validation_failed — Unsupported provider: provider is not enabled`

Therefore Google OAuth is **not enabled in the DEMO Supabase Auth configuration**. The connected app's code cannot turn this provider on by itself.

## Required configuration

### 1. Google Cloud OAuth client

In Google Cloud Console, open the OAuth 2.0 Client ID used for the MantiqatiX Google sign-in flow, or create a dedicated Web application client for DEMO if that is the deployment policy.

Add the following exact **Authorized redirect URI**:

`https://lkijdgqanbqjudiducjt.supabase.co/auth/v1/callback`

This URI belongs to Supabase Auth and is the Google OAuth callback. It is not the final application return URL.

Use the client ID and client secret only in Supabase's provider configuration UI. Do not commit them to GitHub, embed them in browser JavaScript, or paste the secret into chat. If reusing the current production Google OAuth client, add the DEMO callback as another redirect URI only after confirming this is acceptable for the existing OAuth client and consent configuration.

### 2. Supabase DEMO Auth provider

Open Supabase Dashboard → project `MantiqatiX-DEMO` (`lkijdgqanbqjudiducjt`) → Authentication → Sign In / Providers → Google.

- Enable Google.
- Enter the approved Google OAuth Client ID and Client Secret.
- Save the provider settings.
- Do not alter the LIVE project as part of this setup.

### 3. DEMO application redirect allowlist

Open Authentication → URL Configuration in the DEMO project. Add this exact **Additional Redirect URL**:

`https://islamnagy2022-eng.github.io/MantiqatiX/demo/connected.html`

The connected page itself must be deployed at that exact path before browser sign-in can be verified. The current PR #376 deployment job is skipped on pull-request events; its connected route is not yet public. Keep the public root `web/config.js` unchanged until separately approved.

For local testing, add a precise localhost callback only if required and remove it when no longer needed. Do not use a wildcard redirect.

## Automated verification after configuration

The DEMO Isolation workflow now executes `scripts/test-connected-demo-live-smoke.mjs`. It verifies:

1. All seven DEMO Edge Functions accept the approved origin preflight.
2. An unapproved origin is rejected.
3. Unauthenticated POST requests are rejected.
4. Google OAuth authorize returns a 3xx redirect to `accounts.google.com` when the provider is enabled and the exact application callback is allowlisted.

The fourth probe does not follow the redirect, does not log into Google, and does not create an Auth user. A passing probe is only provider/allowlist readiness, not proof of a real login.

Workflow run that exposed the blocker: [40279002724](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40279002724). It failed at the OAuth readiness check with `Unsupported provider: provider is not enabled`; earlier source syntax, local simulator, and connected contract steps passed.

## Required authenticated acceptance test after the provider is enabled

After the route is deployed to an approved preview path, execute a real browser sign-in with the owner's own Google account and verify, in the DEMO project only:

- OAuth returns to the connected DEMO route, and the session survives refresh and ends on logout.
- The DEMO Auth user is created independently; no LIVE session, token, or user record is copied.
- The configured confirmed Google identity receives only the scoped platform-owner membership under the existing server-side rules.
- Create one synthetic business in each of FOOD, PHARMACY, DOCTOR, and STORE.
- For every business, create a branch (created by the business RPC), create a catalog item/service and price, read it back, and update its price.
- For FOOD, PHARMACY, and STORE, submit a synthetic order, verify server-authoritative price/total and stock reservation, test valid status transitions, cancel once, and verify stock restoration. No provider checkout/payment is invoked.
- For DOCTOR, create a future appointment, verify it appears to the patient and authorized clinic roles only, and test past-time rejection and duplicate/conflict handling.
- Using a second independent Google identity, verify the second account cannot read or mutate the first owner's private business data or act as that owner. Verify manager/staff membership limits and role boundaries.
- Read back relevant rows and confirm every created row is tagged for DEMO; verify no LIVE project was touched.

## Release decision

Keep PR #376 Draft and LIVE release **BLOCKED / NOT CERTIFIED** until provider readiness passes, real authenticated E2E is evidenced, migration history is reconciled, SECURITY DEFINER findings are reviewed function-by-function, and the deployment/rollback path is separately approved. Do not bypass the OAuth gate or substitute source assertions for browser/backend E2E.
