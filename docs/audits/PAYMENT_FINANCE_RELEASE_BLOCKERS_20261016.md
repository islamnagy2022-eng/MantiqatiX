# Payment, Finance, and Release Blockers — 2026-10-16

## Status

**Read-only production audit; release remains BLOCKED / NOT CERTIFIED.** This document records verified catalog/source observations and required acceptance tests. It does not authorize production mutation.

- Repository: `islamnagy2022-eng/MantiqatiX`
- Supabase project: `moyhiluyhjsujhwlyeuu`
- Main baseline used for this audit branch: `e020cc08cef06f7f56a34d775ec8c6c7db9d442e`
- Latest live migration ledger version observed: `20261008222845` (RC424), with 283 ledger entries.
- No migration, Edge Function deployment, grant/RLS/Auth change, payment, settlement, or production data write was performed for this audit.

## P0 — Live MantiGO financial report references absent columns

The live definition of `public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)` aggregates `mantigo_financial_ledger.amount` and `captain_amount`. Read-only schema inspection found the actual amount columns are `gross_amount` and `captain_net_amount`; the referenced names are absent.

**Impact:** calling the function is expected to fail at execution due to undefined columns. The function itself was not invoked.

**Required fix/test:** a forward-only migration that updates the function to canonical columns, with a test invoking the report against a fixture ledger row and asserting totals/date filtering. Verify the function's authorization scope separately before deployment.

## P0 — MantiGO platform admin functions do not visibly enforce platform scope

Live definitions of:
- `get_mantigo_admin_dashboard_backend(uuid)`
- `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)`
- `settle_mantigo_captain_backend(uuid,text,text)`

check for active memberships and broad role names. The checked conditions do not visibly require a platform-scoped membership for platform-wide aggregates or settlement under `MNTY-PLATFORM`.

**Impact:** potential cross-tenant/platform authorization defect; exploitability is not certified by this static/catalog review alone.

**Required tests:** in an isolated staging database, call each function as (1) platform super-admin, (2) tenant-only admin, (3) owner/business owner, (4) unrelated authenticated user, and (5) unauthenticated caller. Assert only the explicitly authorized platform role can read platform aggregates or settle a ride. Confirm `auth.uid()`, tenant, and platform scope are checked server-side.

## P0 — Live settlement equation is internally contradictory for nonzero commission

Live `public.create_settlement_and_post_journal(...)` enforces:
1. `gross = platform_fee + net + voucher`; and
2. for beneficiary type `PARTNER`, `net + voucher = gross`.

These conditions conflict when `platform_fee` is nonzero. The live `settle_mantigo_captain_backend` passes `gross_amount`, `commission_amount`, `captain_net_amount`, and zero voucher to this helper.

A read-only query also returned no rows for `chart_of_accounts` with `tenant_id='MNTY-PLATFORM'`, while the helper requires active accounts with codes `1020`, `2050`, and `5030` for the partner path.

**Impact:** the live settlement path is not release-ready. Do not seed accounts or change financial equations until accounting owners approve the canonical debit/credit model and the platform chart of accounts.

**Required tests:** property/table-driven tests for zero/nonzero commission, zero/nonzero voucher, positive and zero settlement, duplicate retries, concurrent settlement, balanced journal totals, account mapping, tenant scope, and atomic rollback when any journal line or audit write fails.

## P0 — Paymob webhook writes event and ledger in separate operations

Live `paymob-webhook` MantiGO path inserts `payment_provider_events` and separately updates `mantigo_financial_ledger`. The normal order failure path likewise inserts a provider event and separately updates `payment_intents`. The live entrypoint matches the tracked `main` source byte-for-byte in the audit performed on 2026-10-16.

**Impact:** if the event insert commits but the state update fails, a retry may observe the event and return idempotent success without completing the state transition. This is a code-level failure/retry risk; no live payment was triggered.

**Required fix/test:** one database transaction/RPC per verified provider event, with a unique idempotency key and state transition. Test duplicate delivery, concurrent delivery, failure between logical writes, invalid signature, amount/currency mismatch, provider-order mismatch, and retry after transient database failure.

## P0 — RC426 candidate signature is incompatible with deployed caller

