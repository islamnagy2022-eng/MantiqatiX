# CURRENT PRODUCTION RECHECK — 2026-11-28

This dated overlay supersedes the older current-status statements below. Historical observations remain preserved with their original dates.

- The connected project `MANTIQATIX FINAL` is ACTIVE_HEALTHY on PostgreSQL 17.6.1.155. The live migration ledger contains 310 rows through `20261110150618`.
- The current canonical release contract contains 90 unique, chronologically ordered migration versions. The current exact-version intersection with the live ledger is 0/90. This is an identity mismatch, not proof every physical effect is absent. Three documented legacy alias targets are present; do not fabricate ledger rows or replay aliases.
- Release review must reconcile the exact ordered 90-source migration effects against the live ledger and physical objects; disposable CI replay is not evidence of Production application or backup/restore.
- A direct read-only catalog probe of 79 canonical core/payment/control-center objects matched 37 and found 42 absent or non-matching by the required name/signature (core 11/32, payment 3/14, control-center 23/33). The probe does not verify ACL/RLS/ownership/runtime semantics.
- RC115 (`20261125130000`) adds tenant/business-bound CRM read policies. RC931 (`20261128010000`) retires the public ACTIVE provider-profile base-table policy only after RC479 raw-anon revocation, RC926 strict confirmed-Auth guard, RC115 CRM scope and the RC484 registry-only platform-admin helper are verified.
- RC931 now rejects the former `MNTY-PLATFORM` membership/`full_control` shortcut as a global-admin authority source. Its replacement CRM policy calls `public.is_platform_admin()` (backed only by `private.platform_admins`) or proves exact tenant/business membership. The source candidate remains unapplied.
- The exact 42 not-found group entries (36 unique object/signature names; six intentionally overlap Core and Payment groups) are itemized with source-migration mappings in [PRODUCTION_REQUIRED_79_OBJECT_READBACK_20261128.md](../audits/PRODUCTION_REQUIRED_79_OBJECT_READBACK_20261128.md). The probe's not-found status is by exact required signature/name, not a claim that every related business feature is absent.
- The platform-admin registry has RLS ON / FORCE RLS OFF; both platform-root helper definitions remain membership-derived or delegated to an unscoped tenant-admin helper. Admin Edge deployment remains blocked.
- Direct MantiGO live-RPC read-back also confirms broad tenant-role checks remain in four global SECURITY DEFINER routines: `get_mantigo_admin_dashboard_backend(uuid)`, `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)`, `settle_mantigo_captain_backend(uuid,text,text)`, and `expire_stale_mantigo_rides_backend(uuid,integer)`. All four are callable by `authenticated` but not `anon`, use `search_path=public`, and accept broad active tenant roles; the financial report aggregates the full MantiGO ledger without a tenant or `MNTY-PLATFORM` predicate. Source remediation exists in RC449 (`20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql`), then RC464 and RC471. The direct live bodies are not yet updated. This confirms an authorization design mismatch, not exploitation; no RPC was invoked.
- **MantiGO open-ride privacy:** the live `list_open_mantigo_rides_backend(uuid)` is SECURITY DEFINER, authenticated EXECUTE=true / anon=false, `search_path=public`; it binds only `p_user_id=auth.uid()` and still returns customer names and pickup/destination for up to 100 open rides without a captain ACTIVE/VERIFIED/AVAILABLE or vehicle-category gate. RC478 (`20261118070000_rc478_mantigo_open_ride_privacy_forward_repair.sql`) supplies the exact current-schema forward repair and PG16 positive/negative tests, but its version is not in the live ledger. Keep issue #911 and this P1 location-disclosure gate open until included in the full coordinated release and post-deploy checks. No RPC or ride rows were read.
- **MantiGO customer bid-contact privacy:** the live `list_mantigo_customer_rides_backend(uuid,text)` binds the caller to `auth.uid()` and own rides, but serializes all bid rows with `to_jsonb(b)`, exposing captain phone and vehicle plate for OFFERED/non-accepted bids. RC477 (`20261118060000_rc477_mantigo_customer_bid_contact_privacy.sql`) masks those fields until `ACCEPTED` and pins an empty `search_path`, with PG16 negative/positive tests. RC477 is absent from the Production ledger; keep issue #913 open until included in the coordinated release and live tests cover OFFERED, ACCEPTED, REJECTED, WITHDRAWN and EXPIRED. No ride or contact rows were read and no RPC invoked.
- **MantiGO captain earnings:** the live `get_mantigo_captain_earnings_backend(uuid)` aggregates nonexistent `mantigo_financial_ledger.amount` and `captain_amount` columns. The current table does not have `amount` or `captain_amount`; it has `gross_amount`, `commission_amount`, and `captain_net_amount`. The function is expected to fail at its aggregation query. RC476 (`20261118050000_rc476_mantigo_captain_earnings_live_ledger_columns.sql`) replaces these names and has disposable PG tests, but the live ledger does not contain RC476. It must follow RC471 in the coordinated sequence; issue #914 remains open. No earnings RPC or financial rows were read.
- **MantiGO global financial report:** `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)` still accepts broad tenant ADMIN/OWNER/OPERATIONS roles rather than registry-backed platform admins, and still aggregates the absent `amount` / `captain_amount` columns. RC471 (`20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql`) switches to the private registry helper and canonical `gross_amount` / `captain_net_amount`; its exact source remains unapplied and depends on RC464/RC469. The MantiGO dashboard RPC also has broad role authorization, but currently uses canonical ledger column names. No report RPC or financial rows were read.
- Complete public-schema SECURITY DEFINER inventory (read-only, 2026-11-28 01:03 EET): 149 functions owned by `postgres`; 65 effective `authenticated` EXECUTE, one effective `anon` EXECUTE (`get_mnty_targeted_advertisements`), 28 empty function-level `search_path`, 121 non-empty, and zero unset. Within the authenticated-executable set, 18 have an empty path and 47 a non-empty path. The sole anon-executable advertising RPC has an empty path and remains an intentionally narrow public-read contract for individual review. Supabase Security Advisor reported 166 findings (157 WARN / 9 INFO), including 90 anonymous-Auth policy warnings, 65 authenticated SECURITY DEFINER warnings, one anon SECURITY DEFINER warning, nine RLS-enabled/no-policy INFO and leaked-password protection disabled. These are review signals, not 149 proven exploits; classify each function by body, caller, tenant/auth scope, effective grants and intended audience. Do not bulk-revoke or mass-change search_path.
- Nine selected critical deployed Edge entrypoints differ from current-main source: `catalog-admin`, `catalog-platform-admin`, `payment-intent`, `paymob-webhook`, `order-create`, `financial-journal`, `subscription-payment-intent`, `digital-page-payment-intent`, and `settlement-financial-atomic`. Do not deploy any one of these independently.
- Exact payment/journal RPC read-back: `post_financial_journal_backend(uuid,jsonb,jsonb)` and legacy `post_financial_journal(jsonb,jsonb)` exist but `service_role EXECUTE = false`; `post_financial_journal_atomic_backend(uuid,jsonb,jsonb)` is absent. The legacy `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)` exists with `search_path=public, pg_temp` and `authenticated EXECUTE = true`, while the required five-argument provider-order-bound overload is absent. The required missing RPCs are `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)`, `create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)`, `claim_subscription_provider_intent_creation_backend(uuid,uuid)`, `process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb)`, `process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)`, `process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)`, and `process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)`. These were catalog/ACL reads only; none of the functions was invoked.
- No owner-controlled encrypted Production DB export, separate Storage object export, Auth/Vault recovery package, independent PostgreSQL 17 restore/rollback or measured RPO/RTO has been demonstrated. The backup/restore gate remains **NOT VERIFIED / BLOCKED**.
- Passing disposable PostgreSQL replay is not a Production backup or restore drill. Keep `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` until the owner supplies recoverable artifacts and the full coordinated release gate passes.
- No Production database, Auth/RLS/GRANT, Storage, Edge deployment, payment, wallet, settlement or customer-data mutation was performed during this recheck.
- Migration dependency map (source-only; every chain remains unapplied until the full release gate passes):
  - **Paymob/payment source files:**
    - RC425: `supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql`.
    - RC426/RC427/RC428/RC429/RC430/RC431/RC432: `20261009130000_rc426_digital_page_provider_order_binding.sql`, `20261009140000_rc427_one_active_payment_intent_per_order.sql`, `20261009150000_rc428_atomic_provider_failure_webhook.sql`, `20261009160000_rc429_atomic_subscription_failure_webhook.sql`, `20261009170000_rc430_atomic_subscription_success_webhook.sql`, `20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql`, and `20261009190000_rc432_smm_wallet_transaction_idempotency.sql`.
    - RC435/RC439: `20261009210000_rc435_subscription_provider_intent_claim.sql` and `20261010010000_rc439_encrypted_checkout_recovery.sql`.
    - RC468/RC470/RC474/RC475: `20261115030000_rc468_digital_page_payment_claim_hardening.sql`, `20261117020000_rc470_digital_page_webhook_forward_repair.sql`, `20261118030000_rc474_payment_intent_business_branch_scope.sql`, and `20261118040000_rc475_paymob_atomic_webhook_forward_repair.sql`.
    - Preserve chronological order, forward-repair prerequisites and exact function/ACL checks. RC475's schema preflight is not approval to deploy the current Edge bundle; the selected live functions remain behind source and required RPCs remain absent.
  - **Financial journal source files:** `20261010175000_rc449a_financial_journal_schema_prerequisites.sql` must precede `20261010180000_rc450_financial_journal_service_role_boundary.sql`. RC449A restores/backfills journal header and line fields; RC450 installs the server-only, scope-validated posting boundary. The separate RC436 candidate is not a substitute for the documented RC449A → RC450 rollout. Do not grant EXECUTE to legacy journal RPCs as a workaround.
  - **ERP purchasing source files:** `20261009200000_rc434_atomic_erp_purchase_receiving.sql`, `20261009230000_rc437_purchase_order_lines_receiving_limits.sql`, and `20261009240000_rc438_purchase_order_creation_with_lines.sql`. RC434 atomic receipt is not sufficient for line-level receiving; RC437's line table, scoped indexes, RLS and cumulative-receipt limits precede RC438 order creation with lines.
  - **Directory claim/privacy source files:** `20261118010000_rc472_directory_claim_review_atomicity.sql` contains both the forward repair for the NULL-safe business-wide membership index originally introduced by RC113 (the source explicitly avoids relying on a separately replayed RC113 ledger entry) and the transactional claim-review RPC. `20261118020000_rc473_directory_listing_contact_consent.sql` adds owner-consent disclosure controls. RC472 itself repairs the missing index; do not treat RC113 as a separate runtime prerequisite for that repair. Keep `directory-listings` v18 fail-closed until the database and complete Edge bundle pass owner/anonymous grant-revoke and source-rights tests.
  - **Default-image source files:** `20261027070000_rc117_default_images_and_activity_admin.sql` must precede `20261126020000_preserve_marketing_service_image_provenance.sql`. The forward repair is not standalone; preserve non-empty owner URLs and generate defaults only for blank URLs.
  - **Platform-root source files:** RC464 `20261113214500_rc464_platform_admin_live_registry_hardening.sql` → RC469 `20261117010000_rc469_shared_platform_admin_caller_search_path.sql` → RC471 `20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql` → RC484 `20261119040000_rc484_registry_backed_is_platform_admin.sql` → RC485 `20261120200000_rc485_catalog_rpc_registry_root.sql`. This exact sequence belongs inside the full chronological release, with policy/caller positive and negative regression coverage. No helper hot patch or standalone admin Edge deployment.
  - **Order/application source files:** `20261126030000_rc929_orders_confirmed_auth_claim_guard.sql` and `20261127010000_rc930_serialize_job_deactivation_and_application.sql` remain source-only. RC930's disposable concurrency replay does not prove the Production job-row lock is installed.


