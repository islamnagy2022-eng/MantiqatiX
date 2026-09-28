# RC52 — Restaurant Mutation Security Check

Date: 2026-09-28

## Verified production facts

The live Supabase project contains these restaurant tables:

- restaurant_menu_items
- restaurant_orders
- restaurant_tables
- restaurant_inventory

All four currently have RLS enabled and FORCE RLS enabled.

The live database also contains backend functions:

- restaurant_erp_mutate(text, jsonb, text)
- restaurant_table_mutate(text, jsonb, text)

Their current ACL was checked directly. EXECUTE is not granted to anon or authenticated, and is also not granted to service_role through the inspected privilege surface.

## Release decision

No production database privilege was widened.

A temporary source change that attempted to call the backend restaurant mutation functions from the browser was reverted because the current production ACL does not permit authenticated browser execution.

The tracked restaurant UI therefore remains on the existing RLS-protected table mutation surface rather than bypassing or widening database privileges speculatively.

## Remaining hardening

Restaurant order state transitions still require a production-authoritative mutation path if they are to become part of the final certified workflow. This should be implemented only after an authoritative backend/API path and its grants are established and verified.

No test accounts, fake restaurant records, fake orders, or fake transactions were created during this check.

## Certification status

This checkpoint does not certify the restaurant module as production-complete. It records a verified security boundary and prevents an unverified privilege expansion from being introduced.