The live `digital-page-payment-intent` Edge Function invokes `finalize_digital_page_payment_intent_backend` with four arguments. RC426 candidate source introduces a five-argument signature adding `p_provider_order_id`.

**Impact:** applying the candidate migration without coordinated Edge Function/RPC rollout risks a missing-function/signature failure. The deployed function and tracked `main` source matched byte-for-byte in the audit performed on 2026-10-16.

**Required fix/test:** deploy a compatible contract through an explicitly reviewed expand/contract sequence. Verify old/new callers and signatures in staging; do not drop/revoke the old signature until all callers are proven migrated.

## P1 — Candidate webhook hardening is not yet wired into deployed flows

Source inspection found candidate atomic handlers RC425, RC428, RC429, and RC430, while current webhook paths still use direct writes or legacy RPCs for MantiGO, order failure, and subscription success/failure.

RC435 adds subscription intent-claiming behavior, while the deployed `subscription-payment-intent` still calls the legacy creation RPC and performs a separate update. RC439 adds ciphertext columns for checkout-secret recovery, but adding columns alone does not wire encryption/recovery behavior into the current function.

**Required fix/test:** make each Edge Function-to-RPC contract explicit, compare deployed source, repository source, and live RPC signatures, and add contract tests before applying the candidate migrations. Do not infer that candidate migrations are deployed; the live ledger observed in this audit ends at RC424.

## P1 — Public provider profile privacy boundary remains incomplete

Live table `marketing_provider_profiles` has RLS enabled and forced. Live grants include `SELECT` for `anon` and `authenticated`; a permissive SELECT policy permits `anon,authenticated` to read rows where `status='ACTIVE'`. A separate authenticated policy permits CRM-role reads, and owner-management policy permits owners to manage their own rows.

Candidate PR #274 revokes direct SELECT from `anon`, but the reviewed migration does not also revoke direct SELECT from `authenticated`. A public view alone therefore does not close the authenticated direct-table surface.

**Required fix/test:** revoke direct SELECT from both public-facing roles as appropriate, preserve narrowly scoped CRM/owner workflows through a reviewed server-side boundary, and test access to internal fields (including `settings` and `ranking_weight`) as anon, ordinary authenticated user, owner, CRM manager, and platform admin. Verify the view exposes only allowlisted public columns and filters by both provider and business publication state.

## P0 — Migration source chain is not reconstructible from current repository state

Read-only version comparison observed:
- 283 live migration ledger entries.
- 140 SQL migration files on `main`.
- 267 live ledger versions did not have an identically versioned source file on `main`.
- The `reconcile/rc425-458-current-main-20261011` branch had 317 migration files, but 113 live ledger versions still lacked an identically versioned file there.

This is a version/file-presence comparison, not proof that every missing migration is unrecoverable or that each mismatch represents a live schema defect. It is sufficient to block a claim that the repository currently provides a complete, reproducible migration chain.

**Required fix/test:** identify the authoritative source for every applied migration, verify each source against live schema/evidence, and run chronological replay in a disposable PostgreSQL/Supabase-compatible environment. Compare resulting schema, functions, grants, policies, triggers, and indexes to the captured production manifest. Never rewrite applied historical migrations or create guessed stubs.

## Release acceptance checklist

- [ ] Canonical platform authorization policy approved and enforced in MantiGO admin/report/settlement functions.
- [ ] Financial equation and chart-of-accounts mapping approved by accounting owner.
- [ ] Financial report executes against fixtures with correct gross/commission/net totals.
- [ ] Settlement posts balanced journals atomically and rolls back fully on injected failures.
- [ ] Paymob success/failure flows are atomic and idempotent under retries and concurrency.
- [ ] Digital-page and subscription Edge Function/RPC signatures are contract-tested across rollout order.
- [ ] Provider public view and direct table grants/policies pass anon/authenticated/owner/CRM tests.
- [ ] Complete migration source chain is reconstructed and chronological replay passes.
- [ ] Backup restore, tenant isolation, payment finance E2E, Edge Function contracts, and SMM launch gates have fresh evidence.
- [ ] CI passes on the exact release candidate SHA; independent review approves release.

## Safety decision

Keep production unchanged and keep the release gate **BLOCKED / NOT CERTIFIED** until the P0 findings have reviewed forward-only fixes and reproducible staging evidence. This audit document does not itself close any release gate.
