# MantiqaTix — Live Platform Billing, Wallet & Advertising Gap Audit

**Captured:** 2026-10-31  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Method:** Read-only Supabase table/migration/function/ACL/RLS/constraint inspection. No financial row content was retrieved.  
**Production mutation:** NONE.

## Executive decision

The platform already contains reusable finance primitives. Do not create a second wallet or commission engine. However, the current live database is **not ready** to operate a subscriber-facing service wallet or automatic platform billing.

The current commission-rule draft workflow is present and tested, but remains preview/draft only. Subscription prices are fixed monthly/annual tier values. Wallet tables exist but contain no rows and their current journal-posting execution path is not usable by the service role. Advertising tables exist but do not provide duration-based inventory reservations or pricing.

## 1. Current live inventory

| Relation | Rows observed | Relevant shape |
|---|---:|---|
| `wallet_accounts` | 0 | tenant, owner_type, owner_id, currency, status, allow_negative, GL account |
| `wallet_transactions` | 0 | transaction type, amount, balance_after, idempotency key, status, reference, journal entry |
| `commission_rules` | 0 | legacy rule fields plus RC452 flexible draft metadata |
| `commission_transactions` | 0 | business/order/rule, gross, commission, status |
| `business_subscriptions` | 0 | tier, MONTHLY/ANNUAL/TRIAL cycle, status, dates, provider reference |
| `subscription_tier_prices` | 4 | fixed monthly_price / annual_price / currency / active |
| `subscription_payment_intents` | 0 | provider intent and idempotency fields; RC435/439 fields absent |
| `advertisements` | 0 | tenant/business/ad-space, creative, approval, start/end |
| `ad_spaces` | 2 | HOME_HERO and HOME_SPONSORED; code/name/placement/status |
| `platform_global_advertisements` | 4 | platform-managed creative, slot, status, approval, start/end |

The live migration ledger returned 308 recorded migrations; latest observed version is `20261029083845`. This audit does not reconcile the entire migration history.

## 2. Commission rules — partial foundation is reusable

- `commission_rules` already supports percentage, fixed, and combined calculation modes; tenant/business/category/product/service/plan/agreement scope; eligibility event; priority; effective period; bounds; exemption; approval status; and version number.
- `mnty_commission_rule_drafts` is authenticated-only and checks platform-admin or tenant-management authority. New rules are persisted as `DRAFT` and `active=false`.
- `preview_commission_rule_draft` and `preview_commission_rule_resolution` return preview-only results and explicitly set `applies_to_orders=false`.
- `commission_rule_audit` has RLS + FORCE RLS and no direct client table privileges; the audit trigger is attached.
- The current draft manager supports fixed, percentage, combined, min/max, priority, scopes, effective dates, exemptions, audit and previews.

**Limitations:** No active rule-resolution/charge-posting integration is certified. The preview engine does not prove a charge can be posted. Percentage basis/source is not yet an immutable versioned field in the current rule contract. Subscription-only versus commission-only versus both still needs a first-class pricing composition contract.

## 3. Subscription pricing and checkout — fixed-tier model only

- `subscription_tier_prices` stores only `monthly_price`, `annual_price`, `currency`, and `active`; it has no pricing-rule version, percentage, fixed-plus-percentage composition, effective period, or billing-basis fields.
- Existing subscription cycles are MONTHLY, ANNUAL, TRIAL.
- Live `subscription_payment_intents` lacks `provider_creation_state`, `provider_creation_claimed_at`, `client_secret_ciphertext`, `client_secret_iv`, and `client_secret_key_version`.
- The live database has only the legacy `create_subscription_payment_intent_backend` among the inspected creation/claim RPCs. The RC435 claimable-intent and provider-creation-claim RPCs are absent.
- The live `process_verified_subscription_payment` verifies provider signature/amount/currency and creates/activates a subscription, but it does not post a platform-wallet debit or canonical financial journal charge.

**Decision:** Do not enable subscription auto-debit or treat current Paymob subscription checkout as a ready wallet funding/billing path. Reconcile the exact live schema and Edge Function versions first.

## 4. Wallet — existing tables, blocked posting contract

### Schema and controls
- `wallet_accounts` supports owner types CUSTOMER, MERCHANT, PARTNER, SYSTEM; unique tenant + owner type + owner ID; status ACTIVE/FROZEN/CLOSED; `allow_negative=false` by default.
- `wallet_transactions` supports CREDIT, DEBIT, REFUND, ADJUSTMENT, COMMISSION_SETTLEMENT; amount must be positive; idempotency key is unique; status supports PENDING/CONFIRMED/REVERSED/FAILED.
- Both tables have RLS and FORCE RLS. No anon table access. Authenticated reads are policy-limited to tenant roles OWNER/ADMIN/MANAGER/FINANCE/ACCOUNTANT/FINANCE_MANAGER. Direct client writes are not granted. Service role has table DML privileges.
- Wallet rows and transaction rows were both zero at capture time.

