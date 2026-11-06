# Production read-only reconciliation — 2026-11-06

## Snapshot metadata

- Repository source branch: `feat/v6-r5-preview-foundation-20261106`
- Source commit when the snapshot was recorded: `97ea87618f4c08ab6cf67bd09a647c86e1ce0f17`
- Supabase project: MantiqatiX Production (project reference retained in repository configuration; intentionally not repeated in this report).
- Read-only snapshot window: 2026-11-06 13:47–13:50 UTC.
- Operations: Supabase migration/function/table inventories, function source retrieval, PostgreSQL catalog `SELECT` queries, and Supabase security advisors.
- **No production writes were made.** No migration, function deployment, schema change, grant, Auth setting, financial operation or business-data mutation was performed.

## Migration ledger

Fresh `list_migrations` returned **309 records**, latest:

- Version: `20261101140105`
- Name: `directory_source_permission_evidence`

The 42 exact release-required identifiers in `docs/release/production-migration-reconciliation.json` were compared against those 309 live version IDs:

- Exact required version IDs present: **0 / 42**
- Exact required version IDs missing: **42 / 42**

The missing identifiers are enumerated in the reconciliation JSON under `required_release_migration_ledger_check.missing_versions`. The result is an exact version-identity comparison only. It does **not** establish that every corresponding physical schema effect is absent: known aliases and forward repairs must be reconciled by exact stored statement/body and physical catalog evidence. Do not insert synthetic ledger rows, rewrite migration history, or replay migrations blindly.

## Critical Edge Function source parity

The six critical live Edge Function `index.ts` files were retrieved from Production and compared byte-for-byte to the corresponding `main` source file. All six differ:

| Function | Live version | Live source bytes | main source bytes | Exact match |
|---|---:|---:|---:|---|
| `order-create` | 8 | 10,083 | 13,988 | NO |
| `payment-intent` | 8 | 8,114 | 10,366 | NO |
| `paymob-webhook` | 10 | 11,538 | 12,665 | NO |
| `digital-page-payment-intent` | 5 | 5,345 | 6,532 | NO |
| `subscription-payment-intent` | 4 | 5,196 | 11,100 | NO |
| `financial-journal` | 3 | 1,591 | 3,387 | NO |

Specific observed example: live `financial-journal v3` uses wildcard CORS and calls legacy `post_financial_journal`; the current source uses `post_financial_journal_backend` and a constrained origin policy. Do not deploy any one of these functions independently: the contracts are coupled to missing schema, RPC signatures, grants, and finance/payment E2E prerequisites.

Directory functions are on newer live versions (`public-catalog-directory v17`, `directory-listings v16`, both updated 2026-11-04); these are separate from the six financial/order functions and are already serving the public catalog.

## Physical schema and RPC preflight

Read-only PostgreSQL catalog checks at approximately 2026-11-06 13:48 UTC returned:

### Missing columns

- `public.journal_entries.entry_number`
- `public.journal_entries.total_debit`
- `public.journal_entries.total_credit`
- `public.journal_entries.posted_at`
- `public.journal_entry_lines.line_number`
- `public.businesses.mnty_business_default_images`
- `public.catalog_items.mnty_catalog_item_default_image`
- `public.marketing_services.mnty_marketing_service_default_image`
- `public.marketing_services.image_url`
- `public.marketing_services.image_source`

### Missing objects/indexes

- `public.mantigo_payment_provider_events` — absent.
- `uq_payment_intents_one_active_per_order` — absent.
- `smm_wallet_transactions_reference_type_uidx` — absent.

### Present object evidence

- `public.public_directory_listings` — present.
- `public.directory_source_permission_evidence` — present.

### RPC signatures and effective privileges

- `post_financial_journal_backend(uuid,jsonb,jsonb)`: exists, SECURITY DEFINER, `search_path=public`; no EXECUTE for `anon`, `authenticated`, or `service_role`.
- `post_financial_journal(jsonb,jsonb)`: exists, SECURITY DEFINER, `search_path=public`; no EXECUTE for `anon`, `authenticated`, or `service_role`.
- Required five-argument `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)`: absent.
- Older four-argument `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)`: present, SECURITY DEFINER, `search_path=public, pg_temp`; `authenticated` EXECUTE true, `anon` and `service_role` false.
- `process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)`: present, SECURITY DEFINER, `search_path=public, pg_temp`; `service_role` EXECUTE true, `anon` and `authenticated` false.
- `update_purchase_order_status_backend(varchar,varchar)`: present, SECURITY DEFINER, `search_path=public`; `anon`, `authenticated`, and `service_role` EXECUTE false.
- `process_verified_mantigo_payment_backend(uuid,uuid,text,text,text)`: absent.

These are targeted function/catalog checks, not a complete inventory of every RPC, grant, policy, or data path.

## Supabase security advisor snapshot

Security advisors observed at 2026-11-06 13:50 UTC returned 94 lint findings, grouped as follows:

| Advisor finding | Count | Level |
|---|---:|---|
| RLS enabled, no policy | 9 | INFO |
| Anonymous can execute SECURITY DEFINER | 3 | WARN |
| Authenticated can execute SECURITY DEFINER | 67 | WARN |
| Anonymous-access policy findings | 90 | WARN |
| Leaked-password protection disabled | 1 | WARN |

The three anonymous-executable SECURITY DEFINER functions identified are:

- `assign_default_owner_to_unowned_business()`
- `capture_commission_rule_audit()`
- `get_mnty_targeted_advertisements(...)`

These advisor findings are not a vulnerability count. The RLS-no-policy items and the 67 authenticated SECURITY DEFINER functions require individual review of table grants, call paths, function body authorization and intended exposure. Do not bulk-revoke grants or add broad policies to silence the advisor.

Leaked-password protection is reported disabled. This is an Auth security setting requiring owner-dashboard review and explicit owner action; no Auth setting was changed in this snapshot.

## Release blockers and safe continuation

Production remains **BLOCKED / NOT CERTIFIED** for the full platform.

1. Reconcile source-required migration IDs with stored live migration statements and physical objects. Preserve known exact aliases, including RC424; do not alter historical ledger rows.
2. Create/verify a current backup and complete a disposable restore rehearsal, recording RPO/RTO and rollback evidence.
3. Replay the complete forward migration chain chronologically in an isolated database cloned from a verified checkpoint. Keep all payment, wallet and finance E2E tests in that isolated environment.
4. Resolve the journal column/RPC/ACL contract in the isolated environment, including RC449A then RC450, and confirm service-role execution only through the intended Edge boundary.
5. Reconcile the six critical Edge Functions as one coupled release only after schema, ACL, callback signature, amount/currency/intent binding, idempotency, sandbox payment E2E and rollback evidence all pass.
6. Review Auth leaked-password protection in the owner dashboard; inventory security advisor findings function-by-function and table-by-table.
7. Keep SMM gateway launch deferred until anonymous/authenticated negative runtime tests are recorded.

No production repair or deployment is authorized by this report. The current catalog root remains in place; V6 remains a separately validated Preview artifact and is not deployed to the public Pages path.
