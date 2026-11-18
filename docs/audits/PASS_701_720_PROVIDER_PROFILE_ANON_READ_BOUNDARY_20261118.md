# Pass 701–720 — provider-profile anonymous base-table read boundary

Date: 2026-11-18  
Main baseline: `54fcf4be74a5892a84ffdb20c85abc67a9e36643`  
Supabase Production: `moyhiluyhjsujhwlyeuu`

## Finding

Read-only ACL inspection confirmed that `anon` has an explicit table-level SELECT grant on `public.marketing_provider_profiles`. The table's public-active RLS policy limits rows to ACTIVE profiles but does not limit selected columns. The live table includes `owner_user_id` and `settings`; their values were not selected in this audit.

The canonical catalog frontend uses the curated `public-catalog` and `public-catalog-directory` Edge Functions. Both query provider profiles through a server-side service-role client, request an explicit public projection, and map results into explicit response objects. The legacy `/web` entrypoint has a boot guard before loading its old runtime. The owner/provider-services UI's authenticated direct access is a separate owner-scoped path and was not removed.

## Forward-only candidate change

Added RC479:

`supabase/migrations/20261118190000_rc479_revoke_anon_provider_profile_base_read.sql`

The migration contains one privilege statement only:

`REVOKE SELECT ON TABLE public.marketing_provider_profiles FROM anon;`

It deliberately preserves authenticated SELECT for the existing authenticated owner/admin UI and service_role SELECT for the curated Edge Functions. It does not alter table rows, RLS policies, authenticated grants, service-role grants, Edge Functions or public response shape.

## Regression coverage

- Synthetic fixture reproduces the existing explicit anon/authenticated/service_role grants and ACTIVE-only RLS policy.
- PostgreSQL integration checks that anon SELECT is denied after RC479.
- Authenticated SELECT remains available and returns only ACTIVE rows under the existing policy.
- service_role SELECT remains available and bypasses RLS as expected for the trusted Edge Function path.
- Static validator checks the single-purpose migration, exact grants, Edge service-role use and required regression markers.
- Module Professionalization Validation now runs the static validator and a dedicated disposable PostgreSQL RC479 job.
- Release migration chain now tracks RC479 as required version 58; the live manifest remains explicitly 0/58 applied.

## Residual risk — not silently closed

Authenticated sessions still have SELECT on the provider-profile table, and the existing authenticated public-active policy may expose all granted columns of ACTIVE rows, including `owner_user_id` and `settings`, to signed-in users who are not owners. RC479 closes anonymous base-table access only. A separate compatibility-reviewed column/view/RPC redesign is required before claiming the entire provider-profile privacy model is complete; do not revoke authenticated SELECT until the owner UI's `owner_user_id` lookup is replaced safely.

## Release boundary

Source-only candidate. No Production migration, SQL, data, Auth, RLS, GRANT, Edge deployment, payment, wallet, settlement, main-branch change or Pages deployment occurred. The live migration ledger remains at 310 rows through `20261110150618`; RC479 is not applied. Backup/restore and the broader release gate remain unresolved. This change is not a Production certification.