### Blocking execution path
- `create_wallet_transaction_backend(...)` exists but effective EXECUTE is false for anon, authenticated, and service_role.
- Its body calls `assert_financial_membership`, locks the wallet row, checks idempotency and balance, then calls `post_financial_journal` before inserting the wallet transaction.
- `post_financial_journal(jsonb,jsonb)` and `post_financial_journal_backend(uuid,jsonb,jsonb)` currently have EXECUTE false for service_role.
- Live journal header/line columns required by the reviewed RC449A/RC450 contract are absent; see `PRODUCTION_FINANCE_LIVE_CONTRACT_RECHECK_20261031.md`.
- Therefore the current wallet RPC path cannot be assumed operational. Do not bypass it with direct wallet table writes or broad GRANTs.
- The current transaction function inserts CONFIRMED transactions; no subscriber top-up intent/approval workflow was identified. A PENDING transaction status alone is not a verified top-up workflow.
- Current wallet calculation recognizes CREDIT/REFUND as positive and DEBIT/COMMISSION_SETTLEMENT as negative; ADJUSTMENT is not included in the balance expression. This requires explicit semantic reconciliation before any use.

## 5. Advertising inventory — existing display records, no booking engine

> Historical first-pass ACL/policy interpretation below is superseded by the dated live recheck addendum near the end of this document. The current disposition is P2 least-privilege ACL verification; no permissive authenticated write policy is present.

- `ad_spaces` currently has two rows: HOME_HERO and HOME_SPONSORED.
- `advertisements` is tenant/business scoped and has creative, approval, status and start/end timestamps, but no price snapshot, duration contract, reservation status, payment status, renewal or exclusive-slot conflict model.
- `platform_global_advertisements` has four rows and direct authenticated access is denied; platform-managed reads/writes must remain behind the intended trusted backend.
- No `advertising_reservations`, ad-space price-version, or month-duration booking relation was found in the inspected public schema.
- The live `ad_spaces` table has RLS + FORCE RLS, but multiple permissive policies grant ALL to any non-anonymous authenticated session; effective authenticated INSERT and UPDATE table privileges are true. This is a high-priority authorization gap. Do not expose slot administration in the UI until it is corrected in a reviewed forward-only migration and tested. No live policy was changed in this audit.
- Existing `advertisements` policies bind managers to tenant membership but not to a specific business/branch. Review this separately before allowing owner-facing advertisement mutations.

## 6. Requested capabilities still missing

1. Versioned pricing composition: subscription only, commission only, or both.
2. Subscription charge: fixed, percentage, or fixed + percentage with explicit basis and effective period.
3. Automatic monthly/quarterly/custom recurring platform charge creation and immutable snapshots.
4. Wallet account lifecycle for verified account users (visitor must establish/verify an account before persistent value is stored).
5. Direct/card top-up, Vodafone Cash verification, and cash-outside-platform receipt + maker/checker approval.
6. Pending/confirmed top-up state, webhook replay protection, idempotency, and reconciliation.
7. Automatic platform fee/subscription debit from available wallet balance only; insufficient balance stays due without negative balance.
8. Admin exemption/discount/defer/gift workflows with reason, actor, audit, maker-checker where needed. Existing due-date edit and initial free activation do not implement the full requested adjustment model.
9. Advertising cover inventory with monthly, quarterly, half-yearly, annual, and custom-month reservations, pricing snapshots, conflict prevention, creative approval, payment/waiver, pause, expiry and renewal.
10. A clear boundary preventing merchant-to-customer sale proceeds from ever entering MantiqaTix wallet/settlement.

## 7. Required next engineering sequence

1. Restore a complete schema-only current-production capture into an isolated disposable PostgreSQL/Supabase environment. Existing October 17 baseline and targeted fixtures are not a current-schema restore.
2. Reconcile 308 migrations, physical schema drift, journal columns/RPCs, service-role ACLs, Edge Function source parity and payment provider contracts.
3. Design a single platform-charge ledger contract that reuses canonical journal and wallet primitives; do not duplicate wallet tables or write balances directly.
4. Add versioned subscription pricing composition and immutable charge snapshots only after the schema baseline is restored and migration tooling is available.
5. Add top-up intent/provider adapters and external-cash approval; verify Paymob/card/Vodafone Cash channel capabilities against actual provider contracts.
6. Build advertising slot pricing/reservations and fix `ad_spaces` authorization before allowing booking mutations.
7. Run adversarial RLS, ledger balance, concurrency, idempotency/replay, webhook, due-date scheduler, insufficient-balance, maker-checker, ad overlap, backup/restore and sandbox E2E tests.
8. Obtain Egypt-specific legal/accounting review before enabling stored-value balance or cash collection.
9. Keep all new wallet/automatic billing/ad-booking actions disabled until exact-head CI, isolated rehearsal and explicit release approval pass.

