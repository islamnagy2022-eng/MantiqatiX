# SMM Provider Credentials — Live Schema Evidence

**Status:** READ-ONLY EVIDENCE ONLY — NOT an authoritative historical baseline and NOT approved for migration replay.

**Observed:** 2026-10-11, Supabase project `moyhiluyhjsujhwlyeuu`, via read-only catalog introspection.

## Current live shape

- Table: `public.smm_provider_credentials`
- Owner: `postgres`
- RLS: enabled
- Columns, in ordinal order:
  1. `provider_id uuid NOT NULL`
  2. `api_key_ciphertext text NULL`
  3. `configured boolean NOT NULL DEFAULT false`
  4. `updated_at timestamptz NOT NULL DEFAULT now()`
- Primary key: `smm_provider_credentials_pkey` on `provider_id`
- Foreign key: `provider_id REFERENCES public.smm_providers(id) ON DELETE CASCADE`
- Indexes: the primary-key index only, per `pg_indexes`
- Triggers: none returned by catalog introspection
- RLS policy: `mnty_deny_unexposed_client_access`, command `ALL`, roles `anon` and `authenticated`, both `USING (false)` and `WITH CHECK (false)`

No credential values or customer/provider records were read or copied into this document.

## Release blocker

The historical migration `20260927074200_harden_smm_table_api_privileges.sql` references this table, but no committed migration currently creates it. The production table's current shape does not prove its original creation DDL, creation time, prior constraints, or whether any intervening schema changes occurred.

Do **not** resolve this by adding a backdated migration, changing the already-applied migration history, or silently seeding a replay fixture. Before the empty-database migration replay can pass, recover the original DDL from repository history or obtain explicit owner approval for a separately versioned schema baseline that documents its production provenance and scope. Until then, `validate-historical-schema-baseline.mjs` must fail closed and the release remains `NOT CERTIFIED`.

## Evidence limits

This document is a point-in-time catalog observation only. It is not a schema dump, does not include table data, and does not certify table-level access paths beyond the listed policy/catalog fields.
