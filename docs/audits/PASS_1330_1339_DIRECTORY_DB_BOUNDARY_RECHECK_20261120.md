# PASS 1330–1339 — Directory direct database access boundary recheck

Date: 2026-11-20
Production project: `moyhiluyhjsujhwlyeuu`

## Read-only metadata findings

Project metadata confirmed `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.155.

Catalog-only SQL confirmed for `public.public_directory_listings`:

- `relkind = 'r'`: it is a base table, not a view.
- `relrowsecurity = true`.
- `relforcerowsecurity = true`.
- Effective SELECT privilege: `anon=false`, `authenticated=false`, `service_role=true`.
- No RLS policies are defined on this table.

The catalog query for `public.directory_listing_contact_consents` returned no relation, confirming the RC473 consent registry is still absent in Production.

No row data, contact fields, personal identifiers, phone numbers or addresses were selected. No Edge Function was invoked. No Production mutation occurred.

## Security interpretation

This narrows the direct database path: anon/authenticated roles cannot SELECT the base directory table directly. It does **not** close the known public contact disclosure path through the deployed `directory-listings` Edge Function, which uses service_role and must enforce consent-aware sanitization itself.

The RC473 source migration currently has no `expires_at` column or expiry behavior. The current owner UI describes consent as continuing until the owner withdraws it. Therefore expiry behavior is not implemented and must not be reported as tested. A separately designed expiry policy, forward-only migration, owner UI and adversarial tests are required before the P0 directory privacy issue can close.

## Issue update

Added the read-only findings and explicit expiry gap to P0 Issue #876:
https://github.com/islamnagy2022-eng/MantiqatiX/issues/876

## Safety

- Read-only PostgreSQL catalog inspection only.
- No table data, personal data or customer records accessed.
- No DDL/DML, migration, RLS, GRANT, Auth, Storage, Edge, payment or financial mutation.
- P0 Issue #876 remains **BLOCKED / NOT CERTIFIED** pending encrypted backup/restore, coordinated migration and complete Edge bundle release, live consent tests and expiry-policy resolution.