**Production effect:** NONE. This document records read-only metadata and function/ACL inspection only. No DDL, DML, grants, RLS, Auth, Edge Function deployment, wallet movement, payment, or advertising reservation was performed.

**Release decision:** FIN-ADS-01 remains BLOCKED / NOT CERTIFIED for production activation.


## Addendum — 2026-10-31 current-policy / ACL recheck (read-only)

This addendum supersedes the earlier paragraph in Section 5 that characterized the four generic `ad_spaces` guard policies as permissive. A fresh live catalog query shows:

- `public.ad_spaces` has RLS and FORCE RLS enabled.
- Its only permissive policy for `authenticated` is `ad_spaces_authenticated_read` (SELECT).
- The four generic ALL policies — `authenticated_sessions_only`, `deny_anonymous_users`, `mnt_non_anonymous_boundary`, and `non_anonymous_authenticated_guard` — are all **RESTRICTIVE**, not permissive.
- The live catalog reports **zero authenticated permissive INSERT/UPDATE/DELETE/ALL policies** and one permissive SELECT policy. With RLS + FORCE RLS, the current policy set is deny-by-default for authenticated DML. No authenticated write attempt was made; this is catalog evidence, not a real-user API exploit test.
- Effective ACLs remain broader than necessary: `authenticated` has SELECT/INSERT/UPDATE/DELETE/MAINTAIN; `anon` has MAINTAIN only; `service_role` retains SELECT/INSERT/UPDATE/DELETE/MAINTAIN.
- No direct frontend or Edge Function caller for `public.ad_spaces` was found in the current code search. The public ad-delivery path uses the targeted-ad RPC; global ad inventory is separately protected behind service-role access.

**Corrected disposition:** the earlier P0 broad-permissive-policy characterization is not supported by the current live policy catalog. No broad authenticated DML path is established. Track this as **P2 least-privilege ACL hardening and runtime verification**: after the current-schema restore, verify the grant provenance/default privileges, test a narrowly scoped revoke of unnecessary authenticated INSERT/UPDATE/DELETE/MAINTAIN and anon MAINTAIN, preserve authenticated SELECT and service-role backend operations, and prove the intended outcomes with isolated SQL/API tests. Do not change Production grants or policies in this audit. Ad booking/pricing remains unimplemented and disabled.

## Addendum — 2026-10-31 advertisements tenant/business scope review (read-only)

Fresh live inspection of `public.advertisements` found:

- The table currently has **0 rows**; no existing ad records are affected.
- RLS + FORCE RLS are enabled. `authenticated` has table SELECT/INSERT/UPDATE/DELETE; `anon` has none; `service_role` retains backend access.
- Required `tenant_id` has an FK to `tenants(id)`. Required `business_id` is UUID but has no FK to `businesses(id)` and no composite tenant/business constraint.
- Authenticated SELECT permits any ACTIVE membership in the same tenant.
- Authenticated INSERT/UPDATE/DELETE permits ACTIVE tenant membership with role OWNER, ADMIN or MANAGER. The write predicates check tenant and role, not the row's business_id or membership branch_id.
- Live membership inventory contains business/branch-scoped BUSINESS_OWNER memberships, tenant-wide OWNER/ADMIN/MANAGER memberships, and tenant-wide manager memberships; BUSINESS_OWNER is not included in the current policy role list. OWNER is accepted without checking whether that particular membership is business/branch-scoped.
- No direct browser `.from('advertisements')` consumer was found in the canonical source search; public delivery uses `get_mnty_targeted_advertisements`. The app has historically guarded against direct browser mutation of protected tables.

**Disposition:** no exploit is established: there are no rows and no authenticated write attempt was made. Tenant-wide ad management may be intended for tenant admins/managers. However, the current schema/policies do not prove business/branch isolation for business-scoped membership, and the missing business FK permits an invalid business/tenant pair unless a trusted write path validates it. Issue [#612](https://github.com/islamnagy2022-eng/MantiqaTix/issues/612) tracks authority-matrix confirmation and isolated tests. Do not enable owner-facing ad mutations or booking until scope is confirmed and negative tests pass.


### Additional integrity check — trigger/constraint compensation
A second read-only query checked non-internal triggers on `public.advertisements`: **none are defined**. `businesses` has a global UUID primary key and a unique `(tenant_id, code)` index, but no unique `(id, tenant_id)` key for a composite FK target. The only deferred trigger found is on `businesses` itself and does not establish an advertisement-to-business check. Thus no trigger-based tenant/business validation was identified. This remains a design/verification concern only: no rows exist and no write attempt was made.
