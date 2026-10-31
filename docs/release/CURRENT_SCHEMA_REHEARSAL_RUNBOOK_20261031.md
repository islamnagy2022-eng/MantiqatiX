# MantiqaTix — Current Production Schema Rehearsal Runbook

**Status: BLOCKED — local capture and restore have not yet been executed.**  
**Snapshot date:** 2026-10-31 (read-only Supabase checks at approximately 13:33 UTC).  
**Purpose:** prepare a reproducible, credential-scrubbed, schema-faithful rehearsal without changing Production or incurring Supabase branch/project costs.

## 1. Current environment facts

| Item | Observed value |
|---|---|
| Supabase project | `moyhiluyhjsujhwlyeuu` |
| Organization plan | Free |
| Region | `us-east-2` |
| PostgreSQL | `17.6.1.155` |
| Migration ledger | 308 rows |
| Latest recorded migration | `20261029083845` |
| Public tables | 136 |
| Public tables with RLS | 136 |
| Public tables with FORCE RLS | 112 |
| RLS-enabled tables without policies | 8 |
| Supabase development branches listed | Only default `main`; no separate disposable development branch |
| Automatic daily backup | Not included on the observed Free plan |

The branch inventory reports the default `main` branch with `with_data=false`. It is not a current-Production clone and is not evidence of a successful restore.

Supabase's current documentation says Free projects do not receive automatic daily backups; use a manual CLI logical dump. The CLI backup flow requires Docker and a database connection string. Use the dashboard's Session Pooler connection by default, unless the network supports IPv6 or an IPv4 add-on is present. References:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/kb/faqs/platform/free-plan-backups

No automatic backup, manual dump artifact, or successful restore artifact was established by this session. Do not claim that a recoverable backup exists.

## 2. Read-only Production evidence captured

### Finance, wallet, subscription and advertising contracts

| Contract | Live finding |
|---|---|
| `journal_entries.entry_number` | Missing |
| `journal_entries.total_debit` | Missing |
| `journal_entries.total_credit` | Missing |
| `journal_entries.posted_at` | Missing |
| `journal_entry_lines.line_number` | Missing |
| `subscription_payment_intents.provider_creation_claimed_at` | Missing |
| `subscription_payment_intents.provider_creation_claim_token` | Missing |
| `subscription_payment_intents.encrypted_checkout_url` | Missing |
| `subscription_payment_intents.provider_order_id` | Present |
| `create_wallet_transaction_backend` | SECURITY DEFINER; `search_path=public`; no `service_role EXECUTE` |
| `post_financial_journal` | SECURITY DEFINER; `search_path=public`; no `service_role EXECUTE` |

Read-only row counts at the same snapshot: `wallet_accounts=0`, `wallet_transactions=0`, `journal_entries=0`, `journal_entry_lines=0`, `subscription_payment_intents=0`, `ad_spaces=2`. These counts do not authorize test transactions or prove functional readiness.

### Advertising authorization — P0 review item

The live `public.ad_spaces` table has RLS and FORCE RLS enabled. Direct privilege inspection shows `authenticated` has SELECT, INSERT, UPDATE and DELETE privileges; `anon` has none. Its policy inventory includes an authenticated SELECT policy plus multiple permissive authenticated ALL policies whose predicates only exclude anonymous sessions (including `authenticated_sessions_only`, `deny_anonymous_users`, `mnt_non_anonymous_boundary` and `non_anonymous_authenticated_guard`).

**Disposition:** treat direct authenticated write access to `ad_spaces` as an unresolved high-priority authorization risk. The combination of table DML grants and permissive ALL policies appears to permit a signed-in non-anonymous user to write rows without a platform-admin or tenant/slot ownership predicate. A dedicated real authenticated request test has not been run. Do not expose or enable ad-slot create/update/delete UI, booking, or pricing writes until the policy model is repaired and tested on the isolated rehearsal database. Do not make an improvised Production policy change.

### Fresh Supabase Advisor inventory

