# RC223 — Mobile-Executable Verification Continuation — 2026-10-02

## Executed checks

### Database / RLS
- RLS is enabled on businesses, catalog_items, orders, payment_intents, provider_onboarding_requests, and user_memberships.
- Direct INSERT/UPDATE/DELETE privileges are absent for both anon and authenticated on the core tables checked.
- Cross-tenant reads previously observed through an existing authenticated identity returned zero TEST-B rows for businesses, orders, payment intents, and provider onboarding.
- A cross-tenant order-creation attempt through the protected backend path was rejected and rolled back.

### Storage
- 2 buckets exist.
- 1 bucket is public.
- 0 storage objects currently exist.
- Therefore runtime media isolation and signed-URL consumption cannot be certified without creating authorized test media and independent identities.

### Edge Functions
- Core protected functions such as payment-intent, order-create, order-status-update, catalog-admin, business-register, business-approval, settlement, financial-journal, onboarding, and marketing-lead-create are deployed with JWT verification enabled.
- The JWT-disabled functions reviewed are deliberate custom-auth/callback boundaries: api, payment-webhook, paymob-webhook, and mnty-push-dispatch.

### Logging
The last 24-hour Supabase log stream contains entries from edge, PostgREST, PostgreSQL, Auth, Storage, Functions, Auth audit, Realtime, and PgBouncer.
This confirms collection is active; it is not an incident/alert drill.

### Security Advisor
Current live findings remain:
- 1 anonymous SECURITY DEFINER RPC used for public ad delivery.
- 6 authenticated SECURITY DEFINER RPCs with server-side authorization.
- Anonymous-policy warnings on existing RLS surfaces.
- Leaked-password protection remains unavailable on the current plan.

No broad permission revocation or speculative RLS rewrite was applied.

## Corrected runtime E2E status

The automated search for an independent active identity belonging to MNTY-PLATFORM and not MNTY-TEST-B found **none**. The runtime two-user/two-tenant test therefore remains BLOCKED by test-identity availability.

A corrected reproducible script was added:
`scripts/verify-tenant-isolation-v2.sql`

It reports BLOCKED rather than falsely claiming PASS when no suitable test identity exists.

## Still requires external/authorized execution
- two-user/two-tenant browser E2E;
- real Storage media E2E;
- real signed Paymob transaction;
- backup restore + measured RPO/RTO;
- rollback rehearsal;
- leaked-password protection after plan upgrade;
- final browser regression.

## Release status
**NOT PRODUCTION CERTIFIED.**
