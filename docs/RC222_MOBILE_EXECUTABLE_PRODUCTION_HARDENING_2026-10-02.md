# RC222 — Mobile-Executable Production Hardening — 2026-10-02

## Completed in this checkpoint

### 1. Runtime tenant-isolation verification
A live database verification was executed using an existing ACTIVE platform-only authenticated identity, without creating a user or changing production data.

Observed:
- TEST-B businesses visible: 0
- TEST-B orders visible: 0
- TEST-B payment intents visible: 0
- TEST-B onboarding requests visible: 0

A protected `create_order_backend` cross-tenant attempt was also executed inside a transaction with rollback. The call did not succeed, and no production row was committed.

This is **partial adversarial authorization evidence**, not the final two-user/two-tenant E2E gate.

### 2. Reproducible verification script
Added:
`scripts/verify-tenant-isolation.sql`

The script:
- selects an existing ACTIVE identity that belongs to MNTY-PLATFORM but not MNTY-TEST-B;
- evaluates access as the `authenticated` role;
- verifies zero cross-tenant visibility for businesses, orders, payment intents, and onboarding requests;
- always rolls back.

It does not create users, rows, files, or permissions.

### 3. Production logging availability
The last 24-hour Supabase log window was queried successfully. Logs were present across:
- edge
- PostgREST
- PostgreSQL
- Auth
- Storage
- Functions
- Auth audit
- Realtime
- PgBouncer

This confirms log collection is active. It does **not** constitute an alert/incident drill.

## Still externally gated

The following cannot be honestly marked VERIFIED from the available mobile/API execution surface:
- independent two-user/two-tenant browser E2E;
- independent Storage media E2E with real files and signed URLs;
- real signed Paymob transaction;
- production backup restore and measured RPO/RTO;
- rollback drill using the deployed release artifact;
- Supabase leaked-password protection until the project is on a supported plan and the setting saves successfully;
- final production browser regression.

## Safety rule

No synthetic authentication identities, production payment transactions, fake media objects, or destructive recovery operations were created by this checkpoint.

## Release status

**NOT PRODUCTION CERTIFIED.**
