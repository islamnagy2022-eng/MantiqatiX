# Migration Replay Blockers — 2026-10-11

## Status

**BLOCKED — do not apply the post-RC424 batch to production.**

The production migration ledger currently ends at `20261008222845` (`rc424_atomic_digital_page_payment_webhook`). Read-only comparison found matching bodies for two RC424 payment-related functions only; it did **not** compare the entire applied migration, so the RC424 source/ledger identity and the theory that the filename timestamp is a legacy alias remain NOT VERIFIED. Preserve the applied ledger history and do not rename or rewrite applied migrations.

The full disposable Supabase replay previously failed at historical migration `20260927074200_harden_smm_table_api_privileges.sql`, because it references `public.smm_provider_credentials` before any committed migration in the repository creates that table. A newer replay attempt is tracked in [run 38135821672](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38135821672); its final outcome must be read from GitHub before changing this status.

## Read-only production schema evidence

A read-only catalog query against Supabase project `moyhiluyhjsujhwlyeuu` returned the following definition for `public.smm_provider_credentials`:

| Column | Type | Nullable | Default |
|---|---|---:|---|
| `provider_id` | `uuid` | No | — |
| `api_key_ciphertext` | `text` | Yes | — |
| `configured` | `boolean` | No | `false` |
| `updated_at` | `timestamptz` | No | `now()` |

Constraints and security metadata:
- Primary key: `(provider_id)`.
- Foreign key: `provider_id REFERENCES public.smm_providers(id) ON DELETE CASCADE`.
- Index: `smm_provider_credentials_pkey`, unique B-tree on `provider_id`.
- Owner: `postgres`; RLS enabled; FORCE RLS disabled.
- This table stores encrypted provider credentials. Do not add direct client access or expose its ciphertext.

## Why this does not resolve the blocker

The catalog result proves the current live table shape, not the original creation migration, original creation timestamp, full historical DDL, or how existing production rows were populated. The RC456 test fixture now reflects the observed columns, but a test fixture is not an authoritative production migration baseline.

Do not invent a backdated migration, rewrite an applied migration, bypass the failing historical migration, or make the replay pass by pre-seeding an untracked table. Recover the original DDL from an authoritative source (repository history, approved database baseline, or an owner-approved schema export), then design a reviewed reconciliation that preserves migration history and safely handles the already-existing production table.

## Required next steps

1. Recover and verify the authoritative original DDL for `smm_provider_credentials`.
2. Decide, with a documented migration-history strategy, how clean installations and the already-provisioned production database converge without duplicate objects or data loss.
3. Re-run the complete repository migration chain on a disposable Supabase instance from an empty database.
4. Verify the final schema, constraints, RLS, grants, functions, and indexes against production read-only evidence.
5. Test the rollback/data-preservation plan and only then review a staged production application plan.

No production schema, data, grants, RLS, secrets, Edge Functions, wallet balances, or payments were changed during this investigation.


## Latest continuation — 2026-10-11

- Recovered the missing post-RC424 SQL integration fixtures referenced by `module-professionalization.yml` into the migration-recovery branch. The previously failing exact-head workflow had stopped at missing fixture files before running SQL; the next run is required to confirm the tests execute rather than merely pass static checks.
- Updated the candidate source for `payment-intent`, `paymob-webhook`, `digital-page-payment-intent`, and `mantigo-payment-intent` from the existing review branch, restoring provider-order correlation, retryable handling of incomplete provider responses, and atomic webhook RPC paths expected by the committed order-binding contract. Added server-side ERP purchase-order create/line functions required by the staged UI. These are source-only changes and have not been deployed.
- Adjusted the financial-journal static validator to accept the actual safe Bearer-token flow: require the Bearer prefix, then validate the extracted token through Supabase Auth. The previous validator incorrectly required a local variable named `token` even though the handler safely passes `authorization.slice(7).trim()`.
- Exact-head GitHub Actions for `0dca6c86f109a6c67d38f34932165e3871b572e8` were queued at the time of this note. Earlier runs showed RC434 and RC437 disposable PostgreSQL integration jobs passing; payment order-binding checks failed before the function-source refresh and must be re-evaluated on the new head.
- The full disposable Supabase replay remains NOT VERIFIED. Run `38135821672` failed while starting Supabase services (Docker image registry/service startup), before the full replay step; a retry was requested. The documented earlier historical migration blocker concerning `smm_provider_credentials` still requires authoritative original DDL and must not be bypassed by pre-seeding a test table or inventing a backdated migration.
- No production migrations, Edge Function deployments, grants/RLS/Auth changes, wallet mutations, payments, or customer-data writes were performed.
