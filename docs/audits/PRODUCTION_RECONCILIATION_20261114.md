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


## Critical Edge Function source parity — 2026-11-14

A read-only comparison retrieved the deployed `index.ts` entrypoint for 11 critical Edge Functions and compared it byte-for-byte with the current `main` source. Live bundle SHA-256 values and repository blob SHAs are recorded in the machine-readable reconciliation manifest.

- **7/11 entrypoints differ from current main:** `order-create` v8, `payment-intent` v8, `paymob-webhook` v10, `digital-page-payment-intent` v5, `subscription-payment-intent` v4, `financial-journal` v3, and `directory-listings` v16.
- **4/11 entrypoints match exactly:** `smm-gateway` v13, `api` v17, `order-status-update` v4, and `payment-webhook` v3. Exact source parity does not close their separate runtime authorization, webhook replay, order-state, or SMM deferred-launch tests.
- The six payment/order/finance differences retain the previously identified gaps: bounded request parsing and branch/option validation in `order-create`; Paymob amount/intent correlation in payment-intent and digital/subscription intent creation; finite amount and callback-to-order binding in `paymob-webhook`; and allow-listed CORS plus the canonical journal backend RPC in `financial-journal`.
- **New drift:** live `directory-listings` is v16, not the previously recorded v8. It adds public metadata sanitization and doctor source-permission workflow changes, and also adds localhost:5173 CORS origins. Its two helper files (`pagination-filter.mjs` and `doctor-import-contract.mjs`) match main; only `index.ts` differs. The live `BULK_IMPORT` requires approved source evidence but honors requested PUBLISHED status, and direct `UPSERT_LISTING` can publish a doctor with a valid phone and no source evidence. Current main has staging-only bulk import and a reviewed publication gate for new doctor publication, draft-to-public transitions and source changes. The evidence table enforces `approved_by`/`approved_at` and `approved_by != created_by`. The live function also derives `is_verified` from `verified_by`, but that field is set by the owner-claim flow, not professional-registration verification; do not port that ambiguous public badge. Preserve the live metadata sanitizer, port the stricter main publication gate, and remove Vite development origins before deployment. The exact deployed `index.ts` is preserved at `docs/audits/snapshots/directory-listings-v16-live-index.ts.txt`; the captured source passed a secret-pattern scan.
- No Edge Function was deployed or modified. Draft PR #728 prepares a safe `directory-listings` source reconciliation (metadata sanitizer + private identity stripping, while retaining the stricter main publication gate); it does not change Production. The seven source mismatches remain release blockers; deploy the six payment/order/finance functions only as a coordinated, schema-compatible release after migration reconciliation and real Paymob sandbox E2E.



## Payment, disaster recovery and Auth gates — 2026-11-14

- Read-only inspection of `public.tenant_payment_methods` found **zero rows**. Only provider, method, enabled state and the public environment label were queried; `provider_secrets` was not selected. The available connector does not expose Edge Function secret names/values, so Paymob sandbox readiness is unverified. No payment, webhook replay, refund, settlement or financial E2E was initiated.
- The six payment/order/finance Edge Functions and the additional `directory-listings` v16 source drift must be reconciled before a meaningful sandbox E2E. Do not run payment tests against Production.
- The available Supabase connector does not expose backup inventory or restore-rehearsal operations. No restore was attempted; backup retention, recovery-point objective (RPO), and recovery-time objective (RTO) remain unverified.
- The connector does not expose project Auth security configuration. The prior 2026-11-06 advisor snapshot reported leaked-password protection disabled; owner-dashboard confirmation and remediation evidence remain required. No Auth setting was changed.
- Current security advisor/catalog snapshot: **9** RLS-enabled tables without policies; none has direct `anon` or `authenticated` table grants. **1** anon-executable SECURITY DEFINER function (`get_mnty_targeted_advertisements()`) is an intentionally public approved-active-ad retrieval function with an empty search_path. **65** SECURITY DEFINER functions are executable by `authenticated`; these are generic review findings and must be assessed individually, not blanket-revoked. **28** multiple-permissive-policy lints remain; PRs #725/#727 address the relevant business/branch/order scope. Health advisor returned **0** lints.

