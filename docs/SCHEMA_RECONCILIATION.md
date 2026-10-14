# MantiqaTix — Schema & Migration Reconciliation
**Snapshot:** 2026-10-14  
**State:** NOT VERIFIED — reconciliation must precede production migration changes.

## Production migration ledger (read-only)
- Query source: `supabase_migrations.schema_migrations`.
- Count: **283**.
- First recorded version: `20260808000000`.
- Latest recorded version: `20261008222845`.
- Latest name: `rc424_atomic_digital_page_payment_webhook`.

## Known discrepancy requiring investigation
The session log dated 2026-10-11 records migration source gaps RC425–432 and RC434–441, plus conflicting RC434 definitions in PR #202 and PR #84. This was historical evidence and must be revalidated against the current `main`, open PRs, and live ledger before any action. Do not assume the conflict has resolved merely because the ledger remains at RC424.

## Required reconciliation table
For every migration version in the live ledger and repository:
- version and canonical filename;
- presence in `main`;
- presence in every candidate PR that touches the version;
- duplicate/conflicting definitions;
- dependency/order validity;
- replay result in a disposable database;
- resulting schema/function/policy/grant diff against production;
- whether production application is authorized.

## Hard stops
- Do not apply a migration to production when the chain has missing versions, duplicate versions, competing definitions, unverified destructive effects, or unresolved dependency order.
- Do not fabricate a replacement migration from its filename or PR summary. Use authoritative source and tests.
- Do not edit historical applied migrations to “fix” drift; create a new forward migration only after the exact discrepancy and safe remediation are established.
- Do not treat `283` as proof of schema parity or migration replayability.

## Next action
Inventory repository migration filenames and all open candidate PR migration paths; compare them with the 283-row live ledger; then run duplicate/version/dependency checks and isolated replay. Keep all database work read-only until the reconciliation report is complete.


## Addendum — current-main verification (2026-10-14)
- Direct source lookups on `main` returned NOT_FOUND for the expected RC425, RC434 and RC439 migration paths. This agrees with the current release verifier's required-migration gate.
- `scripts/production/verify-production.mjs` and `scripts/validate-production-migration-chain-gate.mjs` both enumerate 28 required release migration files and require a reconciliation manifest, immutable RC424 history, chronological disposable replay, tenant isolation, payment/finance E2E, backup/restore, Edge Function contracts, SMM parity and Auth security settings before release certification.
- The existing manifest `docs/release/production-migration-reconciliation.json` records an exact statement match for RC424: ledger statement count 1, source bytes 7208, ledger statement bytes 7208, `exact_statement_match=true`, `history_rewritten=false`. The timestamp difference is recorded as a legacy version alias. Do not reopen RC424 by renaming or rewriting the applied history.
- A byte-for-byte patch comparison of RC434 in PR #84 and PR #202 returned identical patch text (7151 characters). The historical claim of a content conflict is not supported by this pairwise comparison, but overlap across all candidate PRs and migration version uniqueness still require full review.
- Current `main` still lacks required post-RC424 source files; PRs #84/#202/#207/#218 contain overlapping candidate migrations. No production application is authorized by this evidence.
- **Next executable step:** compare all 28 required filenames against main, each open candidate PR, and live ledger; verify duplicate version definitions and timestamp ordering; inspect dependency edges; then run the complete chain only in a disposable PostgreSQL/Supabase environment.


## Full required-migration source inventory — current main, 2026-10-14
**Result: 12/28 required migration source files present; 16/28 absent.** Presence means the exact expected filename was retrievable from `main`; it does not imply applied-to-production or replayed.

| Expected migration | Current `main` source | Live ledger evidence |
|---|---|---|
| `20261009120000_rc425_atomic_mantigo_paymob_payment.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261009130000_rc426_digital_page_provider_order_binding.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261009140000_rc427_one_active_payment_intent_per_order.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261009150000_rc428_atomic_provider_failure_webhook.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261009160000_rc429_atomic_subscription_failure_webhook.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261009170000_rc430_atomic_subscription_success_webhook.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261009190000_rc432_smm_wallet_transaction_idempotency.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261009200000_rc434_atomic_erp_purchase_receiving.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261009210000_rc435_subscription_provider_intent_claim.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261009220000_rc436_atomic_financial_journal.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261009230000_rc437_purchase_order_lines_receiving_limits.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261009240000_rc438_purchase_order_creation_with_lines.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261010010000_rc439_encrypted_checkout_recovery.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261010020000_rc440_exposed_security_definer_search_path.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261010030000_rc441_platform_admin_scope_hardening.sql` | MISSING | Latest ledger RC424; not proven applied |
| `20261010060000_rc446_mantigo_open_ride_privacy_boundary.sql` | PRESENT | Not proven applied solely by source presence |
| `20261010120000_rc442_approval_action_audit_atomicity.sql` | PRESENT | Not proven applied solely by source presence |
| `20261010140000_rc444_crm_business_scope_rls.sql` | PRESENT | Not proven applied solely by source presence |
| `20261010150000_rc447_matrimony_profile_privacy_boundary.sql` | PRESENT | Not proven applied solely by source presence |
| `20261010161000_rc448_matrimony_request_lifecycle_authority.sql` | PRESENT | Not proven applied solely by source presence |
| `20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql` | PRESENT | Not proven applied solely by source presence |
| `20261010175000_rc449a_financial_journal_schema_prerequisites.sql` | PRESENT | Not proven applied solely by source presence |
| `20261010180000_rc450_financial_journal_service_role_boundary.sql` | PRESENT | Not proven applied solely by source presence |
| `20261010200000_rc451_targeted_ads_empty_search_path.sql` | PRESENT | Not proven applied solely by source presence |
| `20261010210000_rc452_marketing_crm_tenant_scope.sql` | PRESENT | Not proven applied solely by source presence |
| `20261010220000_rc453_marketing_campaign_backend.sql` | PRESENT | Not proven applied solely by source presence |
| `20261011010000_rc456_smm_service_role_access_boundary.sql` | PRESENT | Not proven applied solely by source presence |

**Missing group:** RC425–RC432 and RC434–RC441 (16 files). **Present group:** RC446, RC442, RC444, RC447–RC450, RC451–RC453, RC456 (12 files). This is filename/source inventory only; the non-sequential RC numbers follow immutable timestamp order in the release verifier and must not be reordered by RC label.

**Candidate overlap:** PR #84, #202, #207 and #218 all carry overlapping post-RC424 migrations. RC434 patch text in PR #84 and #202 was identical in a direct full-string comparison, but no candidate is approved by this inventory. Compare all required migration contents, prerequisites, tests, exact version uniqueness and ordered replay before merge.


## Candidate SQL comparison refinement — 2026-10-14
- Full PR patch comparisons completed for shared migration filenames:
  - PR #84 vs #202: **0 differing shared migration patches**.
  - PR #207 vs #218: **33 common migration files; 0 differing patches**.
  - PR #84 vs #207: **16 common migration files; 0 differing patches**.
- Thus the previously documented RC434 discrepancy is not supported by the examined shared migration patch content; RC434 and the other shared migration patches compared byte-for-byte identical in these pairs.
- This is not a chain-approval decision. PRs differ materially in non-migration files, carry different additional migration sets, and still need whole-chain uniqueness/order/dependency checks plus isolated replay. Do not merge any of them solely based on matching shared SQL.
