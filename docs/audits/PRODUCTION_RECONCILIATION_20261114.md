# Production migration and object reconciliation — 2026-11-14

**Environment:** Active Supabase project `MANTIQATIX FINAL`  
**Method:** Read-only inspection only. No migration, DDL, DML, grant, Auth, RLS, Edge Function, payment or finance mutation was performed.  
**Release result:** `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

## Live migration ledger

- Live migration ledger: **310 records**, latest `20261110150618` (`revoke_public_execute_from_trigger_functions`).
- Canonical release migration identifiers checked: **42**.
- Exact required identifiers found in the live ledger: **0/42**.
- Missing exact identifiers: all 42; see `docs/release/production-migration-reconciliation.json` for the exact list.
- This is an identity mismatch, not proof that every physical effect is absent. Some effects exist through older or differently versioned migrations. Do not fabricate migration ledger rows, rewrite historical versions, or apply the 42 files blindly.

## Required physical object check

The current contract contains 60 required objects. The fresh catalog query found:

- **31/60 physically present**.
- **29/60 physically absent**.
- The semantic manifest retains **28 PASS / 32 non-PASS**. The difference is intentional: three objects are present but still blocked by semantic, search_path, ACL or companion-object requirements.

### Physically absent objects

- `public.businesses.mnty_business_default_images`
- `public.catalog_items.mnty_catalog_item_default_image`
- `public.claim_subscription_provider_intent_creation_backend`
- `public.create_purchase_order_with_lines_backend`
- `public.create_subscription_payment_intent_claimable_backend`
- `public.erp_purchase_order_lines`
- `public.erp_purchase_order_lines_scope_idx`
- `public.erp_purchase_orders_business_order_number_uidx`
- `public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)`
- `public.journal_entries_tenant_entry_number_uidx`
- `public.journal_entry_lines_entry_line_uidx`
- `public.mantigo_payment_provider_events`
- `public.marketing_services.image_source`
- `public.marketing_services.mnty_marketing_service_default_image`
- `public.mnty_default_business_images_trigger`
- `public.mnty_default_catalog_item_image_trigger`
- `public.mnty_default_image_url`
- `public.mnty_default_marketing_service_image_trigger`
- `public.post_financial_journal_atomic_backend`
- `public.process_verified_mantigo_payment_backend`
- `public.process_verified_provider_payment_failure`
- `public.process_verified_subscription_payment_backend`
- `public.process_verified_subscription_payment_failure`
- `public.receive_purchase_stock_atomic_backend`
- `public.receive_purchase_stock_with_order_line_backend`
- `public.set_purchase_order_lines_backend`
- `public.smm_wallet_transactions_reference_type_uidx`
- `public.uq_payment_intents_one_active_per_order`
- `public.ux_user_memberships_user_business_branch_nullsafe`

### Present but still blocked

- `public.process_verified_digital_page_payment_backend` — Live function exists and service_role EXECUTE is present, but live search_path is public, pg_temp (source expects empty search_path); full body/ACL contract reconciliation and runtime payment/webhook E2E remain open.
- `public.update_purchase_order_status_backend(varchar,varchar)` — Live two-argument function exists, but search_path=public and ACL is postgres-only; authenticated and service_role lack EXECUTE. RC438 source contract is not met.
- `public.marketing_services.image_url` — Column now exists in the live schema, but image_source and the required default-image function/trigger chain remain absent; the full RC117 contract is still blocked.

### Important partial change

`public.marketing_services.image_url` now exists. The full RC117 media contract remains blocked because `image_source` and the required default-image functions/triggers are still absent.

## Related live security findings

- `private.platform_admins` has RLS enabled but FORCE RLS disabled; table owner and the shared helper owner are `postgres`. `postgres` and `service_role` have BYPASSRLS; `anon` and `authenticated` do not.
- `businesses`, `branches`, and `orders` have RLS enabled and FORCE RLS enabled, but the current policies still include broad tenant-level reads. Draft PR #725 narrows order reads; draft PR #727 narrows business/branch reads.
- The deployed financial-report RPC references `amount` and `captain_amount`, which do not exist in the live ledger table. Draft PRs #722 and #724 now use `gross_amount`, `commission_amount`, and `captain_net_amount`, with a disposable regression test.

## Required next steps

1. Reconcile each of the 42 exact migration identities against its physical effect and alias evidence; do not blindly replay.
2. Resolve the remaining 29 absent objects and three present-but-blocked objects with reviewed forward migrations and isolated replay.
3. Complete exact Edge Function parity, payment/Paymob/finance E2E, backup/restore and measured RPO/RTO, Auth settings evidence, and adversarial tenant-isolation tests.
4. Keep Production blocked until all required evidence, rollback rehearsal, human review and explicit release approval are complete.

**No Production mutation was performed.**
