# Migration Replay Blockers — 2026-10-11

## Release status

**BLOCKED — do not merge the migration recovery batch or apply it to production yet.**

## Evidence

- Disposable Supabase replay run [38103251552](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38103251552) failed in the `replay-all-migrations` job. Logs show registry throttling during startup, followed by repeated SQL failures:
  `ERROR: relation "public.smm_provider_credentials" does not exist (SQLSTATE 42P01)`.
- The first source migration referencing this relation is `supabase/migrations/20260927074200_harden_smm_table_api_privileges.sql`. It revokes privileges on `public.smm_provider_credentials` and `public.smm_providers` but does not create either table.
- A read-only production schema query confirms that `public.smm_provider_credentials` exists in the live project with:
  - `provider_id uuid NOT NULL` primary key and FK to `smm_providers(id)` with `ON DELETE CASCADE`
  - `api_key_ciphertext text NULL`
  - `configured boolean NOT NULL DEFAULT false`
  - `updated_at timestamptz NOT NULL DEFAULT now()`
- The current RC456 disposable fixture incorrectly models this table as `(id uuid, provider_id uuid, secret_ciphertext text)`. It is not schema-parity evidence and must be corrected before treating the RC456 test as representative of production.
- Repository migration source search did not locate a historical CREATE TABLE migration for `smm_provider_credentials`. The exact historical DDL / baseline provenance must be recovered from the applied migration ledger or an authoritative schema dump. Do not invent a table definition or rewrite already-applied migration history.

## Required remediation

1. Recover the exact historical creation DDL for the legacy SMM tables, including `smm_provider_credentials` and `smm_providers`, from an authoritative source.
2. Decide on a safe replay baseline that respects the immutable production migration ledger; document whether a full empty-database replay is possible from committed source.
3. Update RC456's disposable fixture to mirror the actual live table shape and constraints, and test the exact privilege contract.
4. Re-run disposable migration replay with startup throttling distinguished from SQL/schema failures.
5. Do not apply RC425–RC456 or deploy the new SMM gateway until these issues and the broader release gates pass.

## Safety actions taken

Only read-only schema inspection and source/log review were performed. No production schema, grants, RLS, data, Edge Function, wallet, or payment changes were made.
