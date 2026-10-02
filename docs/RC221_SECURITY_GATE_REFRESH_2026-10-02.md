# RC221 — Security Gate Refresh — 2026-10-02

## Scope
Controlled production-readiness continuation after the failed attempt to enable Supabase leaked-password protection on the current Free plan.

## Current live evidence

- Supabase project: `moyhiluyhjsujhwlyeuu`
- Project status: `ACTIVE_HEALTHY`
- Database engine: PostgreSQL 17
- Active tenants: 2
- Active user memberships: 23
- Active SUPER_ADMIN memberships: 2
- Active businesses: 1
- Auth users: 8
- Storage buckets: 2
- Storage objects: 0

## Auth leaked-password protection

Status: **DEFERRED — EXTERNAL PLAN GATE**

The Supabase Auth setting `Prevent use of leaked passwords` was toggled in the dashboard but Supabase rejected the save because HaveIBeenPwned.org leaked-password protection requires Pro or higher. The project is therefore not marked production-certified for this gate.

Required before actual launch:
1. Upgrade the Supabase organization/project to a plan that supports leaked-password protection.
2. Enable `Prevent use of leaked passwords`.
3. Save successfully.
4. Re-run the Supabase Security Advisor and retain the resulting evidence.

## Security Advisor

Current live advisor review confirms:
- 1 intentional anonymous-callable SECURITY DEFINER function for public targeted-ad delivery.
- 6 authenticated-callable SECURITY DEFINER functions. These remain intentionally exposed to authenticated clients because their bodies contain server-side authentication/ownership/tenant/role checks.
- Existing anonymous-policy warnings remain under contextual review; no blanket RLS rewrite was applied.
- Performance advisor contains broad historical index/policy findings; no speculative mass-index change was made.

The SECURITY DEFINER functions were not revoked merely to silence advisor warnings because doing so would break intended protected workflows.

## Edge Function boundary review

Active Edge Functions were reviewed for JWT configuration. Protected application functions use JWT verification. The functions with JWT verification disabled are deliberate callback/health/custom-auth boundaries:

- `api`: custom Bearer token validation with Supabase Auth `getUser`, strict production origin, and server-side tenant/business checks.
- `payment-webhook`: HMAC-SHA256 signature + timestamp window validation.
- `paymob-webhook`: Paymob HMAC-SHA512 verification plus amount/currency/idempotency checks.
- `mnty-push-dispatch`: server-side webhook-secret validation before dispatch.

No browser service-role credential exposure was introduced by this review.

## Storage boundary review

Storage RLS is enabled. Current policies restrict authenticated media operations by user identity, provider ownership, business membership/role, and path conventions. Profile media public-read is explicitly scoped to the dedicated profile-media bucket.

Static policy review: **PASS / REVIEWED**.

Runtime two-user/two-tenant storage isolation is still **NOT VERIFIED** because the project currently has no stored objects and no independent runtime test sessions were available in this execution.

## Remaining external release gates

Still open:
- Real two-user/two-tenant authorization E2E.
- Real two-user/two-tenant Storage/media E2E.
- Approved signed Paymob/provider E2E.
- Backup/restore drill with measured RPO/RTO.
- Observability and rollback drill.
- Final browser/regression evidence.
- Leaked-password protection after the plan upgrade.

## Release status

**NOT PRODUCTION CERTIFIED.**

This checkpoint records verification evidence only; it does not declare Go-Live readiness.
