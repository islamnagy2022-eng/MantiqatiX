# Credit Schema Compatibility Baseline — Evidence and Limits

**Decision:** Owner-approved for disposable CI replay only on 2026-10-13.  
**Source:** Read-only PostgreSQL catalog introspection of Supabase project `moyhiluyhjsujhwlyeuu`.  
**Not:** recovered historical creation DDL, an authoritative migration record, or approval to modify production.

## Why this fixture exists

The live migration ledger contains `20260920155456 / harden_credit_status_authorization`, whose function body references `public.credit_accounts` and `public.credit_periods`, but the recorded ledger does not contain the creation migration for `credit_policies`, `credit_accounts`, or `credit_periods`. The RC40 archive has a later credit creation migration, but its defaults and some foreign-key details differ from the live catalog. The current clean replay therefore fails before later candidate migrations can be validated.

The approved fixture provides a disclosed live-derived table-shape starting point for a disposable replay. It is injected as temporary untracked SQL only by `.github/workflows/migration-chain-replay.yml`.

## Observed schema reproduced by the fixtures

- `credit_policies`: varchar primary key; tenant/business scope; `credit_limit numeric(18,2)`; `billing_cycle='MONTHLY'`; `payment_due_days=30`; `grace_days=0`; `warning_days=3`; `suspend_after_days=15`; `block_new_credit=true`; `status='ACTIVE'`; created/updated timestamps.
- `credit_accounts`: varchar primary key; tenant/business/policy scope; `approved_limit numeric(18,2) default 0`; `outstanding_amount numeric(18,2) default 0`; generated stored `available_amount = GREATEST(approved_limit - outstanding_amount, 0)`; `status='ACTIVE'`; due/payment timestamps.
- `credit_periods`: varchar primary key; tenant/account scope; date range and due date; `billed_amount numeric(18,2) default 0`; `paid_amount numeric(18,2) default 0`; generated stored `outstanding_amount = GREATEST(billed_amount - paid_amount, 0)`; `status='OPEN'`; `days_overdue=0`; payment and audit timestamps.
- Foreign keys and check/unique constraints match the read-only catalog evidence, including `period_end >= period_start` and the live `credit_accounts.credit_policy_id` foreign key's default `NO ACTION` behavior.
- The tables have RLS enabled and FORCE RLS enabled in the observed catalog.

## Temporary injection order

| Temporary version | Fixture |
| --- | --- |
| `20260920155450` | `credit_policies.sql` |
| `20260920155451` | `credit_accounts.sql` |
| `20260920155452` | `credit_periods.sql` |

All three versions sort before `20260920155456_harden_credit_status_authorization.sql`. The ordered migration `20260920211717_security_definer_surface_reduction_and_finance_rls.sql` continues to create the finance-read policies; the fixtures intentionally do not duplicate them. Extra restrictive policies seen live are excluded because their creation lineage is not represented in the recorded ledger.

## Safety and acceptance criteria

- No rows, customer records, tenant data, wallet balances, payment records, or secrets are copied.
- CI creates the temporary migration copies only in the disposable working tree and checks they are byte-identical and untracked.
- The baseline is never to be merged as a production creation migration or applied to Supabase production.
- A green workflow run must be associated with the exact tested commit. If the replay exposes another missing dependency or fails a migration/test, release remains blocked.
- Even a successful replay does not prove historical DDL provenance or production parity; the production ledger/source discrepancy remains documented.

No production schema, data, migration ledger, grants, policies, Auth settings, secrets, or Edge Functions were changed to create these fixtures.
