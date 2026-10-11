# SMM Providers — Live Schema Evidence

**Status:** Read-only catalog evidence only. This document is not an authoritative historical creation migration and is **not approved as a replay baseline**.

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

The owner has approved use of the documented `smm_provider_credentials` snapshot for an isolated test/replay environment only. That table's observed foreign key references `public.smm_providers(id)`; therefore the credentials snapshot cannot be installed exactly unless the provider table exists first. The provider table evidence in this document has **not** been approved as a replay baseline.

## Safety and next step

Do not guess the original DDL, create a minimal fake provider table, modify already-applied migration history, or apply any baseline to production. Recover the original provider-table DDL from authoritative history or obtain explicit approval for a separately versioned test-only baseline, then validate the baseline and full ordered replay on disposable infrastructure.

No production schema, grants, RLS, credentials, data, wallet balances, payment records, or Edge Functions were changed while collecting this evidence.
