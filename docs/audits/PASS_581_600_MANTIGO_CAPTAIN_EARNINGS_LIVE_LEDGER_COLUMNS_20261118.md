# Pass 581–600 — MantiGO captain earnings live-ledger repair (2026-11-18)

## Confirmed live defect

Read-only Production inspection of `public.get_mantigo_captain_earnings_backend(uuid)` showed the function aggregating `mantigo_financial_ledger.amount` and `captain_amount`. The live table's actual columns are `gross_amount`, `commission_amount`, and `captain_net_amount`; the queried live column inventory did not include `amount` or `captain_amount`. The live function therefore references absent columns in its earnings aggregate.

The same inspection showed `get_mantigo_admin_financial_report_backend` also references the legacy names; that global admin report is corrected by the existing RC471 forward migration, which is still not applied to Production. The admin dashboard function already uses canonical columns.

## RC476 implementation

- Added `supabase/migrations/20261118050000_rc476_mantigo_captain_earnings_live_ledger_columns.sql`.
- Replaced the earnings aggregation with `gross_amount`, `commission_amount`, and `captain_net_amount`, including settled/unsettled filters.
- Preserved the JSON response keys: `rides_total`, `completed`, `cancelled`, `failed`, `gross`, `commission`, `net`, `settled`, `unsettled`, `paid_rides`.
- Preserved the `auth.uid()` actor binding and captain-profile requirement.
- Pinned an empty search_path and retained authenticated-only EXECUTE, revoking PUBLIC/anon.
- Added a preflight for the canonical live ledger columns and MantiGO dependencies.

## Regression coverage

Added `supabase/tests/rc476_mantigo_captain_earnings_integration.sql`, static validator `scripts/validate-rc476-captain-earnings-live-columns.mjs`, and extended `.github/workflows/mantigo-platform-admin-scope.yml`.

The disposable PostgreSQL test deliberately sets conflicting legacy values (`amount=999`, `captain_amount=888`, etc.) beside canonical values and verifies totals are calculated only from canonical fields. It also checks actor mismatch rejection, missing captain profile rejection, authenticated/anon grants, and empty search_path.

## Exact-head verification

PR #788 exact-head CI passed:
- RC476 static source contract.
- RC449/RC462/RC471/RC476 disposable PostgreSQL migration sequence and RC476 integration test.
- Forward migration chain replay from captured Production schema checkpoint.
- Migration immutability and version uniqueness/collision checks.
- RC464 and RC471 platform-admin PostgreSQL suites.
- RC425 Paymob atomicity, MantiGO open-ride privacy, directory claim, approval-action audit, backend module boundary, and SMM deferred-storefront contracts.
- Pages build, catalog checks, V6 public bundle and preview validation.

The RC476 disposable integration emitted `RC476 captain earnings canonical ledger integration: PASS`. The migration chain replay completed successfully.

## Merge and Production boundary

- PR #788 merged to main as `d735cb31e65b7fbc13ce9b4854bbbe3599edbe39`.
- Source merge does **not** apply a Supabase migration.
- No Production SQL, Auth configuration, RLS, GRANT, Edge deployment, payment, wallet, or settlement mutation was made.
- RC476 remains unapplied until encrypted off-site backup and restore rehearsal, exact migration-ledger reconciliation, and the approved forward-release gate are satisfied.
- The previously recorded RC464/RC471 platform-admin hardening remains unapplied to Production.