Observed at 2026-10-31 approximately 13:33 UTC:
- 8 RLS-enabled tables with no policies (INFO; inspect direct grants and FORCE RLS individually, do not add broad policies).
- 3 anonymously executable SECURITY DEFINER functions.
- 67 authenticated-executable SECURITY DEFINER functions.
- Leaked Password Protection remains disabled (1 finding).
- Performance Advisor: 129 unindexed foreign keys, 375 auth/RLS init-plan findings, 73 unused indexes and 28 multiple-permissive-policy groups.

These Advisor counts are triage inventories, not proof that every finding is exploitable. Do not apply blanket GRANT/REVOKE, policy, function or index changes. Review each function and policy against its caller, actor-binding and tenant/branch contract.

## 3. Cost and environment guardrails

1. Do not create a Supabase project, development branch, PITR add-on, compute add-on or other paid resource for this rehearsal.
2. Prefer a local Supabase stack using Docker for the schema-only rehearsal. If a remote disposable environment is later required, first obtain an explicit zero-cost quote and approval; otherwise stop.
3. Never restore to the Production project. Never run `supabase db push`, `supabase migration up`, `apply_migration`, `reset`, or DDL against Production as part of this runbook.
4. Do not share database passwords, access tokens, service-role keys, connection strings, password hashes, or unredacted dump files in chat, GitHub, CI logs or repository commits.
5. Do not copy Production business rows, customer records, Auth users, payment data or storage objects into a shared test environment. This runbook is a schema-only rehearsal. Use synthetic fixtures only after restore.
6. Do not fabricate migration ledger rows, rewrite historical migrations, or replay the 41 required versions blindly. Their exact-version gap is not proof that all corresponding physical effects are absent.

## 4. Capture procedure — operator machine only

### 4.1 Prerequisites and secure working directory

On an operator-controlled machine with Docker, PostgreSQL client tools and the Supabase CLI installed:

```bash
supabase --version
supabase db dump --help

umask 077
mkdir -p "$HOME/mantiqatix-prod-schema-20261031"
chmod 700 "$HOME/mantiqatix-prod-schema-20261031"
cd "$HOME/mantiqatix-prod-schema-20261031"
```

Do not place this directory inside the Git working tree. Do not send the password to the assistant. Obtain the connection string from the Supabase Dashboard's **Connect** panel and enter the database password locally. Prefer a shell prompt or a local protected secret manager; do not commit it to a `.env` file.

### 4.2 Capture roles and schema (no application data)

Use the official CLI dump commands:

```bash
supabase db dump --db-url "$PROD_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$PROD_DB_URL" -f schema.sql
```

The default CLI dump excludes Supabase-managed schemas such as `auth` and `storage`, and extension-managed schemas. Inventory custom triggers, functions, grants and RLS policies in `auth` and `storage` separately. Supabase documents `supabase db diff --linked --schema auth,storage` for reviewing custom changes to those schemas. Do not blindly restore the entire managed schemas into a new environment.

If the isolated rehearsal needs the exact migration ledger baseline, capture its schema and rows separately, as documented by Supabase:

```bash
supabase db dump --db-url "$PROD_DB_URL" -f history_schema.sql --schema supabase_migrations
supabase db dump --db-url "$PROD_DB_URL" -f history_data.sql --use-copy --data-only --schema supabase_migrations
```

Import this history only into the disposable rehearsal environment after confirming its target is empty and that the purpose is to continue from the existing live baseline. Never hand-insert or invent version rows.

### 4.3 Credential and integrity screening

Before the files leave the operator machine:
- Inspect `roles.sql` for LOGIN role passwords or credential material; remove password clauses and use disposable test credentials only.
- Check the dump for connection strings, JWT secrets, API keys, passwords and secret literals. Do not print matches into shared logs.
- Keep original unredacted files local and encrypted at rest if retention is required; create a separately sanitized copy for restore.
- Record SHA-256 hashes, capture time, CLI version, Postgres version and the fact that no data dump was taken.
- Never commit `roles.sql`, `schema.sql`, history dumps or dump hashes that reveal credentials. The repository should contain only this runbook and non-secret verification evidence.

Example integrity record:

```bash
sha256sum roles.sanitized.sql schema.sql history_schema.sql history_data.sql > SHA256SUMS.txt
```