---

---

# MantiqatiX Production Backup, Restore and Rollback Drill

**Production:** \`MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu\`  
**Region / database:** \`us-east-2 / PostgreSQL 17.6.1.155\`  
**Status:** **BLOCKED — organization plan is Free; no automatic daily database backup is included, and no retrievable owner-created export or restore drill has been demonstrated.**  
**Rule:** This runbook prepares a safe owner-controlled drill. It does not authorize a Production write, create a paid Supabase branch, or ask anyone to paste credentials into GitHub/ChatGPT.

## Current migration reconciliation (2026-11-25)

- The current release contract tracks **88 exact migration versions**, defined in `scripts/production/live-reconciliation-contract.mjs` and checked by `scripts/validate-production-migration-chain-gate.mjs`.
- A fresh read-only Supabase ledger read-back reports **310 rows**, latest version `20261110150618`, and **0/88 exact required version identifiers** present.
- Do not interpret zero exact identifier matches as proof that every SQL effect is absent. The historical source-to-live crosswalk records partial baselines and separate confirmed source/ledger aliases. The three catalogued aliases are outside the current 88-version release list; their formal migration-history repairs remain pending. Never replay an alias, fabricate migration-ledger rows, or treat physical object presence alone as contract parity.
- A successful chronological PostgreSQL 17 replay in disposable CI is not a Production migration, backup, restore, or rollback rehearsal.
- Before approval, reconcile each required source effect against the live ledger and physical schema, including exact RPC signatures and bodies, function owners and `search_path`, effective ACL/RLS policies, constraints, and triggers.
- RC927 (`20261125120000`) merged source-only in PR #1122 after 17/17 exact-head workflows passed, including the 85-version chronological PostgreSQL 17 replay and 123 forward migrations. It is not applied to Production.
- RC928 (`20261126010000`) is a source-only candidate for atomic catalog-profile metadata and promotional-gallery persistence. It requires the existing owner-scoped profile RPC, same-transaction row locking, URL/authorization PostgreSQL tests and the full 88-version replay; it is not applied to Production.
- RC117 image-provenance forward repair (`20261126020000`) is source-only and is the 86th required version. The focused PostgreSQL 17 test preserves non-empty custom URLs with NULL/blank provenance, retains `ai_generated` and existing `auto` provenance, generates a default only for blank URLs and verifies an idempotent re-run. It remains unapplied to Production.
- RC929 (`20261126030000`) is the 87th source migration in the current set. It adds restrictive confirmed-Auth claim guards to `orders` and `order_status_history`; live read-back shows RLS + FORCE RLS enabled, anon SELECT false, authenticated SELECT true, and no strict guard yet. The migration remains unapplied to Production.
- RC930 (`20261127010000`) is the 88th source migration. It serializes job-application submission against concurrent job deactivation with a `FOR SHARE` job-row lock. The live `submit_job_application_backend` RPC still lacks this lock and the RC930 ledger row is absent. Its PostgreSQL 17 behavior and concurrency tests must pass before any coordinated release; it remains unapplied.

## A. Evidence to collect before release

1. **Plan and automated-backup evidence**
   - Connected Supabase organization read-back on 2026-11-25 confirms organization `manteqti` is on the **Free** plan. Current Supabase documentation states automatic daily database backups are provided on Pro/Team/Enterprise, while Free projects should create owner-managed CLI exports and keep off-site copies. No automatic daily backup is available to count as a release artifact.
   - The connected Supabase tools do not expose this project's backup inventory. Therefore the existence, timestamp, retention and retrievability of any owner-created export remain **UNKNOWN / NOT EVIDENCED** until the owner supplies artifact metadata and retrieval proof. Do not state that a manual backup exists or does not exist without evidence.
   - The paid-only **Restore to a new project** feature transfers database data, roles and Auth users/encryption root key but requires physical backups and a paid plan; it also requires manual reconfiguration for Storage objects/settings, Edge Functions, Auth settings/API keys, Realtime and extensions. Do not treat this as an available Free-plan restore path or create billable resources under this runbook.
   - Do not upgrade the plan, enable paid PITR, or create billable projects/branches as part of this runbook. Evaluate any plan change only with an explicit cost decision.
   - Capture only metadata (timestamps, artifact IDs, sizes, SHA-256, retention); never place database passwords, access tokens or secret values in this repository.

   **Current backup decision:** no retrievable owner-created database export, Storage object export, Auth recovery package or successful restore drill has been demonstrated in this session. The backup/restore gate remains **BLOCKED**.

2. **Database export**
   - Use an owner workstation with Supabase CLI and a protected environment variable. Do not pass credentials as command-line literals or commit .env files.
   - The following is a template only; the owner must substitute the protected connection URL locally:

        umask 077
        mkdir -p "$BACKUP_DIR"
        supabase --version > "$BACKUP_DIR/supabase-cli-version.txt"
        supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f "$BACKUP_DIR/roles.sql"
        supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BACKUP_DIR/schema.sql"
        supabase db dump --db-url "$SUPABASE_DB_URL" --use-copy --data-only -f "$BACKUP_DIR/data.sql"
        sha256sum "$BACKUP_DIR/roles.sql" "$BACKUP_DIR/schema.sql" "$BACKUP_DIR/data.sql" "$BACKUP_DIR/supabase-cli-version.txt" > "$BACKUP_DIR/SHA256SUMS"

   - These commands are the documented logical-dump pattern. Run them only on the owner's controlled workstation after checking the currently installed CLI help and confirming the connection target/ref. The current CLI reference states that `supabase db dump` excludes Supabase-managed schemas, including `auth`, `storage` and extension-managed schemas. The default output is schema-only; `--role-only` and `--data-only` are separate exports.
   - **Do not label these three SQL files a complete project backup.** They do not provide Auth users/identities, Storage metadata/data, extension-managed objects or project/Edge configuration. Preserve the CLI version, command output, exit codes and all exclusions in the owner-controlled manifest.
   - Use the documented schema-diff path only to capture custom schema changes in the managed Auth/Storage schemas, not to export their user records or Storage bytes. After linking the owner workstation to the correct source project and reviewing the output, the documented command is:

        supabase db diff --linked --schema auth,storage > "$BACKUP_DIR/auth-storage-schema-customizations.sql"

   - The Auth user/identity recovery mechanism remains a separate **unresolved owner gate**. The paid-only Restore-to-a-new-project flow documents transfer of Auth user data and the encryption root key; this runbook does not claim that the Free-plan logical dump includes Auth users. The owner must select and test a supported recovery method before release.
   - Encrypt database exports with an owner-controlled key/KMS and copy them off-site with restricted, audited access. Keep the key under separate dual control.

3. **Storage object export — separate from DB**
   - Export every bucket's object bytes, not just rows in storage.objects.
   - Produce a manifest containing bucket, object key, content type, size, ETag/version (where available), object metadata and SHA-256 of downloaded bytes.
   - Verify object count, total byte size and all checksums after upload to the off-site backup location. Test retrieval of representative small, large and private objects.
   - Preserve bucket visibility and policy definitions through the database schema dump; keep actual object files in the separate encrypted export.

4. **Auth, Vault and platform configuration**
   - Record Auth users/identities coverage only after the selected supported recovery method is demonstrated by a restore test. The ordinary CLI logical dump above excludes `auth`; `db diff --schema auth,storage` captures schema customizations, not user data.
   - Separately capture provider enablement, OAuth client/secret references, redirect allow-list, Site URL, SMTP sender/configuration, email templates/hooks, MFA settings, session/security settings, JWT signing-key recovery procedure and relevant project-level configuration.
   - Enumerate required secret names for Edge Functions, webhooks, payment providers, push dispatch, SMTP, OAuth and external integrations. Store values only in the owner's secret manager; never copy values to the repository or audit report.
   - Confirm Vault data and encryption-key recovery independently. A database dump alone must not be treated as proof that external keys or encrypted application secrets are recoverable.
   - Export Edge Function source/version/verify_jwt metadata and deployment configuration. Verify every required function can be reconstructed from canonical source plus owner-held secret references.

## B. Isolated restore

1. Restore into an owner-controlled disposable PostgreSQL 17 target or local environment. Do not use the Production project as the target. Do not create a paid Supabase branch merely to satisfy this document.
2. Verify PostgreSQL major/minor compatibility, required extensions, collations, roles and permissions before replay.
3. Restore roles, application schema and application data in the documented order with stop-on-error behavior. Resolve restore warnings explicitly; do not ignore missing extensions, failed grants, invalid policies, triggers or functions. This is only the database logical-dump leg.
4. Restore Auth user/identity records only through the separately documented and proven recovery mechanism. Verify login, identity-provider linkage, session revocation and confirmed/anonymous boundaries with synthetic test accounts; never copy production credentials into CI.
5. Restore Storage bucket/policy metadata and upload the separately exported object bytes; verify checksums and representative private/public access behavior. The DB dump is not a Storage-file backup.
6. Reconnect Auth/Edge/Vault settings only through controlled owner credentials in the isolated environment. Confirm that no real payment provider credential points at live-money flows.
7. Run:
   - exact 88-source migration identity/effect reconciliation;
   - chronological forward replay and PostgreSQL 17 integration tests;
   - RLS/ACL/function-owner/search_path checks, including positive platform-admin and negative tenant-admin cases;
   - Paymob altered-merchant_order_id negative replay (standard, digital page and subscription), with equal-amount/currency orders A/B and zero writes to the wrong order;
   - subscription idempotency, encrypted checkout-secret recovery and failed-payment processing;
   - financial journal balance/line numbering and service-role boundary;
   - ERP purchase-line receive limits, duplicate receipt prevention and inventory accounting invariants;
   - Storage public/private visibility, consent and directory fail-closed behavior;
   - deployed-origin-equivalent browser/API E2E for catalog, directory, accounts, admin, orders and mobile layouts.

## C. Rollback proof and RPO/RTO

- Record backup start/end, artifact sizes, encrypted copy completion, restore start/end and all failed/retried steps.
- Measure RPO as the elapsed time from the last recoverable data point to the incident target. Measure RTO from restore initiation to a verified usable service.
- Test rollback of the proposed migration/Edge release in the disposable target, including database restore and Edge version rollback. Verify the prior application can operate against the restored schema and data.
- Keep pre-release and post-release smoke tests, SQL evidence, CI run IDs, checksums and approver identity in the owner-controlled release packet.

## D. Production release gate

Production approval remains blocked until:
- database logical-dump artifacts are encrypted, off-site, retrievable, checksummed and owner-controlled;
- the separate Auth user/identity recovery method is supported, documented and restore-tested (the ordinary `db dump` does not include `auth`);
- Storage object bytes and metadata are exported separately and recoverable (the database dump excludes the managed `storage` schema by default and does not include Storage object bytes);
- Auth identities/configuration, Vault keys, external secrets and Edge configuration have documented recovery paths;
- a disposable PostgreSQL 17 restore is clean and reproducible;
- measured RPO/RTO and rollback evidence meet the owner's recovery target;
- the exact ordered 87-source migration effects, RPC signatures, owners, search_path, ACL, RLS/policies, constraints and triggers reconcile;
- the coordinated database + Edge plan passes exact-head and deployed-origin negative/positive tests;
- the owner explicitly approves the exact Production release commit, migration list, deployment list, backup artifact and rollback steps.

**Current decision:** no Production SQL/migration, Auth, RLS/GRANT, Storage, Vault, Edge, payment, settlement or website deployment change is authorized by this runbook.


## Official Supabase references checked — 2026-11-25

- [Database Backups](https://supabase.com/docs/guides/platform/backups): Free projects should use CLI logical exports and off-site copies; automatic daily DB backups are for Pro/Team/Enterprise; DB backups do not contain Storage object bytes.
- [CLI reference — supabase db dump](https://supabase.com/docs/reference/cli/supabase-db-dump): the command excludes Supabase-managed auth, storage and extension schemas by default; schema, role and data dumps require distinct options.
- [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore): the supported logical dump/restore pattern, managed-schema customization caveats, Storage object migration and Edge Function migration.
- [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project): currently paid-plan-only and requires physical backups; Auth records and encryption root key transfer, while Storage, Edge and several project settings require manual reconfiguration.

These references document product capabilities; they do not prove that this project's manual export artifacts exist or that a restore has been completed.
