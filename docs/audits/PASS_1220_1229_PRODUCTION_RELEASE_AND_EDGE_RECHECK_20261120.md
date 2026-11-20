# Pass 1220–1229 — Production release-gate and Edge parity recheck

**Date:** 2026-11-20  
**Repository baseline:** `main` at `57862b714c0b049419204b6143b966c149682906`  
**Supabase project:** `moyhiluyhjsujhwlyeuu` (ACTIVE_HEALTHY, PostgreSQL 17.6.1.155, Free plan)  
**Method:** read-only Supabase SQL, Supabase Edge bundle retrieval, exact UTF-8 entrypoint comparisons against current `main`, GitHub merged-PR/workflow evidence.  
**Production mutations:** NONE.  
**Full platform gate:** **BLOCKED / NOT CERTIFIED**.

## 1. RC484 source and isolated verification

- PR [#870](https://github.com/islamnagy2022-eng/MantiqaTix/pull/870) merged RC484 at `902e4059c76da7b5da3c6ca354a11eefdd36ed4f`.
- The migration changes `public.is_platform_admin()` to consult only `private.platform_admins`, enables FORCE RLS on that registry, pins an empty search_path, and preserves the client-inaccessible registry boundary. Existing tenant-local predicates are not globally replaced.
- Exact-head PostgreSQL 17 adversarial integration passed: [run 44598309128](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44598309128).
- Exact-head disposable chronological replay passed: [run 44598309101](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44598309101), applying 99 post-checkpoint migration files through RC484. This is replay against an isolated copy of the captured schema checkpoint, not a Production deployment.
- Pages/catalog validation and Module Professionalization checks passed on the PR head. The Pages deploy job was skipped for the pull-request event; no Production website deployment is claimed.
- Issue [#867](https://github.com/islamnagy2022-eng/MantiqaTix/issues/867) remains open until live deployment and post-deployment verification of all 57 policies.

## 2. Fresh Production migration-ledger result

A fresh read-only query against `supabase_migrations.schema_migrations`, using the exact 64 migration identifiers from current `main`, returned:

| Check | Live result |
|---|---:|
| Applied migration rows | 310 |
| Latest recorded version | `20261110150618` |
| Required release identifiers | 64 |
| Required identifiers present | **0** |
| Required identifiers missing | **64** |

The missing list includes the payment/webhook and financial journal chain, RC449A/RC450, RC464/RC471, RC482/RC483 and RC484. This is a migration-history identity gap. It is not proof that every intended object is physically absent, and it is not permission to fabricate ledger rows or replay migrations directly against Production.

The production release manifest is updated in this change to track 64 identifiers and the current read-only evidence.

## 3. Fresh exact Edge Function parity comparison

All 11 functions in the release parity contract were retrieved from Production and compared byte-for-byte with the matching current-main `index.ts`. Seven entrypoints differ; four match.

| Function | Live version | Live entrypoint bytes | Main entrypoint bytes | Exact match |
|---|---:|---:|---:|---|
| `order-create` | 8 | 10,083 | 13,988 | No |
| `payment-intent` | 8 | 8,114 | 10,146 | No |
| `paymob-webhook` | 10 | 11,538 | 12,376 | No |
| `digital-page-payment-intent` | 5 | 5,345 | 6,532 | No |
| `subscription-payment-intent` | 4 | 5,196 | 11,100 | No |
| `financial-journal` | 3 | 1,591 | 3,387 | No |
| `directory-listings` | 16 | 46,907 | 51,305 | No |
| `api` | 17 | 16,432 | 16,432 | Yes |
| `order-status-update` | 4 | 1,986 | 1,986 | Yes |
| `payment-webhook` | 3 | 3,356 | 3,356 | Yes |
| `smm-gateway` | 13 | 20,040 | 20,040 | Yes; launch remains deferred |

### Payment, order and finance differences

- **`payment-intent` v8:** deployed source does not run the shared Paymob intention-correlation helper, does not require the provider order ID, and does not persist `provider_order_id`. Current main validates exact cents, amount, currency, reference and provider identifiers before persistence.
- **`paymob-webhook` v10:** deployed source does not call the atomic provider-failure processor. Current main binds the candidate intent to the HMAC-covered Paymob order ID and uses atomic success/failure RPCs. The old deployed path is not accepted as equivalent.
- **`subscription-payment-intent` v4:** deployed source lacks claim-based provider creation, strict Paymob response correlation and encrypted/versioned checkout-secret storage/recovery.
- **`digital-page-payment-intent` v5:** deployed source lacks the provider-order-bound finalizer and shared Paymob response correlation used by current main.
- **`financial-journal` v3:** deployed source uses wildcard CORS and the legacy journal RPC; current main uses an allowlisted origin and `post_financial_journal_backend` with the verified actor ID.
- **`order-create` v8:** deployed source lacks the current 256 KiB bounded streaming parser, strict JSON/body validation, exact selected-branch membership check, bounded/unique option validation and option-to-item relationship check. The main source has a static booking/payment contract validator; no live order was invoked.
- **`directory-listings` v16:** remains byte-different from current main. Preserve its reviewed public-field sanitization; reconcile the stricter source-permission publication contract as a separate controlled change. Do not deploy current main wholesale.
- **`smm-gateway` v13:** source bytes match; `SMM_INITIAL_LAUNCH_DEFERRED` remains in force, and runtime negative-request verification is still outstanding.

Do not deploy these Edge functions individually. The payment and finance functions depend on the ordered database/RPC/ACL chain, matching secret configuration, sandbox tests and rollback evidence.

## 4. Fresh payment and financial-schema checks

Read-only SQL returned zero rows in `payment_intents`, `payment_provider_events`, `subscription_payment_intents` and `digital_page_payment_events`. No live payment, refund, settlement or journal operation was invoked.

The live database still lacks:
- The active-intent partial unique index `uq_payment_intents_one_active_per_order`.
- The source-required subscription claim/encryption columns: `provider_creation_state`, `provider_creation_claimed_at`, `client_secret_ciphertext`, `client_secret_iv`, `client_secret_key_version`.
- The current provider-order-bound digital-page finalizer and subscription/provider failure/success RPC signatures.
- The current atomic standard provider-failure RPC signature.
- The RC449A/RC450 journal columns: `journal_entries.entry_number`, `total_debit`, `total_credit`, `posted_at`, `updated_at`, `reversed_by_entry_id`, and `journal_entry_lines.line_number`.

`post_financial_journal_backend(uuid,jsonb,jsonb)` exists in Production, but effective EXECUTE is false for anon, authenticated and service_role; its live search_path remains `public`. The approved source sequence remains RC449A schema prerequisites → RC450 actor/business/branch-scoped service-role boundary → matching Edge bundle.

The live `create_order_backend` grants service_role EXECUTE, but its body still unconditionally requires `auth.uid() = p_customer_id`. The deployed `order-create` Edge calls through a service-role client after separately verifying the bearer user; the RC105 service-role identity exception is absent from the live function. This is a source/definition-based expected failure, not a reproduced customer transaction. No order RPC was called.

## 5. Platform authorization recheck

- `public.is_platform_admin()` remains SECURITY INVOKER with `search_path=public`; it still checks for any active tenant ADMIN/SUPER_ADMIN membership.
- 57 RLS policies across 24 tables still call it.
- `private.platform_admins` has RLS enabled and no anon/authenticated table SELECT, but FORCE RLS is still disabled in Production. The registry owner is postgres.
- `public.mnty_can_platform_admin()` remains SECURITY DEFINER with `search_path=public, pg_temp` and delegates to `public.mnty_can('admin',NULL,NULL,NULL)`.
- Five RLS policies across three tables call `mnty_can_platform_admin()`. Four additional SECURITY DEFINER functions directly call it: `admin_create_global_ad`, `fulfill_digital_page_publish`, `review_mantigo_captain_application`, and `set_mantigo_financial_config_backend`. Four global MantiGO RPCs are separately covered by the unapplied RC464/RC471 source repair.
- The current source repairs are merged and tested; no associated migration is recorded in the live ledger. Issues [#867](https://github.com/islamnagy2022-eng/MantiqaTix/issues/867) and [#852](https://github.com/islamnagy2022-eng/MantiqaTix/issues/852) remain open.

## 6. Security and performance Advisor snapshot

Fresh Supabase Advisor retrieval at 2026-11-20 returned:
- Security: 94 lint entries — 1 INFO and 93 WARN. The groups include 9 RLS-enabled/no-policy INFO tables, 1 anon-executable SECURITY DEFINER function (the public targeted-ad read RPC), 65 authenticated-executable SECURITY DEFINER findings, 90 anon-policy warnings, and 1 leaked-password-protection warning.
- Performance: 4 lint groups — 132 unindexed-FK findings, 375 auth/RLS initplan findings, 70 unused-index findings, and 28 multiple-permissive-policy findings.
- A separate current `pg_policies` query found 21 policies across 21 tables whose role set includes anon/public. These inventories require individual policy/RPC review; Advisor counts are not proof that every finding is an exploitable data exposure. No blanket EXECUTE revocation or broad anon-policy rewrite is justified.
- Leaked-password protection is reported disabled. The connected Supabase tools do not expose the Auth configuration write path; owner-dashboard remediation evidence is still required.

## 7. Backup/restore and release decision

- The Supabase organization plan is Free. PR [#872](https://github.com/islamnagy2022-eng/MantiqaTix/pull/872) added the operator export/restore runbook.
- PR [#875](https://github.com/islamnagy2022-eng/MantiqaTix/pull/875) merged the encrypted off-site backup manifest/evidence verifier; its disposable tests passed. It verifies operator-provided evidence only.
- No live database export, Storage object export, Vault key recovery, off-site transfer, isolated restore, RPO/RTO measurement or rollback rehearsal was executed in this pass. Required operator workstation, DB credentials, Storage credentials, encryption recovery identity and off-site destination are not available through the current connected tools.

**Release disposition:** **BLOCKED / NOT CERTIFIED.** No Production DDL/DML, migration, ledger, RLS, GRANT, Auth, Storage, Edge deployment, customer order, payment, wallet, settlement or financial journal mutation was performed. Do not enable Paymob or promote the R7 archive. Complete the operator backup/restore gate and approved ordered rollout before any Production migration or coordinated Edge deployment.
