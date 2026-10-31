# Production Finance Live Contract Recheck — 2026-10-31

**Project:** `moyhiluyhjsujhwlyeuu`  
**Read-only capture:** Security/Performance Advisor at `2026-10-31T01:21:26Z`; selected live table/function inspection completed during the same session.  
**Scope:** Subscription checkout and financial journal schema/RPC contract only. No row-level payment or financial records were read.

## Live subscription contract

The current `public.subscription_payment_intents` table has 18 observed columns, including `id`, `business_id`, `tier_code`, `billing_cycle`, `amount`, `currency`, `status`, `provider`, provider correlation IDs, `idempotency_key`, `pricing_hash`, `created_by`, `expires_at`, and timestamps.

The following required RC435/RC439 fields are absent:

- `provider_creation_state`
- `provider_creation_claimed_at`
- `client_secret_ciphertext`
- `client_secret_iv`
- `client_secret_key_version`

Only `public.create_subscription_payment_intent_backend(uuid,text,text,text,text,uuid)` was found among the inspected subscription create/claim RPCs. It is SECURITY DEFINER, owned by postgres, has an empty configured search_path, and is executable by `service_role` only among the API roles checked. Its current implementation inserts the legacy intent shape and does not implement the RC435 atomic provider-creation claim/recovery contract.

The following RPCs remain absent:

- `public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)`
- `public.claim_subscription_provider_intent_creation_backend(uuid,uuid)`

## Live financial journal contract

The live `public.journal_entries` table still lacks:

- `entry_number`
- `total_debit`
- `total_credit`
- `posted_at`
- `updated_at`
- `reversed_by_entry_id`

The live `public.journal_entry_lines` table still lacks `line_number`.

Both `public.post_financial_journal(jsonb,jsonb)` and `public.post_financial_journal_backend(uuid,jsonb,jsonb)` are SECURITY DEFINER and currently configure `search_path=public`. Effective EXECUTE for `anon` and `authenticated` is false; effective EXECUTE for `service_role` is also false. The backend function requires `p_user_id = auth.uid()`, which is incompatible with the current Edge Function's intended service-role actor-bound call unless the database contract is deliberately reconciled.

No service-role grant was added. Do not simply grant EXECUTE: first review the replacement function body, actor identity, tenant/business/branch scope, duplicate journal behavior, trigger behavior, and ledger balance calculation in an isolated current-schema rehearsal.

## Live aggregate counts

| Relation | Rows reported |
|---|---:|
| `businesses` | 10 |
| `branches` | 10 |
| `user_memberships` | 33 |
| `subscription_tier_prices` | 4 |
| `subscription_payment_intents` | 0 |
| `journal_entries` | 0 |
| `journal_entry_lines` | 0 |
| `general_ledger` | 0 |

These are aggregate point-in-time counts only. They do not establish backup/restore capability or runtime payment readiness.

## Advisor snapshot

At `2026-10-31T01:21:26Z`:

### Security

- 8 RLS-enabled tables with no policies (INFO).
- 3 anon-executable SECURITY DEFINER functions (WARN).
- 67 authenticated-executable SECURITY DEFINER functions (WARN).
- Anonymous sign-in setting findings remain present.
- Leaked Password Protection remains disabled (WARN).

The 8 no-policy tables remain fail-closed candidates; do not add broad policies merely to silence the advisor. The SECURITY DEFINER findings require per-function caller and privilege review, not bulk revocation.

### Performance

- 129 unindexed foreign keys (INFO).
- 375 auth/RLS init-plan findings (WARN).
- 73 unused indexes (INFO).
- 28 groups with multiple permissive policies (WARN).

No mass index or policy rewrite was performed.

## CI evidence versus Production state

- PR #559's disposable PostgreSQL 16 runs passed for RC435→RC439 checkout, recovery, and RC449A→RC450 financial-journal integration. This is targeted fixture evidence, not a full current-Production restore.
- PR #561's disposable trigger-only SECURITY DEFINER ACL/search_path rehearsal passed. It does not apply those changes to Production.
- The historical October 17 baseline at checkpoint `20261008222845` is not a schema-faithful capture of the current October 31 Production database.

## Required next steps

1. Obtain a complete, schema-only, credential-scrubbed current Production capture with the Supabase CLI from an authorized environment. Do not substitute the historical baseline or targeted fixtures.
2. Restore that capture in a disposable PostgreSQL/Supabase environment and verify all 308 recorded migrations plus the exact live drift. Production data must not be copied into CI.
3. Rehearse a newly named forward-only reconciliation migration after reviewing current constraints, indexes, triggers, grants, RLS/FORCE RLS, and dependent Edge Functions. Do not apply old RC435/439/449A/450 files out of order or fabricate historical ledger rows.
4. Run RC435/439 and RC449A/450 adversarial integration tests against that restored current schema, including retry/idempotency, actor mismatch, cross-tenant/business/branch access, trigger behavior, duplicate journal IDs, balanced detail lines, and cumulative running balances.
5. Verify a restorable backup and measured RPO/RTO before any Production rollout.
6. Deploy payment Edge Functions only after schema, RPC ACL, secrets, and Paymob sandbox runtime contracts match; then run end-to-end sandbox payment/webhook/reconciliation tests.

**Production effect: NONE.** This checkpoint used read-only queries and metadata inspection. No DDL, grants, RLS, Auth setting, Edge Function, secret, payment intent, journal entry, or financial record was changed.

**Decision: Overall Production Gate remains BLOCKED / NOT CERTIFIED.**
