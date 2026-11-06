# V6 r5 visual review and isolated migration replay — 2026-11-06 17:10 UTC

## Scope and exact PR head

- Repository: `islamnagy2022-eng/MantiqaTix`
- Branch: `feat/v6-r5-preview-foundation-20261106`
- PR: [#685](https://github.com/islamnagy2022-eng/MantiqaTix/pull/685) — OPEN / DRAFT / NOT MERGED.
- PR head for this checkpoint: `b6b7de66b481a644b2f9249e7e287aa6074980d5`.
- Validated V6 application/source head remains `0de8917431d2e2ecf5e4cd833cd08d4286e682e8`; later commits in this checkpoint changed CI/test harness and documentation, not V6 application source.
- Existing public catalog remains the Pages root. V6 remains a subpath Preview at `/MantiqaTix/v6-preview/`.

## Exact PR-head CI

All nine PR-triggered workflow runs associated with `b6b7de6` completed successfully:

| Workflow | Run | Result |
|---|---:|---|
| Pages validation | [42249793006](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42249793006) | Validate/composition, V6 browser E2E and screenshot capture — PASS; deploy jobs SKIPPED for PR event |
| Primary Catalog Frontend Validation | [42249793161](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42249793161) | Build, employee/RBAC PostgreSQL and browser E2E — PASS |
| V6 Preview Source Validation | [42249793282](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42249793282) | PASS |
| Forward Migration Chain Replay | [42249793248](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42249793248) | Ephemeral local Supabase replay and targeted contracts — PASS |
| Backend-only Module Boundary | [42249793077](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42249793077) | Approval/audit and RC450 financial-journal integration — PASS |
| Module Professionalization Validation | [42249793270](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42249793270) | Targeted-ads search-path and matrimony privacy PostgreSQL tests — PASS |
| RC425 MantiGo Paymob Atomicity | [42249793187](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42249793187) | PASS |
| MantiGO Open Ride Privacy Boundary | [42249793286](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42249793286) | PASS |
| SMM Deferred Storefront Contract | [42249793491](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42249793491) | PASS |

Pages validation passed and produced a composed artifact, but `validate_public_only` and `deploy` were skipped because this was a pull-request event. The Preview is therefore validated as an artifact, not publicly deployed.

## Captured visual review

The Pages browser test now captures three screenshots from the composed artifact using a synthetic, intercepted public-directory response. Artifact:

- [V6 Preview visual review ZIP — artifact 13521016183](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42249793006/artifacts/13521016183)
- SHA-256: `8364d68f2a3b3ff54f6fa7fa050f2717a9939bcdff5e8a323b20583c88a7a45e`
- Expiration: 2026-11-20 (14-day screenshot retention).

Files and dimensions:
- `v6-desktop-directory.png` — 1440 × 1174.
- `v6-desktop-activity-profile.png` — 1440 × 1508.
- `v6-mobile-directory.png` — 390 × 1245.

### Visual observations

- Desktop directory: brand/navigation, hero, search, governorate filter, activity selection, verification filters and activity card are visible; no obvious clipped text or overlapping controls in the captured viewport.
- Desktop activity profile: cover image, verified status, contacts, catalog header, search/category controls and product card render in the page.
- 390px mobile directory: navigation, hero, search/filter controls and activity card stack vertically. The test explicitly asserts `document.documentElement.scrollWidth <= window.innerWidth + 1`; it passed, so no horizontal overflow was detected at this viewport.
- The only visible activity and product labels in these captures are synthetic test fixtures (`نشاط تجريبي للاختبار` and `منتج تجريبي`). These are not Production customer records.
- The desktop screenshots show substantial unused horizontal space because the fixture intentionally contains one activity and one catalog item. This is not enough evidence to diagnose a production grid-density issue; review against populated real directory data before changing layout.

Automated browser E2E passed; axe logged zero critical and zero non-critical violation groups. This is not yet a completed pixel/visual comparison against a separately captured, approved AI Studio r5 reference. Exact visual-baseline acceptance remains OPEN.

## Isolated forward migration-chain replay

Run [42249793248](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42249793248), exact PR head `b6b7de6`, completed successfully. The workflow:

1. Started a fresh local Supabase instance with repository migrations disabled at startup.
2. Loaded the captured **schema-only** Production checkpoint whose manifest version is `20261008222845`.
3. Loaded explicit disposable prerequisite/trigger fixtures.
4. Applied **76** later migration files in timestamp order, through `20261101150000_directory_source_permission_evidence.sql`.
5. Executed the RC117 default-image/activity-admin contract, owner-profile persistence integration, RC455 commission preview integration, RC456 commission-resolution integration, and the synthetic two-tenant isolation suite.

The replay included:
- RC449A `20261010175000_rc449a_financial_journal_schema_prerequisites.sql`.
- RC450 `20261010180000_rc450_financial_journal_service_role_boundary.sql`.
- RC451 forward search-path repair and the later catalog/dashboard/directory migrations.

Observed result markers:
- `FORWARD_MIGRATIONS_APPLIED=76`.
- Owner-profile integration PASS.
- RC455 integration PASS.
- RC456 integration PASS.
- Tenant A could not update Tenant B orders/payment intents and could not read Tenant B private rows; reciprocal Tenant B isolation assertions also passed.

This is a valuable successful **schema-only isolated forward replay**, not a Production migration and not a real database backup/restore rehearsal. It does not restore customer data, measure RPO/RTO, test storage/media recovery, or prove the current live Production database is identical to the checkpoint. Backup/restore rehearsal remains NOT VERIFIED.

## Fresh read-only Production evidence

Read-only Supabase inspection at approximately 2026-11-06 15:32 UTC reconfirmed:

- Production project status: ACTIVE_HEALTHY; PostgreSQL 17.6.1.155.
- Migration ledger: 309 records, latest `20261101140105`.
- Ten targeted columns remain absent: journal header/line fields and the three default-image/image metadata fields.
- Three targeted objects remain absent: `mantigo_payment_provider_events`, `uq_payment_intents_one_active_per_order`, and `smm_wallet_transactions_reference_type_uidx`.
- RC449A/RC450 are still not applied in Production; the journal RPCs lack `service_role` EXECUTE. The five-argument digital-page finalizer remains absent; only the four-argument signature exists.
- The six critical Production Edge Functions remain source-drifted: `order-create`, `payment-intent`, `paymob-webhook`, `digital-page-payment-intent`, `subscription-payment-intent`, and `financial-journal`.

The current security advisor snapshot contained 94 lints: 9 informational RLS-enabled/no-policy findings, 3 anonymous-executable SECURITY DEFINER findings, 67 authenticated-executable SECURITY DEFINER findings, 90 anonymous-policy findings and 1 leaked-password-protection warning. The three anonymous-executable SECURITY DEFINER findings were triaged at catalog level:
- Two return `trigger` and are attached to INSERT/UPDATE/DELETE triggers (`businesses` and `commission_rules`); they are not ordinary callable RPCs. The catalog also reports no direct anon or authenticated INSERT privilege on `public.businesses`.
- The third is the targeted-advertisement read routine. Its return shape is limited to public ad-card fields and its query filters to active/approved ads and active geographic targets. Public execution is an intentional public-read surface, but it remains subject to function-body and output review.
- This is scoped triage, not a blanket clearance of the 67 authenticated SECURITY DEFINER or 90 anonymous-policy findings. Do not bulk-revoke grants or alter RLS policies merely to silence advisor counts.
- Leaked-password protection remains disabled and needs owner-dashboard verification/action.

For the migration identity comparison, 0/42 exact source version IDs are in the live ledger. Two duplicate source aliases have separately been confirmed by exact Git blob/live statement evidence (RC424 and the marketing-contact migration); formal ledger repair remains 0/2 and was not attempted. Exact identifier absence must not be misrepresented as proof that every physical schema effect is absent.

## Release boundary and next dependency

- Full Production gate remains **BLOCKED / NOT CERTIFIED**.
- Payment/finance signed-webhook E2E, six-function coupled deployment readiness, current backup/restore/RPO/RTO and rollback evidence, full advisor review and owner-side Auth hardening remain open.
- No Production migration, schema/data/Auth/RLS/GRANT change, Edge Function deployment, payment/finance operation or customer-data mutation was performed.
- No Pages deployment, PR merge or root cutover occurred.
- Keep the existing catalog at the root. Keep V6 isolated at `/MantiqaTix/v6-preview/` until visual acceptance and explicit release approval.

### Next executable items

1. Compare the three captured V6 screenshots against a captured/approved AI Studio r5 baseline; do not infer exact visual parity from automated E2E.
2. Perform and record a genuine disposable backup/restore rehearsal with RPO/RTO and rollback evidence, distinct from the successful schema-only replay.
3. Continue isolated payment/webhook/idempotency/wallet/settlement E2E for the six-function coupled release.
4. Review the remaining security-advisor items function-by-function and table-by-table; obtain owner-dashboard evidence for leaked-password protection.
5. Keep Production BLOCKED until all required live evidence passes.