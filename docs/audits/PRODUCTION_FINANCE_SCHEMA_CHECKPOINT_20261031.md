# Production Finance Schema Checkpoint — 2026-10-31

**Project:** `moyhiluyhjsujhwlyeuu`  
**Capture:** `2026-10-31T00:20:42Z`  
**Method:** Read-only PostgreSQL catalog inspection of selected schema metadata, function ACL/configuration, trigger metadata, migration ledger, and aggregate row counts. No row-level customer, payment, or financial content was retrieved.

## Migration ledger

| Item | Observed |
|---|---:|
| Recorded migrations | 308 |
| Latest version | `20261029083845` |
| Latest migration | `require_phone_for_published_directory_listings` |
| RC435 `20261009210000` | Not recorded |
| RC439 `20261010010000` | Not recorded |
| RC449A `20261010175000` | Not recorded |
| RC450 `20261010180000` | Not recorded |

Missing ledger identifiers are not, by themselves, proof that every physical effect is absent. The physical contract findings below were independently queried.

## Selected tables

All nine inspected relations have both RLS enabled and FORCE RLS enabled.

| Table | Required/important live fields observed | Release relevance |
|---|---|---|
| `businesses` | `id`, `tenant_id`, `name`, `code`, `status` | Fixtures must meet the real required business identity fields. |
| `branches` | `id`, `tenant_id`, `business_id`, `name`, `code`, `status` | Fixtures must include a tenant/business-bound branch and required name/code. |
| `user_memberships` | `id`, `user_id`, `tenant_id`, `role`, `status` | Fixtures must include identifiers and tenant scope. |
| `subscription_tier_prices` | `tier_code`, `monthly_price`, `annual_price`, `currency` | Four tier rows observed at capture time. |
| `subscription_payment_intents` | `business_id`, `tier_code`, `billing_cycle`, `amount`, `currency`, `status`, `idempotency_key`, `pricing_hash`, `created_by` | Five RC435/RC439 columns are still absent. |
| `chart_of_accounts` | `id`, `tenant_id`, `account_code`, `account_name`, `account_type` | Account fixtures must satisfy tenant/account identity. |
| `journal_entries` | `id`, `tenant_id`, `status`, optional org/business/branch scope | Six RC449A columns are still absent. |
| `journal_entry_lines` | `id`, `journal_entry_id`, `account_id`, `debit`, `credit` | RC449A `line_number` is still absent. |
| `general_ledger` | `tenant_id`, `journal_entry_id`, `account_id`, `debit`, `credit`, `running_balance`, `posted_at` | Base ledger relation is present; RC449A/RC450 contract still needs ordered reconciliation. |

## Confirmed missing subscription contract

The following columns remain absent from `public.subscription_payment_intents`:

- `provider_creation_state`
- `provider_creation_claimed_at`
- `client_secret_ciphertext`
- `client_secret_iv`
- `client_secret_key_version`

Only the legacy `create_subscription_payment_intent_backend(uuid,text,text,text,text,uuid)` was found among the three inspected creation/claim RPC contracts. It is SECURITY DEFINER, has an empty search path, and grants EXECUTE to `service_role`. Both claim/recovery RPCs are absent:

- `create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)`
- `claim_subscription_provider_intent_creation_backend(uuid,uuid)`

## Confirmed missing journal contract

The following columns remain absent:

- `journal_entries.entry_number`
- `journal_entries.total_debit`
- `journal_entries.total_credit`
- `journal_entries.posted_at`
- `journal_entries.updated_at`
- `journal_entries.reversed_by_entry_id`
- `journal_entry_lines.line_number`

The live `post_financial_journal(jsonb,jsonb)` and `post_financial_journal_backend(uuid,jsonb,jsonb)` are SECURITY DEFINER functions with `search_path=public`; their live ACLs grant EXECUTE only to `postgres`. In particular, `service_role` EXECUTE remains false. The existing backend function body is not the canonical RC450 actor/tenant-scoped service-role contract.

## Trigger-only SECURITY DEFINER findings

| Function | Trigger | Current path | Direct EXECUTE |
|---|---|---|---|
| `assign_default_owner_to_unowned_business()` | Enabled, deferred AFTER INSERT on `businesses` | `public, auth` | Default ACL; anon/authenticated/service_role effective EXECUTE true |
| `capture_commission_rule_audit()` | Enabled AFTER INSERT/UPDATE/DELETE on `commission_rules` | Empty | Default ACL; anon/authenticated/service_role effective EXECUTE true |

PR #561 provides disposable PostgreSQL 16 evidence that both can be hardened with an empty `search_path` and direct EXECUTE revoked from PUBLIC/anon/authenticated/service_role while preserving the already-created triggers. **No live ACL or function setting was changed.**

The public `get_mnty_targeted_advertisements(...)` RPC remains a distinct intentional public read endpoint, uses an empty search path, and must not be included in a blanket trigger-function revoke.

## Aggregate counts at capture

| Relation | Rows |
|---|---:|
| `businesses` | 10 |
| `branches` | 10 |
| `user_memberships` | 33 |
| `subscription_tier_prices` | 4 |
| `subscription_payment_intents` | 0 |
| `journal_entries` | 0 |
| `journal_entry_lines` | 0 |
| `general_ledger` | 0 |

Counts are a point-in-time aggregate only. They do not prove backup, restore, transaction correctness, or payment runtime readiness.

## Decision

**Production Gate: BLOCKED / NOT CERTIFIED.**

No migration, grant, RLS, Auth setting, Edge Function, secret, payment, wallet, journal entry, or production data was changed by this inspection. The next safe step is a restorable, current-schema-faithful isolated rehearsal. The existing Oct 17 baseline at checkpoint `20261008222845` and targeted PostgreSQL fixtures are not a full current-Production restore.

