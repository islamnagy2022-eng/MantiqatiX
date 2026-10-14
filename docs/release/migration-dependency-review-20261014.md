# Migration dependency and risk review — 2026-10-14

**State:** PARTIAL / NOT VERIFIED  
**Basis:** Added SQL patch lines for the 16 missing required files from PR #207, cross-checked against the current-main 28-file inventory and the read-only live migration ledger. This is static source review, not execution evidence.  
**Live ledger snapshot:** 283 rows; latest `20261008222845` / RC424.  
**Release gate:** BLOCKED / NOT CERTIFIED.

## Explicit dependency / sequencing findings

| Migration | Source-backed dependency or ordering fact | Preflight / safety requirement | Status |
|---|---|---|---|
| RC425 `20261009120000` | References existing `public.mantigo_financial_ledger` and `public.notifications`; creates provider-event ledger and SECURITY DEFINER backend RPC. | Confirm referenced columns/constraints and webhook identity fields; test idempotency, replay, ledger ownership and ACLs. | PARTIAL |
| RC426 `20261009130000` | Replaces `finalize_digital_page_payment_intent_backend` and updates `digital_page_orders`. | Review function signature change and ACL change carefully: one replacement grants EXECUTE to `authenticated`; prove authorization inside the function and negative cross-tenant tests. | SECURITY REVIEW REQUIRED |
| RC427 `20261009140000` | Adds unique index for one active payment intent per order. | Preflight duplicates against the exact partial-index predicate; verify index expression and failure behavior on representative data. | DATA PREFLIGHT REQUIRED |
| RC428 `20261009150000` | Uses `payment_intents`, `orders`, and `payment_provider_events`. | Test failure webhooks, duplicate/replayed events, amount/currency/order binding and concurrent deliveries. | PARTIAL |
| RC429 `20261009160000` | Uses `subscription_payment_intents`, `businesses`, and `payment_provider_events`. | Test tenant resolution, event idempotency, failure transitions and replay. | PARTIAL |
| RC430 `20261009170000` | Uses subscription intents, memberships, business subscriptions and `legal_assert_action`. | Confirm helper availability/signature and legal gate prerequisites; test subscription activation authorization and duplicate success webhooks. | DEPENDENCY CHECK REQUIRED |
| RC431 `20261009180000` | Replaces digital-page payment backend and reads/writes `digital_page_orders` plus `digital_page_payment_events`. | Confirm event table constraints/RLS and reconcile the separate Security Advisor finding (RLS enabled with no policies) before rollout. | SECURITY REVIEW REQUIRED |
| RC432 `20261009190000` | Explicitly aborts when duplicate SMM wallet transaction references exist; replaces wallet RPCs/index. | Mandatory duplicate scan and wallet-balance reconciliation; verify staged `smm-gateway` rollout compatibility before changing service-role grants. Never bypass the intentional fail-closed check. | HARD STOP UNTIL PREFLIGHT |
| RC434 `20261009200000` | Creates/replaces atomic ERP receiving backend using purchase orders, warehouses, catalog items, receipts, stock balances and inventory transactions. | Verify exact table/column contracts and idempotent receipt semantics. RC437 later replaces the receiving path and revokes service_role on the legacy RPC. | PARTIAL; RC437 ORDERED AFTER |
| RC435 `20261009210000` | Alters `subscription_payment_intents`; uses memberships, `legal_assert_action`, and `subscription_tier_prices`. | Confirm columns/constraints and pricing source; test idempotency-key collision, provider-intent claim/release and tenant binding. | DEPENDENCY CHECK REQUIRED |
| RC436 `20261009220000` | Alters journal entries/lines; uses memberships, businesses, chart of accounts and journal RPCs; creates unique indexes. | Preflight duplicate tenant entry numbers and line numbers, recompute debit/credit totals, validate existing data, and prove balanced atomic posting. | DATA + FINANCE PREFLIGHT REQUIRED |
| RC437 `20261009230000` | Creates `erp_purchase_order_lines`; defines line-aware receiving and replaces `receive_purchase_stock_atomic_backend`. | Requires ERP order/catalog/receipt/stock schemas; preflight duplicate business/order numbers and verify old/new receiving RPC callers before revoking legacy service_role execution. | PARTIAL; MUST PRECEDE RC438 |
| RC438 `20261009240000` | Its SQL comment explicitly says it depends on RC437 line schema and line-aware receiving wrapper. | Enforce timestamp order RC437 → RC438; test totals, branch/tenant isolation, repeated request idempotency and order-status transitions. | EXPLICIT DEPENDENCY |
| RC439 `20261010010000` | Adds encrypted checkout-recovery fields to subscription payment intents. | Confirm cipher/key-version contract, secret custody, rotation and recovery failure behavior; no key material in SQL/source. | SECURITY REVIEW REQUIRED |
| RC440 `20261010020000` | Scans SECURITY DEFINER functions with `search_path=public` to harden search_path. | Validate the exact function set changed, preserved ACLs/signatures, excluded extension/system functions and rerun SECURITY DEFINER contract tests. | SECURITY REVIEW REQUIRED |
| RC441 `20261010030000` | Adds platform-admin helper and MantiGo admin/settlement/report RPCs using memberships, rides, financial ledger, audit logs and notifications. | Review every changed RPC for caller authorization and tenant scope. Authenticated EXECUTE grants are not proof of safe internal authorization; require negative tests and finance/tenant E2E. | SECURITY + FINANCE REVIEW REQUIRED |

## Sequencing conclusions

1. Required release order is by migration timestamp, not RC label. The filenames deliberately put RC446 before RC442 by timestamp; do not sort by numeric RC suffix.
2. RC437 must precede RC438 (explicit source comment). RC434 precedes RC437 because RC437 changes the receiving implementation and revokes service-role execution on the prior RPC.
3. RC432, RC427, RC436 and RC438 have plausible data-dependent failure points (duplicate references, active intents, journal uniqueness/line numbering, and order-number uniqueness). These require exact data preflight in a disposable copy; static source inspection cannot prove production data is safe.
4. RC426 and RC441 alter callable backend surfaces/grants; RC431 intersects the known digital-page payment-event RLS finding; RC439 introduces encrypted recovery fields; RC440 mutates SECURITY DEFINER search paths. These require focused security/ACL tests, not only migration replay.
5. No full dependency graph, clean chronological replay, schema diff, payment/finance E2E, tenant-isolation E2E, backup/restore rehearsal or production approval is evidenced by this review.

## Next executable work

- Obtain a disposable PostgreSQL/Supabase environment and a sanitized schema/data fixture. Do not use production as a replay target.
- Resolve the required source files from an authoritative candidate commit, preserve exact bytes and immutable version identities, and validate duplicate versions/aliases across the entire chain.
- Run ordered replay and all migration-specific tests in that disposable environment; record command, environment, commit SHA, results, and schema/function/policy/grant diff.
- Only then prepare a reviewed source-recovery PR. Do not merge any candidate PR or apply production migrations from this report.

