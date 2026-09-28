# RC151 — Backend-only ERP/SMM privilege convergence

Date: 2026-09-28

## Finding
Live production inspection confirmed six public tables are RLS-enabled and have no policies:
- erp_purchase_orders
- erp_purchase_receipts
- erp_stock_transfers
- smm_admins
- smm_provider_credentials
- smm_providers

The ERP tables already had no direct anon/authenticated table privileges. The SMM provider tables still carried direct DML grants to anon/authenticated despite having zero RLS policies, which was fail-closed only because RLS denied rows.

## Action
Production privileges were hardened with:
- REVOKE ALL ON TABLE ... FROM anon, authenticated
for all six backend-only tables.

No broad RLS policies were added.

## Verification
Post-change live inspection confirmed for all six:
- RLS = enabled
- policy count = 0
- anon/authenticated direct table privileges = none
- service_role retains table privileges

The existing privileged ERP backend functions remain non-executable by anon/authenticated in the live privilege check.

## Source synchronization
Migration source added:
supabase/migrations/20260928150000_rc151_backend_only_erp_smm_table_privileges.sql

Git commit:
2015a076cdaa89196b0ae89c4d53fc7ead38de22

## Remaining
- Map and verify every backend/service-role access path for the six tables.
- Keep Security Advisor finding open until contextual review/sign-off is complete.
- Do not add client policies unless a concrete user-facing workflow requires one and least-privilege scope is specified.
- Full E2E, leaked-password protection, release signing, backup/restore, rollback and browser/device verification remain release blockers.
