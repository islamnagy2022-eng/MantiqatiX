# Production Schema Baseline — Security Review Findings

**Date:** 2026-10-17  
**Candidate branch:** `integration/baseline-replay-candidates-20261016`  
**Checkpoint:** `20261008222845 / rc424_atomic_digital_page_payment_webhook`  
**Manifest:** `PENDING_REVIEW`  
**Disposition:** **NOT APPROVED FOR REPLAY YET**

## Purpose and limits

This is a reproducible static inventory of the schema-only baseline captured from the live project at the stated ledger checkpoint. It is a triage aid, not a claim that every listed grant is exploitable, not a full manual function-by-function review, and not proof of live behavior. The snapshot represents the pre-forward-migration checkpoint; the forward migration chain must be tested to verify that intended hardening is applied.

## Static scan results

The snapshot is 820,374 bytes / 16,203 SQL lines.

- 166 function definitions were parsed.
- 144 are marked `SECURITY DEFINER`.
- All 144 declare a search_path; 25 use an empty path and 119 use a non-empty path (commonly `public` and/or `pg_temp`). Non-empty paths require review of object qualification and shadowing risk; the count alone is not a vulnerability count.
- 129 `ENABLE ROW LEVEL SECURITY` statements, 105 `FORCE ROW LEVEL SECURITY` statements, and 485 policy definitions were found.
- 112 explicit function ACL entries were found; 50 ACL entries for SECURITY DEFINER functions grant execution to `authenticated` or `anon`. Each needs contract review, but some are legitimate user-facing entry points.
- The dump contains broad default table privileges for `anon` and `authenticated` including `REFERENCES, TRIGGER, TRUNCATE, MAINTAIN`, plus table-level `MAINTAIN` grants. Confirm these are the intended privileges for the source PostgreSQL/Supabase role model and that they are actually emitted by the live catalog as expected.

## Priority RPCs requiring explicit review

The baseline grants EXECUTE to `authenticated` on the following SECURITY DEFINER functions. Do not revoke indiscriminately: establish each intended caller and authorization contract, then prove the forward migration or a focused migration keeps only the necessary access.

### P0 — Payment and financial boundaries

- `public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text)`
- `public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)`
- `public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text)`
- `public.create_payment_intent_backend(...)`
- `public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)`
- `public.settle_mantigo_captain_backend(uuid,text,text)`
- `public.set_mantigo_financial_config_backend(uuid,numeric,text)`
- `public.confirm_mantigo_cash_payment_backend(uuid,text)`

Existing relevant remediation candidates and tests:
- PR #268: [server-only digital-page finalization](https://github.com/islamnagy2022-eng/MantiqatiX/pull/268), including an isolated PostgreSQL test for authenticated denial and trusted-role success.
- RC426–RC431 and RC435–RC436: provider-order binding, one active intent, atomic provider failure/subscription callbacks, hardened digital-page RPC, subscription intent claim, and atomic journal.
- Issue #269: [digital-page payment RPC search_path/grants review](https://github.com/islamnagy2022-eng/MantiqatiX/issues/269).

### P0 — Platform-wide MantiGO administration

- `public.get_mantigo_admin_dashboard_backend(uuid)`
- `public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)`
- `public.expire_stale_mantigo_rides_backend(uuid,integer)`
- `public.review_mantigo_captain_application(...)`
- `public.set_mantigo_financial_config_backend(uuid,numeric,text)`
- `public.settle_mantigo_captain_backend(uuid,text,text)`
- `public.mnty_can_platform_admin()`

Relevant remediation candidates:
- RC449: platform-admin scope hardening.
- RC462: fail-closed handling of malformed `full_control` JSON values using exact JSON containment, with disposable PostgreSQL regression coverage.
- Issue #94: [restrict platform-wide dashboard and financial report to platform admins](https://github.com/islamnagy2022-eng/MantiqatiX/issues/94).

The RC462 regression must run after RC449 on disposable PostgreSQL and must reject malformed strings, JSON Boolean false, and JSON string true while preserving a valid explicit JSON Boolean true.

## Other boundary groups to verify

- `public.create_mantigo_ride_backend*`, `public.create_mantigo_bid_backend`, `public.update_mantigo_trip_status_backend`, `public.list_mantigo_*_rides_backend`, and `public.update_mantigo_captain_presence_backend`: verify `auth.uid()` binding, ride ownership, captain/customer scope, and no trust in caller-supplied user IDs.
- `public.create_indrive_request_backend`, `public.create_indrive_bid_backend`, `public.accept_indrive_bid`, `public.reject_indrive_bid`: verify request ownership, bid-to-request binding, valid state transitions, and concurrency.
- `public.fulfill_digital_page_publish`: verify actor binding and publication authorization.
- `public.admin_create_global_ad`: verify platform-only authority and tenant boundaries.
- `private.upsert_mnty_push_subscription` and `private.disable_mnty_push_subscription`: verify endpoint ownership and exposure.
- Table grants and policies on `audit_logs`, `notifications`, `support_tickets`, `education_requests`, `indrive_requests`, `indrive_bids`, `subscription_payment_intents`, and `push_subscriptions`: verify least privilege and tenant/owner filtering.

## Required decision before replay

Do not set the baseline manifest to `APPROVED_FOR_DISPOSABLE_REPLAY` solely because the schema dump hash and migration ledger match. Before approval:

1. Review each of the 144 SECURITY DEFINER functions against its exact ACL, body, caller contract, and scope.
2. Review the 485 policies together with table ACLs and default privileges; RLS alone is not sufficient evidence.
3. Cross-reference every identified pre-checkpoint risk with the exact forward migration that should close it.
4. Ensure migrations and focused PostgreSQL tests prove the expected authorization denial and preserve legitimate entry points.
5. Record a reviewer, decision, rationale, and unresolved exceptions. Any unresolved P0 keeps the baseline pending.

## Current verified CI boundary

PR #273 restores 16 missing historical source files with exact blob SHA equality against two recovery/reconciliation branches. Its migration-version uniqueness, migration-history immutability, cross-PR collision, module boundary, MantiGO privacy, approval-audit, module-validation, and web-validation checks passed at the latest checked head. The web deploy job was skipped. These are branch-level checks only; the full baseline forward replay has not passed and production remains **BLOCKED / NOT CERTIFIED**.

## Safety

No production database, migration ledger, grants, RLS, Auth settings, secrets, payment records, or deployment was changed by this static review. Do not infer that the listed migrations have been applied in production.