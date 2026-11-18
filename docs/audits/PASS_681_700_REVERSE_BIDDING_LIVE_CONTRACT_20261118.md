# Pass 681–700 — reverse-bidding live contract and provider eligibility audit

Date: 2026-11-18  
Repository baseline: `main` at `54fcf4be74a5892a84ffdb20c85abc67a9e36643`  
Supabase Production: `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`

## Live environment

- Project status: ACTIVE_HEALTHY; PostgreSQL 17.6.
- Migration ledger: 310 rows; latest applied version `20261110150618`.
- Current main release verifier tracks 57 required release migration versions through RC478; the exact required versions are not present in the live ledger snapshot. This is not permission to fabricate ledger entries or replay historical migrations out of order.
- Security Advisor: 94 findings in the current snapshot, including 65 authenticated-executable SECURITY DEFINER functions, one anon-executable SECURITY DEFINER function, nine RLS-enabled/no-policy tables, anonymous-role policy warnings, and leaked-password protection disabled. These are triage signals, not a count of independently exploitable vulnerabilities.
- Health Advisor: zero lints at the time queried.

## Existing reverse-bidding schema

The live schema already contains `indrive_requests`, `indrive_bids`, `marketing_provider_profiles`, `marketing_provider_services`, and `marketing_services`. Reuse these canonical entities; do not create a parallel marketplace catalog or provider directory.

The current `indrive_requests` table has text `domain_type` and `category_name`, but no stable `service_id`. It has `req_location_district` and an optional attachment path. The current bid table has a status CHECK allowing only `OFFERED`, `ACCEPTED`, and `REJECTED`; `provider_rating` and `completed_orders_count` are NOT NULL.

## Confirmed live RPC/schema mismatch

The live `public.create_indrive_bid_backend` function:

- inserts `status='PENDING'`, which violates the live bid status CHECK;
- inserts `provider_rating=NULL`, which violates the live NOT NULL column;
- accepts provider name/type from caller arguments instead of deriving provider identity and public name from the authenticated provider profile;
- checks request ownership/status but does not check provider profile ACTIVE/verified status, exact ACTIVE service link, active master service, or geographic coverage.

The live `counter_offer_indrive_bid` mutates the original `offered_price` and `note` in place; it does not preserve append-only negotiation history.

These are source/schema contract defects established by comparing the live function body with live constraints. No production RPC was invoked to reproduce a failing write.

## Real provider supply snapshot

Aggregate-only query returned:
- 0 requests and 0 bids.
- 10 ACTIVE + verified provider profiles.
- 16 ACTIVE provider-service links.
- All 16 active verified links belong to the MARKETING service category; other service categories currently have no active verified provider-service links.

No provider names, user IDs, phone numbers or profile settings were selected. The product must display an honest no-eligible-provider state for uncovered categories; no synthetic providers, bids, ratings or completed-work metrics may be created.

## Required implementation sequence

1. Add stable `service_id` to new requests, referencing the existing active `marketing_services` catalog; validate service status on the trusted database boundary.
2. Derive provider identity from `auth.uid()` and an owned ACTIVE + verified provider profile. Ignore caller-supplied provider identity fields.
3. Require an exact ACTIVE `marketing_provider_services` link and ACTIVE `marketing_services` record for the request service.
4. Require exact normalized district/area coverage from the existing `service_areas` data until a normalized geography relation is designed and verified.
5. Add append-only negotiation events/revisions and immutable accepted-offer snapshot; enforce one winner under row lock and idempotency.
6. Add explicit work status, customer/provider completion confirmation, dispute and review lifecycle.
7. Calculate commission as an auditable shadow obligation only. Payment collection, escrow, wallet movement, refunds, settlement and ledger posting are not authorized by issue #804.
8. Add disposable PostgreSQL tests for anonymous denial, spoofed identity, inactive/unverified provider, wrong service, wrong area, replay, concurrent acceptance, immutability, completion/dispute and shadow commission idempotency.

## Release boundary

Read-only inspection only. No Production SQL, migration, table/data write, Auth setting, RLS policy, GRANT, Edge Function deployment, payment, wallet, settlement, GitHub main-branch change or Pages deployment occurred. The full platform remains BLOCKED / NOT CERTIFIED pending its independent migration, Edge parity, backup/restore, security, finance and mobile gates.
