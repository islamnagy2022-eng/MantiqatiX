# Runbook: resolve the ten missing SECURITY DEFINER replay dependencies

**Scope:** disposable CI/replay environments only. This runbook does not authorize production writes, function deployment, migration-history rewrites, or a merge.

## Recommended decision

Use this order:

1. **Preferred — recover the authoritative historical creation DDL.** Search the complete Git history, archived source bundles, migration backups, CI artifacts, and approved schema-only dumps for the ten function definitions as they existed before `20260927095000_revoke_unused_security_definer_execute.sql`. Restore original migration(s) only if provenance and original content can be verified; never rewrite an already-applied migration to pretend the history was different.
2. **Fallback — owner-approved test-only schema baseline.** If historical DDL cannot be recovered, an authorized project owner may approve a fixture generated from trusted live definitions. Store it outside `supabase/migrations/` (for example, `supabase/tests/fixtures/legacy_security_definer_baseline.sql`) and inject it only into the disposable replay database immediately before chronological migrations begin. This makes replay useful for testing later migrations against an explicit baseline; it does **not** prove that the repository contains a complete historical schema.
3. If neither source is available, keep replay blocked and report missing provenance. Do not use placeholder functions, empty function bodies, guessed `CREATE OR REPLACE` definitions, skipped migrations, or conditional revokes that silently pass when the target function is missing.

## Ten required signatures

- `public.counter_offer_indrive_bid(uuid,uuid,numeric)`
- `public.fashion_erp_mutate(text,jsonb,text)`
- `public.mantigo_accept_bid(text,text)`
- `public.mantigo_cancel_ride(text)`
- `public.mantigo_create_ride(text,text,text,text,numeric,text)`
- `public.mantigo_rate_ride(text,integer,text)`
- `public.mantigo_submit_bid(text,numeric,text,text,text,text)`
- `public.mantigo_update_proposed_price(text,numeric)`
- `public.restaurant_erp_mutate(text,jsonb,text)`
- `public.restaurant_table_mutate(text,jsonb,text)`

## Read-only inventory query

Run this in the intended Supabase project's SQL Editor with a read-only session/transaction. It reads PostgreSQL catalogs and does not modify schema or data. Handle returned function bodies as sensitive source code.

```sql
begin transaction read only;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  p.proacl as function_acl,
  pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'counter_offer_indrive_bid',
    'fashion_erp_mutate',
    'mantigo_accept_bid',
    'mantigo_cancel_ride',
    'mantigo_create_ride',
    'mantigo_rate_ride',
    'mantigo_submit_bid',
    'mantigo_update_proposed_price',
    'restaurant_erp_mutate',
    'restaurant_table_mutate'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

rollback;
```

The result must contain the exact expected overload for each signature. Do not copy an overload merely because its name matches. If a function is absent, stop and recover it from a trusted backup/source; do not invent it.

## Requirements before accepting a test-only baseline

- Record owner approval and source/provenance for every definition.
- Verify exact signature, return type, language, volatility, `SECURITY DEFINER` flag, `search_path`, owner, and grants. Treat live definitions as a current snapshot, not automatically as historical truth.
- Check referenced tables, types, extensions, and helper functions. The fixture may include only the minimum trusted prerequisite schema needed for replay; document every prerequisite and avoid production data.
- Keep the fixture outside `supabase/migrations/`. The replay workflow must inject it only into a fresh disposable database, before migrations, and fail if the fixture is missing or its pinned checksum changes unexpectedly.
- After injection, assert all ten exact signatures exist and the historical revocation migration executes successfully. Then run every repository migration in timestamp order and verify the final migration ledger and database invariants.
- Label the result accurately: **“chronological migrations replayed against approved test baseline”**, not “complete historical schema reconstructed.”
- Never run the fixture against production and never add live secrets or production data to it.

## Acceptance criteria to unblock CI

1. Source/provenance review is recorded.
2. The baseline contains exact trusted definitions—not stubs—and only required schema prerequisites.
3. The replay job proves the baseline is used only in disposable CI.
4. All migrations run in timestamp order from a clean database with zero skipped migrations.
5. Final schema/invariant checks pass and evidence is tied to the exact candidate commit.
6. Production migration reconciliation, separate from CI replay, is completed through an approved release plan.

## Current status

The current replay guard is correctly failing before Supabase services start. No migration was applied by that failed job. Until authoritative DDL is recovered or a test-only baseline is explicitly approved and validated, keep the release gate blocked.
