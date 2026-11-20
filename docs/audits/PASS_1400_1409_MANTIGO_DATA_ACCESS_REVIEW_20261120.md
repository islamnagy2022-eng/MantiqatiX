# Pass 1400–1409 — MantiGO data-access and delegated RPC review

**Date:** 2026-11-20  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only full function-definition, schema metadata and ACL inspection; source migration and CI review. No application rows selected, no RPC invoked, no Production mutation.

## 1. Functions 21–30 of 59 direct-auth SECURITY DEFINER functions

- `get_mantigo_captain_earnings_backend(uuid)`: caller bound to `auth.uid()`, captain profile required, aggregates only caller's captain ledger. Live implementation uses removed `amount` and `captain_amount` columns; RC476 source replaces these with canonical `gross_amount` and `captain_net_amount`. P1 #914 tracks unapplied repair.
- `list_mantigo_captain_rides_backend(uuid)`: caller bound to own captain ID; returns only rides with an ACCEPTED bid by that captain. Pickup/destination are exposed only within the accepted ride relationship.
- `list_mantigo_customer_rides_backend(uuid,text)`: caller bound to own customer ID and rides. Live body serializes all bid fields with `to_jsonb(b)`, exposing captain phone/vehicle plate before acceptance. RC477 masks these fields until ACCEPTED; P1 #913 tracks unapplied repair.
- `list_open_mantigo_rides_backend(uuid)`: caller bound to supplied ID but live body has no active/verified/available captain gate; returns customer names and pickup/destination to any authenticated caller. RC478 adds captain/vehicle-category restrictions; P1 #911 tracks unapplied repair.
- `lock_mantigo_fare_backend(uuid,text)`: caller bound to customer; locks ride; requires customer ownership, ACCEPTED ride and accepted bid; idempotently creates canonical financial ledger record.
- `mantigo_rate_ride(text,integer,text)`: requires authenticated caller, rating 1–5, own completed ride and accepted captain; upserts one rating per ride/customer and audits the change.
- `mark_notifications_read_backend(varchar)`: updates only notifications whose `user_id=auth.uid()`; no caller-supplied actor ID.
- `match_mantigo_ride_backend(uuid,text,integer)`: caller bound to ride owner; requires open/matchable ride; only matches ACTIVE, VERIFIED, AVAILABLE captains in matching vehicle category; returns captain ID, vehicle/model, rating, completed rides, distance and match score, not phone or plate.
- `mnty_active_membership(...)`: SECURITY DEFINER SQL helper filters membership by `auth.uid()`, ACTIVE status and supplied tenant/business/branch; business/branch-null memberships are included only under explicit scope rules. It is a delegated membership helper, not itself a global platform-root proof.
- `mnty_business_employee_list_scoped(...)`: rejects anonymous sessions; validates business/tenant and branch/business; checks tenant/business/branch owner/admin membership or explicit scoped HR permissions; output is restricted to the requested tenant/business/branch.

## 2. Privacy and schema drift cross-check

The three known live gaps remain:
1. RC476 captain earnings legacy column mismatch — #914.
2. RC477 customer bid phone/plate disclosure before acceptance — #913.
3. RC478 open-ride listing lacks verified/available captain boundary — #911.

The repository contains forward-only repairs and disposable PostgreSQL tests:
- RC476 migration `20261118050000`, test `rc476_mantigo_captain_earnings_integration.sql`.
- RC477 migration `20261118060000`, test `rc477_mantigo_customer_bid_contact_privacy_integration.sql`.
- RC478 migration `20261118070000`, test `rc478_mantigo_open_ride_forward_privacy_integration.sql`.

Exact-head CI evidence remains green: RC477 privacy integration **44237312712**; RC478 privacy integration **44239964164**; ordered migration replay including RC467/RC476 and subsequent tests **44239964551**. These are isolated CI results, not Production application evidence.

## 3. Release state and next work

Production migration ledger remains 310 rows through `20261110150618`; RC476/RC477/RC478 are absent. No direct data rows, phone numbers, plates, rides, memberships or financial values were queried. No RPC was invoked.

Continue full-body review of remaining **29** direct-`auth.uid()` SECURITY DEFINER functions. Do not claim the 65-function review complete. Keep Production **BLOCKED / NOT CERTIFIED** until coordinated migration/Edge, backup/restore, rollback, payment/privacy E2E and post-deployment live verification pass.
