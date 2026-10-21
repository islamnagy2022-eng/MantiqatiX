# RC425–RC441 Source Recovery — 2026-10-21

## Result

- Restored the 16 missing migration source files from the previously reviewed recovery source commit `56dc3853be48fee413cbaf551fd350fe3f1df3ed`.
- Verified the Git blob SHA for each restored file matches the source blob exactly (16/16).
- Added through draft PR #315: https://github.com/islamnagy2022-eng/MantiqatiX/pull/315
- Existing migration files were not edited or deleted.
- No production database migration, Supabase write, Edge Function deployment, financial operation, merge, or production deploy was performed.

## Restored migration sources

- RC425 `20261009120000_rc425_atomic_mantigo_paymob_payment.sql`
- RC426 `20261009130000_rc426_digital_page_provider_order_binding.sql`
- RC427 `20261009140000_rc427_one_active_payment_intent_per_order.sql`
- RC428 `20261009150000_rc428_atomic_provider_failure_webhook.sql`
- RC429 `20261009160000_rc429_atomic_subscription_failure_webhook.sql`
- RC430 `20261009170000_rc430_atomic_subscription_success_webhook.sql`
- RC431 `20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql`
- RC432 `20261009190000_rc432_smm_wallet_transaction_idempotency.sql`
- RC434 `20261009200000_rc434_atomic_erp_purchase_receiving.sql`
- RC435 `20261009210000_rc435_subscription_provider_intent_claim.sql`
- RC436 `20261009220000_rc436_atomic_financial_journal.sql`
- RC437 `20261009230000_rc437_purchase_order_lines_receiving_limits.sql`
- RC438 `20261009240000_rc438_purchase_order_creation_with_lines.sql`
- RC439 `20261010010000_rc439_encrypted_checkout_recovery.sql`
- RC440 `20261010020000_rc440_exposed_security_definer_search_path.sql`
- RC441 `20261010030000_rc441_platform_admin_scope_hardening.sql`

## Verification state

- Migration filename uniqueness workflow: PASS on the PR head at the time of the check.
- Migration history immutability workflow: PASS on the PR head at the time of the check.
- Cross-PR migration collision guard: still running at the time of this note.
- Production verifier and release gate: not certified by source recovery alone.
- Production migration ledger was previously observed to end at RC424 (`20261008222845`); this PR does not apply the recovered migrations.
- Full chronological replay remains BLOCKED until authoritative historical creation DDL/version provenance for `public.counter_offer_indrive_bid(uuid,uuid,numeric)` is recovered and replay succeeds. Do not fabricate a stub, skip the historical revoke, or infer historical behavior from the current live function.
- Tenant isolation, payment/finance end-to-end, backup restore, Edge-function parity, and Auth security gates still require fresh evidence.

## Next safe steps

1. Finish all PR checks and review any migration collision report.
2. Recover the authoritative historical DDL and version provenance for `counter_offer_indrive_bid(uuid,uuid,numeric)`; do not guess.
3. Run full chronological replay in disposable PostgreSQL, followed by tenant-isolation and payment/finance regression tests.
4. Review the resulting migration sequence before any explicit production rollout approval.