### 4.4 Restore into a disposable local target

Start an isolated local Supabase stack from the project configuration (or use an explicitly approved disposable target). Verify the target project/ref and database URL before restoring. The restore command must reference only the local/disposable database:

```bash
psql "$TEST_DB_URL" \
  --single-transaction \
  --set ON_ERROR_STOP=on \
  --file roles.sanitized.sql \
  --file schema.sql
```

Restore the migration-history schema/data only if the rehearsal requires the original ledger baseline, and only in the disposable target. Do not import Production data. If managed-schema customizations are present, restore only the individually reviewed custom objects into the local Supabase-managed schemas.

Stop on the first SQL error. Do not bypass owner, privilege, extension, RLS, trigger or schema errors by deleting statements without recording and reviewing the dependency. Do not set `session_replication_role=replica` for this schema-only restore; that setting is relevant to the separate data-restore process and must not be copied in as a generic fix.

## 5. Rehearsal verification checklist

After restore, collect evidence for each item:

- [ ] Public table count equals the captured 136 and every public base table retains RLS.
- [ ] FORCE RLS count equals the captured 112; the eight no-policy tables are individually reconciled against direct privileges and intended RPC-only behavior.
- [ ] Table columns, types, defaults, nullability, primary keys, foreign keys, unique constraints, indexes, triggers, views and functions are structurally reconciled.
- [ ] RLS policy definitions, target roles, USING/WITH CHECK predicates and direct table/function grants are compared; no broadening is accepted.
- [ ] Custom auth/storage objects are compared separately; Supabase-managed objects are not replaced wholesale.
- [ ] Finance gaps listed in Section 2 reproduce exactly; RC449A/RC450 prerequisite migrations are rehearsed in their documented order only after object-level reconciliation.
- [ ] `ad_spaces` broad authenticated DML behavior is reproduced in a disposable database, then a least-privilege candidate is tested against platform-admin, tenant-admin, ordinary authenticated and anonymous actors.
- [ ] Wallet and journal tests verify no posting, credit, debit or settlement occurs without the correct backend actor, grants, idempotency and balanced journal contract.
- [ ] Subscription claim/recovery tests fail closed until the expected claim-token and encrypted-checkout schema/RPC contract is present.
- [ ] Migration replay and rollback are exercised only against the disposable target; every failure is recorded and explained.
- [ ] The test dataset is synthetic and contains no Production user/customer/payment data.
- [ ] Restore start/end timestamps and observed duration are recorded. This schema-only exercise does **not** prove full data recovery or measured production RPO/RTO.

## 6. Stop conditions and release gate

Stop and leave the rehearsal **BLOCKED** when any of the following occurs:
- database password, CLI/Docker prerequisite, or an authorized local operator machine is unavailable;
- the dump omits custom auth/storage objects needed by the app;
- the restored schema differs from the live structural snapshot;
- a migration assumes a physical object not present or has a conflicting forward repair;
- roles, SECURITY DEFINER, search_path, function EXECUTE or RLS behavior differs;
- the only available isolated target would incur an unapproved charge;
- a proposed step requires Production DDL/DML, grants, RLS/Auth setting changes, Edge deployment, payment, wallet movement or journal posting.

**Release decision:** the global platform gate remains **BLOCKED / NOT CERTIFIED**. A successful schema-only rehearsal is one prerequisite only; it is not a full backup/restore certification, payment E2E, financial certification or authorization to deploy Production changes.

## 7. Next ordered actions

1. An authorized operator creates the credential-scrubbed local dump and verifies its hashes.
2. Restore into a local disposable Supabase stack and compare the structural inventory.
3. Reconcile the 41 exact required migration IDs against later-dated migrations and physical object effects; preserve historical migrations and aliases.
4. Reproduce and repair the `ad_spaces` authorization issue in isolation; add real role-scoped SQL/API tests.
5. Rehearse RC449A → RC450 and subscription claim/recovery contracts against the current-schema restore.
6. Only after independent security review, provider sandbox tests, rollback evidence and explicit approval may a separate Production rollout plan be considered.
