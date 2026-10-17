# SMM Providers — Live Schema Evidence

**Status:** Read-only catalog evidence from production. On 2026-10-11 the owner explicitly approved using this observed schema as a **test-only baseline for isolated disposable replay**. It is not the original historical DDL, does not establish historical creation chronology, and must never be applied to production.

**Observed:** 2026-10-11, Supabase project `moyhiluyhjsujhwlyeuu`, using read-only PostgreSQL catalog introspection. No provider records or API URLs were queried.

## Current live table shape

Table: `public.smm_providers`  
Owner: `postgres`  
RLS: enabled; FORCE RLS: disabled.

| Column | Type | Nullable | Default |
|---|---|---:|---|
| `id` | `uuid` | No | `gen_random_uuid()` |
| `name` | `text` | No | — |
| `api_url` | `text` | No | — |
| `api_style` | `text` | No | `'generic'` |
| `active` | `boolean` | No | `false` |
| `priority` | `integer` | No | `100` |
| `notes` | `text` | Yes | — |
| `created_at` | `timestamptz` | No | `now()` |
| `updated_at` | `timestamptz` | No | `now()` |

Constraints and indexes:
- Primary key: `smm_providers_pkey` on `id`.
- Unique constraint/index: `smm_providers_name_key` on `name`.
- Additional indexes: none returned by catalog introspection.
- Triggers: none returned by catalog introspection.
- RLS policy observed: `deny_direct_access_authenticated`, command `ALL`, role `authenticated`, `USING (false)` and `WITH CHECK (false)`.

## Migration replay dependency

The earliest committed migration, `20260927074200_harden_smm_table_api_privileges.sql`, references both `public.smm_providers` and `public.smm_provider_credentials`. Repository inspection found no committed migration that creates `public.smm_providers`.

The owner approval recorded below covers both the `smm_providers` and `smm_provider_credentials` snapshots as test-only baselines for an isolated disposable replay. The provider baseline must be injected first because the credentials table has a foreign key to `public.smm_providers(id)`. This approval does not recover historical creation DDL and does not authorize production application.

## Safety and next step

Do not guess the original historical DDL, modify already-applied migration history, or apply any baseline to production. The approved baseline reproduces the observed live schema for test replay only; validate the baseline and full ordered replay on disposable infrastructure before making any release decision.

No production schema, grants, RLS, credentials, data, wallet balances, payment records, or Edge Functions were changed while collecting this evidence.


## Owner approval update — 2026-10-11

The owner explicitly instructed “اعتمد المصدر عندك مصدر فعلي”. This is recorded as approval to use the live catalog snapshot as a real schema source for a test-only baseline in disposable replay. It does not authorize production changes, table data export, or rewriting historical migration records. The release-reconciliation PR includes the baseline, validator checks, and CI injection plan; the replay must still pass on the exact current head.
